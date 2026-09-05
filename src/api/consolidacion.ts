import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface ConsolidacionQuery {
  companyIds: string[]
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
}

export interface FilaConsolidada {
  type: string
  subType: string
  accountName: string
  normalBalance: string
  porEmpresa: Record<string, number>
  total: number
}

export interface ResultadoConsolidado {
  periodo: { startDate: string; endDate: string }
  companyIds: string[]
  filas: FilaConsolidada[]
}

export interface EmpresaFiscal {
  companyId: string
  legalName: string
  tradeName: string
  taxId: string
  regCode: string
  regNombre: string
  ingresos: number
  gastos: number
  utilidad: number
  isrProyectado: number
  baseIsr: number
  tasaIsr: number
  situacion: 'rentable' | 'perdida' | 'equilibrio'
}

export interface Recomendacion {
  tipo: string
  prioridad: 'alta' | 'media' | 'baja'
  descripcion: string
  nota: string
  emisor?: { id: string; nombre: string }
  receptor?: { id: string; nombre: string }
  montoSugerido?: number
  ahorroEstimadoIsr?: number
  empresa?: { id: string; nombre: string }
}

export interface PlanificacionFiscal {
  periodo: { startDate: string; endDate: string }
  empresas: EmpresaFiscal[]
  totalIngresos: number
  totalGastos: number
  utilidadConsolidada: number
  isrConsolidado: number
  recomendaciones: Recomendacion[]
}

// ── Flujo de Caja ─────────────────────────────────────────────────────────────
export interface EmpresaFlujoCaja {
  companyId: string
  utilidad: number
  arChange: number
  apChange: number
  faInvesting: number
  capChange: number
  operating: number
  investing: number
  financing: number
  netCash: number
}

export interface FlujoCaja {
  periodo: { startDate: string; endDate: string }
  porEmpresa: EmpresaFlujoCaja[]
  consolidado: Omit<EmpresaFlujoCaja, 'companyId'>
}

// ── Movimiento de Capital ──────────────────────────────────────────────────────
export interface MovimientoItem {
  code: string
  name: string
  movimiento: number
}

export interface EmpresaMovimientoCapital {
  companyId: string
  saldoInicial: number
  utilidad: number
  movimientoCapital: number
  movimientos: MovimientoItem[]
  saldoFinal: number
}

export interface MovimientoCapital {
  periodo: { startDate: string; endDate: string }
  porEmpresa: EmpresaMovimientoCapital[]
  consolidado: { saldoInicial: number; utilidad: number; movimientoCapital: number; saldoFinal: number }
}

// ── Eliminación Intercompany ──────────────────────────────────────────────────
export interface TransaccionIntercompany {
  emisorId: string
  emisorNombre: string
  receptorNombre: string
  receptorNit: string
  invoiceNumber: string
  total: number
  fecha: string
  currency: string
  receptorEmpresaId?: string
  receptorEmpresaNombre: string
}

export interface EliminacionIntercompany {
  periodo: { startDate: string; endDate: string }
  transacciones: TransaccionIntercompany[]
  totalEliminado: number
  nota?: string
}

export const getBalanceGeneral = (q: ConsolidacionQuery): Promise<ResultadoConsolidado> =>
  api.post('/consolidacion/balance-general', q).then(unwrap)

export const getEstadoResultados = (q: ConsolidacionQuery): Promise<ResultadoConsolidado> =>
  api.post('/consolidacion/estado-resultados', q).then(unwrap)

export const getPlanificacionFiscal = (q: ConsolidacionQuery): Promise<PlanificacionFiscal> =>
  api.post('/consolidacion/planificacion-fiscal', q).then(unwrap)

export const getFlujoCaja = (q: ConsolidacionQuery): Promise<FlujoCaja> =>
  api.post('/consolidacion/flujo-caja', q).then(unwrap)

export const getMovimientoCapital = (q: ConsolidacionQuery): Promise<MovimientoCapital> =>
  api.post('/consolidacion/movimiento-capital', q).then(unwrap)

export const getEliminacionIntercompany = (q: ConsolidacionQuery): Promise<EliminacionIntercompany> =>
  api.post('/consolidacion/eliminacion-intercompany', q).then(unwrap)
