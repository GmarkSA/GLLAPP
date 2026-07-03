import { useState, useEffect, useCallback } from 'react'
import {
  Card, Form, Button, Select, DatePicker, InputNumber, Input,
  Table, Checkbox, Typography, Space, Tag, Alert, Divider,
  message, Radio, Segmented, Badge,
} from 'antd'
import { BankOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  createPagoRealizado, getPendingInvoicesByVendor,
  getAvailableAdvancesByVendor, applyAdvanceToInvoices,
  type PendingInvoice, type CreateVendorPaymentDto, type AdvancePayment,
} from '../../../api/pagosRealizados'
import { getVendors } from '../../../api/compras'
import { getBankAccounts } from '../../../api/bancos'

const { Text, Title } = Typography

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

type PaymentMode = 'regular' | 'advance'

export default function PagoRealizadoFormPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [paymentMode,    setPaymentMode]    = useState<PaymentMode>('regular')
  const [vendors,        setVendors]        = useState<any[]>([])
  const [bankAccounts,   setBankAccounts]   = useState<any[]>([])
  const [pendingInvs,    setPendingInvs]    = useState<PendingInvoice[]>([])
  const [advances,       setAdvances]       = useState<AdvancePayment[]>([])
  const [selectedIds,    setSelectedIds]    = useState<string[]>([])
  const [amounts,        setAmounts]        = useState<Record<string, number>>({})
  const [selectedAdv,    setSelectedAdv]    = useState<string | null>(null)
  const [advAmounts,     setAdvAmounts]     = useState<Record<string, number>>({})
  const [loadingInvs,    setLoadingInvs]    = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [mode,           setMode]           = useState<string>('bank_transfer')

  useEffect(() => {
    getVendors({ limit: 200 })
      .then(r => setVendors(Array.isArray(r) ? r : (r as any)?.data ?? []))
      .catch(() => {})
    getBankAccounts({ status: 'active' })
      .then(r => setBankAccounts(Array.isArray(r) ? r : (r as any)?.data ?? []))
      .catch(() => {})
  }, [])

  const onVendorChange = useCallback(async (vendorId: string) => {
    if (!vendorId) {
      setPendingInvs([]); setSelectedIds([]); setAmounts({})
      setAdvances([]); setSelectedAdv(null); setAdvAmounts({})
      return
    }
    setLoadingInvs(true)
    try {
      const [invs, advs] = await Promise.all([
        getPendingInvoicesByVendor(vendorId),
        getAvailableAdvancesByVendor(vendorId),
      ])
      setPendingInvs(invs)
      setAdvances(advs)
      setSelectedIds([]); setAmounts({})
      setSelectedAdv(null); setAdvAmounts({})
    } catch {
      message.error('No se pudieron cargar los datos del proveedor')
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

  const selectedAdvance = advances.find(a => a.id === selectedAdv)
  const totalAdvApplied = selectedIds.reduce((s, id) => s + (advAmounts[id] ?? 0), 0)

  // ── Columnas tabla facturas (pago regular) ───────────────────────────────────
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
    { title: 'Total', dataIndex: 'total', width: 120, align: 'right' as const,
      render: (v, r) => <Text style={{ fontFamily: 'monospace' }}>{fmtQ(v, r.currency)}</Text> },
    { title: 'Saldo', dataIndex: 'balance', width: 120, align: 'right' as const,
      render: (v, r) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v, r.currency)}</Text> },
    {
      title: 'Monto a pagar', key: 'toPay', width: 150, align: 'right' as const,
      render: (_, r) => selectedIds.includes(r.id) ? (
        <InputNumber
          size="small" min={0.01} max={r.balance}
          value={amounts[r.id] ?? r.balance} precision={2} style={{ width: 120 }}
          onChange={v => setAmounts(a => ({ ...a, [r.id]: v ?? r.balance }))}
          onClick={e => e.stopPropagation()}
        />
      ) : <Text type="secondary">—</Text>,
    },
  ]

  // ── Columnas tabla facturas al aplicar anticipo ──────────────────────────────
  const advInvoiceColumns: ColumnsType<PendingInvoice> = [
    {
      title: '', key: 'sel', width: 40,
      render: (_, r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onChange={() => {
            setSelectedIds(prev => {
              if (prev.includes(r.id)) {
                const next = prev.filter(x => x !== r.id)
                setAdvAmounts(a => { const cp = { ...a }; delete cp[r.id]; return cp })
                return next
              }
              setAdvAmounts(a => ({ ...a, [r.id]: r.balance }))
              return [...prev, r.id]
            })
          }}
        />
      ),
    },
    { title: 'Factura', dataIndex: 'invoiceNumber', width: 140,
      render: (v) => <Text style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text> },
    { title: 'Vencimiento', dataIndex: 'dueDate', width: 110,
      render: (v) => {
        if (!v) return <Text type="secondary">—</Text>
        const days = dayjs(v).diff(dayjs(), 'day')
        return <Tag color={days < 0 ? 'red' : days <= 7 ? 'orange' : 'green'}>{dayjs(v).format('DD/MM/YYYY')}</Tag>
      } },
    { title: 'Saldo factura', dataIndex: 'balance', width: 130, align: 'right' as const,
      render: (v, r) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v, r.currency)}</Text> },
    {
      title: 'Monto anticipo', key: 'advAmt', width: 150, align: 'right' as const,
      render: (_, r) => selectedIds.includes(r.id) ? (
        <InputNumber
          size="small" min={0.01}
          max={Math.min(r.balance, selectedAdvance ? Number(selectedAdvance.advanceBalance) : r.balance)}
          value={advAmounts[r.id] ?? r.balance} precision={2} style={{ width: 120 }}
          onChange={v => setAdvAmounts(a => ({ ...a, [r.id]: v ?? r.balance }))}
          onClick={e => e.stopPropagation()}
        />
      ) : <Text type="secondary">—</Text>,
    },
  ]

  // ── Submit regular ───────────────────────────────────────────────────────────
  const onFinishRegular = async (values: any) => {
    if (selectedIds.length === 0) { message.warning('Selecciona al menos una factura'); return }
    setSubmitting(true)
    try {
      const dto: CreateVendorPaymentDto = {
        type:          'regular',
        vendorId:      values.vendorId,
        invoiceIds:    selectedIds,
        amounts,
        paymentDate:   values.paymentDate.format('YYYY-MM-DD'),
        mode:          values.mode,
        currency:      'GTQ',
        reference:     values.reference || undefined,
        checkType:     values.checkType || undefined,
        bankAccountId: values.bankAccountId || undefined,
        notes:         values.notes || undefined,
      }
      const payment = await createPagoRealizado(dto)
      message.success(`Pago ${payment.paymentNumber} registrado`)
      if (payment.mode === 'check' && payment.checkNumber) {
        const print = window.confirm(`¿Imprimir el cheque ${payment.checkNumber}?`)
        if (print) window.open(`/bancos/pagos-realizados/${payment.id}/cheque`, '_blank')
      }
      navigate('/bancos/pagos-realizados')
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit anticipo ──────────────────────────────────────────────────────────
  const onFinishAdvance = async (values: any) => {
    if (!values.amount || Number(values.amount) <= 0) { message.warning('Ingresa el monto del anticipo'); return }
    setSubmitting(true)
    try {
      const dto: CreateVendorPaymentDto = {
        type:          'advance',
        vendorId:      values.vendorId,
        amount:        Number(values.amount),
        concept:       values.concept || 'Anticipo a proveedor',
        paymentDate:   values.paymentDate.format('YYYY-MM-DD'),
        mode:          values.mode,
        currency:      'GTQ',
        reference:     values.reference || undefined,
        checkType:     values.checkType || undefined,
        bankAccountId: values.bankAccountId || undefined,
        notes:         values.notes || undefined,
      }
      const payment = await createPagoRealizado(dto)
      message.success(`Anticipo ${payment.paymentNumber} registrado — Saldo disponible: ${fmtQ(Number(payment.advanceBalance ?? payment.amount))}`)
      if (payment.mode === 'check' && payment.checkNumber) {
        const print = window.confirm(`¿Imprimir el cheque ${payment.checkNumber}?`)
        if (print) window.open(`/bancos/pagos-realizados/${payment.id}/cheque`, '_blank')
      }
      navigate('/bancos/pagos-realizados')
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al registrar el anticipo')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit aplicar anticipo ──────────────────────────────────────────────────
  const onApplyAdvance = async () => {
    if (!selectedAdv) { message.warning('Selecciona un anticipo'); return }
    if (selectedIds.length === 0) { message.warning('Selecciona al menos una factura'); return }
    setSubmitting(true)
    try {
      await applyAdvanceToInvoices(selectedAdv, { invoiceIds: selectedIds, amounts: advAmounts })
      message.success(`Anticipo aplicado — Q ${totalAdvApplied.toLocaleString('es-GT', { minimumFractionDigits: 2 })} aplicados a ${selectedIds.length} factura(s)`)
      navigate('/bancos/pagos-realizados')
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al aplicar el anticipo')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Sección de datos del pago (compartida) ───────────────────────────────────
  const paymentDataCard = (
    <Card
      title="Datos del pago"
      bordered={false}
      style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Form.Item label="Proveedor" name="vendorId" rules={[{ required: true }]}>
          <Select
            showSearch placeholder="Seleccionar proveedor"
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
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
            allowClear placeholder="Seleccionar cuenta"
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
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Nuevo Pago a Proveedor</Title>
      </div>

      {/* Selector de modo */}
      <div style={{ marginBottom: 20 }}>
        <Segmented
          value={paymentMode}
          onChange={(v) => {
            setPaymentMode(v as PaymentMode)
            form.resetFields(['concept', 'amount'])
            setSelectedIds([]); setAmounts({}); setAdvAmounts({}); setSelectedAdv(null)
          }}
          options={[
            { label: <Space><FileTextOutlined /> Pago con factura</Space>,      value: 'regular' },
            { label: <Space><BankOutlined />    Anticipo sin factura</Space>,   value: 'advance' },
          ]}
          size="middle"
          style={{ background: '#f0f5ff' }}
        />
      </div>

      {/* ── PAGO REGULAR ──────────────────────────────────────────────────────── */}
      {paymentMode === 'regular' && (
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={onFinishRegular}
          initialValues={{ paymentDate: dayjs(), mode: 'bank_transfer', currency: 'GTQ' }}
        >
          {paymentDataCard}

          <Card
            title={
              <Space>
                <span>Facturas pendientes de pago</span>
                {selectedIds.length > 1 && <Tag color="blue">{selectedIds.length} seleccionadas</Tag>}
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
                  }}>Seleccionar todas</Button>
                  <Button size="small" onClick={() => { setSelectedIds([]); setAmounts({}) }}>Limpiar</Button>
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

          {/* Anticipos disponibles para cruzar */}
          {advances.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<ThunderboltOutlined />}
              style={{ marginBottom: 16 }}
              message={
                <Space>
                  <Text strong>Este proveedor tiene {advances.length} anticipo(s) disponible(s).</Text>
                  <Button
                    size="small" type="link"
                    onClick={() => setPaymentMode('advance')}
                    style={{ padding: 0 }}
                  >
                    Aplicar anticipo →
                  </Button>
                </Space>
              }
            />
          )}

          <Space>
            <Button onClick={() => navigate('/bancos/pagos-realizados')}>Cancelar</Button>
            <Button
              type="primary" htmlType="submit" loading={submitting}
              disabled={selectedIds.length === 0}
              style={{ background: '#1B3A6B' }}
            >
              Registrar pago {selectedIds.length > 1 ? 'masivo' : ''}{selectedIds.length > 0 ? ` — ${fmtQ(totalSelected)}` : ''}
            </Button>
          </Space>
        </Form>
      )}

      {/* ── ANTICIPO SIN FACTURA ────────────────────────────────────────────── */}
      {paymentMode === 'advance' && (
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={onFinishAdvance}
          initialValues={{ paymentDate: dayjs(), mode: 'bank_transfer', currency: 'GTQ' }}
        >
          {paymentDataCard}

          <Card
            title="Anticipo sin factura"
            bordered={false}
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="El anticipo genera una póliza contable: Débito Anticipos a Proveedores / Crédito Banco. Cuando llegue la factura, podrás aplicar este anticipo para cancelarla."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <Form.Item label="Monto del anticipo" name="amount" rules={[{ required: true, message: 'Ingresa el monto' }]}>
                <InputNumber
                  style={{ width: '100%' }} min={0.01} precision={2}
                  formatter={v => `Q ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v?.replace(/Q\s?|(,*)/g, '') as any}
                  placeholder="0.00"
                />
              </Form.Item>
              <Form.Item label="Concepto del anticipo" name="concept">
                <Input placeholder="Ej: Anticipo por orden de compra OC-2026-00045" />
              </Form.Item>
            </div>

            {/* Anticipos existentes del proveedor */}
            {advances.length > 0 && (
              <>
                <Divider plain style={{ fontSize: 12 }}>Anticipos existentes de este proveedor</Divider>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={advances}
                  rowKey="id"
                  columns={[
                    { title: 'No. Pago', dataIndex: 'paymentNumber', width: 150,
                      render: (v) => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
                    { title: 'Fecha', dataIndex: 'paymentDate', width: 110,
                      render: (v) => dayjs(v).format('DD/MM/YYYY') },
                    { title: 'Concepto', dataIndex: 'concept' },
                    { title: 'Monto original', dataIndex: 'amount', align: 'right' as const,
                      render: (v, r) => fmtQ(Number(v), r.currency) },
                    { title: 'Saldo disponible', dataIndex: 'advanceBalance', align: 'right' as const,
                      render: (v, r) => (
                        <Badge
                          count={fmtQ(Number(v), r.currency)}
                          style={{ backgroundColor: Number(v) > 0 ? '#52c41a' : '#d9d9d9', fontSize: 11 }}
                        />
                      ) },
                  ]}
                />

                <Divider plain style={{ fontSize: 12, marginTop: 20 }}>Aplicar anticipo existente a facturas pendientes</Divider>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Selecciona el anticipo que deseas aplicar:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Seleccionar anticipo..."
                    allowClear
                    value={selectedAdv}
                    onChange={(v) => {
                      setSelectedAdv(v ?? null)
                      setSelectedIds([]); setAdvAmounts({})
                    }}
                    options={advances.filter(a => Number(a.advanceBalance) > 0).map(a => ({
                      value: a.id,
                      label: `${a.paymentNumber} — Saldo: ${fmtQ(Number(a.advanceBalance))} — ${a.concept ?? ''}`,
                    }))}
                  />
                </div>

                {selectedAdv && pendingInvs.length > 0 && (
                  <>
                    <Alert
                      type="success"
                      style={{ marginBottom: 12 }}
                      message={`Saldo disponible del anticipo: ${fmtQ(Number(selectedAdvance?.advanceBalance ?? 0))} — Aplicado: ${fmtQ(totalAdvApplied)}`}
                    />
                    <Table
                      size="small"
                      columns={advInvoiceColumns}
                      dataSource={pendingInvs}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: 'Sin facturas pendientes' }}
                      summary={() => selectedIds.length > 0 ? (
                        <Table.Summary.Row style={{ background: '#f6ffed' }}>
                          <Table.Summary.Cell index={0} colSpan={3}>
                            <Text strong>Total a aplicar ({selectedIds.length} factura{selectedIds.length > 1 ? 's' : ''})</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} />
                          <Table.Summary.Cell index={4} align="right">
                            <Text strong style={{ fontFamily: 'monospace', color: '#52c41a', fontSize: 14 }}>
                              {fmtQ(totalAdvApplied)}
                            </Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      ) : null}
                    />
                    <div style={{ marginTop: 16 }}>
                      <Button
                        type="primary"
                        onClick={onApplyAdvance}
                        loading={submitting}
                        disabled={selectedIds.length === 0 || totalAdvApplied <= 0}
                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      >
                        Aplicar anticipo — {fmtQ(totalAdvApplied)}
                      </Button>
                    </div>
                  </>
                )}

                {selectedAdv && pendingInvs.length === 0 && (
                  <Alert type="info" message="No hay facturas pendientes para este proveedor." showIcon />
                )}
              </>
            )}
          </Card>

          <Space>
            <Button onClick={() => navigate('/bancos/pagos-realizados')}>Cancelar</Button>
            <Button
              type="primary" htmlType="submit" loading={submitting}
              style={{ background: '#1B3A6B' }}
            >
              Registrar anticipo
            </Button>
          </Space>
        </Form>
      )}
    </div>
  )
}
