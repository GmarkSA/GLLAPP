import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Badge, Space, Typography, Statistic, Row, Col, Button, message,
} from 'antd'
import {
  BankOutlined, TeamOutlined, GlobalOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

const unwrap = (r: any) => r.data?.data ?? r.data

interface TenantSummary {
  id: string
  name: string
  legalName?: string
  taxId?: string
  plan?: string
  status?: string
  companiesCount?: number
  usersCount?: number
  createdAt?: string
}

export default function PlatformAdminPage() {
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [tenants, setTenants]   = useState<TenantSummary[]>([])
  const [loading, setLoading]   = useState(false)

  // Solo SuperAdmin puede ver esta página
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/dashboard')
      message.warning('Acceso restringido a Super Admin')
    }
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/tenants').then(unwrap).catch(() => [])
      setTenants(Array.isArray(data) ? data : [])
    } catch {
      // endpoint puede no existir aún — mostrar vacío
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalCompanies = tenants.reduce((s, t) => s + (t.companiesCount ?? 0), 0)
  const totalUsers     = tenants.reduce((s, t) => s + (t.usersCount ?? 0), 0)

  const columns: ColumnsType<TenantSummary> = [
    {
      title: 'Tenant / Organización',
      dataIndex: 'name',
      render: (v: string, r: TenantSummary) => (
        <div>
          <b>{v}</b>
          {r.legalName && r.legalName !== v && (
            <div style={{ fontSize: 11, color: '#888' }}>{r.legalName}</div>
          )}
        </div>
      ),
    },
    {
      title: 'NIT / Tax ID',
      dataIndex: 'taxId',
      width: 140,
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 100,
      render: (v?: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>Free</Tag>,
    },
    {
      title: 'Empresas',
      dataIndex: 'companiesCount',
      width: 90,
      render: (v?: number) => v ?? 0,
    },
    {
      title: 'Usuarios',
      dataIndex: 'usersCount',
      width: 90,
      render: (v?: number) => v ?? 0,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 100,
      render: (v?: string) => (
        <Badge
          status={v === 'active' ? 'success' : 'default'}
          text={v === 'active' ? 'Activo' : (v ?? 'Activo')}
        />
      ),
    },
    {
      title: 'Creado',
      dataIndex: 'createdAt',
      width: 120,
      render: (v?: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
    },
  ]

  if (!user?.isSuperAdmin) return null

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#1B3A6B' }}>
            <GlobalOutlined style={{ marginRight: 10 }} />
            Platform Admin — GLL ERP
          </Title>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
            Vista global de todos los tenants y empresas
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Tenants activos"
              value={tenants.length}
              prefix={<GlobalOutlined style={{ color: '#1B3A6B' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total empresas"
              value={totalCompanies}
              prefix={<BankOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total usuarios"
              value={totalUsers}
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Lista de tenants */}
      <Card
        title={<Space><GlobalOutlined />Tenants</Space>}
        size="small"
        extra={<Tag color="orange">Super Admin</Tag>}
      >
        {tenants.length === 0 && !loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
            <p>No hay datos disponibles. El endpoint <code>GET /admin/tenants</code> puede no estar implementado aún.</p>
            <p style={{ fontSize: 12 }}>Este módulo estará completo en Sprint 5.</p>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={tenants}
            loading={loading}
            size="small"
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>
    </div>
  )
}
