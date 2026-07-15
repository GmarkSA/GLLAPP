import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/planillas/periodos'

export type EstadoPeriodoPlanilla = 'BORRADOR' | 'APROBADA' | 'CONTABILIZADA' | 'PAGADA'

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
  /** 1 = días 1-15 (sin deducciones) · 2 = día 16-fin de mes (IGSS/ISR/bonificación del mes completo) */
  quincena: number
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
  asientoContableId: string | null
  contabilizadoAt: string | null
  contabilizadoPor: string | null
  asientoPagoId: string | null
  bankAccountId: string | null
  pagadoAt: string | null
  pagadoPor: string | null
}

export interface DistribucionFila {
  id?: string
  centroCostoId: string | null
  centroBeneficioId: string | null
  porcentaje: number
}

export interface PeriodoPlanillaDetalle extends PeriodoPlanilla {
  detalles: DetallePlanilla[]
}

export const getPeriodosPlanilla = () =>
  api.get(BASE).then(unwrap) as Promise<PeriodoPlanilla[]>

export const getPeriodoPlanilla = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<PeriodoPlanillaDetalle>

export const crearPeriodoPlanilla = (dto: { anio: number; mes: number; quincena: number }) =>
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

export interface LineaAsientoPreview {
  accountId: string
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
  centroCostoId: string | null
  centroCostoNombre: string | null
  centroBeneficioId: string | null
  centroBeneficioNombre: string | null
  concepto: string
}

export interface PreviewAsiento {
  lines: LineaAsientoPreview[]
  totalDebit: number
  totalCredit: number
  cuadra: boolean
  faltantes: string[]
  sinConfiguracionCuentas: boolean
}

export const previsualizarAsientoPlanilla = (id: string) =>
  api.get(`${BASE}/${id}/preview-asiento`).then(unwrap) as Promise<PreviewAsiento>

export const contabilizarPeriodoPlanilla = (id: string) =>
  api.post(`${BASE}/${id}/contabilizar`).then(unwrap) as Promise<{ periodo: PeriodoPlanilla; asientoContableId: string; entryNumber: string }>

export const pagarPeriodoPlanilla = (id: string, dto: { bankAccountId: string; fecha: string }) =>
  api.post(`${BASE}/${id}/pagar`, dto).then(unwrap) as Promise<{ periodo: PeriodoPlanilla; asientoPagoId: string; entryNumber: string; totalPago: number }>

export const getDistribucionDetalle = (detalleId: string) =>
  api.get(`${BASE}/detalles/${detalleId}/distribucion`).then(unwrap) as Promise<DistribucionFila[]>

export const guardarDistribucionDetalle = (detalleId: string, filas: DistribucionFila[]) =>
  api.put(`${BASE}/detalles/${detalleId}/distribucion`, filas).then(unwrap) as Promise<DistribucionFila[]>
