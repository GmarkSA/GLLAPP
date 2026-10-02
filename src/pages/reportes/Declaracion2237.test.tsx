import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import dayjs from 'dayjs'

/**
 * El reporte de la declaración de IVA, dibujado entero.
 *
 * Es un facsímil del formulario 2237 del SAT: cada sección y cada renglón tienen
 * que aparecer donde el contador los espera, porque lo compara contra el
 * formulario oficial antes de presentar. Al sacar las filas fuera de la página
 * para arreglar la pérdida de foco se tocó cómo se arma ese dibujo, así que aquí
 * queda anotado lo que debe verse.
 */

// El período lo elige la pantalla con el mes de HOY: una declaración fija se
// quedaba huérfana al cambiar de mes (el 1 de octubre dejó de encontrar la de
// septiembre y no dibujaba el formulario).
const HOY = dayjs()

const DECLARACION = {
  id: 'decl-1', mes: HOY.month() + 1, anio: HOY.year(), status: 'borrador',
  baseVentas: 10000, ivaDebitoFiscal: 1200,
  baseCompras: 4000, ivaCreditoFiscal: 480,
  ivaNeto: 720, retencionIva: 0, polizaId: null,
  updatedAt: '2026-09-16T00:00:00.000Z',
  snapshot: {
    notasCredito: { emitidas: 0, recibidas: 0 },
    // Con exportación: la empresa vende 10,000 local y exporta 2,500 (secciones 4 y 6)
    ventasDesglose:  { bienes: { base: 10000, iva: 1200 }, exportacion: { base: 2500, iva: 0 } },
    comprasDesglose: { bienes: { base: 4000,  iva: 480 } },
  },
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
      '4. DÉBITO FISCAL POR OPERACIONES DE EXPORTACIÓN',
      '5. CRÉDITO FISCAL POR OPERACIONES LOCALES',
      '6. CRÉDITO FISCAL POR OPERACIONES DE EXPORTACIÓN',
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
    const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
      'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    expect(texto()).toContain('4677003-9')
    expect(texto()).toContain('GMARK, S.A.')
    expect(texto()).toContain(MESES[HOY.month()])
    expect(texto()).toContain(String(HOY.year()))
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
    expect(contenedor.querySelectorAll('tbody tr').length).toBe(67)
  })

  it('muestra los totales calculados a partir del desglose', () => {
    expect(texto()).toContain('IMPUESTO A PAGAR')
    expect(texto()).toContain('TOTAL A PAGAR')
    expect(texto()).toContain('10,000.00')   // base de débitos
    expect(texto()).toContain('1,200.00')    // débito fiscal
  })

  // La exportación es exenta: reporta base sin débito, y el crédito del mes que le
  // corresponde sale por proporcionalidad (el que se pide en devolución, Art. 23).
  it('reporta la exportación aparte de lo local, con su factor y su crédito', () => {
    expect(texto()).toContain('Exportaciones de bienes y servicios')
    expect(texto()).toContain('20.00%')      // 2,500 ÷ 12,500
    expect(texto()).toContain('96.00')       // 480 de crédito × 20%
    expect(texto()).toContain('2,500.00')    // base de la sección 4
    expect(texto()).toContain('10,000.00')   // la sección 3 queda solo con lo local
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
