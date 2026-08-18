import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface AnticipoCliente {
  id: string
  invoiceNumber: string   // ANT-XXXX
  customerId: string
  customerName: string
  customerTaxId?: string
  invoiceDate: string
  total: number
  balance: number
  paidAmount: number
  status: 'pending' | 'partial' | 'paid' | 'voided'
  currency: string
  notes?: string
  journalEntryId?: string
}

const BASE = '/ventas/facturas-anticipo'

export const getAnticiposClientes = (params?: {
  customerId?: string; page?: number; limit?: number
}) => api.get(BASE, { params }).then(unwrap) as Promise<{ data: AnticipoCliente[]; total: number; page: number; limit: number }>

export const getAnticipoCliente = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<AnticipoCliente>

export const aplicarAnticipoCliente = (id: string, dto: { invoiceId: string; amount?: number }) =>
  api.post(`${BASE}/${id}/aplicar`, dto).then(unwrap)

export const reembolsarAnticipoCliente = (id: string) =>
  api.post(`${BASE}/${id}/reembolsar`, {}).then(unwrap)
