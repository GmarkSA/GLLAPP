import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Badge, Space, Typography, Statistic, Row, Col,
  Button, message, Modal, Descriptions, Spin, Popconfirm, Tabs,
  Form, InputNumber, Input, Select, Tooltip, Segmented, Dropdown,
  Checkbox, Radio,
} from 'antd'
import {
  BankOutlined, TeamOutlined, GlobalOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined, CheckCircleOutlined,
  PlusOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, KeyOutlined,
  StarFilled, StarOutlined, DollarOutlined, ClockCircleOutlined, FileTextOutlined,
  SearchOutlined, PrinterOutlined, CustomerServiceOutlined,
  SendOutlined, MinusCircleOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import AdminSupportPanel from './AdminSupportPanel'
import { adminUnreadCount } from '../../api/support'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import type { Company } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import {
  getGtqExchangeRate, setGtqExchangeRate,
  adminActivateTrial, adminSetBillingConfig, adminGetTenantBilling, adminRequestInvoiceForTenant,
  type TenantBillingInfo, type TenantBillingPayment,
} from '../../api/billing'
import { companiesApi } from '../../api/companies'
import { platformTemplatesApi, type PlatformTemplate } from '../../api/platformTemplates'
import { getAccounts, type Account } from '../../api/catalogo'

const { Title, Text } = Typography

// ── Label de la pestaña Soporte con badge de tickets no leídos ─────────────────
// Autónomo: consulta el contador y refresca cada 20s, sin acoplar el estado del padre.
function SoporteTabLabel() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const fetchCount = () =>
      adminUnreadCount().then(r => { if (alive) setCount(r?.count ?? 0) }).catch(() => {})
    fetchCount()
    const t = setInterval(fetchCount, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <Space>
      <CustomerServiceOutlined />
      Soporte
      <Badge count={count} size="small" />
    </Space>
  )
}

// ── BillingConfigTab ──────────────────────────────────────────────────────────
// Componente separado para evitar que el estado del InputNumber se pierda
// cuando el padre re-renderiza y recrea el array items de <Tabs>.

function BillingConfigTab({ plans }: { plans: PlanConfig[] }) {
  const [rate, setRate]       = useState<number>(7.70)
  const [info, setInfo]       = useState<{ updatedAt?: string; updatedBy?: string }>({})
  const [saving, setSaving]   = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const [accounts, setAccounts]           = useState<Account[]>([])
  const [planAccounts, setPlanAccounts]   = useState<Record<string, string | undefined>>({})
  const [savingAccount, setSavingAccount] = useState<string | null>(null)
  const [emitiendo, setEmitiendo] = useState(false)
  const [reconciliando, setReconciliando] = useState(false)
  const [simulando, setSimulando] = useState(false)

  const handleReconciliar = async () => {
    setReconciliando(true)
    try {
      const r: any = await api.post('/billing/admin/reconciliar-cobros').then(x => x.data?.data ?? x.data)
      const aprobados = r?.pagosAprobados ?? 0
      if (r?.pollingError) {
        message.warning(`QPayPro falló: ${r.pollingError}. Estado: ${aprobados} pago(s) aprobado(s).`, 8)
      } else if (aprobados === 0) {
        const comps = r?.detalle?.[0]?.comprobantesQpay
        let extra = ''
        if (Array.isArray(comps)) {
          extra = comps.length
            ? ` QPayPro devolvió ${comps.length} comprobante(s): ${comps.map((c: any) => `status ${c.status}`).join(', ')} (1=aprobado, 3=rechazado).`
            : ' QPayPro aún no devuelve comprobantes (el cargo no se ha procesado de su lado).'
        } else if (comps?.error) {
          extra = ` (error QPayPro: ${comps.error})`
        }
        message.info(`0 pagos aprobados.${extra}`, 10)
      } else {
        message.success(`Reconciliadas ${r?.revisadas ?? 0} suscripción(es) · ${aprobados} pago(s) aprobado(s)`)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al reconciliar cobros')
    } finally { setReconciliando(false) }
  }

  const handleSimularCobro = async () => {
    setSimulando(true)
    try {
      const r: any = await api.post('/billing/admin/simular-cobro').then(x => x.data?.data ?? x.data)
      const n = r?.simulados ?? 0
      const errores: string[] = r?.errores ?? []
      if (errores.length) {
        message.error(`Falló la simulación → ${errores.join(' | ')}`, 15)
      } else if (n === 0) {
        message.info('No hay suscripciones en procesando_pago para simular')
      } else {
        message.success(`${n} cobro(s) simulado(s) como aprobados. Ahora dale a "Emitir facturas pendientes ahora".`, 8)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al simular cobro')
    } finally { setSimulando(false) }
  }

  const handleEmitirAhora = async () => {
    setEmitiendo(true)
    try {
      const r: any = await api.post('/ventas/suscripciones-facturacion/emitir-ahora').then(x => x.data?.data ?? x.data)
      const emitidas = r?.emitidas ?? 0
      const fallidas = r?.fallidas ?? 0
      const errores: string[] = r?.errores ?? []
      if (errores.length) {
        message.error(`Falló la emisión → ${errores.join(' | ')}`, 15)
      } else if (emitidas === 0 && fallidas === 0) {
        message.info(r?.motivo ?? 'No hay cobros pendientes por facturar', 10)
      } else {
        message.success(`${emitidas} factura(s) emitida(s)${fallidas ? `, ${fallidas} fallida(s)` : ''}`)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al emitir facturas')
    } finally { setEmitiendo(false) }
  }

  useEffect(() => {
    getGtqExchangeRate()
      .then(r => { setRate(r.rate); setInfo({ updatedAt: r.updatedAt, updatedBy: r.updatedBy }); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    getAccounts().then((a: Account[]) => setAccounts(Array.isArray(a) ? a : [])).catch(() => setAccounts([]))
  }, [])
  useEffect(() => {
    setPlanAccounts(Object.fromEntries(plans.map(p => [p.plan, p.incomeAccountId ?? undefined])))
  }, [plans])

  const handleSave = async () => {
    if (!rate || rate <= 0) { message.error('Ingresa un tipo de cambio válido'); return }
    setSaving(true)
    try {
      await setGtqExchangeRate(rate)
      message.success(`Tipo de cambio actualizado: 1 USD = Q ${rate.toFixed(4)}`)
      const r = await getGtqExchangeRate()
      setInfo({ updatedAt: r.updatedAt, updatedBy: r.updatedBy })
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  // Cuentas de ingreso (4xx o de balance Acreedor), igual criterio que el LineItemsEditor
  const incomeAccounts = accounts.filter(a => a.code?.startsWith('4') || a.balanceType === 'Acreedor')
  const savePlanAccount = async (planKey: string, accountId?: string) => {
    setSavingAccount(planKey)
    try {
      await api.patch(`/admin/plans/${planKey}`, { incomeAccountId: accountId ?? null })
      setPlanAccounts(prev => ({ ...prev, [planKey]: accountId }))
      message.success('Cuenta de ingreso actualizada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar la cuenta')
    } finally { setSavingAccount(null) }
  }

  const mesActual = new Date().toLocaleDateString('es-GT', { month: 'long' })
  const anioActual = new Date().getFullYear()

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} md={12}>
        <Card
          size="small"
          title={
            <Space>
              <GlobalOutlined style={{ color: '#1faec2' }} />
              <span style={{ color: '#1faec2', fontWeight: 600 }}>
                Tipo de cambio GTQ / USD para suscripciones
              </span>
            </Space>
          }
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        >
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
            Este valor se usa para mostrar los precios de los planes en Quetzales (GTQ)
            cuando un cliente elige esa moneda al suscribirse.
          </Text>

          <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>1 USD =</div>
          <InputNumber
            value={rate}
            onChange={v => setRate(v ?? 7.70)}
            min={0.0001}
            max={99999}
            precision={4}
            step={0.01}
            addonAfter="GTQ"
            style={{ width: '100%', marginBottom: 16 }}
            size="large"
            disabled={!loaded}
          />

          {info.updatedBy && (
            <div style={{
              background: '#f9fafb', borderRadius: 6, padding: '8px 12px', marginBottom: 16,
              fontSize: 12, color: '#6b7280',
            }}>
              <div>Último cambio por: <strong>{info.updatedBy}</strong></div>
              {info.updatedAt && <div>Fecha: {new Date(info.updatedAt).toLocaleString('es-GT')}</div>}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ejemplo: Plan Professional ($49 USD) = Q {(49 * rate).toFixed(2)} GTQ
            </Text>
          </div>

          <Button
            type="primary" loading={saving} onClick={handleSave}
            style={{ background: '#1faec2', width: '100%' }}
          >
            Guardar tipo de cambio
          </Button>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card
          size="small"
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#2ea172' }} />
              <span style={{ color: '#1faec2', fontWeight: 600 }}>Vista previa en GTQ</span>
            </Space>
          }
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        >
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Cómo verán los clientes los precios con este tipo de cambio:
          </Text>
          {plans.map(plan => (
            <div key={plan.plan} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
            }}>
              <Tag color={Number(plan.priceMonthly) === 0 ? 'default' : plan.plan === 'enterprise' ? 'gold' : '#1faec2'}>
                {plan.displayName}
              </Tag>
              {Number(plan.priceMonthly) === 0 ? (
                <Tag color="success">Gratis</Tag>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1faec2' }}>
                    Q {(Number(plan.priceMonthly) * rate).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9aa1ab' }}>
                    (${Number(plan.priceMonthly).toFixed(2)} USD)
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      </Col>

      <Col xs={24}>
        <Card
          size="small"
          title={
            <Space>
              <DollarOutlined style={{ color: '#2ea172' }} />
              <span style={{ color: '#1faec2', fontWeight: 600 }}>Facturación de suscripciones</span>
            </Space>
          }
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        >
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
            Cuenta de ingreso por plan (de tu nomenclatura). Se usa al emitir la factura de cada suscripción.
          </Text>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            Tipo de documento: <b>FPEQ — Pequeño Contribuyente</b> · Descripción del ítem:{' '}
            <i>“Suscripción [nombre del plan] mes de {mesActual} {anioActual}”</i>
          </div>
          {plans.map(plan => (
            <div key={plan.plan} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(10,10,10,0.06)' }}>
              <Tag color={plan.plan === 'enterprise' ? 'gold' : Number(plan.priceMonthly) === 0 ? 'default' : '#1faec2'} style={{ minWidth: 120, textAlign: 'center' }}>
                {plan.displayName}
              </Tag>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                loading={savingAccount === plan.plan}
                placeholder="Selecciona la cuenta de ingreso"
                style={{ flex: 1, maxWidth: 480 }}
                value={planAccounts[plan.plan]}
                onChange={(val) => savePlanAccount(plan.plan, val)}
                options={incomeAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
              />
            </div>
          ))}
          {incomeAccounts.length === 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>No se cargaron cuentas de ingreso de la nomenclatura.</Text>
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed rgba(10,10,10,0.12)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button icon={<ReloadOutlined />} loading={reconciliando} onClick={handleReconciliar}>
              Reconciliar cobros QPayPro
            </Button>
            <Popconfirm
              title="¿Simular un cobro aprobado?"
              description="Registra un pago 'aprobado' (sin dinero real) para las suscripciones en procesando_pago. Solo para pruebas."
              okText="Sí, simular"
              onConfirm={handleSimularCobro}
            >
              <Button icon={<ClockCircleOutlined />} loading={simulando} style={{ color: '#b7791f', borderColor: '#e5c07b' }}>
                Simular cobro aprobado (prueba)
              </Button>
            </Popconfirm>
            <Button type="primary" icon={<FileTextOutlined />} loading={emitiendo} onClick={handleEmitirAhora} style={{ background: '#2ea172', borderColor: '#2ea172' }}>
              Emitir facturas pendientes ahora
            </Button>
            <Text type="secondary" style={{ fontSize: 12, flexBasis: '100%' }}>
              1) <b>Reconciliar</b> confirma en QPayPro los cobros pendientes (registra el pago si está aprobado). 2) <b>Emitir</b> factura los cobros confirmados que aún no tienen Factura de Venta.
            </Text>
          </div>
        </Card>
      </Col>
    </Row>
  )
}
const unwrap = (r: any) => r.data?.data ?? r.data

// ── Modal "Enviar demo" — crea un tenant demo e invita al prospecto por correo ──
// ── Pestaña "Demos" — tablero de demos enviados: cuántos salen y quiénes activan ──
function DemosTab() {
  const navigate = useNavigate()
  const [accediendo, setAccediendo] = useState<string | null>(null)
  // Mismo mecanismo de impersonación que la pestaña Tenants (endpoint ya probado en producción):
  // imprescindible para intervenir un demo (p. ej. asignar contraseña temporal a un prospecto trabado)
  const accederDemo = async (r: any) => {
    setAccediendo(r.tenantId)
    try {
      const res: any = await api.post(`/admin/tenants/${r.tenantId}/impersonate`).then(unwrap)
      sessionStorage.setItem('impersonationToken',    res.impersonationToken)
      sessionStorage.setItem('impersonationTenantId', res.tenantId)
      sessionStorage.setItem('impersonationTenantName', res.tenantName)
      sessionStorage.removeItem('activeCompanyId')
      navigate('/dashboard')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al acceder al demo')
    } finally { setAccediendo(null) }
  }
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/demos').then(unwrap)
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const total     = rows.length
  const activados = rows.filter(r => r.userStatus === 'active').length
  const conversion = total > 0 ? Math.round((activados / total) * 100) : 0
  // Medidor: minutos desde el correo (demo.sentAt) hasta la última marca de la guía
  const minutosConfig = (r: any): number | null => {
    const inicio = r.demo?.sentAt ? new Date(r.demo.sentAt).getTime() : NaN
    const fin = r.setup?.ultimaMarca ? new Date(r.setup.ultimaMarca).getTime() : NaN
    if (isNaN(inicio) || isNaN(fin) || fin <= inicio) return null
    return Math.max(1, Math.round((fin - inicio) / 60000))
  }
  const fmtDur = (min: number) => min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
  const tiempos = rows.map(minutosConfig).filter((m): m is number => m != null)
  const promedioConfig = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null
  const fmtF = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-GT') : '—'

  const cols: ColumnsType<any> = [
    {
      title: 'Empresa demo', dataIndex: 'tenantName',
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#9aa1ab' }}>
            enviado por {r.demo?.invitedBy ?? '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Prospecto', dataIndex: 'email',
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontSize: 13 }}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{v ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Enviado', width: 100,
      render: (_: any, r: any) => <span style={{ fontSize: 12 }}>{fmtF(r.demo?.sentAt ?? r.createdAt)}</span>,
    },
    {
      title: 'Días', dataIndex: 'demo', width: 60, align: 'center',
      render: (d: any) => <span style={{ fontSize: 12 }}>{d?.trialDays ?? '—'}</span>,
    },
    {
      title: 'Invitación', dataIndex: 'userStatus', width: 120,
      render: (v: string) => v === 'active'
        ? <Tag color="success">Registrado</Tag>
        : <Tag color="warning">Pendiente</Tag>,
    },
    {
      title: 'Configuración', width: 140,
      render: (_: any, r: any) => {
        if (!r.setup?.completados) return <span style={{ fontSize: 12, color: '#9aa1ab' }}>Sin iniciar</span>
        const min = minutosConfig(r)
        const detalle = Object.entries(r.setup.pasos ?? {})
          .map(([k, v]: any) => `${k}: ${typeof v === 'string' && v.startsWith('skipped') ? 'omitido' : new Date(v).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`)
          .join(' · ')
        return (
          <Tooltip title={`Del correo a la última marca de la guía. ${detalle}`}>
            <span style={{ fontSize: 12 }}>
              <b>{r.setup.completados}/9</b>{min != null && <> · {fmtDur(min)}</>}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Último acceso', dataIndex: 'lastLoginAt', width: 110,
      render: (v: string) => <span style={{ fontSize: 12 }}>{fmtF(v)}</span>,
    },
    {
      title: 'Tenant', dataIndex: 'tenantStatus', width: 100,
      render: (v: string) => (
        <Tag color={v === 'active' ? 'success' : v === 'trial' ? 'processing' : 'error'}>{v}</Tag>
      ),
    },
    {
      title: 'Vence trial', dataIndex: 'trialEndsAt', width: 100,
      render: (v: string) => <span style={{ fontSize: 12 }}>{fmtF(v)}</span>,
    },
    {
      title: '', width: 150, align: 'center',
      render: (_: any, r: any) => (
        <Space size={4}>
        <Button
          size="small" type="primary" icon={<EyeOutlined />}
          loading={accediendo === r.tenantId}
          onClick={() => accederDemo(r)}
          style={{ background: '#1B3A6B' }}
          title="Acceder como este demo (para asistir al prospecto)"
        >
          Acceder
        </Button>
        <Popconfirm
          title={`¿Eliminar el demo "${r.tenantName}"?`}
          description="Se borran sus datos, el tenant y el usuario invitado. No se puede deshacer."
          okText="Eliminar"
          okButtonProps={{ danger: true }}
          onConfirm={async () => {
            try {
              const res: any = await api.delete(`/admin/demos/${r.tenantId}`).then(unwrap)
              message.success(res?.message ?? 'Demo eliminado')
              load()
            } catch (e: any) {
              message.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'No se pudo eliminar el demo')
            }
          }}
        >
          <Button size="small" danger icon={<DeleteOutlined />} title="Eliminar demo" />
        </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Demos enviados</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1B3A6B' }}>{total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Registrados</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#2ea172' }}>{activados}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Conversión</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: conversion >= 50 ? '#2ea172' : '#ff7f00' }}>{conversion}%</div>
            {promedioConfig != null && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Configuración promedio: {fmtDur(promedioConfig)}</div>
            )}
          </Card>
        </Col>
        <Col span={6} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
        </Col>
      </Row>
      <Table
        dataSource={rows}
        columns={cols}
        rowKey="tenantId"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: 'Aún no se han enviado demos — usa el botón "Enviar demo"' }}
      />
    </div>
  )
}

function EnviarDemoModal({ open, onClose, onSent }: {
  open: boolean; onClose: () => void; onSent: () => void
}) {
  const [form] = Form.useForm()
  const [templates, setTemplates] = useState<PlatformTemplate[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) platformTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]))
  }, [open])

  const handleSend = async () => {
    let values: any
    try { values = await form.validateFields() } catch { return }
    try {
      setSending(true)
      const r: any = await api.post('/admin/demos', values).then(unwrap)
      Modal.success({
        title: 'Demo enviado',
        content: (
          <div style={{ fontSize: 13 }}>
            <p style={{ margin: '4px 0' }}>Tenant demo: <b>{r.tenantName}</b> · {r.trialDays} días de prueba</p>
            <p style={{ margin: '4px 0' }}>
              Correo de invitación: {r.emailSent ? 'enviado ✅' : 'no se pudo enviar ⚠️ (verifica Resend)'}
            </p>
            {r.cloned && (
              <p style={{ margin: '4px 0' }}>
                Plantilla “{r.cloned.template}”: {r.cloned.accounts} cuentas · {r.cloned.taxes} impuestos · {r.cloned.documentSeries} series
              </p>
            )}
            {r.cloneError && <p style={{ margin: '4px 0', color: '#e5484d' }}>Plantilla: {r.cloneError}</p>}
          </div>
        ),
      })
      form.resetFields()
      onClose()
      onSent()
    } catch (e: any) {
      message.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'No se pudo enviar el demo')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={<span><SendOutlined style={{ color: '#1faec2', marginRight: 8 }} />Enviar demo a un prospecto</span>}
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleSend}
      okText="Enviar demo"
      confirmLoading={sending}
      width={520}
      destroyOnClose
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
        Se crea un tenant de prueba y el prospecto recibe un correo con el enlace para activar su cuenta y entrar al demo.
      </Text>
      <Form form={form} layout="vertical" size="small" initialValues={{ trialDays: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="firstName" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Juan" maxLength={80} />
          </Form.Item>
          <Form.Item name="lastName" label="Apellido">
            <Input placeholder="García" maxLength={80} />
          </Form.Item>
        </div>
        <Form.Item name="email" label="Correo del prospecto"
          rules={[{ required: true, type: 'email', message: 'Correo válido requerido' }]}>
          <Input placeholder="prospecto@empresa.com" />
        </Form.Item>
        <Form.Item name="companyName" label="Nombre de la empresa demo"
          rules={[{ required: true, message: 'Requerido' }]}>
          <Input placeholder="Empresa Demo S.A." maxLength={120} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '0 12px' }}>
          <Form.Item name="templateId" label="Plantilla de empresa (opcional)">
            <Select allowClear placeholder="Empresa vacía"
              options={templates.map(t => ({ value: t.id, label: `${t.icon || '🏢'} ${t.displayName}` }))}
            />
          </Form.Item>
          <Form.Item name="trialDays" label="Días de prueba">
            <InputNumber min={1} max={90} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="message" label="Mensaje personalizado (opcional — va en el correo)">
          <Input.TextArea rows={2} maxLength={500} placeholder="Hola Juan, te preparamos este demo con los módulos que platicamos…" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

const PLAN_COLOR: Record<string, string> = {
  basic: 'default', professional: '#1faec2', enterprise: 'gold',
}
const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', trial: 'default', suspended: 'warning', cancelled: 'error',
}

interface TenantSummary {
  settings?: any
  id: string; name: string; legalName?: string; taxId?: string
  plan?: string; status?: string; companiesCount?: number
  usersCount?: number; createdAt?: string; trialEndsAt?: string
  trialDaysLeft?: number; customMonthlyPriceUSD?: number
  // MRR real desde el backend (GET /admin/tenants); null si el tenant no factura
  mrrAmount?: number | null; mrrCurrency?: string | null
  subscriptionStatus?: string | null; nextChargeAt?: string | null
  lastInvoiceUrl?: string | null; lastInvoiceSerie?: string | null
}
interface PlatformStats {
  totalTenants: number; active: number; trial: number; suspended: number
  byPlan: { basic: number; professional: number; enterprise: number }
}
/** Módulos de Lucía asignables a planes (claves de enabledModules) */
const MODULOS_LUCIA = [
  { value: 'ventas',       label: 'Ventas' },
  { value: 'compras',      label: 'Compras' },
  { value: 'bancos',       label: 'Bancos y Tesorería' },
  { value: 'contabilidad', label: 'Contabilidad (incluye Activos Fijos)' },
  { value: 'reportes',     label: 'Reportes' },
  { value: 'planillas',    label: 'Planillas' },
  { value: 'fel',          label: 'FEL — Factura Electrónica' },
  { value: 'inventario',   label: 'Inventario' },
  { value: 'pos',          label: 'Terminal POS' },
  { value: 'proyectos',    label: 'Proyectos' },
]

interface PlanConfig {
  plan: string; displayName: string; priceMonthly: number; currency: string
  maxCompanies: number; maxUsers: number; maxBranches: number
  features: string[]; isActive: boolean
  modules?: string[]
  incomeAccountId?: string | null
}
interface AdminCompany {
  id: string; companyNumber?: string; legalName: string; tradeName?: string; taxId?: string
  countryCode: string; currencyCode: string; status: string; isActive: boolean; usersCount?: number
}
interface AdminUser {
  id: string; email: string; firstName: string; lastName: string
  status: string; isSuperAdmin?: boolean; roles?: string[]
}

// ── TemplatesTab ──────────────────────────────────────────────────────────────
// Gestiona public.platform_templates — visible para TODOS los tenants en onboarding
function TemplatesTab() {
  const [templates,  setTemplates]  = useState<PlatformTemplate[]>([])
  const [companies,  setCompanies]  = useState<Company[]>([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<PlatformTemplate | null>(null)
  const [pickedCompany, setPickedCompany] = useState<Company | null>(null)
  const [tplForm] = Form.useForm()

  const loadAll = async () => {
    setLoading(true)
    try {
      const [tpls, cos] = await Promise.all([
        platformTemplatesApi.list(),
        companiesApi.getAll(),
      ])
      setTemplates(tpls)
      setCompanies(cos)
    } catch { message.error('Error al cargar') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  // IDs de empresas ya publicadas como plantilla
  const publishedIds = new Set(templates.map(t => t.sourceCompanyId))

  const openAdd = (company: Company) => {
    setEditing(null)
    setPickedCompany(company)
    tplForm.setFieldsValue({ icon: '🏢', displayName: company.legalName, description: '' })
    setModalOpen(true)
  }

  const openEdit = (tpl: PlatformTemplate) => {
    setEditing(tpl)
    setPickedCompany(null)
    tplForm.setFieldsValue({ icon: tpl.icon, displayName: tpl.displayName, description: tpl.description })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await tplForm.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await platformTemplatesApi.save({ ...editing, ...values })
        message.success('Plantilla actualizada')
      } else if (pickedCompany) {
        // Necesitamos el tenantId del admin — lo tomamos del token actual
        const sourceTenantId = sessionStorage.getItem('tenantId') ?? ''
        await platformTemplatesApi.save({
          sourceTenantId,
          sourceCompanyId: pickedCompany.id,
          displayName: values.displayName,
          description: values.description,
          icon: values.icon,
        })
        message.success('Plantilla publicada — ya aparece en el onboarding rápido')
      }
      setModalOpen(false)
      loadAll()
    } catch { message.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleRemove = async (tpl: PlatformTemplate) => {
    try {
      await platformTemplatesApi.remove(tpl.id)
      message.success('Plantilla eliminada del onboarding')
      loadAll()
    } catch { message.error('Error al eliminar') }
  }

  const unpublished = companies.filter(c => !publishedIds.has(c.id))

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
        Las plantillas publicadas aquí aparecen en el <strong>onboarding rápido</strong> para
        todos los clientes nuevos, sin importar en qué tenant estén. El clone es cross-tenant:
        copia plan de cuentas, impuestos y series desde tu empresa al tenant del cliente.
      </Text>

      {/* Plantillas publicadas */}
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#0a0a0a' }}>
        <StarFilled style={{ color: '#f59e0b', marginRight: 6 }} />
        Plantillas publicadas ({templates.length})
      </div>

      {loading ? <Spin style={{ display: 'block', margin: '24px auto' }} /> : (
        <>
          {templates.length === 0 && (
            <div style={{ color: '#9aa1ab', fontSize: 13, marginBottom: 20 }}>
              Ninguna empresa publicada aún. Selecciona una empresa debajo y haz clic en "Publicar".
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 28 }}>
            {templates.map(tpl => (
              <Card key={tpl.id} size="small"
                style={{ border: '1.5px solid #1faec2', borderRadius: 10 }}
                extra={
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(tpl)} />
                    <Button size="small" danger onClick={() => handleRemove(tpl)}>Quitar</Button>
                  </Space>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 36, lineHeight: 1 }}>{tpl.icon || '🏢'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tpl.displayName}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{tpl.description || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9aa1ab', marginTop: 4 }}>
                      Empresa: {companies.find(c => c.id === tpl.sourceCompanyId)?.legalName ?? tpl.sourceCompanyId.slice(0, 8)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Empresas disponibles para publicar */}
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#0a0a0a' }}>
            <StarOutlined style={{ color: '#9aa1ab', marginRight: 6 }} />
            Empresas disponibles para publicar como plantilla
          </div>
          <Table<Company>
            rowKey="id"
            dataSource={unpublished}
            size="small"
            pagination={false}
            locale={{ emptyText: 'Todas las empresas ya están publicadas' }}
            columns={[
              {
                title: 'Empresa',
                render: (_, r) => (
                  <div>
                    <b style={{ fontSize: 13 }}>{r.legalName}</b>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{r.taxId ?? '—'} · {r.currencyCode}</div>
                  </div>
                ),
              },
              { title: 'País', dataIndex: 'countryCode', width: 70, render: (v: string) => <Tag>{v}</Tag> },
              { title: 'Estado', dataIndex: 'status', width: 100, render: (v: string) => <Badge status={v === 'active' ? 'success' : 'warning'} text={v} /> },
              {
                title: '',
                width: 160,
                render: (_, r) => (
                  <Button size="small" type="primary" icon={<StarOutlined />}
                    style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                    onClick={() => openAdd(r)}>
                    Publicar plantilla
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}

      {/* Modal */}
      <Modal
        title={<Space><StarFilled style={{ color: '#f59e0b' }} />{editing ? 'Editar plantilla' : `Publicar: ${pickedCompany?.legalName}`}</Space>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Guardar cambios' : 'Publicar plantilla'}
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={480}
      >
        <Form form={tplForm} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0 12px', alignItems: 'start' }}>
            <Form.Item name="icon" label="Ícono">
              <Input style={{ textAlign: 'center', fontSize: 26, height: 44 }} />
            </Form.Item>
            <Form.Item name="displayName" label="Nombre visible para el cliente" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Empresa de Servicios" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Descripción breve" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} placeholder="Ideal para consultoría, transporte, educación..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function PlatformAdminPage() {
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()

  const [tenants, setTenants]   = useState<TenantSummary[]>([])
  const [stats, setStats]       = useState<PlatformStats | null>(null)
  const [plans, setPlans]       = useState<PlanConfig[]>([])
  const [loading, setLoading]   = useState(false)
  const [detail, setDetail]     = useState<any | null>(null)
  const [detailBilling, setDetailBilling] = useState<TenantBillingInfo | null>(null)
  const [detailOpen, setDetailOpen]   = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  // Filtro + búsqueda de la tabla de tenants (rediseño control)
  const [tenantFilter, setTenantFilter] = useState<'all' | 'active' | 'trial' | 'suspended'>('all')
  const [tenantSearch, setTenantSearch] = useState('')
  const [trialActingId, setTrialActingId] = useState<string | null>(null)

  // Plan edit
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null)
  const [planMode, setPlanMode] = useState<'create' | 'edit'>('edit')
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm] = Form.useForm()
  // Símbolo del campo Precio mensual según la moneda seleccionada
  const planCurrency = Form.useWatch('currency', planForm)
  const simboloMoneda = planCurrency === 'GTQ' ? 'Q' : planCurrency === 'EUR' ? '€' : '$'

  // Assign plan to tenant
  const [assigningTenantId, setAssigningTenantId] = useState<string | null>(null)
  const [impersonating, setImpersonating]         = useState<string | null>(null)

  // Assign user to company (Platform Admin direct flow)
  const [assigningCompanyId, setAssigningCompanyId] = useState<string | null>(null) // companyId being assigned
  const [userToAssign, setUserToAssign]             = useState<string | null>(null)
  const [savingAssign, setSavingAssign]             = useState(false)

  // Billing modal per tenant
  const [billingModalOpen, setBillingModalOpen]   = useState(false)
  const [billingTenant, setBillingTenant]         = useState<TenantSummary | null>(null)
  const [billingInfo, setBillingInfo]             = useState<TenantBillingInfo | null>(null)
  const [billingLoading, setBillingLoading]       = useState(false)
  const [trialActivating, setTrialActivating]     = useState(false)
  const [customPrice, setCustomPrice]             = useState<number | null>(null)
  const [savingPrice, setSavingPrice]             = useState(false)
  const [felModalOpen, setFelModalOpen]           = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [felForm]                                 = Form.useForm()
  const [emittingFel, setEmittingFel]             = useState(false)


  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/dashboard')
      message.warning('Acceso restringido a Super Admin')
    }
  }, [user, navigate])

  const openBillingModal = async (tenant: TenantSummary) => {
    setBillingTenant(tenant); setBillingModalOpen(true); setBillingLoading(true); setBillingInfo(null)
    try {
      const info = await adminGetTenantBilling(tenant.id)
      setBillingInfo(info)
      setCustomPrice(info.customMonthlyPriceUSD)
    } catch { message.error('Error al cargar facturación') }
    finally { setBillingLoading(false) }
  }

  const handleActivateTrial = async (days: number) => {
    if (!billingTenant) return
    setTrialActivating(true)
    try {
      await adminActivateTrial(billingTenant.id, days)
      message.success(`Trial de ${days} días activado para ${billingTenant.name}`)
      await loadTenants()
      const info = await adminGetTenantBilling(billingTenant.id)
      setBillingInfo(info)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al activar trial')
    } finally { setTrialActivating(false) }
  }

  const handleSavePrice = async (priceToSave: number | null) => {
    if (!billingTenant) return
    setSavingPrice(true)
    try {
      await adminSetBillingConfig(billingTenant.id, { customMonthlyPriceUSD: priceToSave })
      setCustomPrice(priceToSave)
      message.success(priceToSave == null ? 'Precio restablecido al del plan' : `Precio personalizado guardado: $${priceToSave}/mes`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar precio')
    } finally { setSavingPrice(false) }
  }

  const handleEmitFel = async (values: any) => {
    if (!selectedPaymentId || !billingTenant) return
    setEmittingFel(true)
    try {
      const result = await adminRequestInvoiceForTenant(selectedPaymentId, {
        subscriptionPaymentId: selectedPaymentId,
        customerTaxId: values.customerTaxId,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        currency: values.currency,
      })
      if (result.success) {
        message.success(`FEL emitida: ${result.felSerie}-${result.felNumero}`)
        setFelModalOpen(false)
        felForm.resetFields()
        const info = await adminGetTenantBilling(billingTenant.id)
        setBillingInfo(info)
      } else {
        message.error(`Error FEL: ${result.message}`)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al emitir FEL')
    } finally { setEmittingFel(false) }
  }

  const loadTenants = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        api.get('/admin/tenants').then(unwrap).catch(() => []),
        api.get('/admin/stats').then(unwrap).catch(() => null),
      ])
      setTenants(Array.isArray(t) ? t : [])
      setStats(s ?? null)
    } catch { message.error('Error al cargar tenants') }
    finally { setLoading(false) }
  }, [])

  const loadPlans = useCallback(async () => {
    try {
      const p = await api.get('/admin/plans').then(unwrap).catch(() => [])
      setPlans(Array.isArray(p) ? p : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadTenants(); loadPlans() }, [loadTenants, loadPlans])

  const openDetail = async (id: string) => {
    setDetailOpen(true); setDetailLoading(true); setDetail(null); setDetailBilling(null)
    try {
      const d = await api.get(`/admin/tenants/${id}`).then(unwrap)
      setDetail(d)
      // Facturación (suscripción + cobros) en paralelo — no bloquea el detalle
      adminGetTenantBilling(id).then(setDetailBilling).catch(() => setDetailBilling(null))
    } catch { message.error('Error al cargar detalle') }
    finally { setDetailLoading(false) }
  }

  const handleRowTrial = async (tenantId: string, days: number) => {
    setTrialActingId(tenantId)
    try {
      await adminActivateTrial(tenantId, days)
      message.success(`Trial de ${days} días activado`)
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al activar trial')
    } finally { setTrialActingId(null) }
  }

  const handleAssignPlan = async (tenantId: string, plan: string) => {
    setAssigningTenantId(tenantId)
    try {
      await api.patch(`/admin/tenants/${tenantId}/plan`, { plan })
      message.success('Plan actualizado')
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al cambiar plan')
    } finally { setAssigningTenantId(null) }
  }

  // Eliminar tenant basura (registro web sin uso) — solo Super Admin; el backend protege activos y con cobros
  // Restricción de módulos por tenant (Platform Admin)
  const [modTenant, setModTenant] = useState<any | null>(null)
  const [modSel, setModSel] = useState<string[] | null>(null)
  const [savingMod, setSavingMod] = useState(false)
  const handleGuardarModulos = async () => {
    if (!modTenant) return
    setSavingMod(true)
    try {
      await api.patch(`/admin/tenants/${modTenant.id}/modules`, { modules: modSel })
      message.success(modSel ? `Módulos restringidos para ${modTenant.name}` : `Sin restricción de módulos para ${modTenant.name}`)
      setModTenant(null)
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo guardar', 6)
    } finally { setSavingMod(false) }
  }

  const [tenantAEliminar, setTenantAEliminar] = useState<any | null>(null)
  const [confirmNombre, setConfirmNombre] = useState('')
  const [eliminandoTenant, setEliminandoTenant] = useState(false)
  const handleEliminarTenant = async () => {
    if (!tenantAEliminar) return
    setEliminandoTenant(true)
    try {
      const res: any = await api.delete(`/admin/tenants/${tenantAEliminar.id}`).then(unwrap)
      message.success(res?.message ?? 'Tenant eliminado')
      setTenantAEliminar(null); setConfirmNombre('')
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'No se pudo eliminar', 7)
    } finally { setEliminandoTenant(false) }
  }

  const refreshDetail = async (tenantId: string) => {
    const d = await api.get(`/admin/tenants/${tenantId}`).then(unwrap)
    setDetail(d)
    return d
  }

  const handleTenantStatus = async (tenantId: string, status: 'active' | 'suspended') => {
    try {
      await api.patch(`/admin/tenants/${tenantId}/status`, { status })
      message.success(status === 'active' ? 'Tenant activado' : 'Tenant suspendido')
      await loadTenants()
      if (detail?.id === tenantId) await refreshDetail(tenantId)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo cambiar el estado del tenant')
    }
  }

  const handleAssignUserToCompany = async (tenantId: string, companyId: string) => {
    if (!userToAssign) { message.warning('Selecciona un usuario'); return }
    setSavingAssign(true)
    try {
      await api.post(`/admin/tenants/${tenantId}/companies/${companyId}/users/${userToAssign}`)
      message.success('Usuario asignado a la empresa')
      setAssigningCompanyId(null)
      setUserToAssign(null)
      await refreshDetail(tenantId)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al asignar usuario')
    } finally { setSavingAssign(false) }
  }

  const handleRemoveUserFromCompany = async (tenantId: string, companyId: string, userId: string) => {
    try {
      await api.delete(`/admin/tenants/${tenantId}/companies/${companyId}/users/${userId}`)
      message.success('Usuario removido de la empresa')
      await refreshDetail(tenantId)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al remover usuario')
    }
  }

  const handleCompanyStatus = async (tenantId: string, companyId: string, status: 'active' | 'suspended') => {
    try {
      await api.patch(`/admin/tenants/${tenantId}/companies/${companyId}/status`, { status })
      message.success(status === 'active' ? 'Empresa activada' : 'Empresa suspendida')
      await loadTenants()
      await refreshDetail(tenantId)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo cambiar el estado de la empresa')
    }
  }

  const handleUserStatus = async (tenantId: string, userId: string, status: 'active' | 'suspended') => {
    try {
      await api.patch(`/admin/tenants/${tenantId}/users/${userId}/status`, { status })
      message.success(status === 'active' ? 'Usuario activado' : 'Usuario bloqueado')
      await refreshDetail(tenantId)
      await loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo cambiar el estado del usuario')
    }
  }

  const handleResetUserPassword = (tenantId: string, userId: string, label: string) => {
    let password = ''
    Modal.confirm({
      title: `Cambiar contraseña de ${label}`,
      content: (
        <Input.Password
          placeholder="Nueva contraseña"
          onChange={e => { password = e.target.value }}
        />
      ),
      okText: 'Cambiar',
      onOk: async () => {
        if (!password || password.length < 6) {
          message.error('La contraseña debe tener al menos 6 caracteres')
          throw new Error('password-too-short')
        }
        await api.post(`/admin/tenants/${tenantId}/users/${userId}/reset-password`, { newPassword: password })
        message.success('Contraseña actualizada')
      },
    })
  }

  const handleRemoveUser = async (tenantId: string, userId: string) => {
    try {
      await api.delete(`/admin/tenants/${tenantId}/users/${userId}`)
      message.success('Usuario eliminado del tenant')
      await refreshDetail(tenantId)
      await loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo eliminar el usuario')
    }
  }

  const openEditPlan = (plan: PlanConfig) => {
    setPlanMode('edit')
    setEditingPlan(plan)
    planForm.setFieldsValue({
      displayName: plan.displayName,
      priceMonthly: plan.priceMonthly,
      currency: plan.currency,
      maxCompanies: plan.maxCompanies,
      maxUsers: plan.maxUsers,
      maxBranches: plan.maxBranches,
      featuresText: (plan.features || []).join('\n'),
      modules: plan.modules ?? [],
    })
    setPlanModalOpen(true)
  }

  const openCreatePlan = () => {
    setPlanMode('create')
    setEditingPlan(null)
    planForm.resetFields()
    planForm.setFieldsValue({
      currency: 'USD',
      priceMonthly: 0,
      maxCompanies: 1,
      maxUsers: 5,
      maxBranches: 1,
      featuresText: '',
      modules: [],
    })
    setPlanModalOpen(true)
  }

  const handleSavePlan = async () => {
    const vals = await planForm.validateFields()
    setSavingPlan(true)
    try {
      const dto = {
        ...vals,
        features: (vals.featuresText || '').split('\n').map((f: string) => f.trim()).filter(Boolean),
      }
      delete dto.featuresText
      if (planMode === 'create') {
        await api.post('/admin/plans', dto)
        message.success(`Plan "${vals.displayName}" creado`)
      } else if (editingPlan) {
        await api.patch(`/admin/plans/${editingPlan.plan}`, dto)
        message.success(`Plan "${editingPlan.displayName}" actualizado`)
      }
      setPlanModalOpen(false)
      loadPlans()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar plan')
    } finally { setSavingPlan(false) }
  }

  const handleDeletePlan = async (plan: PlanConfig) => {
    try {
      await api.delete(`/admin/plans/${plan.plan}`)
      message.success(`Plan "${plan.displayName}" eliminado`)
      loadPlans()
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al eliminar plan')
    }
  }

  const handleImpersonate = async (tenant: TenantSummary) => {
    setImpersonating(tenant.id)
    try {
      const res: any = await api.post(`/admin/tenants/${tenant.id}/impersonate`).then(unwrap)
      sessionStorage.setItem('impersonationToken',    res.impersonationToken)
      sessionStorage.setItem('impersonationTenantId', res.tenantId)
      sessionStorage.setItem('impersonationTenantName', res.tenantName)
      // Limpiar empresa activa para que el cliente empiece sin empresa pre-seleccionada
      sessionStorage.removeItem('activeCompanyId')
      navigate('/dashboard')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al acceder al tenant')
    } finally {
      setImpersonating(null)
    }
  }

  const totalCompanies = tenants.reduce((s, t) => s + (t.companiesCount ?? 0), 0)
  const totalUsers     = tenants.reduce((s, t) => s + (t.usersCount ?? 0), 0)

  // ── Control: MRR aproximado + conteos + filtrado ──────────────────────────
  // MRR calculado en el front desde el precio del plan (o precio personalizado).
  // Aproximado: no mezcla tipos de cambio — es una vista de control, no contable.
  const planByCode = new Map(plans.map(p => [p.plan, p]))
  // La moneda del MRR sale del PLAN (fuente de precio confiable), no de la
  // suscripción — cuyo billingCurrency quedó en USD por default y no representa
  // la moneda real de cobro configurada en el plan (GTQ).
  const mrrCurrency = plans[0]?.currency ?? 'GTQ'
  const tenantCur = (t: TenantSummary): string =>
    planByCode.get(t.plan ?? '')?.currency ?? mrrCurrency
  const symFor = (cur?: string | null) =>
    cur === 'GTQ' ? 'Q' : cur === 'EUR' ? '€' : cur === 'USD' ? '$'
      : (mrrCurrency === 'GTQ' ? 'Q' : mrrCurrency === 'EUR' ? '€' : '$')
  const moneySymbol = symFor(mrrCurrency)
  const fmtMoney = (n: number, cur?: string | null) =>
    `${symFor(cur)} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  // MRR aproximado desde el plan (fallback si el backend aún no envía mrrAmount)
  const tenantMonthly = (t: TenantSummary): number =>
    t.customMonthlyPriceUSD != null
      ? Number(t.customMonthlyPriceUSD)
      : Number(planByCode.get(t.plan ?? '')?.priceMonthly ?? 0)
  // MRR real si el backend lo envía; si no, aproximación (solo tenants activos)
  const tenantMrr = (t: TenantSummary): number =>
    t.mrrAmount != null ? Number(t.mrrAmount) : (t.status === 'active' ? tenantMonthly(t) : 0)
  const mrrIsReal = tenants.some(t => t.mrrAmount != null)

  const activeCount    = tenants.filter(t => t.status === 'active').length
  const trialCount     = tenants.filter(t => t.status === 'trial').length
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length
  const mrrTotal       = tenants.reduce((s, t) => s + tenantMrr(t), 0)
  const soonestTrial   = tenants
    .filter(t => t.status === 'trial' && t.trialDaysLeft != null)
    .sort((a, b) => (a.trialDaysLeft ?? 0) - (b.trialDaysLeft ?? 0))[0]

  const filteredTenants = tenants.filter(t => {
    if (tenantFilter !== 'all' && t.status !== tenantFilter) return false
    const q = tenantSearch.trim().toLowerCase()
    if (q) return [t.name, t.legalName, t.taxId].some(v => (v ?? '').toLowerCase().includes(q))
    return true
  })
  const planOptions = (plans.length > 0 ? plans : [
    { plan: 'basic', displayName: 'Basic' },
    { plan: 'professional', displayName: 'Professional' },
    { plan: 'enterprise', displayName: 'Enterprise' },
  ] as Pick<PlanConfig, 'plan' | 'displayName'>[]).map(plan => ({
    value: plan.plan,
    label: <Tag color={PLAN_COLOR[plan.plan] ?? 'default'}>{plan.displayName}</Tag>,
  }))

  const tenantColumns: ColumnsType<TenantSummary> = [
    {
      title: 'Tenant',
      render: (_, r) => (
        <div>
          <b style={{ fontSize: 13 }}>{r.name}</b>
          {r.legalName && r.legalName !== r.name && <div style={{ fontSize: 11, color: '#6b7280' }}>{r.legalName}</div>}
          {r.taxId && <div style={{ fontSize: 11, color: '#aaa' }}>NIT: {r.taxId}</div>}
        </div>
      ),
    },
    {
      title: 'Plan',
      width: 180,
      render: (_, r) => (
        <Select
          size="small"
          value={r.plan ?? 'basic'}
          style={{ width: 160 }}
          loading={assigningTenantId === r.id}
          onChange={val => handleAssignPlan(r.id, val)}
          options={planOptions}
        />
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status', width: 140,
      render: (v?: string, r?: TenantSummary) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Badge status={STATUS_COLOR[v ?? ''] ?? 'default'} text={v ?? '—'} />
          {v === 'trial' && r?.trialDaysLeft !== undefined && (
            <Tag
              color={!r.trialDaysLeft ? 'red' : r.trialDaysLeft <= 7 ? 'orange' : 'blue'}
              style={{ fontSize: 11, marginLeft: 0, width: 'fit-content' }}
              icon={<ClockCircleOutlined />}
            >
              {r.trialDaysLeft > 0 ? `${r.trialDaysLeft} días` : 'Vencido'}
            </Tag>
          )}
        </div>
      ),
    },
    { title: 'Empresas', dataIndex: 'companiesCount', width: 80, align: 'center' as const, render: (v?: number) => v ?? 0 },
    {
      title: 'Usuarios', dataIndex: 'usersCount', width: 80, align: 'center' as const,
      render: (v: number | undefined, r) => (
        <Tooltip title="Ver / bloquear / habilitar usuarios">
          <a style={{ color: '#1B3A6B', fontWeight: 500 }} onClick={() => openDetail(r.id)}>{v ?? 0}</a>
        </Tooltip>
      ),
    },
    {
      title: 'MRR', width: 110, align: 'right' as const,
      render: (_, r) => {
        const v = tenantMrr(r)
        return v > 0
          ? <b style={{ color: '#1B3A6B' }}>{fmtMoney(v, tenantCur(r))}</b>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Próximo cobro', width: 130,
      render: (_, r) => {
        if (r.status === 'trial' && r.trialDaysLeft != null)
          return <Tag color={r.trialDaysLeft <= 7 ? 'orange' : 'blue'} icon={<ClockCircleOutlined />} style={{ fontSize: 11 }}>trial · {r.trialDaysLeft}d</Tag>
        if (r.nextChargeAt)
          return <span style={{ fontSize: 12 }}>{new Date(r.nextChargeAt).toLocaleDateString('es-GT')}</span>
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Acciones', width: 250,
      render: (_, r) => (
        <Space size={4}>
          <Button
            size="small" type="primary" icon={<EyeOutlined />}
            loading={impersonating === r.id}
            onClick={() => handleImpersonate(r)}
            style={{ background: '#1B3A6B' }}
            title="Acceder como este tenant"
          >
            Acceder
          </Button>
          <Tooltip title="Detalle: empresas, usuarios y cobros">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
          </Tooltip>
          <Tooltip title="Facturación e historial de pagos">
            <Button size="small" icon={<DollarOutlined />} onClick={() => openBillingModal(r)}
              style={{ color: '#2ea172', borderColor: '#2ea172' }} />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            menu={{ items: [
              { key: '30', label: 'Activar trial 30 días', onClick: () => handleRowTrial(r.id, 30) },
              { key: '15', label: 'Extender trial 15 días', onClick: () => handleRowTrial(r.id, 15) },
              { key: '7',  label: 'Extender trial +7 días',  onClick: () => handleRowTrial(r.id, 7) },
            ] }}
          >
            <Button size="small" icon={<ClockCircleOutlined />} loading={trialActingId === r.id}
              title="Trial: activar o extender" style={{ color: '#b7791f', borderColor: '#e5c07b' }} />
          </Dropdown>
          {r.lastInvoiceUrl && (
            <Tooltip title={`Ver factura FEL ${r.lastInvoiceSerie ?? ''}`}>
              <Button size="small" icon={<FileTextOutlined />}
                onClick={() => window.open(r.lastInvoiceUrl!, '_blank', 'noopener')}
                style={{ color: '#1faec2', borderColor: '#1faec2' }} />
            </Tooltip>
          )}
          <Popconfirm
            title={r.status === 'suspended' ? '¿Activar tenant?' : '¿Suspender tenant por falta de pago?'}
            onConfirm={() => handleTenantStatus(r.id, r.status === 'suspended' ? 'active' : 'suspended')}
            okText="Sí"
          >
            <Button
              size="small"
              danger={r.status !== 'suspended'}
              icon={r.status === 'suspended' ? <PlayCircleOutlined /> : <StopOutlined />}
              title={r.status === 'suspended' ? 'Activar tenant' : 'Suspender tenant'}
            />
          </Popconfirm>
          <Tooltip title={((r as any).settings?.allowedModules?.length ? `Módulos restringidos (${(r as any).settings.allowedModules.length})` : 'Restringir módulos visibles')}>
            <Button size="small" icon={<AppstoreOutlined />}
              style={(r as any).settings?.allowedModules?.length ? { color: '#b45309', borderColor: '#e5c07b' } : undefined}
              onClick={() => { setModTenant(r); setModSel(((r as any).settings?.allowedModules as string[] | undefined) ?? null) }} />
          </Tooltip>
          <Tooltip title={r.status === 'active' ? 'No se puede eliminar un tenant activo (cliente pagando)' : 'Eliminar tenant definitivamente'}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status === 'active'}
              onClick={() => { setTenantAEliminar(r); setConfirmNombre('') }} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  if (!user?.isSuperAdmin) return null

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0a0a0a' }}>
            <GlobalOutlined style={{ marginRight: 10 }} />Platform Admin
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Vista global de todos los tenants y planes</Text>
        </div>
        <Space>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setDemoOpen(true)}
            style={{ background: '#1faec2' }}>
            Enviar demo
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { loadTenants(); loadPlans() }} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </div>

      {/* Modal: módulos permitidos por tenant */}
      <Modal
        title={<Space><AppstoreOutlined />Módulos visibles — {modTenant?.name}</Space>}
        open={!!modTenant}
        onCancel={() => setModTenant(null)}
        onOk={handleGuardarModulos}
        okText="Guardar"
        okButtonProps={{ loading: savingMod, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
        width={460}
      >
        <Radio.Group
          value={modSel === null ? 'todos' : 'custom'}
          onChange={e => setModSel(e.target.value === 'todos' ? null : ((modTenant?.settings?.allowedModules as string[] | undefined) ?? plans.find(p => p.plan === (modTenant?.plan ?? 'basic'))?.modules ?? []))}
          style={{ marginBottom: 12 }}
        >
          <Radio value="todos">Sin restricción (todos los módulos)</Radio>
          <Radio value="custom">Solo los seleccionados</Radio>
        </Radio.Group>
        {modSel !== null && (
          <>
            <div style={{ marginBottom: 8 }}>
              <Button size="small" onClick={() => setModSel(plans.find(p => p.plan === (modTenant?.plan ?? 'basic'))?.modules ?? [])}>
                Usar los del plan ({plans.find(p => p.plan === (modTenant?.plan ?? 'basic'))?.displayName ?? modTenant?.plan})
              </Button>
            </div>
            <Checkbox.Group
              value={modSel}
              onChange={vals => setModSel(vals as string[])}
              options={MODULOS_LUCIA.map(m => ({ value: m.value, label: m.label }))}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}
            />
          </>
        )}
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
          Los módulos no permitidos desaparecen del menú del tenant y sus switches quedan bloqueados con
          "No incluido en tu plan". Por defecto ningún tenant tiene restricción.
        </div>
      </Modal>

      {/* Modal: eliminar tenant definitivamente */}
      <Modal
        title={<Space><DeleteOutlined style={{ color: '#e5484d' }} />Eliminar tenant definitivamente</Space>}
        open={!!tenantAEliminar}
        onCancel={() => { setTenantAEliminar(null); setConfirmNombre('') }}
        onOk={handleEliminarTenant}
        okText="Eliminar definitivamente"
        cancelText="Cancelar"
        okButtonProps={{ danger: true, loading: eliminandoTenant, disabled: confirmNombre.trim() !== ((tenantAEliminar?.name ?? tenantAEliminar?.tenantName ?? '') as string).trim() }}
        width={480}
      >
        <p style={{ marginTop: 8 }}>
          Se borrará <b>todo</b> el tenant <b>{tenantAEliminar?.name ?? tenantAEliminar?.tenantName}</b>: sus empresas,
          datos contables, usuarios (si no pertenecen a otro tenant) y suscripciones. <b>No se puede deshacer.</b>
        </p>
        <p style={{ fontSize: 12, color: '#6b7280' }}>
          Protecciones automáticas: no aplica a tenants activos ni con cobros registrados (clientes convertidos).
        </p>
        <Input
          placeholder={`Escribe "${tenantAEliminar?.name ?? tenantAEliminar?.tenantName ?? ''}" para confirmar`}
          value={confirmNombre}
          onChange={e => setConfirmNombre(e.target.value)}
        />
      </Modal>

      {/* KPIs de control */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarOutlined style={{ color: '#1B3A6B' }} />MRR mensual
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1B3A6B', marginTop: 4 }}>{fmtMoney(mrrTotal)}</div>
            <div style={{ fontSize: 12, color: '#2ea172', marginTop: 2 }}>{activeCount} activa(s){mrrIsReal ? '' : ' · aprox.'}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleOutlined style={{ color: '#2ea172' }} />Tenants activos
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
              {activeCount} <span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}>/ {stats?.totalTenants ?? tenants.length}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Prof. {stats?.byPlan.professional ?? 0} · Ent. {stats?.byPlan.enterprise ?? 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }} style={{ background: trialCount ? '#fff8ec' : undefined, borderColor: trialCount ? '#f5d9a0' : undefined }}>
            <div style={{ fontSize: 13, color: trialCount ? '#b7791f' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockCircleOutlined />En trial
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: trialCount ? '#b7791f' : undefined, marginTop: 4 }}>{trialCount}</div>
            <div style={{ fontSize: 12, color: trialCount ? '#b7791f' : '#6b7280', marginTop: 2 }}>
              {soonestTrial
                ? `${soonestTrial.name} — ${soonestTrial.trialDaysLeft! > 0 ? `vence en ${soonestTrial.trialDaysLeft} días` : 'vencido'}`
                : 'sin trials activos'}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }} style={{ background: suspendedCount ? '#fdecec' : undefined, borderColor: suspendedCount ? '#f3b9b9' : undefined }}>
            <div style={{ fontSize: 13, color: suspendedCount ? '#c0392b' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StopOutlined />Suspendidos
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: suspendedCount ? '#c0392b' : undefined, marginTop: 4 }}>{suspendedCount}</div>
            <div style={{ fontSize: 12, color: suspendedCount ? '#c0392b' : '#2ea172', marginTop: 2 }}>
              {suspendedCount ? 'requieren seguimiento' : 'todo al día'}
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="tenants"
        items={[
          {
            key: 'tenants',
            label: <Space><GlobalOutlined />Tenants ({tenants.length})</Space>,
            children: (
              <Card size="small" extra={<Tag color="#ff7f00">Super Admin</Tag>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Segmented
                    size="small"
                    value={tenantFilter}
                    onChange={val => setTenantFilter(val as typeof tenantFilter)}
                    options={[
                      { label: `Todos (${tenants.length})`,        value: 'all' },
                      { label: `Activos (${activeCount})`,         value: 'active' },
                      { label: `Trial (${trialCount})`,            value: 'trial' },
                      { label: `Suspendidos (${suspendedCount})`,  value: 'suspended' },
                    ]}
                  />
                  <Input
                    allowClear
                    size="small"
                    prefix={<SearchOutlined style={{ color: '#aaa' }} />}
                    placeholder="Buscar empresa, NIT…"
                    value={tenantSearch}
                    onChange={e => setTenantSearch(e.target.value)}
                    style={{ maxWidth: 260, marginLeft: 'auto' }}
                  />
                </div>
                <Table rowKey="id" columns={tenantColumns} dataSource={filteredTenants} loading={loading} size="small" pagination={{ pageSize: 20 }} />
              </Card>
            ),
          },
          {
            key: 'plans',
            label: <Space><CheckCircleOutlined />Planes</Space>,
            children: (
              <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePlan} style={{ background: '#1faec2' }}>
                  Nuevo plan
                </Button>
              </div>
              <Row gutter={16}>
                {plans.map(plan => (
                  <Col span={8} key={plan.plan}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <Tag color={PLAN_COLOR[plan.plan] ?? 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                            {plan.displayName}
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space size={4}>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openEditPlan(plan)}>
                            Editar
                          </Button>
                          <Popconfirm
                            title={`Eliminar plan "${plan.displayName}"?`}
                            description="No se podrá eliminar si está asignado a tenants."
                            okText="Eliminar"
                            cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDeletePlan(plan)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      }
                      style={{ marginBottom: 16 }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <Statistic
                          value={Number(plan.priceMonthly)}
                          prefix={plan.currency === 'GTQ' ? 'Q' : plan.currency === 'EUR' ? '€' : '$'}
                          suffix={`/ mes ${plan.currency}`}
                          valueStyle={{ fontSize: 24, color: '#0a0a0a' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, fontSize: 13 }}>
                        <Space>
                          <BankOutlined style={{ color: '#1faec2' }} />
                          <Text>{plan.maxCompanies >= 999 ? 'Empresas ilimitadas' : `${plan.maxCompanies} empresa${plan.maxCompanies !== 1 ? 's' : ''}`}</Text>
                        </Space>
                        <Space>
                          <TeamOutlined style={{ color: '#6b7280' }} />
                          <Text>{plan.maxUsers >= 999 ? 'Usuarios ilimitados' : `${plan.maxUsers} usuario${plan.maxUsers !== 1 ? 's' : ''}`}</Text>
                        </Space>
                      </div>
                      {/* Matriz de módulos — misma vista que ve el cliente, para administrarla con contexto */}
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, marginBottom: 4 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Módulos incluidos
                        </div>
                        {MODULOS_LUCIA.map(m => {
                          const incluido = (plan.modules ?? []).includes(m.value)
                          return (
                            <div key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '2px 0', opacity: incluido ? 1 : 0.4 }}>
                              {incluido
                                ? <CheckCircleOutlined style={{ color: '#2ea172', flexShrink: 0 }} />
                                : <MinusCircleOutlined style={{ color: '#9ca3af', flexShrink: 0 }} />}
                              <span style={{ color: '#374151' }}>{m.label}</span>
                            </div>
                          )
                        })}
                        {(plan.modules ?? []).length === 0 && (
                          <div style={{ color: '#b45309', fontSize: 11, fontStyle: 'italic' }}>Sin módulos definidos — edítalo con el lápiz</div>
                        )}
                      </div>
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                        {(plan.features || []).length === 0 && (
                          <div style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>Sin características definidas</div>
                        )}
                        {(plan.features || []).map((f, i) =>
                          f.startsWith('###') ? (
                            <div key={i} style={{
                              fontSize: 10.5, fontWeight: 700, color: '#1B3A6B',
                              textTransform: 'uppercase', letterSpacing: 0.6,
                              marginTop: i > 0 ? 12 : 0, marginBottom: 4,
                            }}>
                              {f.replace(/^###\s*/, '')}
                            </div>
                          ) : (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 7,
                              fontSize: 12.5, color: '#374151', padding: '3px 0',
                            }}>
                              <CheckCircleOutlined style={{ color: '#2ea172', marginTop: 2, flexShrink: 0 }} />
                              <span>{f}</span>
                            </div>
                          )
                        )}
                      </div>
                      <div style={{ marginTop: 12, color: '#6b7280', fontSize: 11 }}>
                        {tenants.filter(t => (t.plan ?? 'basic') === plan.plan).length} tenant(s) en este plan
                      </div>
                    </Card>
                  </Col>
                ))}
                {plans.length === 0 && (
                  <Col span={24}>
                    <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                      Cargando planes... (se crean automáticamente en el primer inicio del servidor)
                    </div>
                  </Col>
                )}
              </Row>
              </>
            ),
          },
          {
            key: 'templates',
            label: <Space><StarFilled style={{ color: '#f59e0b' }} />Plantillas onboarding</Space>,
            children: <TemplatesTab />,
          },
          {
            key: 'billing',
            label: <Space><KeyOutlined />Facturación</Space>,
            children: <BillingConfigTab plans={plans} />,
          },
          {
            key: 'soporte',
            label: <SoporteTabLabel />,
            children: <AdminSupportPanel />,
          },
          {
            key: 'demos',
            label: <Space><SendOutlined style={{ color: '#1faec2' }} />Demos</Space>,
            children: <DemosTab />,
          },
        ]}
      />

      {/* Modal detalle tenant */}
      <Modal
        title={<Space><GlobalOutlined />{detail?.name ?? 'Detalle'}</Space>}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetail(null); setDetailBilling(null) }}
        footer={<Button onClick={() => { setDetailOpen(false); setDetail(null); setDetailBilling(null) }}>Cerrar</Button>}
        width={980}
      >
        {detailLoading
          ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          : detail && (
            <>
              {/* Encabezado de control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <Tag color={PLAN_COLOR[detail.plan ?? ''] ?? 'default'}>{detail.plan ?? 'basic'}</Tag>
                <Badge status={STATUS_COLOR[detail.status ?? ''] ?? 'default'} text={detail.status} />
                {detail.taxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT {detail.taxId}</Text>}
                {detail.createdAt && <Text type="secondary" style={{ fontSize: 12 }}>· Creado {new Date(detail.createdAt).toLocaleDateString('es-GT')}</Text>}
                {detail.setup?.completados > 0 && (() => {
                  const inicio = detail.demoSentAt ? new Date(detail.demoSentAt).getTime() : (detail.setup.primeraMarca ? new Date(detail.setup.primeraMarca).getTime() : NaN)
                  const fin = detail.setup.ultimaMarca ? new Date(detail.setup.ultimaMarca).getTime() : NaN
                  const min = !isNaN(inicio) && !isNaN(fin) && fin > inicio ? Math.max(1, Math.round((fin - inicio) / 60000)) : null
                  const dur = min == null ? null : min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
                  return (
                    <Tooltip title={detail.demoSentAt ? 'Desde el envío del correo del demo hasta la última marca de la guía' : 'De la primera a la última marca de la guía'}>
                      <Text type="secondary" style={{ fontSize: 12 }}>· Configuración {detail.setup.completados}/9{dur ? ` · ${dur}` : ''}</Text>
                    </Tooltip>
                  )
                })()}
              </div>

              {/* Tira de métricas */}
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>MRR mensual</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#1B3A6B' }}>
                      {detailBilling?.subscription
                        ? `${detailBilling.subscription.billingCurrency} ${Number(detailBilling.subscription.billingAmountLocal || detailBilling.subscription.monthlyPrice).toFixed(2)}`
                        : detail.status === 'active' ? fmtMoney(tenantMonthly(detail)) : '—'}
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Empresas</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{detail.companies?.length ?? 0}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Usuarios</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{detail.users?.length ?? 0}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{detailBilling?.trialDaysLeft != null ? 'Trial' : 'Próx. cobro'}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: detailBilling?.trialDaysLeft != null ? '#b7791f' : undefined }}>
                      {detailBilling?.trialDaysLeft != null
                        ? `${detailBilling.trialDaysLeft} días`
                        : detailBilling?.subscription?.nextChargeAt
                          ? new Date(detailBilling.subscription.nextChargeAt).toLocaleDateString('es-GT')
                          : '—'}
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Suscripción + cobros recientes */}
              {detailBilling && (
                <Card size="small" style={{ marginBottom: 16 }}
                  title={<Space><DollarOutlined style={{ color: '#2ea172' }} />Cobros recientes</Space>}>
                  {detailBilling.subscription && (
                    <div style={{ marginBottom: 10, fontSize: 12, color: '#374151' }}>
                      Suscripción <b>{detailBilling.subscription.plan}</b> · {detailBilling.subscription.status}
                      {detailBilling.subscription.qpayproCardLast4
                        ? ` · ${detailBilling.subscription.qpayproCardBrand} ••••${detailBilling.subscription.qpayproCardLast4}`
                        : ' · sin tarjeta'}
                    </div>
                  )}
                  <Table<TenantBillingPayment>
                    rowKey="id" size="small" pagination={false}
                    dataSource={(detailBilling.payments ?? []).slice(0, 5)}
                    locale={{ emptyText: 'Sin cobros registrados' }}
                    columns={[
                      { title: 'Fecha', dataIndex: 'chargedAt', width: 100, render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—' },
                      { title: 'Monto', width: 120, render: (_, p) => `${p.currency} ${Number(p.amount).toFixed(2)}` },
                      { title: 'Estado', dataIndex: 'result', width: 90, render: (v: string) => <Tag color={v === 'approved' ? 'success' : v === 'declined' ? 'error' : 'default'}>{v}</Tag> },
                      {
                        title: 'FEL',
                        render: (_, p) => p.felUuid
                          ? <Space size={4}><Tag color="success" style={{ fontSize: 11 }}>{p.felSerie}-{p.felNumero}</Tag>{p.felInvoiceUrl && <Button size="small" href={p.felInvoiceUrl} target="_blank" icon={<FileTextOutlined />} />}</Space>
                          : <Text type="secondary">—</Text>,
                      },
                    ]}
                  />
                </Card>
              )}
              {detail.companies?.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12 }}><BankOutlined style={{ marginRight: 4 }} />Empresas ({detail.companies.length})</Text>
                  <Table<AdminCompany> size="small" rowKey="id" style={{ marginTop: 8, marginBottom: 12 }} pagination={false}
                    dataSource={detail.companies}
                    expandable={{
                      expandedRowRender: (c) => (
                        <div style={{ padding: '8px 16px', background: '#fafbfc' }}>
                          <Text style={{ fontSize: 12, fontWeight: 500 }}>Asignar usuario a {c.legalName}:</Text>
                          <Space style={{ marginTop: 8 }}>
                            <Select
                              size="small" style={{ width: 220 }} placeholder="Seleccionar usuario"
                              value={assigningCompanyId === c.id ? userToAssign : null}
                              onChange={val => { setAssigningCompanyId(c.id); setUserToAssign(val) }}
                              options={detail.users?.map((u: any) => ({
                                value: u.id,
                                label: `${u.firstName} ${u.lastName} (${u.email})`,
                              })) ?? []}
                            />
                            <Button size="small" type="primary" loading={savingAssign && assigningCompanyId === c.id}
                              style={{ background: '#1faec2' }}
                              onClick={() => handleAssignUserToCompany(detail.id, c.id)}>
                              Asignar
                            </Button>
                          </Space>
                        </div>
                      ),
                    }}
                    columns={[
                      {
                        title: 'Empresa',
                        render: (_, c) => (
                          <div>
                            <b>{c.legalName}</b>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{c.companyNumber ?? 'Sin codigo'} · {c.taxId ?? 'Sin tax id'}</div>
                          </div>
                        ),
                      },
                      { title: 'Pais', width: 70, render: (_, c) => <Tag>{c.countryCode}</Tag> },
                      { title: 'Moneda', dataIndex: 'currencyCode', width: 80, render: (v: string) => <Tag>{v}</Tag> },
                      { title: 'Usuarios', dataIndex: 'usersCount', width: 80, align: 'center' as const },
                      { title: 'Estado', dataIndex: 'status', width: 100, render: (v: string) => <Badge status={v === 'active' ? 'success' : 'warning'} text={v} /> },
                      {
                        title: '',
                        width: 90,
                        render: (_, c) => (
                          <Space size={4}>
                            <Tooltip title="Asignar usuario">
                              <Button size="small" icon={<PlusOutlined />}
                                onClick={() => setAssigningCompanyId(assigningCompanyId === c.id ? null : c.id)} />
                            </Tooltip>
                            <Popconfirm
                              title={c.status === 'active' ? '¿Bloquear empresa?' : '¿Activar empresa?'}
                              onConfirm={() => handleCompanyStatus(detail.id, c.id, c.status === 'active' ? 'suspended' : 'active')}
                              okText="Sí"
                            >
                              <Button size="small" danger={c.status === 'active'} icon={c.status === 'active' ? <StopOutlined /> : <PlayCircleOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </>
              )}
              {detail.users?.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12 }}><TeamOutlined style={{ marginRight: 4 }} />Usuarios ({detail.users.length})</Text>
                  <Table<AdminUser> size="small" rowKey="id" style={{ marginTop: 8 }} pagination={false} dataSource={detail.users}
                    columns={[
                      { title: 'Nombre', render: (_, u) => `${u.firstName} ${u.lastName}` },
                      { title: 'Email', dataIndex: 'email' },
                      {
                        title: 'Roles',
                        width: 160,
                        render: (_, u) => u.isSuperAdmin
                          ? <Tag color="#e5484d">SuperAdmin</Tag>
                          : (u.roles?.length ? u.roles.map(r => <Tag key={r}>{r}</Tag>) : <Tag>Usuario</Tag>),
                      },
                      { title: 'Estado', dataIndex: 'status', width: 100, render: (v: string) => <Badge status={v === 'active' ? 'success' : 'warning'} text={v} /> },
                      {
                        title: '',
                        width: 120,
                        render: (_, u) => (
                          <Space size={4}>
                            <Popconfirm
                              title={u.status === 'active' ? '¿Bloquear usuario?' : '¿Activar usuario?'}
                              onConfirm={() => handleUserStatus(detail.id, u.id, u.status === 'active' ? 'suspended' : 'active')}
                              okText="Sí"
                            >
                              <Button size="small" danger={u.status === 'active'} icon={u.status === 'active' ? <StopOutlined /> : <PlayCircleOutlined />} />
                            </Popconfirm>
                            <Button size="small" icon={<KeyOutlined />} onClick={() => handleResetUserPassword(detail.id, u.id, u.email)} />
                            <Popconfirm title="¿Eliminar usuario del tenant?" onConfirm={() => handleRemoveUser(detail.id, u.id)} okText="Eliminar" okButtonProps={{ danger: true }}>
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </>
          )
        }
      </Modal>

      {/* Modal facturación por tenant */}
      <Modal
        title={<Space><DollarOutlined style={{ color: '#2ea172' }} />Facturación — {billingTenant?.name}</Space>}
        open={billingModalOpen}
        onCancel={() => { setBillingModalOpen(false); setBillingTenant(null); setBillingInfo(null) }}
        footer={<Button onClick={() => { setBillingModalOpen(false); setBillingTenant(null); setBillingInfo(null) }}>Cerrar</Button>}
        width={960}
      >
        {billingLoading
          ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          : billingInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Trial */}
              <Card size="small" title={<Space><ClockCircleOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#f59e0b', fontWeight: 600 }}>Trial de uso</span></Space>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                  <Statistic
                    title="Días restantes"
                    value={billingInfo.trialDaysLeft ?? '—'}
                    suffix={billingInfo.trialDaysLeft !== null ? 'días' : ''}
                    valueStyle={{
                      color: billingInfo.trialDaysLeft === null ? '#aaa'
                        : billingInfo.trialDaysLeft <= 7 ? '#e5484d'
                        : billingInfo.trialDaysLeft <= 15 ? '#f59e0b' : '#2ea172',
                      fontSize: 28,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Space>
                      <Button type="primary" loading={trialActivating} onClick={() => handleActivateTrial(30)}
                        style={{ background: '#f59e0b', borderColor: '#f59e0b' }} icon={<PlayCircleOutlined />}>
                        Activar 30 días
                      </Button>
                      <Button loading={trialActivating} onClick={() => handleActivateTrial(15)} icon={<PlayCircleOutlined />}>
                        Extender 15 días
                      </Button>
                      <Button loading={trialActivating} onClick={() => handleActivateTrial(7)}>
                        +7 días
                      </Button>
                    </Space>
                    {billingInfo.trialEndsAt && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Vence: {new Date(billingInfo.trialEndsAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </Text>
                    )}
                  </div>
                </div>
              </Card>

              {/* Precio personalizado */}
              <Card size="small" title={<Space><DollarOutlined style={{ color: '#1faec2' }} /><span style={{ color: '#1faec2', fontWeight: 600 }}>Precio mensual personalizado</span></Space>}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  Precio negociado para este cliente (referencia). Dejar vacío para usar el precio del plan.
                </Text>
                <Space>
                  <InputNumber
                    value={customPrice}
                    onChange={v => setCustomPrice(v)}
                    min={0} step={1} precision={2}
                    prefix={symFor(billingTenant ? tenantCur(billingTenant) : mrrCurrency)}
                    addonAfter={`${billingTenant ? tenantCur(billingTenant) : mrrCurrency}/mes`}
                    style={{ width: 220 }}
                    placeholder={`Precio del plan`}
                  />
                  <Button type="primary" loading={savingPrice} onClick={() => handleSavePrice(customPrice)}
                    style={{ background: '#1faec2' }}>
                    Guardar
                  </Button>
                  {customPrice !== null && (
                    <Button loading={savingPrice} onClick={() => handleSavePrice(null)}>
                      Usar precio del plan
                    </Button>
                  )}
                </Space>
              </Card>

              {/* Suscripción activa */}
              {billingInfo.subscription && (
                <Card size="small" title="Suscripción activa">
                  <Descriptions size="small" column={3}>
                    <Descriptions.Item label="Plan"><Tag color="#1faec2">{billingInfo.subscription.plan}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Estado"><Badge status={billingInfo.subscription.status === 'active' ? 'success' : 'warning'} text={billingInfo.subscription.status} /></Descriptions.Item>
                    <Descriptions.Item label="Monto mensual">
                      {billingInfo.subscription.billingCurrency} {Number(billingInfo.subscription.billingAmountLocal || billingInfo.subscription.monthlyPrice).toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Próximo cobro">
                      {billingInfo.subscription.nextChargeAt ? new Date(billingInfo.subscription.nextChargeAt).toLocaleDateString('es-GT') : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tarjeta">
                      {billingInfo.subscription.qpayproCardLast4
                        ? `${billingInfo.subscription.qpayproCardBrand} ••••${billingInfo.subscription.qpayproCardLast4}`
                        : '—'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* Historial de cobros */}
              <Card size="small" title={<Space><FileTextOutlined />Historial de cobros ({billingInfo.payments.length})</Space>}>
                <Table<TenantBillingPayment>
                  rowKey="id"
                  dataSource={billingInfo.payments}
                  size="small"
                  pagination={{ pageSize: 8, size: 'small' }}
                  locale={{ emptyText: 'Sin pagos registrados' }}
                  columns={[
                    {
                      title: 'Fecha', dataIndex: 'chargedAt', width: 100,
                      render: (v: string) => new Date(v).toLocaleDateString('es-GT'),
                    },
                    { title: 'Plan', dataIndex: 'plan', width: 120 },
                    {
                      title: 'Monto', width: 110,
                      render: (_, p) => `${p.currency} ${Number(p.amount).toFixed(2)}`,
                    },
                    {
                      title: 'Estado', dataIndex: 'result', width: 90,
                      render: (v: string) => (
                        <Tag color={v === 'approved' ? 'success' : v === 'declined' ? 'error' : 'default'}>{v}</Tag>
                      ),
                    },
                    {
                      title: 'No. Trans.', dataIndex: 'qpayproTransactionId', width: 120,
                      render: (v?: string) => v ? <Text code style={{ fontSize: 11 }}>{v.slice(0, 12)}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'FEL', width: 140,
                      render: (_, p) => p.felUuid ? (
                        <Space size={4}>
                          <Tag color="success" style={{ fontSize: 11 }}>{p.felSerie}-{p.felNumero}</Tag>
                          {p.felInvoiceUrl && (
                            <Button size="small" href={p.felInvoiceUrl} target="_blank" icon={<FileTextOutlined />} />
                          )}
                        </Space>
                      ) : p.result === 'approved' ? (
                        <Button
                          size="small" type="primary"
                          style={{ background: '#2ea172', borderColor: '#2ea172', fontSize: 11 }}
                          onClick={() => {
                            setSelectedPaymentId(p.id)
                            felForm.resetFields()
                            setFelModalOpen(true)
                          }}
                        >
                          Emitir FEL
                        </Button>
                      ) : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Comprobante', width: 110,
                      render: (_, p) => p.result === 'approved' ? (
                        <Button
                          size="small" icon={<PrinterOutlined />}
                          onClick={() => navigate(`/admin/comprobante-pago/${p.id}`)}
                          style={{ color: '#1B3A6B', borderColor: '#1B3A6B', fontSize: 11 }}
                        >
                          Ver
                        </Button>
                      ) : <Text type="secondary">—</Text>,
                    },
                  ]}
                />
              </Card>
            </div>
          )
        }
      </Modal>

      {/* Modal emitir FEL */}
      <Modal
        title={<Space><FileTextOutlined style={{ color: '#2ea172' }} />Emitir Factura Electrónica (FEL)</Space>}
        open={felModalOpen}
        onCancel={() => { setFelModalOpen(false); felForm.resetFields() }}
        onOk={() => felForm.submit()}
        confirmLoading={emittingFel}
        okText="Emitir FEL"
        okButtonProps={{ style: { background: '#2ea172' } }}
        width={520}
      >
        <Form form={felForm} layout="vertical" onFinish={handleEmitFel} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="customerTaxId" label="NIT del receptor" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="1234567-8 o CF" />
            </Form.Item>
            <Form.Item name="currency" label="Moneda" initialValue="GTQ">
              <Select options={[
                { value: 'GTQ', label: 'GTQ — Quetzales' },
                { value: 'USD', label: 'USD — Dólares' },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="customerName" label="Nombre del receptor" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="EMPRESA S.A." />
          </Form.Item>
          <Form.Item name="customerEmail" label="Email (opcional — se envía copia de FEL)" style={{ marginBottom: 0 }}>
            <Input placeholder="facturacion@empresa.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal crear / editar plan */}
      <Modal
        title={<Space>{planMode === 'create' ? <PlusOutlined /> : <EditOutlined />}{planMode === 'create' ? 'Nuevo plan' : `Editar plan — ${editingPlan?.displayName}`}</Space>}
        open={planModalOpen}
        onCancel={() => setPlanModalOpen(false)}
        onOk={handleSavePlan}
        confirmLoading={savingPlan}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={480}
      >
        <Form form={planForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            {planMode === 'create' && (
              <Form.Item name="plan" label="Código" rules={[{ required: true }]}>
                <Input placeholder="starter" />
              </Form.Item>
            )}
            <Form.Item name="displayName" label="Nombre del plan" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="currency" label="Moneda">
              <Select options={[{ value: 'USD', label: 'USD' }, { value: 'GTQ', label: 'GTQ' }, { value: 'EUR', label: 'EUR' }]} />
            </Form.Item>
            <Form.Item name="priceMonthly" label="Precio mensual" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix={simboloMoneda} addonAfter={planCurrency || 'USD'} />
            </Form.Item>
            <Form.Item name="maxCompanies" label="Máx. empresas" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxUsers" label="Máx. usuarios" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxBranches" label="Máx. sucursales" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="modules" label="Módulos de Lucía incluidos en el plan">
            <Select mode="multiple" placeholder="Selecciona los módulos"
              options={MODULOS_LUCIA.map(m => ({ value: m.value, label: m.label }))} />
          </Form.Item>
          <Form.Item
            name="featuresText"
            label="Características (una por línea — usa ### para secciones)"
            extra={<span style={{ fontSize: 11, color: '#9ca3af' }}>Ej: <code>### Facturación</code> crea un encabezado de sección</span>}
          >
            <Input.TextArea
              rows={12}
              placeholder={"### Facturación\nGestión hasta 5,000 facturas\nFacturación recurrente\n\n### Usuarios\nInvitar 3 usuarios\nSoporte email"}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Enviar demo a un prospecto */}
      <EnviarDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} onSent={loadTenants} />
    </div>
  )
}
