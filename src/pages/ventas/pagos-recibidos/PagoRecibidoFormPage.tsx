import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Select, DatePicker, InputNumber, Input, Button, Typography,
  Space, Breadcrumb, message, Divider, Alert, Tag, Row, Col, Spin, Radio,
} from 'antd'
import { DollarOutlined, SaveOutlined, ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { createPagoRecibido, type PaymentMode, PAYMENT_MODE_LABELS } from '../../../api/pagos-recibidos'
import { getInvoices, type Invoice } from '../../../api/facturas'
import { getCustomers } from '../../../api/contactos'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'

const { Title, Text } = Typography
const { Option } = Select

const fmtQ = (n: number | undefined) =>
  n !== undefined ? `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—'

interface Customer { id: string; name: string; taxId?: string }

export default function PagoRecibidoFormPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [saving,         setSaving]         = useState(false)
  const [isAdvance,      setIsAdvance]      = useState(false)
  const [customers,      setCustomers]      = useState<Customer[]>([])
  const [loadingCust,    setLoadingCust]    = useState(false)
  const [selectedCust,   setSelectedCust]   = useState<string | null>(null)
  const [openInvoices,   setOpenInvoices]   = useState<Invoice[]>([])
  const [loadingInv,     setLoadingInv]     = useState(false)
  const [selectedInv,    setSelectedInv]    = useState<Invoice | null>(null)
  const [bankAccounts,   setBankAccounts]   = useState<BankAccount[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load customers — limit: 100 (máximo permitido por @Max(100) en PaginationDto)
  const fetchCustomers = (search: string) => {
    setLoadingCust(true)
    getCustomers({ limit: 100, search: search || undefined })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map(c => ({ id: c.id, name: c.name, taxId: c.taxId })))
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCust(false))
  }

  useEffect(() => { fetchCustomers('') }, [])

  // Load bank accounts
  useEffect(() => {
    getBankAccounts({ status: 'active' })
      .then((res: any) => {
        const list: BankAccount[] = Array.isArray(res) ? res : (res?.data ?? [])
        setBankAccounts(list)
      })
      .catch(() => setBankAccounts([]))
  }, [])

  // Load open invoices when customer changes
  useEffect(() => {
    if (!selectedCust) { setOpenInvoices([]); setSelectedInv(null); return }
    setLoadingInv(true)
    getInvoices({ customerId: selectedCust, limit: 100 })
      .then(res => {
        const open = (res.data ?? []).filter(inv =>
          ['sent', 'partial', 'overdue'].includes(inv.status) && Number(inv.balance) > 0,
        )
        setOpenInvoices(open)
      })
      .catch(() => setOpenInvoices([]))
      .finally(() => setLoadingInv(false))
  }, [selectedCust])

  const handleInvoiceChange = (id: string) => {
    const inv = openInvoices.find(i => i.id === id) ?? null
    setSelectedInv(inv)
    if (inv) {
      form.setFieldsValue({ amount: Number(inv.balance) })
    }
  }

  const handleSave = async () => {
    try {
      // Validate all fields; skip invoiceId validation when in advance mode
      await form.validateFields(
        isAdvance
          ? ['customerId', 'paymentDate', 'amount']
          : undefined,
      )
    } catch { return }
    setSaving(true)
    try {
      const vals = form.getFieldsValue()
      const paymentDate = (vals.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD')
      const dto = isAdvance
        ? {
            customerId:    selectedCust!,
            paymentDate,
            amount:        vals.amount,
            mode:          vals.mode as PaymentMode,
            reference:     vals.reference || undefined,
            bankAccountId: vals.bankAccountId || undefined,
            notes:         vals.notes || undefined,
            currency:      'GTQ',
            isAdvance:     true as const,
          }
        : {
            customerId:    selectedCust!,
            invoiceId:     vals.invoiceId,
            paymentDate,
            amount:        vals.amount,
            mode:          vals.mode as PaymentMode,
            reference:     vals.reference || undefined,
            bankAccountId: vals.bankAccountId || undefined,
            notes:         vals.notes || undefined,
            currency:      'GTQ',
          }
      const pago = await createPagoRecibido(dto)
      message.success(`Pago ${pago.paymentNumber} registrado correctamente`)
      navigate(`/ventas/pagos-recibidos/${pago.id}`)
    } catch (e: any) {
      // El backend usa HttpExceptionFilter: { success, error: { message } }
      const errData = e?.response?.data
      const raw = errData?.error?.message ?? errData?.message ?? errData?.error
      const msg = Array.isArray(raw) ? raw.join(' | ') : (raw || 'Error al registrar el pago')
      message.error(msg, 8)
      console.error('[PagoRecibido] error:', errData)
    } finally { setSaving(false) }
  }

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
          <DollarOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Registrar Pago Recibido</Title>
            <Text type="secondary">
              {isAdvance
                ? 'Se registrará como anticipo de cliente (sin factura asociada)'
                : 'Aplica el cobro directamente al saldo pendiente de una factura'}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/pagos-recibidos')}>
            Volver
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ background: '#1B3A6B' }}
          >
            Registrar pago
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            title="Datos del pago"
            bordered={false}
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            <Form form={form} layout="vertical" initialValues={{ paymentDate: dayjs(), currency: 'GTQ' }}>

              {/* Tipo de pago */}
              <Form.Item label="Tipo de pago" style={{ marginBottom: 16 }}>
                <Radio.Group
                  value={isAdvance ? 'advance' : 'invoice'}
                  onChange={e => {
                    const adv = e.target.value === 'advance'
                    setIsAdvance(adv)
                    setSelectedInv(null)
                    form.setFieldsValue({ invoiceId: undefined, amount: undefined })
                  }}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="invoice">Pago a factura</Radio.Button>
                  <Radio.Button value="advance">Anticipo (sin factura)</Radio.Button>
                </Radio.Group>
              </Form.Item>

              {/* Cliente */}
              <Form.Item
                name="customerId"
                label="Cliente"
                rules={[{ required: true, message: 'Selecciona el cliente' }]}
              >
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
                    setSelectedInv(null)
                    form.setFieldsValue({ invoiceId: undefined, amount: undefined })
                  }}
                  notFoundContent={loadingCust ? <Spin size="small" /> : 'Sin resultados'}
                  options={customers.map(c => ({
                    value: c.id,
                    label: `${c.name}${c.taxId ? ` — ${c.taxId}` : ''}`,
                  }))}
                />
              </Form.Item>

              {/* Factura (solo en modo pago a factura) */}
              {!isAdvance && (
                <Form.Item
                  name="invoiceId"
                  label="Factura a abonar"
                  rules={[{ required: true, message: 'Selecciona la factura' }]}
                >
                  <Select
                    placeholder={selectedCust ? 'Seleccionar factura...' : 'Primero selecciona un cliente'}
                    disabled={!selectedCust}
                    loading={loadingInv}
                    onChange={handleInvoiceChange}
                    notFoundContent={
                      loadingInv
                        ? <Spin size="small" />
                        : <Text type="secondary" style={{ fontSize: 12 }}>No hay facturas con saldo pendiente</Text>
                    }
                  >
                    {openInvoices.map(inv => (
                      <Option key={inv.id} value={inv.id}>
                        <Space>
                          <Text style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Total: {fmtQ(inv.total)} | Saldo: {fmtQ(inv.balance)}
                          </Text>
                          <Tag color={inv.status === 'overdue' ? 'red' : 'geekblue'} style={{ fontSize: 10 }}>
                            {inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                          </Tag>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              <Row gutter={12}>
                {/* Fecha de pago */}
                <Col span={12}>
                  <Form.Item
                    name="paymentDate"
                    label="Fecha de pago"
                    rules={[{ required: true, message: 'Selecciona la fecha' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>

                {/* Monto */}
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label={isAdvance ? 'Monto del anticipo' : 'Monto a aplicar'}
                    rules={[
                      { required: true, message: 'Ingresa el monto' },
                      {
                        validator: (_, v) =>
                          v > 0 ? Promise.resolve() : Promise.reject('El monto debe ser mayor a 0'),
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      prefix="Q"
                      precision={2}
                      min={0.01}
                      max={!isAdvance && selectedInv ? Number(selectedInv.balance) : undefined}
                      placeholder="0.00"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                {/* Forma de pago */}
                <Col span={12}>
                  <Form.Item name="mode" label="Forma de pago">
                    <Select placeholder="Seleccionar...">
                      {(Object.entries(PAYMENT_MODE_LABELS) as [PaymentMode, string][]).map(([k, v]) => (
                        <Option key={k} value={k}>{v}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                {/* Referencia */}
                <Col span={12}>
                  <Form.Item name="reference" label="Referencia / N° documento">
                    <Input placeholder="N° cheque, transferencia..." />
                  </Form.Item>
                </Col>
              </Row>

              {/* Cuenta bancaria */}
              <Form.Item name="bankAccountId" label="Cuenta bancaria destino">
                <Select allowClear placeholder="Seleccionar cuenta (opcional)">
                  {bankAccounts.map((ba: any) => (
                    <Option key={ba.id} value={ba.id}>
                      {ba.name} {ba.bankName ? `— ${ba.bankName}` : ''} {ba.accountNumber ? `(${ba.accountNumber})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Notas */}
              <Form.Item name="notes" label="Notas internas">
                <Input.TextArea rows={2} placeholder="Observaciones del pago..." />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Panel resumen factura / anticipo */}
        <Col xs={24} lg={10}>
          {isAdvance ? (
            <Card
              title={<Space><InfoCircleOutlined style={{ color: '#1B3A6B' }} /> Anticipo de cliente</Space>}
              bordered={false}
              style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Alert
                  type="info"
                  showIcon
                  message="Este pago se registrará como anticipo de cliente."
                  description="No se asocia a ninguna factura específica. Podrá aplicarse a una factura futura desde el módulo de Anticipos."
                />
                <Divider style={{ margin: '8px 0' }}>Póliza contable generada</Divider>
                {/* Tabla asiento estilo ERP */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', background: '#fafafa', padding: '6px 10px', fontWeight: 600, color: '#595959', borderBottom: '1px solid #f0f0f0' }}>
                    <span>Cuenta</span><span style={{ marginRight: 16 }}>Debe</span><span>Haber</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <Text style={{ fontSize: 12 }}>Banco / Caja</Text>
                    <Text style={{ fontFamily: 'monospace', marginRight: 16, color: '#1677ff' }}>Q monto</Text>
                    <Text style={{ color: '#bbb', fontFamily: 'monospace' }}>—</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '6px 10px' }}>
                    <Text style={{ fontSize: 12 }}>Anticipos de Clientes <Tag style={{ fontSize: 10, fontFamily: 'monospace', marginLeft: 4 }}>2110</Tag></Text>
                    <Text style={{ color: '#bbb', fontFamily: 'monospace', marginRight: 16 }}>—</Text>
                    <Text style={{ fontFamily: 'monospace', color: '#52c41a' }}>Q monto</Text>
                  </div>
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>N° anticipo asignado</Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>ANT-{new Date().getFullYear()}-NNNNN</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>N° pago asignado</Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>PAG-{new Date().getFullYear()}-NNNNN</Text>
                </div>
              </Space>
            </Card>
          ) : (
            <Card
              title="Resumen de factura"
              bordered={false}
              style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
            >
              {selectedInv ? (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">N° Factura</Text>
                    <Text strong style={{ fontFamily: 'monospace' }}>{selectedInv.invoiceNumber}</Text>
                  </div>
                  <Divider style={{ margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Total factura</Text>
                    <Text>{fmtQ(selectedInv.total)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Ya pagado</Text>
                    <Text>{fmtQ(selectedInv.paidAmount)}</Text>
                  </div>
                  <Divider style={{ margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Saldo pendiente</Text>
                    <Text strong style={{ fontSize: 16, color: Number(selectedInv.balance) > 0 ? '#fa541c' : '#52c41a' }}>
                      {fmtQ(selectedInv.balance)}
                    </Text>
                  </div>
                  <Divider style={{ margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Estado</Text>
                    <Tag color={selectedInv.status === 'overdue' ? 'red' : 'geekblue'}>
                      {selectedInv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                    </Tag>
                  </div>
                  {selectedInv.dueDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Vence</Text>
                      <Text>{dayjs(selectedInv.dueDate).format('DD/MM/YYYY')}</Text>
                    </div>
                  )}
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="El pago se aplicará automáticamente al saldo de la factura y se generará la póliza contable Dr Banco / Cr CxC."
                  />
                </Space>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb' }}>
                  <DollarOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                  <Text type="secondary">Selecciona un cliente y una factura para ver el resumen</Text>
                </div>
              )}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
