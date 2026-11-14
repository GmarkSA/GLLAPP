import { describe, it, expect } from 'vitest'
import { simboloDeMoneda, moneyFmt } from './bancosShared'

/**
 * El símbolo que encabeza un monto de una cuenta bancaria.
 *
 * Una conciliación se hace en la moneda de la CUENTA: el saldo del estado de
 * cuenta de un banco en dólares viene en dólares. Los campos de captura
 * llevaban «Q» escrito fijo, así que pedían un dato en una moneda y lo
 * rotulaban en otra — quien leía rápido podía anotar el saldo ya convertido,
 * y entonces la conciliación comparaba quetzales contra dólares.
 */
describe('el símbolo de la moneda de la cuenta', () => {
  it('en quetzales es Q', () => {
    expect(simboloDeMoneda('GTQ')).toBe('Q')
  })

  it('en dólares NO es Q', () => {
    expect(simboloDeMoneda('USD')).toBe('USD')
  })

  it('otra moneda se muestra con su código', () => {
    expect(simboloDeMoneda('EUR')).toBe('EUR')
  })

  /** Una cuenta sin moneda definida se trata como local, que es el caso común. */
  it('sin moneda, queda en Q', () => {
    expect(simboloDeMoneda(undefined)).toBe('Q')
    expect(simboloDeMoneda(null)).toBe('Q')
    expect(simboloDeMoneda('')).toBe('Q')
  })

  it('no depende de cómo venga escrita', () => {
    expect(simboloDeMoneda('gtq')).toBe('Q')
    expect(simboloDeMoneda('usd')).toBe('USD')
  })

  /** El símbolo del campo de captura y el de los montos tienen que coincidir. */
  it('coincide con el que usan los montos ya formateados', () => {
    expect(moneyFmt(1234.5, 'USD').startsWith(simboloDeMoneda('USD'))).toBe(true)
    expect(moneyFmt(1234.5, 'GTQ').startsWith(simboloDeMoneda('GTQ'))).toBe(true)
  })
})
