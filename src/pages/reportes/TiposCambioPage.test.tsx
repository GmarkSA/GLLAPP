import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import dayjs from 'dayjs'

/**
 * Reportes › Tipos de cambio.
 *
 * Un cliente nuevo activa el dólar y su historial arranca ese día: las facturas
 * en dólares de meses anteriores se quedan sin tasa. Por eso la pantalla trae los
 * días que faltan desde Banguat — del rango elegido o, sin rango, del año en curso.
 */
const HISTORIAL = [
  { id: '1', baseCurrencyCode: 'GTQ', targetCurrencyCode: 'USD', effectiveDate: '2026-09-29',
    rate: 0.13093770, officialRate: 7.637220, source: 'banguat', createdAt: '', updatedAt: '' },
]

const importar = vi.fn(async () => ({ desde: '', hasta: '', registrados: 12, actualizados: 3, respetadosManual: 1 }))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../api/monedas', () => ({
  getExchangeRateHistory:   vi.fn(async () => HISTORIAL),
  syncBanguatRate:          vi.fn(async () => ({ rate: 0.13, banguatRate: 7.63722, effectiveDate: '2026-09-29' })),
  importarHistorialBanguat: importar,
}))

const { default: TiposCambioPage } = await import('./TiposCambioPage')

describe('Tipos de cambio', () => {
  let contenedor: HTMLDivElement
  let root: Root

  const boton = (texto: string) =>
    [...contenedor.querySelectorAll('button')].find(b => b.textContent?.includes(texto))!

  beforeEach(async () => {
    contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
    await act(async () => { root.render(<TiposCambioPage />) })
  })

  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  it('muestra la tasa oficial con su fecha', () => {
    expect(contenedor.textContent).toContain('29/09/2026')
    expect(contenedor.textContent).toContain('7.637220')
  })

  it('ofrece traer el historial que falta', () => {
    expect(boton('Traer historial')).toBeTruthy()
  })

  it('sin rango elegido, pide a Banguat el año en curso', async () => {
    await act(async () => { boton('Traer historial').click() })

    expect(importar).toHaveBeenCalledWith(dayjs().startOf('year').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD'))
  })

  it('cuenta lo que trajo, incluyendo las tasas manuales que respetó', async () => {
    await act(async () => { boton('Traer historial').click() })

    expect(document.body.textContent).toContain('12 días nuevos')
    expect(document.body.textContent).toContain('3 actualizados')
    expect(document.body.textContent).toContain('1 con tasa manual, sin tocar')
  })
})
