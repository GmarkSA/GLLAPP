import api from './axios'
import type { Company } from '../store/authStore'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface CompanySettings {
  id: string
  companyId: string
  baseCurrency: string
  language: string
  timezone: string
  dateFormat: string
  fiscalYearStart: string
  fiscalYearEnd: string
  inventoryMethod: string
  inventoryNegativeAllowed: boolean
  defaultPaymentTerms: string
  defaultSalesSeries?: string
  defaultPurchaseSeries?: string
  defaultSalesTaxId?: string
  defaultPurchaseTaxId?: string
  defaultReceivableAccountId?: string
  defaultPayableAccountId?: string
  defaultBankAccountId?: string
  autoPostJournalEntries: boolean
  felEnabled: boolean
  settingsJson: Record<string, any>
}

export const companiesApi = {
  getAll: ()                       => api.get('/companies').then(unwrap) as Promise<Company[]>,
  getOne: (id: string)             => api.get(`/companies/${id}`).then(unwrap) as Promise<Company>,
  create: (dto: Partial<Company>)  => api.post('/companies', dto).then(unwrap) as Promise<Company>,
  update: (id: string, dto: Partial<Company>) => api.patch(`/companies/${id}`, dto).then(unwrap) as Promise<Company>,
  setDefault: (id: string)         => api.patch(`/companies/${id}/set-default`).then(unwrap) as Promise<Company>,
  remove: (id: string)             => api.delete(`/companies/${id}`),

  getSettings: (id: string)                           => api.get(`/companies/${id}/settings`).then(unwrap) as Promise<CompanySettings>,
  updateSettings: (id: string, dto: Partial<CompanySettings>) => api.patch(`/companies/${id}/settings`, dto).then(unwrap) as Promise<CompanySettings>,
}
