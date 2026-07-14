import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/reportes/analitico'

// ─── Rentabilidad por Centro de Beneficio ─────────────────────────────────────

export interface CuentaCentroRow {
  accountId:   string
  code:        string
  name:        string
  balanceType: string
  balance:     number
}

export interface SeccionesPyG {
  ingresos:         number
  otrosIngresos:    number
  costos:           number
  gastos:           number
  otrosGastos:      number
  utilidadBruta:    number
  utilidadOperativa: number
  margenBruto:      number | null
  margenOperativo:  number | null
}

export interface CentroBeneficioPyG extends SeccionesPyG {
  centroId:    string | null
  codigo:      string
  nombre:      string
  grupo:       string | null
  responsable: string | null
  activo:      boolean
  comp:        SeccionesPyG | null
  cuentas:     CuentaCentroRow[]
}

export interface TendenciaMensualCB {
  centroId: string | null
  ym:       string   // 'YYYY-MM'
  ingresos: number
  egresos:  number
}

export interface RentabilidadCBData {
  period:      { from: string; to: string }
  compPeriod:  { from: string; to: string } | null
  centros:     Array<{ id: string; codigo: string; nombre: string; grupo: string | null; responsable: string | null; activo: boolean }>
  data:        CentroBeneficioPyG[]
  sinAsignar:  CentroBeneficioPyG
  totales:     SeccionesPyG
  totalesComp: SeccionesPyG | null
  tendencia:   TendenciaMensualCB[]
}

export const getRentabilidadCentrosBeneficio = (params: {
  fromDate?: string; toDate?: string; compFrom?: string; compTo?: string;
}) => api.get(`${BASE}/centros-beneficio`, { params }).then(unwrap) as Promise<RentabilidadCBData>

// ─── Ejecución presupuestaria por Centro de Costo ─────────────────────────────

export interface GastoRealRow {
  centroId:  string | null
  mes:       number   // 1-12
  accountId: string
  code:      string
  name:      string
  groupCode: string | null
  total:     number
}

export interface PresupuestoMensualRow {
  centroId: string | null
  mes:      number
  monto:    number
}

export interface EjecucionCCData {
  year:               number
  mesActual:          number   // 0 si el ejercicio aún no inicia, 12 si ya cerró
  centros:            Array<{ id: string; codigo: string; nombre: string; grupo: string | null; responsable: string | null; area: string | null; activo: boolean }>
  real:               GastoRealRow[]
  presupuestoMensual: PresupuestoMensualRow[]
  tienePresupuesto:   boolean
}

export const getEjecucionCentrosCosto = (params: { year?: number }) =>
  api.get(`${BASE}/centros-costo`, { params }).then(unwrap) as Promise<EjecucionCCData>
