import { describe, it, expect } from 'vitest'
import { textoDeCierreInicial, BORRADOR_DE_CIERRE } from './textoDeCierre'

/**
 * El texto que cierra la cotización.
 *
 * Nace con un borrador para que nadie lo escriba desde cero, pero lo que
 * alguien ya haya redactado para ese cliente manda: pisarlo con el borrador
 * sería perder trabajo hecho, y encima sin avisar.
 */
describe('con qué texto se abre el envío', () => {
  it('sin notas escritas, con el borrador', () => {
    expect(textoDeCierreInicial(undefined)).toBe(BORRADOR_DE_CIERRE)
    expect(textoDeCierreInicial(null)).toBe(BORRADOR_DE_CIERRE)
    expect(textoDeCierreInicial('')).toBe(BORRADOR_DE_CIERRE)
  })

  it('unas notas en blanco cuentan como vacías', () => {
    expect(textoDeCierreInicial('   \n  ')).toBe(BORRADOR_DE_CIERRE)
  })

  /** Lo que ya se redactó para este cliente no se pisa. */
  it('con notas escritas, esas mandan', () => {
    expect(textoDeCierreInicial('Precio especial por volumen acordado con el Sr. Pérez.'))
      .toBe('Precio especial por volumen acordado con el Sr. Pérez.')
  })
})

/**
 * El borrador le llega al cliente tal cual y compromete a la empresa: no
 * puede prometer nada que no se haya acordado.
 */
describe('qué dice el borrador', () => {
  it('no promete plazos de validez', () => {
    expect(BORRADOR_DE_CIERRE).not.toMatch(/\d+\s*(días|dias|horas|meses)/i)
  })

  it('no promete descuentos ni condiciones de pago', () => {
    expect(BORRADOR_DE_CIERRE).not.toMatch(/descuento|anticipo|crédito|contado|%/i)
  })

  it('pero sí dice algo: no es un campo vacío disfrazado', () => {
    expect(BORRADOR_DE_CIERRE.trim().length).toBeGreaterThan(40)
  })
})
