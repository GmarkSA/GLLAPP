import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TransaccionesPage from './TransaccionesPage'
import { generarPolizaDelMovimiento } from '../../api/bancos'

const generar = vi.mocked(generarPolizaDelMovimiento)

/**
 * Un movimiento categorizado SIN póliza tiene que poder abrirse y arreglarse.
 *
 * Caso de LUUM: el ingreso INTERNACIONAL de USD 6,228 quedó «Categorizada» con
 * el botón de la póliza apagado. Al categorizar contra una cuenta de mayor, la
 * pantalla guarda el movimiento y solo avisa si el asiento no se pudo crear, de
 * modo que el movimiento se queda categorizado y sin contabilidad. Apagar el
 * botón dejaba al usuario sin salida justo en ese caso: la única forma de
 * recuperarlo era volver a categorizar.
 */
const CUENTA = {
  id: 'cta-1', name: 'Luum USD', bankName: 'Banco Industrial', accountNumber: 'USD-69',
  currency: 'USD', accountType: 'MONETARIA', type: 'MONETARIA', status: 'active', currentBalance: 6296.54,
  openingBalance: 0, glAccountId: 'gl-banco', glAccountCode: '114001', glAccountName: 'Banco USD',
}

const MOVIMIENTO = {
  id: 'tx-6228', bankAccountId: 'cta-1',
  transactionDate: '2026-01-09', description: 'INTERNACIONAL', reference: '132411',
  amount: 6228, currency: 'USD', exchangeRate: 1, baseAmount: 6228,
  type: 'credit', status: 'categorized',
  accountId: 'gl-ingreso', accountCode: '410001', accountName: 'Ingresos',
  matchedJournalEntryId: null, runningBalance: 6296.54,
}

vi.mock('../../api/bancos', () => ({
  ACCOUNT_TYPE_CONFIG: { MONETARIA: { label: 'Monetaria', color: '#1B3A6B' } },
  TRANSACTION_STATUS_CONFIG: {
    pending:      { label: 'Pendiente',    color: '#888' },
    categorized:  { label: 'Categorizada', color: '#1faec2' },
    reconciled:   { label: 'Conciliada',   color: '#2ea172' },
    matched:      { label: 'Coincidencia', color: '#2f54eb' },
    excluded:     { label: 'Excluida',     color: '#aaa' },
    voided:       { label: 'Anulada',      color: '#e5484d' },
  },
  getBankAccount:  vi.fn(async () => CUENTA),
  getTransactions: vi.fn(async () => ({ data: [MOVIMIENTO], total: 1 })),
  getPolizaDelMovimiento:    vi.fn(async () => null),
  generarPolizaDelMovimiento: vi.fn(async () => ({
    id: 'je-nueva', entryNumber: 'POL-00051', entryDate: '2026-01-09', status: 'posted',
    exchangeRate: 7.663361, totalDebit: 47727.41, totalCredit: 47727.41,
    lines: [
      { accountCode: '114001', accountName: 'Banco USD', debit: 47727.41, credit: 0 },
      { accountCode: '410001', accountName: 'Ingresos',  debit: 0, credit: 47727.41 },
    ],
  })),
  updateTransaction: vi.fn(async () => MOVIMIENTO),
  addTransaction: vi.fn(), deleteTransaction: vi.fn(), importStatement: vi.fn(),
  autoMatchReconciliation: vi.fn(), getReconciliationSummary: vi.fn(async () => ({})),
  approveReconciliationPeriod: vi.fn(), listReconciliationPeriods: vi.fn(async () => []),
  reabrirReconciliationPeriod: vi.fn(), saveReconciliationPeriod: vi.fn(),
  sendEmailConciliacion: vi.fn(), downloadConciliacionPdf: vi.fn(),
}))
vi.mock('../../api/asientos', () => ({
  getAsiento: vi.fn(async () => null), updateAsiento: vi.fn(),
  postAsiento: vi.fn(), voidAsiento: vi.fn(),
}))
vi.mock('../../api/monedas', () => ({
  getExchangeRateForDate: vi.fn(async () => ({ rate: 0.13049, officialRate: 7.663361 })),
  tipoDeCambioOficial: (r: any) => Number(r?.officialRate) || 1,
}))
vi.mock('../../api/facturas',        () => ({ getInvoice: vi.fn() }))
vi.mock('../../api/compras',         () => ({ getBill: vi.fn(), recordBillPayment: vi.fn() }))
vi.mock('../../api/pagos-recibidos', () => ({ createPagoRecibido: vi.fn() }))
// El cajón de categorizar no es lo que se prueba aquí: solo tiene que montar.
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
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** El botón de la póliza es el primero de la fila de acciones. */
const botonDePoliza = () =>
  Array.from(host.querySelectorAll('tbody button'))
    .find(b => b.querySelector('.anticon-file-text'))!

const abrirLaPoliza = async () => {
  await click(botonDePoliza())
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => { generar.mockClear() })
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('un movimiento categorizado sin póliza', () => {
  it('deja abrir su póliza: el botón no está deshabilitado', async () => {
    await render()
    expect(botonDePoliza().hasAttribute('disabled')).toBe(false)
  })

  it('al abrirlo dice que no tiene póliza contable', async () => {
    await render()
    await abrirLaPoliza()
    expect(document.body.textContent).toContain('no tiene póliza contable')
  })

  it('anticipa cómo quedaría contabilizado', async () => {
    await render()
    await abrirLaPoliza()
    const texto = document.body.textContent ?? ''
    expect(texto).toContain('410001 — Ingresos')
    expect(texto).toContain('7.663361')
  })

  it('el botón genera la póliza del movimiento', async () => {
    await render()
    await abrirLaPoliza()

    const boton = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Generar la póliza'))!
    expect(boton).toBeTruthy()
    await click(boton)

    expect(generar).toHaveBeenCalledWith('cta-1', 'tx-6228')
  })

  it('después de generarla muestra sus líneas en quetzales', async () => {
    await render()
    await abrirLaPoliza()
    await click(Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Generar la póliza'))!)
    await act(async () => { await Promise.resolve() })

    expect(document.body.textContent).toContain('47,727.41')
  })
})
