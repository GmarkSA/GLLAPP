import { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Button, Tooltip } from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShopOutlined,
  BankOutlined, BarChartOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined, BellOutlined,
  ProjectOutlined, AuditOutlined, InboxOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BookOutlined,
  TabletOutlined, SearchOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import CompanySelector from '../components/CompanySelector'
import CompanyContextBar from '../components/CompanyContextBar'
import NoCompanyGuard from '../components/NoCompanyGuard'
import EnterpriseBreadcrumb from '../components/enterprise/EnterpriseBreadcrumb'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/dashboard',        icon: <DashboardOutlined />,    label: 'Dashboard' },
  { key: 'ventas',            icon: <ShoppingCartOutlined />, label: 'Ventas', children: [
    { key: '/ventas/clientes',        label: 'Clientes' },
    { key: '/ventas/estimaciones',    label: 'Cotizaciones' },
    { key: '/ventas/facturas',        label: 'Facturas de venta' },
    { key: '/ventas/notas-credito',   label: 'Notas de crédito' },
    { key: '/ventas/pagos-recibidos',          label: 'Pagos recibidos' },
    { key: '/ventas/reportes/libro-ventas',    label: 'Libro de Ventas' },
  ]},
  { key: 'compras',           icon: <ShopOutlined />,         label: 'Compras', children: [
    { key: '/compras/proveedores',            label: 'Proveedores' },
    { key: '/compras/ordenes',                label: 'Órdenes de compra' },
    { key: '/compras/facturas',               label: 'Facturas proveedor' },
    { key: '/compras/reportes/ap-aging',      label: 'AP Aging (CxP)' },
    { key: '/compras/reportes/libro-compras', label: 'Libro de Compras' },
  ]},
  { key: 'bancos',            icon: <BankOutlined />,         label: 'Bancos y Tesorería', children: [
    { key: '/bancos',       label: 'Cuentas bancarias' },
    { key: '/bancos/nuevo', label: '+ Nueva cuenta' },
  ]},
  { key: 'contabilidad',     icon: <AuditOutlined />,        label: 'Contabilidad', children: [
    { key: '/contabilidad/catalogo', label: 'Catálogo de cuentas' },
    { key: '/contabilidad/asientos', label: 'Libro diario' },
    { key: '/contabilidad/activos',  label: 'Activos fijos' },
  ]},
  { key: 'inventario',       icon: <InboxOutlined />,        label: 'Inventario', children: [
    { key: '/inventario',                label: 'Artículos' },
    { key: '/inventario/grupos',         label: 'Grupos de artículos' },
    { key: '/inventario/almacenes',      label: 'Almacenes' },
    { key: '/inventario/entregas',       label: 'Entregas' },
    { key: '/inventario/expedientes',    label: 'Expediente de importación' },
    { key: '/inventario/produccion',     label: 'Producción' },
    { key: '/inventario/ubicaciones',    label: 'Ubicación / POS' },
    { key: '/inventario/movimientos',    label: 'Movimientos MIGO' },
  ]},
  { key: '/pos',             icon: <TabletOutlined />,       label: 'Terminal POS' },
  { key: '/proyectos',       icon: <ProjectOutlined />,      label: 'Proyectos' },
  { key: 'reportes',         icon: <BarChartOutlined />,     label: 'Reportes', children: [
    { key: '/reportes/balance-general',    label: 'Balance General' },
    { key: '/reportes/estado-resultados',  label: 'Estado de Resultados' },
    { key: '/reportes/flujo-efectivo',     label: 'Flujo de Caja' },
    { key: '/reportes/tasas-rendimiento',  label: 'Tasas de Rendimiento' },
    { key: '/reportes/movimiento-capital', label: 'Movimiento de Capital' },
    { key: '/reportes/balanza',            label: 'Balanza de Comprobación' },
  ]},
  { key: '/admin/platform',  icon: <GlobalOutlined />,       label: 'Platform Admin' },
  { key: 'configuracion',    icon: <SettingOutlined />,      label: 'Configuración', children: [
    { key: '/configuracion',                              label: 'General' },
    { key: '/configuracion/empresas',                     label: 'Empresas' },
    { key: '/configuracion/empresas/sucursales',          label: 'Sucursales' },
    { key: '/configuracion/empresas/series',              label: 'Series de Documentos' },
    { key: '/configuracion/empresas/facturacion-electronica', label: 'Facturación Electrónica' },
    { key: '/configuracion/empresas/bancos',              label: 'Perfiles Bancarios' },
    { key: '/configuracion/unidades-medida',              label: 'Unidades de Medida' },
    { key: '/configuracion/integraciones',                label: 'Espacio de Desarrollador' },
  ]},
]

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' as const } },
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  // Guard: cajero solo accede al POS — redirige si intenta entrar al ERP
  const isCajero = !!(user?.roles?.includes('cajero') && !user?.isSuperAdmin)
  useEffect(() => {
    if (isCajero) navigate('/pos', { replace: true })
  }, [isCajero])

  const visibleMenuItems = user?.isSuperAdmin
    ? menuItems
    : menuItems.filter(item => item.key !== '/admin/platform')

  const getOpenKey = (pathname: string) => {
    if (pathname.startsWith('/ventas'))        return ['ventas']
    if (pathname.startsWith('/compras'))       return ['compras']
    if (pathname.startsWith('/bancos'))        return ['bancos']
    if (pathname.startsWith('/contabilidad'))  return ['contabilidad']
    if (pathname.startsWith('/inventario'))    return ['inventario']
    if (pathname.startsWith('/reportes'))      return ['reportes']
    if (pathname.startsWith('/configuracion')) return ['configuracion']
    return []
  }

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Mi perfil' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') { logout(); navigate('/login') }
    },
  }

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : 'U'

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={248}
        style={{
          background: 'linear-gradient(180deg, #0f2347 0%, #1B3A6B 60%, #1e4080 100%)',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
          transition: 'width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(96,165,250,0.4)',
            flexShrink: 0,
          }}>
            <BookOutlined style={{ fontSize: 16, color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>ContaERP</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 500 }}>GLL Consulting</div>
            </div>
          )}
        </div>

        <div className="sidebar-scroll" style={{
          height: 'calc(100vh - 72px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {/* Company Selector */}
          {!collapsed && <CompanySelector />}

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={getOpenKey(location.pathname)}
            items={visibleMenuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              background: 'transparent',
              borderRight: 'none',
              padding: '0 8px',
            }}
          />
        </div>
      </Sider>

      {/* ── Main area ───────────────────────────────────────────── */}
      <Layout style={{
        marginLeft: collapsed ? 80 : 248,
        transition: 'margin 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>

        {/* Header glassmorphism */}
        <Header style={{
          position: 'sticky',
          top: 0,
          zIndex: 99,
          background: 'rgba(240,242,247,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          height: 60,
        }}>
          {/* Left */}
          <Space size={12}>
            <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ color: '#6b7280', borderRadius: 8 }}
              />
            </Tooltip>
            <CompanyContextBar />
          </Space>

          {/* Right */}
          <Space size={8}>
            <Tooltip title="Buscar">
              <Button
                type="text"
                shape="circle"
                icon={<SearchOutlined style={{ color: '#6b7280' }} />}
                style={{ borderRadius: 10 }}
              />
            </Tooltip>

            <Badge count={3} size="small" offset={[-2, 2]}>
              <Button
                type="text"
                shape="circle"
                icon={<BellOutlined style={{ fontSize: 17, color: '#6b7280' }} />}
                style={{ borderRadius: 10 }}
              />
            </Badge>

            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', padding: '4px 10px 4px 4px',
                borderRadius: 30,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.06)',
                transition: 'background 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
              >
                <Avatar
                  size={30}
                  style={{
                    background: 'linear-gradient(135deg, #1B3A6B, #2d5fa6)',
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  {initials}
                </Avatar>
                <div style={{ lineHeight: 1.25 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>
                    {user
                      ? (user.fullName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email)
                      : 'Usuario'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>
                    {user?.isSuperAdmin ? 'Super Admin' : 'Administrador'}
                  </div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Breadcrumb enterprise */}
        <EnterpriseBreadcrumb />

        {/* Contenido con transición */}
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 60px)' }}>
          <NoCompanyGuard>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          </NoCompanyGuard>
        </Content>
      </Layout>
    </Layout>
  )
}
