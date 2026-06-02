import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface TenantProfile {
  id: string
  name: string
  legalName?: string
  taxId?: string
  country?: string
  currency?: string
  settings?: Record<string, any>
}

export const tenantsApi = {
  getProfile: () =>
    api.get('/tenants/profile').then(unwrap) as Promise<TenantProfile>,

  updateProfile: (dto: Partial<TenantProfile> & { settings?: Record<string, any> }) =>
    api.patch('/tenants/profile', dto).then(unwrap) as Promise<TenantProfile>,
}
