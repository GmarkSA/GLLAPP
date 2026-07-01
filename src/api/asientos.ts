import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface AsientoLine {
  accountId:    string
  accountCode:  string
  accountName:  string
  debit:        number
  credit:       number
  description?: string
  sortOrder?:   number
}

export interface CreateAsientoDto {
  lines:               AsientoLine[]
  entryDate:           string
  description:         string
  reference?:          string
  exchangeRate?:       number
  sourceDocumentId?:   string
  sourceDocumentType?: string
  autoPost?:           boolean
}

export interface AsientoDetalle {
  id:           string
  entryNumber:  string
  type:         string
  status:       string
  entryDate:    string
  description:  string
  reference?:   string
  exchangeRate?: number
  totalDebit:   number
  totalCredit:  number
  currency:     string
  lines:        { accountCode: string; accountName: string; debit: number; credit: number; description?: string }[]
}

export const createAsiento = (dto: CreateAsientoDto) =>
  api.post('/contabilidad/asientos', dto).then(unwrap) as Promise<AsientoDetalle>

export const getAsiento = (id: string) =>
  api.get(`/contabilidad/asientos/${id}`).then(unwrap) as Promise<AsientoDetalle>

export const updateAsiento = (id: string, dto: { entryDate?: string; description?: string; reference?: string; exchangeRate?: number }) =>
  api.patch(`/contabilidad/asientos/${id}`, dto).then(unwrap) as Promise<AsientoDetalle>

export const postAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/publicar`).then(unwrap) as Promise<AsientoDetalle>

export const deleteAsiento = (id: string) =>
  api.delete(`/contabilidad/asientos/${id}`)

export const voidAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/anular`)
