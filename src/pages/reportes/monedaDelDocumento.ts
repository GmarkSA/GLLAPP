/**
 * Ver cada documento en SU moneda, para poder conciliar.
 *
 * Los reportes de antigüedad muestran todo convertido a quetzales, que es la
 * moneda funcional y la única con la que los tramos se pueden sumar entre sí.
 * Pero conciliar con un cliente que factura en dólares se hace documento por
 * documento y en dólares: él no reconoce el equivalente, reconoce su factura.
 *
 * Un total agregado en dólares no resuelve eso —no se concilia contra una
 * suma—, así que lo que hace falta es poder cambiar la vista del detalle a la
 * moneda de cada documento. El dato ya viene del servidor: cada fila trae su
 * `currency`, su importe original y su equivalente.
 */

export type VistaDeMoneda = 'funcional' | 'documento'

export interface ImporteDeDocumento {
  currency?: string | null
  /** El importe en la moneda del documento. */
  original?: number | null
  /** Su equivalente en quetzales, que es lo que está en libros. */
  enQuetzales?: number | null
}

const moneda = (c?: string | null) => String(c ?? 'GTQ').toUpperCase()

export const esMonedaLocal = (c?: string | null) => moneda(c) === 'GTQ'

/** El símbolo que antecede al importe. */
export const simboloDe = (c?: string | null) =>
  esMonedaLocal(c) ? 'Q' : moneda(c)

/**
 * Qué importe mostrar y con qué símbolo.
 *
 * En la vista funcional siempre quetzales. En la vista por documento, su
 * moneda — salvo que el documento ya esté en quetzales, donde son lo mismo.
 */
export function importeAMostrar(
  doc: ImporteDeDocumento,
  vista: VistaDeMoneda,
): { valor: number; simbolo: string } {
  const enQ = Number(doc.enQuetzales ?? doc.original ?? 0)

  if (vista === 'funcional' || esMonedaLocal(doc.currency)) {
    return { valor: enQ, simbolo: 'Q' }
  }

  return {
    valor:   Number(doc.original ?? 0),
    simbolo: moneda(doc.currency),
  }
}

export const formatearImporte = (
  doc: ImporteDeDocumento,
  vista: VistaDeMoneda,
): string => {
  const { valor, simbolo } = importeAMostrar(doc, vista)
  const n = valor.toLocaleString('es-GT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  return simbolo === 'Q' ? `Q ${n}` : `${simbolo} ${n}`
}

/**
 * Si el interruptor tiene sentido en este reporte.
 *
 * Con toda la cartera en quetzales no hay nada que alternar, y un botón que no
 * cambia nada solo estorba.
 */
export const hayMonedaExtranjera = (
  documentos: Array<{ currency?: string | null }>,
): boolean => (documentos ?? []).some(d => !esMonedaLocal(d.currency))
