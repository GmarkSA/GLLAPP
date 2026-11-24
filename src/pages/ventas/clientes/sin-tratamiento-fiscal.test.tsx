import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * La ficha del cliente ya no pregunta el tratamiento fiscal.
 *
 * El campo nació para ser el interruptor que decidía el IVA, pero esa parte
 * nunca se construyó: ninguna regla del sistema lo consulta —ni al facturar,
 * ni en el FEL, ni en los libros ni en las declaraciones—. Quien decide el
 * IVA de una factura de venta es el campo «IVA aplicable» del cliente, y que
 * la empresa no traslade IVA lo decide su régimen fiscal.
 *
 * Preguntarlo obligaba a contestar algo que no hacía nada y que contradecía
 * al campo de IVA que está justo debajo.
 *
 * Lo que esta prueba cuida es que quitarlo no rompa nada: el valor se sigue
 * guardando, y el contacto que YA estaba marcado como retenedor conserva su
 * tarjeta de retención.
 */
const createCustomer = vi.fn(async (dto: any) => ({ ...dto, id: 'cli-1' }))
const getCustomer    = vi.fn()

vi.mock('../../../api/contactos', async (original) => ({
  ...(await original<any>()),
  createCustomer: (dto: any) => createCustomer(dto),
  updateCustomer: vi.fn(async (_id: string, dto: any) => dto),
  getCustomer:    (id: string) => getCustomer(id),
}))
vi.mock('../../../api/impuestos', () => ({ getTaxes: vi.fn(async () => []) }))
vi.mock('../../../components/AccountSelect', () => ({ __esModule: true, default: () => null }))
vi.mock('../../../components/SaldoInicial/SaldoInicialContacto', () => ({
  __esModule: true, default: () => null,
}))

describe('la pestaña de impuestos del cliente', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    createCustomer.mockClear()
    getCustomer.mockReset()
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujar = async (ruta = '/ventas/clientes/nuevo') => {
    const { default: ClienteFormPage } = await import('./ClienteFormPage')
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/ventas/clientes/nuevo"     element={<ClienteFormPage />} />
            <Route path="/ventas/clientes/:id/editar" element={<ClienteFormPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  /** Entra a la pestaña de Impuestos, que es donde vivía el campo. */
  const abrirImpuestos = async () => {
    const pestana = [...div.querySelectorAll('.ant-tabs-tab')]
      .find(e => (e.textContent ?? '').includes('Impuestos'))
    expect(pestana, 'no se encontró la pestaña de Impuestos').toBeTruthy()
    await act(async () => {
      pestana!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }

  it('ya no pregunta el tratamiento fiscal', async () => {
    await dibujar()
    await abrirImpuestos()

    expect(div.textContent).not.toContain('Tratamiento fiscal')
  })

  /** Lo que sí decide el IVA sigue estando, que es de lo que se trata. */
  it('sigue preguntando el IVA aplicable a sus facturas', async () => {
    await dibujar()
    await abrirImpuestos()

    expect(div.textContent).toContain('IVA aplicable en facturas de venta')
  })

  /**
   * Al dejar de preguntarse, el campo deja de viajar en el guardado — y está
   * bien: la columna del servidor tiene `default 'taxable'`, así que un
   * cliente nuevo nace como contribuyente, igual que antes. Y al EDITAR uno
   * que ya tenía otro tratamiento, no mandarlo es lo que lo conserva: una
   * actualización no toca lo que no viene.
   */
  it('el cliente nuevo se crea sin el campo, y el servidor pone el suyo', async () => {
    await dibujar()

    // Se pasa por la pestaña de Impuestos, como quien llena la ficha completa.
    await abrirImpuestos()

    const razon = div.querySelector('#legalName') as HTMLInputElement
    expect(razon, 'no se encontró la razón social').toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(razon, 'CLIENTE DE PRUEBA')
      razon.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const guardar = [...div.querySelectorAll('button')]
      .find(b => (b.textContent ?? '').includes('Crear cliente'))
    expect(guardar, 'no se encontró el botón de crear').toBeTruthy()
    await act(async () => {
      guardar!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })

    expect(createCustomer).toHaveBeenCalled()
    const dto = createCustomer.mock.calls[0][0] as any
    expect(dto.legalName).toBe('CLIENTE DE PRUEBA')
    expect(dto.taxTreatment).toBeUndefined()
    // Y lo que SÍ decide el IVA sigue viajando.
    expect(dto.taxCode).toBe('IVA12')
  })

  /**
   * Y quien YA estaba marcado como retenedor conserva su tarjeta: el
   * tratamiento se carga del cliente aunque ya no se pregunte.
   */
  it('un cliente retenedor conserva su tarjeta de retención de IVA', async () => {
    getCustomer.mockResolvedValue({
      id: 'cli-9', name: 'ESTADO', legalName: 'ENTIDAD PÚBLICA',
      taxTreatment: 'gobierno', ivaRetentionCode: 'IVARET65',
      contacts: [], type: 'company', currency: 'GTQ',
    })

    await dibujar('/ventas/clientes/cli-9/editar')
    await abrirImpuestos()

    expect(div.textContent).toContain('Retención de IVA')
    expect(div.textContent).not.toContain('Tratamiento fiscal')
  })
})
