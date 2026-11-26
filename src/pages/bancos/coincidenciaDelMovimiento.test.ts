import { describe, it, expect } from 'vitest'

/**
 * Con quién cuadró el banco, y en qué orden conviene ver las facturas.
 *
 * Son las dos reglas que hacían falta en la pantalla de categorizar:
 *
 *  1. La coincidencia ya está detectada —es lo que pinta la etiqueta de la
 *     lista— pero la pantalla la ignoraba: abría con las primeras facturas
 *     pendientes de cualquier proveedor y había que escribir el nombre a
 *     mano. Se lee del movimiento; y para los movimientos viejos, que solo
 *     tienen la etiqueta armada, se parte en el guión.
 *
 *  2. Una cuenta corriente se abona desde la factura más antigua hacia
 *     adelante. Con tres facturas del mismo monto, arriba va la que toca
 *     pagar, no una cualquiera.
 *
 * Las dos funciones son copia de las que usa el drawer; viven aquí para
 * poder probarlas sin montar la pantalla entera.
 */

/** Lo que el drawer deduce del movimiento. */
function coincidenciaDe(rawData: Record<string, any> | undefined) {
  const nombre = String(rawData?.matchName ?? '').trim()
    || String(rawData?.matchLabel ?? '').split('—')[0].trim()
  const numero = String(rawData?.matchInvoiceNumber ?? '').trim()
    || String(rawData?.matchLabel ?? '').split('—')[1]?.trim() || ''
  return nombre ? { nombre, numero } : null
}

function ordenarParaAplicar<T extends { invoiceNumber?: string; invoiceDate?: string }>(
  filas: T[], coincidencia: { numero: string } | null,
): T[] {
  return [...filas].sort((a, b) => {
    const sugerida = (f: T) => coincidencia?.numero && f.invoiceNumber === coincidencia.numero ? 0 : 1
    const porSugerida = sugerida(a) - sugerida(b)
    if (porSugerida !== 0) return porSugerida
    return String(a.invoiceDate ?? '').localeCompare(String(b.invoiceDate ?? ''))
  })
}

describe('con quién cuadró el movimiento', () => {
  it('lo lee de los datos que guarda la detección', () => {
    expect(coincidenciaDe({
      matchName: 'JORGE EDUARDO , ACEVEDO SOSA',
      matchInvoiceNumber: 'FP-00576',
      matchLabel: 'JORGE EDUARDO , ACEVEDO SOSA — FP-00576',
    })).toEqual({ nombre: 'JORGE EDUARDO , ACEVEDO SOSA', numero: 'FP-00576' })
  })

  /** Los movimientos de antes solo tienen la etiqueta ya armada. */
  it('y de los viejos, partiendo la etiqueta en el guión', () => {
    expect(coincidenciaDe({ matchLabel: 'POLLO CAMPERO SOCIEDAD ANONIMA — FP-00698' }))
      .toEqual({ nombre: 'POLLO CAMPERO SOCIEDAD ANONIMA', numero: 'FP-00698' })
  })

  it('un movimiento sin coincidencia no filtra nada', () => {
    expect(coincidenciaDe(undefined)).toBeNull()
    expect(coincidenciaDe({})).toBeNull()
    expect(coincidenciaDe({ matchLabel: ' — ' })).toBeNull()
  })
})

describe('el orden de las facturas pendientes', () => {
  /** El caso real: tres de Q6,300 del mismo proveedor. */
  const FACTURAS = [
    { invoiceNumber: 'FP-00667', invoiceDate: '2026-07-15', balance: 6_300 },
    { invoiceNumber: 'FP-00615', invoiceDate: '2026-06-20', balance: 6_300 },
    { invoiceNumber: 'FP-00576', invoiceDate: '2026-05-02', balance: 6_300 },
  ]

  it('de la más antigua a la más nueva', () => {
    expect(ordenarParaAplicar(FACTURAS, null).map(f => f.invoiceNumber))
      .toEqual(['FP-00576', 'FP-00615', 'FP-00667'])
  })

  it('y la que el banco señaló va de primera', () => {
    expect(ordenarParaAplicar(FACTURAS, { numero: 'FP-00615' }).map(f => f.invoiceNumber))
      .toEqual(['FP-00615', 'FP-00576', 'FP-00667'])
  })

  it('no altera la lista que recibe', () => {
    ordenarParaAplicar(FACTURAS, { numero: 'FP-00615' })
    expect(FACTURAS[0].invoiceNumber).toBe('FP-00667')
  })

  it('una factura sin fecha no rompe el orden', () => {
    const conHueco = [...FACTURAS, { invoiceNumber: 'FP-00700', balance: 100 }]
    expect(ordenarParaAplicar(conHueco, null)).toHaveLength(4)
  })
})
