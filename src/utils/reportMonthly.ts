import dayjs from 'dayjs'

export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface MonthRange {
  label:     string   // "Ene 26"
  yearMonth: string   // "2026-01"
  from:      string   // "2026-01-01"
  to:        string   // "2026-01-31"
}

export function getMonthRanges(fromDate: string, toDate: string): MonthRange[] {
  const ranges: MonthRange[] = []
  let cur = dayjs(fromDate).startOf('month')
  const endM = dayjs(toDate).startOf('month')
  while (!cur.isAfter(endM)) {
    ranges.push({
      label:     `${MESES[cur.month()]} ${cur.format('YY')}`,
      yearMonth: cur.format('YYYY-MM'),
      from:      cur.startOf('month').format('YYYY-MM-DD'),
      to:        cur.endOf('month').format('YYYY-MM-DD'),
    })
    cur = cur.add(1, 'month')
  }
  return ranges
}

/**
 * OJO: de esta configuración ya solo se usa `useDecimals`.
 *
 * Los anchos y los tamaños de letra los daba esta función según cuántos
 * meses tuviera el reporte, y era lo que encogía la cifra hasta 10px con
 * doce columnas. Desde que el Balance, el Estado de Resultados y el Flujo
 * toman su tipografía de `presentacionDelReporte`, estos cinco campos no
 * los lee nadie.
 *
 * Se dejan en su sitio a propósito, para que revertir la homologación sea
 * revertir solo las pantallas. Cuando la presentación esté confirmada, esto
 * se borra y la función se queda en lo único vivo que tiene.
 */
export interface ColConfig {
  codeW:       number | null  // sin uso — lo da ANCHOS.codigo
  colW:        number         // sin uso — lo da ANCHOS.mes
  nameW:       number         // sin uso — lo da ANCHOS.nombre
  useDecimals: boolean        // en uso: decimales en las celdas de mes
  cellFont:    number         // sin uso — lo da PRESENTACION.cifra
  nameFont:    number         // sin uso — lo da PRESENTACION.nombre
}

export function getColConfig(n: number): ColConfig {
  if (n <= 3)  return { codeW: 60,   colW: 105, nameW: 200, useDecimals: true, cellFont: 13, nameFont: 13 }
  if (n <= 6)  return { codeW: 55,   colW: 98,  nameW: 190, useDecimals: true, cellFont: 12, nameFont: 12 }
  if (n <= 9)  return { codeW: 50,   colW: 88,  nameW: 175, useDecimals: true, cellFont: 11, nameFont: 12 }
  return              { codeW: 44,   colW: 78,  nameW: 150, useDecimals: true, cellFont: 10, nameFont: 11 }
}

export function fmtCol(n: number, useDecimals: boolean): string {
  return n.toLocaleString('es-GT', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  })
}

export const fmtTotal = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
