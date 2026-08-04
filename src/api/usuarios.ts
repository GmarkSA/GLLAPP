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
  roles?:       RoleSummary[]
  lastLoginAt?: string
  createdAt:    string
}

export interface PermissionSummary {
  id?:          string
  module:       string
  submodule:    string
  action:       string
  slug:         string
  description?: string
}

export interface RoleSummary {
  id:           string
  name:         string
  description?: string
  isSystem?:    boolean
  permissions:  PermissionSummary[]
}

export const getUsers = () =>
  api.get(BASE).then(unwrap) as Promise<TenantUser[]>

export const getRoles = () =>
  api.get('/auth/roles').then(unwrap) as Promise<RoleSummary[]>

export const getPermissions = () =>
  api.get('/auth/permissions').then(unwrap) as Promise<PermissionSummary[]>

export const createUser = (dto: {
  firstName:    string
  lastName:     string
  email:        string
  password?:    string
  sendInvitation?: boolean
  isSuperAdmin?: boolean
  roleIds?:     string[]
}) => api.post(BASE, dto).then(unwrap) as Promise<TenantUser>

export const updateUser = (id: string, dto: {
  firstName?:   string
  lastName?:    string
  status?:      UserStatus
  isSuperAdmin?: boolean
  roleIds?:     string[]
}) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<TenantUser>

export const resetUserPassword = (id: string, newPassword: string) =>
  api.post(`${BASE}/${id}/reset-password`, { newPassword })

export const deleteUser = (id: string) =>
  api.delete(`${BASE}/${id}`)

export const createRole = (dto: {
  name:            string
  description?:    string
  permissionSlugs?: string[]
}) => api.post('/auth/roles', dto).then(unwrap) as Promise<RoleSummary>

export const updateRolePermissions = (id: string, permissionSlugs: string[]) =>
  api.put(`/auth/roles/${id}/permissions`, { permissionSlugs }).then(unwrap) as Promise<RoleSummary>

export const deleteRole = (id: string) =>
  api.delete(`/auth/roles/${id}`)
