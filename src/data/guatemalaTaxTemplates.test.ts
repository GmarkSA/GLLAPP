import { describe, it, expect } from 'vitest'
import { GT_TEMPLATES, type TaxTemplateItem } from './guatemalaTaxTemplates'

/**
 * A qué fila del formulario va cada impuesto.
 *
 * El 2237 del SAT tiene una fila por código: RG-C01 «Otras compras y adquisición
 * de bienes», RG-C05 «Compras de activos fijos», y así. La fila se llena sola a
 * partir de la columna del libro que lleva el impuesto de cada línea, de modo que
 * si dos códigos comparten columna sus dos filas dejan de distinguirse.
 *
 * Eso pasaba: RG-C05 apuntaba a «bienes» igual que RG-C01, así que la compra de
 * un activo fijo se declaraba como compra corriente y la fila de activos fijos
 * salía siempre en cero, aunque el sistema tuviera la categoría y el libro la
 * columna.
 *
 * Esta tabla es la misma correspondencia que el backend usa para repartir. Si se
 * toca una de las dos sin la otra, la declaración deja de cuadrar con el libro.
 */
const COLUMNA_ESPERADA: Record<string, string> = {
  // Compras — régimen general
  'RG-C01': 'bienes',                 // Otras compras y adquisición de bienes
  'RG-C02': 'servicios',              // Servicios adquiridos
  'RG-C03': 'importacion',            // Importaciones de Centroamérica y del resto del mundo
  'RG-C04': 'exento',                 // Compras que no generan derecho a crédito (Art. 7/8)
  'RG-C05': 'activosFijos',           // Compras de activos fijos
  'RG-C06': 'pequenoContribuyente',   // Compras y servicios de pequeños contribuyentes
  'RG-C07': 'bienes',                 // Nota de crédito de compra gravada: resta de su fila
  'RG-C08': 'combustibles',           // Compras de combustibles
  // Ventas — régimen general
  'RG-V01': 'bienes',                 // Ventas gravadas (bienes)
  'RG-V02': 'servicios',              // Servicios gravados
  'RG-V03': 'exportacion',            // Exportaciones (bienes)
  'RG-V04': 'exportacion',            // Exportaciones (servicios)
  'RG-V05': 'exento',                 // Ventas exentas y servicios exentos
  'RG-V06': 'bienes',                 // Venta de activo fijo: el 2237 no le da fila propia
  'RG-V07': 'bienes',                 // Nota de crédito de venta gravada: resta de su fila
}

const regimenGeneral = GT_TEMPLATES.find(t => t.compras.some(c => c.code === 'RG-C01'))!
const porCodigo = new Map<string, TaxTemplateItem>(
  [...regimenGeneral.compras, ...regimenGeneral.ventas].map(i => [i.code, i]),
)

describe('Régimen general: a qué columna del libro va cada impuesto', () => {
  it.each(Object.entries(COLUMNA_ESPERADA))('%s va a la columna %s', (codigo, columna) => {
    const item = porCodigo.get(codigo)
    expect(item, `falta el código ${codigo} en la plantilla`).toBeTruthy()
    expect(item!.libroComprasCol ?? item!.libroVentasCol).toBe(columna)
  })

  // El fallo original: las dos filas recibían lo mismo
  it('la compra de activo fijo no comparte columna con la compra corriente', () => {
    expect(porCodigo.get('RG-C05')!.libroComprasCol)
      .not.toBe(porCodigo.get('RG-C01')!.libroComprasCol)
  })

  it('todo impuesto de compras del régimen general tiene columna asignada', () => {
    for (const item of regimenGeneral.compras) {
      expect(item.libroComprasCol, `${item.code} sin columna`).toBeTruthy()
    }
  })
})
