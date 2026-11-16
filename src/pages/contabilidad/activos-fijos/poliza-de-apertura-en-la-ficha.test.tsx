import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ActivoFijoDetallePage from './ActivoFijoDetallePage'

/**
 * La póliza de un activo cargado como saldo inicial, en su propia ficha.
 *
 * La ficha tiene su sección de pólizas, con el detalle de las líneas y un
 * enlace para abrirla en Contabilidad. Mostraba las del alta, la venta y la
 * baja — pero filtraba la de MIGRACIÓN, que es justamente la de un activo
 * cargado como saldo inicial. El equipo de computación de LUUM se veía sin
 * ninguna póliza y el único camino era ir a buscarla a mano a Diarios
 * Manuales.
 */
const ACTIVO = {
  id: 'af-1', assetNumber: '30001', name: 'Equipo de computación',
  estado: 'ACTIVO', claseActivoFijoId: 'clase-3000',
  acquisitionDate: '2025-12-31',
  originalCost: 62771.43, salvageValue: 0,
  accumulatedDepreciation: 61424.46, currentBookValue: 1346.97,
  depreciacionMensual: 1743.65,
}

/** La que generó la activación: Dr costo / Cr dep. acumulada / Cr saldos iniciales. */
const POLIZA_DE_APERTURA = {
  id: 'je-apertura', entryNumber: 'POL-2026-00146',
  entryDate: '2025-12-31', sourceDocumentType: 'activo_fijo_migracion',
  totalDebit: 62771.43, totalCredit: 62771.43,
  lines: [
    { id: 'l1', accountCode: '160005', accountName: 'Equipo de Cómputo',        debit: 62771.43, credit: 0 },
    { id: 'l2', accountCode: '160010', accountName: 'Dep. Acumulada — Cómputo', debit: 0, credit: 61424.46 },
    { id: 'l3', accountCode: '800001', accountName: 'Cuentas de Orden',         debit: 0, credit: 1346.97 },
  ],
}

const CLASE = {
  id: 'clase-3000', codigo: '3000', nombre: 'EQUIPO DE COMPUTACIÓN',
  tasaDepreciacionAnual: 0.3333, vidaUtilMeses: 36, esNoDepreciable: false,
}

vi.mock('../../../api/activos-fijos', () => ({
  getActivoFijo:             vi.fn(async () => ACTIVO),
  getHistorialDepreciacion:  vi.fn(async () => []),
  getPolizasActivoFijo:      vi.fn(async () => [POLIZA_DE_APERTURA]),
  depreciarActivo: vi.fn(), activarActivoFijo: vi.fn(), actualizarActivoFijo: vi.fn(),
  venderActivoFijo: vi.fn(), darDeBajaActivoFijo: vi.fn(),
  revertirVentaActivoFijo: vi.fn(), revertirBajaActivoFijo: vi.fn(),
  revertirActivacionActivoFijo: vi.fn(), eliminarActivoFijo: vi.fn(),
}))
vi.mock('../../../api/clases-activo-fijo', () => ({
  getClasesActivoFijo: vi.fn(async () => [CLASE]),
}))
vi.mock('../../../api/catalogo', () => ({ getAccounts: vi.fn(async () => []) }))
vi.mock('../../../api/axios',    () => ({ getApiError: (e: any) => String(e) }))
vi.mock('echarts-for-react',     () => ({ default: () => null }))
vi.mock('../../../components/SelectorDimensionesAnaliticas', () => ({
  default: () => null,
  useCentrosOptions: () => [[], []],
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/contabilidad/activos-fijos/af-1']}>
        <Routes>
          <Route path="/contabilidad/activos-fijos/:id" element={<ActivoFijoDetallePage />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => { await Promise.resolve() })
}

beforeEach(async () => { await render() })
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('la ficha de un activo cargado como saldo inicial', () => {
  it('muestra su póliza de apertura', () => {
    expect(host.textContent).toContain('Póliza de apertura')
    expect(host.textContent).toContain('POL-2026-00146')
  })

  it('con las tres líneas del asiento', () => {
    expect(host.textContent).toContain('160005')
    expect(host.textContent).toContain('160010')
    expect(host.textContent).toContain('800001')
  })

  /** La fecha es la de adquisición del activo, no la del día en que se activó. */
  it('fechada el día en que el activo entró a los libros', () => {
    expect(host.textContent).toContain('31/12/2025')
  })

  it('con enlace para abrirla en Contabilidad', () => {
    const verPoliza = Array.from(host.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Ver póliza'))

    expect(verPoliza).toBeTruthy()
  })
})
