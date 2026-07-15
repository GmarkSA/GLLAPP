import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/planillas/periodos'

export type EstadoPeriodoPlanilla = 'BORRADOR' | 'APROBADA' | 'PAGADA'

export interface DetallePlanilla {
  id: string
  periodoId: string
  empleadoId: string
  empleadoCodigo: string
  empleadoNombre: string
  tipoJornada: string
  metodoPago: string
  bancoCodigo: string | null
  bancoNombre: string | null
  numeroCuentaBancaria: string | null
  salarioMensual: number
  diasTrabajados: number
  salarioDevengado: number
  horasExtraHabil: number
  horasExtraEspecial: number
  montoHorasExtra: number
  bonificacionIncentivo: number
  otrosIngresos: number
  otrosIngresosDescripcion: string | null
  totalDevengado: number
  baseIGSS: number
  cuotaIGSSLaboral: number
  isrRetenido: number
  otrasDeducciones: number
  otrasDeduccionesDescripcion: string | null
  totalDeducciones: number
  netoAPagar: number
  cuotaPatronalIGSS: number
  cuotaINTECAP: number
  cuotaIRTRA: number
  centroCostoId: string | null
  centroBeneficioId: string | null
  advertencias: string | null
}

export interface PeriodoPlanilla {
  id: string
  anio: number
  mes: number
  fechaInicio: string
  fechaFin: string
  estado: EstadoPeriodoPlanilla
  totalDevengado: number
  totalDeducciones: number
  totalNeto: number
  totalCuotaPatronal: number
  totalEmpleados: number
  notas: string | null
  aprobadoAt: string | null
  aprobadoPor: string | null
}

export interface PeriodoPlanillaDetalle extends PeriodoPlanilla {
  detalles: DetallePlanilla[]
}

export const getPeriodosPlanilla = () =>
  api.get(BASE).then(unwrap) as Promise<PeriodoPlanilla[]>

export const getPeriodoPlanilla = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const crearPeriodoPlanilla = (dto: { anio: number; mes: number }) =>
  api.post(BASE, dto).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const recalcularPeriodoPlanilla = (id: string) =>
  api.post(`${BASE}/${id}/recalcular`).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const actualizarDetallePlanilla = (detalleId: string, dto: Partial<{
  diasTrabajados: number
  horasExtraHabil: number
  horasExtraEspecial: number
  otrosIngresos: number
  otrosIngresosDescripcion: string
  otrasDeducciones: number
  otrasDeduccionesDescripcion: string
  centroCostoId: string | null
  centroBeneficioId: string | null
}>) => api.patch(`${BASE}/detalles/${detalleId}`, dto).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const aprobarPeriodoPlanilla = (id: string) =>
  api.post(`${BASE}/${id}/aprobar`).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const eliminarPeriodoPlanilla = (id: string) =>
  api.delete(`${BASE}/${id}`).then(unwrap)
