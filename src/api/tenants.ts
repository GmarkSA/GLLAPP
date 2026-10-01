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

/** Una organización (cliente) a la que el usuario tiene acceso. */
export interface Organizacion {
  id: string
  name: string
  legalName?: string
  taxId?: string
  plan?: string
  status?: string
  logoUrl?: string
}

/**
 * Las organizaciones a las que este correo puede entrar. Un contador externo
 * puede tener varias; quien tiene una sola recibe esa.
 */
export const getMisOrganizaciones = () =>
  api.get('/tenants').then(unwrap) as Promise<Organizacion[]>

export const tenantsApi = {
  getProfile: () =>
    api.get('/tenants/profile').then(unwrap) as Promise<TenantProfile>,

  updateProfile: (dto: Partial<TenantProfile> & { settings?: Record<string, any> }) =>
    api.patch('/tenants/profile', dto).then(unwrap) as Promise<TenantProfile>,

  /** Datos del cliente desde el panel de plataforma (solo Super Admin). */
  updateCliente: (id: string, dto: Partial<Pick<TenantProfile, 'name' | 'legalName' | 'taxId'>>) =>
    api.patch(`/tenants/${id}`, dto).then(unwrap) as Promise<TenantProfile>,
}
