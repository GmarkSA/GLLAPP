import { Typography, Tag } from 'antd'

const { Text } = Typography

/**
 * La cartera vista en su propia moneda.
 *
 * Los tramos de antigüedad van en quetzales porque es la moneda funcional y
 * así se pueden sumar entre sí. Pero una cartera en dólares también hay que
 * verla EN DÓLARES: es el saldo que el contacto reconoce, el que se concilia
 * con él y el que se revalúa al cierre de cada mes.
 *
 * El equivalente en quetzales que se muestra junto a cada moneda es el que
 * está en los libros: después de un ajuste de moneda es el saldo REVALUADO,
 * no el histórico, para que este auxiliar cuadre con el Balance General.
 */

export interface SaldoDeMoneda {
  moneda: string
  saldo: number
  saldoGTQ: number
  documentos: number
}

const simbolo = (moneda: string) => moneda.toUpperCase() === 'GTQ' ? 'Q' : `${moneda.toUpperCase()} `

const monto = (n: number) =>
  Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  saldos?: SaldoDeMoneda[]
  /** 'cliente' o 'proveedor', solo para el texto. */
  lado: 'cliente' | 'proveedor'
}

export default function SaldosPorMoneda({ saldos, lado }: Props) {
  const enMonedaExtranjera = (saldos ?? []).filter(s => s.moneda.toUpperCase() !== 'GTQ')

  // Sin cartera en otra moneda no hay nada que separar: el total en quetzales
  // que ya está arriba lo dice todo.
  if (!enMonedaExtranjera.length) return null

  return (
    <div style={{
      marginBottom: 14, padding: '10px 14px',
      background: '#f8faff', borderRadius: 8, border: '1px solid #dbe4f0',
    }}>
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        Saldos por moneda
      </Text>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${(saldos ?? []).length}, minmax(160px, 1fr))`,
        gap: 10,
      }}>
        {(saldos ?? []).map(s => (
          <div key={s.moneda} style={{
            padding: '8px 12px', background: '#fff',
            borderRadius: 6, border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Tag color={s.moneda.toUpperCase() === 'GTQ' ? 'default' : 'green'}
                style={{ margin: 0, fontSize: 10 }}>
                {s.moneda.toUpperCase()}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {s.documentos} doc{s.documentos === 1 ? '' : 's'}
              </Text>
            </div>

            <div style={{
              fontSize: 16, fontWeight: 700, color: '#1B3A6B',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {simbolo(s.moneda)}{monto(s.saldo)}
            </div>

            {/* El equivalente solo donde aporta algo: en quetzales es el mismo. */}
            {s.moneda.toUpperCase() !== 'GTQ' && (
              <Text type="secondary" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                ≈ Q {monto(s.saldoGTQ)} en libros
              </Text>
            )}
          </div>
        ))}
      </div>

      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
        El equivalente en quetzales es el que está en los libros. Tras un ajuste de moneda
        es el saldo revaluado, así que cuadra con la cuenta del Balance y con el auxiliar
        {lado === 'cliente' ? ' de clientes.' : ' de proveedores.'}
      </Text>
    </div>
  )
}
