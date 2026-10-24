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
  /**
   * Ancho impreso del código de barras, en milímetros. Es la medida que manda:
   * de ella sale el ancho de la barra más angosta (X), que es lo que decide si
   * el lector lee. Ver EL TAMAÑO DEL SÍMBOLO, más abajo.
   */
  codigoAnchoMm: number
  /** Alto impreso de las barras, en milímetros. */
  codigoBarrasMm: number
}

/**
 * EL TAMAÑO DEL SÍMBOLO — por qué el lector fallaba una etiqueta sí y otra no.
 *
 * GS1 define el EAN-13 al 100%: la barra más angosta (X) mide 0.33 mm, el
 * símbolo completo 113X = 37.3 mm y las barras 22.85 mm de alto. Se puede
 * imprimir entre el 80% y el 200% de esa medida; por debajo del 80% la lectura
 * se vuelve intermitente.
 *
 * Lucía imprimía por debajo. La imagen se escalaba por ALTO (10-12 mm) y el
 * ancho salía de la proporción del PNG, así que X quedaba entre 0.21 y 0.26 mm
 * (64%-80%) y las barras entre 6.6 y 8.4 mm: menos de la mitad del mínimo. Con
 * barras tan cortas el haz del lector tiene que cruzar un símbolo de 25 mm de
 * ancho dentro de una franja de 7 mm; basta inclinar un poco la pistola para
 * que el haz salga por arriba o por abajo antes de terminar de leer. De ahí
 * que una etiqueta lea y la siguiente, sostenida con otro ángulo, no.
 *
 * Y faltaba la zona de silencio derecha —los 7 módulos en blanco que el
 * estándar exige después de la última barra—: el símbolo salía de 107 módulos
 * en vez de 113. jsbarcode solo los dibuja cuando se le pasa `lastChar`.
 *
 * Ahora el tamaño se fija por ANCHO en milímetros, que es lo que determina X,
 * y el alto de las barras se declara aparte: en la etiqueta chica hay que
 * truncarlas para que quepan nombre y precio, pero truncadas a 11 mm siguen
 * siendo el doble de lo que se imprimía.
 */
const X_NOMINAL_MM = 0.33
/** El 80% de GS1: por debajo de esto el lector empieza a fallar. */
export const X_MINIMO_MM = X_NOMINAL_MM * 0.8
/** Alto de las barras del EAN-13 al 100%. */
const ALTO_BARRAS_NOMINAL_MM = 22.85

/**
 * Píxeles por módulo del PNG que se genera. No es una medida física —el tamaño
 * impreso lo pone el CSS en milímetros—, solo resolución: a 5 px por módulo y
 * X ≈ 0.28 mm la imagen sale a ~450 ppp, nítida tanto en la térmica de rollo
 * (203 ppp) como en la láser (600 ppp).
 */
const PX_POR_MODULO = 5
/** Alto del texto legible bajo las barras, en módulos. */
const TEXTO_MODULOS = 8
/** Separación entre las barras y el texto, en módulos. */
const TEXTO_MARGEN_MODULOS = 1

export const FORMATOS_ETIQUETA: FormatoEtiqueta[] = [
  {
    id: 'hoja-24', label: 'Hoja adhesiva — 24 por página',
    description: 'Carta, 3 columnas × 8 filas. Etiqueta de 63.5 × 33.9 mm. La que mejor lee',
    pageSize: '8.5in 11in', porHoja: 24, columnas: 3,
    anchoMm: 63.5, altoMm: 33.9, codigoAnchoMm: 32, codigoBarrasMm: 16,
  },
  {
    id: 'hoja-30', label: 'Hoja adhesiva — 30 por página',
    description: 'Carta, 3 columnas × 10 filas. Etiqueta de 66 × 25.4 mm. Barras truncadas',
    pageSize: '8.5in 11in', porHoja: 30, columnas: 3,
    anchoMm: 66, altoMm: 25.4, codigoAnchoMm: 32, codigoBarrasMm: 11,
  },
  {
    id: 'termica-50x25', label: 'Térmica — 50 × 25 mm',
    description: 'Una etiqueta por impresión. Impresora de rollo. Barras truncadas',
    pageSize: '50mm 25mm', porHoja: 1, columnas: 1,
    anchoMm: 50, altoMm: 25, codigoAnchoMm: 32, codigoBarrasMm: 11,
  },
  {
    id: 'termica-40x30', label: 'Térmica — 40 × 30 mm',
    description: 'Una etiqueta por impresión. Más alta: barras más largas, mejor lectura',
    pageSize: '40mm 30mm', porHoja: 1, columnas: 1,
    anchoMm: 40, altoMm: 30, codigoAnchoMm: 34, codigoBarrasMm: 14,
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

/** Zona de silencio del Code128: 10 módulos en blanco de cada lado. */
const SILENCIO_CODE128_MODULOS = 10

const esEan13 = (codigo: string) => /^\d{13}$/.test(codigo)

/**
 * Las opciones con las que se dibuja el símbolo.
 *
 * En EAN-13 las zonas de silencio vienen en módulos, dentro del propio
 * símbolo: los 12 del bloque donde va el dígito guía a la izquierda, y los 7
 * que agrega `lastChar` a la derecha. Sin `lastChar` jsbarcode no dibuja la
 * derecha y el símbolo sale de 107 módulos en vez de 113, con el texto de la
 * etiqueta pegado a la última barra.
 *
 * El Code128 no las trae: hay que ponerlas con el margen. Como el margen de
 * jsbarcode se mide en píxeles, se da en múltiplos del módulo para que escale
 * igual que el resto del símbolo. Solo a los lados —arriba y abajo en cero—,
 * porque un margen vertical descuadraría la proporción con la que se calcula
 * el alto de las barras.
 */
const opcionesDe = (codigo: string, barrasModulos: number) => {
  const silencio = esEan13(codigo) ? 0 : SILENCIO_CODE128_MODULOS * PX_POR_MODULO
  return {
    format: esEan13(codigo) ? ('EAN13' as const) : ('CODE128' as const),
    width:        PX_POR_MODULO,
    height:       Math.round(barrasModulos * PX_POR_MODULO),
    displayValue: true,
    fontSize:     TEXTO_MODULOS * PX_POR_MODULO,
    textMargin:   TEXTO_MARGEN_MODULOS * PX_POR_MODULO,
    margin:       0,
    marginTop:    0,
    marginBottom: 0,
    marginLeft:   silencio,
    marginRight:  silencio,
    lastChar:     ' ',
  }
}

/**
 * Cuántos módulos de ancho ocupa el símbolo, zonas de silencio incluidas.
 *
 * Se le pregunta a jsbarcode en vez de calcularlo: un EAN-13 siempre da 114
 * (12 de silencio izquierdo + 95 del símbolo + 7 de silencio derecho), pero un
 * Code128 depende de cuántos caracteres tenga el código, y de eso depende el
 * ancho de barra que sale al imprimirlo.
 */
export function modulosDelCodigo(codigo: string): number {
  const limpio = String(codigo ?? '').trim()
  if (!limpio) return 0
  try {
    const medido: any = {}
    JsBarcode(medido, limpio, opcionesDe(limpio, 1))
    const delSimbolo = (medido.encodings ?? []).reduce(
      (s: number, e: any) => s + String(e.data ?? '').length, 0)
    if (!delSimbolo) return 0
    // El margen del Code128 no sale en las encodings, pero sí ocupa ancho en
    // la imagen: contarlo es lo que hace que X salga bien.
    return delSimbolo + (esEan13(limpio) ? 0 : 2 * SILENCIO_CODE128_MODULOS)
  } catch {
    return 0
  }
}

export interface GeometriaImpresa {
  /** Módulos de ancho del símbolo, zonas de silencio incluidas. */
  modulos: number
  /** Ancho impreso del símbolo completo, en mm. */
  anchoMm: number
  /** Alto impreso del símbolo completo —barras más texto—, en mm. */
  altoMm: number
  /** Ancho de la barra más angosta, en mm. Es la medida que decide la lectura. */
  xMm: number
  /** Alto impreso de las barras, en mm. */
  altoBarrasMm: number
  /** Qué tan grande sale respecto al EAN-13 nominal. GS1 pide entre 0.8 y 2. */
  magnificacion: number
}

/**
 * Qué va a medir el código, impreso, en este formato de etiqueta.
 *
 * Un Code128 largo no cabe en el ancho del formato a la misma escala que un
 * EAN-13: en ese caso se encoge para no desbordar la etiqueta, y la
 * magnificación que devuelve avisa que ese código va a leer peor.
 */
export function geometriaDelCodigo(codigo: string, formato: FormatoEtiqueta): GeometriaImpresa {
  const modulos = modulosDelCodigo(codigo)
  if (!modulos) {
    return { modulos: 0, anchoMm: 0, altoMm: 0, xMm: 0, altoBarrasMm: 0, magnificacion: 0 }
  }

  const anchoMm = Math.min(formato.codigoAnchoMm, formato.anchoMm - 4)
  const xMm     = anchoMm / modulos
  const altoBarrasMm = formato.codigoBarrasMm
  const altoMm  = altoBarrasMm + (TEXTO_MODULOS + TEXTO_MARGEN_MODULOS) * xMm

  return { modulos, anchoMm, altoMm, xMm, altoBarrasMm, magnificacion: xMm / X_NOMINAL_MM }
}

/**
 * El código de barras, como imagen lista para pintar.
 *
 * EAN-13 cuando el código son 13 dígitos (el interno de Lucía, o un EAN de
 * fabricante) — jsbarcode valida su propio dígito verificador. Code128 para
 * cualquier otra cosa (un código de fabricante que no sea EAN-13, o un SKU
 * viejo sin regenerar): soporta texto arbitrario, aunque no Ñ/tildes/espacios
 * — si falla, se devuelve vacío en vez de romper toda la hoja.
 *
 * El PNG se genera con la proporción exacta que va a tener impreso: el CSS le
 * fija el ANCHO en milímetros y el alto sale solo. Escalarlo por alto era lo
 * que dejaba las barras por debajo del mínimo.
 */
export function generarCodigoBarras(codigo: string, formato?: FormatoEtiqueta): string {
  const limpio = String(codigo ?? '').trim()
  if (!limpio) return ''
  try {
    // Sin formato —una vista previa suelta— se dibuja a la proporción nominal
    // del EAN-13: barras de 22.85 mm sobre un módulo de 0.33 mm.
    const barrasModulos = formato
      ? formato.codigoBarrasMm / geometriaDelCodigo(limpio, formato).xMm
      : ALTO_BARRAS_NOMINAL_MM / X_NOMINAL_MM

    const canvas = document.createElement('canvas')
    JsBarcode(canvas, limpio, opcionesDe(limpio, barrasModulos))
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

/** Los códigos de barras de una lista de etiquetas, sin repetir el trabajo por código igual. */
export function generarCodigosBarras(
  etiquetas: Etiqueta[],
  formato?: FormatoEtiqueta,
): Map<string, string> {
  const porCodigo = new Map<string, string>()
  for (const codigo of new Set(etiquetas.map(e => e.codigo))) {
    porCodigo.set(codigo, generarCodigoBarras(codigo, formato))
  }
  return porCodigo
}
