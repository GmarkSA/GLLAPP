import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * El interruptor de ISR proyectado en la corrida de planilla.
 *
 * Caso de LUUM: el patrono registró en RetenISR del SAT una proyección por
 * empleado y descuenta ese monto fijo todos los meses, mientras Lucía venía
 * calculando el ISR real. El interruptor decide cuál se usa, y la columna de
 * ISR se puede escribir a mano cuando ninguno de los dos da lo presentado.
 */
let periodo: any
const cambiarMetodoIsrPlanilla = vi.fn(async (_id: string, usar: boolean) => ({ ...periodo, usarIsrProyectado: usar }))
const actualizarDetallePlanilla = vi.fn(async () => periodo)

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'p-1' }),
}))
vi.mock('../../../api/bancos', () => ({ getBankAccounts: vi.fn(async () => []) }))
vi.mock('../../../api/axios', () => ({
  default: {}, getApiError: (_e: unknown, d: string) => d,
}))
vi.mock('../../../api/planillas-corrida', () => ({
  getPeriodoPlanilla: vi.fn(async () => periodo),
  recalcularPeriodoPlanilla: vi.fn(async () => periodo),
  actualizarDetallePlanilla: (...a: any[]) => (actualizarDetallePlanilla as any)(...a),
  cambiarMetodoIsrPlanilla: (id: string, u: boolean) => cambiarMetodoIsrPlanilla(id, u),
  aprobarPeriodoPlanilla: vi.fn(), eliminarPeriodoPlanilla: vi.fn(),
  contabilizarPeriodoPlanilla: vi.fn(), pagarPeriodoPlanilla: vi.fn(),
  previsualizarAsientoPlanilla: vi.fn(async () => null),
  anularPagoPlanilla: vi.fn(), anularPlanilla: vi.fn(),
  descargarBoletaPago: vi.fn(),
}))

import CorridaPlanillaPage from './CorridaPlanillaPage'

/** Nery, de la planilla real de LUUM: Q39.74 proyectados en RetenISR */
const linea = (extra: Record<string, unknown> = {}) => ({
  id: 'd-1', empleadoId: 'e-1', empleadoCodigo: 'E-001', empleadoNombre: 'Nery Colorado',
  tipoJornada: 'DIURNA', metodoPago: 'EFECTIVO', bancoCodigo: null, bancoNombre: null,
  numeroCuentaBancaria: null, salarioMensual: 4250, diasTrabajados: 31, salarioDevengado: 4250,
  horasExtraHabil: 0, horasExtraEspecial: 0, montoHorasExtra: 0,
  bonificacionIncentivo: 750, bonificacionAdicional: 500, otrosIngresos: 0,
  otrosIngresosDescripcion: null, totalDevengado: 5000, baseIGSS: 4250,
  cuotaIGSSLaboral: 205.28, isrRetenido: 39.74, isrManual: false,
  otrasDeducciones: 0, otrasDeduccionesDescripcion: null, totalDeducciones: 245.02,
  netoAPagar: 4754.98, cuotaPatronalIGSS: 0, cuotaINTECAP: 0, cuotaIRTRA: 0,
  provisionAguinaldo: 0, provisionBono14: 0, provisionVacaciones: 0, provisionIndemnizacion: 0,
  centroCostoId: null, centroBeneficioId: null, advertencias: null, ...extra,
})

const corrida = (extra: Record<string, unknown> = {}, lineas = [linea()]) => ({
  id: 'p-1', anio: 2026, mes: 10, quincena: 2, periodicidad: 'MENSUAL', tipo: 'ORDINARIA',
  fechaInicio: '2026-10-01', fechaFin: '2026-10-31', estado: 'BORRADOR',
  usarIsrProyectado: false, totalDevengado: 5000, totalDeducciones: 245.02, totalNeto: 4754.98,
  totalCuotaPatronal: 0, totalEmpleados: 1, notas: null, aprobadoAt: null, aprobadoPor: null,
  asientoContableId: null, contabilizadoAt: null, contabilizadoPor: null, asientoPagoId: null,
  bankAccountId: null, pagadoAt: null, pagadoPor: null, detalles: lineas, ...extra,
})

describe('ISR proyectado en la corrida de planilla', () => {
  let cont: HTMLDivElement
  let root: Root

  const pintar = async () => {
    await act(async () => { root.render(<CorridaPlanillaPage />) })
    await act(async () => { await Promise.resolve() })
  }
  const interruptor = () =>
    [...cont.querySelectorAll('.ant-switch')].find(
      s => s.closest('.ant-space')?.textContent?.includes('ISR proyectado'),
    ) as HTMLElement | undefined

  beforeEach(() => {
    periodo = corrida()
    cont = document.createElement('div')
    document.body.appendChild(cont)
    root = createRoot(cont)
  })
  afterEach(() => {
    act(() => root.unmount())
    cont.remove()
    vi.clearAllMocks()
  })

  it('ofrece el interruptor en una planilla en borrador', async () => {
    await pintar()

    expect(interruptor()).toBeTruthy()
    expect(interruptor()!.className).not.toContain('ant-switch-checked')
  })

  it('al encenderlo pide usar el monto registrado en SAT', async () => {
    await pintar()

    await act(async () => { interruptor()!.click() })

    expect(cambiarMetodoIsrPlanilla).toHaveBeenCalledWith('p-1', true)
  })

  it('se ve encendido cuando la corrida ya está en proyectado', async () => {
    periodo = corrida({ usarIsrProyectado: true })

    await pintar()

    expect(interruptor()!.className).toContain('ant-switch-checked')
  })

  it('no aparece en la 1ra quincena, que no retiene ISR', async () => {
    periodo = corrida({ quincena: 1, periodicidad: 'QUINCENAL' })

    await pintar()

    expect(interruptor()).toBeFalsy()
  })

  it('no aparece en Bono 14, que es exento', async () => {
    periodo = corrida({ quincena: 0, tipo: 'BONO14' })

    await pintar()

    expect(interruptor()).toBeFalsy()
  })

  it('una planilla aprobada ya no deja cambiarlo', async () => {
    periodo = corrida({ estado: 'APROBADA' })

    await pintar()

    expect(interruptor()).toBeFalsy()
  })

  describe('la columna de ISR', () => {
    it('se puede escribir a mano', async () => {
      await pintar()

      const inputs = [...cont.querySelectorAll('input.ant-input-number-input')]
      const isr = inputs.find(i => (i as HTMLInputElement).value === '39.74') as HTMLInputElement
      expect(isr).toBeTruthy()

      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
        setter.call(isr, '50')
        isr.dispatchEvent(new Event('input', { bubbles: true }))
        // React escucha focusout, no blur: blur no burbujea
        isr.dispatchEvent(new Event('focusout', { bubbles: true }))
      })

      expect(actualizarDetallePlanilla).toHaveBeenCalledWith('d-1', { isrRetenido: 50 })
    })

    it('una línea escrita a mano lo avisa y deja volver al automático', async () => {
      periodo = corrida({}, [linea({ isrManual: true, isrRetenido: 123.45 })])

      await pintar()

      const marca = [...cont.querySelectorAll('button')].find(b => b.textContent?.includes('manual'))
      expect(marca).toBeTruthy()

      await act(async () => { marca!.click() })

      expect(actualizarDetallePlanilla).toHaveBeenCalledWith('d-1', { isrManual: false })
    })
  })
})
