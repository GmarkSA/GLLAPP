import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ConfigProvider, theme, Input, Badge, Avatar } from 'antd'
import {
  BankOutlined, LineChartOutlined, WarningOutlined,
  TagsOutlined, CustomerServiceOutlined, SettingOutlined, SearchOutlined,
} from '@ant-design/icons'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'

const unwrap = (r: any) => r.data?.data ?? r.data

// Paleta del Platform Admin (dark)
const CELESTE = '#5ba4cf'
const BG_APP  = '#0c0c10'
const BG_SIDE = '#101015'
const BORDER  = '#1e1e26'
const TXT     = '#e6e7ea'
const TXT_DIM = '#8b8d97'

type NavItem = { key: string; label: string; icon: React.ReactNode; badge?: 'active' | 'errors' }

const NAV_PRINCIPAL: NavItem[] = [
  { key: '/admin/tenants',  label: 'Tenants',           icon: <BankOutlined />,      badge: 'active' },
  { key: '/admin/mrr',      label: 'MRR & Facturación', icon: <LineChartOutlined /> },
  { key: '/admin/errores',  label: 'Errores Op.',       icon: <WarningOutlined />,   badge: 'errors' },
]
const NAV_CONFIG: NavItem[] = [
  { key: '/admin/planes',  label: 'Planes & Precios', icon: <TagsOutlined /> },
  { key: '/admin/soporte', label: 'Soporte',          icon: <CustomerServiceOutlined /> },
  { key: '/admin/sistema', label: 'Sistema',          icon: <SettingOutlined /> },
]

const TITULOS: Record<string, string> = {
  '/admin/tenants':  'Gestión de Tenants',
  '/admin/mrr':      'MRR & Facturación',
  '/admin/errores':  'Errores Operativos',
  '/admin/planes':   'Planes & Precios',
  '/admin/soporte':  'Soporte',
  '/admin/sistema':  'Sistema',
}

export type AdminOutletCtx = { search: string }

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore(s => s.user)

  const [search, setSearch] = useState('')
  const [activos, setActivos] = useState<number>(0)
  const [errores, setErrores] = useState<number>(0) // TODO(backend): GET /admin/errores-operativos/contador-pendientes

  useEffect(() => {
    api.get('/admin/stats').then(unwrap)
      .then((s: any) => setActivos(Number(s?.active ?? 0)))
      .catch(() => null)
    // TODO(backend): cuando exista el endpoint de errores, setear el conteo real
    setErrores(0)
  }, [])

  const titulo = useMemo(() => {
    const match = Object.keys(TITULOS).find(k => location.pathname.startsWith(k))
    return match ? TITULOS[match] : 'Platform Admin'
  }, [location.pathname])

  const iniciales = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || 'GL'

  const renderNav = (items: NavItem[], titulo: string) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: TXT_DIM, textTransform: 'uppercase', padding: '0 16px 8px' }}>
        {titulo}
      </div>
      {items.map(item => {
        const activo = location.pathname.startsWith(item.key)
        const badgeVal = item.badge === 'active' ? activos : item.badge === 'errors' ? errores : 0
        return (
          <div
            key={item.key}
            onClick={() => navigate(item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              margin: '2px 8px', padding: '9px 12px', borderRadius: 8, fontSize: 14,
              background: activo ? 'rgba(91,164,207,0.14)' : 'transparent',
              color: activo ? CELESTE : TXT,
              fontWeight: activo ? 600 : 400,
            }}
          >
            <span style={{ fontSize: 16, display: 'flex' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge === 'errors' && badgeVal > 0 && (
              <Badge count={badgeVal} size="small" />
            )}
            {item.badge === 'active' && badgeVal > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: activo ? CELESTE : TXT_DIM, background: activo ? 'rgba(91,164,207,0.18)' : 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '1px 8px' }}>
                {badgeVal}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: CELESTE, colorBgBase: BG_APP, borderRadius: 8, colorBorder: BORDER },
      }}
    >
      <div style={{ display: 'flex', minHeight: '100vh', background: BG_APP, color: TXT }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: BG_SIDE, borderRight: `1px solid ${BORDER}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', paddingTop: 16 }}>
          <div style={{ padding: '0 16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 700 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <span style={{ color: '#f5f7fa' }}>Lucía</span>
              <span style={{ color: CELESTE }}>Admin</span>
            </div>
            <div style={{ fontSize: 11, color: '#a3a6b0', marginTop: 2 }}>Platform Control Center</div>
          </div>
          {renderNav(NAV_PRINCIPAL, 'Principal')}
          {renderNav(NAV_CONFIG, 'Configuración')}
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Topbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: BG_APP, zIndex: 5 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: TXT, flexShrink: 0 }}>{titulo}</div>
            <Input
              allowClear
              value={search}
              onChange={e => setSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: TXT_DIM }} />}
              placeholder="Buscar tenant, NIT, email…"
              style={{ maxWidth: 420, marginLeft: 'auto', background: 'rgba(255,255,255,0.04)' }}
            />
            <Avatar style={{ background: CELESTE, color: '#06121a', fontWeight: 700, flexShrink: 0 }}>
              {iniciales.toUpperCase()}
            </Avatar>
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Outlet context={{ search } satisfies AdminOutletCtx} />
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
