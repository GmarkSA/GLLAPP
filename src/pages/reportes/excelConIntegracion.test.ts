import { describe, it, expect } from 'vitest'
import { construirHoja, cuentasAIntegrar, type BloqueDeHoja } from './excelConIntegracion'

/**
 * El Excel de los estados financieros con la integración adentro.
 *
 * Lo que se cuida aquí: que cada cuenta se pueda ABRIR en Excel y muestre sus
 * facturas, que las cifras bajen como números —no como texto— y que una
 * cuenta sin movimientos no quede con un desplegable vacío.
 */
const linea = (datos: Partial<any> = {}) => ({
  fecha: '2026-01-19', codigoPoliza: 'POL-001',
  descripcion: 'Compra', glosa: '', debe: 11116.07, haber: 0,
  vendorName: 'ABDY EXALEN, HERNANDEZ RONQUILLO',
  numeroFactura: 'FP-00336', serieFactura: 'B371674C',
  ...datos,
})

const BLOQUES: BloqueDeHoja[] = [
  {
    tipo: 'grupo',
    grupo: {
      titulo: 'Gastos',
      total: 681439.44,
      cuentas: [
        {
          code: '620001', name: 'Honorarios Profesionales', balance: 676388.44,
          lineas: [linea(), linea({ numeroFactura: 'FP-00337', debe: 9642.86 })],
        },
        // Sin movimientos: no hay nada que abrir.
        { code: '620002', name: 'Honorarios Contables', balance: 5051, lineas: [] },
      ],
    },
  },
  { tipo: 'total', total: { etiqueta: 'UTILIDAD NETA', valor: 139029.97 } },
]

describe('la hoja de estados financieros con integración', () => {
  const hoja = construirHoja('Estado de Resultados', 'Del 01/01/2026 al 30/11/2026', BLOQUES)

  /** El índice de la fila de una cuenta, para mirar lo que viene debajo. */
  const filaDe = (code: string) => hoja.aoa.findIndex(f => f[0] === code)

  it('la cuenta es una fila de primer nivel', () => {
    const i = filaDe('620001')
    expect(hoja.aoa[i]).toEqual(['620001', 'Honorarios Profesionales', 676388.44])
    expect(hoja.rows[i].level ?? 0).toBe(0)
  })

  it('sus facturas van debajo, agrupadas y colapsadas', () => {
    const i = filaDe('620001')
    // La primera hija es el encabezado del detalle.
    expect(hoja.aoa[i + 1]).toContain('No. Factura')
    expect(hoja.rows[i + 1]).toEqual({ level: 1, hidden: true })

    const primera = hoja.aoa[i + 2]
    expect(primera[1]).toBe('2026-01-19')
    expect(primera[2]).toBe('FP-00336')
    expect(primera[3]).toContain('ABDY EXALEN')
    expect(primera[4]).toBe('B371674C')
    expect(hoja.rows[i + 2]).toEqual({ level: 1, hidden: true })
  })

  /** Que se puedan sumar en Excel: números, no texto con «Q». */
  it('los montos bajan como números', () => {
    const i = filaDe('620001')
    expect(typeof hoja.aoa[i][2]).toBe('number')
    expect(hoja.aoa[i + 2][5]).toBe(11116.07)
    expect(typeof hoja.aoa[i + 2][5]).toBe('number')
  })

  it('una cuenta sin movimientos no abre nada', () => {
    const i = filaDe('620002')
    const siguiente = hoja.aoa[i + 1]
    // Lo que sigue es el total del grupo, no un detalle vacío.
    expect(siguiente[1]).toBe('Total Gastos')
    expect(hoja.rows[i + 1].level ?? 0).toBe(0)
  })

  it('el total del grupo y los totales sueltos quedan al nivel de arriba', () => {
    const iTotal = hoja.aoa.findIndex(f => f[1] === 'Total Gastos')
    expect(hoja.aoa[iTotal][2]).toBe(681439.44)
    expect(hoja.rows[iTotal].level ?? 0).toBe(0)

    const iNeta = hoja.aoa.findIndex(f => f[1] === 'UTILIDAD NETA')
    expect(hoja.aoa[iNeta][2]).toBe(139029.97)
    expect(hoja.rows[iNeta].level ?? 0).toBe(0)
  })

  it('encabeza con el título y el período', () => {
    expect(hoja.aoa[0][0]).toBe('Estado de Resultados')
    expect(hoja.aoa[1][0]).toBe('Del 01/01/2026 al 30/11/2026')
  })

  /** Hay una fila de esquema por cada fila de datos: si no, Excel los desfasa. */
  it('cada fila tiene su nivel', () => {
    expect(hoja.rows).toHaveLength(hoja.aoa.length)
  })

  it('cuenta cuántas integraciones hay que traer', () => {
    expect(cuentasAIntegrar(BLOQUES)).toBe(2)
  })
})

describe('de dónde sale el texto de cada movimiento', () => {
  /** Devuelve la fila del movimiento: título, subtítulo, blanco, grupo, cuenta, encabezado. */
  const movimientoDe = (l: any) => construirHoja('X', 'Y', [{
    tipo: 'grupo',
    grupo: { titulo: 'G', total: 0, cuentas: [{ code: '1', name: 'C', balance: 0, lineas: [l] }] },
  }]).aoa[6]

  it('el proveedor manda cuando viene', () => {
    expect(movimientoDe(linea({ vendorName: 'PROVEEDOR X', glosa: 'otra cosa' }))[3])
      .toBe('PROVEEDOR X')
  })

  /** Una póliza manual no tiene proveedor: se muestra su glosa. */
  it('sin proveedor, la glosa', () => {
    expect(movimientoDe(linea({ vendorName: '', glosa: 'Ajuste de cierre' }))[3])
      .toBe('Ajuste de cierre')
  })

  it('y sin glosa, la descripción de la póliza', () => {
    expect(movimientoDe(linea({ vendorName: '', glosa: '', descripcion: 'Depreciación mensual' }))[3])
      .toBe('Depreciación mensual')
  })

  /** Un movimiento que no nace de una factura cae a su referencia. */
  it('sin número de factura, la referencia', () => {
    expect(movimientoDe(linea({ numeroFactura: '', referencia: 'REC-0012' }))[2])
      .toBe('REC-0012')
  })
})

/**
 * La prueba de fuego: que el ARCHIVO salga con los grupos.
 *
 * Armar bien el arreglo no sirve de nada si la librería no escribe el
 * esquema. Esto escribe el xlsx de verdad, lo vuelve a leer y comprueba que
 * los niveles siguen ahí.
 */
describe('el archivo que se descarga', () => {
  it('lleva las facturas agrupadas bajo su cuenta', async () => {
    const XLSX = await import('xlsx')
    const hoja = construirHoja('Estado de Resultados', 'Del 01/01/2026 al 30/11/2026', BLOQUES)

    const ws = XLSX.utils.aoa_to_sheet(hoja.aoa)
    ws['!rows'] = hoja.rows as any
    ;(ws as any)['!outline'] = { above: true }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estado de Resultados')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const releido = XLSX.read(buf, { type: 'buffer', cellStyles: true })
    const hojaLeida = releido.Sheets['Estado de Resultados']

    const niveles = (hojaLeida['!rows'] ?? []).map((r: any) => r?.level ?? 0)
    expect(niveles.filter(n => n === 1).length).toBe(3)   // encabezado + dos facturas

    /**
     * Y el monto sigue siendo número al volver a leerlo. Fila 7: título,
     * subtítulo, blanco, «Gastos», la cuenta, el encabezado del detalle y
     * recién la primera factura. Columna F = Debe.
     */
    expect(hojaLeida['F7']?.t).toBe('n')
    expect(hojaLeida['F7']?.v).toBeCloseTo(11116.07, 2)
  })
})
