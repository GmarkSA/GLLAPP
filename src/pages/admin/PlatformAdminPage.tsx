import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Badge, Space, Typography, Statistic, Row, Col,
  Button, message, Modal, Descriptions, Spin, Popconfirm, Tabs,
  Form, InputNumber, Input, Select, Tooltip,
} from 'antd'
import {
  BankOutlined, TeamOutlined, GlobalOutlined, ReloadOutlined,
  EyeOutlined, RocketOutlined, EditOutlined, CheckCircleOutlined,
  PlusOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, KeyOutlined,
  StarFilled, StarOutlined, DollarOutlined, ClockCircleOutlined, FileTextOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
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

const { Title, Text } = Typography

// ── BillingConfigTab ──────────────────────────────────────────────────────────
// Componente separado para evitar que el estado del InputNumber se pierda
// cuando el padre re-renderiza y recrea el array items de <Tabs>.

function BillingConfigTab({ plans }: { plans: PlanConfig[] }) {
  const [rate, setRate]       = useState<number>(7.70)
  const [info, setInfo]       = useState<{ updatedAt?: string; updatedBy?: string }>({})
  const [saving, setSaving]   = useState(false)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    getGtqExchangeRate()
      .then(r => { setRate(r.rate); setInfo({ updatedAt: r.updatedAt, updatedBy: r.updatedBy }); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

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
    </Row>
  )
}
const unwrap = (r: any) => r.data?.data ?? r.data

const PLAN_COLOR: Record<string, string> = {
  basic: 'default', professional: '#1faec2', enterprise: 'gold',
}
const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', trial: 'default', suspended: 'warning', cancelled: 'error',
}

interface TenantSummary {
  id: string; name: string; legalName?: string; taxId?: string
  plan?: string; status?: string; companiesCount?: number
  usersCount?: number; createdAt?: string; trialEndsAt?: string
  trialDaysLeft?: number; customMonthlyPriceUSD?: number
}
interface PlatformStats {
  totalTenants: number; active: number; trial: number; suspended: number
  byPlan: { basic: number; professional: number; enterprise: number }
}
interface PlanConfig {
  plan: string; displayName: string; priceMonthly: number; currency: string
  maxCompanies: number; maxUsers: number; maxBranches: number
  features: string[]; isActive: boolean
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
  const [detailOpen, setDetailOpen]   = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [seeding, setSeeding]   = useState(false)

  // Plan edit
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null)
  const [planMode, setPlanMode] = useState<'create' | 'edit'>('edit')
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm] = Form.useForm()

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
    setDetailOpen(true); setDetailLoading(true); setDetail(null)
    try {
      const d = await api.get(`/admin/tenants/${id}`).then(unwrap)
      setDetail(d)
    } catch { message.error('Error al cargar detalle') }
    finally { setDetailLoading(false) }
  }

  const handleSeedCastillo = async (tenantId: string) => {
    setSeeding(true)
    try {
      const r = await api.post(`/admin/tenants/${tenantId}/seed-castillo`).then(unwrap)
      message.success(`Grupo Castillo: ${r.created?.length ?? 0} creadas, ${r.skipped?.length ?? 0} ya existían`)
      loadTenants()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error en seed Castillo')
    } finally { setSeeding(false) }
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
    { title: 'Usuarios', dataIndex: 'usersCount', width: 80, align: 'center' as const, render: (v?: number) => v ?? 0 },
    {
      title: '', width: 175,
      render: (_, r) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            icon={<EyeOutlined />}
            loading={impersonating === r.id}
            onClick={() => handleImpersonate(r)}
            style={{ background: '#1B3A6B' }}
            title="Acceder como este tenant"
          >
            Acceder
          </Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} title="Ver detalle" />
          <Tooltip title="Facturación y trial">
            <Button
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openBillingModal(r)}
              style={{ color: '#2ea172', borderColor: '#2ea172' }}
              title="Facturación y trial"
            />
          </Tooltip>
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
          <Popconfirm title="¿Crear Grupo Castillo (5 empresas) en este tenant?" onConfirm={() => handleSeedCastillo(r.id)} okText="Sí">
            <Button size="small" icon={<RocketOutlined />} loading={seeding} title="Seed demo" />
          </Popconfirm>
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
        <Button icon={<ReloadOutlined />} onClick={() => { loadTenants(); loadPlans() }} loading={loading}>
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { title: 'Tenants', value: stats?.totalTenants ?? tenants.length, icon: <GlobalOutlined style={{ color: '#1faec2' }} /> },
          { title: 'Activos', value: stats?.active ?? 0, icon: <Badge status="success" />, color: '#2ea172' },
          { title: 'Total Empresas', value: totalCompanies, icon: <BankOutlined style={{ color: '#1faec2' }} /> },
          { title: 'Total Usuarios', value: totalUsers, icon: <TeamOutlined style={{ color: '#6b7280' }} /> },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card size="small">
              <Statistic title={s.title} value={s.value} prefix={s.icon} valueStyle={s.color ? { color: s.color } : undefined} />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs
        defaultActiveKey="tenants"
        items={[
          {
            key: 'tenants',
            label: <Space><GlobalOutlined />Tenants ({tenants.length})</Space>,
            children: (
              <Card size="small" extra={<Tag color="#ff7f00">Super Admin</Tag>}>
                {stats && (
                  <div style={{ marginBottom: 12 }}>
                    <Space size={8} wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>Por plan:</Text>
                      <Tag>Basic: {stats.byPlan.basic}</Tag>
                      <Tag color="#1faec2">Professional: {stats.byPlan.professional}</Tag>
                      <Tag color="gold">Enterprise: {stats.byPlan.enterprise}</Tag>
                      <Tag color="#ff7f00">Trial: {stats.trial}</Tag>
                      <Tag color="#e5484d">Suspendidos: {stats.suspended}</Tag>
                    </Space>
                  </div>
                )}
                <Table rowKey="id" columns={tenantColumns} dataSource={tenants} loading={loading} size="small" pagination={{ pageSize: 20 }} />
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
                          prefix="$"
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
        ]}
      />

      {/* Modal detalle tenant */}
      <Modal
        title={<Space><GlobalOutlined />{detail?.name ?? 'Detalle'}</Space>}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetail(null) }}
        footer={<Button onClick={() => { setDetailOpen(false); setDetail(null) }}>Cerrar</Button>}
        width={980}
      >
        {detailLoading
          ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          : detail && (
            <>
              <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Plan">
                  <Tag color={PLAN_COLOR[detail.plan ?? ''] ?? 'default'}>{detail.plan ?? 'basic'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Estado">
                  <Badge status={STATUS_COLOR[detail.status ?? ''] ?? 'default'} text={detail.status} />
                </Descriptions.Item>
                <Descriptions.Item label="NIT">{detail.taxId ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Creado">{detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('es-GT') : '—'}</Descriptions.Item>
              </Descriptions>
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
                  Precio negociado para este cliente. Reemplaza el precio del plan. Dejar vacío para usar precio del plan.
                </Text>
                <Space>
                  <InputNumber
                    value={customPrice}
                    onChange={v => setCustomPrice(v)}
                    min={0} step={1} precision={2}
                    prefix="$" addonAfter="USD/mes"
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
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="$" />
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
    </div>
  )
}
