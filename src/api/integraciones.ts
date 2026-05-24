import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data
const BASE = '/configuracion/integraciones'

export type IntegrationProvider =
  | 'fel_felplex' | 'fel_infile' | 'fel_digifact'
  | 'stripe' | 'paypal' | 'openai' | 'aws_s3'
  | 'aws_textract' | 'aws_ses' | 'slack' | 'whatsapp' | 'custom'

export interface Integration {
  id:              string
  provider:        IntegrationProvider
  name?:           string
  credentials:     Record<string, any>   // vacío en lista, lleno en findOne
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
