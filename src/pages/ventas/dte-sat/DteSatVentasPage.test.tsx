import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * La bandeja de DTE SAT emitidos, dibujada.
 *
 * Caso real de LUUM: las facturas a The Concious Home LLC están guardadas en
 * dólares —el XML dice CodigoMoneda="USD"— y la columna Total las escribía con
 * «Q». No era el dato: la columna llamaba al formateador SIN pasarle la moneda
 * del documento, mientras la bandeja de recibidos sí se la pasaba. Por eso en
 * compras se veía USD y en ventas no.
 */
const DOCUMENTO = {
  id: 'dte-1',
  uuid: '28F9731B-A4F3-45EB-9207-7F6CE9A9AD03',
  tipoDocumento: 'FACT',
  serie: '28F9731B',
  numeroDte: '2767406571',
  fechaEmision: '2026-09-24',
  nitReceptor: '812898460',
  nombreReceptor: 'The Concious Home LLC',
  moneda: 'USD',
  subtotal: 6851,
  totalIva: 0,
  total: 6851,
  status: 'pending',
}

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../store/companyStore', () => ({
  useCompanyStore: (selector: (s: unknown) => unknown) =>
    selector({ activeCompany: { id: 'c-1', legalName: 'LUUM, SOCIEDAD ANONIMA', taxId: '96639687' } }),
}))
vi.mock('../../../auth/can', () => ({ useCan: () => () => true }))
vi.mock('../../../hooks/useMediaQuery', () => ({ useIsMobile: () => false }))
vi.mock('../../../components/DocumentLink', () => ({ default: () => null }))
vi.mock('../../../api/companies', () => ({
  companiesApi: { getSettings: vi.fn(async () => ({ settingsJson: { satNit: '96639687' } })) },
}))
vi.mock('../../../api/configuracion', () => ({ getOrganizationProfile: vi.fn(async () => ({ settings: {} })) }))
vi.mock('../../../api/catalogo', () => ({ getAccounts: vi.fn(async () => []) }))
vi.mock('../../../api/impuestos', () => ({ getTaxes: vi.fn(async () => []) }))
vi.mock('../../../api/monedas', () => ({ getExchangeRateForDate: vi.fn(async () => ({ rate: 0.13, officialRate: 7.62, effectiveDate: '2026-09-24', source: 'banguat' })) }))
vi.mock('../../../api/unidades-medida', () => ({ getUnidadesActivas: vi.fn(async () => []) }))
vi.mock('../../../api/compras', () => ({ PAYMENT_TERMS_CONFIG: {} }))
vi.mock('../../../api/facturas', async () => {
  const real: any = await vi.importActual('../../../api/facturas')
  return {
    ...real,
    getSatEmitidosDocuments: vi.fn(async () => ({ data: [DOCUMENTO], total: 1 })),
    getSatEmitidosJobs:      vi.fn(async () => ({ data: [], total: 0 })),
    getSatEmitidosStats:     vi.fn(async () => ({ pending: { count: 1, total: 6851 } })),
    getEstimates:            vi.fn(async () => []),
    getInvoices:             vi.fn(async () => []),
    startSatEmitidosImport:  vi.fn(),
    syncSatEmitidosJob:      vi.fn(),
    postSatEmitidos:         vi.fn(),
    resolveSatEmitidosCustomer: vi.fn(),
    createSatEmitidosCustomer:  vi.fn(),
    deleteSatEmitidos:       vi.fn(),
    reactivateSatEmitidos:   vi.fn(),
    clearAllSatEmitidos:     vi.fn(),
  }
})

const { default: DteSatVentasPage } = await import('./DteSatVentasPage')

describe('Bandeja de DTE SAT emitidos', () => {
  let contenedor: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
    await act(async () => { root.render(<DteSatVentasPage />) })
  })

  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  it('una factura en dólares se muestra en dólares, no en quetzales', () => {
    const texto = contenedor.textContent ?? ''

    expect(texto).toContain('USD 6,851.00')
    expect(texto).not.toContain('Q 6,851.00')
  })

  it('muestra el documento con su receptor', () => {
    expect(contenedor.textContent).toContain('The Concious Home LLC')
  })
})
