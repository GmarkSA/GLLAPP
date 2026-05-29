import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data
const BASE = '/auth/users'

export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface TenantUser {
  id:           string
  firstName:    string
  lastName:     string
  email:        string
  status:       UserStatus
  isSuperAdmin: boolean
  lastLoginAt?: string
  createdAt:    string
}

export const getUsers = () =>
  api.get(BASE).then(unwrap) as Promise<TenantUser[]>

export const createUser = (dto: {
  firstName: string
  lastName:  string
  email:     string
  password:  string
  isSuperAdmin?: boolean
}) => api.post(BASE, dto).then(unwrap) as Promise<TenantUser>

export const updateUser = (id: string, dto: {
  firstName?:   string
  lastName?:    string
  status?:      UserStatus
  isSuperAdmin?: boolean
}) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<TenantUser>

export const resetUserPassword = (id: string, newPassword: string) =>
  api.post(`${BASE}/${id}/reset-password`, { newPassword })

export const deleteUser = (id: string) =>
  api.delete(`${BASE}/${id}`)
