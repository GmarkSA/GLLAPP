import api from './axios'

export type TaxTreatment =
  | 'taxable' | 'exempt' | 'contribuyente_especial' | 'gobierno' | 'exportador'

export type PaymentTerms =
  | 'immediate' | 'net_15' | 'net_30' | 'net_60' | 'net_90' | 'custom'

export interface Address {
  attention?: string
  address?:   string
  street2?:   string
  city?:      string
  state?:     string
  zip?:       string
  country?:   string
  phone?:     string
}

export interface ContactPerson {
  salutation?:   string
  firstName:     string
  lastName?:     string
  email?:        string
  phone?:        string
  mobile?:       string
  designation?:  string
  department?:   string
  isPrimary:     boolean
  portalEnabled?: boolean
}

export interface Customer {
  id?:              string
  customerNumber?:  string
  type?:            'individual' | 'company'
  name:             string
  legalName?:       string
  salutation?:      string
  firstName?:       string
  lastName?:        string
  taxId?:           string
  email?:           string
  phone?:           string
  mobile?:          string
  website?:         string
  currency?:        string
  paymentTerms?:    PaymentTerms
  creditLimit?:     number
  balance?:         number
  status?:          'active' | 'inactive' | 'blacklisted'
  // Impuestos
  taxTreatment?:    TaxTreatment
  taxCode?:         string
  tdsEnabled?:      boolean
  tdsTaxCode?:      string
  ivaRetentionCode?: string
  // Cuentas contables
  receivableAccountId?: string
  incomeAccountId?:     string
  // Dirección
  billingAddress?:  Address
  shippingAddress?: Address
  // Contactos
  contacts?:        ContactPerson[]
  // Extras
  openingBalance?:  number
  portalEnabled?:   boolean
  notes?:           string
  tags?:            string[]
  customFields?:    Record<string, any>
}

export interface Vendor extends Omit<Customer, 'customerNumber' | 'receivableAccountId' | 'incomeAccountId' | 'shippingAddress' | 'creditLimit'> {
  vendorNumber?:      string
  payableAccountId?:  string
  expenseAccountId?:  string
  bankAccount?: {
    bankName?: string
    accountNumber?: string
    accountType?: string
    currency?: string
  }
}

const unwrap = (r: any) => r.data?.data ?? r.data

// ── Clientes ───────────────────────────────────────────────────────────────
export const getCustomers    = (params?: any) => api.get('/ventas/clientes', { params }).then(unwrap)
export const getCustomer     = (id: string)   => api.get(`/ventas/clientes/${id}`).then(unwrap)
export const createCustomer  = (dto: Customer) => api.post('/ventas/clientes', dto).then(unwrap)
export const updateCustomer  = (id: string, dto: Partial<Customer>) => api.patch(`/ventas/clientes/${id}`, dto).then(unwrap)
export const deleteCustomer  = (id: string)   => api.delete(`/ventas/clientes/${id}`)

// ── Proveedores ────────────────────────────────────────────────────────────
export const getVendors      = (params?: any) => api.get('/compras/proveedores', { params }).then(unwrap)
export const getVendor       = (id: string)   => api.get(`/compras/proveedores/${id}`).then(unwrap)
export const createVendor    = (dto: Vendor)  => api.post('/compras/proveedores', dto).then(unwrap)
export const updateVendor    = (id: string, dto: Partial<Vendor>) => api.patch(`/compras/proveedores/${id}`, dto).then(unwrap)
export const deleteVendor    = (id: string)   => api.delete(`/compras/proveedores/${id}`)
