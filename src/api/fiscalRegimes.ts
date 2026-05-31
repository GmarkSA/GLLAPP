import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface FiscalRegime {
  id: string
  countryCode: string
  code: string
  name: string
  description?: string
  taxConfig: {
    taxIdLabel: string
    taxIdFormat?: string
    mainTaxName: string
    mainTaxRate: number
    hasWithholding: boolean
    hasFEL: boolean
    felSystem?: string
    currencyCode: string
    timezone: string
  }
  isActive: boolean
  isSystem: boolean
}

export const fiscalRegimesApi = {
  getAll: (country?: string) => {
    const params = country ? { country } : {}
    return api.get('/fiscal-regimes', { params }).then(unwrap) as Promise<FiscalRegime[]>
  },
  seed: () => api.post('/fiscal-regimes/seed').then(unwrap),
}
