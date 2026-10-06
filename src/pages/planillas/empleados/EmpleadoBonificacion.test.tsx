import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * El campo de bonificación adicional en la ficha del empleado.
 *
 * La ley fija Q250 (Dto. 78-89) y ese monto vive en Parámetros fiscales. Hay
 * empleados con Q750 o Q1,500 pactados. El campo guarda el EXTRA, no el total
 * —así, si el monto de ley cambia, la planilla se ajusta sola— y el riesgo
 * obvio es que alguien escriba ahí el total y le pague Q1,000 al empleado.
 * Por eso la ayuda del campo arma la cuenta a la vista: «Q 250.00 de ley +
 * Q 500.00 = Q 750.00 al mes».
 */
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'nuevo' }),
}))
vi.mock('../../../components/SelectorDimensionesAnaliticas', () => ({ default: () => null }))

const getParametroFiscal = vi.fn(async (_anio: number) => ({ montoBonificacionIncentivo: 250 }))
vi.mock('../../../api/planillas', () => ({ getParametroFiscal: (a: number) => getParametroFiscal(a) }))

const crearEmpleado = vi.fn(async (dto: any) => ({ id: 'e-1', ...dto, advertenciaSalarioMinimo: null }))
vi.mock('../../../api/planillas-empleados', () => ({
  getEmpleado: vi.fn(async () => null),
  crearEmpleado: (dto: any) => crearEmpleado(dto),
  actualizarEmpleado: vi.fn(async () => ({})),
  cambiarSalario: vi.fn(async () => ({})),
  descargarContratoLaboral: vi.fn(), descargarConstanciaLaboral: vi.fn(),
  getCentrosTrabajo: vi.fn(async () => []),
  getAusenciasEmpleado: vi.fn(async () => []),
  guardarAusenciaEmpleado: vi.fn(), eliminarAusenciaEmpleado: vi.fn(),
  getGocesVacaciones: vi.fn(async () => []),
  guardarGoceVacaciones: vi.fn(), eliminarGoceVacaciones: vi.fn(),
  nombreCompleto: (e: any) => `${e.primerNombre} ${e.primerApellido}`,
}))

import EmpleadoFormPage from './EmpleadoFormPage'

describe('Bonificación adicional en la ficha del empleado', () => {
  let cont: HTMLDivElement
  let root: Root

  const pintar = async () => {
    await act(async () => { root.render(<EmpleadoFormPage />) })
    await act(async () => { await Promise.resolve() })
  }

  /** El input de un Form.Item de AntD, por su etiqueta */
  const campoPorEtiqueta = (etiqueta: string) => {
    const label = [...cont.querySelectorAll('label')].find(l => l.textContent?.includes(etiqueta))
    const item = label?.closest('.ant-form-item')
    return item?.querySelector('input') as HTMLInputElement | undefined
  }
  const ayudaDe = (etiqueta: string) => {
    const label = [...cont.querySelectorAll('label')].find(l => l.textContent?.includes(etiqueta))
    return label?.closest('.ant-form-item')?.querySelector('.ant-form-item-extra')?.textContent ?? ''
  }

  beforeEach(() => {
    cont = document.createElement('div')
    document.body.appendChild(cont)
    root = createRoot(cont)
  })
  afterEach(() => {
    act(() => root.unmount())
    cont.remove()
    vi.clearAllMocks()
  })

  it('el alta de un empleado ofrece el campo', async () => {
    await pintar()

    expect(campoPorEtiqueta('Bonificación adicional')).toBeTruthy()
  })

  it('en blanco dice que el empleado solo lleva la de ley', async () => {
    await pintar()

    expect(ayudaDe('Bonificación adicional')).toBe('Solo la de ley: Q 250.00 al mes')
  })

  it('con Q500 arma la cuenta para que no se confunda con el total', async () => {
    await pintar()
    const input = campoPorEtiqueta('Bonificación adicional')!

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '500')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(ayudaDe('Bonificación adicional')).toBe('Q 250.00 de ley + Q 500.00 = Q 750.00 al mes')
  })

  it('si no hay parámetros fiscales del año, el campo sigue sirviendo', async () => {
    getParametroFiscal.mockRejectedValueOnce(new Error('sin parámetros'))

    await pintar()

    expect(campoPorEtiqueta('Bonificación adicional')).toBeTruthy()
    expect(ayudaDe('Bonificación adicional')).toContain('POR ENCIMA')
  })
})
