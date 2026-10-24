import { describe, it, expect } from 'vitest'
import {
  FORMATOS_ETIQUETA,
  codigoDelArticulo,
  etiquetasDeArticulos,
  generarCodigoBarras,
  geometriaDelCodigo,
  modulosDelCodigo,
  type ArticuloParaEtiqueta,
} from './etiquetas'

/**
 * Etiquetas de artículo para pegar en el producto.
 *
 * La carga masiva guarda el CÓDIGO (el SKU, o el que traiga la columna
 * codigo_barras). La imagen del código de barras no se guarda: se genera al
 * imprimir, que es lo correcto —un código que cambia no deja una imagen vieja
 * pegada en la base de datos— y además mantiene el archivo del artículo
 * liviano con 1,584 filas.
 *
 * El código interno ahora es un EAN-13 generado por secuencia, no el SKU —
 * antes el código de barras real (no el QR) se rompía con los SKUs que llevan
 * Ñ, tildes o espacios, porque eso no es un EAN-13/Code128 válido.
 */
const ARTICULO: ArticuloParaEtiqueta = {
  id: 'a-1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
  salesPrice: 23, barCodes: ['ABA-GRAN'],
}

describe('el código que se imprime', () => {
  it('es el código de barras del artículo', () => {
    expect(codigoDelArticulo(ARTICULO)).toBe('ABA-GRAN')
  })

  it('si el artículo no tiene código, cae en el SKU', () => {
    expect(codigoDelArticulo({ ...ARTICULO, barCodes: [] })).toBe('ABA-GRAN')
  })

  it('el código propio manda sobre el SKU', () => {
    expect(codigoDelArticulo({ ...ARTICULO, barCodes: ['7501234567890'] })).toBe('7501234567890')
  })

  it('respeta la Ñ: 75 SKUs de la librería la llevan', () => {
    expect(codigoDelArticulo({ ...ARTICULO, sku: 'AÑE', barCodes: [] })).toBe('AÑE')
  })

  it('un artículo sin SKU ni código no se puede etiquetar', () => {
    expect(codigoDelArticulo({ ...ARTICULO, sku: '', barCodes: [] })).toBe('')
  })
})

describe('armar la hoja de etiquetas', () => {
  const tres: ArticuloParaEtiqueta[] = [
    ARTICULO,
    { id: 'a-2', sku: 'ACUA-FAST', name: 'ACUARELA FAST 12 COLORES', salesPrice: 18.5, barCodes: [] },
    { id: 'a-3', sku: '', name: 'SIN CODIGO', salesPrice: 5, barCodes: [] },
  ]

  it('una etiqueta por artículo que tenga código', () => {
    const etiquetas = etiquetasDeArticulos(tres, { copias: 1 })
    expect(etiquetas).toHaveLength(2)
  })

  it('deja fuera el que no se puede etiquetar, sin reventar', () => {
    const etiquetas = etiquetasDeArticulos(tres, { copias: 1 })
    expect(etiquetas.some(e => e.nombre === 'SIN CODIGO')).toBe(false)
  })

  it('con copias, repite cada etiqueta: una por unidad en existencia', () => {
    const etiquetas = etiquetasDeArticulos([ARTICULO], { copias: 3 })
    expect(etiquetas).toHaveLength(3)
  })

  it('«una por existencia» usa el stock del artículo', () => {
    const etiquetas = etiquetasDeArticulos(
      [{ ...ARTICULO, stockOnHand: 4 }], { porExistencia: true })
    expect(etiquetas).toHaveLength(4)
  })

  it('existencia en cero no imprime etiquetas de ese artículo', () => {
    const etiquetas = etiquetasDeArticulos(
      [{ ...ARTICULO, stockOnHand: 0 }], { porExistencia: true })
    expect(etiquetas).toHaveLength(0)
  })

  it('la etiqueta lleva nombre, código y precio', () => {
    const [e] = etiquetasDeArticulos([ARTICULO], { copias: 1 })
    expect(e.nombre).toBe('ABACO BACO GRANDE')
    expect(e.codigo).toBe('ABA-GRAN')
    expect(e.precio).toBe('Q 23.00')
  })

  it('un precio sin definir no imprime «Q NaN»', () => {
    const [e] = etiquetasDeArticulos(
      [{ ...ARTICULO, salesPrice: undefined as any }], { copias: 1 })
    expect(e.precio).toBe('')
  })

  it('el nombre largo se recorta: no cabe en una etiqueta de 50 mm', () => {
    const [e] = etiquetasDeArticulos([{
      ...ARTICULO,
      name: 'HOJA LINEA DOBLE OFICIO PAQUETE DE CIEN UNIDADES MARCA GENERICA',
    }], { copias: 1 })
    expect(e.nombre.length).toBeLessThanOrEqual(42)
  })
})

describe('imprimir solo las que hacen falta', () => {
  /**
   * El artículo que trae el EAN-13 del fabricante ya viene etiquetado de
   * fábrica: imprimirle una etiqueta de Lucía le deja DOS códigos pegados, y la
   * cajera escanea el que esté más a mano. Solo necesitan etiqueta los que
   * llevan código interno —el que Lucía generó del SKU— o ninguno.
   */
  const surtido: ArticuloParaEtiqueta[] = [
    { id: '1', sku: 'ABA-GRAN', name: 'ABACO', salesPrice: 23, barCodes: ['ABA-GRAN'] },
    { id: '2', sku: 'LAP-FABER', name: 'LAPIZ', salesPrice: 5, barCodes: ['7501234567890'] },
    { id: '3', sku: 'SIN-COD', name: 'SIN CODIGO', salesPrice: 9, barCodes: [] },
  ]

  it('deja fuera el que trae código del fabricante', () => {
    const etiquetas = etiquetasDeArticulos(surtido, { copias: 1, soloSinCodigoPropio: true })
    expect(etiquetas.map(e => e.nombre)).not.toContain('LAPIZ')
  })

  it('incluye el que lleva el código interno de Lucía', () => {
    const etiquetas = etiquetasDeArticulos(surtido, { copias: 1, soloSinCodigoPropio: true })
    expect(etiquetas.map(e => e.nombre)).toContain('ABACO')
  })

  it('sin el filtro, se imprimen todos: el de SKU propio también lleva código', () => {
    const etiquetas = etiquetasDeArticulos(surtido, { copias: 1 })
    expect(etiquetas).toHaveLength(3)
  })
})

describe('los formatos de etiqueta', () => {
  it('hay uno para hoja adhesiva y uno para impresora térmica', () => {
    const ids = FORMATOS_ETIQUETA.map(f => f.id)
    expect(ids).toContain('hoja-24')
    expect(ids).toContain('termica-50x25')
  })

  it('cada formato dice cuántas etiquetas entran por hoja', () => {
    for (const f of FORMATOS_ETIQUETA) {
      expect(f.porHoja).toBeGreaterThan(0)
      expect(f.label).toBeTruthy()
    }
  })

  it('la hoja de 24 va en carta', () => {
    const hoja = FORMATOS_ETIQUETA.find(f => f.id === 'hoja-24')!
    expect(hoja.pageSize).toContain('in')
    expect(hoja.porHoja).toBe(24)
  })
})

describe('generar el código de barras', () => {
  it('devuelve una imagen que el navegador puede pintar', () => {
    const img = generarCodigoBarras('ABA-GRAN')
    expect(img.startsWith('data:image/')).toBe(true)
  })

  it('un EAN-13 de 13 dígitos (con dígito verificador válido) también genera imagen', () => {
    const img = generarCodigoBarras('2000000000015')
    expect(img.startsWith('data:image/')).toBe(true)
  })

  it('un código vacío no genera imagen, en vez de una ilegible', () => {
    expect(generarCodigoBarras('')).toBe('')
  })
})

/**
 * El tamaño del símbolo, que es lo que decide si el lector lee.
 *
 * GS1 define el EAN-13 a 100%: la barra más angosta (X) mide 0.33 mm, el
 * símbolo completo 113X = 37.3 mm y las barras 22.85 mm de alto. Se puede
 * imprimir entre el 80% y el 200%; por debajo del 80% el lector empieza a
 * fallar de forma intermitente — una etiqueta lee y la siguiente no.
 *
 * Lucía imprimía por debajo del mínimo: la imagen se escalaba por ALTO (10-12
 * mm) y el ancho salía de la proporción, así que X quedaba entre 0.21 y 0.26
 * mm y las barras entre 6.6 y 8.4 mm — menos de la mitad del mínimo. Y no se
 * imprimía la zona de silencio derecha: 107 módulos en vez de los 113 que
 * exige el estándar.
 */
describe('el tamaño del código impreso', () => {
  const EAN = '2000000000015'

  it('lleva las dos zonas de silencio: 113 módulos como pide el estándar', () => {
    expect(modulosDelCodigo(EAN)).toBeGreaterThanOrEqual(113)
  })

  it('en todos los formatos la barra más angosta llega al 80% de GS1', () => {
    for (const f of FORMATOS_ETIQUETA) {
      const g = geometriaDelCodigo(EAN, f)
      expect([f.id, g.xMm >= 0.264]).toEqual([f.id, true])
    }
  })

  it('y las barras miden al menos 11 mm, no los 7 de antes', () => {
    for (const f of FORMATOS_ETIQUETA) {
      const g = geometriaDelCodigo(EAN, f)
      expect([f.id, g.altoBarrasMm >= 11]).toEqual([f.id, true])
    }
  })

  it('el código cabe en la etiqueta, con margen para la zona de silencio', () => {
    for (const f of FORMATOS_ETIQUETA) {
      const g = geometriaDelCodigo(EAN, f)
      expect([f.id, g.anchoMm <= f.anchoMm - 3]).toEqual([f.id, true])
    }
  })

  it('el símbolo completo cabe a lo alto junto con nombre y precio', () => {
    for (const f of FORMATOS_ETIQUETA) {
      const g = geometriaDelCodigo(EAN, f)
      expect([f.id, g.altoMm <= f.altoMm - 7]).toEqual([f.id, true])
    }
  })
})
