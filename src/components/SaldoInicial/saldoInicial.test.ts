import { describe, it, expect } from 'vitest'
import {
  lineaEnQuetzales, totalEnQuetzales, esMonedaLocal,
} from './SaldoInicialContacto'

/**
 * El saldo inicial capturado documento por documento en la ficha del contacto.
 *
 * La conversión se calcula igual en el navegador y en el servidor: aquí para
 * que el usuario vea el equivalente mientras escribe, allá para decidir qué
 * entra a los libros. Si las dos se separan, la pantalla enseña un número y la
 * póliza guarda otro.
 */
describe('cuánto vale cada documento en quetzales', () => {
  it('en quetzales, el monto es el monto', () => {
    expect(lineaEnQuetzales({ monto: 8940 }, 'GTQ')).toBe(8940)
  })

  /**
   * Si el proveedor factura en quetzales no hay conversión que hacer. La
   * pantalla ni siquiera muestra la casilla, pero si quedó un valor viejo
   * guardado no debe poder alterar el saldo.
   */
  it('en quetzales, una tasa guardada por error no altera nada', () => {
    expect(lineaEnQuetzales({ monto: 8940, tipoCambio: 7.7 }, 'GTQ')).toBe(8940)
  })

  it('en dólares, el monto se multiplica por SU tipo de cambio', () => {
    expect(lineaEnQuetzales({ monto: 1000, tipoCambio: 7.7 }, 'USD')).toBe(7700)
  })

  it('en dólares sin tipo de cambio todavía no vale nada', () => {
    expect(lineaEnQuetzales({ monto: 1000 }, 'USD')).toBe(0)
  })

  it('una línea vacía vale cero', () => {
    expect(lineaEnQuetzales(undefined, 'USD')).toBe(0)
    expect(lineaEnQuetzales({ referencia: 'FAC-001' }, 'USD')).toBe(0)
  })
})

describe('el total que entra a los libros', () => {
  /**
   * La razón de que esto sean líneas y no una cifra: cada factura vieja se
   * registró al tipo de cambio de su día.
   */
  it('suma cada documento a su propia tasa', () => {
    expect(totalEnQuetzales([
      { monto: 2500, tipoCambio: 7.71234 },
      { monto: 1800, tipoCambio: 7.66890 },
    ], 'USD')).toBeCloseTo(33084.87, 2)
  })

  it('ignora las filas a medio llenar', () => {
    expect(totalEnQuetzales([
      { monto: 500 },
      { referencia: 'FAC-002' },
      undefined,
    ], 'GTQ')).toBe(500)
  })

  it('sin líneas, el total es cero', () => {
    expect(totalEnQuetzales([], 'USD')).toBe(0)
    expect(totalEnQuetzales(undefined, 'USD')).toBe(0)
  })
})

describe('qué cuenta como moneda local', () => {
  it('GTQ y vacío sí; USD no', () => {
    expect(esMonedaLocal('GTQ')).toBe(true)
    expect(esMonedaLocal('gtq')).toBe(true)
    expect(esMonedaLocal(undefined)).toBe(true)
    expect(esMonedaLocal('USD')).toBe(false)
  })
})
