import { describe, it, expect } from 'vitest'
import { totalDe } from './paginacion'

/**
 * El total de un listado paginado.
 *
 * El backend lo devuelve en `meta.total` —así lo arma PaginatedResult— pero
 * varias pantallas leían `res.total`, que no existe. Al quedar en cero, Ant
 * Design usa el largo de la página como total: la tabla decía «200 de 200
 * artículos» con 1,584 en la bodega, y una sola página. Facturas de proveedor
 * ya lo leía bien; de ahí sale esta función, para no repetir el acierto a mano
 * en cada módulo.
 */
describe('el total de un listado paginado', () => {
  it('lo saca de meta.total, que es donde lo pone el backend', () => {
    expect(totalDe({ data: new Array(200), meta: { total: 1584 } })).toBe(1584)
  })

  it('nunca confunde el total con el largo de la página', () => {
    const respuesta = { data: new Array(200), meta: { total: 1584 } }
    expect(totalDe(respuesta)).not.toBe(respuesta.data.length)
  })

  it('acepta también el total suelto, de los listados que no usan meta', () => {
    expect(totalDe({ data: [], total: 42 })).toBe(42)
  })

  it('meta manda sobre el total suelto', () => {
    expect(totalDe({ meta: { total: 1584 }, total: 200 })).toBe(1584)
  })

  it('sin total devuelve cero, no un NaN que rompa el paginador', () => {
    expect(totalDe({ data: [] })).toBe(0)
    expect(totalDe(null)).toBe(0)
    expect(totalDe({ meta: { total: 'muchos' } })).toBe(0)
  })

  it('cero es un total válido: una búsqueda sin resultados', () => {
    expect(totalDe({ data: [], meta: { total: 0 } })).toBe(0)
  })
})
