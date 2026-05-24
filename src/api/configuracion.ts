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

// Upload logo — multipart
export const uploadLogo = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api
    .post<{ data: { url: string } }>('/tenants/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data.data.url)
}
