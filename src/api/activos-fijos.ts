import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type EstadoActivoFijo = 'BORRADOR' | 'ACTIVO' | 'VENDIDO' | 'DADO_DE_BAJA'

export interface ActivoFijo {
  id: string
  companyId: string
  assetNumber: string
  name: string
  description: string | null
  claseActivoFijoId: string | null
  estado: EstadoActivoFijo
  acquisitionDate: string
  originalCost: number
  salvageValue: number
  currentBookValue: number
  accumulatedDepreciation: number
  depreciacionMensual: number | null
  location: string | null
  serialNumber: string | null
  vendorId: string | null
  purchaseInvoiceId: string | null
  disposedAt: string | null
  disposalValue: number | null
  centroCostoId: string | null
  centroBeneficioId: string | null
  createdAt: string
  updatedAt: string
}

export interface HistorialDepreciacion {
  id: string
  activoFijoId: string
  companyId: string
  periodo: string
  cuota: number
  depreciacionAcumuladaFin: number
  valorLibroFin: number
  asientoId: string | null
  fechaCalculo: string
}

export interface ActivoFijoListResult {
  data: ActivoFijo[]
  total: number
  page: number
  limit: number
}

const BASE = '/contabilidad/activos-fijos'

export const getActivosFijos = (params?: {
  estado?: string; claseId?: string; search?: string; page?: number; limit?: number;
}) => api.get(BASE, { params }).then(unwrap) as Promise<ActivoFijoListResult>

export const getActivoFijo = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<ActivoFijo>

export const getHistorialDepreciacion = (id: string) =>
  api.get(`${BASE}/${id}/historial`).then(unwrap) as Promise<HistorialDepreciacion[]>

export const crearActivoFijo = (dto: {
  name: string; description?: string; claseActivoFijoId?: string;
  acquisitionDate: string; originalCost: number; salvageValue?: number;
  location?: string; serialNumber?: string;
  centroCostoId?: string; centroBeneficioId?: string;
}) => api.post(BASE, dto).then(unwrap) as Promise<ActivoFijo>

export const actualizarActivoFijo = (id: string, dto: Partial<{
  name: string; description: string; claseActivoFijoId: string;
  acquisitionDate: string; location: string; serialNumber: string;
  centroCostoId: string; centroBeneficioId: string;
}>) => api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<ActivoFijo>

export const activarActivoFijo = (id: string, dto?: { cuentaContrapartidaId?: string }) =>
  api.post(`${BASE}/${id}/activar`, dto ?? {}).then(unwrap) as Promise<ActivoFijo>

export const depreciarActivo = (id: string, periodo: string) =>
  api.post(`${BASE}/${id}/depreciar`, { periodo }).then(unwrap) as Promise<HistorialDepreciacion>

export const depreciarPeriodo = (periodo: string) =>
  api.post(`${BASE}/batch/depreciar-periodo`, { periodo }).then(unwrap)

export const venderActivoFijo = (id: string, dto: {
  fechaVenta: string; precioVenta: number; cuentaCobro?: string; motivo?: string;
}) => api.post(`${BASE}/${id}/vender`, dto).then(unwrap) as Promise<ActivoFijo>

export const darDeBajaActivoFijo = (id: string, dto: { fecha: string; motivo: string }) =>
  api.post(`${BASE}/${id}/dar-de-baja`, dto).then(unwrap) as Promise<ActivoFijo>
