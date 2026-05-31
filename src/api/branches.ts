import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface Branch {
  id: string
  companyId: string
  name: string
  code?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  managerName?: string
  isDefault: boolean
  isActive: boolean
}

export const branchesApi = {
  getAll: (companyId: string)                    => api.get(`/companies/${companyId}/branches`).then(unwrap) as Promise<Branch[]>,
  create: (companyId: string, dto: Partial<Branch>) => api.post(`/companies/${companyId}/branches`, dto).then(unwrap) as Promise<Branch>,
  update: (branchId: string, dto: Partial<Branch>)  => api.patch(`/companies/branches/${branchId}`, dto).then(unwrap) as Promise<Branch>,
  remove: (branchId: string)                        => api.delete(`/companies/branches/${branchId}`),
}
