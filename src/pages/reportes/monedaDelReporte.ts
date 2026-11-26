/**
 * Ver un estado financiero en quetzales o en dólares.
 *
 * El cliente lleva los libros en quetzales; quien lo lee afuera —un banco
 * corresponsal, una casa matriz, un socio— los pide en dólares. Hasta hoy eso
 * se hacía a mano, en una hoja aparte, con el tipo de cambio que cada quien
 * recordaba.
 *
 * La regla, y es la que marca la diferencia entre un reporte presentable y
 * uno que no cuadra:
 *
 *  - **Cada mes se convierte con SU tipo de cambio de fin de mes.** No con el
 *    de hoy ni con el del cierre del año. Un gasto de marzo valía los dólares
 *    de marzo.
 *  - **Lo que es flujo se acumula convertido**: el acumulado del año en
 *    dólares es la suma de los doce meses ya convertidos, no el acumulado en
 *    quetzales dividido entre una sola tasa. Esos dos números no son el mismo
 *    y el que vale es el primero.
 *  - **Lo que es saldo se convierte al corte**: el activo al 30 de noviembre
 *    se convierte con la tasa del 30 de noviembre, porque es lo que vale ese
 *    día.
 *
 * Por eso la conversión necesita saber si la fila es flujo o saldo. No es un
 * detalle de formato: es la diferencia entre un estado de resultados y un
 * balance.
 */

/** En qué moneda se está mirando el reporte. */
export type MonedaDelReporte = 'GTQ' | 'USD';

/**
 * Qué significa la columna del total de cada reporte.
 *
 *  - `suma`: el acumulado del período —estado de resultados, flujo—.
 *  - `saldoFinal`: la foto al corte —balance general—.
 */
export type ClaseDeTotal = 'suma' | 'saldoFinal';

/** La tasa de fin de mes de cada columna; `null` cuando no se conoce. */
export type TasaDelMes = (yearMonth: string) => number | null;

/** La columna del total, que todos los reportes mensualizados comparten. */
export const COLUMNA_TOTAL = '_total';

/**
 * Pasa un monto en quetzales a dólares.
 *
 * La tasa es la de Banguat: cuántos quetzales cuesta un dólar. Una tasa que
 * no sirve —cero, negativa, ausente— devuelve `null`: es preferible una raya
 * en la celda a una cifra inventada.
 */
export function enDolares(montoEnQuetzales: number, tasa: number | null | undefined): number | null {
  const t = Number(tasa);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Number(montoEnQuetzales) / t;
}

/**
 * Las filas del reporte, convertidas a dólares.
 *
 * Recibe las filas tal como las arma el reporte —un número por mes y la
 * columna del total— y devuelve filas nuevas; no toca las de entrada, porque
 * al volver a quetzales se vuelven a usar.
 *
 * Un mes sin tipo de cambio queda en `null`: la celda muestra una raya y el
 * total no lo cuenta. Mentir con el valor en quetzales sería peor.
 */
export function filasEnDolares<T extends Record<string, any>>(
  filas: T[],
  meses: string[],
  tasaDe: TasaDelMes,
  claseDeTotal: ClaseDeTotal,
): T[] {
  const ultimoMes = meses[meses.length - 1];

  return filas.map(fila => {
    const convertida: Record<string, any> = { ...fila };

    for (const mes of meses) {
      const valor = fila[mes];
      convertida[mes] = valor == null ? valor : enDolares(Number(valor), tasaDe(mes));
    }

    if (!(COLUMNA_TOTAL in fila)) return convertida as T;

    if (claseDeTotal === 'saldoFinal') {
      // Un saldo vale lo que vale al corte: se convierte con la tasa de ahí.
      convertida[COLUMNA_TOTAL] = enDolares(Number(fila[COLUMNA_TOTAL] ?? 0), tasaDe(ultimoMes));
    } else {
      // Un acumulado es la suma de los meses YA convertidos.
      const convertidos = meses
        .map(mes => convertida[mes])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      convertida[COLUMNA_TOTAL] = convertidos.length
        ? convertidos.reduce((s, v) => s + v, 0)
        : null;
    }

    return convertida as T;
  });
}

/**
 * Los meses que no tienen tipo de cambio, para poder avisarlo.
 *
 * Un reporte en dólares al que le faltan meses no es un error que se pueda
 * esconder: quien lo firma tiene que saber qué columnas no se pudieron
 * convertir.
 */
export function mesesSinTasa(meses: string[], tasaDe: TasaDelMes): string[] {
  return meses.filter(mes => enDolares(1, tasaDe(mes)) === null);
}

/** El símbolo que encabeza las cifras del reporte. */
export const simboloDe = (moneda: MonedaDelReporte): string => moneda === 'USD' ? 'US$' : 'Q';

/** Una cifra del reporte, con el signo de la moneda en la que se está viendo. */
export function fmtMonto(valor: unknown, moneda: MonedaDelReporte): string {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  return `${simboloDe(moneda)} ${Number(valor).toLocaleString('es-GT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}
