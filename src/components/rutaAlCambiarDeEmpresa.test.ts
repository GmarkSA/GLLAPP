import { describe, it, expect } from 'vitest'
import { rutaAlCambiarDeEmpresa } from './rutaAlCambiarDeEmpresa'

/**
 * Dónde queda uno al cambiar de empresa.
 *
 * Antes se recargaba la misma dirección. Estando en una factura de venta de una
 * empresa y pasando a la otra, la dirección seguía apuntando a un documento que
 * la nueva empresa no tiene: la pantalla se quedaba en «Factura no encontrada» y
 * había que ir al inicio a mano.
 *
 * El servidor hace bien en no entregar el documento —es de otra empresa—; lo que
 * había que corregir era insistir en la misma dirección.
 */
describe('Ruta al cambiar de empresa', () => {
  describe('estando en un documento concreto', () => {
    // El caso que reportó el dueño
    it('desde una factura de venta lleva al listado de facturas', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas/9f2c1b40-7a1e-4c3b-9d55-0e2a6c8b1f34'))
        .toBe('/ventas/facturas')
    })

    it('desde una factura de compra lleva a su listado', () => {
      expect(rutaAlCambiarDeEmpresa('/compras/facturas/9f2c1b40-7a1e-4c3b-9d55-0e2a6c8b1f34'))
        .toBe('/compras/facturas')
    })

    it('desde la edición de un documento también', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas/9f2c1b40-7a1e-4c3b-9d55-0e2a6c8b1f34/editar'))
        .toBe('/ventas/facturas')
    })

    it('desde la impresión también', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas/9f2c1b40-7a1e-4c3b-9d55-0e2a6c8b1f34/imprimir'))
        .toBe('/ventas/facturas')
    })

    it('reconoce un número correlativo, no solo un identificador largo', () => {
      expect(rutaAlCambiarDeEmpresa('/planillas/corridas/1842')).toBe('/planillas/corridas')
    })
  })

  describe('estando en un documento a medio escribir', () => {
    // Lo tecleado es de la empresa anterior: seguir ahí solo lleva a guardarlo mal
    it('un documento nuevo sin guardar se suelta', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas/nueva')).toBe('/ventas/facturas')
      expect(rutaAlCambiarDeEmpresa('/compras/proveedores/nuevo')).toBe('/compras/proveedores')
    })
  })

  describe('estando en una sección', () => {
    it('un listado se queda donde está: sirve en cualquier empresa', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas')).toBe('/ventas/facturas')
      expect(rutaAlCambiarDeEmpresa('/compras/facturas')).toBe('/compras/facturas')
      expect(rutaAlCambiarDeEmpresa('/contabilidad/diarios')).toBe('/contabilidad/diarios')
    })

    it('el inicio se queda en el inicio', () => {
      expect(rutaAlCambiarDeEmpresa('/')).toBe('/')
      expect(rutaAlCambiarDeEmpresa('')).toBe('/')
    })

    it('una pantalla de configuración se queda donde está', () => {
      expect(rutaAlCambiarDeEmpresa('/configuracion/impuestos')).toBe('/configuracion/impuestos')
    })

    // Los filtros guardados en la dirección son de la empresa anterior
    it('se sueltan los filtros de la búsqueda', () => {
      expect(rutaAlCambiarDeEmpresa('/ventas/facturas?estado=enviada&page=3'))
        .toBe('/ventas/facturas')
    })
  })
})
