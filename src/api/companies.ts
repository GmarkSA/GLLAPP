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

export interface DocumentSeries {
  id: string
  companyId: string
  documentType: string
  series: string
  currentNumber: number
  padding: number
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

  // ── Usuarios por empresa ──────────────────────────────────────────────────
  getCompanyUsers: (id: string)                           => api.get(`/companies/${id}/users`).then(unwrap),
  assignUser: (id: string, dto: { userId: string; roleIds?: string[] }) => api.post(`/companies/${id}/users`, dto).then(unwrap),
  updateCompanyUser: (id: string, userId: string, dto: any)             => api.patch(`/companies/${id}/users/${userId}`, dto).then(unwrap),
  removeCompanyUser: (id: string, userId: string)                       => api.delete(`/companies/${id}/users/${userId}`),

  // ── Clone (Template Engine) ───────────────────────────────────────────────
  clone: (id: string, dto: any)                           => api.post(`/companies/${id}/clone`, dto).then(unwrap),

  getDocumentSeries: (id: string)                           => api.get(`/companies/${id}/document-series`).then(unwrap) as Promise<DocumentSeries[]>,
  createDocumentSeries: (id: string, dto: Partial<DocumentSeries>) => api.post(`/companies/${id}/document-series`, dto).then(unwrap) as Promise<DocumentSeries>,
  updateDocumentSeries: (seriesId: string, dto: Partial<DocumentSeries>) => api.patch(`/companies/document-series/${seriesId}`, dto).then(unwrap) as Promise<DocumentSeries>,
}
