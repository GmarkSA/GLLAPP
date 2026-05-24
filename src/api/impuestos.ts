import api from './axios'

export type TaxCategory = 'iva' | 'iva_exento' | 'iva_retenida' | 'isr' | 'other'
export type TaxSubtype  = 'simple' | 'exempt' | 'progressive' | 'retention_tax'
export type TaxApplicability = 'sales' | 'purchases' | 'both'

export interface TaxTier {
  upTo:  number | null
  rate:  number
  label: string
}

export interface Tax {
  id:          string
  code:        string
  name:        string
  description: string
  category:    TaxCategory
  subtype:     TaxSubtype
  applicability: TaxApplicability
  rate:        number
  tiers:       TaxTier[] | null
  baseTaxCode: string | null
  isInclusive: boolean     // true = precio incluye el impuesto (IVA incluido)
  isWithholding: boolean
  isDefault:   boolean
  isSystem:    boolean
  isActive:    boolean
  applicableToCategories: string[]
  salesAccountId?:     string
  purchaseAccountId?:  string
  retentionAccountId?: string
}

export interface TaxCalculation {
  tax:       Tax
  breakdown: Record<string, number>
  total:     number
}

const unwrap = (r: any) => r.data?.data ?? r.data

export const getTaxes          = () => api.get('/configuracion/impuestos').then(unwrap)
export const getTax            = (id: string) => api.get(`/configuracion/impuestos/${id}`).then(unwrap)
export const createTax         = (dto: Partial<Tax>) => api.post('/configuracion/impuestos', dto).then(unwrap)
export const updateTax         = (id: string, dto: Partial<Tax>) => api.patch(`/configuracion/impuestos/${id}`, dto).then(unwrap)
export const deleteTax         = (id: string) => api.delete(`/configuracion/impuestos/${id}`)
export const seedGuatemala     = () => api.get('/configuracion/impuestos/seed/guatemala').then(unwrap)
export const calculateTax      = (id: string, amount: number): Promise<TaxCalculation> =>
  api.get(`/configuracion/impuestos/${id}/calculate`, { params: { amount } }).then(unwrap)
