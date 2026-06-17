import api from './axios'

export interface SatLookupResult {
  found: boolean
  taxId?: string
  legalName?: string
  tradeName?: string
  address?: string
  city?: string
  phone?: string
  type?: 'business' | 'individual'
}

export interface SatProviderConfig {
  provider: string       // 'felplex' | 'infile' | 'otro'
  apiUrl: string
  entityId: string
  apiKey: string
  empresaId?: string     // header 'empresa' requerido por Felplex
}

export const satLookupApi = {
  lookup: (tipo: 'NIT' | 'CUI', valor: string): Promise<SatLookupResult> =>
    api.get('/contactos/sat-lookup', { params: { tipo, valor } }).then(r => r.data?.data ?? r.data),

  testConnection: (): Promise<{ ok: boolean; message: string }> =>
    api.post('/contactos/sat-lookup/test').then(r => r.data?.data ?? r.data),
}
