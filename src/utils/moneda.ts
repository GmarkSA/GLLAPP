/**
 * Cómo se muestra el dinero en una empresa que maneja dos monedas.
 *
 * La regla, una sola para todo el sistema:
 *
 *   - Si el documento está en la moneda local, se muestra UNA cifra: Q 1,234.56.
 *   - Si está en otra moneda, se muestran TRES datos: el monto en su moneda,
 *     el tipo de cambio con el que se registró, y el equivalente en quetzales.
 *
 * Nunca el número de una moneda con el signo de la otra. Esa confusión costó
 * caro: una cartera de USD 3,264.78 se leía como «Q 3,264.78» cuando la deuda
 * real era Q 25,036.34 — una séptima parte—, y lo mismo pasaba con los
 * anticipos, las notas de crédito y el saldo de cada proveedor.
 *
 * El equivalente sale SIEMPRE de la tasa del propio documento, la del día en
 * que se registró, nunca la de hoy: es lo que hace que la cartera cuadre
 * contra el mayor.
 */

/** Un documento sin moneda es local: es el caso de casi todo lo que hay. */
export const esLocal = (moneda?: string | null): boolean =>
  !moneda || String(moneda).trim().toUpperCase() === 'GTQ'

/** Quetzales, con centavos — nunca milésimas. */
export const fmtQ = (n: unknown): string =>
  `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** El monto en la moneda del documento: «USD 3,057.51» o «Q 280.00». */
export const fmtMoneda = (n: unknown, moneda?: string | null): string =>
  esLocal(moneda)
    ? fmtQ(n)
    : `${String(moneda).trim().toUpperCase()} ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Lo mínimo que hace falta saber de un documento para valuarlo. */
export interface DocumentoConMoneda {
  currency?:     string | null
  exchangeRate?: number | null
}

/**
 * Lo que vale en quetzales, con la tasa del propio documento.
 *
 * Sin tasa no se inventa ninguna: se devuelve el monto como está. Multiplicar
 * por la del día dejaría la cartera valuada a un precio que no es el de
 * ningún documento.
 */
export const enQuetzales = (n: unknown, doc?: DocumentoConMoneda | null): number => {
  const monto = Number(n ?? 0)
  if (esLocal(doc?.currency)) return monto
  return monto * (Number(doc?.exchangeRate) || 1)
}

/** El tipo de cambio como se escribe: seis decimales, o «—» si es local. */
export const fmtTasa = (doc?: DocumentoConMoneda | null): string =>
  esLocal(doc?.currency) ? '—' : Number(doc?.exchangeRate ?? 1).toFixed(6)

/** Cifras de ancho fijo: en una columna de montos es lo que deja compararlos. */
export const numeros = { fontVariantNumeric: 'tabular-nums' } as const

/**
 * En qué moneda se está cobrando o pagando.
 *
 * Un cobro se aplica a facturas, y la moneda del cobro es la de ellas: pagar
 * una factura en dólares es recibir dólares. Las dos pantallas de pagos
 * —recibidos y realizados— mandaban `currency: 'GTQ'` fijo, así que un cobro
 * de una factura en dólares quedaba guardado como quetzales con tasa 1: la
 * cifra correcta con la moneda equivocada, y cualquier reporte que leyera esa
 * moneda mentía.
 *
 * Si las facturas elegidas no coinciden en moneda no hay una sola respuesta
 * —un mismo depósito no puede ser en dos monedas a la vez—, y eso se avisa en
 * vez de elegir una por cuenta propia.
 */
export interface DocumentoACobrar extends DocumentoConMoneda {
  id: string
}

export interface MonedaDelCobro {
  moneda: string
  /** true cuando los documentos elegidos están en monedas distintas. */
  mezcla: boolean
}

export const monedaDeLosDocumentos = (
  documentos: DocumentoACobrar[],
  porOmision = 'GTQ',
): MonedaDelCobro => {
  const monedas = [...new Set(
    documentos.map(d => String(d.currency ?? 'GTQ').trim().toUpperCase()),
  )]
  if (monedas.length === 0) return { moneda: String(porOmision).toUpperCase(), mezcla: false }
  if (monedas.length === 1) return { moneda: monedas[0], mezcla: false }
  return { moneda: monedas[0], mezcla: true }
}
