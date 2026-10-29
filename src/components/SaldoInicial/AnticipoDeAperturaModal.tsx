import { useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, Alert, Typography, message } from 'antd'

const { Text } = Typography

/**
 * Registrar un anticipo que ya existía antes de Lucía.
 *
 * Los anticipos nacen de un movimiento de banco: el de proveedor desde Pagos
 * Realizados, el de cliente desde Pagos Recibidos. Por eso los dos exigen
 * cuenta bancaria, y por eso no había dónde cargar uno migrado — ese dinero se
 * movió antes de Lucía y pedir un banco obligaba a inventar un movimiento que
 * nunca ocurrió.
 *
 * Aquí no se pide banco: la contrapartida es la cuenta de saldos de apertura,
 * la misma contra la que entra el resto de la carga inicial. El anticipo
 * resultante es igual a cualquier otro — se aplica a facturas y entra a los
 * reportes.
 */

export interface AnticipoDeAperturaDto {
  contactoId: string
  monto: number
  fecha: string
  moneda: string
  tipoCambio: number
  referencia?: string
  notas?: string
}

const centavos = (n: number) => Math.round(n * 100) / 100

export const esMonedaLocal = (moneda?: string) =>
  !moneda || moneda.trim().toUpperCase() === 'GTQ'

/** Lo que vale el anticipo en quetzales, que es como entra a los libros. */
export function anticipoEnQuetzales(monto?: number, moneda?: string, tc?: number): number {
  const m = Number(monto ?? 0)
  if (!m) return 0
  if (esMonedaLocal(moneda)) return centavos(m)
  return centavos(m * Number(tc ?? 0))
}

interface Props {
  open: boolean
  onClose: () => void
  /** 'cliente' o 'proveedor', para los textos y la etiqueta del contacto. */
  lado: 'cliente' | 'proveedor'
  /** Los contactos entre los que elegir. */
  contactos: Array<{ id: string; name: string; currency?: string }>
  /** Qué hacer con los datos. Debe mandar esSaldoInicial al backend. */
  onGuardar: (dto: AnticipoDeAperturaDto) => Promise<unknown>
  onGuardado?: () => void
}

export default function AnticipoDeAperturaModal({
  open, onClose, lado, contactos, onGuardar, onGuardado,
}: Props) {
  const [form] = Form.useForm()
  const [guardando, setGuardando] = useState(false)

  const contactoId = Form.useWatch('contactoId', form) as string | undefined
  const monto      = Form.useWatch('monto', form) as number | undefined
  const tipoCambio = Form.useWatch('tipoCambio', form) as number | undefined

  // La moneda la manda el contacto: un proveedor en dólares anticipa dólares.
  const contacto = contactos.find(c => c.id === contactoId)
  const moneda   = (contacto?.currency ?? 'GTQ').toUpperCase()
  const enLocal  = esMonedaLocal(moneda)
  const enQ      = anticipoEnQuetzales(monto, moneda, tipoCambio)

  const etiqueta = lado === 'cliente' ? 'Cliente' : 'Proveedor'

  const guardar = async () => {
    const v = await form.validateFields()
    setGuardando(true)
    try {
      await onGuardar({
        contactoId: v.contactoId,
        monto:      Number(v.monto),
        fecha:      v.fecha,
        moneda,
        tipoCambio: enLocal ? 1 : Number(v.tipoCambio),
        referencia: v.referencia || undefined,
        notas:      v.notas || undefined,
      })
      message.success('Anticipo de saldo inicial registrado')
      form.resetFields()
      onClose()
      onGuardado?.()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo registrar el anticipo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={guardar}
      confirmLoading={guardando}
      okText="Registrar"
      cancelText="Cancelar"
      title="Anticipo de saldo inicial"
      destroyOnHidden
      width={620}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`Un anticipo que ya existía antes de Lucía`}
        description={
          `No se pide cuenta bancaria: ese dinero se movió antes de usar Lucía, así que no hay `
          + `movimiento de banco que registrar. La contrapartida es la cuenta de saldos de `
          + `apertura, igual que el resto de la carga inicial.`
        }
      />

      <Form form={form} layout="vertical" size="small">
        <Form.Item
          name="contactoId"
          label={etiqueta}
          rules={[{ required: true, message: `Elige el ${lado}` }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={`Buscar ${lado}…`}
            options={contactos.map(c => ({
              value: c.id,
              label: `${c.name}${c.currency && c.currency !== 'GTQ' ? ` · ${c.currency}` : ''}`,
            }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="referencia" label="Referencia">
            <Input placeholder="Recibo, boleta o documento" />
          </Form.Item>
          <Form.Item
            name="fecha"
            label="Fecha"
            rules={[{ required: true, message: 'Requerida' }]}
          >
            <Input type="date" />
          </Form.Item>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: enLocal ? '1fr' : '1fr 1fr 1fr',
          gap: 12,
        }}>
          <Form.Item
            name="monto"
            label={`Monto ${moneda}`}
            rules={[{ required: true, message: 'Requerido' }]}
          >
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
          </Form.Item>

          {/*
            * El tipo de cambio solo aparece en moneda extranjera. En quetzales
            * no hay conversión que hacer, y una casilla ahí solo invita a
            * escribir un número que no significa nada.
            */}
          {!enLocal && (
            <Form.Item
              name="tipoCambio"
              label="Tipo de cambio"
              tooltip="El tipo de cambio con que se registró ese anticipo, no el de hoy."
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <InputNumber<number> style={{ width: '100%' }} min={0} precision={6} placeholder="7.700000" />
            </Form.Item>
          )}

          {!enLocal && (
            <Form.Item label="Equivalente Q">
              <div style={{
                paddingTop: 4, fontVariantNumeric: 'tabular-nums',
                fontWeight: 600, color: '#1B3A6B',
              }}>
                Q {enQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Form.Item>
          )}
        </div>

        <Form.Item name="notas" label="Notas">
          <Input.TextArea rows={2} placeholder="Opcional" />
        </Form.Item>

        <Text type="secondary" style={{ fontSize: 11 }}>
          Queda abierto y se puede aplicar a facturas como cualquier otro anticipo.
        </Text>
      </Form>
    </Modal>
  )
}
