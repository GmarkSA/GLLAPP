import type { ColumnaDePlantilla, EspecificacionDeCarga } from './plantillaCarga'

/**
 * Los documentos pendientes con que un cliente o un proveedor arranca en Lucía.
 *
 * Una sola cifra por contacto no alcanza cuando la cartera está en dólares:
 * cada factura vieja se registró al tipo de cambio de SU día, y la deuda en
 * quetzales es la suma de cada documento a su propia tasa. Promediarlas daría
 * un número que no coincide con ninguna factura y que nadie puede explicar
 * después.
 *
 * Y hay una segunda razón, que vale también en quetzales: un saldo suelto no
 * tiene fecha de vencimiento, así que el reporte de antigüedad no puede
 * clasificarlo. Documento por documento, la cartera migrada envejece igual que
 * la que nace en Lucía.
 *
 * La hoja va junto a la de contactos, en el mismo archivo: se llena solo si
 * hace falta, y el contacto puede traer su `saldo_inicial` suelto cuando es una
 * cifra única en quetzales.
 */

export const COLUMNAS_SALDOS: ColumnaDePlantilla[] = [
  { clave: 'nit', titulo: 'nit', requerida: true, pestana: 'Saldos pendientes',
    ayuda: 'NIT del contacto, el mismo de la otra hoja. Es lo que une el documento con su cliente o proveedor.',
    alias: ['NIT', 'NIT / CUI', 'Tax ID', 'Identificación'] },
  { clave: 'documento', titulo: 'documento', requerida: false, pestana: 'Saldos pendientes',
    ayuda: 'Número de la factura o documento. Sirve para reconocerlo al cobrarlo o pagarlo.',
    alias: ['Documento', 'No. Documento', 'Factura', 'Número de factura', 'Invoice Number'] },
  { clave: 'fecha', titulo: 'fecha', requerida: false, tipo: 'fecha', pestana: 'Saldos pendientes',
    ayuda: 'Fecha del documento. Vacío = la fecha de migración de la empresa.',
    alias: ['Fecha', 'Fecha de factura', 'Invoice Date'] },
  { clave: 'vencimiento', titulo: 'vencimiento', requerida: false, tipo: 'fecha',
    pestana: 'Saldos pendientes',
    ayuda: 'Fecha de vencimiento. De ella sale la antigüedad del saldo en los reportes.',
    alias: ['Vencimiento', 'Fecha de vencimiento', 'Due Date'] },
  { clave: 'monto', titulo: 'monto', requerida: true, tipo: 'moneda', pestana: 'Saldos pendientes',
    ayuda: 'Saldo pendiente del documento, EN SU MONEDA. No el total de la factura: lo que falta cobrar o pagar.',
    alias: ['Monto', 'Saldo', 'Saldo pendiente', 'Balance', 'Pendiente'] },
  { clave: 'moneda', titulo: 'moneda', requerida: false, pestana: 'Saldos pendientes',
    ayuda: 'Moneda del documento. GTQ por omisión.',
    alias: ['Moneda', 'Currency'] },
  { clave: 'tipo_cambio', titulo: 'tipo_cambio', requerida: false, tipo: 'numero',
    pestana: 'Saldos pendientes',
    ayuda: 'El tipo de cambio CON EL QUE SE REGISTRÓ ESE DOCUMENTO, no el de hoy. OBLIGATORIO si la moneda no es GTQ: sin él el saldo no se carga, porque anotarlo a 1 × 1 metería la cartera al balance por una séptima parte de su valor.',
    alias: ['Tipo de cambio', 'TC', 'Exchange Rate', 'Tasa'] },
]

export const ESPECIFICACION_SALDOS: EspecificacionDeCarga = {
  hoja: 'Saldos pendientes',
  columnas: COLUMNAS_SALDOS,
}

/**
 * El ejemplo son dos filas del MISMO contacto a tasas distintas: es justo el
 * caso que una cifra única no puede representar, y la razón de que esta hoja
 * exista.
 */
export const ejemplosDeSaldos = (nit: string): Array<Record<string, unknown>> => [
  {
    nit, documento: 'FAC-00120', fecha: '15/11/2025', vencimiento: '15/12/2025',
    monto: 2500, moneda: 'USD', tipo_cambio: 7.712340,
  },
  {
    nit, documento: 'FAC-00135', fecha: '03/12/2025', vencimiento: '02/01/2026',
    monto: 1800, moneda: 'USD', tipo_cambio: 7.668900,
  },
  {
    nit, documento: 'FAC-00141', fecha: '20/12/2025', vencimiento: '19/01/2026',
    monto: 4300, moneda: 'GTQ', tipo_cambio: '',
  },
]
