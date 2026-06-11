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
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { getGtqExchangeRate, setGtqExchangeRate } from '../../api/billing'

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
              <GlobalOutlined style={{ color: '#1B3A6B' }} />
              <span style={{ color: '#1B3A6B', fontWeight: 600 }}>
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
            style={{ background: '#1B3A6B', width: '100%' }}
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
              <CheckCircleOutlined style={{ color: '#16a34a' }} />
              <span style={{ color: '#1B3A6B', fontWeight: 600 }}>Vista previa en GTQ</span>
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
              padding: '10px 0', borderBottom: '1px solid #f0f0f0',
            }}>
              <Tag color={Number(plan.priceMonthly) === 0 ? 'default' : plan.plan === 'enterprise' ? 'gold' : 'blue'}>
                {plan.displayName}
              </Tag>
              {Number(plan.priceMonthly) === 0 ? (
                <Tag color="success">Gratis</Tag>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>
                    Q {(Number(plan.priceMonthly) * rate).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
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
  basic: 'default', professional: 'blue', enterprise: 'gold',
}
const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', trial: 'default', suspended: 'warning', cancelled: 'error',
}

interface TenantSummary {
  id: string; name: string; legalName?: string; taxId?: string
  plan?: string; status?: string; companiesCount?: number
  usersCount?: number; createdAt?: string; trialEndsAt?: string
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

  // Assign user to company (Platform Admin direct flow)
  const [assigningCompanyId, setAssigningCompanyId] = useState<string | null>(null) // companyId being assigned
  const [userToAssign, setUserToAssign]             = useState<string | null>(null)
  const [savingAssign, setSavingAssign]             = useState(false)


  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/dashboard')
      message.warning('Acceso restringido a Super Admin')
    }
  }, [user, navigate])

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
          {r.legalName && r.legalName !== r.name && <div style={{ fontSize: 11, color: '#888' }}>{r.legalName}</div>}
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
      dataIndex: 'status', width: 110,
      render: (v?: string) => <Badge status={STATUS_COLOR[v ?? ''] ?? 'default'} text={v ?? '—'} />,
    },
    { title: 'Empresas', dataIndex: 'companiesCount', width: 80, align: 'center' as const, render: (v?: number) => v ?? 0 },
    { title: 'Usuarios', dataIndex: 'usersCount', width: 80, align: 'center' as const, render: (v?: number) => v ?? 0 },
    {
      title: '', width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
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
          <Title level={3} style={{ margin: 0, color: '#1B3A6B' }}>
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
          { title: 'Tenants', value: stats?.totalTenants ?? tenants.length, icon: <GlobalOutlined style={{ color: '#1B3A6B' }} /> },
          { title: 'Activos', value: stats?.active ?? 0, icon: <Badge status="success" />, color: '#52c41a' },
          { title: 'Total Empresas', value: totalCompanies, icon: <BankOutlined style={{ color: '#1677ff' }} /> },
          { title: 'Total Usuarios', value: totalUsers, icon: <TeamOutlined style={{ color: '#722ed1' }} /> },
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
              <Card size="small" extra={<Tag color="orange">Super Admin</Tag>}>
                {stats && (
                  <div style={{ marginBottom: 12 }}>
                    <Space size={8} wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>Por plan:</Text>
                      <Tag>Basic: {stats.byPlan.basic}</Tag>
                      <Tag color="blue">Professional: {stats.byPlan.professional}</Tag>
                      <Tag color="gold">Enterprise: {stats.byPlan.enterprise}</Tag>
                      <Tag color="orange">Trial: {stats.trial}</Tag>
                      <Tag color="red">Suspendidos: {stats.suspended}</Tag>
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
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePlan} style={{ background: '#1B3A6B' }}>
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
                          valueStyle={{ fontSize: 24, color: '#1B3A6B' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, fontSize: 13 }}>
                        <Space>
                          <BankOutlined style={{ color: '#1677ff' }} />
                          <Text>{plan.maxCompanies >= 999 ? 'Empresas ilimitadas' : `${plan.maxCompanies} empresa${plan.maxCompanies !== 1 ? 's' : ''}`}</Text>
                        </Space>
                        <Space>
                          <TeamOutlined style={{ color: '#722ed1' }} />
                          <Text>{plan.maxUsers >= 999 ? 'Usuarios ilimitados' : `${plan.maxUsers} usuario${plan.maxUsers !== 1 ? 's' : ''}`}</Text>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(plan.features || []).map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#555' }}>
                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />{f}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, color: '#888', fontSize: 11 }}>
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
                        <div style={{ padding: '8px 16px', background: '#fafafa' }}>
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
                              style={{ background: '#1B3A6B' }}
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
                            <div style={{ fontSize: 11, color: '#888' }}>{c.companyNumber ?? 'Sin codigo'} · {c.taxId ?? 'Sin tax id'}</div>
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
                          ? <Tag color="red">SuperAdmin</Tag>
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

      {/* Modal crear / editar plan */}
      <Modal
        title={<Space>{planMode === 'create' ? <PlusOutlined /> : <EditOutlined />}{planMode === 'create' ? 'Nuevo plan' : `Editar plan — ${editingPlan?.displayName}`}</Space>}
        open={planModalOpen}
        onCancel={() => setPlanModalOpen(false)}
        onOk={handleSavePlan}
        confirmLoading={savingPlan}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
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
          <Form.Item name="featuresText" label="Características (una por línea)">
            <Input.TextArea rows={5} placeholder="1 empresa&#10;5 usuarios&#10;Soporte email" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
