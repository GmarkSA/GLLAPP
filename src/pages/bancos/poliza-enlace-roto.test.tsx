import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TransaccionesPage from './TransaccionesPage'

/**
 * Un movimiento enlazado a una póliza que ya no existe.
 *
 * El movimiento guarda el id de su póliza como atajo. Si esa póliza se borró
 * —o se limpió por migración, o se perdió a medio camino—, el atajo apunta a
 * la nada y el movimiento se queda en el peor estado posible: dice tener
 * contabilidad y no la tiene.
 *
 * El modal pedía el asiento por ese id, recibía 404 y se detenía ahí: «No se
 * pudo consultar la póliza» y un botón de Cerrar. Sin salida. Y en el listado
 * el ícono seguía azul —«ver póliza»— en vez de naranja, así que nada
 * indicaba que faltara nada. Así quedaron dos movimientos de enero de LUUM,
 * que solo aparecieron cuando la revaluación encontró Q 9,173.64 de descuadre.
 *
 * El id del atajo es un dato de conveniencia; la pregunta de verdad es «¿cuál
 * es la póliza de ESTE movimiento?», y esa la contesta el servidor por el
 * movimiento. Si responde que ninguna, el movimiento está sin contabilizar y
 * lo que toca ofrecer es generarla.
 */
const CUENTA = {
  id: 'cta-1', name: 'Luum USD', bankName: 'Banco Industrial', accountNumber: 'USD-69',
  currency: 'USD', accountType: 'MONETARIA', type: 'MONETARIA', status: 'active',
  currentBalance: 0, openingBalance: 0,
  glAccountId: 'gl-banco', glAccountCode: '114001', glAccountName: 'Banco USD',
}

/** Enlazado a POL-??? que ya no existe: el 404 del log de producción. */
const POLIZA_MUERTA = 'db6696b6-84d5-4c63-97e1-79ef66280a81'

const MOVIMIENTO = {
  id: 'tx-enero', bankAccountId: 'cta-1',
  transactionDate: '2026-01-29', description: 'PAGO PROVEEDOR', reference: '990011',
  amount: 1025, currency: 'USD', exchangeRate: 7.66777, baseAmount: 7855.46,
  type: 'debit', status: 'reconciled',
  accountId: 'gl-gasto', accountCode: '510001', accountName: 'Gastos',
  matchedJournalEntryId: POLIZA_MUERTA, runningBalance: 0,
}

const POLIZA_NUEVA = {
  id: 'je-nueva', entryNumber: 'POL-00140', entryDate: '2026-01-29', status: 'posted',
  exchangeRate: 7.66777, totalDebit: 7855.46, totalCredit: 7855.46,
  lines: [
    { accountCode: '510001', accountName: 'Gastos',    debit: 7855.46, credit: 0 },
    { accountCode: '114001', accountName: 'Banco USD', debit: 0, credit: 7855.46 },
  ],
}

vi.mock('../../api/bancos', () => ({
  ACCOUNT_TYPE_CONFIG: { MONETARIA: { label: 'Monetaria', color: '#1B3A6B' } },
  TRANSACTION_STATUS_CONFIG: {
    pending:     { label: 'Pendiente',    color: '#888' },
    categorized: { label: 'Categorizada', color: '#1faec2' },
    reconciled:  { label: 'Conciliada',   color: '#2ea172' },
    matched:     { label: 'Coincidencia', color: '#2f54eb' },
    excluded:    { label: 'Excluida',     color: '#aaa' },
    voided:      { label: 'Anulada',      color: '#e5484d' },
  },
  getBankAccount:  vi.fn(async () => CUENTA),
  getTransactions: vi.fn(async () => ({ data: [MOVIMIENTO], total: 1 })),
  getPolizaDelMovimiento:     vi.fn(async () => null),
  generarPolizaDelMovimiento: vi.fn(async () => POLIZA_NUEVA),
  updateTransaction: vi.fn(async () => MOVIMIENTO),
  addTransaction: vi.fn(), deleteTransaction: vi.fn(), importStatement: vi.fn(),
  autoMatchReconciliation: vi.fn(), getReconciliationSummary: vi.fn(async () => ({})),
  approveReconciliationPeriod: vi.fn(), listReconciliationPeriods: vi.fn(async () => []),
  reabrirReconciliationPeriod: vi.fn(), saveReconciliationPeriod: vi.fn(),
  sendEmailConciliacion: vi.fn(), downloadConciliacionPdf: vi.fn(),
}))
vi.mock('../../api/asientos', () => ({
  // Lo que respondió producción: el asiento del atajo no existe.
  getAsiento: vi.fn(async () => { throw { response: { status: 404, data: { message: 'Not Found' } } } }),
  updateAsiento: vi.fn(), postAsiento: vi.fn(), voidAsiento: vi.fn(),
}))
vi.mock('../../api/monedas', () => ({
  getExchangeRateForDate: vi.fn(async () => ({ rate: 0.13041, officialRate: 7.66777 })),
  tipoDeCambioOficial: (r: any) => Number(r?.officialRate) || 1,
}))
vi.mock('../../api/facturas',        () => ({ getInvoice: vi.fn() }))
vi.mock('../../api/compras',         () => ({ getBill: vi.fn(), recordBillPayment: vi.fn() }))
vi.mock('../../api/pagos-recibidos', () => ({ createPagoRecibido: vi.fn() }))
vi.mock('./CategorizarDrawer', () => ({ default: () => null }))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/bancos/cuentas/cta-1']}>
        <Routes><Route path="/bancos/cuentas/:id" element={<TransaccionesPage />} /></Routes>
      </MemoryRouter>,
    )
  })
}

const click = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

const botonDePoliza = () =>
  Array.from(host.querySelectorAll('tbody button'))
    .find(b => b.querySelector('.anticon-file-text'))!

const abrirLaPoliza = async () => {
  await click(botonDePoliza())
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })
}

const botonGenerar = () =>
  Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.includes('Generar la póliza'))

beforeEach(async () => {
  const { getPolizaDelMovimiento, generarPolizaDelMovimiento } = await import('../../api/bancos')
  vi.mocked(getPolizaDelMovimiento).mockClear()
  vi.mocked(generarPolizaDelMovimiento).mockClear()
  vi.mocked(getPolizaDelMovimiento).mockResolvedValue(null)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
})

describe('un movimiento enlazado a una póliza que ya no existe', () => {
  it('le pregunta al movimiento cuál es su póliza, no se queda en el 404', async () => {
    const { getPolizaDelMovimiento } = await import('../../api/bancos')
    await render()
    await abrirLaPoliza()

    expect(vi.mocked(getPolizaDelMovimiento)).toHaveBeenCalledWith('cta-1', 'tx-enero')
  })

  it('dice que no tiene póliza contable y deja generarla', async () => {
    await render()
    await abrirLaPoliza()

    expect(document.body.textContent).toContain('no tiene póliza contable')
    expect(botonGenerar()).toBeTruthy()
  })

  /** El callejón sin salida: el error del atajo no puede ser la última palabra. */
  it('no se queda en «No se pudo consultar la póliza»', async () => {
    await render()
    await abrirLaPoliza()

    expect(document.body.textContent).not.toContain('No se pudo consultar la póliza')
  })

  it('el botón la genera contra el movimiento', async () => {
    const { generarPolizaDelMovimiento } = await import('../../api/bancos')
    await render()
    await abrirLaPoliza()
    await click(botonGenerar()!)
    await act(async () => { await Promise.resolve() })

    expect(vi.mocked(generarPolizaDelMovimiento)).toHaveBeenCalledWith('cta-1', 'tx-enero')
    expect(document.body.textContent).toContain('7,855.46')
  })
})

describe('cuando el atajo está viejo pero la póliza existe', () => {
  /**
   * El enlace apunta a un id que ya no está, pero el servidor SÍ encuentra la
   * póliza del movimiento por su origen. Entonces se muestra esa: ofrecer
   * generar otra contabilizaría el mismo movimiento dos veces.
   */
  it('muestra la que el servidor encontró, sin ofrecer generar otra', async () => {
    const { getPolizaDelMovimiento } = await import('../../api/bancos')
    vi.mocked(getPolizaDelMovimiento).mockResolvedValue({
      ...POLIZA_NUEVA, id: 'je-existente', entryNumber: 'POL-00123',
    } as any)

    await render()
    await abrirLaPoliza()

    expect(document.body.textContent).toContain('POL-00123')
    expect(botonGenerar()).toBeFalsy()
  })
})

describe('cuando ni el movimiento tiene respuesta', () => {
  /** Si la consulta por el movimiento también falla, se dice qué respondió. */
  it('muestra el error del servidor', async () => {
    const { getPolizaDelMovimiento } = await import('../../api/bancos')
    vi.mocked(getPolizaDelMovimiento).mockRejectedValue({
      response: { status: 500, data: { error: { message: 'Internal server error' } } },
    })

    await render()
    await abrirLaPoliza()

    const texto = document.body.textContent ?? ''
    expect(texto).toContain('No se pudo consultar la póliza')
    expect(texto).not.toContain('NaN')
  })
})
