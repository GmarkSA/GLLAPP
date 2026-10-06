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
/** 'nuevo' = alta; un uuid = ficha de un empleado que ya existe */
let idEnLaRuta = 'nuevo'
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: idEnLaRuta }),
}))
vi.mock('../../../components/SelectorDimensionesAnaliticas', () => ({ default: () => null }))

const getParametroFiscal = vi.fn(async (_anio: number) => ({ montoBonificacionIncentivo: 250 }))
vi.mock('../../../api/planillas', () => ({ getParametroFiscal: (a: number) => getParametroFiscal(a) }))

/** Nery, de la planilla real: Q4,250 de sueldo y Q750 de bono decreto */
const EMPLEADO_EXISTENTE = {
  id: 'e-1', codigo: 'E-001', primerNombre: 'Nery', primerApellido: 'Colorado',
  estado: 'ACTIVO', fechaAlta: '2021-04-01', tipoJornada: 'DIURNA',
  metodoPago: 'EFECTIVO', salarioVigente: 4250, salarioDesde: '2021-04-01',
  bonificacionAdicionalVigente: 500,
  historialSalarios: [{
    id: 'c-1', empleadoId: 'e-1', fechaInicio: '2021-04-01', fechaFin: null,
    salarioOrdinarioMensual: 4250, bonificacionAdicional: 500,
    motivoCambio: 'ALTA', tipoContrato: 'INDEFINIDO',
    fechaFinPactada: null, horarioTrabajo: null, notas: null, createdAt: '2021-04-01',
  }],
}

const crearEmpleado = vi.fn(async (dto: any) => ({ id: 'e-1', ...dto, advertenciaSalarioMinimo: null }))
vi.mock('../../../api/planillas-empleados', () => ({
  getEmpleado: vi.fn(async () => EMPLEADO_EXISTENTE),
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
    idEnLaRuta = 'nuevo'
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

  /**
   * Lo que reportó el dueño: «veo el cambio, pero no me habilita el campo».
   * Los empleados a los que hay que ponerles la bonificación YA EXISTEN —
   * no se van a dar de alta otra vez. En su ficha el campo no aparecía por
   * ningún lado: estaba solo en el bloque del alta.
   */
  describe('en la ficha de un empleado que ya existe', () => {
    beforeEach(() => { idEnLaRuta = 'e-1' })

    it('muestra la bonificación que tiene pactada hoy', async () => {
      await pintar()

      expect(cont.textContent).toContain('Bonificación adicional')
      expect(cont.textContent).toContain('Q 500.00')
    })

    it('deja ver cuánto le queda en total al mes', async () => {
      await pintar()

      expect(cont.textContent).toContain('Q 750.00')
    })

    it('ofrece el botón para cambiarla', async () => {
      await pintar()

      const botones = [...cont.querySelectorAll('button')].map(b => b.textContent ?? '')
      expect(botones.some(t => t.includes('bonificación'))).toBe(true)
    })
  })
})
