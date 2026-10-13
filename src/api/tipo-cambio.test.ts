import { describe, it, expect } from 'vitest'
import { tipoDeCambioOficial } from './monedas'

/**
 * Qué número de los dos es el tipo de cambio.
 *
 * El endpoint devuelve las dos caras: `officialRate` es la de Banguat
 * (1 USD = 7.66 GTQ) y `rate` la inversa (1 GTQ = 0.1304 USD), porque la moneda
 * base del historial es el quetzal. La contabilidad multiplica por la de
 * Banguat.
 *
 * Caso de LUUM: la categorización de bancos tomaba `rate` tal cual. Un depósito
 * de USD 6,228 se contabilizó en Q812 en vez de Q47,727, y la póliza quedó con
 * «tipo de cambio 0.130483». Compras y Contabilidad ya leían `officialRate`;
 * bancos era el único que no.
 */
describe('tipo de cambio de una respuesta del historial', () => {
  it('toma el oficial de Banguat, no el inverso', () => {
    expect(tipoDeCambioOficial({ rate: 0.13049, officialRate: 7.663361 })).toBe(7.663361)
  })

  it('si solo viene el inverso, lo invierte', () => {
    // 1 / 0.13086316 = 7.641570
    expect(tipoDeCambioOficial({ rate: 0.13086316 })).toBe(7.64157)
  })

  it('sin respuesta no inventa una tasa: deja 1', () => {
    expect(tipoDeCambioOficial(null)).toBe(1)
    expect(tipoDeCambioOficial({ rate: 0 })).toBe(1)
  })

  it('nunca devuelve un número menor que el inverso por descuido', () => {
    // La señal del error: una tasa de USD jamás anda por debajo de 1.
    expect(tipoDeCambioOficial({ rate: 0.130483, officialRate: 7.664585 })).toBeGreaterThan(1)
  })
})
