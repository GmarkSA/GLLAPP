import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/reportes'

// ─── Empresa / Encabezado de reportes ─────────────────────────────────────────

export interface EmpresaInfo {
  company_name: string
  legal_name:   string
  tax_id:       string
  address:      string
  phone:        string
  email:        string
  currency:     string
}

export const getEmpresaInfo = () =>
  api.get(`${BASE}/empresa`).then(unwrap) as Promise<EmpresaInfo>

// ─── Correlativos / Folios ─────────────────────────────────────────────────────

export const setCorrelativo = (tipo: string, value: number, year?: string) =>
  api.post(`${BASE}/correlativo/${tipo}/set`, { value, year }).then(unwrap)

// ─── Financieros ──────────────────────────────────────────────────────────────

export interface BalanceGeneralData {
  asOf: string
  compPeriod?: string
  activo:     { accounts: AccountRow[]; total: number }
  activoFijo: { accounts: AccountRow[]; total: number }
  totalActivo: number
  pasivo:     { accounts: AccountRow[]; total: number }
  capital:    { accounts: AccountRow[]; total: number; netIncome: number }
  totalCapital:        number
  totalPasivoCapital:  number
  balanced:    boolean
  netIncome:   number
  comparison?: any
}

export interface EstadoResultadosData {
  period:        { from: string; to: string }
  compPeriod?:   { from: string; to: string } | null
  ingresos:      { accounts: AccountRow[]; total: number }
  otrosIngresos: { accounts: AccountRow[]; total: number }
  costos:        { accounts: AccountRow[]; total: number }
  gastos:        { accounts: AccountRow[]; total: number }
  otrosGastos:   { accounts: AccountRow[]; total: number }
  utilidadBruta:      number
  utilidadOperativa:  number
  utilidadNeta:       number
  margenBruto:        number
  margenOperativo:    number
  margenNeto:         number
  comparison?: any
}

export interface FlujoEfectivoData {
  period:     { from: string; to: string }
  operating:  { netIncome: number; adjustments: { label: string; amount: number }[]; total: number }
  investing:  { items: { label: string; amount: number }[]; total: number }
  financing:  { items: { label: string; amount: number }[]; total: number }
  cashAccounts: { code: string; name: string; change: number }[]
  netCashChange: number
  totalCashEnd:  number
  note?: string | null
}

export interface ExecutiveAgingRow {
  customer_name?: string
  customer_id?: string
  vendor_name?: string
  vendor_id?: string
  documents?: number
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  over_90: number
  total: number
}

export interface ExecutiveAgingSection {
  asOf: string
  total: number
  overdue: number
  critical: number
  overduePct: number
  criticalPct: number
  buckets: Record<string, number>
  rows: ExecutiveAgingRow[]
  topCritical: ExecutiveAgingRow[]
  advances?: { vendor_id: string; vendor_name: string; advance_number: string; advance_balance: number }[]
  totalAdvances?: number
  apNetTotal?: number
}

export interface ExecutiveDashboardData {
  period: { from: string; to: string; asOf: string }
  company: Partial<EmpresaInfo> & { company_name?: string }
  currency: string
  summary: {
    salesTotal: number
    purchasesTotal: number
    netIncome: number
    grossMargin: number
    operatingMargin: number
    netMargin: number
    cashNetChange: number
    cashEnd: number
    arTotal: number
    apTotal: number
    arOverdue: number
    apOverdue: number
    arOverduePct: number
    apOverduePct: number
    commercialLeverage: number | null
    overdueInvoices: number
    totalAdvances?: number
    apNetTotal?: number
  }
  receivables: ExecutiveAgingSection
  payables: ExecutiveAgingSection
  cashFlow: FlujoEfectivoData | null
  ratios: TasasRendimientoData | null
  insights: { type: 'danger' | 'warning' | 'success' | string; title: string; text: string }[]
  recent: { overdueInvoices: any[] }
}

export interface RatioItem {
  nombre: string
  valor: number | null
  unidad?: string
  ideal?: string
  descripcion?: string
}

export interface TasasRendimientoData {
  period:        { from: string; to: string }
  liquidez:      RatioItem[]
  endeudamiento: RatioItem[]
  rentabilidad:  RatioItem[]
  eficiencia:    RatioItem[]
  resumen:       Record<string, number>
}

export interface MovimientoCapitalData {
  period:       { from: string; to: string }
  openingBalance: number
  accounts:     AccountRow[]
  movements:    any[]
  capitalContribuciones: { accounts: AccountRow[]; total: number }
  utilidadesRetenidas:   { accounts: AccountRow[]; total: number }
  netIncomePeriod: number
  closingBalance:  number
}

export interface BalanzaData {
  period:       { from: string; to: string }
  accounts:     AccountRow[]
  totalDebit:   number
  totalCredit:  number
  balanced:     boolean
}

export interface AccountRow {
  id:            string
  code:          string
  name:          string
  balance_type:  string
  normal_balance: string
  group_code?:   string
  total_debit:   number
  total_credit:  number
  balance:       number
}

export interface CorrelativoData {
  tipo:                 string
  fiscal_year:          string
  current_correlativo:  number
  folio_start:          number
  last_generated?:      string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const getBalanceGeneral = (params?: { date?: string; compPeriod?: string }) =>
  api.get<any>(`${BASE}/financiero/balance-general`, { params }).then(unwrap) as Promise<BalanceGeneralData>

export const getEstadoResultados = (params?: { fromDate?: string; toDate?: string; compFrom?: string; compTo?: string }) =>
  api.get<any>(`${BASE}/financiero/estado-resultados`, { params }).then(unwrap) as Promise<EstadoResultadosData>

export const getFlujoEfectivo = (params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/financiero/flujo-efectivo`, { params }).then(unwrap) as Promise<FlujoEfectivoData>

export const getTasasRendimiento = (params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/financiero/tasas-rendimiento`, { params }).then(unwrap) as Promise<TasasRendimientoData>

export const getExecutiveDashboard = (params?: { fromDate?: string; toDate?: string; asOf?: string }) =>
  api.get<any>(`${BASE}/dashboard-ejecutivo`, { params }).then(unwrap) as Promise<ExecutiveDashboardData>

export const getMovimientoCapital = (params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/financiero/movimiento-capital`, { params }).then(unwrap) as Promise<MovimientoCapitalData>

export const getBalanza = (params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/financiero/balanza-comprobacion`, { params }).then(unwrap) as Promise<BalanzaData>

// ─── Libro Diario ─────────────────────────────────────────────────────────────

export interface LibroDiarioLine {
  accountCode: string
  accountName: string
  description: string
  debit:  number
  credit: number
}

export interface LibroDiarioEntry {
  id:                 string
  entryNumber:        string
  entryDate:          string
  description:        string
  reference:          string
  type:               string
  status:             string
  totalDebit:         number
  totalCredit:        number
  sourceDocumentType: string
  sourceDocumentId:   string
  lines:              LibroDiarioLine[]
}

export interface LibroDiarioData {
  period:  { from: string; to: string }
  total:   number
  page:    number
  limit:   number
  entries: LibroDiarioEntry[]
}

export const getLibroDiario = (params?: { fromDate?: string; toDate?: string; page?: number; limit?: number; search?: string }) =>
  api.get<any>(`${BASE}/contabilidad/libro-diario`, { params }).then(unwrap) as Promise<LibroDiarioData>

// ─── Libro Mayor ──────────────────────────────────────────────────────────────

export interface LibroMayorMovement {
  date:        string
  entryNumber: string
  description: string
  debit:       number
  credit:      number
  balance:     number
  // enriched fields
  reference?:       string | null
  sourceType?:      string | null
  sourceId?:        string | null
  entryType?:       string | null
  contactName?:     string | null
  docNumber?:       string | null
  journalEntryId?:  string | null
}

export interface LibroMayorData {
  account:        { id: string; code: string; name: string; balanceType: string }
  period:         { from: string; to: string }
  openingBalance: number
  movements:      LibroMayorMovement[]
  totalDebit:     number
  totalCredit:    number
  closingBalance: number
}

export interface CuentaConMovimiento {
  id:          string
  code:        string
  name:        string
  balanceType: string
}

export const getLibroMayor = (accountId: string, params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/contabilidad/libro-mayor`, { params: { accountId, ...params } }).then(unwrap) as Promise<LibroMayorData>

export const getCuentasConMovimientos = (params?: { fromDate?: string; toDate?: string }) =>
  api.get<any>(`${BASE}/contabilidad/cuentas-con-movimientos`, { params }).then(unwrap) as Promise<CuentaConMovimiento[]>

// Folio / Correlativo
export const listCorrelatives = () =>
  api.get<any>(`${BASE}/correlativo`).then(unwrap) as Promise<CorrelativoData[]>
export const getCorrelativo = (tipo: string, year?: string) =>
  api.get<any>(`${BASE}/correlativo/${tipo}`, { params: { year } }).then(unwrap) as Promise<CorrelativoData>
export const nextCorrelativo = (tipo: string, year?: string) =>
  api.post<any>(`${BASE}/correlativo/${tipo}/next`, null, { params: { year } }).then(unwrap) as Promise<CorrelativoData>

// ─── Declaración IVA (Impuestos) ──────────────────────────────────────────────

export type DeclaracionIvaStatus = 'borrador' | 'poliza_generada' | 'presentada'

export interface DeclaracionIva {
  id:               string
  tenantId:         string
  companyId:        string | null
  mes:              number
  anio:             number
  status:           DeclaracionIvaStatus
  ivaDebitoFiscal:  number
  ivaCreditoFiscal: number
  retencionIva:     number
  ivaNeto:          number
  baseVentas:       number
  baseCompras:      number
  polizaId:         string | null
  snapshot:         Record<string, any> | null
  createdAt:        string
  updatedAt:        string
}

export const getDeclaracionesIva = () =>
  api.get(`${BASE}/impuestos/declaracion-iva`).then(unwrap) as Promise<DeclaracionIva[]>

export const getDeclaracionIva = (id: string) =>
  api.get(`${BASE}/impuestos/declaracion-iva/${id}`).then(unwrap) as Promise<DeclaracionIva>

export const generarBorradorIva = (mes: number, anio: number) =>
  api.post(`${BASE}/impuestos/declaracion-iva/generar-borrador`, {}, { params: { mes, anio } }).then(unwrap) as Promise<DeclaracionIva>

export const generarPolizaBorradorIva = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iva/${id}/poliza-borrador`).then(unwrap) as Promise<DeclaracionIva>

export const marcarIvaPresentada = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iva/${id}/marcar-presentada`).then(unwrap) as Promise<DeclaracionIva>

export const actualizarDeclaracionIva = (
  id: string,
  dto: {
    ivaDebitoFiscal?: number; ivaCreditoFiscal?: number
    retencionIva?: number; baseVentas?: number; baseCompras?: number
    ventasDesglose?: Record<string, unknown>
    comprasDesglose?: Record<string, unknown>
  },
) =>
  api.patch(`${BASE}/impuestos/declaracion-iva/${id}`, dto).then(unwrap) as Promise<DeclaracionIva>

export const exportReporte = (tipo: string, formato: 'excel' | 'pdf', params: Record<string, string>) => {
  const qs = new URLSearchParams(params)
  return api.get(`${BASE}/exportar/${tipo}/${formato}`, {
    params: Object.fromEntries(qs),
    responseType: 'blob',
  }).then(r => {
    const ext  = formato === 'excel' ? 'xlsx' : 'pdf'
    const mime = formato === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf'
    const url  = URL.createObjectURL(new Blob([r.data], { type: mime }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${tipo}-${new Date().toISOString().split('T')[0]}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  })
}
