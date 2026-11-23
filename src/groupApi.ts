import { request } from './api'
import type { StudySet } from './types'

export interface Group { groupId: string; name: string; ownerId: string; createdAt: string; updatedAt: string }
export interface Member { userId: string; role: 'OWNER' | 'MEMBER' }

export const getMe = () => request<{userId: string}>('/me')
export const listGroups = () => request<{groups: Group[]}>('/groups')
export const createGroup = (name: string) => request<Group>('/groups', {
  method: 'POST', body: JSON.stringify({ name }),
})
export const listGroupMembers = (groupId: string) =>
  request<{members: Member[]}>(`/groups/${encodeURIComponent(groupId)}/members`)
export const addGroupMember = (groupId: string, userId: string) =>
  request<{groupId: string; userId: string}>(`/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST', body: JSON.stringify({ userId }),
  })
export const removeGroupMember = (groupId: string, userId: string) =>
  request<{removed: string}>(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
export const listGroupSets = (groupId: string) =>
  request<{sets: StudySet[]}>(`/groups/${encodeURIComponent(groupId)}/sets`)
export const shareStudySet = (groupId: string, setId: string) =>
  request<{shared: boolean}>(`/groups/${encodeURIComponent(groupId)}/sets`, {
    method: 'POST', body: JSON.stringify({ setId }),
  })
export const unshareStudySet = (groupId: string, setId: string) =>
  request<{shared: boolean}>(`/groups/${encodeURIComponent(groupId)}/sets/${encodeURIComponent(setId)}`, {
    method: 'DELETE',
  })
