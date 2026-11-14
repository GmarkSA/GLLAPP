import { describe, it, expect } from 'vitest'

/**
 * En qué moneda se lee una póliza de un movimiento en divisa.
 *
 * El mayor guarda quetzales, pero la operación ocurrió en otra moneda y es en
 * esa en la que el usuario la reconoce: «el depósito fue de USD 8,984». La
 * póliza se abre en SU moneda, con un botón para verla en la local — que es
 * la que termina en los estados financieros.
 *
 * La conversión usa el tipo de cambio de la PROPIA póliza, no uno traído de
 * otro lado: así los dos modos muestran la misma operación y no pueden
 * contradecirse entre sí.
 */
const fmtVista = (n: number, opciones: {
  enDivisa: boolean; tasa: number; simbolo: string
}) => {
  if (n === 0) return '—'
  const v = opciones.enDivisa ? n / opciones.tasa : n
  return `${opciones.simbolo} ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

describe('la póliza vista en su moneda', () => {
  /** Una póliza ya correcta: Q 68,887.25 asentados al 7.66777. */
  const correcta = { tasa: 7.66777, gtq: 68887.25 }

  it('en divisa muestra el monto de la operación', () => {
    expect(fmtVista(correcta.gtq, { enDivisa: true, tasa: correcta.tasa, simbolo: 'USD' }))
      .toBe('USD 8,984.00')
  })

  it('en moneda local muestra lo que dice el mayor', () => {
    expect(fmtVista(correcta.gtq, { enDivisa: false, tasa: correcta.tasa, simbolo: 'Q' }))
      .toBe('Q 68,887.25')
  })

  /** Los dos modos son la misma operación: uno es el otro por la tasa. */
  it('los dos modos no pueden contradecirse', () => {
    const enDivisa = correcta.gtq / correcta.tasa
    expect(Math.round(enDivisa * correcta.tasa * 100) / 100).toBeCloseTo(correcta.gtq, 2)
  })

  /**
   * La póliza rota del caso real: se asentó sin convertir, con tasa 1. En
   * divisa sigue mostrando los 8,984 que son — y en moneda local muestra los
   * 8,984 mal asentados, que es justo lo que hay que ver para corregirla.
   */
  it('una póliza sin convertir muestra el problema, no lo esconde', () => {
    expect(fmtVista(8984, { enDivisa: true,  tasa: 1, simbolo: 'USD' })).toBe('USD 8,984.00')
    expect(fmtVista(8984, { enDivisa: false, tasa: 1, simbolo: 'Q' })).toBe('Q 8,984.00')
  })

  it('un cero se muestra como raya en los dos modos', () => {
    expect(fmtVista(0, { enDivisa: true,  tasa: 7.66777, simbolo: 'USD' })).toBe('—')
    expect(fmtVista(0, { enDivisa: false, tasa: 7.66777, simbolo: 'Q' })).toBe('—')
  })
})

/**
 * Un 1 en una póliza en moneda extranjera NO es un tipo de cambio: es el
 * valor por omisión de la columna, y significa que se contabilizó sin
 * convertir. Mostrarlo como tasa hace creer que el dólar costó un quetzal.
 */
describe('cuándo se muestra el tipo de cambio en el encabezado', () => {
  const seMuestra = (isForeign: boolean, tasa: number) => isForeign && tasa > 1

  it('con una tasa real, se muestra', () => {
    expect(seMuestra(true, 7.66777)).toBe(true)
  })

  it('con 1 en moneda extranjera, no', () => {
    expect(seMuestra(true, 1)).toBe(false)
  })

  it('en una cuenta en quetzales, tampoco: no hay nada que convertir', () => {
    expect(seMuestra(false, 1)).toBe(false)
  })
})
