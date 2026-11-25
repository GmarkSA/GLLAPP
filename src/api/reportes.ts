import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/reportes'

// ─── Empresa / Encabezado de reportes ─────────────────────────────────────────

export interface EmpresaInfo {
  company_name:        string
  legal_name:          string
  tax_id:              string
  address:             string
  phone:               string
  email:               string
  currency:            string
  fiscal_regime_code?: string
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
  /** Cuánto falta para cuadrar: Activo − (Pasivo + Capital). */
  diferencia?: number
  /**
   * Las cuentas con saldo que no entran ni en el Balance ni en el Estado de
   * Resultados —su tipo no es de balance ni de resultados—. Ahí es donde está
   * la diferencia, casi siempre.
   */
  sinClasificar?: { accounts: AccountRow[]; total: number }
  /**
   * Los dos resultados que el capital tiene que llevar, y que no son cuentas
   * del catálogo: viven en ingresos y gastos.
   *
   * El de ejercicios anteriores es todo lo acumulado hasta el 31 de diciembre
   * pasado —cero si el cliente hizo asiento de cierre, porque entonces ya está
   * en una cuenta de capital—. Sin estas dos líneas el capital no suma lo que
   * dice su total.
   */
  resultadoEjerciciosAnteriores?: number
  resultadoDelPeriodo?:           number
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
  id:                       string
  tenantId:                 string
  companyId:                string | null
  mes:                      number
  anio:                     number
  status:                   DeclaracionIvaStatus
  ivaDebitoFiscal:          number
  ivaCreditoFiscal:         number
  retencionIva:             number
  remanentePeriodoAnterior: number
  ivaNeto:                  number
  baseVentas:               number
  baseCompras:              number
  polizaId:                 string | null
  snapshot:                 Record<string, any> | null
  createdAt:                string
  updatedAt:                string
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

export const sincronizarEstadoIva = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iva/${id}/sincronizar`).then(unwrap) as Promise<DeclaracionIva>

export const actualizarDeclaracionIva = (
  id: string,
  dto: {
    ivaDebitoFiscal?: number; ivaCreditoFiscal?: number
    retencionIva?: number; baseVentas?: number; baseCompras?: number
    remanentePeriodoAnterior?: number
    ventasDesglose?: Record<string, unknown>
    comprasDesglose?: Record<string, unknown>
  },
) =>
  api.patch(`${BASE}/impuestos/declaracion-iva/${id}`, dto).then(unwrap) as Promise<DeclaracionIva>

// ─── Declaración ISR Opcional Mensual (SAT-1311) ──────────────────────────────

export type DeclaracionIsrStatus = 'borrador' | 'poliza_generada' | 'presentada'

export interface DeclaracionIsr {
  id:                          string
  tenantId:                    string
  companyId:                   string | null
  mes:                         number
  anio:                        number
  status:                      DeclaracionIsrStatus
  rentaActividadesLucrativas:  number
  rentasExentas:               number
  rentaImponible:              number
  impuestoDeterminado:         number
  retencionesPeriodo:          number
  remanenteAnterior:           number
  saldoAPagar:                 number
  excedenteParaSiguiente:      number
  cantidadFacturas:            number
  polizaId:                    string | null
  snapshot:                    Record<string, any> | null
  createdAt:                   string
  updatedAt:                   string
}

export const getDeclaracionesIsr = () =>
  api.get(`${BASE}/impuestos/declaracion-isr`).then(unwrap) as Promise<DeclaracionIsr[]>

export const getDeclaracionIsr = (id: string) =>
  api.get(`${BASE}/impuestos/declaracion-isr/${id}`).then(unwrap) as Promise<DeclaracionIsr>

export const generarBorradorIsr = (mes: number, anio: number) =>
  api.post(`${BASE}/impuestos/declaracion-isr/generar-borrador`, {}, { params: { mes, anio } }).then(unwrap) as Promise<DeclaracionIsr>

export const generarPolizaBorradorIsr = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-isr/${id}/poliza-borrador`).then(unwrap) as Promise<DeclaracionIsr>

export const marcarIsrPresentada = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-isr/${id}/marcar-presentada`).then(unwrap) as Promise<DeclaracionIsr>

export const sincronizarEstadoIsr = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-isr/${id}/sincronizar`).then(unwrap) as Promise<DeclaracionIsr>

export const actualizarDeclaracionIsr = (
  id: string,
  dto: {
    rentaActividadesLucrativas?: number
    rentasExentas?: number
    retencionesPeriodo?: number
    remanenteAnterior?: number
  },
) =>
  api.patch(`${BASE}/impuestos/declaracion-isr/${id}`, dto).then(unwrap) as Promise<DeclaracionIsr>

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

/**
 * El juego de Estados Financieros en Excel, armado por el servidor.
 *
 * Portada, Balance General y Estado de Resultados comparados contra el año
 * anterior, y las integraciones como anexo. Se arma allá porque el logo de la
 * empresa vive en R2 —solo el servidor puede bajar sus bytes— y porque la
 * integración de cien cuentas son cien consultas.
 */
export const descargarEstadosFinancierosExcel = async (mes: number, anio: number) => {
  const r = await api.get(`${BASE}/financiero/estados-financieros/excel`, {
    params: { mes, anio },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([r.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = `estados_financieros_${anio}_${String(mes).padStart(2, '0')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Declaración de ISO — Impuesto de Solidaridad (SAT-1608) ──────────────────

export type DeclaracionIsoStatus = 'borrador' | 'poliza_generada' | 'presentada'
export type BaseIso = 'activo_neto' | 'ingresos_brutos'

/**
 * El formulario SAT-1608, trimestral.
 *
 * La base no sale del trimestre: sale del ejercicio anterior —ingresos brutos
 * de la liquidación anual inmediata anterior y activo neto de su cierre
 * (arts. 2 y 7 del Decreto 73-2008)—. Por eso el Q1 de 2026 se calcula con el
 * cierre de 2025 y los cuatro trimestres del año llevan la misma base.
 */
export interface DeclaracionIso {
  id:        string
  tenantId:  string
  companyId: string | null
  trimestre: number
  anio:      number
  /** El ejercicio del que salen las cifras. Por omisión, anio − 1. */
  anioBase:  number
  status:    DeclaracionIsoStatus

  // 3. Margen bruto (art. 2.4) — afecto solo si supera el 4%
  ingresosServicios: number
  ingresosVentas:    number
  costoVentas:       number
  ingresosBrutos:    number
  margenBruto:       number
  margenBrutoPct:    number
  afecto:            boolean

  // 4. Activo neto (art. 2.1)
  activoTotal:              number
  depreciacionesAcumuladas: number
  amortizacionesAcumuladas: number
  reservaIncobrables:       number
  creditosFiscales:         number
  activoNeto:               number
  baseActivoNeto:           number
  impuestoActivoNeto:       number
  /** IUSI del trimestre: se resta solo si la base aplicada es la del activo. */
  iusiPagado:               number

  // 5. Ingresos brutos
  exclusionesIngresos:    number
  baseIngresosBrutos:     number
  impuestoIngresosBrutos: number

  // 6. Determinación
  baseAplicada:        BaseIso
  impuestoDeterminado: number
  /** ISR trimestral acreditado al ISO (art. 11 b). */
  isrAcreditado:       number
  impuestoAPagar:      number

  polizaId:  string | null
  snapshot:  Record<string, any> | null
  createdAt: string
  updatedAt: string
}

export const getDeclaracionesIso = () =>
  api.get(`${BASE}/impuestos/declaracion-iso`).then(unwrap) as Promise<DeclaracionIso[]>

export const getDeclaracionIso = (id: string) =>
  api.get(`${BASE}/impuestos/declaracion-iso/${id}`).then(unwrap) as Promise<DeclaracionIso>

export const generarBorradorIso = (trimestre: number, anio: number, anioBase?: number) =>
  api.post(`${BASE}/impuestos/declaracion-iso/generar-borrador`, {}, {
    params: { trimestre, anio, ...(anioBase ? { anioBase } : {}) },
  }).then(unwrap) as Promise<DeclaracionIso>

export const generarPolizaBorradorIso = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iso/${id}/poliza-borrador`).then(unwrap) as Promise<DeclaracionIso>

export const marcarIsoPresentada = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iso/${id}/marcar-presentada`).then(unwrap) as Promise<DeclaracionIso>

export const sincronizarEstadoIso = (id: string) =>
  api.post(`${BASE}/impuestos/declaracion-iso/${id}/sincronizar`).then(unwrap) as Promise<DeclaracionIso>

/**
 * Corregir las casillas del formulario. El impuesto NO se escribe a mano: el
 * servidor lo vuelve a calcular con la regla de la ley.
 */
export const actualizarDeclaracionIso = (
  id: string,
  dto: Partial<Pick<DeclaracionIso,
    'ingresosServicios' | 'ingresosVentas' | 'costoVentas' |
    'activoTotal' | 'depreciacionesAcumuladas' | 'amortizacionesAcumuladas' |
    'reservaIncobrables' | 'creditosFiscales' | 'exclusionesIngresos' |
    'iusiPagado' | 'isrAcreditado'>>,
) =>
  api.patch(`${BASE}/impuestos/declaracion-iso/${id}`, dto).then(unwrap) as Promise<DeclaracionIso>
