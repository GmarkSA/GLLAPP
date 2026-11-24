import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * La pantalla del SAT-1608 se lee como el papel del SAT.
 *
 * Las cifras son las del formulario real de LUUM del primer trimestre de
 * 2026, el que se usó para escribir el cálculo. Lo que esta prueba cuida es
 * que la pantalla muestre cada casilla donde va, señale cuál de las dos bases
 * ganó, y que cuando el margen no llega al 4% no ofrezca generar póliza —la
 * ley no afecta a ese contribuyente—.
 */
const LUUM_Q1 = {
  id: 'iso-1', tenantId: 't', companyId: 'emp-1',
  trimestre: 1, anio: 2026, anioBase: 2025, status: 'borrador',

  ingresosServicios: 965824.20,
  ingresosVentas:    346.14,
  costoVentas:       60374.93,
  ingresosBrutos:    966170.34,
  margenBruto:       905795.41,
  margenBrutoPct:    93.75,
  afecto:            true,

  activoTotal:              851466.91,
  depreciacionesAcumuladas: 62633.18,
  amortizacionesAcumuladas: 0,
  reservaIncobrables:       10041.45,
  creditosFiscales:         0,
  activoNeto:               778792.28,
  baseActivoNeto:           194698.07,
  impuestoActivoNeto:       1946.98,
  iusiPagado:               0,

  exclusionesIngresos:    0,
  baseIngresosBrutos:     241542.58,
  impuestoIngresosBrutos: 2415.43,

  baseAplicada:        'ingresos_brutos',
  impuestoDeterminado: 2415.43,
  isrAcreditado:       0,
  impuestoAPagar:      2415.43,

  polizaId: null, snapshot: null,
  createdAt: '2026-04-01', updatedAt: '2026-04-01',
}

const getDeclaracionesIso = vi.fn(async () => [LUUM_Q1])
const sincronizarEstadoIso = vi.fn(async (_id: string) => LUUM_Q1)

vi.mock('../../api/reportes', () => ({
  getDeclaracionesIso:      () => getDeclaracionesIso(),
  generarBorradorIso:       vi.fn(),
  generarPolizaBorradorIso: vi.fn(),
  marcarIsoPresentada:      vi.fn(),
  actualizarDeclaracionIso: vi.fn(),
  sincronizarEstadoIso:     (id: string) => sincronizarEstadoIso(id),
}))

describe('la declaración de ISO en pantalla', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    getDeclaracionesIso.mockClear()
    sincronizarEstadoIso.mockClear()
    sincronizarEstadoIso.mockResolvedValue(LUUM_Q1 as any)
    getDeclaracionesIso.mockResolvedValue([LUUM_Q1] as any)
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujar = async () => {
    const { default: DeclaracionIsoPage } = await import('./DeclaracionIso')
    await act(async () => {
      root.render(<MemoryRouter><DeclaracionIsoPage /></MemoryRouter>)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  /** Abre el trimestre del historial para ver el formulario. */
  const abrirTrimestre = async () => {
    // El más interno de los que empiezan con el trimestre: los de afuera son
    // la tarjeta del historial, que no es la que escucha el clic.
    const candidatos = [...div.querySelectorAll('div')]
      .filter(e => (e.textContent ?? '').trim().startsWith('1T 2026'))
    const fila = candidatos[candidatos.length - 1] as HTMLElement | undefined
    expect(fila, 'no apareció el trimestre en el historial').toBeTruthy()
    await act(async () => { fila!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }

  it('muestra los cuatro bloques del formulario', async () => {
    await dibujar()
    await abrirTrimestre()

    const texto = div.textContent ?? ''
    expect(texto).toContain('3. DETERMINACIÓN DEL MARGEN BRUTO')
    expect(texto).toContain('4. BASE IMPONIBLE SEGÚN ACTIVO NETO')
    expect(texto).toContain('5. BASE IMPONIBLE SEGÚN INGRESOS BRUTOS')
    expect(texto).toContain('6. DETERMINACIÓN DEL IMPUESTO')
  })

  it('las cifras son las del formulario del SAT', async () => {
    await dibujar()
    await abrirTrimestre()

    const texto = div.textContent ?? ''
    expect(texto).toContain('905,795.41')   // margen bruto
    expect(texto).toContain('93.75')        // margen %
    expect(texto).toContain('778,792.28')   // activo neto
    expect(texto).toContain('194,698.07')   // base según activo neto
    expect(texto).toContain('241,542.58')   // base según ingresos brutos
    expect(texto).toContain('2,415.43')     // impuesto determinado
  })

  /** Hay que poder ver cuál de las dos bases ganó, que es lo que decide. */
  it('dice qué base aplicó', async () => {
    await dibujar()
    await abrirTrimestre()

    expect(div.textContent).toContain('base aplicada: ingresos brutos')
  })

  it('explica que el impuesto es un activo, no un gasto', async () => {
    await dibujar()
    await abrirTrimestre()

    expect(div.textContent).toContain('ISO por acreditar')
    expect(div.textContent).toContain('ISO por pagar')
  })

  /** Con margen de 4% o menos no hay impuesto ni póliza: lo dice la ley. */
  it('un margen que no llega al 4% no ofrece generar póliza', async () => {
    getDeclaracionesIso.mockResolvedValue([{
      ...LUUM_Q1, margenBrutoPct: 3.2, afecto: false,
      impuestoDeterminado: 0, impuestoAPagar: 0,
    }] as any)

    await dibujar()
    await abrirTrimestre()

    expect(div.textContent).toContain('no afecto')
    const botones = [...div.querySelectorAll('button')].map(b => b.textContent ?? '')
    expect(botones.some(t => t.includes('Generar póliza'))).toBe(false)
  })

  /**
   * El caso de una migración que solo cargó saldos: el año anterior no tiene
   * pérdidas y ganancias en Lucía, así que los ingresos salen en cero y hay
   * que escribirlos. Un cero sin explicación parece un error del sistema.
   */
  it('avisa cuando el año base no tiene ingresos en los libros', async () => {
    getDeclaracionesIso.mockResolvedValue([{
      ...LUUM_Q1,
      ingresosServicios: 0, ingresosVentas: 0, costoVentas: 0,
      ingresosBrutos: 0, margenBruto: 0, margenBrutoPct: 0, afecto: false,
      baseIngresosBrutos: 0, impuestoIngresosBrutos: 0,
      impuestoDeterminado: 0, impuestoAPagar: 0,
    }] as any)

    await dibujar()
    await abrirTrimestre()

    expect(div.textContent).toContain('Sin ingresos de 2025 en los libros')
  })

  /**
   * El escenario del IVA y del ISR mensual, igual aquí: la póliza nace en
   * BORRADOR y se va a Contabilidad › Diarios Manuales, que es donde se
   * revisa y se contabiliza. La pantalla lo dice y, al volver, pregunta sola
   * por el estado.
   */
  describe('la póliza en borrador', () => {
    const CON_POLIZA = { ...LUUM_Q1, status: 'poliza_generada', polizaId: 'je-12345678-abcd' }

    it('dice que está en borrador y dónde se contabiliza', async () => {
      getDeclaracionesIso.mockResolvedValue([CON_POLIZA] as any)
      sincronizarEstadoIso.mockResolvedValue(CON_POLIZA as any)

      await dibujar()
      await abrirTrimestre()

      const texto = div.textContent ?? ''
      expect(texto).toContain('Póliza contable')
      expect(texto).toContain('Diarios Manuales')
      expect(texto).toContain('Débito ISO por acreditar')
      expect(texto).toContain('Crédito ISO por pagar')
    })

    /** Al abrir la pantalla pregunta por las que tienen póliza sin publicar. */
    it('pregunta sola por el estado de la póliza', async () => {
      getDeclaracionesIso.mockResolvedValue([CON_POLIZA] as any)
      sincronizarEstadoIso.mockResolvedValue(CON_POLIZA as any)

      await dibujar()

      expect(sincronizarEstadoIso).toHaveBeenCalledWith(CON_POLIZA.id)
    })

    /** Y cuando allá se publicó, la declaración queda presentada sin tocar nada. */
    it('al publicarse en el diario, queda presentada', async () => {
      getDeclaracionesIso.mockResolvedValue([CON_POLIZA] as any)
      sincronizarEstadoIso.mockResolvedValue({ ...CON_POLIZA, status: 'presentada' } as any)

      await dibujar()

      expect(div.textContent).toContain('Presentada')
    })
  })
})
