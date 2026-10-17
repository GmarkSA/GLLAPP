import QRCode from 'qrcode'

/**
 * Etiquetas de artículo para pegar en el producto.
 *
 * La carga masiva guarda el CÓDIGO; la imagen del QR se genera al imprimir y no
 * se guarda. Es lo correcto por dos razones: un código que cambia no deja una
 * imagen vieja pegada en la base de datos, y con 1,584 artículos guardar una
 * imagen por cada uno engorda la tabla sin necesidad.
 *
 * Se usa QR y no Code 128 porque 75 de los SKUs de la librería llevan Ñ, tildes
 * o espacios: Code 128 no los maneja bien y QR sí. El escáner del cliente
 * (Symcode MJ-1400CA) lee QR, ya verificado.
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
  /** Lado del QR, en milímetros */
  qrMm:        number
}

export const FORMATOS_ETIQUETA: FormatoEtiqueta[] = [
  {
    id: 'hoja-24', label: 'Hoja adhesiva — 24 por página',
    description: 'Carta, 3 columnas × 8 filas. Etiqueta de 63.5 × 33.9 mm',
    pageSize: '8.5in 11in', porHoja: 24, columnas: 3,
    anchoMm: 63.5, altoMm: 33.9, qrMm: 22,
  },
  {
    id: 'hoja-30', label: 'Hoja adhesiva — 30 por página',
    description: 'Carta, 3 columnas × 10 filas. Etiqueta de 66 × 25.4 mm',
    pageSize: '8.5in 11in', porHoja: 30, columnas: 3,
    anchoMm: 66, altoMm: 25.4, qrMm: 18,
  },
  {
    id: 'termica-50x25', label: 'Térmica — 50 × 25 mm',
    description: 'Una etiqueta por impresión. Impresora de rollo',
    pageSize: '50mm 25mm', porHoja: 1, columnas: 1,
    anchoMm: 50, altoMm: 25, qrMm: 17,
  },
  {
    id: 'termica-40x30', label: 'Térmica — 40 × 30 mm',
    description: 'Una etiqueta por impresión. Más alta, cabe nombre de dos líneas',
    pageSize: '40mm 30mm', porHoja: 1, columnas: 1,
    anchoMm: 40, altoMm: 30, qrMm: 16,
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

/** ¿El código es el interno de Lucía (el SKU) o uno propio del fabricante? */
const esCodigoInterno = (a: ArticuloParaEtiqueta): boolean => {
  const codigo = codigoDelArticulo(a)
  return !codigo || codigo.toUpperCase() === String(a.sku ?? '').trim().toUpperCase()
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
 * El QR del código, como imagen lista para pintar.
 *
 * Corrección de errores media (M): la etiqueta va pegada a un producto que se
 * manosea, y con baja (L) un rayón deja el código ilegible.
 */
export async function generarQR(codigo: string): Promise<string> {
  const limpio = String(codigo ?? '').trim()
  if (!limpio) return ''
  return QRCode.toDataURL(limpio, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  }).catch(() => '')
}

/** Los QR de una lista de etiquetas, sin repetir el trabajo por código igual. */
export async function generarQRs(etiquetas: Etiqueta[]): Promise<Map<string, string>> {
  const porCodigo = new Map<string, string>()
  for (const codigo of new Set(etiquetas.map(e => e.codigo))) {
    porCodigo.set(codigo, await generarQR(codigo))
  }
  return porCodigo
}
