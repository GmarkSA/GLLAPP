import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Select, DatePicker, InputNumber, Input, Button, Typography,
  Space, Breadcrumb, message, Tag, Row, Col, Spin, Radio, Table, Alert, Checkbox,
} from 'antd'
import {
  DollarOutlined, SaveOutlined, ArrowLeftOutlined, ThunderboltOutlined,
  DeleteOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { createPagoRecibido, type PaymentMode, PAYMENT_MODE_LABELS } from '../../../api/pagos-recibidos'
import { getInvoices, type Invoice } from '../../../api/facturas'
import { getCustomers } from '../../../api/contactos'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'

const { Title, Text } = Typography
const { Option } = Select

const r2 = (n: number) => Math.round(n * 100) / 100
const fmtQ = (n: number | undefined) =>
  n !== undefined ? `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—'

interface Customer { id: string; name: string; legalName?: string; taxId?: string }

export default function PagoRecibidoFormPage() {
  const navigate   = useNavigate()
  const [form]     = Form.useForm()

  const [saving,       setSaving]       = useState(false)
  const [isAdvance,    setIsAdvance]    = useState(false)
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [loadingCust,  setLoadingCust]  = useState(false)
  const [selectedCust, setSelectedCust] = useState<string | null>(null)
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([])
  const [loadingInv,   setLoadingInv]   = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isrEnabled,   setIsrEnabled]   = useState(false)
  const [isrAmount,    setIsrAmount]    = useState<number>(0)
  // allocations: invoiceId → amount to apply
  const [allocations,  setAllocations]  = useState<Record<string, number>>({})
  const [totalAmount,  setTotalAmount]  = useState<number | null>(null)
  const [autoAnticipo, setAutoAnticipo] = useState(true)   // auto-create advance for excess
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Customers ─────────────────────────────────────────────────────────────
  const fetchCustomers = (search: string) => {
    setLoadingCust(true)
    getCustomers({ limit: 100, search: search || undefined })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map(c => ({ id: c.id, name: c.name, legalName: c.legalName, taxId: c.taxId })))
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCust(false))
  }

  useEffect(() => { fetchCustomers('') }, [])

  // ── Bank accounts ─────────────────────────────────────────────────────────
  useEffect(() => {
    getBankAccounts({ status: 'active' })
      .then((res: any) => setBankAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setBankAccounts([]))
  }, [])

  // ── Open invoices when customer changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedCust) { setOpenInvoices([]); setAllocations({}); return }
    setLoadingInv(true)
    getInvoices({ customerId: selectedCust, limit: 200 })
      .then(res => {
        const open = (res.data ?? [])
          .filter(inv => ['sent', 'partial', 'overdue'].includes(inv.status) && Number(inv.balance) > 0)
          .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime())
        setOpenInvoices(open)
        setAllocations({})
      })
      .catch(() => setOpenInvoices([]))
      .finally(() => setLoadingInv(false))
  }, [selectedCust])

  // ── Auto-distribute oldest-first ─────────────────────────────────────────
  const autoDistribute = useCallback((amount: number) => {
    let remaining = r2(amount)
    const newAlloc: Record<string, number> = {}
    for (const inv of openInvoices) {
      if (remaining <= 0) { newAlloc[inv.id] = 0; continue }
      const bal   = r2(Number(inv.balance))
      const apply = r2(Math.min(remaining, bal))
      newAlloc[inv.id] = apply
      remaining = r2(remaining - apply)
    }
    setAllocations(newAlloc)
  }, [openInvoices])

  const clearAllocations = () => {
    setAllocations(Object.fromEntries(openInvoices.map(inv => [inv.id, 0])))
  }

  // derived totals
  const totalApplied  = r2(Object.values(allocations).reduce((s, v) => s + (v || 0), 0))
  const totalReceived = totalAmount ?? 0
  const difference    = r2(totalReceived - totalApplied)

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await form.validateFields(['customerId', 'paymentDate'])
    } catch { return }

    if (isAdvance) {
      // Anticipo — flujo simple existente
      try { await form.validateFields(['amount']) } catch { return }
      setSaving(true)
      try {
        const vals        = form.getFieldsValue()
        const paymentDate = (vals.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD')
        const accountingDate = vals.accountingDate ? (vals.accountingDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined
        const pago = await createPagoRecibido({
          customerId:    selectedCust!,
          paymentDate, accountingDate,
          amount:        vals.amount,
          mode:          vals.mode as PaymentMode,
          reference:     vals.reference || undefined,
          bankAccountId: vals.bankAccountId || undefined,
          notes:         vals.notes || undefined,
          currency:      'GTQ',
          isAdvance:     true as const,
        })
        message.success(`Anticipo ${pago.paymentNumber} registrado`)
        navigate(`/ventas/pagos-recibidos/${pago.id}`)
      } catch (e: any) {
        const raw = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al registrar anticipo'
        message.error(Array.isArray(raw) ? raw.join(' | ') : raw, 8)
      } finally { setSaving(false) }
      return
    }

    // Multi-invoice payment
    const invoicesToPay = openInvoices.filter(inv => (allocations[inv.id] ?? 0) > 0)
    if (invoicesToPay.length === 0) {
      message.error('Aplica al menos un importe a una factura antes de guardar')
      return
    }
    if (!form.getFieldValue('bankAccountId')) {
      message.error('Selecciona una cuenta bancaria para registrar el efectivo recibido')
      return
    }

    setSaving(true)
    try {
      const vals           = form.getFieldsValue()
      const paymentDate    = (vals.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD')
      const accountingDate = vals.accountingDate ? (vals.accountingDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined
      const baseDto = {
        customerId:    selectedCust!,
        paymentDate, accountingDate,
        mode:          vals.mode as PaymentMode,
        reference:     vals.reference || undefined,
        bankAccountId: vals.bankAccountId || undefined,
        notes:         vals.notes || undefined,
        currency:      'GTQ',
        ...(isrEnabled && isrAmount > 0 ? { isrRetentionAmount: isrAmount } : {}),
      }

      const results = []
      for (const inv of invoicesToPay) {
        const pago = await createPagoRecibido({ ...baseDto, invoiceId: inv.id, amount: allocations[inv.id] })
        results.push(pago)
      }

      // Si hay excedente y el usuario optó por registrarlo como anticipo
      let advanceNumber: string | undefined
      if (autoAnticipo && difference > 0.009 && baseDto.bankAccountId) {
        try {
          const adv = await createPagoRecibido({ ...baseDto, amount: difference, isAdvance: true })
          advanceNumber = (adv as any).advanceNumber ?? (adv as any).paymentNumber
        } catch (advErr: any) {
          message.warning(`Pagos registrados, pero no se pudo crear el anticipo por el excedente: ${advErr?.response?.data?.message ?? 'Error'}`)
        }
      }

      if (advanceNumber) {
        message.success(`Pago registrado. Excedente de ${fmtQ(difference)} registrado como anticipo ${advanceNumber}`)
      } else if (results.length === 1) {
        message.success(`Pago ${results[0].paymentNumber} registrado correctamente`)
      } else {
        message.success(`${results.length} pagos registrados correctamente`)
      }

      if (results.length === 1 && !advanceNumber) {
        navigate(`/ventas/pagos-recibidos/${results[0].id}`)
      } else {
        navigate('/ventas/pagos-recibidos')
      }
    } catch (e: any) {
      const raw = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al registrar pago'
      message.error(Array.isArray(raw) ? raw.join(' | ') : raw, 8)
    } finally { setSaving(false) }
  }

  // ── Invoice table columns ─────────────────────────────────────────────────
  const paymentDate = form.getFieldValue('paymentDate') as dayjs.Dayjs | undefined

  const invColumns = [
    {
      title: 'FECHA',
      dataIndex: 'invoiceDate',
      width: 110,
      render: (v: string, r: Invoice) => (
        <div>
          <div style={{ fontSize: 12 }}>{dayjs(v).format('DD MMM YYYY')}</div>
          {r.dueDate && (
            <div style={{ fontSize: 10, color: '#9ca3af' }}>
              Fecha de vencimiento: {dayjs(r.dueDate).format('DD MMM YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'NÚMERO DE FACTURA',
      dataIndex: 'invoiceNumber',
      width: 150,
      render: (v: string, r: Invoice) => (
        <div>
          <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: '#1faec2' }}>{v}</Text>
          {r.status === 'overdue' && (
            <Tag color="error" style={{ fontSize: 10, marginLeft: 4 }}>Vencida</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'IMPORTE DE LA FACTURA',
      dataIndex: 'total',
      width: 150,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'IMPORTE ADEUDADO',
      dataIndex: 'balance',
      width: 140,
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: Number(v) > 0 ? '#fa541c' : '#2ea172' }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'PAGO RECIBIDO EL',
      width: 140,
      align: 'center' as const,
      render: () => (
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {paymentDate ? paymentDate.format('DD MMM YYYY') : '—'}
        </Text>
      ),
    },
    {
      title: 'PAGO',
      width: 160,
      align: 'right' as const,
      render: (_: any, r: Invoice) => {
        const val = allocations[r.id] ?? 0
        return (
          <div style={{ textAlign: 'right' }}>
            <InputNumber
              value={val || undefined}
              min={0}
              max={Number(r.balance)}
              precision={2}
              prefix="Q"
              size="small"
              style={{ width: 130 }}
              placeholder="0.00"
              onChange={v => {
                const newVal = r2(Math.min(v ?? 0, Number(r.balance)))
                setAllocations(prev => ({ ...prev, [r.id]: newVal }))
              }}
            />
            <div style={{ marginTop: 2 }}>
              <Button
                type="link"
                size="small"
                style={{ fontSize: 11, padding: 0, color: '#1faec2' }}
                onClick={() => setAllocations(prev => ({ ...prev, [r.id]: r2(Number(r.balance)) }))}
              >
                Pagar el total
              </Button>
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: 'Ventas' },
          { title: <a onClick={() => navigate('/ventas/pagos-recibidos')}>Pagos recibidos</a> },
          { title: 'Nuevo pago' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Registrar Pago Recibido</Title>
            <Text type="secondary">
              {isAdvance ? 'Anticipo de cliente — sin factura asociada' : 'El importe se distribuye automáticamente en las facturas más antiguas'}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/pagos-recibidos')}>
            Volver
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} style={{ background: '#1faec2' }}>
            Registrar pago
          </Button>
        </Space>
      </div>

      {/* Form card */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ paymentDate: dayjs(), accountingDate: dayjs(), currency: 'GTQ' }}>

          {/* Tipo de pago */}
          <Form.Item label="Tipo de pago" style={{ marginBottom: 16 }}>
            <Radio.Group
              value={isAdvance ? 'advance' : 'invoice'}
              onChange={e => {
                const adv = e.target.value === 'advance'
                setIsAdvance(adv)
                setIsrEnabled(false); setIsrAmount(0)
                setAllocations({})
                form.setFieldsValue({ amount: undefined })
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="invoice">Pago a factura(s)</Radio.Button>
              <Radio.Button value="advance">Anticipo (sin factura)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16}>
            {/* Cliente */}
            <Col xs={24} md={8}>
              <Form.Item name="customerId" label="Cliente" rules={[{ required: true, message: 'Selecciona el cliente' }]}>
                <Select
                  showSearch
                  placeholder="Buscar cliente por nombre o NIT..."
                  loading={loadingCust}
                  filterOption={false}
                  onSearch={(val) => {
                    clearTimeout(debounceRef.current)
                    debounceRef.current = setTimeout(() => fetchCustomers(val), 300)
                  }}
                  onChange={(val) => {
                    setSelectedCust(val)
                    setAllocations({})
                    setTotalAmount(null)
                    form.setFieldsValue({ amount: undefined })
                  }}
                  notFoundContent={loadingCust ? <Spin size="small" /> : 'Sin resultados'}
                  options={customers.map(c => ({ value: c.id, label: c.legalName ?? c.name }))}
                  optionRender={(opt) => {
                    const c = customers.find(x => x.id === opt.value)
                    const displayName = c?.legalName ?? c?.name ?? ''
                    const commercial  = c?.name !== displayName ? c?.name : undefined
                    return (
                      <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
                        {(commercial || c?.taxId) && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {commercial}{commercial && c?.taxId ? ' — ' : ''}{c?.taxId}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
              </Form.Item>
            </Col>

            {/* Fecha de pago */}
            <Col xs={12} md={4}>
              <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true, message: 'Selecciona la fecha' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={() => form.validateFields(['paymentDate'])} />
              </Form.Item>
            </Col>

            {/* Fecha de contabilización */}
            <Col xs={12} md={4}>
              <Form.Item name="accountingDate" label="Fecha contabiliz." tooltip="Período contable en el que se registra la póliza.">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            {/* Importe recibido */}
            <Col xs={24} md={8}>
              <Form.Item
                name={isAdvance ? 'amount' : undefined}
                label={isAdvance ? 'Monto del anticipo' : 'Importe recibido'}
                rules={isAdvance ? [
                  { required: true, message: 'Ingresa el monto' },
                  { validator: (_, v) => v > 0 ? Promise.resolve() : Promise.reject('Debe ser mayor a 0') },
                ] : []}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  <InputNumber
                    value={isAdvance ? undefined : totalAmount ?? undefined}
                    style={{ flex: 1 }}
                    prefix="Q"
                    precision={2}
                    min={0}
                    placeholder="0.00"
                    onChange={v => {
                      if (isAdvance) {
                        form.setFieldValue('amount', v)
                      } else {
                        setTotalAmount(v)
                        if (v && v > 0) autoDistribute(v)
                        else clearAllocations()
                      }
                    }}
                  />
                  {!isAdvance && (
                    <Button
                      icon={<ThunderboltOutlined />}
                      title="Distribuir automáticamente en facturas más antiguas"
                      onClick={() => { if (totalAmount && totalAmount > 0) autoDistribute(totalAmount) }}
                      disabled={!totalAmount || totalAmount <= 0 || openInvoices.length === 0}
                    />
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* Forma de pago */}
            <Col xs={12} md={6}>
              <Form.Item name="mode" label="Forma de pago">
                <Select placeholder="Seleccionar...">
                  {(Object.entries(PAYMENT_MODE_LABELS) as [PaymentMode, string][]).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Cuenta bancaria */}
            <Col xs={12} md={6}>
              <Form.Item name="bankAccountId" label="Cuenta bancaria destino">
                <Select allowClear placeholder="Seleccionar cuenta">
                  {bankAccounts.map((ba: any) => (
                    <Option key={ba.id} value={ba.id}>
                      {ba.name}{ba.bankName ? ` — ${ba.bankName}` : ''}{ba.accountNumber ? ` (${ba.accountNumber})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Referencia */}
            <Col xs={12} md={6}>
              <Form.Item name="reference" label="N.º de referencia">
                <Input placeholder="N° cheque, transferencia..." />
              </Form.Item>
            </Col>

            {/* Notas */}
            <Col xs={12} md={6}>
              <Form.Item name="notes" label="Notas internas">
                <Input placeholder="Observaciones..." />
              </Form.Item>
            </Col>
          </Row>

          {/* ISR (solo en pago a facturas) */}
          {!isAdvance && (
            <Form.Item label="¿Se han deducido los impuestos?" style={{ marginBottom: 0 }}>
              <Radio.Group value={isrEnabled ? 'si' : 'no'} onChange={e => {
                const on = e.target.value === 'si'
                setIsrEnabled(on); setIsrAmount(0)
              }}>
                <Radio value="no">No se han retenido impuestos</Radio>
                <Radio value="si">Sí, retención fiscal en origen</Radio>
              </Radio.Group>
              {isrEnabled && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 12 }}>ISR retenido:</Text>
                  <InputNumber
                    style={{ width: 140 }} prefix="Q" min={0.01} step={0.01} precision={2}
                    value={isrAmount || undefined} placeholder="0.00"
                    onChange={v => setIsrAmount(v ?? 0)}
                  />
                </div>
              )}
            </Form.Item>
          )}
        </Form>
      </Card>

      {/* Invoice distribution table (solo en pago a facturas) */}
      {!isAdvance && (
        <Card
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Facturas no pagadas</Text>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearAllocations}
                disabled={openInvoices.length === 0}
              >
                Borrar importe aplicado
              </Button>
            </div>
          }
        >
          {!selectedCust ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb' }}>
              <InfoCircleOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
              <Text type="secondary">Selecciona un cliente para ver sus facturas pendientes</Text>
            </div>
          ) : loadingInv ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          ) : openInvoices.length === 0 ? (
            <Alert type="success" showIcon message="Este cliente no tiene facturas con saldo pendiente." />
          ) : (
            <>
              <Table
                dataSource={openInvoices}
                columns={invColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'Sin facturas pendientes' }}
              />

              {/* Totales */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 320, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 14px', background: '#fafbfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <Text style={{ fontSize: 12 }}>Importe recibido</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(totalReceived)}</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 14px', background: '#fafbfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <Text style={{ fontSize: 12 }}>Total aplicado a facturas</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2', fontWeight: 600 }}>{fmtQ(totalApplied)}</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 14px', background: difference < -0.009 ? '#fff5f5' : difference > 0.009 ? '#fffbeb' : '#f0fdf4' }}>
                    <Text style={{ fontSize: 13, fontWeight: 700 }}>Diferencia</Text>
                    <Text style={{
                      fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700,
                      color: Math.abs(difference) < 0.01 ? '#2ea172' : difference > 0 ? '#d97706' : '#dc2626',
                    }}>
                      {fmtQ(Math.abs(difference))} {difference > 0.009 ? '(excedente)' : difference < -0.009 ? '(excede importe)' : '✓'}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Opción anticipo automático cuando hay excedente */}
              {difference > 0.009 && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <Checkbox
                    checked={autoAnticipo}
                    onChange={e => setAutoAnticipo(e.target.checked)}
                  >
                    <Text style={{ fontSize: 13 }}>
                      Registrar excedente de <strong>{fmtQ(difference)}</strong> como anticipo (ANT) con la misma cuenta bancaria
                    </Text>
                  </Checkbox>
                  {autoAnticipo && !form.getFieldValue('bankAccountId') && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#d97706' }}>
                      ⚠ Selecciona una cuenta bancaria para que el anticipo se vincule correctamente al banco
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Anticipo info card */}
      {isAdvance && (
        <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <Alert
            type="info"
            showIcon
            message="Anticipo de cliente"
            description="Este pago se registrará como anticipo sin factura asociada. Podrá aplicarse a una factura futura desde el módulo de Anticipos."
          />
        </Card>
      )}
    </div>
  )
}
