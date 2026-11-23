import { accessToken } from './auth'
import type { MaterialResponse, StudySet, UploadUrl } from './types'
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!base.startsWith('https://')) throw new Error('Configure VITE_API_BASE_URL in .env.local')
  const token = await accessToken()
  if (!token) throw new Error('Your session expired. Please sign in again.')
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.body ? {'Content-Type': 'application/json'} : {}), Authorization: `Bearer ${token}`, ...init.headers },
  })
  let data: unknown
  try { data = await response.json() } catch { throw new Error(`API returned HTTP ${response.status}`) }
  if (!response.ok) {
    const err = data as {error?:{message?:string}}
    throw new Error(err?.error?.message || `API returned HTTP ${response.status}`)
  }
  return data as T
}
export const listSets = () => request<{sets: StudySet[]}>('/sets')
export const createSet = (title: string, course: string) => request<StudySet>('/sets', {method:'POST', body:JSON.stringify({title, course})})
export const getSet = (id: string) => request<StudySet>(`/sets/${encodeURIComponent(id)}`)
export const getMaterial = (id: string) => request<MaterialResponse>(`/sets/${encodeURIComponent(id)}/material`)
export const getUploadUrl = (id: string) => request<UploadUrl>(`/sets/${encodeURIComponent(id)}/upload-url`, {method:'POST'})
export async function uploadPdf(urlInfo: UploadUrl, file: File) {
  const result = await fetch(urlInfo.uploadUrl, {method:'PUT', headers:urlInfo.headers, body:file})
  if (!result.ok) throw new Error(`PDF upload failed (HTTP ${result.status}). Verify S3 CORS and signed headers.`)
}
