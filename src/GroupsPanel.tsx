import { useCallback, useEffect, useState } from 'react'
import type { StudySet } from './types'
import {
  addGroupMember, createGroup, getMe, listGroupMembers, listGroups, listGroupSets,
  removeGroupMember, shareStudySet, unshareStudySet,
} from './groupApi'
import type { Group, Member } from './groupApi'

interface Props { ownedSets: StudySet[]; onOpenSet: (item: StudySet) => void }

export default function GroupsPanel({ ownedSets, onOpenSet }: Props) {
  const [userId, setUserId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sharedSets, setSharedSets] = useState<StudySet[]>([])
  const [groupName, setGroupName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [shareSetId, setShareSetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reloadGroups = useCallback(async () => {
    const response = await listGroups()
    setGroups(response.groups)
  }, [])

  const reloadSelected = useCallback(async (group: Group) => {
    const [memberResponse, setResponse] = await Promise.all([
      listGroupMembers(group.groupId), listGroupSets(group.groupId),
    ])
    setMembers(memberResponse.members)
    setSharedSets(setResponse.sets)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getMe(), listGroups()]).then(([me, items]) => {
      if (!active) return
      setUserId(me.userId)
      setGroups(items.groups)
    }).catch(err => { if (active) setError((err as Error).message) })
    return () => { active = false }
  }, [])

  async function run(operation: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      await operation()
      setNotice(message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openGroup(group: Group) {
    setSelected(group); setError(''); setNotice(''); setMembers([]); setSharedSets([])
    try { await reloadSelected(group) }
    catch (err) { setError((err as Error).message) }
  }

  const isOwner = !!selected && selected.ownerId === userId
  const available = ownedSets.filter(s => s.status === 'READY' && !s.sharedGroupId)

  return <div className="panel groups-panel">
    <div className="panel-head">
      <h2>Study groups</h2>
      <button className="ghost small" onClick={() => void reloadGroups().catch(e => setError((e as Error).message))}>Refresh</button>
    </div>
    <label className="muted small">Your user ID (share this with a group owner)</label>
    <div className="copy-row"><code>{userId || 'Loading...'}</code>
      <button type="button" className="ghost small" onClick={() => void navigator.clipboard.writeText(userId)} disabled={!userId}>Copy</button>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    <form onSubmit={e => { e.preventDefault(); void run(async () => {
      const group = await createGroup(groupName.trim())
      setGroupName(''); await reloadGroups(); await openGroup(group)
    }, 'Group created.') }}>
      <label>New group name<input maxLength={80} required value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Computer Networks" /></label>
      <button className="primary" disabled={busy || !groupName.trim()}>Create group</button>
    </form>
    {groups.length > 0 && <div className="group-choice">
      {groups.map(group => <button key={group.groupId} className={`ghost small ${selected?.groupId === group.groupId ? 'selected' : ''}`} onClick={() => void openGroup(group)}>{group.name}{group.ownerId === userId ? ' (owner)' : ''}</button>)}
    </div>}
    {selected && <div className="group-details">
      <h3>{selected.name}</h3>
      <p className="muted small">Members: {members.length}</p>
      {members.map(m => <div className="member-line" key={m.userId}>
        <code title={m.userId}>{m.userId.slice(0, 8)}…</code><span>{m.role}</span>
        {isOwner && m.role !== 'OWNER' && <button className="ghost small" disabled={busy} onClick={() => void run(async () => {
          await removeGroupMember(selected.groupId, m.userId); await reloadSelected(selected)
        }, 'Member removed.')}>Remove</button>}
      </div>)}
      {isOwner && <form onSubmit={e => { e.preventDefault(); void run(async () => {
        await addGroupMember(selected.groupId, memberId.trim().toLowerCase())
        setMemberId(''); await reloadSelected(selected)
      }, 'Member added.') }}>
        <label>Add user by Cognito user ID<input required placeholder="User UUID" value={memberId} onChange={e => setMemberId(e.target.value)} /></label>
        <button className="ghost" disabled={busy || !memberId.trim()}>Add member</button>
      </form>}
      {isOwner && <form onSubmit={e => { e.preventDefault(); if (!shareSetId) return; void run(async () => {
        await shareStudySet(selected.groupId, shareSetId)
        setShareSetId(''); await reloadSelected(selected)
      }, 'Study set shared.') }}>
        <label>Share an existing READY study set
          <select value={shareSetId} onChange={e => setShareSetId(e.target.value)}>
            <option value="">Choose a study set</option>
            {available.map(s => <option value={s.setId} key={s.setId}>{s.title}</option>)}
          </select>
        </label>
        <button className="ghost" disabled={busy || !shareSetId}>Share with group</button>
      </form>}
      <h3>Shared study sets</h3>
      {sharedSets.length === 0 && <p className="muted small">No shared study sets yet.</p>}
      {sharedSets.map(s => <div key={s.setId} className="shared-set-line">
        <button type="button" className="ghost small" onClick={() => onOpenSet(s)}>{s.title}</button>
        {isOwner && <button type="button" className="ghost small" disabled={busy} onClick={() => void run(async () => {
          await unshareStudySet(selected.groupId, s.setId)
          await reloadSelected(selected)
        }, 'Study set is private again.')}>Unshare</button>}
      </div>)}
    </div>}
  </div>
}
