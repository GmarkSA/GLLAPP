import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface BankProfile {
  id: string
  companyId: string
  bankName: string
  countryCode: string
  integrationProvider?: string
  apiConfigurationJson: Record<string, any>
  status: 'active' | 'inactive' | 'error' | 'testing'
  lastTestedAt?: string
  lastTestResult?: string
  expiresAt?: string
}

export interface ElectronicInvoicingProfile {
  id: string
  companyId: string
  countryCode: string
  provider: string
  environment: 'production' | 'sandbox'
  issuerTaxId?: string
  apiConfigurationJson: Record<string, any>
  status: 'active' | 'inactive' | 'error' | 'testing'
  lastTestedAt?: string
  lastTestResult?: string
  certificateExpiresAt?: string
}

export const companyIntegrationsApi = {
  // ── Bank Profiles ───────────────────────────────────────
  getBankProfiles: (companyId: string)                        => api.get(`/companies/${companyId}/bank-profiles`).then(unwrap) as Promise<BankProfile[]>,
  createBankProfile: (companyId: string, dto: Partial<BankProfile>) => api.post(`/companies/${companyId}/bank-profiles`, dto).then(unwrap) as Promise<BankProfile>,
  updateBankProfile: (id: string, dto: Partial<BankProfile>) => api.patch(`/companies/bank-profiles/${id}`, dto).then(unwrap) as Promise<BankProfile>,
  testBankProfile: (id: string)                              => api.post(`/companies/bank-profiles/${id}/test`).then(unwrap),
  removeBankProfile: (id: string)                            => api.delete(`/companies/bank-profiles/${id}`),

  // ── Electronic Invoicing ────────────────────────────────
  getEInvoicing: (companyId: string)                                          => api.get(`/companies/${companyId}/electronic-invoicing`).then(unwrap) as Promise<ElectronicInvoicingProfile[]>,
  createEInvoicing: (companyId: string, dto: Partial<ElectronicInvoicingProfile>) => api.post(`/companies/${companyId}/electronic-invoicing`, dto).then(unwrap) as Promise<ElectronicInvoicingProfile>,
  updateEInvoicing: (id: string, dto: Partial<ElectronicInvoicingProfile>)    => api.patch(`/companies/electronic-invoicing/${id}`, dto).then(unwrap) as Promise<ElectronicInvoicingProfile>,
  testEInvoicing: (id: string)                                                => api.post(`/companies/electronic-invoicing/${id}/test`).then(unwrap),
  removeEInvoicing: (id: string)                                              => api.delete(`/companies/electronic-invoicing/${id}`),
}
