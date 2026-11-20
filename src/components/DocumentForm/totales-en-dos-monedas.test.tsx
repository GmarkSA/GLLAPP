import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import DocumentTotals from './DocumentTotals'

/**
 * El resumen de la pantalla de captura, cuando el documento no es en quetzales.
 *
 * Escribía «GTQ 1,234.56» incluso en documentos locales, y en los de dólares
 * no decía en ninguna parte cuánto iba a quedar en el mayor. Eso se descubría
 * después, cuadrando el balance.
 */
describe('el resumen del documento', () => {
  let div: HTMLDivElement
  let root: Root

  const pintar = (nodo: React.ReactNode) => {
    act(() => { root.render(nodo) })
    return div.textContent ?? ''
  }

  const base = {
    subtotal: 8620.00, taxAmount: 1034.00, total: 9654.00,
    hasInclusive: false, taxBreakdown: [],
  }

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
  })

  it('en dólares con tasa: muestra el tipo de cambio y el equivalente', () => {
    const texto = pintar(
      <DocumentTotals {...base} currency="USD" exchangeRate={7.66451} />)

    expect(texto).toContain('Total (USD)')
    expect(texto).toContain('7.664510')
    expect(texto).toContain('Q 73,993.18')
  })

  /** Sin tasa no se inventa ninguna: el equivalente simplemente no aparece. */
  it('en dólares sin tasa: no inventa el equivalente', () => {
    const texto = pintar(<DocumentTotals {...base} currency="USD" />)

    expect(texto).toContain('Total (USD)')
    expect(texto).not.toContain('Equivalente en quetzales')
  })

  it('en quetzales: una sola moneda, sin bloque de equivalencia', () => {
    const texto = pintar(
      <DocumentTotals {...base} currency="GTQ" exchangeRate={7.66451} />)

    expect(texto).toContain('Total (GTQ)')
    expect(texto).not.toContain('Equivalente en quetzales')
  })

  /** Y el subtotal de un documento local se escribe «Q», no «GTQ». */
  it('el subtotal local lleva el signo del quetzal', () => {
    const texto = pintar(<DocumentTotals {...base} currency="GTQ" />)

    expect(texto).toContain('Q 8,620.00')
    expect(texto).not.toContain('GTQ 8,620.00')
  })
})
