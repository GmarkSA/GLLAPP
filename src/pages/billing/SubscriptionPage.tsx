import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Badge, Button, Card, Col, Divider, Form, Input, Modal,
  Popconfirm, Progress, Row, Select, Space, Spin, Table, Tag,
  Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined,
  DollarOutlined, FileTextOutlined, LockOutlined,
  SyncOutlined, TeamOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBillingState, changePlan, getGtqExchangeRate,
  requestBillingInvoice, deletePayment,
  tokenizarTarjeta, activarCobros,
  type BillingState, type PlanConfig, type SubscriptionPayment,
  type BillingCurrency, type CardType, type BillingFelResult, type PaymentResponse,
} from '../../api/billing'

const { Title, Text } = Typography

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number, cur = 'USD') =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n)

// Convierte un monto desde la moneda del plan a la moneda de visualización.
// Solo hay tasa GTQ↔USD; para otras (p.ej. EUR) se muestra en la moneda del plan.
function convertPrecio(amount: number, from: string, to: string, gtqPorUsd: number): { value: number; cur: string } {
  if (from === to) return { value: amount, cur: to }
  if (from === 'USD' && to === 'GTQ') return { value: amount * gtqPorUsd, cur: 'GTQ' }
  if (from === 'GTQ' && to === 'USD') return { value: amount / gtqPorUsd, cur: 'USD' }
  return { value: amount, cur: from }
}


const RESULT_COLOR: Record<string, string> = {
  approved: 'success',
  declined: 'error',
  pending:  'processing',
  error:    'warning',
}

function detectCardType(num: string): CardType {
  return num.startsWith('4') ? 'visa' : 'mastercard'
}
function billingErrorMsg(e: any, fallback = 'Error inesperado'): string {
  const data = e?.response?.data
  const raw = data?.message ?? data?.error?.message ?? e?.message
  if (Array.isArray(raw)) return raw.join(' · ')
  return (typeof raw === 'string' && raw) ? raw : fallback
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function formatCardInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
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
  const planCur = plan.currency || 'USD'
  const precioNativo = Number(plan.priceMonthly)
  const { value: displayPrice, cur: displayCur } = convertPrecio(precioNativo, planCur, currency, exchangeRate)
  const isFree = precioNativo === 0

  const borderColor = isActive ? '#1faec2' : 'rgba(10,10,10,0.08)'

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
          background: '#1faec2', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 10px',
          borderRadius: '0 0 6px 6px', letterSpacing: '.05em',
        }}>
          PLAN ACTUAL
        </div>
      )}

      <div style={{ textAlign: 'center', paddingBottom: 16 }}>
        <Tag color={plan.plan === 'enterprise' ? 'gold' : plan.plan === 'professional' ? '#1faec2' : 'default'}
          style={{ fontSize: 11, marginBottom: 8 }}
        >
          {plan.plan.toUpperCase()}
        </Tag>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1faec2', lineHeight: 1 }}>
          {isFree ? 'Gratis' : money(displayPrice, displayCur)}
        </div>
        {!isFree && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            / mes en {displayCur}
            {displayCur !== planCur && (
              <span style={{ marginLeft: 4, color: '#6b7280' }}>
                (≈ {money(precioNativo, planCur)})
              </span>
            )}
          </Text>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined style={{ color: '#1faec2' }} />
          <Text style={{ fontSize: 13 }}>
            {plan.maxCompanies >= 999 ? 'Empresas ilimitadas' : `${plan.maxCompanies} empresa${plan.maxCompanies > 1 ? 's' : ''}`}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined style={{ color: '#1faec2' }} />
          <Text style={{ fontSize: 13 }}>
            {plan.maxUsers >= 999 ? 'Usuarios ilimitados' : `${plan.maxUsers} usuarios`}
          </Text>
        </div>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircleOutlined style={{ color: '#2ea172', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{f}</Text>
          </div>
        ))}
      </Space>

      <Button
        type={isActive ? 'default' : 'primary'}
        block
        disabled={isActive}
        onClick={() => onSelect(plan)}
        style={isActive ? {} : { background: '#1faec2', borderColor: '#1faec2' }}
      >
        {isActive ? 'Plan actual' : isFree ? 'Usar gratis' : 'Seleccionar'}
      </Button>
    </Card>
  )
}

// ── CardForm ──────────────────────────────────────────────────────────────────

function CardForm({
  plan, currency, exchangeRate, onSuccess, onCancel, tenantName, tenantEmail,
}: {
  plan: PlanConfig
  currency: BillingCurrency
  exchangeRate: number
  onSuccess: (result: PaymentResponse) => void
  onCancel: () => void
  tenantName?: string
  tenantEmail?: string
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'tokenizando' | 'activando' | null>(null)
  const [cardDisplay, setCardDisplay] = useState('')

  // El cobro real de QPayPro es en la moneda del plan → se muestra esa, no la de visualización.
  const planCur = plan.currency || 'USD'
  const cargoTexto = money(Number(plan.priceMonthly), planCur)

  // Pre-llenar con datos del tenant al montar el formulario
  useEffect(() => {
    const prefill: Record<string, string> = {}
    if (tenantName) prefill.holderName = tenantName.toUpperCase()
    if (tenantEmail) prefill.email = tenantEmail
    if (Object.keys(prefill).length) form.setFieldsValue(prefill)
  }, [tenantName, tenantEmail, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const rawNum = values.ccNumber.replace(/\s/g, '')
      const [expMonth, expYear] = (values.expiry as string).split('/')
      const nameParts = (values.holderName as string).trim().split(/\s+/)
      const firstName = nameParts[0] ?? 'Cliente'
      const lastName  = nameParts.slice(1).join(' ') || '-'

      setSaving(true)
      setStep('tokenizando')

      await tokenizarTarjeta({
        datosCliente: {
          firstName,
          lastName,
          email:     values.email,
          telefono:  values.telefono,
          nit:       (values.nit || 'CF').trim().toUpperCase(),
          ciudad:    'Guatemala',
        },
        ccNumber:  rawNum,
        expMonth:  expMonth.trim(),
        expYear:   expYear.trim(),
        ccCvv2:    values.cvv,
        cardType:  detectCardType(rawNum),
        plan:      plan.plan,
      })

      setStep('activando')
      const result = await activarCobros()

      message.success('¡Cobros automáticos configurados! El primer cobro se procesará en el siguiente ciclo de QPayPro.', 8)
      onSuccess({ success: true, message: result.message } as PaymentResponse)
    } catch (e: any) {
      message.error(
        billingErrorMsg(e, 'No se pudo configurar la suscripción. Verifica los datos e intenta de nuevo.'),
        8,
      )
    } finally {
      setSaving(false)
      setStep(null)
    }
  }

  return (
    <div>
      <div style={{
        background: '#fafbfc', borderRadius: 8, padding: '12px 16px',
        marginBottom: 20, border: '1px solid #d6e4ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ color: '#1faec2' }}>Plan {plan.displayName}</Text>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1faec2' }}>
              {cargoTexto} <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>/ mes</Text>
            </div>
          </div>
          <LockOutlined style={{ fontSize: 28, color: '#1faec2', opacity: 0.4 }} />
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Pago seguro procesado por QPayPro Sandbox. La tarjeta se envia al backend para tokenizacion/cobro y no se almacena completa.
        </Text>
      </div>

      <Form form={form} layout="vertical" size="middle" autoComplete="on">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="email" label="Correo electrónico"
            rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
          >
            <Input autoComplete="email" placeholder="tu@empresa.com" inputMode="email" />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono"
            rules={[{ required: true, message: 'Requerido' }]}
          >
            <Input autoComplete="tel" placeholder="50212345678" inputMode="tel" />
          </Form.Item>
        </div>

        <Form.Item name="nit" label="NIT (opcional — usa CF si no aplica)">
          <Input placeholder="CF" autoComplete="off" style={{ textTransform: 'uppercase' }}
            onChange={e => form.setFieldValue('nit', e.target.value.toUpperCase())}
          />
        </Form.Item>

        <Form.Item name="holderName" label="Nombre en la tarjeta"
          rules={[{ required: true, message: 'Ingresa el nombre del titular' }]}
        >
          <Input
            autoComplete="cc-name"
            name="ccname"
            prefix={<CreditCardOutlined style={{ color: '#6b7280' }} />}
            placeholder="JUAN GARCIA LOPEZ"
            style={{ textTransform: 'uppercase' }}
          />
        </Form.Item>

        <Form.Item name="ccNumber" label="Numero de tarjeta"
          rules={[
            { required: true, message: 'Ingresa el numero de tarjeta' },
            {
              validator: (_, value: string) => {
                const digits = (value ?? '').replace(/\s/g, '')
                return /^\d{16}$/.test(digits)
                  ? Promise.resolve()
                  : Promise.reject('Numero de tarjeta invalido (16 digitos)')
              },
            },
          ]}
        >
          <Input
            autoComplete="cc-number"
            name="cardnumber"
            inputMode="numeric"
            prefix={
              cardDisplay.startsWith('4')
                ? <Tag color="#1faec2" style={{ padding: '0 4px', fontSize: 11 }}>VISA</Tag>
                : cardDisplay
                  ? <Tag color="#ff7f00" style={{ padding: '0 4px', fontSize: 11 }}>MC</Tag>
                  : <CreditCardOutlined style={{ color: '#6b7280' }} />
            }
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            onChange={e => {
              const formatted = formatCardInput(e.target.value)
              setCardDisplay(formatted.replace(/\s/g, ''))
              form.setFieldValue('ccNumber', formatted)
            }}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="expiry" label="Vencimiento (MM/AA)"
            rules={[
              { required: true, message: 'Requerido' },
              { pattern: /^(0[1-9]|1[0-2])\/\d{2}$/, message: 'Formato MM/AA' },
            ]}
          >
            <Input
              autoComplete="cc-exp"
              name="ccexp"
              inputMode="numeric"
              placeholder="MM/AA"
              maxLength={5}
              onChange={e => {
                let val = e.target.value.replace(/\D/g, '')
                if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2, 4)
                form.setFieldValue('expiry', val)
              }}
            />
          </Form.Item>

          <Form.Item name="cvv" label="CVV / CVC"
            rules={[
              { required: true, message: 'Requerido' },
              { pattern: /^\d{3,4}$/, message: '3 o 4 digitos' },
            ]}
          >
            <Input
              autoComplete="cc-csc"
              name="cvc"
              inputMode="numeric"
              placeholder="000"
              maxLength={4}
              suffix={<LockOutlined style={{ color: '#6b7280', fontSize: 12 }} />}
              onChange={e => {
                form.setFieldValue('cvv', e.target.value.replace(/\D/g, ''))
              }}
            />
          </Form.Item>
        </div>

        <Alert
          type="info" showIcon icon={<LockOutlined />}
          style={{ fontSize: 12, marginBottom: 16 }}
          message="Cobros Automáticos QPayPro"
          description={
            step === 'tokenizando'
              ? 'Registrando tarjeta en QPayPro...'
              : step === 'activando'
                ? 'Activando suscripción recurrente...'
                : `Tu tarjeta queda registrada para cobros mensuales de ${cargoTexto}. El primer cobro se procesa en el siguiente ciclo de QPayPro.`
          }
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <Button block onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button type="primary" block loading={saving} onClick={handleSubmit}
            style={{ background: '#1faec2', flex: 2 }}
            icon={<LockOutlined />}
          >
            {step === 'tokenizando'
              ? 'Registrando tarjeta...'
              : step === 'activando'
                ? 'Activando suscripción...'
                : `Configurar cobro ${cargoTexto} / mes`}
          </Button>
        </div>
      </Form>
    </div>
  )
}

// PaymentHistory
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
      <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
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
          <FileTextOutlined style={{ color: '#1faec2' }} />
          <span style={{ color: '#1faec2', fontWeight: 600 }}>
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
        background: '#fafbfc', borderRadius: 8, padding: '12px 16px',
        marginBottom: 20, border: '1px solid #d6e4ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Pago por suscripción</Text>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1faec2' }}>
              {money(amount, currency)} — Plan {planName}
            </div>
          </div>
          <Tag color="success" icon={<CheckCircleOutlined />}>Aprobado</Tag>
        </div>
      </div>

      {/* Resultado exitoso */}
      {result?.success ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#2ea172', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1faec2', marginBottom: 8 }}>
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
          <Button type="primary" onClick={onClose} style={{ background: '#1faec2' }}>
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
                  <span style={{ color: '#6b7280', fontSize: 11, cursor: 'help' }}>?</span>
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
              style={{ background: '#1faec2', flex: 2 }}
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
  const [currency, setCurrency]     = useState<BillingCurrency>('GTQ')
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [rateInfo, setRateInfo]     = useState<{ rate: number; updatedAt?: string; updatedBy?: string }>({ rate: 7.7 })


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
  const activePlan = sub?.status === 'active' ? sub.plan : undefined

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

  const handleChangePlanConfirm = async () => {
    if (!selectedPlan) return
    setChangingPlan(true)
    try {
      const result = await changePlan(selectedPlan.plan, currency)
      message.success(result.message)
      setModalOpen(false)
      await load()
    } catch (e: any) {
      message.error(billingErrorMsg(e, 'Error al cambiar de plan'), 6)
    } finally {
      setChangingPlan(false)
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

  const isInTrial = state?.tenant?.status === 'trial'
  const trialEndsAt = state?.tenant?.trialEndsAt ? new Date(state.tenant.trialEndsAt) : null
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null
  // Inferir fecha de inicio: trialEndsAt - 30 días
  const trialStartedAt = trialEndsAt ? new Date(trialEndsAt.getTime() - 30 * 24 * 60 * 60 * 1000) : null
  const trialDaysElapsed = trialStartedAt
    ? Math.min(30, Math.max(0, Math.floor((Date.now() - trialStartedAt.getTime()) / 86400000)))
    : null
  const trialProgressPct = trialDaysElapsed !== null ? Math.round((trialDaysElapsed / 30) * 100) : 0
  const trialColor = trialDaysLeft === null ? 'warning'
    : trialDaysLeft <= 7 ? 'error'
    : trialDaysLeft <= 15 ? 'warning'
    : 'info'
  const fmtDate = (d: Date) => d.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Banner de trial */}
      {isInTrial && (
        <Card
          style={{
            marginBottom: 20, borderRadius: 10,
            borderColor: trialDaysLeft !== null && trialDaysLeft <= 7 ? '#ff4d4f'
              : trialDaysLeft !== null && trialDaysLeft <= 15 ? '#faad14' : '#1677ff',
            background: trialDaysLeft !== null && trialDaysLeft <= 7 ? '#fff1f0'
              : trialDaysLeft !== null && trialDaysLeft <= 15 ? '#fffbe6' : '#e6f4ff',
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <ClockCircleOutlined style={{
              fontSize: 24, marginTop: 2,
              color: trialDaysLeft !== null && trialDaysLeft <= 7 ? '#cf1322'
                : trialDaysLeft !== null && trialDaysLeft <= 15 ? '#d46b08' : '#1677ff',
            }} />
            <div style={{ flex: 1 }}>
              {trialDaysLeft !== null && trialDaysLeft > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      Período de prueba gratuita —{' '}
                      <span style={{
                        fontSize: 20,
                        color: trialDaysLeft <= 7 ? '#cf1322' : trialDaysLeft <= 15 ? '#d46b08' : '#1677ff',
                      }}>
                        {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''}
                      </span>
                      {' '}restantes
                    </span>
                    <Tag color={trialDaysLeft <= 7 ? 'red' : trialDaysLeft <= 15 ? 'orange' : 'blue'}>
                      Día {trialDaysElapsed} de 30
                    </Tag>
                  </div>
                  <Progress
                    percent={trialProgressPct}
                    strokeColor={trialDaysLeft <= 7 ? '#ff4d4f' : trialDaysLeft <= 15 ? '#faad14' : '#1677ff'}
                    trailColor="rgba(0,0,0,0.06)"
                    showInfo={false}
                    size="small"
                    style={{ marginBottom: 6 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                    <span>Activado: {trialStartedAt ? fmtDate(trialStartedAt) : '—'}</span>
                    <span>Vence: {trialEndsAt ? fmtDate(trialEndsAt) : '—'}</span>
                  </div>
                  {trialDaysLeft <= 15 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: trialDaysLeft <= 7 ? '#cf1322' : '#d46b08' }}>
                      Suscríbete ahora para no perder acceso a tus datos. El proceso toma menos de 2 minutos.
                    </div>
                  )}
                </>
              ) : (
                <strong style={{ color: '#cf1322' }}>
                  Tu período de prueba ha vencido — activa tu suscripción para seguir usando el sistema
                </strong>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Suscripción y Facturación</Title>
        <Text type="secondary">Gestiona tu plan, tarjeta de pago e historial de cobros</Text>
      </div>

      {/* Selector de moneda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ color: '#1faec2' }}>Planes disponibles</Text>
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
            <Tag color="#1faec2" style={{ fontSize: 11 }}>
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
              current={activePlan}
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
            <ClockCircleOutlined style={{ color: '#1faec2' }} />
            <span style={{ color: '#1faec2', fontWeight: 600 }}>Historial de cobros</span>
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
            <CreditCardOutlined style={{ color: '#1faec2' }} />
            <span style={{ color: '#1faec2' }}>
              {isNewSubscription || !hasCard ? 'Activar suscripción' : `Cambiar a plan ${selectedPlan?.displayName}`}
            </span>
          </Space>
        }
        onCancel={() => { setModalOpen(false); setSelectedPlan(null) }}
        footer={null}
        destroyOnClose
        maskClosable={false}
        width={500}
      >
        {selectedPlan && (isNewSubscription || !hasCard) ? (
          <CardForm
            plan={selectedPlan}
            currency={currency}
            exchangeRate={exchangeRate}
            tenantName={state?.tenant?.name}
            tenantEmail={state?.tenant?.email}
            onSuccess={async () => {
              setModalOpen(false)
              await load()
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
                style={{ background: '#1faec2' }}
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
          <LockOutlined style={{ color: '#6b7280' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pagos seguros procesados por <strong>QPay Pro</strong> · Visa · Mastercard · PCI-DSS
          </Text>
          <WarningOutlined style={{ color: '#6b7280' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tus datos de tarjeta nunca se almacenan en nuestros servidores
          </Text>
        </Space>
      </div>

    </div>
  )
}
