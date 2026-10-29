import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface AjusteMonedaLinea {
  accountId:         string
  accountCode:       string
  accountName:       string
  vendorId:          string | null
  vendorName:        string | null
  customerId:        string | null
  customerName:      string | null
  invoiceId:         string | null
  invoiceNumber:     string | null
  saldoUSD:          number
  saldoGTQ:          number
  tcHistorico:       number
  saldoRevaluado:    number
  gananciasPerdidas: number
  /**
   * El valor en libros de esta fila no es de fiar: sus pólizas se registraron
   * con tipo de cambio 1, así que la «ganancia» que sale es la diferencia
   * contra un saldo mal anotado, no una diferencia cambiaria. El backend se
   * niega a publicar el ajuste mientras haya una fila así.
   */
  sinConvertir?:     boolean
}

export interface AjusteMoneda {
  id:                string
  companyId:         string
  moneda:            string
  fechaAjuste:       string
  tipoCambio:        number
  notas:             string
  status:            string
  gananciasPerdidas: number
  journalEntryId?:   string
  fxAccountId?:      string
  createdAt:         string
  lines?:            AjusteMonedaLinea[]
}

/**
 * Las cuentas donde cae el diferencial cambiario, según Cuentas por defecto.
 *
 * La vista previa escribía «Ganancia diferencial cambiario» a secas, sin
 * código ni nombre: la pantalla no sabe cuáles son porque se resuelven en el
 * servidor al publicar, y el usuario veía una póliza distinta de la que se iba
 * a contabilizar.
 */
export interface CuentasDeDiferencial {
  ganancia: { code: string; name: string } | null
  perdida:  { code: string; name: string } | null
}

export const getCuentasDeDiferencial = () =>
  api.get('/contabilidad/ajuste-moneda/cuentas-diferencial')
    .then(unwrap) as Promise<CuentasDeDiferencial>

export const getAjustesMoneda = () =>
  api.get('/contabilidad/ajuste-moneda').then(unwrap) as Promise<AjusteMoneda[]>

export const previewAjusteMoneda = (dto: {
  moneda: string
  fechaAjuste: string
  tipoCambio: number
}) =>
  api.post('/contabilidad/ajuste-moneda/preview', dto).then(unwrap) as Promise<AjusteMonedaLinea[]>

export const createAjusteMoneda = (dto: {
  moneda: string
  fechaAjuste: string
  tipoCambio: number
  notas?: string
}) =>
  api.post('/contabilidad/ajuste-moneda', dto).then(unwrap) as Promise<AjusteMoneda>

export const getAjusteMoneda = (id: string) =>
  api.get(`/contabilidad/ajuste-moneda/${id}`).then(unwrap) as Promise<AjusteMoneda>

export const deleteAjusteMoneda = (id: string) =>
  api.delete(`/contabilidad/ajuste-moneda/${id}`)
