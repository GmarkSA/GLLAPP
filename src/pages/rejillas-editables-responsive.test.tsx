import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Las tres rejillas editables, en el teléfono.
 *
 * Estas pantallas quedaron fuera del barrido de listados a propósito: no son
 * listas de registros, son rejillas donde se escribe. Una tarjeta genérica no
 * las resuelve, porque lo que hay que conservar es la EDICIÓN, no el dato.
 *
 *  - Clases de activo fijo: tasa del ISR, vida útil, si deprecia y OCHO
 *    cuentas por fila, con guardado por fila. Lo que se toca a diario queda a
 *    la vista; las ocho cuentas se despliegan aparte, porque se ponen una vez
 *    al configurar.
 *  - Cuentas contables de planilla: un mapeo concepto → cuenta. El concepto
 *    arriba y el selector debajo, a todo el ancho, que es lo que necesita un
 *    nombre de cuenta.
 *  - Cargas iniciales: un asistente con vistas previas de importación. Esas
 *    son matrices y se corren de lado; la única que es un listado de verdad
 *    —los saldos de apertura por contacto— sí lleva tarjeta.
 */

/** Finge una pantalla de ese ancho para `window.matchMedia`. */
function pantallaDe(ancho: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const cumpleMax = max ? ancho <= Number(max[1]) : true
    const cumpleMin = min ? ancho >= Number(min[1]) : true
    return {
      matches: cumpleMax && cumpleMin,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }
  }) as any
}

const CUENTAS = [
  { id: 'a1', code: '160005', name: 'Equipo de computación',      isActive: true },
  { id: 'a2', code: '160010', name: 'Depreciación acumulada',     isActive: true },
  { id: 'a3', code: '640004', name: 'Gasto de depreciación',      isActive: true },
  { id: 'a4', code: '520101', name: 'Sueldos y salarios',         isActive: true },
  { id: 'a5', code: '210401', name: 'Sueldos por pagar',          isActive: true },
]

const CLASES = [
  {
    /** Guardada, con tres de las ocho cuentas puestas. */
    id: 'cl-1', companyId: 'emp-1', codigo: '3000', nombre: 'EQUIPO DE COMPUTACIÓN',
    tasaDepreciacionAnual: 0.3333, vidaUtilMeses: 36, esNoDepreciable: false,
    cuentaAltasId: 'a1', cuentaDepreciacionAcumuladaId: 'a2', cuentaGastoDepreciacionId: 'a3',
    cuentaGananciaPorVentaId: null, cuentaPerdidaPorDeterioro: null, cuentaPerdidaPorVentaId: null,
    cuentaGananciaActivoFijoId: null, cuentaCostoVentaAFId: null, cuentaSaldosInicialesId: null,
    activo: true,
  },
  {
    /** Terrenos: no deprecia, y sin ninguna cuenta puesta. */
    id: 'cl-2', companyId: 'emp-1', codigo: '1000', nombre: 'TERRENOS',
    tasaDepreciacionAnual: 0, vidaUtilMeses: null, esNoDepreciable: true,
    cuentaAltasId: null, cuentaDepreciacionAcumuladaId: null, cuentaGastoDepreciacionId: null,
    cuentaGananciaPorVentaId: null, cuentaPerdidaPorDeterioro: null, cuentaPerdidaPorVentaId: null,
    cuentaGananciaActivoFijoId: null, cuentaCostoVentaAFId: null, cuentaSaldosInicialesId: null,
    activo: false,
  },
  {
    /** Plantilla: el backend la devuelve sin id y no se puede editar. */
    id: null, companyId: 'emp-1', codigo: '5000', nombre: 'VEHÍCULOS',
    tasaDepreciacionAnual: 0.20, vidaUtilMeses: 60, esNoDepreciable: false,
    cuentaAltasId: null, cuentaDepreciacionAcumuladaId: null, cuentaGastoDepreciacionId: null,
    cuentaGananciaPorVentaId: null, cuentaPerdidaPorDeterioro: null, cuentaPerdidaPorVentaId: null,
    cuentaGananciaActivoFijoId: null, cuentaCostoVentaAFId: null, cuentaSaldosInicialesId: null,
    activo: true,
  },
]

const CONCEPTOS = [
  { campo: 'cuentaGastoSueldos',          etiqueta: 'Gasto — Sueldos y salarios',  naturaleza: 'gasto',  obligatoria: true },
  { campo: 'cuentaGastoHorasExtra',       etiqueta: 'Gasto — Horas extra',         naturaleza: 'gasto',  obligatoria: false },
  { campo: 'cuentaPasivoSueldosPorPagar', etiqueta: 'Pasivo — Sueldos por pagar',  naturaleza: 'pasivo', obligatoria: true },
]

const SALDOS_APERTURA = [
  { contactoId: 'c-1', nombre: 'Jorge Acevedo', moneda: 'GTQ', enQuetzales: 5525,
    lineas: [{ documento: 'FAC-1' }, { documento: 'FAC-2' }] },
  /** Un solo documento, para que el singular salga bien. */
  { contactoId: 'c-2', nombre: 'Mario de Paz', moneda: 'USD', enQuetzales: 1662.72,
    lineas: [{ documento: 'FAC-3' }] },
]

vi.mock('../api/contactos', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getSaldosAperturaClientes:    vi.fn(async () => SALDOS_APERTURA),
    getSaldosAperturaProveedores: vi.fn(async () => []),
  }
})

vi.mock('../store/companyStore', () => ({
  useCompanyStore: (sel: any) => sel({ activeCompany: { id: 'emp-1', legalName: 'Kaizen' } }),
}))

vi.mock('../api/catalogo', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getAccounts: vi.fn(async () => CUENTAS) }
})

vi.mock('../api/clases-activo-fijo', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getClasesActivoFijo:      vi.fn(async () => CLASES),
    actualizarClaseActivoFijo: vi.fn(),
    seedGuatemalaClases:      vi.fn(),
  }
})

vi.mock('../api/planillas', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getCuentasPlanilla: vi.fn(async () => ({
      // Solo el primer concepto tiene cuenta: el obligatorio de pasivo queda sin ella.
      configuracion: { cuentaGastoSueldos: 'a4' },
      conceptos: CONCEPTOS,
    })),
    validarCuentasPlanilla: vi.fn(async () => ({
      completo: false,
      faltantes: [{ campo: 'cuentaPasivoSueldosPorPagar', etiqueta: 'Pasivo — Sueldos por pagar' }],
    })),
    guardarCuentasPlanilla: vi.fn(),
  }
})

describe('las rejillas editables en el teléfono', () => {
  let div: HTMLDivElement
  let root: Root
  const original = window.matchMedia

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
    window.matchMedia = original
  })

  const dibujar = async (ruta: string) => {
    const { default: Pagina } = await import(/* @vite-ignore */ ruta)
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 90)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0
  const texto = () => div.textContent ?? ''
  const hayBoton = (t: string) =>
    [...div.querySelectorAll('button')].some(b => (b.textContent ?? '').includes(t))

  describe('Clases de activo fijo', () => {
    const PAGINA = './contabilidad/activos-fijos/ClasesActivoFijoPage'

    it('la tarjeta dice cuántas de las ocho cuentas están puestas', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('EQUIPO DE COMPUTACIÓN')
      expect(texto()).toContain('3000')
      expect(texto()).toContain('3 de 8 cuentas vinculadas')
      expect(texto()).toContain('TERRENOS')
      expect(texto()).toContain('0 de 8 cuentas vinculadas')
      expect(hayTabla()).toBe(false)
    })

    /**
     * Lo que se toca a diario queda a la vista: la tasa, la vida útil y el
     * interruptor de «no depreciable». Si se pierden, la pantalla queda de
     * solo lectura en el teléfono.
     */
    it('conserva los campos que se editan: tasa, vida útil e interruptor', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Tasa anual')
      expect(texto()).toContain('Vida útil (meses)')
      expect(texto()).toContain('No depreciable')
      // Dos campos numéricos y un interruptor por clase, las tres incluidas:
      // la plantilla también los muestra, apagados, igual que en la tabla.
      expect(div.querySelectorAll('.ant-input-number').length).toBe(6)
      expect(div.querySelectorAll('.ant-switch').length).toBe(3)
      // Y los de la plantilla están deshabilitados, que es lo que importa.
      expect(div.querySelectorAll('.ant-input-number-disabled').length).toBe(2)
      expect(div.querySelectorAll('.ant-switch-disabled').length).toBe(1)
    })

    it('y las ocho cuentas, desplegables dentro de la propia tarjeta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Cuentas contables (3/8)')
      expect(texto()).toContain('Cuentas contables (0/8)')
      expect(div.querySelectorAll('.ant-collapse').length).toBe(3)
    })

    /** Una plantilla sin guardar no se edita ni se borra, igual que en la tabla. */
    it('una plantilla sin guardar no ofrece guardar ni eliminar', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('VEHÍCULOS')
      expect(texto()).toContain('plantilla sin guardar')
      // Guardar aparece solo en las dos clases que sí existen.
      const guardar = [...div.querySelectorAll('button')]
        .filter(b => (b.textContent ?? '').includes('Guardar'))
      expect(guardar).toHaveLength(2)
    })

    it('en tablet y escritorio sigue siendo la rejilla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
      act(() => { root.unmount() })
      root = createRoot(div)
      pantallaDe(1440)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Cuentas contables de planilla', () => {
    const PAGINA = './planillas/configuracion/CuentasPlanillaPage'

    it('el concepto arriba y su selector de cuenta debajo', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Sueldos y salarios')
      expect(texto()).toContain('Sueldos por pagar')
      // Un selector por concepto, a todo el ancho.
      expect(div.querySelectorAll('.ant-select').length).toBe(CONCEPTOS.length)
      expect(hayTabla()).toBe(false)
    })

    /**
     * Un concepto obligatorio sin cuenta es lo que impide contabilizar la
     * planilla: el aviso no se puede perder al pasar a tarjeta.
     */
    it('avisa del concepto obligatorio que quedó sin cuenta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('obligatoria — sin cuenta')
    })

    it('en tablet sigue siendo la rejilla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })

    it('y el botón de guardar sigue ahí', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(hayBoton('Guardar')).toBe(true)
    })
  })

  describe('Cargas iniciales — saldos de apertura por contacto', () => {
    const dibujarSaldos = async () => {
      const { SaldosCapturadosEnLaFicha } = await import('./configuracion/CargasInicialesPage')
      await act(async () => {
        root.render(<MemoryRouter><SaldosCapturadosEnLaFicha type="clientes" /></MemoryRouter>)
      })
      await act(async () => { await new Promise(r => setTimeout(r, 60)) })
    }

    /**
     * De las seis tablas del asistente, cinco son matrices —vistas previas de
     * importación, diagnóstico de columnas— y se corren de lado. Esta es la
     * única que es un listado de registros, así que es la única con tarjeta.
     */
    it('cada contacto es una tarjeta con su saldo y sus documentos', async () => {
      pantallaDe(375)
      await dibujarSaldos()
      expect(texto()).toContain('Jorge Acevedo')
      expect(texto()).toContain('2 documentos · GTQ')
      expect(texto()).toContain('Q 5,525.00')
      expect(texto()).toContain('1 documento · USD')   // en singular
      expect(hayTabla()).toBe(false)
    })

    it('en tablet y escritorio sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujarSaldos()
      expect(hayTabla()).toBe(true)
      act(() => { root.unmount() })
      root = createRoot(div)
      pantallaDe(1440)
      await dibujarSaldos()
      expect(hayTabla()).toBe(true)
    })
  })
})
