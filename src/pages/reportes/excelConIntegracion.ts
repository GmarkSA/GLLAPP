import type { LineaPoliza } from '../../api/integraciones'

/**
 * El Excel de los estados financieros con la integración adentro.
 *
 * El reporte en pantalla ya deja abrir cada cuenta y ver qué facturas la
 * forman. Descargado, esa parte se perdía: quedaba una lista de saldos y el
 * contador tenía que volver a Lucía —o pedir el detalle aparte— cada vez que
 * alguien preguntaba de dónde salían los honorarios.
 *
 * Aquí cada cuenta es una fila que se ABRE en Excel: el signo + del margen
 * izquierdo despliega sus movimientos. Es la función de esquema («agrupar»)
 * que Excel trae de fábrica, así que el archivo se abre igual en Excel,
 * Numbers y LibreOffice, y las cifras siguen siendo números —se pueden sumar,
 * filtrar y pegar en otro lado—, no texto.
 *
 * Esta pieza NO habla con el servidor: recibe lo que la pantalla ya cargó y
 * devuelve la hoja. Así la armadura se puede comprobar sin red.
 */

/** Una cuenta del estado financiero con su integración ya resuelta. */
export interface CuentaConIntegracion {
  code:    string
  name:    string
  balance: number
  /** Los movimientos que la forman. Vacío si no se pudo traer o no tiene. */
  lineas:  LineaPoliza[]
}

export interface GrupoDeCuentas {
  titulo:  string
  cuentas: CuentaConIntegracion[]
  total:   number
}

/** Una línea que no es cuenta: un total, un subtotal o un separador. */
export interface LineaDeTotal {
  etiqueta: string
  valor:    number
}

export type BloqueDeHoja =
  | { tipo: 'grupo'; grupo: GrupoDeCuentas }
  | { tipo: 'total'; total: LineaDeTotal }

/** Lo que entiende SheetJS en `ws['!rows']`. */
export interface FilaDeEsquema {
  level?:  number
  hidden?: boolean
}

export interface HojaConIntegracion {
  aoa:  (string | number | null)[][]
  rows: FilaDeEsquema[]
  anchos: { wch: number }[]
}

const ENCABEZADO_INTEGRACION = ['', 'Fecha', 'No. Factura', 'Proveedor / Descripción', 'Serie', 'Debe', 'Haber']

/** El texto que identifica el movimiento, con lo que haya: proveedor o glosa. */
const quienEs = (l: LineaPoliza): string =>
  l.vendorName?.trim() || l.glosa?.trim() || l.descripcion?.trim() || ''

/** El número de factura tal como se ve en la pantalla. */
const facturaDe = (l: LineaPoliza): string =>
  [l.numeroFactura, l.referencia].find(v => String(v ?? '').trim()) ?? ''

/**
 * Arma una hoja: cabecera, bloques, y debajo de cada cuenta sus movimientos
 * como filas hijas colapsadas.
 *
 * Una cuenta sin movimientos no se agrupa —no tendría nada que abrir— y se
 * escribe como una fila normal.
 */
export function construirHoja(
  titulo: string,
  subtitulo: string,
  bloques: BloqueDeHoja[],
): HojaConIntegracion {
  const aoa: (string | number | null)[][] = []
  const rows: FilaDeEsquema[] = []

  const fila = (contenido: (string | number | null)[], esquema: FilaDeEsquema = {}) => {
    aoa.push(contenido)
    rows.push(esquema)
  }

  fila([titulo])
  fila([subtitulo])
  fila([])

  for (const bloque of bloques) {
    if (bloque.tipo === 'total') {
      fila(['', bloque.total.etiqueta, bloque.total.valor])
      continue
    }

    const { titulo: tituloGrupo, cuentas, total } = bloque.grupo
    fila([tituloGrupo])

    for (const cuenta of cuentas) {
      const tieneDetalle = cuenta.lineas.length > 0
      fila([cuenta.code, cuenta.name, cuenta.balance])

      if (!tieneDetalle) continue

      // El encabezado del detalle también es hijo: se esconde con él.
      fila(ENCABEZADO_INTEGRACION, { level: 1, hidden: true })
      for (const l of cuenta.lineas) {
        fila([
          '',
          l.fecha ? String(l.fecha).slice(0, 10) : '',
          facturaDe(l),
          quienEs(l),
          l.serieFactura ?? '',
          Number(l.debe) || 0,
          Number(l.haber) || 0,
        ], { level: 1, hidden: true })
      }
    }

    fila(['', `Total ${tituloGrupo}`, total])
  }

  return {
    aoa,
    rows,
    anchos: [
      { wch: 12 },  // código / vacío
      { wch: 46 },  // nombre / fecha
      { wch: 18 },  // saldo / no. factura
      { wch: 38 },  // proveedor
      { wch: 12 },  // serie
      { wch: 16 },  // debe
      { wch: 16 },  // haber
    ],
  }
}

/**
 * Cuántas cuentas hay que integrar: lo que la pantalla tiene que ir a buscar
 * antes de poder armar el archivo. Sirve para contarle el avance al usuario.
 */
export const cuentasAIntegrar = (bloques: BloqueDeHoja[]): number =>
  bloques.reduce((n, b) => b.tipo === 'grupo' ? n + b.grupo.cuentas.length : n, 0)
