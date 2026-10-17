import JsBarcode from 'jsbarcode'

/**
 * Etiquetas de artículo para pegar en el producto.
 *
 * La carga masiva guarda el CÓDIGO; la imagen del código de barras se genera
 * al imprimir y no se guarda. Es lo correcto por dos razones: un código que
 * cambia no deja una imagen vieja pegada en la base de datos, y con 1,584
 * artículos guardar una imagen por cada uno engorda la tabla sin necesidad.
 *
 * Antes se usaba QR en vez de código de barras real porque el código que se
 * generaba era literalmente el SKU, y buena parte de la nomenclatura real
 * lleva Ñ, tildes o espacios — algo que un código de barras (Code128/EAN) no
 * puede codificar, pero un QR sí. El lector de código de barras del cliente
 * no leía esas etiquetas.
 *
 * El código ahora es un EAN-13 interno generado por secuencia (prefijo 200,
 * el rango que el estándar GS1 reserva para uso interno), independiente del
 * SKU — nunca tiene ese problema. Con eso ya se puede imprimir un código de
 * barras real.
 */

export interface ArticuloParaEtiqueta {
  id:          string
  sku:         string
  name:        string
  salesPrice?: number
  barCodes?:   string[]
  stockOnHand?: number
}

export interface Etiqueta {
  articuloId: string
  nombre:     string
  codigo:     string
  precio:     string
}

export interface FormatoEtiqueta {
  id:          string
  label:       string
  description: string
  /** Tamaño de página para @page */
  pageSize:    string
  /** Cuántas etiquetas entran en una hoja */
  porHoja:     number
  columnas:    number
  /** Medidas de la etiqueta, en milímetros */
  anchoMm:     number
  altoMm:      number
  /** Alto del código de barras, en milímetros (el ancho se ajusta solo) */
  codigoAltoMm: number
}

export const FORMATOS_ETIQUETA: FormatoEtiqueta[] = [
  {
    id: 'hoja-24', label: 'Hoja adhesiva — 24 por página',
    description: 'Carta, 3 columnas × 8 filas. Etiqueta de 63.5 × 33.9 mm',
    pageSize: '8.5in 11in', porHoja: 24, columnas: 3,
    anchoMm: 63.5, altoMm: 33.9, codigoAltoMm: 12,
  },
  {
    id: 'hoja-30', label: 'Hoja adhesiva — 30 por página',
    description: 'Carta, 3 columnas × 10 filas. Etiqueta de 66 × 25.4 mm',
    pageSize: '8.5in 11in', porHoja: 30, columnas: 3,
    anchoMm: 66, altoMm: 25.4, codigoAltoMm: 10,
  },
  {
    id: 'termica-50x25', label: 'Térmica — 50 × 25 mm',
    description: 'Una etiqueta por impresión. Impresora de rollo',
    pageSize: '50mm 25mm', porHoja: 1, columnas: 1,
    anchoMm: 50, altoMm: 25, codigoAltoMm: 11,
  },
  {
    id: 'termica-40x30', label: 'Térmica — 40 × 30 mm',
    description: 'Una etiqueta por impresión. Más alta, cabe nombre de dos líneas',
    pageSize: '40mm 30mm', porHoja: 1, columnas: 1,
    anchoMm: 40, altoMm: 30, codigoAltoMm: 10,
  },
]

/** El nombre que cabe en una etiqueta pequeña sin desbordarse. */
const LARGO_MAXIMO_NOMBRE = 42

/**
 * El código que se imprime: el del artículo, y si no tiene, su SKU.
 *
 * Un artículo sin ninguno de los dos no se puede etiquetar — imprimir un QR
 * vacío daría una etiqueta que el escáner no lee y nadie se daría cuenta hasta
 * tenerla pegada en el producto.
 */
export const codigoDelArticulo = (a: ArticuloParaEtiqueta): string =>
  (a.barCodes ?? []).map(c => String(c ?? '').trim()).find(Boolean)
  ?? String(a.sku ?? '').trim()

const precioDeEtiqueta = (valor: unknown): string => {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface OpcionesDeEtiquetas {
  /** Cuántas copias de cada artículo. */
  copias?: number
  /** Una etiqueta por unidad en existencia, en vez de un número fijo. */
  porExistencia?: boolean
  /**
   * Solo los que necesitan etiqueta de Lucía. El artículo que trae el EAN-13
   * del fabricante ya viene etiquetado de fábrica: pegarle otra le deja DOS
   * códigos y la cajera escanea el que esté más a mano.
   */
  soloSinCodigoPropio?: boolean
}

/**
 * ¿El código es el interno de Lucía o uno propio del fabricante?
 *
 * Dos formas de reconocer el interno: el código es literalmente el SKU (la
 * forma vieja, antes de generar EAN-13, que puede seguir apareciendo en
 * artículos que no se han regenerado) o es un EAN-13 con prefijo 200 — el
 * rango que GS1 reserva para uso interno, que un código real de fabricante
 * nunca tiene.
 */
const esCodigoInterno = (a: ArticuloParaEtiqueta): boolean => {
  const codigo = codigoDelArticulo(a)
  if (!codigo) return true
  return codigo.toUpperCase() === String(a.sku ?? '').trim().toUpperCase()
    || /^200\d{10}$/.test(codigo)
}

/** Arma la lista de etiquetas a imprimir a partir de los artículos. */
export function etiquetasDeArticulos(
  articulos: ArticuloParaEtiqueta[],
  opciones: OpcionesDeEtiquetas = {},
): Etiqueta[] {
  const etiquetas: Etiqueta[] = []

  for (const a of articulos) {
    const codigo = codigoDelArticulo(a)
    if (!codigo) continue
    if (opciones.soloSinCodigoPropio && !esCodigoInterno(a)) continue

    const cuantas = opciones.porExistencia
      ? Math.max(0, Math.floor(Number(a.stockOnHand) || 0))
      : Math.max(1, Math.floor(Number(opciones.copias) || 1))

    const nombre = String(a.name ?? '').trim().slice(0, LARGO_MAXIMO_NOMBRE)
    const precio = precioDeEtiqueta(a.salesPrice)

    for (let i = 0; i < cuantas; i++) {
      etiquetas.push({ articuloId: a.id, nombre, codigo, precio })
    }
  }
  return etiquetas
}

/**
 * El código de barras, como imagen lista para pintar.
 *
 * EAN-13 cuando el código son 13 dígitos (el interno de Lucía, o un EAN de
 * fabricante) — jsbarcode valida su propio dígito verificador. Code128 para
 * cualquier otra cosa (un código de fabricante que no sea EAN-13, o un SKU
 * viejo sin regenerar): soporta texto arbitrario, aunque no Ñ/tildes/espacios
 * — si falla, se devuelve vacío en vez de romper toda la hoja.
 */
export function generarCodigoBarras(codigo: string): string {
  const limpio = String(codigo ?? '').trim()
  if (!limpio) return ''
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, limpio, {
      format: /^\d{13}$/.test(limpio) ? 'EAN13' : 'CODE128',
      width: 2.2,
      height: 70,
      displayValue: true,
      fontSize: 16,
      margin: 6,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

/** Los códigos de barras de una lista de etiquetas, sin repetir el trabajo por código igual. */
export function generarCodigosBarras(etiquetas: Etiqueta[]): Map<string, string> {
  const porCodigo = new Map<string, string>()
  for (const codigo of new Set(etiquetas.map(e => e.codigo))) {
    porCodigo.set(codigo, generarCodigoBarras(codigo))
  }
  return porCodigo
}
