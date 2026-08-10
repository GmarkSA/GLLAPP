import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ─── Integraciones de configuración (FEL, Stripe, AWS, etc.) ─────────────────

const BASE = '/configuracion/integraciones'

export type IntegrationProvider =
  | 'fel_felplex' | 'fel_infile' | 'fel_digifact'
  | 'stripe' | 'paypal' | 'openai' | 'aws_s3'
  | 'aws_textract' | 'aws_ses' | 'slack' | 'whatsapp' | 'custom'

export interface Integration {
  id:              string
  provider:        IntegrationProvider
  name?:           string
  credentials:     Record<string, any>
  config:          Record<string, any>
  isActive:        boolean
  lastTestedAt?:   string
  lastTestStatus?: string
  createdAt:       string
  updatedAt:       string
}

export const getIntegrations = () =>
  api.get(BASE).then(unwrap) as Promise<Integration[]>

export const getIntegration = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<Integration>

export const upsertIntegration = (dto: {
  provider:     IntegrationProvider
  name?:        string
  credentials:  Record<string, any>
  config?:      Record<string, any>
  isActive?:    boolean
}) => api.post(BASE, dto).then(unwrap) as Promise<Integration>

export const activateIntegration   = (id: string) =>
  api.patch(`${BASE}/${id}/activar`).then(unwrap) as Promise<Integration>

export const deactivateIntegration = (id: string) =>
  api.patch(`${BASE}/${id}/desactivar`).then(unwrap) as Promise<Integration>

export const testIntegration = (id: string) =>
  api.post(`${BASE}/${id}/probar`).then(unwrap) as Promise<{ success: boolean; message: string }>

// ─── Integraciones Contables (cierre mensual) ─────────────────────────────────

export type IntegrationType = 'banco' | 'cxc' | 'cxp' | 'inventario' | 'activo_fijo' | 'resultado' | 'generico'

export interface AccountIntegracion {
  id:              string
  code:            string
  name:            string
  balanceType:     string
  balance:         number
  totalDebit:      number
  totalCredit:     number
  integrationType: IntegrationType
}

export interface CierreResult {
  mes:      number
  anio:     number
  firstDay: string
  lastDay:  string
  accounts: AccountIntegracion[]
}

export interface LineaPoliza {
  fecha:        string
  codigoPoliza: string
  descripcion:  string
  glosa:        string
  debe:         number
  haber:        number
}

export interface MesHistorial {
  mes:        string
  totalDebe:  number
  totalHaber: number
}

export interface BancoEspecifico {
  bankAccount: {
    id: string; name: string; bankName: string; accountNumber: string
    currency: string; currentBalance: number
  }
  transactions: Array<{
    date: string; description: string; reference: string; type: string
    amount: number; runningBalance: number
  }>
  reconciliation: {
    id: string; year: number; month: number; status: string
    saldoBanco: number; saldoSistema: number; diferencia: number; notes: string
  } | null
}

export interface CxcEspecifico {
  asOf:     string
  partidas: Array<{ nombre: string; numero: string; fecha: string; vencimiento: string; total: number; saldo: number }>
  total:    number
}

export interface CxpEspecifico {
  asOf:     string
  partidas: Array<{ nombre: string; numero: string; fecha: string; vencimiento: string; total: number; saldo: number }>
  total:    number
}

export interface InventarioEspecifico {
  asOf:       string
  articulos:  Array<{ sku: string; name: string; stock: number; costoPromedio: number; valorTotal: number }>
  totalValor: number
}

export interface ActivoFijoEspecifico {
  activos: Array<{
    codigo: string; name: string; fechaAdquisicion: string
    costoOriginal: number; depAcumulada: number; valorLibros: number; status: string
  }>
  totalValorLibros: number
}

export interface DetalleResult {
  cuenta:          { id: string; code: string; name: string; balanceType: string }
  integrationType: IntegrationType
  mes:             number
  anio:            number
  firstDay:        string
  lastDay:         string
  saldoFinal:      number
  monthlyHistory:  MesHistorial[]
  lineas:          LineaPoliza[]
  especifico:      BancoEspecifico | CxcEspecifico | CxpEspecifico | InventarioEspecifico | ActivoFijoEspecifico | null
}

export const getCierreIntegraciones = (mes: number, anio: number) =>
  api.get('/reportes/integraciones/cierre', { params: { mes, anio } }).then(unwrap) as Promise<CierreResult>

export const getDetalleIntegracion = (accountId: string, mes: number, anio: number) =>
  api.get('/reportes/integraciones/detalle', { params: { accountId, mes, anio } }).then(unwrap) as Promise<DetalleResult>
