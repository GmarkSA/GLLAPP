import { useState, useEffect, useCallback } from 'react'
import {
  Card, Form, Button, Select, DatePicker, InputNumber, Input,
  Table, Checkbox, Typography, Space, Tag, Alert, Divider,
  message, Row, Col, Radio,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  createPagoRealizado, getPendingInvoicesByVendor,
  type PendingInvoice, type CreateVendorPaymentDto,
} from '../../../api/pagosRealizados'
import { getVendors } from '../../../api/compras'
import { getBankAccounts } from '../../../api/bancos'

const { Text, Title } = Typography

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function PagoRealizadoFormPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [vendors,       setVendors]       = useState<any[]>([])
  const [bankAccounts,  setBankAccounts]  = useState<any[]>([])
  const [pendingInvs,   setPendingInvs]   = useState<PendingInvoice[]>([])
  const [selectedIds,   setSelectedIds]   = useState<string[]>([])
  const [amounts,       setAmounts]       = useState<Record<string, number>>({})
  const [loadingInvs,   setLoadingInvs]   = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [mode,          setMode]          = useState<string>('bank_transfer')
  const [paymentType,   setPaymentType]   = useState<'single' | 'massive'>('single')

  useEffect(() => {
    getVendors({ limit: 200 })
      .then(r => setVendors(Array.isArray(r) ? r : (r as any)?.data ?? []))
      .catch(() => {})
    getBankAccounts({ status: 'active' })
      .then(r => setBankAccounts(Array.isArray(r) ? r : (r as any)?.data ?? []))
      .catch(() => {})
  }, [])

  const onVendorChange = useCallback(async (vendorId: string) => {
    if (!vendorId) { setPendingInvs([]); setSelectedIds([]); setAmounts({}); return }
    setLoadingInvs(true)
    try {
      const invs = await getPendingInvoicesByVendor(vendorId)
      setPendingInvs(invs)
      setSelectedIds([])
      setAmounts({})
    } catch {
      message.error('No se pudieron cargar las facturas')
    } finally {
      setLoadingInvs(false)
    }
  }, [])

  const toggleInvoice = (id: string, balance: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id)
        setAmounts(a => { const cp = { ...a }; delete cp[id]; return cp })
        return next
      }
      setAmounts(a => ({ ...a, [id]: balance }))
      return [...prev, id]
    })
  }

  const totalSelected = selectedIds.reduce((s, id) => s + (amounts[id] ?? 0), 0)

  const invoiceColumns: ColumnsType<PendingInvoice> = [
    {
      title: '', key: 'sel', width: 40,
      render: (_, r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onChange={() => toggleInvoice(r.id, r.balance)}
        />
      ),
    },
    {
      title: 'Factura', dataIndex: 'invoiceNumber', width: 140,
      render: (v) => <Text style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Vencimiento', dataIndex: 'dueDate', width: 110,
      render: (v) => {
        if (!v) return <Text type="secondary">—</Text>
        const days = dayjs(v).diff(dayjs(), 'day')
        const color = days < 0 ? 'red' : days <= 7 ? 'orange' : 'green'
        return <Tag color={color}>{dayjs(v).format('DD/MM/YYYY')}</Tag>
      },
    },
    {
      title: 'Total', dataIndex: 'total', width: 120, align: 'right',
      render: (v, r) => <Text style={{ fontFamily: 'monospace' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 120, align: 'right',
      render: (v, r) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Monto a pagar', key: 'toPay', width: 150, align: 'right',
      render: (_, r) => selectedIds.includes(r.id) ? (
        <InputNumber
          size="small"
          min={0.01}
          max={r.balance}
          value={amounts[r.id] ?? r.balance}
          precision={2}
          style={{ width: 120 }}
          onChange={v => setAmounts(a => ({ ...a, [r.id]: v ?? r.balance }))}
          onClick={e => e.stopPropagation()}
        />
      ) : <Text type="secondary">—</Text>,
    },
  ]

  const onFinish = async (values: any) => {
    if (selectedIds.length === 0) {
      message.warning('Selecciona al menos una factura')
      return
    }
    setSubmitting(true)
    try {
      const dto: CreateVendorPaymentDto = {
        vendorId:      values.vendorId,
        invoiceIds:    selectedIds,
        amounts:       amounts,
        paymentDate:   values.paymentDate.format('YYYY-MM-DD'),
        mode:          values.mode,
        currency:      'GTQ',
        reference:     values.reference || undefined,
        checkType:     values.checkType || undefined,
        bankAccountId: values.bankAccountId || undefined,
        notes:         values.notes || undefined,
      }
      const payment = await createPagoRealizado(dto)
      message.success(`Pago ${payment.paymentNumber} registrado correctamente`)

      if (payment.mode === 'check' && payment.checkNumber) {
        const print = window.confirm(`¿Desea imprimir el cheque ${payment.checkNumber}?`)
        if (print) window.open(`/compras/pagos-realizados/${payment.id}/cheque`, '_blank')
      }

      navigate('/compras/pagos-realizados')
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Nuevo Pago a Proveedor</Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        size="small"
        onFinish={onFinish}
        initialValues={{ paymentDate: dayjs(), mode: 'bank_transfer', currency: 'GTQ' }}
      >
        <Card
          title="Datos del pago"
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="Proveedor" name="vendorId" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Seleccionar proveedor"
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={vendors.map((v: any) => ({ value: v.id, label: v.name }))}
                onChange={onVendorChange}
              />
            </Form.Item>

            <Form.Item label="Fecha de pago" name="paymentDate" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Modo de pago" name="mode" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'cash',          label: 'Efectivo' },
                  { value: 'bank_transfer', label: 'Transferencia bancaria' },
                  { value: 'check',         label: 'Cheque' },
                  { value: 'credit_card',   label: 'Tarjeta de crédito' },
                  { value: 'debit_card',    label: 'Tarjeta de débito' },
                  { value: 'other',         label: 'Otro' },
                ]}
                onChange={v => setMode(v)}
              />
            </Form.Item>

            <Form.Item label="Cuenta bancaria" name="bankAccountId">
              <Select
                allowClear
                placeholder="Seleccionar cuenta"
                options={bankAccounts.map((b: any) => ({
                  value: b.id,
                  label: `${b.name}${b.bankName ? ` — ${b.bankName}` : ''}`,
                }))}
              />
            </Form.Item>

            {mode === 'check' && (
              <Form.Item label="Tipo de cheque" name="checkType">
                <Radio.Group>
                  <Radio value="physical">Físico</Radio>
                  <Radio value="electronic">Electrónico</Radio>
                </Radio.Group>
              </Form.Item>
            )}

            <Form.Item label="Referencia / No. transferencia" name="reference">
              <Input placeholder="Número de referencia..." />
            </Form.Item>

            <Form.Item label="Notas" name="notes" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} placeholder="Observaciones..." />
            </Form.Item>
          </div>
        </Card>

        {/* Facturas pendientes */}
        <Card
          title={
            <Space>
              <span>Facturas pendientes de pago</span>
              {selectedIds.length > 1 && (
                <Tag color="blue">{selectedIds.length} seleccionadas</Tag>
              )}
            </Space>
          }
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
          extra={
            pendingInvs.length > 0 && (
              <Space>
                <Button size="small" onClick={() => {
                  setSelectedIds(pendingInvs.map(i => i.id))
                  setAmounts(Object.fromEntries(pendingInvs.map(i => [i.id, i.balance])))
                }}>
                  Seleccionar todas
                </Button>
                <Button size="small" onClick={() => { setSelectedIds([]); setAmounts({}) }}>
                  Limpiar
                </Button>
              </Space>
            )
          }
        >
          {!form.getFieldValue('vendorId') ? (
            <Alert type="info" message="Selecciona un proveedor para ver sus facturas pendientes" showIcon />
          ) : (
            <Table
              columns={invoiceColumns}
              dataSource={pendingInvs}
              rowKey="id"
              loading={loadingInvs}
              size="small"
              pagination={false}
              onRow={(r) => ({ onClick: () => toggleInvoice(r.id, r.balance), style: { cursor: 'pointer' } })}
              locale={{ emptyText: 'Sin facturas pendientes de pago' }}
              summary={() => selectedIds.length > 0 ? (
                <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Total a pagar ({selectedIds.length} factura{selectedIds.length > 1 ? 's' : ''})</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 14 }}>
                      {fmtQ(totalSelected)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                </Table.Summary.Row>
              ) : null}
            />
          )}
        </Card>

        {/* Acciones */}
        <Space>
          <Button onClick={() => navigate('/compras/pagos-realizados')}>
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={selectedIds.length === 0}
            style={{ background: '#1B3A6B' }}
          >
            Registrar pago {selectedIds.length > 1 ? 'masivo' : ''} — {fmtQ(totalSelected)}
          </Button>
        </Space>
      </Form>
    </div>
  )
}
