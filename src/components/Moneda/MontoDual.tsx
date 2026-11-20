import { Typography } from 'antd'
import { esLocal, fmtQ, fmtMoneda, enQuetzales, fmtTasa, numeros } from '../../utils/moneda'
import type { DocumentoConMoneda } from '../../utils/moneda'

const { Text } = Typography

/**
 * El monto de un documento, como se debe ver en una empresa de dos monedas.
 *
 *   - documento local      →  Q 1,234.56
 *   - documento en dólares →  USD 3,057.51
 *                             Q 23,434.32   (con su tasa, 7.665000)
 *
 * No es un invento: es el `FmtDual` que el listado de Facturas de Proveedor
 * ya usaba desde hace meses. Estaba escrito ahí dentro, así que ninguna otra
 * pantalla lo podía usar, y cada módulo terminó imprimiendo «Q» sobre montos
 * en dólares. Esto es el mismo componente, movido a donde todos lo alcanzan.
 *
 * El equivalente sale de la tasa del PROPIO documento — la del día en que se
 * registró— nunca de la de hoy: es lo que hace que la cartera cuadre contra
 * el mayor.
 */
export interface MontoDualProps extends DocumentoConMoneda {
  monto: number | string | null | undefined
  /** Resalta la cifra principal: para la fila de total. */
  fuerte?: boolean
  /** Agrega el tipo de cambio junto al equivalente. */
  conTasa?: boolean
  tamano?: number
  color?: string
}

export function MontoDual({
  monto, currency, exchangeRate, fuerte, conTasa, tamano = 13, color,
}: MontoDualProps) {
  if (esLocal(currency)) {
    return (
      <Text strong={fuerte} style={{ fontSize: tamano, color, ...numeros }}>
        {fmtQ(monto)}
      </Text>
    )
  }

  const doc = { currency, exchangeRate }
  return (
    <div style={{ textAlign: 'right' }}>
      <Text style={{ fontSize: tamano, color: color ?? '#374151', fontWeight: fuerte ? 700 : 600, ...numeros }}>
        {fmtMoneda(monto, currency)}
      </Text>
      <br />
      <Text style={{ fontSize: tamano - 2, color: '#6b7280', ...numeros }}>
        {fmtQ(enQuetzales(monto, doc))}
        {conTasa && <span style={{ marginLeft: 4 }}>· T/C {fmtTasa(doc)}</span>}
      </Text>
    </div>
  )
}

export default MontoDual
