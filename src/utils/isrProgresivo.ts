/**
 * La retención de ISR por tramos, cuando la factura no está en quetzales.
 *
 * Los tramos del ISR son de la ley guatemalteca y están EN QUETZALES: 5% hasta
 * Q30,000 y 7% sobre el exceso. El cálculo los aplicaba sobre la base tal como
 * venía en la factura, así que una factura en dólares se comparaba contra el
 * tramo como si los dólares fueran quetzales.
 *
 * Una factura de USD 5,000 a 7.663360 son Q38,316.80: pasa el tramo y debe
 * retener Q1,500 del primero más Q582.18 del segundo, Q2,082.18 en total. Lo
 * que se calculaba era 5,000 contra Q30,000 —no llegaba al tramo— y retenía
 * Q250. Se le retenía al proveedor una octava parte de lo que la ley manda, y
 * la diferencia la termina pagando la empresa cuando la SAT la reclama.
 *
 * La retención se devuelve EN LA MONEDA DE LA FACTURA, que es como se guarda y
 * como se resta del pago al proveedor; la póliza la vuelve a convertir a
 * quetzales con el mismo tipo de cambio.
 */

export interface TramoDeImpuesto {
  /** Límite superior del tramo, en quetzales. null = sin límite, cubre el resto. */
  upTo: number | null;
  /** Porcentaje del tramo. */
  rate: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que se retiene, en quetzales, sobre una base ya expresada en quetzales.
 *
 * Es la cifra legal: la que se declara y la que lleva el libro.
 */
export function retencionIsrEnQuetzales(
  baseEnQuetzales: number,
  tramos: TramoDeImpuesto[],
): number {
  const ordenados = [...tramos].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  let total = 0;
  let limiteAnterior = 0;

  for (const tramo of ordenados) {
    if (baseEnQuetzales <= limiteAnterior) break;
    const limite = tramo.upTo ?? Infinity;
    const gravable = Math.min(baseEnQuetzales, limite) - limiteAnterior;
    total += gravable * Number(tramo.rate) / 100;
    limiteAnterior = limite;
  }
  return centavos(total);
}

/**
 * Lo que se retiene, en la moneda de la factura.
 *
 * `tipoDeCambio` es cuántos quetzales vale una unidad de la moneda de la
 * factura. En una factura en quetzales vale 1 y nada cambia.
 */
export function calcularIsrProgresivo(
  base: number,
  tramos: TramoDeImpuesto[],
  tipoDeCambio = 1,
): number {
  const tc = Number(tipoDeCambio) > 0 ? Number(tipoDeCambio) : 1;
  const enQuetzales = retencionIsrEnQuetzales(centavos(base * tc), tramos);
  return centavos(enQuetzales / tc);
}
