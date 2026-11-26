import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Los listados de Bancos en el teléfono.
 *
 * El acuerdo de los tres tamaños: teléfono (≤767) muestra tarjetas, tablet
 * (768–1024) muestra la misma tabla corrida de lado, y escritorio la tabla
 * completa. Lo que se vigila aquí es que cada listado de Bancos cumpla eso
 * CON DATOS, no que exista el componente: una tarjeta que se cae por un
 * campo vacío o una tabla que se quedó sin convertir no se ve en un grep.
 *
 * Y se vigila también lo que NO se convirtió a propósito: el modo sesión de
 * la conciliación —donde se marcan varios movimientos con la casilla— sigue
 * siendo tabla en el teléfono, porque una pila de tarjetas no tiene dónde
 * poner esa casilla. Quitarle la casilla sería quitar funcionalidad.
 */

/** Finge una pantalla de ese ancho para `window.matchMedia`. */
function pantallaDe(ancho: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const cumpleMax = max ? ancho <= Number(max[1]) : true
    const cumpleMin = min ? ancho >= Number(min[1]) : true
    return {
      matches: cumpleMax && cumpleMin,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }
  }) as any
}

const CUENTA = {
  id: 'cta-1', companyId: 'emp-1', name: 'Banco Industrial Monetaria',
  type: 'checking', status: 'active', isPrimary: true,
  bankName: 'Banco Industrial', accountNumber: '0123456789',
  currency: 'GTQ', openingBalance: 0, currentBalance: 12500.75,
  bankBalance: 12000, feedsEnabled: false,
}

const MOVIMIENTOS = [
  {
    id: 'tx-1', bankAccountId: 'cta-1', transactionDate: '2026-11-03',
    description: 'Deposito Jorge Acevedo', reference: '998877',
    type: 'credit', amount: 1662.72, runningBalance: 12500.75,
    status: 'matched', matchedInvoiceId: 'fac-1',
    rawData: { matchLabel: 'Factura FAC-00120' },
  },
  {
    id: 'tx-2', bankAccountId: 'cta-1', transactionDate: '2026-11-04',
    description: 'Pago proveedor sin referencia', reference: null,
    type: 'debit', amount: 450, runningBalance: null,
    status: 'pending', rawData: null,
  },
]

const REGLAS = [
  {
    id: 'rg-1', name: 'Comisiones bancarias', bankAccountId: 'cta-1',
    applyTo: 'debit', isActive: true, timesApplied: 7,
    conditions: [{ field: 'description', operator: 'contains', value: 'COMISION' }],
    action: { accountCode: '520101', accountName: 'Gastos bancarios' },
  },
  {
    id: 'rg-2', name: 'Regla sin cuenta ni criterios', bankAccountId: null,
    applyTo: 'all', isActive: false, timesApplied: 0,
    conditions: null, action: null,
  },
]

vi.mock('../../store/companyStore', () => ({
  useCompanyStore: (sel: any) => sel({ activeCompany: { id: 'emp-1', name: 'Kaizen' } }),
}))

vi.mock('../../api/bancos', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getBankAccounts:            vi.fn(async () => [CUENTA]),
    getBankAccount:             vi.fn(async () => CUENTA),
    refreshBankBalance:         vi.fn(async () => CUENTA),
    getTransactions:            vi.fn(async () => ({ data: MOVIMIENTOS, total: MOVIMIENTOS.length })),
    getPendingReconciliation:   vi.fn(async () => ({ data: MOVIMIENTOS, total: MOVIMIENTOS.length })),
    getReconciliationSummary:   vi.fn(async () => ({
      pending: 1, categorized: 0, matched: 1, reconciled: 0,
    })),
    listReconciliationPeriods:  vi.fn(async () => []),
    getBankRules:               vi.fn(async () => ({ data: REGLAS, total: REGLAS.length })),
    applyBankRules:             vi.fn(async () => ({ applied: 0 })),
  }
})

vi.mock('../../components/AccountSelect', () => ({ default: () => null }))

describe('los listados de Bancos en el teléfono', () => {
  let div: HTMLDivElement
  let root: Root
  const original = window.matchMedia

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
    window.matchMedia = original
  })

  const dibujar = async (nodo: React.ReactNode) => {
    await act(async () => { root.render(nodo) })
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0

  describe('Cuentas bancarias', () => {
    const pagina = async () => {
      const { default: Pagina } = await import('./CuentasBancariasPage')
      await dibujar(<MemoryRouter><Pagina /></MemoryRouter>)
    }

    it('en el teléfono sale como tarjeta, con el banco y el saldo', async () => {
      pantallaDe(375)
      await pagina()
      const texto = div.textContent ?? ''
      expect(texto).toContain('Banco Industrial Monetaria')
      expect(texto).toContain('****6789')
      expect(texto).toContain('12,500.75')
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await pagina()
      expect(div.textContent).toContain('Banco Industrial Monetaria')
      expect(hayTabla()).toBe(true)
    })

    it('y en escritorio también', async () => {
      pantallaDe(1440)
      await pagina()
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Reglas bancarias', () => {
    const pagina = async () => {
      const { default: Pagina } = await import('./ReglasBancariasPage')
      await dibujar(<MemoryRouter><Pagina /></MemoryRouter>)
    }

    it('cada regla es una tarjeta con sus criterios y su cuenta', async () => {
      pantallaDe(375)
      await pagina()
      const texto = div.textContent ?? ''
      expect(texto).toContain('Comisiones bancarias')
      expect(texto).toContain('520101')
      expect(texto).toContain('description contains COMISION')
      expect(texto).toContain('Aplicada 7 veces')
      expect(hayTabla()).toBe(false)
    })

    /** Una regla a medias —sin cuenta, sin criterios, sin cuenta bancaria—
     *  no puede tumbar el listado. */
    it('una regla con campos vacíos no rompe la tarjeta', async () => {
      pantallaDe(375)
      await pagina()
      const texto = div.textContent ?? ''
      expect(texto).toContain('Regla sin cuenta ni criterios')
      expect(texto).toContain('Sin cuenta asignada')
      expect(texto).toContain('Inactiva')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await pagina()
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Movimientos de la cuenta', () => {
    const pagina = async () => {
      const { default: Pagina } = await import('./TransaccionesPage')
      await dibujar(
        <MemoryRouter initialEntries={['/bancos/cta-1']}>
          <Routes><Route path="/bancos/:id" element={<Pagina />} /></Routes>
        </MemoryRouter>,
      )
    }

    it('en el teléfono cada movimiento es una tarjeta con su monto y su saldo', async () => {
      pantallaDe(375)
      await pagina()
      const texto = div.textContent ?? ''
      expect(texto).toContain('Deposito Jorge Acevedo')
      expect(texto).toContain('+ Q 1,662.72')
      expect(texto).toContain('- Q 450.00')
      expect(texto).toContain('Saldo Q 12,500.75')
      expect(texto).toContain('Factura FAC-00120')
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await pagina()
      expect(div.textContent).toContain('Deposito Jorge Acevedo')
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Conciliación', () => {
    const pagina = async (ruta: string) => {
      const { default: Pagina } = await import('./ConciliacionPage')
      await dibujar(
        <MemoryRouter initialEntries={[ruta]}>
          <Routes><Route path="/bancos/:id/conciliacion" element={<Pagina />} /></Routes>
        </MemoryRouter>,
      )
    }

    it('el listado suelto sale como tarjeta, con su botón de conciliar', async () => {
      pantallaDe(375)
      await pagina('/bancos/cta-1/conciliacion')
      const texto = div.textContent ?? ''
      expect(texto).toContain('Deposito Jorge Acevedo')
      expect(texto).toContain('Coincidencia detectada')
      expect(texto).toContain('Conciliar')
      expect(hayTabla()).toBe(false)
    })

    /**
     * El modo sesión conserva la tabla a propósito: ahí está la casilla para
     * conciliar en lote.
     */
    it('el modo sesión conserva la tabla y sus casillas', async () => {
      pantallaDe(375)
      await pagina('/bancos/cta-1/conciliacion?month=11&year=2026&refSaldo=12000')
      expect(hayTabla()).toBe(true)
      expect(div.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0)
    })
  })
})
