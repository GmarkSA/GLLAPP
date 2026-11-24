import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * La orden de compra se emite en la moneda del proveedor.
 *
 * Antes no tenía NADA de esto: no había selector de moneda, el guardado no
 * mandaba `currency`, y al editar tampoco se cargaba. Toda orden nacía en
 * quetzales con tasa 1 aunque el proveedor facturara en dólares, y el detalle
 * y el PDF salían con el signo equivocado. La columna del tipo de cambio
 * existe en el servidor desde el PR anterior; esta es la mitad que faltaba.
 */
const createPurchaseOrder = vi.fn(async (dto: any) => ({ ...dto, id: 'oc-1' }))
const getExchangeRateForDate = vi.fn(async () => ({
  rate: 7.66777, officialRate: 7.66777, effectiveDate: '2026-11-21', source: 'banguat',
}))

const proveedores = [
  { id: 'v1', name: 'LLC', legalName: 'Luis Logistics Company', taxId: '41555384', currency: 'USD' },
  { id: 'v2', name: 'PL',  legalName: 'Papelería Local',        taxId: '123456',   currency: 'GTQ' },
]

vi.mock('../../../api/compras', async (original) => ({
  ...(await original<any>()),
  getVendors:          vi.fn(async () => ({ data: proveedores, total: 2 })),
  createPurchaseOrder: (dto: any) => createPurchaseOrder(dto),
  updatePurchaseOrder: vi.fn(async (_id: string, dto: any) => ({ ...dto, id: 'oc-1' })),
  getPurchaseOrder:    vi.fn(),
}))
vi.mock('../../../api/monedas', () => ({ getExchangeRateForDate: () => getExchangeRateForDate() }))
vi.mock('../../../api/impuestos', () => ({ getTaxes: vi.fn(async () => []) }))
vi.mock('../../../api/inventario', () => ({
  getProduct:  vi.fn(async () => null),
  getProducts: vi.fn(async () => []),
}))

describe('una orden de compra a un proveedor en dólares', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    createPurchaseOrder.mockClear()
    getExchangeRateForDate.mockClear()
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
    const { default: OrdenCompraFormPage } = await import('./OrdenCompraFormPage')
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/compras/ordenes/nueva']}>
          <Routes>
            <Route path="/compras/ordenes/nueva" element={<OrdenCompraFormPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }

  /** Elige al proveedor en el desplegable, como quien va a comprar. */
  const elegirProveedor = async (nombre: string) => {
    const caja = [...div.querySelectorAll('.ant-select')]
      .find(e => (e.textContent ?? '').includes('Razón Social'))
    expect(caja, 'no se encontró el desplegable de Proveedor').toBeTruthy()
    await act(async () => {
      caja!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })

    const opcion = [...document.querySelectorAll('.ant-select-item-option')]
      .find(e => (e.textContent ?? '').includes(nombre))
    expect(opcion, `no apareció ${nombre} en el desplegable`).toBeTruthy()
    await act(async () => {
      opcion!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  /**
   * La fecha de la orden se escribe a mano: el formulario no la trae puesta y
   * sin ella el guardado no procede.
   */
  const escribirFecha = async () => {
    const campo = [...div.querySelectorAll('.ant-form-item')]
      .find(e => (e.querySelector('label')?.textContent ?? '').includes('Fecha de Orden'))
    const input = campo?.querySelector('input') as HTMLInputElement
    expect(input, 'no se encontró la fecha de la orden').toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '21/11/2026')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }

  const guardar = async () => {
    const boton = [...div.querySelectorAll('button')]
      .find(b => (b.textContent ?? '').includes('Guardar'))
    expect(boton, 'no se encontró el botón de guardar').toBeTruthy()
    await act(async () => {
      boton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  it('toma la moneda del proveedor y pide su tipo de cambio', async () => {
    await dibujar()
    await elegirProveedor('Luis Logistics Company')

    expect(getExchangeRateForDate).toHaveBeenCalled()
    expect(div.textContent).toContain('1 USD =')
    expect(div.textContent).toContain('7.667770')
  })

  it('al guardar, la orden lleva su moneda y su tasa', async () => {
    await dibujar()
    await elegirProveedor('Luis Logistics Company')
    await escribirFecha()
    await guardar()

    expect(createPurchaseOrder).toHaveBeenCalled()
    const dto = createPurchaseOrder.mock.calls[0][0] as any
    expect(dto.currency).toBe('USD')
    expect(Number(dto.exchangeRate)).toBeCloseTo(7.66777, 5)
  })

  /** En quetzales no aparece la tasa y se guarda 1: no hay nada que convertir. */
  it('un proveedor local no muestra tipo de cambio', async () => {
    await dibujar()
    await elegirProveedor('Papelería Local')
    await escribirFecha()
    await guardar()

    expect(div.textContent).not.toContain('1 GTQ =')
    const dto = createPurchaseOrder.mock.calls[0][0] as any
    expect(dto.currency).toBe('GTQ')
    expect(Number(dto.exchangeRate)).toBe(1)
  })
})
