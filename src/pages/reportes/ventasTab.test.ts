import { describe, it, expect } from 'vitest'
import { etiquetaDeFila } from './VentasTab'
import { etiquetaDeTipo } from './KardexCompletoTab'

/**
 * Cómo se lee cada fila de los reportes nuevos.
 *
 * Las fechas se formatean con dayjs y no con `new Date`: el navegador parsea
 * «2026-01-10» como medianoche UTC y en Guatemala —UTC-6— eso muestra el día
 * anterior. Una venta del 1 de enero aparecería como 31 de diciembre, en el
 * mes equivocado.
 */
describe('la primera columna del reporte de ventas', () => {
  it('por cliente, el nombre', () => {
    expect(etiquetaDeFila(
      { nombre: 'LUUM, S.A.', cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 },
      'cliente')).toBe('LUUM, S.A.')
  })

  it('por artículo, el nombre del artículo', () => {
    expect(etiquetaDeFila(
      { nombre: 'Café molido 1 lb', sku: 'SKU-001',
        cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 },
      'articulo')).toBe('Café molido 1 lb')
  })

  /** El caso que el huso horario rompería. */
  it('por día, la fecha no retrocede', () => {
    expect(etiquetaDeFila(
      { fecha: '2026-01-01', cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 },
      'dia')).toBe('01/01/2026')
  })

  it('por mes, el nombre del mes y el año', () => {
    expect(etiquetaDeFila(
      { mes: '2026-01', cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 },
      'mes')).toBe('Enero 2026')

    expect(etiquetaDeFila(
      { mes: '2026-12', cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 },
      'mes')).toBe('Diciembre 2026')
  })

  it('una fila sin dato no rompe la tabla', () => {
    const vacia = { cantidad: 0, base: 0, impuesto: 0, total: 0, documentos: 0 }
    expect(etiquetaDeFila(vacia, 'cliente')).toBe('—')
    expect(etiquetaDeFila(vacia, 'dia')).toBe('—')
    expect(etiquetaDeFila(vacia, 'mes')).toBe('—')
  })
})

/**
 * Los tipos vienen del módulo de inventario con su convención: entrada_* suma,
 * salida_* resta.
 */
describe('cómo se nombra cada movimiento del kardex', () => {
  it('traduce los tipos conocidos', () => {
    expect(etiquetaDeTipo('entrada_compra').label).toBe('Compra')
    expect(etiquetaDeTipo('salida_venta').label).toBe('Venta')
    expect(etiquetaDeTipo('ajuste').label).toBe('Ajuste')
  })

  /** Un tipo nuevo se muestra tal cual, no tras una etiqueta genérica. */
  it('un tipo desconocido se muestra tal cual', () => {
    expect(etiquetaDeTipo('entrada_donacion').label).toBe('entrada_donacion')
  })

  it('las entradas en verde y las salidas en rojo', () => {
    expect(etiquetaDeTipo('entrada_compra').color).toBe('#2ea172')
    expect(etiquetaDeTipo('salida_venta').color).toBe('#e5484d')
  })
})
