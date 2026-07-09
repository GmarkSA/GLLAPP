import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface ActivityComment {
  id:          string
  entityType:  string
  entityId:    string
  userId?:     string
  userName?:   string
  userEmail?:  string
  type:        'comment' | 'activity'
  action?:     string
  text:        string
  createdAt:   string
}

export const getComments = (entityType: string, entityId: string) =>
  api.get('/comments', { params: { entityType, entityId } }).then(unwrap) as Promise<ActivityComment[]>

export const addComment = (entityType: string, entityId: string, text: string) =>
  api.post('/comments', { entityType, entityId, text }).then(unwrap) as Promise<ActivityComment>
