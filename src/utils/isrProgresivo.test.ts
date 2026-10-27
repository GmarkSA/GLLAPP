import { describe, it, expect } from 'vitest'
import { calcularIsrProgresivo, retencionIsrEnQuetzales } from './isrProgresivo';

/**
 * La retención de ISR por tramos.
 *
 * Los tramos son de la ley guatemalteca y están EN QUETZALES: 5% hasta
 * Q30,000 y 7% sobre el exceso. El cálculo los aplicaba sobre la base tal como
 * venía en la factura, así que una factura en dólares se comparaba contra el
 * tramo como si los dólares fueran quetzales, y retenía de menos.
 */
const TRAMOS = [
  { upTo: 30000, rate: 5 },
  { upTo: null,  rate: 7 },
];

describe('facturas en quetzales', () => {
  it('por debajo del tramo, todo al 5%', () => {
    expect(retencionIsrEnQuetzales(5000, TRAMOS)).toBe(250);
  });

  it('justo en el límite, todo al 5%', () => {
    expect(retencionIsrEnQuetzales(30000, TRAMOS)).toBe(1500);
  });

  it('por encima, el exceso al 7%', () => {
    // 30,000 × 5% = 1,500 · 15,000 × 7% = 1,050
    expect(retencionIsrEnQuetzales(45000, TRAMOS)).toBe(2550);
  });

  it('el tipo de cambio 1 no cambia nada', () => {
    expect(calcularIsrProgresivo(45000, TRAMOS, 1)).toBe(2550);
  });
});

/**
 * El caso que reportó el dueño: factura de USD 5,600 (base USD 5,000) a
 * 7.663360. En quetzales son Q38,316.80 — pasa el tramo.
 */
describe('facturas en dólares', () => {
  const TC = 7.663360;

  it('la base se compara contra el tramo EN QUETZALES', () => {
    // 5,000 × 7.663360 = 38,316.80 → sí pasa de Q30,000
    expect(retencionIsrEnQuetzales(5000 * TC, TRAMOS)).toBeCloseTo(2082.18, 2);
  });

  it('se retiene lo que manda la ley, no lo que salía tratando dólares como quetzales', () => {
    const enDolares = calcularIsrProgresivo(5000, TRAMOS, TC);

    // Q2,082.18 ÷ 7.663360 = USD 271.71
    expect(enDolares).toBeCloseTo(271.71, 2);
    // Lo que calculaba antes: 5,000 contra Q30,000 → 5% → 250
    expect(enDolares).not.toBe(250);
  });

  it('la retención devuelta, convertida a quetzales, es la cifra legal', () => {
    const enDolares = calcularIsrProgresivo(5000, TRAMOS, TC);
    expect(enDolares * TC).toBeCloseTo(2082.18, 1);
  });

  /**
   * Una factura chica en dólares sigue sin pasar el tramo: el arreglo no puede
   * cobrarle 7% a quien no le toca.
   */
  it('una factura chica en dólares sigue en el primer tramo', () => {
    // USD 1,000 × 7.663360 = Q7,663.36 → 5%
    expect(calcularIsrProgresivo(1000, TRAMOS, TC)).toBeCloseTo(383.17 / TC, 2);
  });

  it('con tipo de cambio inválido no multiplica por cero', () => {
    expect(calcularIsrProgresivo(5000, TRAMOS, 0)).toBe(250);
    expect(calcularIsrProgresivo(5000, TRAMOS, NaN as any)).toBe(250);
  });
});

describe('casos de borde', () => {
  it('base en cero no retiene nada', () => {
    expect(calcularIsrProgresivo(0, TRAMOS, 7.66)).toBe(0);
  });

  it('un solo tramo sin límite aplica su tasa a todo', () => {
    expect(retencionIsrEnQuetzales(100000, [{ upTo: null, rate: 7 }])).toBe(7000);
  });

  it('los tramos desordenados se ordenan solos', () => {
    const alReves = [{ upTo: null, rate: 7 }, { upTo: 30000, rate: 5 }];
    expect(retencionIsrEnQuetzales(45000, alReves)).toBe(2550);
  });
});
