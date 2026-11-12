import api from './axios'

export interface OrganizationProfile {
  id?: string
  name: string
  legalName?: string
  taxId?: string            // NIT
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  currency?: string
  timezone?: string
  fiscalYearStart?: string  // "01-01" = January 1
  logoUrl?: string
  industry?: string
  companySize?: string
  /**
   * Régimen fiscal de la EMPRESA que emite (no del cliente): lo resuelve el
   * servidor y llega con `getEmisor`. Lo necesita lo que se imprime — un
   * Pequeño Contribuyente no traslada IVA.
   */
  fiscalRegimeCode?: string | null
}

// GET tenant profile (uses X-Tenant-ID header — injected automatically by axios interceptor)
export const getOrganizationProfile = () =>
  api.get<{ data: OrganizationProfile }>('/tenants/profile')
    .then(r => r.data?.data ?? r.data as any)
    .catch(() => ({} as OrganizationProfile))

// PATCH tenant profile
export const updateOrganizationProfile = (data: Partial<OrganizationProfile>) =>
  api.patch<{ data: OrganizationProfile }>('/tenants/profile', data)
    .then(r => r.data?.data ?? r.data as any)

/**
 * Sube el logo. El servidor lo guarda al recibirlo.
 *
 * Devuelve también si quedó asociado a la empresa activa: los documentos leen
 * el logo de la EMPRESA, así que una subida que no la actualiza se ve desde
 * afuera como «subí el logo y no se actualiza». La pantalla lo avisa.
 */
export const uploadLogo = (file: File): Promise<{
  url: string; empresaActualizada?: boolean; motivoEmpresa?: string
}> => {
  const form = new FormData()
  form.append('file', file)
  return api
    .post('/tenants/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(r => (r.data?.data ?? r.data))
}
