import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import POSPage from './POSPage'

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

vi.mock('../../api/inventario', () => ({
  getProducts: vi.fn(async () => ({ data: articulos, total: articulos.length })),
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

const loQueSeMando = () => createPOSVenta.mock.calls[0]?.[0] as any

beforeEach(() => {
  articulos = [ARTICULO_PC]
  createPOSVenta.mockClear()
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
