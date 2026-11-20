import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import MontoDual from './MontoDual'

/**
 * Lo que debe ver quien revisa una cifra en una empresa de dos monedas.
 *
 * El caso que lo destapó: la nota de crédito de USD 3,057.51 salía escrita
 * «Q 3,057.51». El número era correcto, el signo no, y la diferencia —
 * Q 20,376.81— era justo lo que no cuadraba contra el mayor.
 */
describe('el monto de un documento en pantalla', () => {
  let div: HTMLDivElement
  let root: Root

  const pintar = (nodo: React.ReactNode) => {
    act(() => { root.render(nodo) })
    return div.textContent ?? ''
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

  it('en dólares: el monto en su moneda y debajo su equivalente', () => {
    const texto = pintar(
      <MontoDual monto={3057.51} currency="USD" exchangeRate={7.665} />)

    expect(texto).toContain('USD 3,057.51')
    expect(texto).toContain('Q 23,435.81')
  })

  it('con la tasa a la vista cuando se pide', () => {
    const texto = pintar(
      <MontoDual monto={9654} currency="USD" exchangeRate={7.66451} conTasa />)

    expect(texto).toContain('USD 9,654.00')
    expect(texto).toContain('T/C 7.664510')
  })

  /** En quetzales no hay nada que convertir: una sola cifra, sin ruido. */
  it('en quetzales: una sola cifra', () => {
    const texto = pintar(<MontoDual monto={23434.32} currency="GTQ" />)

    expect(texto).toBe('Q 23,434.32')
  })

  it('un documento sin moneda se trata como local', () => {
    expect(pintar(<MontoDual monto={280} />)).toBe('Q 280.00')
  })

  /** Centavos, nunca milésimas: «Q 40,866.296» era un error de verdad. */
  it('siempre dos decimales', () => {
    expect(pintar(<MontoDual monto={40866.2956} />)).toBe('Q 40,866.30')
  })
})
