import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Badge, Space, Typography, Statistic, Row, Col,
  Button, message, Modal, Descriptions, Spin, Popconfirm, Tabs,
  Form, InputNumber, Input, Select,
} from 'antd'
import {
  BankOutlined, TeamOutlined, GlobalOutlined, ReloadOutlined,
  EyeOutlined, RocketOutlined, EditOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography
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
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm] = Form.useForm()

  // Assign plan to tenant
  const [assigningTenantId, setAssigningTenantId] = useState<string | null>(null)

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

  const openEditPlan = (plan: PlanConfig) => {
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

  const handleSavePlan = async () => {
    const vals = await planForm.validateFields()
    if (!editingPlan) return
    setSavingPlan(true)
    try {
      const dto = {
        ...vals,
        features: (vals.featuresText || '').split('\n').map((f: string) => f.trim()).filter(Boolean),
      }
      delete dto.featuresText
      await api.patch(`/admin/plans/${editingPlan.plan}`, dto)
      message.success(`Plan "${editingPlan.displayName}" actualizado`)
      setPlanModalOpen(false)
      loadPlans()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar plan')
    } finally { setSavingPlan(false) }
  }

  const totalCompanies = tenants.reduce((s, t) => s + (t.companiesCount ?? 0), 0)
  const totalUsers     = tenants.reduce((s, t) => s + (t.usersCount ?? 0), 0)

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
          options={[
            { value: 'basic',        label: <Tag>Basic</Tag> },
            { value: 'professional', label: <Tag color="blue">Professional</Tag> },
            { value: 'enterprise',   label: <Tag color="gold">Enterprise</Tag> },
          ]}
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
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditPlan(plan)}>
                          Editar
                        </Button>
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
            ),
          },
        ]}
      />

      {/* Modal detalle tenant */}
      <Modal
        title={<Space><GlobalOutlined />{detail?.name ?? 'Detalle'}</Space>}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetail(null) }}
        footer={<Button onClick={() => { setDetailOpen(false); setDetail(null) }}>Cerrar</Button>}
        width={640}
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
                  <Table size="small" rowKey="id" style={{ marginTop: 8, marginBottom: 12 }} pagination={false} dataSource={detail.companies}
                    columns={[
                      { title: 'Empresa', dataIndex: 'legalName' },
                      { title: 'País', dataIndex: 'countryCode', width: 60 },
                      { title: 'Estado', dataIndex: 'status', width: 90, render: (v: string) => <Badge status={v === 'active' ? 'success' : 'default'} text={v} /> },
                    ]}
                  />
                </>
              )}
              {detail.users?.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12 }}><TeamOutlined style={{ marginRight: 4 }} />Usuarios ({detail.users.length})</Text>
                  <Table size="small" rowKey="id" style={{ marginTop: 8 }} pagination={false} dataSource={detail.users}
                    columns={[
                      { title: 'Nombre', render: (_: any, u: any) => `${u.firstName} ${u.lastName}` },
                      { title: 'Email', dataIndex: 'email' },
                      { title: 'Rol', width: 100, render: (_: any, u: any) => u.isSuperAdmin ? <Tag color="red">SuperAdmin</Tag> : <Tag>Usuario</Tag> },
                    ]}
                  />
                </>
              )}
            </>
          )
        }
      </Modal>

      {/* Modal editar plan */}
      <Modal
        title={<Space><EditOutlined />Editar plan — {editingPlan?.displayName}</Space>}
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
