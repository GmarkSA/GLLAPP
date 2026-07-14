import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface AsientoLine {
  accountId?:         string
  accountCode:        string
  accountName:        string
  debit:              number
  credit:             number
  description?:       string
  customerId?:        string
  vendorId?:          string
  fixedAssetId?:      string
  taxCode?:           string   // IVA12 | IVA5 | EXEMPT
  taxAmount?:         number
  centroCostoId?:     string
  centroBeneficioId?: string
  sortOrder?:         number
}

export interface CreateAsientoDto {
  lines:               AsientoLine[]
  entryDate:           string
  accountingDate?:     string  // fecha contable (puede diferir del documento)
  description:         string
  type?:               string   // MANUAL | OPENING | CLOSING | ADJUSTMENT
  reference?:          string
  currency?:           string
  exchangeRate?:       number
  sourceDocumentId?:   string
  sourceDocumentType?: string
  autoPost?:           boolean
}

export interface AsientoListItem {
  id:           string
  entryNumber:  string
  type:         string
  status:       string
  entryDate:    string
  description:  string
  reference?:   string
  totalDebit:   number
  totalCredit:  number
  currency:     string
}

export interface AsientoDetalle {
  id:              string
  entryNumber:     string
  type:            string
  status:          string
  entryDate:       string
  accountingDate?: string
  description:     string
  reference?:      string
  exchangeRate?:   number
  totalDebit:      number
  totalCredit:     number
  currency:        string
  lines:           Array<{
    id?:              string
    accountId?:       string
    accountCode:      string
    accountName:      string
    debit:            number
    credit:           number
    description?:     string
    customerId?:      string
    vendorId?:        string
    fixedAssetId?:    string
    taxCode?:         string
    taxAmount?:       number
    centroCostoId?:   string
    centroBeneficioId?: string
    sortOrder?:       number
  }>
}

export interface AsientosListResult {
  data:  AsientoListItem[]
  total: number
}

export interface GetAsientosParams {
  search?:       string
  page?:         number
  limit?:        number
  fechaDesde?:   string
  fechaHasta?:   string
  tipo?:         string
  estado?:       string
  soloManuales?: boolean
}

export const getAsientos = (params?: GetAsientosParams) =>
  api.get('/contabilidad/asientos', { params }).then(r => {
    const d = r.data?.data ?? r.data
    if (Array.isArray(d)) return { data: d, total: d.length } as AsientosListResult
    return d as AsientosListResult
  })

export const createAsiento = (dto: CreateAsientoDto) =>
  api.post('/contabilidad/asientos', dto).then(unwrap) as Promise<AsientoDetalle>

export const getAsiento = (id: string) =>
  api.get(`/contabilidad/asientos/${id}`).then(unwrap) as Promise<AsientoDetalle>

export const updateAsiento = (id: string, dto: { entryDate?: string; description?: string; reference?: string; exchangeRate?: number }) =>
  api.patch(`/contabilidad/asientos/${id}`, dto).then(unwrap) as Promise<AsientoDetalle>

export const postAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/publicar`).then(unwrap) as Promise<AsientoDetalle>

export const reverseAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/revertir`).then(unwrap) as Promise<AsientoDetalle>

export const deleteAsiento = (id: string) =>
  api.delete(`/contabilidad/asientos/${id}`)

export const voidAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/anular`).then(unwrap) as Promise<AsientoDetalle>

export const resetToDraftAsiento = (id: string) =>
  api.post(`/contabilidad/asientos/${id}/borrador`).then(unwrap) as Promise<AsientoDetalle>
