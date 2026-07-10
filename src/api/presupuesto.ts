import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type BudgetPeriodo = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
export type BudgetStatus  = 'BORRADOR' | 'ACTIVO' | 'CERRADO'

export interface BudgetLine {
  id:              string
  budgetId:        string
  accountId:       string
  accountCode:     string
  accountName:     string
  accountType:     string | null
  periodo:         number
  año:             number
  monto:           number
  centroCostoId?:  string | null
  centroBeneficioId?: string | null
  notas?:          string | null
}

export interface Budget {
  id:                    string
  companyId:             string
  nombre:                string
  anioFiscal:            number
  fechaInicio:           string
  fechaFin:              string
  periodo:               BudgetPeriodo
  incluirBalanceGeneral: boolean
  status:                BudgetStatus
  notas?:                string | null
  copiadoDeId?:          string | null
  centroCostoId?:        string | null
  centroBeneficioId?:    string | null
  createdAt:             string
  updatedAt:             string
  lines:                 BudgetLine[]
}

export interface BudgetVsRealPeriodo {
  periodo:       number
  presupuestado: number
  real:          number
  varianza:      number
  porcentaje:    number | null
  alerta:        'OVER_BUDGET' | 'WARNING' | null
}

export interface BudgetVsRealRow {
  accountId:          string
  accountCode:        string
  accountName:        string
  accountType:        string | null
  periodos:           BudgetVsRealPeriodo[]
  totalPresupuestado: number
  totalReal:          number
  totalVarianza:      number
  alertaGlobal:       'OVER_BUDGET' | 'WARNING' | null
}

export interface BudgetVsReal {
  budget: Budget
  rows:   BudgetVsRealRow[]
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export const getPresupuestos = () =>
  api.get('/contabilidad/presupuesto').then(unwrap) as Promise<Budget[]>

export const getPresupuesto = (id: string) =>
  api.get(`/contabilidad/presupuesto/${id}`).then(unwrap) as Promise<Budget>

export const createPresupuesto = (dto: {
  nombre: string
  anioFiscal: number
  fechaInicio: string
  fechaFin: string
  periodo: BudgetPeriodo
  incluirBalanceGeneral?: boolean
  cuentaIds: string[]
  centroCostoId?: string | null
  centroBeneficioId?: string | null
  notas?: string
}) => api.post('/contabilidad/presupuesto', dto).then(unwrap) as Promise<Budget>

export const updatePresupuesto = (id: string, dto: Partial<Pick<Budget, 'nombre' | 'notas' | 'status' | 'centroCostoId' | 'centroBeneficioId'>>) =>
  api.patch(`/contabilidad/presupuesto/${id}`, dto).then(unwrap) as Promise<Budget>

export const deletePresupuesto = (id: string) =>
  api.delete(`/contabilidad/presupuesto/${id}`)

// ── Líneas ────────────────────────────────────────────────────────────────────
export const upsertLines = (id: string, lines: Partial<BudgetLine>[]) =>
  api.post(`/contabilidad/presupuesto/${id}/lines`, { lines }).then(unwrap)

// ── Cuentas ───────────────────────────────────────────────────────────────────
export const addCuentas = (id: string, cuentaIds: string[]) =>
  api.post(`/contabilidad/presupuesto/${id}/cuentas/add`, { cuentaIds }).then(unwrap)

export const removeCuentas = (id: string, cuentaIds: string[]) =>
  api.post(`/contabilidad/presupuesto/${id}/cuentas/remove`, { cuentaIds }).then(unwrap)

// ── Prefill ───────────────────────────────────────────────────────────────────
export const prefillPresupuesto = (id: string, config: {
  tipo: 'FIJO' | 'AJUSTE_MONTO' | 'AJUSTE_PORCENTAJE'
  valor: number
  anioFuenteDatos: number
  accountIds?: string[]
}) => api.post(`/contabilidad/presupuesto/${id}/prefill`, config).then(unwrap)

// ── Copiar ────────────────────────────────────────────────────────────────────
export const copyPresupuesto = (id: string, targetYear: number) =>
  api.post(`/contabilidad/presupuesto/${id}/copy`, { targetYear }).then(unwrap) as Promise<Budget>

// ── Reporte vs Real ───────────────────────────────────────────────────────────
export const getPresupuestoVsReal = (id: string, params?: { fechaDesde?: string; fechaHasta?: string }) =>
  api.get(`/contabilidad/presupuesto/${id}/vs-real`, { params }).then(unwrap) as Promise<BudgetVsReal>

// ── Helpers de UI ─────────────────────────────────────────────────────────────
export const PERIODO_LABELS: Record<BudgetPeriodo, string[]> = {
  MENSUAL:     ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
  TRIMESTRAL:  ['T1', 'T2', 'T3', 'T4'],
  SEMESTRAL:   ['S1', 'S2'],
  ANUAL:       ['ANUAL'],
}

export const STATUS_COLOR: Record<BudgetStatus, string> = {
  BORRADOR: 'default',
  ACTIVO:   'success',
  CERRADO:  'warning',
}

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  BORRADOR: 'Borrador',
  ACTIVO:   'Activo',
  CERRADO:  'Cerrado',
}
