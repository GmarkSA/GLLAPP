import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * El reporte de la declaración de IVA, dibujado entero.
 *
 * Es un facsímil del formulario 2237 del SAT: cada sección y cada renglón tienen
 * que aparecer donde el contador los espera, porque lo compara contra el
 * formulario oficial antes de presentar. Al sacar las filas fuera de la página
 * para arreglar la pérdida de foco se tocó cómo se arma ese dibujo, así que aquí
 * queda anotado lo que debe verse.
 */

const DECLARACION = {
  id: 'decl-1', mes: 9, anio: 2026, status: 'borrador',
  baseVentas: 10000, ivaDebitoFiscal: 1200,
  baseCompras: 4000, ivaCreditoFiscal: 480,
  ivaNeto: 720, retencionIva: 0, polizaId: null,
  updatedAt: '2026-09-16T00:00:00.000Z',
  snapshot: { notasCredito: { emitidas: 0, recibidas: 0 } },
  ventasDesglose:  { bienes: { base: 10000, iva: 1200 } },
  comprasDesglose: { bienes: { base: 4000,  iva: 480 } },
}

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../../store/companyStore', () => ({
  useCompanyStore: (selector: (s: unknown) => unknown) =>
    selector({ activeCompany: { taxId: '4677003-9', legalName: 'GMARK, S.A.' } }),
}))

vi.mock('../../api/reportes', () => ({
  getDeclaracionesIva:     vi.fn(async () => [DECLARACION]),
  generarBorradorIva:      vi.fn(async () => DECLARACION),
  generarPolizaBorradorIva: vi.fn(async () => DECLARACION),
  marcarIvaPresentada:     vi.fn(async () => DECLARACION),
  actualizarDeclaracionIva: vi.fn(async () => DECLARACION),
  sincronizarEstadoIva:    vi.fn(async () => DECLARACION),
}))

const { default: Declaracion2237 } = await import('./Declaracion2237')

describe('Declaración 2237 en pantalla', () => {
  let contenedor: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
    await act(async () => { root.render(<Declaracion2237 />) })
  })

  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  const texto = () => contenedor.textContent ?? ''
  // Solo las del formulario: fuera de la tabla están los selectores de mes y año
  const casillas = () => contenedor.querySelectorAll('tbody input')

  it('trae las secciones numeradas del formulario del SAT', () => {
    for (const seccion of [
      '1. NIT DEL CONTRIBUYENTE',
      '2. PERÍODO DE IMPOSICIÓN',
      '3. DÉBITO FISCAL POR OPERACIONES LOCALES',
      '5. CRÉDITO FISCAL POR OPERACIONES LOCALES',
      '7. DETERMINACIÓN DEL CRÉDITO FISCAL O IMPUESTO A PAGAR',
      '8. INDICADORES COMERCIALES',
      '9.1 CANTIDAD DE OPERACIONES REALIZADAS',
      '9.2 MONTO DE OPERACIONES REALIZADAS',
      '11. ACCESORIOS',
    ]) {
      expect(texto()).toContain(seccion)
    }
  })

  it('identifica a la empresa y el período', () => {
    expect(texto()).toContain('4677003-9')
    expect(texto()).toContain('GMARK, S.A.')
    expect(texto()).toContain('SEPTIEMBRE')
    expect(texto()).toContain('2026')
  })

  it('dibuja los renglones de débito y de crédito', () => {
    expect(texto()).toContain('Ventas gravadas (bienes)')
    expect(texto()).toContain('Exportaciones')
    expect(texto()).toContain('Servicios adquiridos')
    expect(texto()).toContain('Compras de combustibles')
    expect(texto()).toContain('Importaciones de Centroamérica y del resto del mundo')
  })

  // Número exacto a propósito: si alguien pierde o duplica un renglón al tocar
  // el reporte, esto lo dice en vez de dejarlo pasar
  it('cuenta los renglones que espera el formulario', () => {
    expect(contenedor.querySelectorAll('tbody tr').length).toBe(61)
  })

  it('muestra los totales calculados a partir del desglose', () => {
    expect(texto()).toContain('IMPUESTO A PAGAR')
    expect(texto()).toContain('TOTAL A PAGAR')
    expect(texto()).toContain('10,000.00')   // base de débitos
    expect(texto()).toContain('1,200.00')    // débito fiscal
  })

  it('en modo lectura no ofrece ninguna casilla de captura', () => {
    expect(casillas().length).toBe(0)
  })

  describe('al entrar en modo edición', () => {
    beforeEach(() => {
      const boton = [...contenedor.querySelectorAll('button')]
        .find(b => b.textContent?.includes('Editar valores'))!
      act(() => { boton.click() })
    })

    it('abre las casillas de captura de los renglones editables', () => {
      expect(casillas().length).toBeGreaterThan(20)
    })

    it('avisa de qué renglones se pueden tocar', () => {
      expect(texto()).toContain('modifique los valores resaltados en amarillo')
      expect(texto()).toContain('▼')
    })

    it('las secciones siguen en su sitio', () => {
      expect(texto()).toContain('3. DÉBITO FISCAL POR OPERACIONES LOCALES')
      expect(texto()).toContain('Ventas gravadas (bienes)')
    })
  })
})
