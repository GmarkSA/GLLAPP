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

  /** Datos del cliente desde el panel de plataforma (solo Super Admin). */
  updateCliente: (id: string, dto: Partial<Pick<TenantProfile, 'name' | 'legalName' | 'taxId'>>) =>
    api.patch(`/tenants/${id}`, dto).then(unwrap) as Promise<TenantProfile>,
}
