import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Badge, Space, Typography, Statistic, Row, Col,
  Button, message, Modal, Descriptions, Spin, Popconfirm,
} from 'antd'
import {
  BankOutlined, TeamOutlined, GlobalOutlined, ReloadOutlined,
  EyeOutlined, RocketOutlined,
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

export default function PlatformAdminPage() {
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()

  const [tenants, setTenants]   = useState<TenantSummary[]>([])
  const [stats, setStats]       = useState<PlatformStats | null>(null)
  const [loading, setLoading]   = useState(false)
  const [detail, setDetail]     = useState<any | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [seeding, setSeeding]   = useState(false)

  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/dashboard')
      message.warning('Acceso restringido a Super Admin')
    }
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        api.get('/admin/tenants').then(unwrap).catch(() => []),
        api.get('/admin/stats').then(unwrap).catch(() => null),
      ])
      setTenants(Array.isArray(t) ? t : [])
      setStats(s ?? null)
    } catch {
      message.error('Error al cargar datos de plataforma')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
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
      message.success(`Grupo Castillo: ${r.created?.length ?? 0} empresas creadas, ${r.skipped?.length ?? 0} ya existían`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error en seed Castillo')
    } finally { setSeeding(false) }
  }

  const totalCompanies = stats
    ? tenants.reduce((s, t) => s + (t.companiesCount ?? 0), 0)
    : tenants.reduce((s, t) => s + (t.companiesCount ?? 0), 0)

  const totalUsers = tenants.reduce((s, t) => s + (t.usersCount ?? 0), 0)

  const columns: ColumnsType<TenantSummary> = [
    {
      title: 'Tenant / Organización',
      render: (_, r) => (
        <div>
          <b style={{ fontSize: 13 }}>{r.name}</b>
          {r.legalName && r.legalName !== r.name && (
            <div style={{ fontSize: 11, color: '#888' }}>{r.legalName}</div>
          )}
          {r.taxId && <div style={{ fontSize: 11, color: '#aaa' }}>NIT: {r.taxId}</div>}
        </div>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 110,
      render: (v?: string) => (
        <Tag color={PLAN_COLOR[v ?? ''] ?? 'default'} style={{ textTransform: 'capitalize' }}>
          {v ?? 'basic'}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (v?: string) => (
        <Badge status={STATUS_COLOR[v ?? ''] ?? 'default'} text={v ?? '—'} />
      ),
    },
    {
      title: 'Empresas',
      dataIndex: 'companiesCount',
      width: 90,
      align: 'center' as const,
      render: (v?: number) => <Tag>{v ?? 0}</Tag>,
    },
    {
      title: 'Usuarios',
      dataIndex: 'usersCount',
      width: 90,
      align: 'center' as const,
      render: (v?: number) => <Tag color="blue">{v ?? 0}</Tag>,
    },
    {
      title: 'Creado',
      dataIndex: 'createdAt',
      width: 110,
      render: (v?: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
    },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>
            Ver
          </Button>
          <Popconfirm
            title="¿Crear las 5 empresas del Grupo Castillo en este tenant?"
            onConfirm={() => handleSeedCastillo(r.id)}
            okText="Sí, crear"
          >
            <Button size="small" icon={<RocketOutlined />} loading={seeding} title="Seed Grupo Castillo" />
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
            <GlobalOutlined style={{ marginRight: 10 }} />
            Platform Admin
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Vista global de todos los tenants</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tenants" value={stats?.totalTenants ?? tenants.length}
              prefix={<GlobalOutlined style={{ color: '#1B3A6B' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Activos" value={stats?.active ?? tenants.filter(t => t.status === 'active').length}
              prefix={<Badge status="success" />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Total Empresas" value={totalCompanies}
              prefix={<BankOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Total Usuarios" value={totalUsers}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
      </Row>

      {/* Distribución por plan */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>Por plan:</Text>
            <Tag>Basic: {stats.byPlan.basic}</Tag>
            <Tag color="blue">Professional: {stats.byPlan.professional}</Tag>
            <Tag color="gold">Enterprise: {stats.byPlan.enterprise}</Tag>
            <Tag color="orange">Trial: {stats.trial}</Tag>
            <Tag color="red">Suspendidos: {stats.suspended}</Tag>
          </Space>
        </Card>
      )}

      {/* Tabla tenants */}
      <Card title={<Space><GlobalOutlined />Tenants</Space>} size="small"
        extra={<Tag color="orange">Super Admin</Tag>}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tenants}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: loading ? 'Cargando...' : 'Sin datos' }}
        />
      </Card>

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
                <Descriptions.Item label="ID">{detail.id?.slice(0, 8)}…</Descriptions.Item>
                <Descriptions.Item label="Plan">
                  <Tag color={PLAN_COLOR[detail.plan ?? ''] ?? 'default'}>{detail.plan ?? 'basic'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Estado">
                  <Badge status={STATUS_COLOR[detail.status ?? ''] ?? 'default'} text={detail.status} />
                </Descriptions.Item>
                <Descriptions.Item label="NIT">{detail.taxId ?? '—'}</Descriptions.Item>
                {detail.trialEndsAt && (
                  <Descriptions.Item label="Trial vence" span={2}>
                    {new Date(detail.trialEndsAt).toLocaleDateString('es-GT')}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {detail.companies?.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12, color: '#1B3A6B' }}>
                    <BankOutlined style={{ marginRight: 4 }} />Empresas ({detail.companies.length})
                  </Text>
                  <Table
                    size="small"
                    rowKey="id"
                    style={{ marginTop: 8, marginBottom: 16 }}
                    pagination={false}
                    dataSource={detail.companies}
                    columns={[
                      { title: 'Empresa', dataIndex: 'legalName' },
                      { title: 'País', dataIndex: 'countryCode', width: 60 },
                      { title: 'Moneda', dataIndex: 'currencyCode', width: 80 },
                      {
                        title: 'Estado', dataIndex: 'status', width: 90,
                        render: (v: string) => <Badge status={v === 'active' ? 'success' : 'default'} text={v} />,
                      },
                    ]}
                  />
                </>
              )}

              {detail.users?.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12, color: '#1B3A6B' }}>
                    <TeamOutlined style={{ marginRight: 4 }} />Usuarios ({detail.users.length})
                  </Text>
                  <Table
                    size="small"
                    rowKey="id"
                    style={{ marginTop: 8 }}
                    pagination={false}
                    dataSource={detail.users}
                    columns={[
                      {
                        title: 'Usuario',
                        render: (_: any, u: any) => `${u.firstName} ${u.lastName}`,
                      },
                      { title: 'Email', dataIndex: 'email' },
                      {
                        title: 'Rol', width: 100,
                        render: (_: any, u: any) => u.isSuperAdmin
                          ? <Tag color="red">SuperAdmin</Tag>
                          : <Tag>Usuario</Tag>,
                      },
                    ]}
                  />
                </>
              )}
            </>
          )
        }
      </Modal>
    </div>
  )
}
