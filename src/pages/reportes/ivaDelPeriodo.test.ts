import { describe, it, expect } from 'vitest'
import { ivaDelPeriodo, TITULO_IVA_PERIODO } from './ivaDelPeriodo'

/**
 * Cómo se lee el IVA del período en el cuadro consolidado.
 *
 * Decía «Q 9,301.95 pagado» y «Q 2,691.52 a favor»: dos cifras positivas que
 * solo se distinguen por una palabra al final, así que hay que leer cada celda
 * para saber de qué lado está.
 *
 * Con la convención contable se ve sin leer: paréntesis = por pagar, signo
 * más = crédito a favor.
 */
describe('el saldo de IVA del período', () => {
  /** Los números de KAIZEN en la pantalla. */
  it('lo que se debe va entre paréntesis', () => {
    const r = ivaDelPeriodo(9301.95)

    expect(r.texto).toBe('(Q 9,301.95)')
    expect(r.lado).toBe('por_pagar')
  })

  /** Los de Mario: crédito a favor. */
  it('lo que está a favor lleva signo más', () => {
    const r = ivaDelPeriodo(-2691.52)

    expect(r.texto).toBe('+Q 2,691.52')
    expect(r.lado).toBe('a_favor')
  })

  /**
   * El paréntesis ya dice que es negativo: repetir el menos adentro lo haría
   * ilegible.
   */
  it('el paréntesis no lleva además el signo menos', () => {
    expect(ivaDelPeriodo(9301.95).texto).not.toContain('-')
  })

  it('sin saldo, ni paréntesis ni signo', () => {
    const r = ivaDelPeriodo(0)

    expect(r.texto).toBe('Q 0.00')
    expect(r.lado).toBe('sin_saldo')
  })

  it('unos centavos de redondeo no son un saldo', () => {
    expect(ivaDelPeriodo(0.004).lado).toBe('sin_saldo')
    expect(ivaDelPeriodo(-0.004).lado).toBe('sin_saldo')
  })

  it('un valor ausente se lee como cero', () => {
    expect(ivaDelPeriodo(undefined).lado).toBe('sin_saldo')
    expect(ivaDelPeriodo(null).texto).toBe('Q 0.00')
  })

  /** Naranja lo que se debe, verde lo que está a favor: igual que el resto. */
  it('cada lado tiene su color', () => {
    expect(ivaDelPeriodo(100).color).toBe('#d46b08')
    expect(ivaDelPeriodo(-100).color).toBe('#2ea172')
  })

  it('el encabezado nombra los dos lados', () => {
    expect(TITULO_IVA_PERIODO).toContain('Pagar')
    expect(TITULO_IVA_PERIODO).toContain('Cobrar')
  })
})
