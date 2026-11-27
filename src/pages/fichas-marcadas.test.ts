import { describe, it, expect } from 'vitest'

/**
 * Cada ficha lleva su marca.
 *
 * Las fichas —la de una factura, un cliente, un activo fijo, una corrida de
 * planilla— tienen sus datos en rejillas de dos y tres columnas escritas en
 * línea, y NO están dentro de un `<Form>`, así que la regla de teléfono de
 * los formularios no las alcanza. Por eso cada una marca su raíz con
 * `data-ficha`: la regla de CSS no es ciega, solo entra donde alguien la
 * invitó.
 *
 * Esa marca es una palabra en una línea: se borra sin que se note y sin que
 * falle nada —la pantalla sigue funcionando, solo se vuelve ilegible en un
 * teléfono—. Esto lo vigila.
 *
 * El efecto de la regla no se puede medir aquí (jsdom no carga la hoja de
 * estilos); se verificó aparte en el navegador con la hoja compilada.
 */
const FICHAS = import.meta.glob([
  './ventas/clientes/ClienteDetallePage.tsx',
  './ventas/facturas/FacturaDetallePage.tsx',
  './ventas/estimaciones/EstimacionDetallePage.tsx',
  './ventas/notas-credito/NotaCreditoDetallePage.tsx',
  './ventas/pagos-recibidos/PagoRecibidoDetallePage.tsx',
  './compras/proveedores/ProveedorDetallePage.tsx',
  './compras/facturas/FacturaProveedorDetallePage.tsx',
  './compras/notas-credito-proveedor/NotaCreditoProveedorDetallePage.tsx',
  './compras/ordenes/OrdenCompraDetallePage.tsx',
  './contabilidad/activos-fijos/ActivoFijoDetallePage.tsx',
  './contabilidad/ajuste-moneda/AjusteMonedaDetallePage.tsx',
  './contabilidad/presupuesto/PresupuestoDetallePage.tsx',
  './inventario/ExpedienteDetallePage.tsx',
  './planillas/corrida/CorridaPlanillaPage.tsx',
  './planillas/corrida/DetalleMensualPlanillaPage.tsx',
  './planillas/finiquito/FiniquitoPage.tsx',
], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('las fichas y pantallas de detalle', () => {
  it('son las dieciséis que se marcaron, ni una menos', () => {
    expect(Object.keys(FICHAS)).toHaveLength(16)
  })

  for (const [ruta, fuente] of Object.entries(FICHAS)) {
    const nombre = ruta.split('/').pop()

    it(`${nombre} marca su raíz con data-ficha`, () => {
      expect(fuente, 'perdió su marca data-ficha').toContain('data-ficha')
    })

    /**
     * Y sus tablas se corren de lado en vez de apretarse: la tabla de líneas
     * de una factura tiene seis o siete columnas de cifras, y en 375px
     * apretada no se lee. `ResponsiveTable` es lo que da ese comportamiento.
     */
    it(`${nombre} no dejó ninguna tabla sin convertir`, () => {
      const sinConvertir = /<Table(?![.\w])/.test(fuente)
      expect(sinConvertir, 'quedó un <Table> que se apretará en el teléfono').toBe(false)
    })
  }
})
