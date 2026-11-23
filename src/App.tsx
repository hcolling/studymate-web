import { useCallback, useEffect, useState } from 'react'
import { accessToken, handleCallback, hasSession, signIn, signOut } from './auth'
import { createSet, getMaterial, getSet, getUploadUrl, listSets, uploadPdf } from './api'
import type { MaterialResponse, StudySet } from './types'

function formatBytes(n: number|null) { return n == null ? '—' : `${(n/1024).toFixed(1)} KB` }
function isWorking(s: StudySet) { return !['READY','FAILED'].includes(s.status) }
function isUuid(id: string) { return /^[0-9a-f-]{36}$/.test(id) }

export default function App() {
  const [signedIn,setSignedIn] = useState(hasSession())
  const isAuthCallback = () => {
  const query = new URLSearchParams(window.location.search)

  return (
    window.location.pathname === '/callback' ||
    query.has('code') ||
    query.has('error')
  )
}

const [loading,setLoading] = useState(isAuthCallback())
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [sets,setSets] = useState<StudySet[]>([])
  const [selected,setSelected] = useState<StudySet|null>(null)
  const [material,setMaterial] = useState<MaterialResponse|null>(null)
  const [title,setTitle] = useState('')
  const [course,setCourse] = useState('')
  const [file,setFile] = useState<File|null>(null)
  const [uploading,setUploading] = useState(false)
  const [loadingSets,setLoadingSets] = useState(false)
  const [flip,setFlip] = useState<Record<number,boolean>>({})
  const [answers,setAnswers] = useState<Record<number,number>>({})

  const refresh = useCallback(async () => {
    if (!hasSession()) return
    try {
      const data = await listSets()
      setSets(data.sets)
      setSelected(old => old ? (data.sets.find(s => s.setId === old.setId) || old) : null)
      setError('')
    } catch (err) { setError((err as Error).message) }
  }, [])

  
useEffect(() => {
  if (!isAuthCallback()) return

  let active = true

  handleCallback()
    .then(() => {
      if (active) {
        setSignedIn(true)
        setLoading(false)
      }
    })
    .catch(err => {
      if (active) {
        setError((err as Error).message)
        setLoading(false)
      }
    })

  return () => {
    active = false
  }
}, [])

  useEffect(() => { if (signedIn && !loading) void refresh() }, [signedIn, loading, refresh])
  useEffect(() => {
    if (!signedIn || loading) return
    const id = window.setInterval(() => {
      if (sets.some(isWorking)) void refresh()
    }, 4000)
    return () => window.clearInterval(id)
  }, [signedIn, loading, sets, refresh])
  useEffect(() => {
    if (!selected || selected.status !== 'READY') { setMaterial(null); return }
    let active = true
    getMaterial(selected.setId).then(data => { if (active) setMaterial(data) })
      .catch(err => { if (active) setError((err as Error).message) })
    return () => { active = false }
  }, [selected?.setId, selected?.status])

  async function submitUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!file || !title.trim() || uploading) return
    setUploading(true); setError(''); setNotice('')
    let created: StudySet|null = null
    try {
      if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF file')
      if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('File name must end in .pdf')
      if (file.size > 10*1024*1024) throw new Error('PDF must be 10 MB or smaller')
      created = await createSet(title.trim(),course.trim())
      const signedUrl = await getUploadUrl(created.setId)
      await uploadPdf(signedUrl,file)
      setTitle(''); setCourse(''); setFile(null)
      const control = document.getElementById('pdf-file') as HTMLInputElement|null
      if (control) control.value = ''
      setNotice('PDF uploaded. StudyMate is processing the document.')
      setSelected(created)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
      if (created) setNotice(`Study set ${created.setId} is PENDING. If the upload failed, create a new study set before retrying.`)
    } finally { setUploading(false) }
  }
  async function chooseSet(item: StudySet) {
    setSelected(item); setMaterial(null); setFlip({}); setAnswers({}); setNotice(''); setError('')
    if (item.status === 'READY') {
      try { setMaterial(await getMaterial(item.setId)) }
      catch(err) { setError((err as Error).message) }
    }
  }
  async function refreshSelected() {
    if (!selected || !isUuid(selected.setId)) return
    try { setSelected(await getSet(selected.setId)); await refresh() }
    catch (err) { setError((err as Error).message) }
  }

  if (loading) return <main className="center-screen"><h2>Completing sign-in...</h2></main>
  if (!signedIn) return (
    <main className="center-screen">
      <section className="login-card">
        <span className="mark">✦</span>
        <h1>StudyMate</h1>
        <p>From lecture PDFs to flashcards, summaries and quizzes.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" onClick={() => { void signIn().catch(e => setError((e as Error).message)) }}>Sign in with Cognito</button>
        <p className="muted small">Uses secure Cognito hosted sign-in with PKCE. No password is sent to StudyMate.</p>
      </section>
    </main>
  )
  return (
    <div className="shell">
      <header className="header">
        <div className="brand"><span className="mark">✦</span> StudyMate <span className="subtitle">/ Your learning workspace</span></div>
        <button className="ghost" onClick={signOut}>Sign out</button>
      </header>
      <main className="layout">
        <aside>
          <div className="panel">
            <div className="panel-head"><h2>Study sets</h2><button className="ghost small" onClick={() => { setLoadingSets(true); void refresh().finally(()=>setLoadingSets(false)) }}>{loadingSets ? 'Loading...' : 'Refresh'}</button></div>
            <p className="muted small">Your privately owned documents</p>
            {sets.length===0 ? <p className="empty">No study sets yet. Upload your first PDF.</p> :
              <div className="set-list">{sets.map(s => (
                <button key={s.setId} className={`set-entry ${selected?.setId === s.setId ? 'selected' : ''}`} onClick={()=>void chooseSet(s)}>
                  <strong>{s.title}</strong><span className="muted small">{s.course || 'No course'}</span>
                  <span className={`status status-${s.status.toLowerCase()}`}>{s.status}</span>
                </button>
              ))}</div>}
          </div>
          <div className="panel upload-panel">
            <h2>Upload lecture PDF</h2>
            <form onSubmit={e=>void submitUpload(e)}>
              <label>Study-set title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Lecture 05 — Networks"/></label>
              <label>Course (optional)<input maxLength={120} value={course} onChange={e=>setCourse(e.target.value)} placeholder="Computer Networks"/></label>
              <label>PDF file<input id="pdf-file" type="file" accept=".pdf,application/pdf" required onChange={e=>setFile(e.target.files?.[0] ?? null)}/></label>
              <p className="muted small">Text-based PDFs only · Maximum 10 MB, 50 pages</p>
              <button className="primary" type="submit" disabled={!file || !title.trim() || uploading}>{uploading ? 'Uploading...' : 'Create and upload'}</button>
            </form>
          </div>
        </aside>
        <section className="main-content">
          {error && <div className="error" role="alert">{error}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}
          {!selected ? (
            <div className="hero"><span className="mark">✦</span><h1>Turn documents into study material.</h1><p>Upload a lecture PDF to automatically extract text and generate mock flashcards, summaries and quizzes.</p><p className="muted small">The real AI provider will be integrated in a future milestone.</p></div>
          ) : (
            <div>
              <div className="section-top"><div><p className="eyebrow">STUDY SET</p><h1>{selected.title}</h1><p className="muted">{selected.course || 'No course'} · {formatBytes(selected.fileSize)} · {selected.pageCount ?? '—'} pages</p></div><button className="ghost" onClick={()=>void refreshSelected()}>Refresh status</button></div>
              <div className="status-row"><span className={`status status-${selected.status.toLowerCase()}`}>{selected.status}</span> {isWorking(selected) && <span className="muted small">Automatically refreshing every 4 seconds</span>}</div>
              {selected.status==='FAILED' && <div className="error">Processing failed: {selected.errorMessage || 'Check Lambda logs in CloudWatch.'}</div>}
              {selected.status==='PENDING' && <div className="notice">This study set has no uploaded PDF yet. If an upload failed, create a new study set.</div>}
              {selected.status==='READY' && material && <>
                {material.material.metadata?.isMock && <div className="notice">Demo mode: passages and questions are generated by a mock provider, not real AI.</div>}
                <div className="stats"><div><strong>{selected.pageCount ?? '—'}</strong><small>pages</small></div><div><strong>{selected.flashcardCount ?? '—'}</strong><small>flashcards</small></div><div><strong>{selected.quizCount ?? '—'}</strong><small>quizzes</small></div></div>
                <section className="panel"><h2>Summary</h2><p className="summary">{material.material.summary}</p></section>
                <section className="panel"><h2>Flashcards</h2><p className="muted small">Select a card to flip between question and answer.</p><div className="cards">{material.material.flashcards.map((card,i)=><button key={i} className="flashcard" onClick={()=>setFlip(old=>({...old,[i]:!old[i]}))}><span className="eyebrow">{flip[i] ? 'ANSWER' : 'QUESTION'} · PAGE {card.page}</span><span>{flip[i] ? card.answer : card.question}</span><small className="muted">Click to flip</small></button>)}</div></section>
                <section className="panel"><h2>Practice quiz</h2>{material.material.quizzes.map((q,i)=><div className="quiz" key={i}><h3>{i+1}. {q.question}</h3><span className="muted small">Source page {q.page}</span><div className="options">{q.options.map((opt,j)=><button key={j} disabled={answers[i] !== undefined} className={`option ${answers[i] === j ? (j === q.correctIndex ? 'correct':'incorrect') : ''}`} onClick={()=>setAnswers(old=>({...old,[i]:j}))}>{String.fromCharCode(65+j)}. {opt}</button>)}</div>{answers[i] !== undefined && <div className="feedback"><strong>{answers[i]===q.correctIndex ? 'Correct' : `Correct answer: ${String.fromCharCode(65+q.correctIndex)}`}</strong><p>{q.explanation}</p></div>}</div>)}</section>
              </>}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
