import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

const BASE = '/planillas'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoJornada = 'DIURNA' | 'NOCTURNA' | 'MIXTA'
export type TipoContratoEmpleado = 'TIEMPO_COMPLETO' | 'TIEMPO_PARCIAL'
export type EstadoEmpleado = 'ACTIVO' | 'SUSPENDIDO' | 'BAJA'
export type MotivoCambioSalario = 'ALTA' | 'AUMENTO' | 'AJUSTE' | 'CAMBIO_PUESTO' | 'OTRO'

export interface ContratoLaboral {
  id: string
  empleadoId: string
  fechaInicio: string
  fechaFin: string | null
  salarioOrdinarioMensual: number
  motivoCambio: MotivoCambioSalario
  notas: string | null
  createdAt: string
}

export interface Empleado {
  id: string
  codigo: string
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  apellidoCasada: string | null
  nit: string | null
  dpi: string | null
  fechaNacimiento: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  puesto: string | null
  tipoActividadEconomica: 'AGRICOLA' | 'NO_AGRICOLA' | 'EXPORTACION_MAQUILA'
  circunscripcionEconomica: 'CE1' | 'CE2'
  tipoJornada: TipoJornada
  tipoContrato: TipoContratoEmpleado
  numeroAfiliadoIGSS: string | null
  codigoOcupacionIGSS: string | null
  centroTrabajoId: string | null
  centroCostoId: string | null
  centroBeneficioId: string | null
  fechaAlta: string
  fechaBaja: string | null
  estado: EstadoEmpleado
  fechaAntiguedad: string | null
  saldosInicialesAnio: number | null
  ingresosAcumuladosInicial: number
  isrRetenidoInicial: number
  igssLaboralInicial: number
  vacacionesDiasPendientesInicial: number
  notas: string | null
  salarioVigente: number | null
  salarioDesde: string | null
}

export interface EmpleadoDetalle extends Empleado {
  historialSalarios: ContratoLaboral[]
}

export interface CentroTrabajo {
  id: string
  codigo: string
  nombre: string
  direccion: string | null
  zona: string | null
  telefono: string | null
  departamento: string | null
  municipio: string | null
  codigoActividadEconomica: string | null
  activo: boolean
}

export const nombreCompleto = (e: Pick<Empleado, 'primerNombre' | 'segundoNombre' | 'primerApellido' | 'segundoApellido' | 'apellidoCasada'>) =>
  [e.primerNombre, e.segundoNombre, e.primerApellido, e.segundoApellido, e.apellidoCasada]
    .filter(Boolean).join(' ')

// ─── Empleados ────────────────────────────────────────────────────────────────

export const getEmpleados = (incluirBajas = false) =>
  api.get(`${BASE}/empleados`, { params: { incluirBajas } }).then(unwrap) as Promise<Empleado[]>

export const getEmpleado = (id: string) =>
  api.get(`${BASE}/empleados/${id}`).then(unwrap) as Promise<EmpleadoDetalle>

export const crearEmpleado = (dto: Partial<Empleado> & { salarioInicial: number }) =>
  api.post(`${BASE}/empleados`, dto).then(unwrap) as Promise<Empleado & { advertenciaSalarioMinimo: string | null }>

export const actualizarEmpleado = (id: string, dto: Partial<Empleado>) =>
  api.patch(`${BASE}/empleados/${id}`, dto).then(unwrap) as Promise<Empleado>

export const cambiarSalario = (empleadoId: string, dto: {
  salarioOrdinarioMensual: number
  fechaInicio: string
  motivoCambio?: MotivoCambioSalario
  notas?: string
}) => api.post(`${BASE}/empleados/${empleadoId}/cambiar-salario`, dto)
  .then(unwrap) as Promise<ContratoLaboral & { advertenciaSalarioMinimo: string | null }>

export const darDeBajaEmpleado = (id: string, fechaBaja: string) =>
  api.post(`${BASE}/empleados/${id}/baja`, { fechaBaja }).then(unwrap) as Promise<Empleado>

// ─── Centros de trabajo ───────────────────────────────────────────────────────

export const getCentrosTrabajo = () =>
  api.get(`${BASE}/centros-trabajo`).then(unwrap) as Promise<CentroTrabajo[]>

export const guardarCentroTrabajo = (dto: Partial<CentroTrabajo>) =>
  api.put(`${BASE}/centros-trabajo`, dto).then(unwrap) as Promise<CentroTrabajo>
