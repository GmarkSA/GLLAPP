import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import POSPage from './POSPage'
import { getProducts } from '../../api/inventario'

/**
 * Lo que el POS le manda al backend al cobrar.
 *
 * El POS mandaba `taxPercent: 12` fijo, sin mirar el impuesto del artículo, y
 * calculaba su total como si el precio ya llevara IVA. El backend hace lo
 * contrario: suma el 12% sobre el precio. Resultado medido contra Postgres:
 * el cajero cobra Q46 y la factura sale por Q51.52, la caja recibe Q51.52 en
 * los libros y quedan Q5.52 de faltante por venta.
 *
 * Y la librería es Pequeño Contribuyente: no factura IVA. Su impuesto de
 * ventas (PC-V01) es de tasa 0, así que el 12% fijo le inventa un IVA que no
 * debe.
 */
const ARTICULO_PC = {
  id: 'p1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
  salesPrice: 23, stockOnHand: 10, isInventoriable: true,
  salesTaxId: 'tax-pc', barCodes: ['ABA-GRAN'],
}
const ARTICULO_IVA = {
  id: 'p2', sku: 'CON-IVA', name: 'ARTICULO CON IVA',
  salesPrice: 112, stockOnHand: 10, isInventoriable: true,
  salesTaxId: 'tax-iva', barCodes: ['CON-IVA'],
}

const createPOSVenta = vi.fn(async (_dto: any) => ({ invoiceNumber: 'FAC-1', felStatus: 'certificada' }))
let articulos = [ARTICULO_PC]
/** Cuántos dice el servidor que hay en total, para probar el paginador. */
let totalDeArticulos: number | null = null

vi.mock('../../api/inventario', () => ({
  getProducts: vi.fn(async () => ({ data: articulos, total: totalDeArticulos ?? articulos.length })),
}))
vi.mock('../../api/contactos', () => ({
  getCustomers:   vi.fn(async () => ({ data: [], total: 0 })),
  createCustomer: vi.fn(),
}))
vi.mock('../../api/expedientes', () => ({
  createPOSVenta: (...a: any[]) => (createPOSVenta as any)(...a),
  getUbicacion:   vi.fn(async () => ({ id: 'pv-1', name: 'LOCAL 6', code: 'PV-001' })),
}))
vi.mock('../../api/bancos', () => ({
  getBankAccounts: vi.fn(async () => ([
    { id: 'caja-1', name: 'Caja Chica', type: 'petty_cash', currency: 'GTQ', status: 'active' },
  ])),
}))
vi.mock('../../api/impuestos', () => ({
  getTaxes: vi.fn(async () => ([
    { id: 'tax-pc',  code: 'PC-V01', name: 'Venta de bienes — sin IVA', rate: 0,  isActive: true },
    { id: 'tax-iva', code: 'IVA-V',  name: 'IVA por pagar',             rate: 12, isActive: true },
  ])),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const esperar = async (ms = 30) => {
  await act(async () => { await new Promise(r => setTimeout(r, ms)) })
}

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter><POSPage /></MemoryRouter>)
  })
  await esperar(60)
}

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await esperar()
}

/** Mete el artículo al carrito tocando su tarjeta en la rejilla. */
const agregarAlCarrito = async (nombre: string) => {
  const tarjeta = Array.from(host.querySelectorAll('*'))
    .reverse()
    .find(el => el.children.length === 0 && el.textContent?.trim() === nombre)
  expect(tarjeta).toBeTruthy()
  await click(tarjeta!.closest('[class*="ant-card"], div') ?? tarjeta!)
}

const botonCobrar = () =>
  Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('COBRAR'))

const cobrar = async () => {
  const b = botonCobrar()
  expect(b).toBeTruthy()
  await click(b!)
  await esperar(60)
}

/** Escribe en el buscador del catálogo y espera al debounce. */
const escribirEnBuscador = async (texto: string) => {
  const input = host.querySelector('input[placeholder*="Buscar art"]') as HTMLInputElement
  expect(input).toBeTruthy()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, texto)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await esperar(400)
}

const loQueSeMando = () => createPOSVenta.mock.calls[0]?.[0] as any

beforeEach(() => {
  articulos = [ARTICULO_PC]
  totalDeArticulos = null
  createPOSVenta.mockClear()
  ;(getProducts as any).mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('el impuesto que manda el POS', () => {
  it('toma la tasa del artículo, no un 12% fijo', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    await cobrar()

    expect(loQueSeMando().items[0].taxPercent).toBe(0)
  })

  it('en pequeño contribuyente la factura no lleva impuesto', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    await cobrar()

    expect(loQueSeMando().taxAmount).toBe(0)
  })

  it('el total de la factura es lo que el cajero cobra', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    await cobrar()

    const m = loQueSeMando()
    expect(m.total).toBe(23)
    expect(m.subtotal).toBe(23)
  })

  it('dice que el precio ya lleva el impuesto, para que el backend no lo sume otra vez', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    await cobrar()

    expect(loQueSeMando().items[0].taxInclusive).toBe(true)
  })

  it('con un artículo que sí lleva IVA, la tasa es la suya', async () => {
    articulos = [ARTICULO_IVA]
    await render()
    await agregarAlCarrito('ARTICULO CON IVA')
    await cobrar()

    const m = loQueSeMando()
    expect(m.items[0].taxPercent).toBe(12)
    // El precio de lista del mostrador ya lleva IVA: Q112 = Q100 + Q12.
    expect(m.total).toBe(112)
    expect(m.subtotal).toBe(100)
    expect(m.taxAmount).toBe(12)
  })

  it('un artículo sin impuesto asignado no inventa uno', async () => {
    articulos = [{ ...ARTICULO_PC, salesTaxId: undefined } as any]
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    await cobrar()

    expect(loQueSeMando().items[0].taxPercent).toBe(0)
  })
})

describe('lo que el cajero ve en pantalla', () => {
  /**
   * El cálculo ya tomaba la tasa del artículo, pero el panel de totales
   * seguía rotulando «IVA (12%)» fijo: en Pequeño Contribuyente le enseña al
   * cajero un impuesto que no existe.
   */
  it('sin impuesto en el artículo, no aparece ningún IVA', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    expect(host.textContent).not.toContain('IVA (12%)')
  })

  it('y tampoco el subtotal: sin impuesto, subtotal y total son lo mismo', async () => {
    await render()
    await agregarAlCarrito('ABACO BACO GRANDE')
    expect(host.textContent).not.toContain('Subtotal')
  })

  it('con un artículo que sí lleva IVA, se rotula con SU tasa', async () => {
    articulos = [ARTICULO_IVA]
    await render()
    await agregarAlCarrito('ARTICULO CON IVA')
    expect(host.textContent).toContain('IVA (12%)')
  })
})

/**
 * Un servicio no lleva inventario: su existencia siempre es cero porque no hay
 * nada que contar. El POS trataba ese cero como «Sin stock» y dejaba la
 * tarjeta en gris, sin poder tocarla: ningún servicio —impresiones, fletes,
 * mano de obra— se podía facturar desde la caja. El backend nunca revisó
 * existencias al cobrar; el bloqueo era solo de la pantalla.
 */
const SERVICIO = {
  id: 'p3', sku: 'imp-blan', name: 'impresiones blanco y negro',
  salesPrice: 5, stockOnHand: 0, isInventoriable: false, itemType: 'servicio',
  salesTaxId: 'tax-iva', barCodes: ['imp-blan'],
}

describe('servicios en el POS', () => {
  it('se pueden agregar al carrito aunque no tengan existencia', async () => {
    articulos = [SERVICIO as any]
    await render()
    await agregarAlCarrito('impresiones blanco y negro')
    expect(botonCobrar()!.hasAttribute('disabled')).toBe(false)
  })

  it('no se rotulan como «Sin stock»', async () => {
    articulos = [SERVICIO as any]
    await render()
    expect(host.textContent).not.toContain('Sin stock')
  })

  it('y se cobran: llegan a la factura como cualquier otra línea', async () => {
    articulos = [SERVICIO as any]
    await render()
    await agregarAlCarrito('impresiones blanco y negro')
    await cobrar()
    expect(loQueSeMando().items[0].productId).toBe('p3')
  })

  it('un artículo de inventario sin existencia sí se sigue bloqueando', async () => {
    articulos = [{ ...ARTICULO_PC, stockOnHand: 0 } as any]
    await render()
    expect(host.textContent).toContain('Sin stock')
  })
})

/**
 * La carga por Excel guarda `isInventoriable: fila.inventariable !== false`:
 * un servicio cuya fila venga sin la columna «lleva_stock» queda marcado como
 * inventariable y volvería a quedar bloqueado. El tipo de artículo es la otra
 * señal, y es la que esas filas sí traen.
 */
describe('servicios cargados por Excel sin la columna lleva_stock', () => {
  const SERVICIO_MAL_CARGADO = { ...SERVICIO, isInventoriable: true }

  it('tampoco quedan bloqueados: manda el tipo de artículo', async () => {
    articulos = [SERVICIO_MAL_CARGADO as any]
    await render()
    await agregarAlCarrito('impresiones blanco y negro')
    await cobrar()
    expect(loQueSeMando().items[0].productId).toBe('p3')
  })
})

/**
 * El POS pedía 80 artículos y punto: con 1,584 en el inventario, los que
 * quedaban fuera no existían para la caja a menos que el cajero supiera el
 * nombre exacto para buscarlos. Ahora se recorre por páginas.
 */
describe('recorrer el catálogo en el POS', () => {
  const muchos = Array.from({ length: 100 }, (_, i) => ({
    ...ARTICULO_IVA, id: `p-${i}`, sku: `SKU-${i}`, name: `ARTICULO ${i}`,
  }))

  const loQuePidio = (n: number) =>
    (getProducts as any).mock.calls[n]?.[0] ?? {}

  const pasarALaPagina = async (n: number) => {
    const boton = Array.from(host.querySelectorAll('.ant-pagination-item'))
      .find(el => el.textContent?.trim() === String(n))
    expect(boton).toBeTruthy()
    await click(boton!)
    await esperar(60)
  }

  it('pide una página, no una tajada fija de 80', async () => {
    articulos = muchos
    await render()
    expect(loQuePidio(0).page).toBe(1)
    expect(loQuePidio(0).limit).toBeGreaterThanOrEqual(100)
  })

  it('muestra el paginador cuando hay más de una página', async () => {
    articulos = muchos
    totalDeArticulos = 450
    await render()
    expect(host.querySelector('.ant-pagination')).toBeTruthy()
  })

  it('al pasar de página le pide esa página al servidor', async () => {
    articulos = muchos
    totalDeArticulos = 450
    await render()
    await pasarALaPagina(2)
    const ultima = (getProducts as any).mock.calls.at(-1)[0]
    expect(ultima.page).toBe(2)
  })

  it('buscar vuelve a la página 1: si no, la búsqueda sale vacía', async () => {
    articulos = muchos
    totalDeArticulos = 450
    await render()
    await pasarALaPagina(2)
    await escribirEnBuscador('ARTICULO 7')
    const ultima = (getProducts as any).mock.calls.at(-1)[0]
    expect(ultima.page).toBe(1)
    expect(ultima.search).toBe('ARTICULO 7')
  })
})
