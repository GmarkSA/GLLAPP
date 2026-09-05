import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface ConsolidacionQuery {
  companyIds: string[]
  year: number
  month: number
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
  periodo: { year: number; month: number }
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
  periodo: { year: number; month: number; startDate: string; endDate: string }
  empresas: EmpresaFiscal[]
  totalIngresos: number
  totalGastos: number
  utilidadConsolidada: number
  isrConsolidado: number
  recomendaciones: Recomendacion[]
}

export const getBalanceGeneral = (q: ConsolidacionQuery): Promise<ResultadoConsolidado> =>
  api.post('/consolidacion/balance-general', q).then(unwrap)

export const getEstadoResultados = (q: ConsolidacionQuery): Promise<ResultadoConsolidado> =>
  api.post('/consolidacion/estado-resultados', q).then(unwrap)

export const getPlanificacionFiscal = (q: ConsolidacionQuery): Promise<PlanificacionFiscal> =>
  api.post('/consolidacion/planificacion-fiscal', q).then(unwrap)
