import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data
const BASE = '/planillas/finiquitos'

export type MotivoBajaFiniquito = 'RENUNCIA' | 'DESPIDO_JUSTIFICADO' | 'DESPIDO_INJUSTIFICADO' | 'MUTUO_ACUERDO' | 'OTRO'
export type EstadoFiniquito = 'BORRADOR' | 'CONTABILIZADO' | 'PAGADO'

export interface DtoFiniquito {
  fechaBaja: string
  motivoBaja: MotivoBajaFiniquito
  aplicaIndemnizacion?: boolean
  fechaUltimoPagoBono14: string
  fechaUltimoPagoAguinaldo: string
  otrasDeducciones?: number
  otrasDeduccionesDescripcion?: string | null
}

export interface ConceptoFiniquito {
  dias: number
  monto: number
  provisionAcumulada: number
  ajuste: number
}

export interface CalculoFiniquito {
  empleado: { id: string; codigo: string; nombre: string }
  fechaInicioLaboral: string
  fechaBaja: string
  motivoBaja: MotivoBajaFiniquito
  aplicaIndemnizacion: boolean
  fechaUltimoPagoBono14: string
  fechaUltimoPagoAguinaldo: string
  indemnizacion: ConceptoFiniquito
  vacaciones: ConceptoFiniquito & { aniosCompletos: number; topeAplicado: boolean }
  bono14: ConceptoFiniquito
  aguinaldo: ConceptoFiniquito
  otrasDeducciones: number
  otrasDeduccionesDescripcion: string | null
  totalLegal: number
  netoAPagar: number
}

export interface Finiquito {
  id: string
  empleadoId: string
  empleadoCodigo: string
  empleadoNombre: string
  fechaBaja: string
  motivoBaja: MotivoBajaFiniquito
  aplicaIndemnizacion: boolean
  fechaUltimoPagoBono14: string
  fechaUltimoPagoAguinaldo: string
  diasIndemnizacion: number
  montoIndemnizacion: number
  provisionAcumuladaIndemnizacion: number
  diasVacacionesPendientes: number
  montoVacaciones: number
  provisionAcumuladaVacaciones: number
  diasBono14: number
  montoBono14: number
  provisionAcumuladaBono14: number
  diasAguinaldo: number
  montoAguinaldo: number
  provisionAcumuladaAguinaldo: number
  otrasDeducciones: number
  otrasDeduccionesDescripcion: string | null
  totalLegal: number
  netoAPagar: number
  estado: EstadoFiniquito
  asientoContableId: string | null
  contabilizadoAt: string | null
  contabilizadoPor: string | null
  asientoPagoId: string | null
  bankAccountId: string | null
  pagadoAt: string | null
  pagadoPor: string | null
  createdAt: string
}

export const listarFiniquitos = () =>
  api.get(BASE).then(unwrap) as Promise<Finiquito[]>

export const getFiniquito = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<Finiquito>

export const calcularFiniquito = (empleadoId: string, dto: DtoFiniquito) =>
  api.post(`${BASE}/empleados/${empleadoId}/calcular`, dto).then(unwrap) as Promise<CalculoFiniquito>

export const guardarFiniquito = (empleadoId: string, dto: DtoFiniquito) =>
  api.post(`${BASE}/empleados/${empleadoId}`, dto).then(unwrap) as Promise<Finiquito>

export const eliminarFiniquito = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)

export const contabilizarFiniquito = (id: string) =>
  api.post(`${BASE}/${id}/contabilizar`).then(unwrap) as Promise<{ finiquito: Finiquito; entryNumber: string }>

export const pagarFiniquito = (id: string, dto: { bankAccountId: string; fecha: string }) =>
  api.post(`${BASE}/${id}/pagar`, dto).then(unwrap) as Promise<{ finiquito: Finiquito; entryNumber: string; totalPago: number }>
