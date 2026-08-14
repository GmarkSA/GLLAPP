import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Table, Tag, Tooltip, Button, Select, Drawer, Descriptions, Spin, message, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  EyeOutlined, LoginOutlined, PauseCircleOutlined, PlayCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import api from '../../api/axios'
import type { AdminOutletCtx } from './AdminLayout'

const unwrap = (r: any) => r.data?.data ?? r.data
const CELESTE = '#5ba4cf'

interface TenantSummary {
  id: string; name: string; legalName?: string; taxId?: string; email?: string
  plan?: string; status?: string; companiesCount?: number
  usersCount?: number; maxUsers?: number; createdAt?: string; trialEndsAt?: string
  trialDaysLeft?: number; customMonthlyPriceUSD?: number
}
interface PlanConfig { plan: string; displayName: string; priceMonthly: number; currency: string; maxUsers: number }

// ── Estado → pill ─────────────────────────────────────────────────────────────
const ESTADO: Record<string, { label: string; color: string; dot: string }> = {
  active:          { label: 'Activo',       color: 'green',  dot: '●' },
  trial:           { label: 'Trial',        color: 'gold',   dot: '◔' },
  suspended:       { label: 'Solo lectura', color: 'red',    dot: '⊘' },
  solo_lectura:    { label: 'Solo lectura', color: 'red',    dot: '⊘' },
  cancelled:       { label: 'Cancelado',    color: 'default',dot: '' },
  cancelada:       { label: 'Cancelado',    color: 'default',dot: '' },
  procesando_pago: { label: 'Procesando',   color: 'blue',   dot: '⟳' },
}

const TABS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'active',      label: 'Activos' },
  { key: 'trial',       label: 'Trial' },
  { key: 'suspended',   label: 'Solo lectura' },
  { key: 'cancelled',   label: 'Cancelados' },
]

const money = (n: number, cur = 'GTQ') => `${cur === 'GTQ' ? 'Q' : '$'} ${Number(n).toLocaleString('es-GT')}`

export default function AdminTenantsPage() {
  const navigate = useNavigate()
  const { search } = useOutletContext<AdminOutletCtx>()

  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [plans, setPlans]     = useState<PlanConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('todos')
  const [planFilter, setPlanFilter] = useState<string | undefined>()

  const [detalle, setDetalle] = useState<any | null>(null)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleLoading, setDetalleLoading] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([
      api.get('/admin/tenants').then(unwrap).catch(() => []),
      api.get('/admin/plans').then(unwrap).catch(() => []),
    ]).then(([t, p]) => {
      setTenants(Array.isArray(t) ? t : [])
      setPlans(Array.isArray(p) ? p : [])
    }).finally(() => setLoading(false))
  }
  useEffect(cargar, [])

  const planDe = (code?: string) => plans.find(p => p.plan === code)
  const mrrDe = (t: TenantSummary) => Number(t.customMonthlyPriceUSD ?? planDe(t.plan)?.priceMonthly ?? 0)

  // ── KPIs ──
  const kpis = useMemo(() => {
    const activos = tenants.filter(t => t.status === 'active')
    const trials  = tenants.filter(t => t.status === 'trial')
    const mrr = activos.reduce((s, t) => s + mrrDe(t), 0)
    const trialsPorVencer = trials.filter(t => (t.trialDaysLeft ?? 99) <= 7).length
    return { activos: activos.length, mrr, trials: trials.length, trialsPorVencer, errores: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, plans])

  // ── filtro ──
  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tenants.filter(t => {
      if (tab !== 'todos' && t.status !== tab) return false
      if (planFilter && t.plan !== planFilter) return false
      if (q) {
        const hay = `${t.name} ${t.legalName ?? ''} ${t.email ?? ''} ${t.taxId ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tenants, tab, planFilter, search])

  const contarTab = (key: string) => key === 'todos' ? tenants.length : tenants.filter(t => t.status === key).length

  // ── acciones ──
  const impersonar = async (t: TenantSummary) => {
    try {
      const res: any = await api.post(`/admin/tenants/${t.id}/impersonate`).then(unwrap)
      sessionStorage.setItem('impersonationToken', res.impersonationToken)
      sessionStorage.setItem('impersonationTenantId', res.tenantId)
      sessionStorage.setItem('impersonationTenantName', res.tenantName)
      sessionStorage.removeItem('activeCompanyId')
      window.location.href = '/dashboard'
    } catch { message.error('No se pudo impersonar') }
  }
  const cambiarEstado = async (t: TenantSummary, status: string) => {
    try {
      await api.patch(`/admin/tenants/${t.id}/status`, { status })
      message.success('Estado actualizado')
      cargar()
    } catch { message.error('No se pudo cambiar el estado') }
  }
  const extenderTrial = async (t: TenantSummary) => {
    try {
      await api.post(`/admin/tenants/${t.id}/trial`, { days: 15 })
      message.success('Trial extendido 15 días')
      cargar()
    } catch { message.error('No se pudo extender el trial') }
  }
  const verDetalle = async (t: TenantSummary) => {
    setDetalleOpen(true); setDetalleLoading(true); setDetalle(null)
    try {
      const d = await api.get(`/admin/tenants/${t.id}`).then(unwrap)
      setDetalle({ ...d, _summary: t })
    } catch { message.error('No se pudo cargar el detalle') }
    finally { setDetalleLoading(false) }
  }

  const columns: ColumnsType<TenantSummary> = [
    {
      title: 'Empresa / Tenant', key: 'name',
      render: (_, t) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div style={{ fontSize: 11, color: '#8b8d97' }}>{t.email ?? t.legalName ?? '—'}{t.taxId ? ` · NIT ${t.taxId}` : ''}</div>
        </div>
      ),
    },
    {
      title: 'Plan', dataIndex: 'plan', width: 110,
      render: (p?: string) => <Tag color={CELESTE} style={{ borderRadius: 6 }}>{planDe(p)?.displayName ?? p ?? '—'}</Tag>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 150,
      render: (s?: string, t?: TenantSummary) => {
        const cfg = ESTADO[s ?? ''] ?? { label: s ?? '—', color: 'default', dot: '' }
        return (
          <Tag color={cfg.color} style={{ borderRadius: 20, padding: '2px 10px' }}>
            {cfg.dot} {cfg.label}{s === 'trial' && t?.trialDaysLeft != null ? ` · ${t.trialDaysLeft}d` : ''}
          </Tag>
        )
      },
    },
    {
      title: 'Usuarios', key: 'users', width: 100,
      render: (_, t) => `${t.usersCount ?? 0}${t.maxUsers ? ` / ${t.maxUsers}` : ''}`,
    },
    {
      title: 'MRR', key: 'mrr', width: 110,
      render: (_, t) => t.status === 'active' ? money(mrrDe(t), planDe(t.plan)?.currency) : <span style={{ color: '#8b8d97' }}>—</span>,
    },
    {
      title: 'Trial / Próx. cobro', key: 'trial', width: 150,
      render: (_, t) => t.status === 'trial'
        ? <span style={{ color: '#f4a261' }}>{(t.trialDaysLeft ?? 0) <= 7 ? `Vence en ${t.trialDaysLeft}d` : `Trial · ${t.trialDaysLeft}d`}</span>
        : <span style={{ color: '#8b8d97', fontSize: 12 }}>{t.trialEndsAt ? '—' : '—'}</span>,
    },
    {
      title: '', key: 'actions', width: 150, fixed: 'right',
      render: (_, t) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Ver detalle"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => verDetalle(t)} /></Tooltip>
          <Tooltip title="Impersonar"><Button size="small" type="text" icon={<LoginOutlined style={{ color: CELESTE }} />} onClick={() => impersonar(t)} /></Tooltip>
          {t.status === 'suspended'
            ? <Tooltip title="Reactivar"><Button size="small" type="text" icon={<PlayCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => cambiarEstado(t, 'active')} /></Tooltip>
            : <Popconfirm title="¿Suspender este tenant?" onConfirm={() => cambiarEstado(t, 'suspended')} okText="Suspender" cancelText="No">
                <Tooltip title="Suspender"><Button size="small" type="text" icon={<PauseCircleOutlined style={{ color: '#e5484d' }} />} /></Tooltip>
              </Popconfirm>}
          {t.status === 'trial' && (
            <Tooltip title="Extender trial 15 días"><Button size="small" type="text" icon={<ClockCircleOutlined style={{ color: '#f4a261' }} />} onClick={() => extenderTrial(t)} /></Tooltip>
          )}
        </div>
      ),
    },
  ]

  // ── Distribución por plan ──
  const distribucion = useMemo(() => {
    const total = tenants.length || 1
    const grupos = plans.map(p => ({ label: p.displayName, count: tenants.filter(t => t.plan === p.plan).length, color: CELESTE }))
    grupos.push({ label: 'Trials activos', count: tenants.filter(t => t.status === 'trial').length, color: '#8b8d97' })
    return grupos.map(g => ({ ...g, pct: Math.round((g.count / total) * 100) }))
  }, [tenants, plans])

  const KpiCard = ({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) => (
    <Card size="small" style={{ flex: 1, minWidth: 180 }} bodyStyle={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: '#8b8d97', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor ?? '#8b8d97', marginTop: 4 }}>{sub}</div>}
    </Card>
  )

  return (
    <Spin spinning={loading}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <KpiCard label="Tenants activos" value={String(kpis.activos)} />
        <KpiCard label="MRR total" value={money(kpis.mrr)} />
        <KpiCard label="Trials activos" value={String(kpis.trials)} sub={kpis.trialsPorVencer ? `Vencen esta semana: ${kpis.trialsPorVencer}` : undefined} subColor="#f4a261" />
        <KpiCard label="Errores sin resolver" value={String(kpis.errores)} sub="Próximamente" />
      </div>

      {/* Tabs + filtro plan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <Button key={t.key} type={tab === t.key ? 'primary' : 'default'} size="small" onClick={() => setTab(t.key)}>
            {t.label} ({contarTab(t.key)})
          </Button>
        ))}
        <Select
          allowClear placeholder="Todos los planes" size="small" style={{ width: 180, marginLeft: 'auto' }}
          value={planFilter} onChange={setPlanFilter}
          options={plans.map(p => ({ value: p.plan, label: p.displayName }))}
        />
      </div>

      {/* Tabla */}
      <Card size="small" bodyStyle={{ padding: 0 }} style={{ marginBottom: 16 }}>
        <Table<TenantSummary>
          rowKey="id" columns={columns} dataSource={filtrados} size="small"
          pagination={{ pageSize: 20, showTotal: t => `${t} tenants` }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Distribución por plan */}
      <Card size="small" title="Distribución por plan" style={{ maxWidth: 520 }}>
        {distribucion.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ width: 130, fontSize: 13 }}>{g.label}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, width: 80, textAlign: 'right' }}>{g.count} tenants</span>
          </div>
        ))}
      </Card>

      {/* Drawer detalle (slide-over básico; TODO: uso/actividad reciente) */}
      <Drawer
        open={detalleOpen} onClose={() => setDetalleOpen(false)} width={480}
        title={detalle?._summary?.name ?? 'Detalle del tenant'}
      >
        <Spin spinning={detalleLoading}>
          {detalle && (
            <>
              <div style={{ marginBottom: 12, padding: 12, background: 'rgba(244,162,97,0.12)', border: '1px solid rgba(244,162,97,0.3)', borderRadius: 8 }}>
                <Button block type="primary" ghost icon={<LoginOutlined />} onClick={() => impersonar(detalle._summary)}>
                  Ver el sistema como este usuario →
                </Button>
              </div>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Tenant ID">{detalle._summary?.id}</Descriptions.Item>
                <Descriptions.Item label="Estado">{ESTADO[detalle._summary?.status ?? '']?.label ?? detalle._summary?.status}</Descriptions.Item>
                <Descriptions.Item label="Plan">{planDe(detalle._summary?.plan)?.displayName ?? detalle._summary?.plan}</Descriptions.Item>
                <Descriptions.Item label="MRR">{detalle._summary?.status === 'active' ? money(mrrDe(detalle._summary), planDe(detalle._summary?.plan)?.currency) : '—'}</Descriptions.Item>
                <Descriptions.Item label="Usuarios">{detalle._summary?.usersCount ?? 0}{detalle._summary?.maxUsers ? ` / ${detalle._summary.maxUsers}` : ''}</Descriptions.Item>
                <Descriptions.Item label="Empresas">{detalle._summary?.companiesCount ?? 0}</Descriptions.Item>
                <Descriptions.Item label="NIT">{detalle._summary?.taxId ?? '—'}</Descriptions.Item>
              </Descriptions>
              <div style={{ fontSize: 11, color: '#8b8d97', marginTop: 12 }}>
                Uso del sistema y actividad reciente — próximamente (requiere endpoint de detalle extendido).
              </div>
            </>
          )}
        </Spin>
      </Drawer>
    </Spin>
  )
}
