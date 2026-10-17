import { describe, it, expect } from 'vitest'
import {
  FORMATOS_ETIQUETA,
  codigoDelArticulo,
  etiquetasDeArticulos,
  generarQR,
  type ArticuloParaEtiqueta,
} from './etiquetas'

/**
 * Etiquetas de artículo para pegar en el producto.
 *
 * La carga masiva guarda el CÓDIGO (el SKU, o el que traiga la columna
 * codigo_barras). La imagen del QR no se guarda: se genera al imprimir, que es
 * lo correcto —un código que cambia no deja una imagen vieja pegada en la base
 * de datos— y además mantiene el archivo del artículo liviano con 1,584 filas.
 *
 * El escáner de la librería es un Symcode MJ-1400CA y lee QR, lo que importa
 * porque 75 de sus SKUs llevan Ñ, tildes o espacios: Code 128 no los maneja
 * bien y QR sí.
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

describe('generar el QR', () => {
  it('devuelve una imagen que el navegador puede pintar', async () => {
    const img = await generarQR('ABA-GRAN')
    expect(img.startsWith('data:image/')).toBe(true)
  })

  it('funciona con Ñ y tildes, que es para lo que se eligió QR', async () => {
    const img = await generarQR('AÑE-TILDÉ')
    expect(img.startsWith('data:image/')).toBe(true)
  })

  it('un código vacío no genera imagen, en vez de una ilegible', async () => {
    await expect(generarQR('')).resolves.toBe('')
  })
})
