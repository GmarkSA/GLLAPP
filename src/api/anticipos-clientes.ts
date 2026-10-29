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

/**
 * Registrar un anticipo de cliente.
 *
 * Con `esSaldoInicial` no se pide cuenta bancaria: el anticipo ya existía
 * antes de Lucía y su contrapartida es la cuenta de saldos de apertura.
 */
export const crearAnticipoCliente = (dto: {
  customerId:      string
  amount:          number
  date?:           string
  currency?:       string
  exchangeRate?:   number
  reference?:      string
  notes?:          string
  bankAccountId?:  string
  esSaldoInicial?: boolean
}) => api.post(BASE, dto).then(unwrap)

export const getAnticiposClientes = (params?: {
  customerId?: string; status?: string; page?: number; limit?: number
}) => api.get(BASE, { params }).then(unwrap) as Promise<{ data: AnticipoCliente[]; total: number; page: number; limit: number }>

export const getAnticipoCliente = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<AnticipoCliente>

export const aplicarAnticipoCliente = (id: string, dto: { invoiceId: string; amount?: number; date?: string }) =>
  api.post(`${BASE}/${id}/aplicar`, dto).then(unwrap)

/**
 * Anular un anticipo registrado por equivocación.
 *
 * No es lo mismo que reembolsar: reembolsar devuelve el dinero al cliente y
 * por eso exige cuenta bancaria. Anular dice que ese anticipo nunca debió
 * existir — nadie devolvió nada— y revierte su propia póliza.
 *
 * La pantalla llamaba a `reembolsar` para anular, así que pedía una cuenta que
 * no viene en ningún lado y devolvía 400.
 */
export const anularAnticipoCliente = (id: string, dto?: { date?: string }) =>
  api.post(`${BASE}/${id}/anular`, dto ?? {}).then(unwrap)

export const reembolsarAnticipoCliente = (id: string, dto?: { date?: string; bankAccountId?: string }) =>
  api.post(`${BASE}/${id}/reembolsar`, dto ?? {}).then(unwrap)

export const desaplicarAnticipoCliente = (id: string) =>
  api.post(`${BASE}/${id}/desaplicar`, {}).then(unwrap)

export const restaurarAnticipoCliente = (id: string) =>
  api.post(`${BASE}/${id}/restaurar`, {}).then(unwrap)

export const eliminarAnticipoCliente = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)
