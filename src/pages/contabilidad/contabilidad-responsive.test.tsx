import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Los listados de Contabilidad en el teléfono.
 *
 * La regla de los tres tamaños: teléfono (≤767) tarjetas, tablet (768–1024)
 * la misma tabla corrida de lado, escritorio la tabla completa. Lo que se
 * vigila aquí es que cada listado cumpla eso CON DATOS: una tarjeta que se
 * cae por un campo vacío o una tabla que se quedó sin convertir no se ve en
 * un grep.
 *
 * Y se vigila el detalle que importa en estos listados: las acciones por
 * fila —publicar, generar, bloquear, anular— tienen que seguir estando
 * dentro de la tarjeta. Si se pierden, en el teléfono el módulo queda de
 * solo lectura sin que nadie lo haya decidido.
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

const ASIENTOS = [
  {
    id: 'as-1', entryNumber: 'DM-000012', entryDate: '2026-11-10',
    description: 'Provisión de servicios profesionales', reference: 'REF-889',
    type: 'manual', status: 'draft', totalDebit: 7500, totalCredit: 7500, currency: 'GTQ',
  },
  {
    /** Un asiento sin descripción ni referencia: la tarjeta cae al número. */
    id: 'as-2', entryNumber: 'DM-000013', entryDate: '2026-11-12',
    description: null, reference: null,
    type: 'adjustment', status: 'posted', totalDebit: 320.5, totalCredit: 320.5, currency: null,
  },
]

const RECURRENTES = [
  {
    id: 'rc-1', nombre: 'Depreciación mensual', descripcion: 'Corre el día 1',
    frecuencia: 'MENSUAL', proximaEjecucion: '2026-12-01', fechaInicio: '2026-01-01',
    fechaFin: null, nuncaVence: true, activo: true, autoPublicar: true,
    lineas: [{ id: 'l1' }, { id: 'l2' }],
  },
  {
    /** Plantilla a medias: sin próxima ejecución, sin líneas, inactiva. */
    id: 'rc-2', nombre: 'Plantilla sin programar', descripcion: null,
    frecuencia: 'ANUAL', proximaEjecucion: null, fechaInicio: null,
    fechaFin: null, nuncaVence: false, activo: false, autoPublicar: false,
    lineas: null,
  },
]

const PRESUPUESTOS = [
  { id: 'pr-1', nombre: 'Presupuesto 2026', anioFiscal: 2026, periodo: 'MENSUAL', status: 'ACTIVO', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'pr-2', nombre: 'Borrador 2027',    anioFiscal: 2027, periodo: 'ANUAL',   status: 'BORRADOR', createdAt: '2026-11-01T10:00:00Z' },
]

const AJUSTES = [
  { id: 'aj-1', fechaAjuste: '2026-10-31', moneda: 'USD', tipoCambio: 7.701234, gananciasPerdidas: 1540.22, status: 'posted' },
  { id: 'aj-2', fechaAjuste: '2026-09-30', moneda: 'USD', tipoCambio: 7.650000, gananciasPerdidas: -880.5,  status: 'posted' },
]

const CENTROS = [
  { id: 'cc-1', codigo: 'CC-001', nombre: 'Administración', grupo: 'Soporte', responsable: 'Ana López', fechaCreacion: '2026-02-01', activo: true },
  /** Sin grupo y sin responsable: la tarjeta no debe quedar con basura. */
  { id: 'cc-2', codigo: 'CC-002', nombre: 'Proyectos', grupo: null, responsable: null, fechaCreacion: null, activo: false },
]

const DIVISIONES = [
  { id: 'cb-1', codigo: 'LN-001', nombre: 'Consultoría', grupo: 'Servicios', responsable: 'Luis Chajón', fechaCreacion: '2026-03-01', activo: true },
  { id: 'cb-2', codigo: 'LN-002', nombre: 'Licencias', grupo: null, responsable: null, fechaCreacion: null, activo: false },
]

vi.mock('../../api/asientos', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getAsientos: vi.fn(async () => ({ data: ASIENTOS, total: ASIENTOS.length })),
  }
})

vi.mock('../../api/asientos-recurrentes', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getAsientosRecurrentes: vi.fn(async () => RECURRENTES) }
})

vi.mock('../../api/presupuesto', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getPresupuestos: vi.fn(async () => PRESUPUESTOS) }
})

vi.mock('../../api/ajuste-moneda', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getAjustesMoneda:        vi.fn(async () => AJUSTES),
    getCuentasDeDiferencial: vi.fn(async () => ({ ganancia: null, perdida: null })),
  }
})

vi.mock('../../api/centros-costo', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getCentrosCosto: vi.fn(async () => CENTROS) }
})

vi.mock('../../api/centros-beneficio', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getCentrosBeneficio: vi.fn(async () => DIVISIONES) }
})

describe('los listados de Contabilidad en el teléfono', () => {
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
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0
  const texto = () => div.textContent ?? ''
  const botonConTexto = (t: string) =>
    [...div.querySelectorAll('button')].some(b => (b.textContent ?? '').includes(t))

  describe('Diarios manuales', () => {
    const PAGINA = './diarios-manuales/DiariosManualesPage'

    it('en el teléfono cada asiento es una tarjeta con número, fecha, tipo y total', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Provisión de servicios profesionales')
      expect(texto()).toContain('DM-000012')
      expect(texto()).toContain('10/11/2026')
      expect(texto()).toContain('Manual')
      expect(texto()).toContain('GTQ 7,500.00')
      expect(texto()).toContain('Borrador')
      expect(hayTabla()).toBe(false)
    })

    /** Sin descripción, el encabezado cae al número; sin moneda, a GTQ. */
    it('un asiento sin descripción ni moneda no deja la tarjeta en blanco', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('DM-000013')
      expect(texto()).toContain('GTQ 320.50')
      expect(texto()).toContain('Publicado')
    })

    it('en tablet y escritorio sigue siendo la tabla', async () => {
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

  describe('Diarios recurrentes', () => {
    const PAGINA = './diarios-recurrentes/DiariosRecurrentesPage'

    it('la tarjeta trae frecuencia, próxima corrida y sus acciones', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Depreciación mensual')
      expect(texto()).toContain('Mensual')
      expect(texto()).toContain('2 líneas')
      expect(texto()).toContain('01/12/2026')
      expect(texto()).toContain('nunca vence')
      expect(texto()).toContain('Auto-publica')
      // El interruptor de activo, que es la acción propia de este listado.
      expect(div.querySelectorAll('.ant-switch').length).toBeGreaterThan(0)
      expect(hayTabla()).toBe(false)
    })

    it('una plantilla sin programar ni líneas no rompe la tarjeta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Plantilla sin programar')
      expect(texto()).toContain('0 líneas')
      expect(texto()).toContain('sin vencimiento')
      expect(texto()).toContain('Inactiva')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Presupuestos', () => {
    const PAGINA = './presupuesto/PresupuestosPage'

    it('la tarjeta conserva Editar, Vs Real y el cambio de estado', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Presupuesto 2026')
      expect(texto()).toContain('Año 2026')
      expect(botonConTexto('Editar')).toBe(true)
      expect(botonConTexto('Vs Real')).toBe(true)
      // Uno activo se cierra, uno en borrador se activa: las dos salidas.
      expect(botonConTexto('Cerrar')).toBe(true)
      expect(botonConTexto('Activar')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Ajustes de la moneda base', () => {
    const PAGINA = './ajuste-moneda/AjusteMonedaListPage'

    it('la tarjeta trae el tipo de cambio y el signo de la ganancia o pérdida', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('7.701234')
      expect(texto()).toContain('+GTQ1,540.22')
      expect(texto()).toContain('-GTQ880.50')   // la pérdida, con su signo
      expect(botonConTexto('Ver detalle')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Centros de costo y divisiones', () => {
    it('el centro de costo sale como tarjeta, con Bloquear dentro', async () => {
      pantallaDe(375)
      await dibujar('./centros-costo/CentrosCostoPage')
      expect(texto()).toContain('Administración')
      expect(texto()).toContain('CC-001')
      expect(texto()).toContain('Ana López')
      expect(botonConTexto('Bloquear')).toBe(true)
      expect(botonConTexto('Desbloquear')).toBe(true)   // el inactivo
      expect(hayTabla()).toBe(false)
    })

    it('la división sale como tarjeta y conserva sus acciones', async () => {
      pantallaDe(375)
      await dibujar('./centros-beneficio/CentrosBeneficioPage')
      expect(texto()).toContain('Consultoría')
      expect(texto()).toContain('LN-001')
      expect(botonConTexto('Editar')).toBe(true)
      expect(botonConTexto('Bloquear')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet los dos siguen siendo tabla', async () => {
      pantallaDe(810)
      await dibujar('./centros-costo/CentrosCostoPage')
      expect(hayTabla()).toBe(true)
      act(() => { root.unmount() })
      root = createRoot(div)
      await dibujar('./centros-beneficio/CentrosBeneficioPage')
      expect(hayTabla()).toBe(true)
    })
  })
})
