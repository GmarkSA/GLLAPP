import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * El listado de Activos Fijos en el teléfono.
 *
 * La regla de los tres tamaños: teléfono (≤767) tarjetas, tablet (768–1024)
 * la misma tabla corrida de lado, escritorio la tabla completa.
 *
 * De un activo, lo primero que se mira es lo que vale HOY —el valor en
 * libros—, con el costo original debajo. Y las acciones dependen del estado:
 * un borrador se activa, un activo se vende o se da de baja, y un vendido ya
 * no admite ninguna de las tres. Si esas acciones se pierden en el teléfono,
 * el módulo queda de solo lectura sin que nadie lo haya decidido: eso es lo
 * que se vigila aquí.
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

const CLASES = [
  { id: 'cl-1', codigo: '19B-3', nombre: 'Vehículos', tasaDepreciacionAnual: 0.20, vidaUtilMeses: 60, esNoDepreciable: false, activo: true },
]

const ACTIVOS = [
  {
    id: 'af-1', companyId: 'emp-1', assetNumber: 'AF-0001',
    name: 'Vehículo Toyota Hilux 2024', description: null,
    claseActivoFijoId: 'cl-1', estado: 'ACTIVO',
    acquisitionDate: '2026-02-15', originalCost: 250000, salvageValue: 0,
    currentBookValue: 212500, accumulatedDepreciation: 37500,
    depreciacionMensual: 4166.67,
    location: null, serialNumber: null, vendorId: null, purchaseInvoiceId: null,
    disposedAt: null, disposalValue: null, centroCostoId: null, centroBeneficioId: null,
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z',
  },
  {
    /** Borrador migrado: sin clase y sin cuota mensual — la tarjeta no debe
     *  quedar con basura, y su acción es Activar, no Vender. */
    id: 'af-2', companyId: 'emp-1', assetNumber: 'AF-0002',
    name: 'Mobiliario de oficina', description: null,
    claseActivoFijoId: null, estado: 'BORRADOR',
    acquisitionDate: '2025-06-01', originalCost: 18000, salvageValue: 0,
    currentBookValue: 12000, accumulatedDepreciation: 6000,
    depreciacionMensual: null,
    location: null, serialNumber: null, vendorId: null, purchaseInvoiceId: null,
    disposedAt: null, disposalValue: null, centroCostoId: null, centroBeneficioId: null,
    createdAt: '2025-06-01T10:00:00Z', updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    /** Vendido: ni Activar, ni Vender, ni Dar de baja, ni Editar. */
    id: 'af-3', companyId: 'emp-1', assetNumber: 'AF-0003',
    name: 'Laptop Dell 2022', description: null,
    claseActivoFijoId: 'cl-1', estado: 'VENDIDO',
    acquisitionDate: '2022-01-10', originalCost: 9000, salvageValue: 0,
    currentBookValue: 0, accumulatedDepreciation: 9000,
    depreciacionMensual: null,
    location: null, serialNumber: null, vendorId: null, purchaseInvoiceId: null,
    disposedAt: '2026-05-01', disposalValue: 1500, centroCostoId: null, centroBeneficioId: null,
    createdAt: '2022-01-10T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z',
  },
]

vi.mock('../../../api/activos-fijos', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getActivosFijos: vi.fn(async () => ({ data: ACTIVOS, total: ACTIVOS.length, page: 1, limit: 50 })),
  }
})

vi.mock('../../../api/clases-activo-fijo', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getClasesActivoFijo: vi.fn(async () => CLASES) }
})

vi.mock('../../../components/SelectorDimensionesAnaliticas', () => ({ default: () => null }))

describe('el listado de Activos Fijos en el teléfono', () => {
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

  const dibujar = async () => {
    const { default: Pagina } = await import('./ActivosFijosPage')
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 90)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0
  const texto = () => div.textContent ?? ''
  const botones = () => [...div.querySelectorAll('button')].map(b => b.textContent ?? '')
  const hayBoton = (t: string) => botones().some(b => b.includes(t))

  it('la tarjeta muestra el valor en libros arriba y el costo original debajo', async () => {
    pantallaDe(375)
    await dibujar()
    expect(texto()).toContain('Vehículo Toyota Hilux 2024')
    expect(texto()).toContain('AF-0001')
    expect(texto()).toContain('Vehículos')
    expect(texto()).toContain('Q 212,500.00')          // valor en libros
    expect(texto()).toContain('Costo Q 250,000.00')    // costo original
    expect(texto()).toContain('15/02/2026')
    expect(texto()).toContain('cuota Q 4,166.67')
    expect(hayTabla()).toBe(false)
  })

  /** Un activo migrado sin clase ni cuota: ni «undefined» ni la tarjeta caída. */
  it('un activo sin clase ni cuota mensual no rompe la tarjeta', async () => {
    pantallaDe(375)
    await dibujar()
    expect(texto()).toContain('Mobiliario de oficina')
    expect(texto()).toContain('Sin clase')
    expect(texto()).toContain('cuota —')
    expect(texto()).not.toContain('undefined')
  })

  it('las acciones de cada estado siguen estando en la tarjeta', async () => {
    pantallaDe(375)
    await dibujar()
    // El ACTIVO: se vende o se da de baja.
    expect(hayBoton('Vender')).toBe(true)
    expect(hayBoton('Dar de baja')).toBe(true)
    // El BORRADOR: se activa.
    expect(hayBoton('Activar')).toBe(true)
    // Y de los tres, solo dos son editables (borrador y activo).
    expect(botones().filter(b => b.includes('Editar'))).toHaveLength(2)
    // Ver detalle está en los tres.
    expect(botones().filter(b => b.includes('Ver'))).toHaveLength(3)
  })

  it('en tablet y escritorio sigue siendo la tabla', async () => {
    pantallaDe(810)
    await dibujar()
    expect(texto()).toContain('Vehículo Toyota Hilux 2024')
    expect(hayTabla()).toBe(true)

    act(() => { root.unmount() })
    root = createRoot(div)
    pantallaDe(1440)
    await dibujar()
    expect(hayTabla()).toBe(true)
  })
})
