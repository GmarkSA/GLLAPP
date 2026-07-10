import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface ClaseActivoFijo {
  id: string | null
  companyId: string
  codigo: string
  nombre: string
  tasaDepreciacionAnual: number
  vidaUtilMeses: number | null
  esNoDepreciable: boolean
  cuentaAltasId: string | null
  cuentaDepreciacionAcumuladaId: string | null
  cuentaGastoDepreciacionId: string | null
  cuentaGananciaPorVentaId: string | null
  cuentaPerdidaPorDeterioro: string | null
  cuentaPerdidaPorVentaId: string | null
  cuentaGananciaActivoFijoId: string | null
  activo: boolean
}

const BASE = '/contabilidad/clases-activo-fijo'

export const getClasesActivoFijo = () =>
  api.get(BASE).then(unwrap) as Promise<ClaseActivoFijo[]>

export const getClaseActivoFijo = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<ClaseActivoFijo>

export const crearClaseActivoFijo = (dto: Partial<ClaseActivoFijo>) =>
  api.post(BASE, dto).then(unwrap) as Promise<ClaseActivoFijo>

export const actualizarClaseActivoFijo = (id: string, dto: Partial<ClaseActivoFijo>) =>
  api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<ClaseActivoFijo>

export const seedGuatemalaClases = () =>
  api.post(`${BASE}/seed-guatemala`).then(unwrap)
