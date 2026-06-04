import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Badge, Button, Card, Col, Divider, Form, Input, Modal,
  Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag,
  Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined,
  DollarOutlined, FileTextOutlined, LockOutlined, StarOutlined,
  SyncOutlined, TeamOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBillingState, createHostedCheckout, changePlan, cancelSubscription, getGtqExchangeRate,
  requestBillingInvoice, deletePayment,
  type BillingState, type PlanConfig, type SubscriptionPayment,
  type BillingCurrency, type BillingFelResult, type PaymentResponse,
} from '../../api/billing'

const { Title, Text } = Typography

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number, cur = 'USD') =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n)

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activa',         color: 'success' },
  trialing:  { label: 'Período trial',  color: 'processing' },
  past_due:  { label: 'Pago vencido',   color: 'error' },
  cancelled: { label: 'Cancelada',      color: 'default' },
}

const RESULT_COLOR: Record<string, string> = {
  approved: 'success',
  declined: 'error',
  pending:  'processing',
  error:    'warning',
}

function billingErrorMsg(e: any, fallback = 'Error inesperado'): string {
  const data = e?.response?.data
  const raw = data?.message ?? data?.error?.message ?? e?.message
  if (Array.isArray(raw)) return raw.join(' · ')
  return (typeof raw === 'string' && raw) ? raw : fallback
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan, current, currency, exchangeRate, onSelect,
}: {
  plan: PlanConfig
  current?: string
  currency: BillingCurrency
  exchangeRate: number
  onSelect: (plan: PlanConfig) => void
}) {
  const isActive = current === plan.plan
  const priceUSD = Number(plan.priceMonthly)
  const displayPrice = currency === 'GTQ' ? priceUSD * exchangeRate : priceUSD
  const isFree = priceUSD === 0

  const borderColor = isActive ? '#1B3A6B' : '#e8e8e8'

  return (
    <Card
      style={{
        borderRadius: 10, border: `2px solid ${borderColor}`,
        boxShadow: isActive ? '0 2px 12px rgba(27,58,107,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
        position: 'relative', height: '100%',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', top: -1, right: 16,
          background: '#1B3A6B', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 10px',
          borderRadius: '0 0 6px 6px', letterSpacing: '.05em',
        }}>
          PLAN ACTUAL
        </div>
      )}

      <div style={{ textAlign: 'center', paddingBottom: 16 }}>
        <Tag color={plan.plan === 'enterprise' ? 'gold' : plan.plan === 'professional' ? 'blue' : 'default'}
          style={{ fontSize: 11, marginBottom: 8 }}
        >
          {plan.plan.toUpperCase()}
        </Tag>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1B3A6B', lineHeight: 1 }}>
          {isFree ? 'Gratis' : money(displayPrice, currency)}
        </div>
        {!isFree && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            / mes en {currency}
            {currency === 'GTQ' && (
              <span style={{ marginLeft: 4, color: '#6b7280' }}>
                (≈ {money(priceUSD, 'USD')})
              </span>
            )}
          </Text>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined style={{ color: '#1B3A6B' }} />
          <Text style={{ fontSize: 13 }}>
            {plan.maxCompanies >= 999 ? 'Empresas ilimitadas' : `${plan.maxCompanies} empresa${plan.maxCompanies > 1 ? 's' : ''}`}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined style={{ color: '#1B3A6B' }} />
          <Text style={{ fontSize: 13 }}>
            {plan.maxUsers >= 999 ? 'Usuarios ilimitados' : `${plan.maxUsers} usuarios`}
          </Text>
        </div>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{f}</Text>
          </div>
        ))}
      </Space>

      <Button
        type={isActive ? 'default' : 'primary'}
        block
        disabled={isActive}
        onClick={() => onSelect(plan)}
        style={isActive ? {} : { background: '#1B3A6B', borderColor: '#1B3A6B' }}
      >
        {isActive ? 'Plan actual' : isFree ? 'Usar gratis' : 'Seleccionar'}
      </Button>
    </Card>
  )
}

// ── CardForm ──────────────────────────────────────────────────────────────────

function CardForm({
  plan, currency, exchangeRate, onSuccess, onCancel,
}: {
  plan: PlanConfig
  currency: BillingCurrency
  exchangeRate: number
  onSuccess: (result: PaymentResponse) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)

  const priceUSD = Number(plan.priceMonthly)
  const displayPrice = currency === 'GTQ' ? priceUSD * exchangeRate : priceUSD

  const handleCheckout = async () => {
    setSaving(true)
    try {
      const result = await createHostedCheckout({ plan: plan.plan, currency })
      if (!result.checkoutUrl) throw new Error('QPayPro no devolvio URL de checkout')
      message.success('Redirigiendo al checkout seguro de QPayPro')
      onSuccess(result)
      window.location.assign(result.checkoutUrl)
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'No se pudo crear la sesion de pago QPayPro'), 6)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{
        background: '#f0f5ff', borderRadius: 8, padding: '12px 16px',
        marginBottom: 20, border: '1px solid #d6e4ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ color: '#1B3A6B' }}>Plan {plan.displayName}</Text>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1B3A6B' }}>
              {money(displayPrice, currency)} <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>/ mes</Text>
            </div>
          </div>
          <LockOutlined style={{ fontSize: 28, color: '#1B3A6B', opacity: 0.4 }} />
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          El pago se realiza en el checkout alojado de QPayPro. En esta etapa se usa el ambiente Sandbox.
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        style={{ fontSize: 12, marginBottom: 16 }}
        message="Checkout Sandbox QPayPro"
        description="Al continuar, se generara un token de pago y se abrira la pagina segura de QPayPro para completar la prueba."
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <Button block onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="primary" block loading={saving} onClick={handleCheckout}
          style={{ background: '#1B3A6B', flex: 2 }}
          icon={<LockOutlined />}
        >
          Ir a QPayPro Sandbox
        </Button>
      </div>
    </div>
  )
}
// ── PaymentHistory ────────────────────────────────────────────────────────────

function PaymentHistory({ payments, onDelete }: { payments: SubscriptionPayment[]; onDelete: (id: string) => void }) {
  const cols: ColumnsType<SubscriptionPayment> = [
    {
      title: 'Fecha',
      dataIndex: 'chargedAt',
      width: 150,
      render: v => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      render: v => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Monto',
      align: 'right',
      render: (_, r) => (
        <Text strong>{money(Number(r.amount), r.currency)}</Text>
      ),
    },
    {
      title: 'Tarjeta',
      render: (_, r) => r.cardLast4 ? (
        <Space>
          <CreditCardOutlined />
          <Text>{r.cardBrand} ••••{r.cardLast4}</Text>
        </Space>
      ) : '—',
    },
    {
      title: 'Estado',
      dataIndex: 'result',
      render: v => (
        <Badge status={RESULT_COLOR[v] as any}
          text={v === 'approved' ? 'Aprobado' : v === 'declined' ? 'Rechazado' : v === 'pending' ? 'Pendiente' : 'Error'}
        />
      ),
    },
    {
      title: 'Ref.',
      dataIndex: 'qpayproTransactionId',
      render: v => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: '',
      width: 48,
      render: (_, r) => (
        <Popconfirm
          title="¿Eliminar este registro?"
          description="Se eliminará del historial. No afecta cobros reales."
          onConfirm={() => onDelete(r.id)}
          okText="Eliminar" cancelText="Cancelar"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger type="text" icon={<span style={{ fontSize: 13 }}>🗑</span>} />
        </Popconfirm>
      ),
    },
  ]

  if (!payments.length) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#8c8c8c' }}>
        <DollarOutlined style={{ fontSize: 32, marginBottom: 8 }} />
        <div>Sin historial de cobros</div>
      </div>
    )
  }

  return (
    <Table
      dataSource={payments}
      rowKey="id"
      columns={cols}
      size="small"
      pagination={{ pageSize: 8, size: 'small' }}
      scroll={{ x: 700 }}
    />
  )
}

// ── BillingFelModal ───────────────────────────────────────────────────────────

function BillingFelModal({
  open, paymentId, currency, amount, planName, onClose,
}: {
  open:       boolean
  paymentId:  string
  currency:   BillingCurrency
  amount:     number
  planName:   string
  onClose:    () => void
}) {
  const [form]       = Form.useForm()
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<BillingFelResult | null>(null)
  const isCF = Form.useWatch('customerTaxId', form)?.toUpperCase() === 'CF'

  // Reset al abrir
  const handleOpen = () => { form.resetFields(); setResult(null) }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const res = await requestBillingInvoice({
        subscriptionPaymentId: paymentId,
        customerTaxId:  values.customerTaxId.trim().toUpperCase(),
        customerName:   values.customerName.trim().toUpperCase(),
        customerEmail:  values.customerEmail || undefined,
        customerAddress:values.customerAddress || undefined,
        currency,
      })
      setResult(res)
      if (res.success) {
        message.success('¡Factura electrónica emitida ante SAT!')
      } else {
        message.error(res.message)
      }
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'Error al emitir la factura electrónica'), 6)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      afterOpenChange={o => { if (o) handleOpen() }}
      title={
        <Space>
          <FileTextOutlined style={{ color: '#1B3A6B' }} />
          <span style={{ color: '#1B3A6B', fontWeight: 600 }}>
            Factura Electrónica — SAT Guatemala
          </span>
        </Space>
      }
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {/* Resumen del pago */}
      <div style={{
        background: '#f0f5ff', borderRadius: 8, padding: '12px 16px',
        marginBottom: 20, border: '1px solid #d6e4ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Pago por suscripción</Text>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1B3A6B' }}>
              {money(amount, currency)} — Plan {planName}
            </div>
          </div>
          <Tag color="success" icon={<CheckCircleOutlined />}>Aprobado</Tag>
        </div>
      </div>

      {/* Resultado exitoso */}
      {result?.success ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', marginBottom: 8 }}>
            Factura emitida correctamente
          </div>
          {result.simulated && (
            <Alert type="warning" showIcon style={{ marginBottom: 12, textAlign: 'left' }}
              message="Modo simulado — configura PLATFORM_FEL_ENTITY_ID y PLATFORM_FEL_API_KEY para FEL real"
            />
          )}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', textAlign: 'left', marginBottom: 16 }}>
            {result.felUuid && (
              <div style={{ marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>UUID SAT</Text>
                <div><Text code style={{ fontSize: 11 }}>{result.felUuid}</Text></div>
              </div>
            )}
            {result.felSerie && result.felNumero && (
              <div style={{ marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Serie / Número</Text>
                <div><Tag>{result.felSerie}</Tag><Tag>{result.felNumero}</Tag></div>
              </div>
            )}
            {result.felInvoiceUrl && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Verificación SAT</Text>
                <div>
                  <a href={result.felInvoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    Ver factura en SAT →
                  </a>
                </div>
              </div>
            )}
          </div>
          <Button type="primary" onClick={onClose} style={{ background: '#1B3A6B' }}>
            Cerrar
          </Button>
        </div>
      ) : (
        /* Formulario de datos del receptor */
        <Form form={form} layout="vertical" size="middle">
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Ingresa los datos para la emisión de tu factura electrónica (FACT) ante SAT Guatemala.
              Puedes usar <Text code>CF</Text> si no necesitas factura con NIT.
            </Text>
          </div>

          <Form.Item
            name="customerTaxId"
            label="NIT del receptor"
            initialValue="CF"
            rules={[{ required: true, message: 'Ingresa el NIT o CF' }]}
          >
            <Input
              placeholder="12345678-9 o CF"
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
              suffix={
                <Tooltip title="Escribe CF para Consumidor Final sin NIT">
                  <span style={{ color: '#8c8c8c', fontSize: 11, cursor: 'help' }}>?</span>
                </Tooltip>
              }
              onChange={e => {
                const v = e.target.value.toUpperCase()
                form.setFieldValue('customerTaxId', v)
                if (v === 'CF') form.setFieldValue('customerName', 'CONSUMIDOR FINAL')
              }}
            />
          </Form.Item>

          <Form.Item
            name="customerName"
            label="Nombre / Razón social del receptor"
            initialValue="CONSUMIDOR FINAL"
            rules={[{ required: true, message: 'Ingresa el nombre del receptor' }]}
          >
            <Input
              placeholder="MI EMPRESA S.A."
              style={{ textTransform: 'uppercase' }}
              disabled={isCF}
            />
          </Form.Item>

          <Form.Item name="customerEmail" label="Correo electrónico (para envío del PDF)">
            <Input
              type="email"
              placeholder="facturacion@miempresa.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item name="customerAddress" label="Dirección del receptor (opcional)">
            <Input placeholder="5a Avenida 4-50 Zona 1, Guatemala" />
          </Form.Item>

          {result?.success === false && (
            <Alert type="error" showIcon style={{ marginBottom: 12 }}
              message="Error al emitir" description={result.message}
            />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button block onClick={onClose}>Omitir por ahora</Button>
            <Button type="primary" block loading={loading} onClick={handleSubmit}
              icon={<FileTextOutlined />}
              style={{ background: '#1B3A6B', flex: 2 }}
            >
              Emitir factura FEL
            </Button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              La factura electrónica es emitida por GLL Consulting (GMARK S.A.) ante SAT Guatemala
            </Text>
          </div>
        </Form>
      )}
    </Modal>
  )
}

// ── SubscriptionPage ──────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [state, setState]           = useState<BillingState | null>(null)
  const [loading, setLoading]       = useState(true)
  const [currency, setCurrency]     = useState<BillingCurrency>('USD')
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [rateInfo, setRateInfo]     = useState<{ rate: number; updatedAt?: string; updatedBy?: string }>({ rate: 7.7 })

  // Modal FEL post-pago
  const [felOpen,       setFelOpen]       = useState(false)
  const [felPaymentId,  setFelPaymentId]  = useState<string>('')
  const [felPlanName,   setFelPlanName]   = useState<string>('')
  const [felAmount,     setFelAmount]     = useState<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, rateData] = await Promise.all([
        getBillingState(),
        getGtqExchangeRate().catch(() => ({ rate: 7.7 })),
      ])
      setState(data)
      setRateInfo(rateData)
      if (data.subscription?.billingCurrency) setCurrency(data.subscription.billingCurrency)
    } catch {
      message.error('No se pudo cargar la información de suscripción')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const exchangeRate = rateInfo.rate
  const sub = state?.subscription
  const statusMeta = STATUS_LABEL[sub?.status ?? 'trialing']

  const handleSelectPlan = (plan: PlanConfig) => {
    if (!sub?.qpayproCardToken && Number(plan.priceMonthly) > 0) {
      // Sin tarjeta registrada → abrir formulario completo
      setSelectedPlan(plan)
      setModalOpen(true)
    } else if (sub?.qpayproCardToken && plan.plan !== sub.plan) {
      // Con tarjeta ya registrada → cambiar plan directamente
      setSelectedPlan(plan)
      setModalOpen(true)
    }
  }

  const openFelModal = (result: PaymentResponse, planName: string) => {
    if (!result.paymentId || !result.amountCharged) return
    setFelPaymentId(result.paymentId)
    setFelPlanName(planName)
    setFelAmount(result.amountCharged)
    setFelOpen(true)
  }

  const handleChangePlanConfirm = async () => {
    if (!selectedPlan) return
    setChangingPlan(true)
    try {
      const result = await changePlan(selectedPlan.plan, currency)
      message.success(result.message)
      setModalOpen(false)
      await load()
      if (Number(selectedPlan.priceMonthly) > 0) openFelModal(result, selectedPlan.displayName)
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'Error al cambiar de plan'), 6)
    } finally {
      setChangingPlan(false)
    }
  }

  const handleCancel = async () => {
    try {
      const result = await cancelSubscription()
      message.success(result.message)
      await load()
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'Error al cancelar'), 6)
    }
  }

  const handleDeletePayment = async (id: string) => {
    try {
      await deletePayment(id)
      message.success('Registro eliminado')
      await load()
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'Error al eliminar'), 4)
    }
  }

  const hasCard = !!sub?.qpayproCardToken
  const isNewSubscription = !hasCard || !sub

  if (loading && !state) {
    return <Spin spinning style={{ display: 'block', margin: '80px auto' }} />
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Suscripción y Facturación</Title>
        <Text type="secondary">Gestiona tu plan, tarjeta de pago e historial de cobros</Text>
      </div>

      {/* Estado actual */}
      {sub && (
        <Card style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 20 }}
          bodyStyle={{ padding: '16px 24px' }}
        >
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={6}>
              <Statistic
                title={<Text style={{ fontSize: 12, color: '#5f6b7a' }}>Plan activo</Text>}
                value={sub.plan.toUpperCase()}
                prefix={<StarOutlined style={{ color: '#1B3A6B' }} />}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#1B3A6B' }}
              />
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado</Text>
              <Badge status={statusMeta?.color as any} text={
                <Text strong style={{ fontSize: 14 }}>{statusMeta?.label}</Text>
              } />
            </Col>
            <Col xs={24} md={5}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Próximo cobro</Text>
              <Text strong style={{ fontSize: 14 }}>
                {sub.nextChargeAt
                  ? dayjs(sub.nextChargeAt).format('DD/MM/YYYY')
                  : sub.status === 'trialing' && state?.tenant.trialEndsAt
                    ? `Trial hasta ${dayjs(state.tenant.trialEndsAt).format('DD/MM/YYYY')}`
                    : '—'}
              </Text>
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Auto-renovación</Text>
              {sub.status === 'active' && hasCard ? (
                <Space size={4}>
                  <SyncOutlined style={{ color: '#16a34a', fontSize: 13 }} />
                  <Text strong style={{ fontSize: 13, color: '#16a34a' }}>Activa</Text>
                </Space>
              ) : sub.status === 'cancelled' ? (
                <Text type="secondary" style={{ fontSize: 13 }}>Cancelada</Text>
              ) : (
                <Text style={{ fontSize: 13, color: '#d97706' }}>Sin tarjeta</Text>
              )}
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Tarjeta registrada</Text>
              {hasCard ? (
                <Space>
                  <CreditCardOutlined style={{ color: '#16a34a' }} />
                  <Text strong style={{ fontSize: 13 }}>
                    {sub.qpayproCardBrand} ••••{sub.qpayproCardLast4}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>Sin tarjeta</Text>
              )}
            </Col>
            <Col xs={24} md={3} style={{ textAlign: 'right' }}>
              {sub.status === 'active' && (
                <Popconfirm
                  title="¿Cancelar suscripción?"
                  description="Mantendrás acceso hasta el fin del período pagado."
                  onConfirm={handleCancel}
                  okText="Sí, cancelar" cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger>Cancelar suscripción</Button>
                </Popconfirm>
              )}
            </Col>
          </Row>
        </Card>
      )}

      {/* Selector de moneda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ color: '#1B3A6B' }}>Planes disponibles</Text>
        <Space>
          <Text type="secondary" style={{ fontSize: 13 }}>Ver precios en:</Text>
          <Select
            value={currency}
            onChange={v => setCurrency(v)}
            size="small"
            style={{ width: 100 }}
            options={[
              { value: 'USD', label: 'USD ($)' },
              { value: 'GTQ', label: 'GTQ (Q)' },
            ]}
          />
          {currency === 'GTQ' && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              T/C: Q {exchangeRate.toFixed(4)} / USD
              {rateInfo.updatedBy && (
                <span style={{ marginLeft: 4, opacity: 0.75 }}>
                  · por {rateInfo.updatedBy}
                </span>
              )}
            </Tag>
          )}
        </Space>
      </div>

      {/* Planes */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        {(state?.plans ?? []).map(plan => (
          <Col xs={24} md={8} key={plan.plan}>
            <PlanCard
              plan={plan}
              current={sub?.plan}
              currency={currency}
              exchangeRate={exchangeRate}
              onSelect={handleSelectPlan}
            />
          </Col>
        ))}
      </Row>

      {/* Historial */}
      <Card
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#1B3A6B' }} />
            <span style={{ color: '#1B3A6B', fontWeight: 600 }}>Historial de cobros</span>
          </Space>
        }
        extra={<Button size="small" icon={<SyncOutlined />} onClick={load} loading={loading}>Actualizar</Button>}
      >
        <Spin spinning={loading}>
          <PaymentHistory payments={state?.paymentHistory ?? []} onDelete={handleDeletePayment} />
        </Spin>
      </Card>

      {/* Modal — Formulario de tarjeta o confirmación de cambio */}
      <Modal
        open={modalOpen}
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#1B3A6B' }} />
            <span style={{ color: '#1B3A6B' }}>
              {isNewSubscription || !hasCard ? 'Activar suscripción' : `Cambiar a plan ${selectedPlan?.displayName}`}
            </span>
          </Space>
        }
        onCancel={() => { setModalOpen(false); setSelectedPlan(null) }}
        footer={null}
        destroyOnClose
        width={500}
      >
        {selectedPlan && (isNewSubscription || !hasCard) ? (
          <CardForm
            plan={selectedPlan}
            currency={currency}
            exchangeRate={exchangeRate}
            onSuccess={async (result) => {
              setModalOpen(false)
              await load()
              if (Number(selectedPlan.priceMonthly) > 0) openFelModal(result, selectedPlan.displayName)
            }}
            onCancel={() => { setModalOpen(false); setSelectedPlan(null) }}
          />
        ) : selectedPlan && hasCard ? (
          <div>
            <Alert
              type="info" showIcon
              style={{ marginBottom: 16 }}
              message={`Se realizará un cobro de ${money(
                currency === 'GTQ'
                  ? Number(selectedPlan.priceMonthly) * exchangeRate
                  : Number(selectedPlan.priceMonthly),
                currency
              )} con tu tarjeta ${sub?.qpayproCardBrand} ••••${sub?.qpayproCardLast4}`}
            />
            {Number(selectedPlan.priceMonthly) === 0 && (
              <Alert type="success" showIcon message="Plan gratuito — no se realizará ningún cobro." style={{ marginBottom: 16 }} />
            )}
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="primary" loading={changingPlan} onClick={handleChangePlanConfirm}
                style={{ background: '#1B3A6B' }}
                icon={<CheckCircleOutlined />}
              >
                Confirmar cambio
              </Button>
            </Space>
          </div>
        ) : null}
      </Modal>

      {/* Aviso de seguridad */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Space>
          <LockOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pagos seguros procesados por <strong>QPay Pro</strong> · Visa · Mastercard · PCI-DSS
          </Text>
          <WarningOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tus datos de tarjeta nunca se almacenan en nuestros servidores
          </Text>
        </Space>
      </div>

      {/* Modal FEL — se abre automáticamente después de cada pago aprobado */}
      {felPaymentId && (
        <BillingFelModal
          open={felOpen}
          paymentId={felPaymentId}
          currency={currency}
          amount={felAmount}
          planName={felPlanName}
          onClose={() => setFelOpen(false)}
        />
      )}
    </div>
  )
}
