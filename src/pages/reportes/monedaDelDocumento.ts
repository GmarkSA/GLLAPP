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

/**
 * Un total solo puede ir en dólares si TODO lo que lo compone son dólares.
 *
 * Los tramos de antigüedad son sumas de documentos, y esos documentos pueden
 * estar en monedas distintas. Sumar dólares con quetzales y rotular el
 * resultado «USD» daría un número que no existe, y que además no cuadraría con
 * nada: ni con el cliente ni con los libros.
 *
 * Por eso la regla es por composición: si todos los documentos del grupo
 * comparten moneda, el total va en esa moneda. Si hay mezcla, el único
 * denominador común es el quetzal —la moneda funcional— y ahí se queda, aunque
 * el usuario haya pedido ver en divisa. `mixto` lo declara para que la pantalla
 * pueda decirlo en vez de dejarlo pasar.
 */
export interface DocumentoDeTotal {
  currency?: string | null
  /** El importe en la moneda del documento. */
  balance?: number | null
  /** Su equivalente en quetzales, que es lo que está en libros. */
  balanceGTQ?: number | null
}

export interface TotalDeGrupo {
  valor: number
  simbolo: string
  /** El grupo mezcla monedas, así que el total quedó en quetzales. */
  mixto: boolean
}

const redondear = (n: number) => Math.round(n * 100) / 100

export function totalEnVista(
  documentos: DocumentoDeTotal[],
  vista: VistaDeMoneda,
): TotalDeGrupo {
  const docs = documentos ?? []
  const enQuetzales = redondear(
    docs.reduce((s, d) => s + Number(d.balanceGTQ ?? d.balance ?? 0), 0))

  if (vista === 'funcional' || !docs.length) {
    return { valor: enQuetzales, simbolo: 'Q', mixto: false }
  }

  const monedas = new Set(docs.map(d => String(d.currency ?? 'GTQ').toUpperCase()))
  if (monedas.size > 1) {
    return { valor: enQuetzales, simbolo: 'Q', mixto: true }
  }

  const [unica] = [...monedas]
  if (unica === 'GTQ') return { valor: enQuetzales, simbolo: 'Q', mixto: false }

  return {
    valor:   redondear(docs.reduce((s, d) => s + Number(d.balance ?? 0), 0)),
    simbolo: unica,
    mixto:   false,
  }
}

export function formatearTotal(
  documentos: DocumentoDeTotal[],
  vista: VistaDeMoneda,
): string {
  const { valor, simbolo } = totalEnVista(documentos, vista)
  const n = valor.toLocaleString('es-GT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  return simbolo === 'Q' ? `Q ${n}` : `${simbolo} ${n}`
}
