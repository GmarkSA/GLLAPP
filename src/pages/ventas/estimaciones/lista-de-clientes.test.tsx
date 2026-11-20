import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * «En cotizaciones no despliega la lista de clientes que tiene el sistema.»
 *
 * Esta prueba dibuja la pantalla de una cotización nueva y abre el desplegable
 * de Cliente, sin escribir nada — que es lo que hace quien va a cotizar.
 *
 * Los tres clientes que devuelve el servidor tienen que estar ahí.
 */
const clientes = [
  { id: 'c1', name: 'TCH',  legalName: 'The Conscious Home LLC', taxId: '812898460' },
  { id: 'c2', name: 'LUUM', legalName: 'LUUM Sociedad Anónima',  taxId: '92371872' },
  { id: 'c3', name: 'ADA',  legalName: 'Consumidor Final',       taxId: 'CF' },
]

const getCustomers = vi.fn()

vi.mock('../../../api/contactos', () => ({
  getCustomers: (p: any) => getCustomers(p),
  getCustomer:  vi.fn(() => Promise.resolve(clientes[0])),
}))
vi.mock('../../../api/impuestos', () => ({ getTaxes: vi.fn(() => Promise.resolve([])) }))
vi.mock('../../../api/facturas', async (original) => ({
  ...(await original<any>()),
  /**
   * La cotización llega DESPUÉS de la lista de clientes, como en la vida real:
   * son dos peticiones y la del documento es la más lenta. Ese es justo el
   * orden en que el cliente de la cotización borraba la lista.
   */
  getEstimate: vi.fn(() => new Promise(resolve => setTimeout(() => resolve({
    id: 'e1', estimateNumber: 'COT-0001', status: 'draft',
    customerId: 'c2', customerName: 'LUUM Sociedad Anónima',
    estimateDate: '2026-11-19', currency: 'GTQ', items: [],
  }), 25))),
}))
vi.mock('../../../api/inventario', () => ({
  getProduct:  vi.fn(() => Promise.resolve(null)),
  getProducts: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../../components/SelectorDimensionesAnaliticas', () => ({
  __esModule: true,
  default: () => null,
}))

describe('el desplegable de clientes de una cotización nueva', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    getCustomers.mockReset()
    getCustomers.mockImplementation(() => Promise.resolve({ data: clientes, total: 3 }))
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    // Ant Design cuelga los desplegables del body, fuera de nuestro div: sin
    // barrerlos, la prueba siguiente lee las opciones que dejó la anterior y
    // pasa sin haber probado nada.
    document.querySelectorAll('.ant-select-dropdown').forEach(e => e.closest('div[style]')?.remove())
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujar = async (ruta = '/ventas/estimaciones/nueva') => {
    const { default: EstimacionFormPage } = await import('./EstimacionFormPage')
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[ruta]}>
          {/*
            * Con rutas de verdad: `useParams` solo devuelve el id si la
            * pantalla se monta DENTRO de su ruta. Sin esto, la prueba del modo
            * edición dibujaba una cotización nueva y no probaba nada.
            */}
          <Routes>
            <Route path="/ventas/estimaciones/nueva"      element={<EstimacionFormPage />} />
            <Route path="/ventas/estimaciones/:id/editar" element={<EstimacionFormPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => { await Promise.resolve() })
  }

  /** Lo primero: la pantalla pide los clientes al abrirse, sin que nadie escriba. */
  it('pide los clientes al abrir la pantalla', async () => {
    await dibujar()

    expect(getCustomers).toHaveBeenCalled()
  })

  /**
   * Abre el desplegable de Cliente y devuelve el texto de sus opciones.
   *
   * Se lo busca por lo que muestra: el texto de ayuda cuando está vacío, o el
   * nombre del cliente de la cotización cuando ya tiene uno.
   */
  const abrirClientes = async (): Promise<string[]> => {
    const caja = [...div.querySelectorAll('.ant-select')].find(e => {
      const t = e.textContent ?? ''
      return t.includes('Razón Social') || t.includes('LUUM Sociedad Anónima')
    })
    expect(caja, 'no se encontró el desplegable de Cliente').toBeTruthy()
    await act(async () => {
      caja!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
    return [...document.querySelectorAll('.ant-select-item-option')]
      .map(e => (e.textContent ?? '').trim())
      .filter(t => t.length > 0)
  }

  /** Y lo que el servidor devolvió tiene que quedar en las opciones del Select. */
  it('deja los clientes del servidor en el desplegable', async () => {
    await dibujar()

    const opciones = await abrirClientes()

    expect(opciones.join(' | ')).toContain('The Conscious Home LLC')
    expect(opciones.join(' | ')).toContain('LUUM Sociedad Anónima')
  })

  /**
   * Veinte clientes no son «la lista de clientes del sistema»: con una cartera
   * de más de veinte, el desplegable mostraba un trozo arbitrario.
   */
  it('pide una lista larga, no veinte', async () => {
    await dibujar()

    expect(getCustomers).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
  })

  /** Y se leen ordenados por lo que se ve, no por fecha de creación. */
  it('ordena el desplegable por razón social', async () => {
    await dibujar()

    const opciones = await abrirClientes()

    expect(opciones).toEqual([
      'Consumidor FinalADA',            // la razón social y, debajo, el comercial
      'LUUM Sociedad AnónimaLUUM',
      'The Conscious Home LLCTCH',
    ])
  })

  /**
   * Al editar, el cliente de la cotización se agrega a la lista en lugar de
   * reemplazarla: antes el desplegable se quedaba con uno solo.
   */
  it('al editar sigue mostrando a los demás clientes', async () => {
    await dibujar('/ventas/estimaciones/e1/editar')
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })

    const opciones = await abrirClientes()

    expect(opciones.join(' | ')).toContain('The Conscious Home LLC')
    expect(opciones.join(' | ')).toContain('Consumidor Final')
  })
})
