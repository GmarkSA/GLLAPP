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
  codeW:       number | null  // width of code column (null = hide)
  colW:        number         // width of each month column
  nameW:       number         // width of name column
  useDecimals: boolean        // show decimal places in month cells
  cellFont:    number         // font size for month value cells
  nameFont:    number         // font size for account name column
}

export function getColConfig(n: number): ColConfig {
  if (n <= 3)  return { codeW: 60,   colW: 100, nameW: 200, useDecimals: true,  cellFont: 13, nameFont: 13 }
  if (n <= 6)  return { codeW: 55,   colW: 94,  nameW: 190, useDecimals: true,  cellFont: 12, nameFont: 12 }
  if (n <= 9)  return { codeW: 50,   colW: 78,  nameW: 175, useDecimals: false, cellFont: 11, nameFont: 12 }
  return              { codeW: null, colW: 63,  nameW: 160, useDecimals: false, cellFont: 10, nameFont: 11 }
}

export function fmtCol(n: number, useDecimals: boolean): string {
  return n.toLocaleString('es-GT', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  })
}

export const fmtTotal = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
