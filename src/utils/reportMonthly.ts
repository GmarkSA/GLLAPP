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

export interface ColConfig {
  codeW:       number | null
  colW:        number
  useDecimals: boolean
}

export function getColConfig(n: number): ColConfig {
  if (n <= 6)  return { codeW: 55,   colW: 88,  useDecimals: true  }
  if (n <= 9)  return { codeW: 50,   colW: 72,  useDecimals: false }
  return              { codeW: null, colW: 60,  useDecimals: false }
}

export function fmtCol(n: number, useDecimals: boolean): string {
  return n.toLocaleString('es-GT', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  })
}

export const fmtTotal = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
