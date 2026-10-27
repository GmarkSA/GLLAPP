import { Form, Input, InputNumber, Button, Typography, Tag, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Text } = Typography

/**
 * Los documentos pendientes con que un cliente o proveedor arranca en Lucía.
 *
 * Antes esto era un solo campo, «Saldo inicial (Q)», que además no hacía nada
 * contable: se guardaba en la ficha y ahí moría. Ahora cada documento va en su
 * propia línea y la ficha genera su póliza de apertura contra la cuenta de
 * orden, igual que la carga masiva por Excel.
 *
 * Por qué líneas y no una cifra: cada factura vieja se registró al tipo de
 * cambio de SU día. Una sola cifra obligaría a promediar las tasas, y el
 * resultado no coincidiría con ninguna factura ni se podría explicar después.
 *
 * Y el tipo de cambio aparece SOLO en moneda extranjera. Si el proveedor
 * factura en quetzales no hay conversión que hacer, y una casilla de tasa ahí
 * solo invita a escribir un número que no significa nada.
 */

export interface LineaDeApertura {
  referencia?: string
  fecha?: string
  monto?: number
  tipoCambio?: number
}

const centavos = (n: number) => Math.round(n * 100) / 100

export const esMonedaLocal = (moneda?: string) =>
  !moneda || moneda.trim().toUpperCase() === 'GTQ'

/** Lo que vale una línea en quetzales, que es como entra a los libros. */
export function lineaEnQuetzales(linea: LineaDeApertura | undefined, moneda?: string): number {
  const monto = Number(linea?.monto ?? 0)
  if (!monto) return 0
  if (esMonedaLocal(moneda)) return centavos(monto)
  return centavos(monto * Number(linea?.tipoCambio ?? 0))
}

export function totalEnQuetzales(lineas: Array<LineaDeApertura | undefined> = [], moneda?: string): number {
  return centavos(lineas.reduce((s, l) => s + lineaEnQuetzales(l, moneda), 0))
}

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Props {
  /** El nombre del campo del formulario donde viven las líneas. */
  name?: string
  /** La moneda del contacto. De ella depende que aparezca el tipo de cambio. */
  moneda?: string
  /** 'cliente' o 'proveedor', para el texto de ayuda. */
  lado: 'cliente' | 'proveedor'
}

export default function SaldoInicialContacto({
  name = 'openingBalanceLines', moneda, lado,
}: Props) {
  const form     = Form.useFormInstance()
  const enLocal  = esMonedaLocal(moneda)
  const divisa   = (moneda ?? 'GTQ').toUpperCase()
  const lineas   = (Form.useWatch(name, form) ?? []) as Array<LineaDeApertura | undefined>
  const total    = totalEnQuetzales(lineas, moneda)
  const cuenta   = lado === 'cliente' ? 'por cobrar' : 'por pagar'

  // El ancho de la rejilla cambia con la moneda: sin tipo de cambio ni
  // equivalente, las demás columnas aprovechan el espacio.
  const columnas = enLocal
    ? '1.4fr 160px 150px 40px'
    : '1.4fr 150px 140px 130px 150px 40px'

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 14 }}
        message={`Saldos pendientes con que este ${lado} arranca en Lucía`}
        description={
          enLocal
            ? `Cada documento que todavía se debe, en su propia línea. Al guardar se genera la `
              + `póliza de apertura contra la cuenta de orden, usando la cuenta ${cuenta} del ${lado}.`
            : `Este ${lado} opera en ${divisa}. Escribe el monto en ${divisa} y el tipo de cambio `
              + `CON QUE SE REGISTRÓ ESE DOCUMENTO —no el de hoy—: cada factura vieja entró a su `
              + `propia tasa, y así es como la deuda en quetzales coincide con las facturas reales.`
        }
      />

      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <>
            {fields.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: columnas, gap: 10,
                marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#6b7280',
              }}>
                <div>Referencia</div>
                <div>Fecha</div>
                <div style={{ textAlign: 'right' }}>Monto {divisa}</div>
                {!enLocal && <div style={{ textAlign: 'right' }}>Tipo de cambio</div>}
                {!enLocal && <div style={{ textAlign: 'right' }}>Equivalente Q</div>}
                <div />
              </div>
            )}

            {fields.map(({ key, name: i, ...rest }) => (
              <div key={key} style={{
                display: 'grid', gridTemplateColumns: columnas, gap: 10,
                alignItems: 'start', marginBottom: 8,
              }}>
                <Form.Item {...rest} name={[i, 'referencia']} style={{ marginBottom: 0 }}>
                  <Input placeholder="FAC-00120" />
                </Form.Item>

                <Form.Item {...rest} name={[i, 'fecha']} style={{ marginBottom: 0 }}>
                  <Input type="date" />
                </Form.Item>

                <Form.Item {...rest} name={[i, 'monto']} style={{ marginBottom: 0 }}>
                  <InputNumber<number>
                    style={{ width: '100%' }}
                    min={0}
                    precision={2}
                    placeholder="0.00"
                  />
                </Form.Item>

                {/*
                  * El tipo de cambio solo existe en moneda extranjera, y ahí es
                  * obligatorio: sin él el saldo entraría al balance por una
                  * séptima parte de su valor y nadie lo notaría.
                  */}
                {!enLocal && (
                  <Form.Item
                    {...rest}
                    name={[i, 'tipoCambio']}
                    style={{ marginBottom: 0 }}
                    rules={[({ getFieldValue }) => ({
                      validator(_, value) {
                        const monto = Number(getFieldValue([name, i, 'monto']) ?? 0)
                        if (!monto) return Promise.resolve()
                        if (Number(value) > 0) return Promise.resolve()
                        return Promise.reject(new Error('Falta el tipo de cambio'))
                      },
                    })]}
                  >
                    <InputNumber<number>
                      style={{ width: '100%' }}
                      min={0}
                      precision={6}
                      placeholder="7.700000"
                    />
                  </Form.Item>
                )}

                {!enLocal && (
                  <div style={{
                    paddingTop: 5, textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#1B3A6B',
                  }}>
                    {fmtQ(lineaEnQuetzales(lineas[i], moneda))}
                  </div>
                )}

                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => remove(i)}
                  aria-label="Quitar documento"
                />
              </div>
            ))}

            <Button
              type="dashed"
              onClick={() => add({})}
              icon={<PlusOutlined />}
              style={{ width: '100%', marginTop: fields.length ? 6 : 0 }}
            >
              Agregar documento
            </Button>

            {fields.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e5e7eb',
              }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Saldo inicial que entra a los libros
                </Text>
                <Tag color="#1B3A6B" style={{ fontSize: 14, padding: '4px 12px', margin: 0 }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(total)}</span>
                </Tag>
              </div>
            )}
          </>
        )}
      </Form.List>
    </>
  )
}
