import { useState, useEffect, useRef } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Button, Tooltip, Tag } from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShopOutlined,
  BankOutlined, BarChartOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined, BellOutlined,
  ProjectOutlined, AuditOutlined, InboxOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  TabletOutlined, SearchOutlined, GlobalOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { useVersionCheck } from '../hooks/useVersionCheck'
import { useCompanyStore } from '../store/companyStore'
import type { Company } from '../store/authStore'
import CompanySelector from '../components/CompanySelector'
import NoCompanyGuard from '../components/NoCompanyGuard'
import OnboardingProgressBadge from '../components/Onboarding/OnboardingProgressBadge'
import OnboardingChatDrawer from '../components/Onboarding/OnboardingChatDrawer'
import EnterpriseBreadcrumb from '../components/enterprise/EnterpriseBreadcrumb'

const { Header, Sider, Content } = Layout

// ID único global derivado del UUID de la empresa (como Zoho: 893773585)
// Convierte los primeros 8 caracteres hex del UUID a decimal → 9-10 dígitos únicos
function formatOrgId(company: Company): string {
  return parseInt(company.id.replace(/-/g, '').slice(0, 8), 16).toString()
}

// ── Acceso por módulo según rol ────────────────────────────────────────────
// SuperAdmin e isSuperAdmin → acceso total
// Admin (gerente del tenant) → acceso total
// Otros roles → acceso específico por módulo

const FULL_ACCESS_ROLES = new Set(['superadmin', 'admin'])

const ROLE_MODULES: Record<string, Set<string>> = {
  contador:   new Set(['contabilidad', 'bancos', 'compras', 'reportes', 'configuracion']),
  ventas:     new Set(['ventas', 'inventario', 'reportes', 'configuracion']),
  compras:    new Set(['compras', 'inventario', 'bancos', 'reportes', 'configuracion']),
  planillas:  new Set(['planillas', 'reportes', 'configuracion']),
  tesoreria:  new Set(['bancos', 'compras', 'reportes', 'configuracion']),
  cajero:     new Set(['/pos']),
  lector:     new Set(['reportes', 'configuracion']),
  inventario: new Set(['inventario', 'ventas', 'reportes', 'configuracion']),
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  contador:   'Contador',
  ventas:     'Ventas',
  compras:    'Compras',
  planillas:  'Planillas',
  tesoreria:  'Tesorería',
  cajero:     'Cajero',
  lector:     'Lector',
  inventario: 'Inventario',
}

const getOpenKey = (pathname: string): string[] => {
  if (pathname.startsWith('/ventas'))        return ['ventas']
  if (pathname.startsWith('/compras'))       return ['compras']
  if (pathname.startsWith('/bancos'))        return ['bancos']
  if (pathname.startsWith('/contabilidad'))  return ['contabilidad']
  if (pathname.startsWith('/inventario'))    return ['inventario']
  if (pathname.startsWith('/planillas'))     return ['planillas']
  if (pathname.startsWith('/reportes'))      return ['reportes']
  if (pathname.startsWith('/configuracion')) return ['configuracion']
  return []
}

const menuItems = [
  { key: '/dashboard',        icon: <DashboardOutlined />,    label: 'Dashboard' },
  { key: 'ventas',            icon: <ShoppingCartOutlined />, label: 'Ventas', children: [
    { key: '/ventas/clientes',        label: 'Clientes' },
    { key: '/ventas/estimaciones',         label: 'Cotizaciones' },
    { key: '/ventas/facturas',             label: 'Facturas de venta' },
    { key: '/ventas/facturas-recurrentes', label: 'Facturas recurrentes' },
    { key: '/ventas/notas-credito',        label: 'Notas de crédito' },
    { key: '/ventas/pagos-recibidos',          label: 'Pagos recibidos' },
    { key: '/ventas/dte-sat',                  label: 'DTE SAT Emitidos' },
  ]},
  { key: 'compras',           icon: <ShopOutlined />,         label: 'Compras', children: [
    { key: '/compras/proveedores',                 label: 'Proveedores' },
    { key: '/compras/ordenes',                     label: 'Órdenes de compra' },
    { key: '/compras/facturas',                    label: 'Facturas proveedor' },
    { key: '/compras/notas-credito-proveedor',     label: 'Notas de crédito' },
    { key: '/compras/dte-sat',                     label: 'DTE SAT Recibidos' },
    { key: '/compras/anticipos-proveedor',         label: 'Anticipos a proveedores' },
  ]},
  { key: 'bancos',            icon: <BankOutlined />,         label: 'Bancos y Tesorería', children: [
    { key: '/bancos',                         label: 'Cuentas bancarias' },
    { key: '/bancos/pagos-realizados',        label: 'Pagos a proveedores' },
    { key: '/bancos/pagos-realizados/lote',  label: 'Emisión lote de cheques' },
    { key: '/bancos/config-pagos',            label: 'Config. cheques y ACH' },
  ]},
  { key: 'contabilidad',     icon: <AuditOutlined />,        label: 'Contabilidad', children: [
    { key: '/contabilidad/catalogo',             label: 'Catálogo de cuentas' },
    { key: '/contabilidad/diarios-manuales',     label: 'Diarios manuales' },
    { key: '/contabilidad/diarios-recurrentes',  label: 'Diarios recurrentes' },
    { key: '/contabilidad/activos-fijos',        label: 'Activos fijos' },
    { key: '/contabilidad/clases-activo-fijo',   label: 'Clases de activo fijo' },
    { key: '/contabilidad/presupuesto',          label: 'Presupuestos' },
    { key: '/contabilidad/ajuste-moneda',        label: 'Ajustes de moneda' },
    { key: '/contabilidad/bloqueo-transacciones', label: 'Bloqueo de transacc...' },
    { key: '/contabilidad/centros-costo',        label: 'Centros de costo' },
    { key: '/contabilidad/centros-beneficio',    label: 'Centros de beneficio' },
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
  { key: 'planillas',        icon: <TeamOutlined />,         label: 'Planillas', children: [
    { key: '/planillas/corridas',                           label: 'Corridas de planilla' },
    { key: '/planillas/empleados',                          label: 'Empleados' },
    { key: '/planillas/finiquitos',                         label: 'Finiquitos' },
    { key: '/planillas/configuracion/parametros-fiscales', label: 'Parámetros fiscales' },
    { key: '/planillas/configuracion/datos-patrono',       label: 'Datos del patrono' },
    { key: '/planillas/configuracion/cuentas-contables',   label: 'Cuentas contables' },
    { key: '/planillas/configuracion/centros-trabajo',     label: 'Centros de trabajo' },
  ]},
  { key: '/proyectos',       icon: <ProjectOutlined />,      label: 'Proyectos' },
  { key: '/reportes',        icon: <BarChartOutlined />,     label: 'Reportes' },
  { key: '/admin/platform',  icon: <GlobalOutlined />,       label: 'Platform Admin' },
  { key: 'configuracion',    icon: <SettingOutlined />,      label: 'Configuración', children: [
    { key: '/configuracion',                              label: 'General' },
    { key: '/configuracion/empresas',                     label: 'Empresas' },
    { key: '/configuracion/empresas/sucursales',          label: 'Sucursales' },
    { key: '/configuracion/empresas/series',              label: 'Series de Documentos' },
    { key: '/configuracion/empresas/facturacion-electronica', label: 'Facturación Electrónica' },
    { key: '/configuracion/empresas/bancos',              label: 'Perfiles Bancarios' },
    { key: '/configuracion/unidades-medida',              label: 'Unidades de Medida' },
    { key: '/configuracion/plantillas-impresion',         label: 'Plantillas de Impresión' },
    { key: '/configuracion/integraciones',                label: 'Espacio de Desarrollador' },
  ]},
]

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' as const } },
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(true)
  const lastNavKey = useRef('')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const isModuleEnabled  = useCompanyStore(s => s.isModuleEnabled)
  const activeCompany    = useCompanyStore(s => s.activeCompany)
  const [openKeys, setOpenKeys] = useState<string[]>(() => getOpenKey(location.pathname))
  const hasUpdate = useVersionCheck()

  // ── Lógica de acceso por rol ──────────────────────────────────────────────
  // roles puede llegar como string[] o como objeto[] {id, name} según el endpoint
  const getRoleName = (r: any): string =>
    (typeof r === 'string' ? r : (r?.name ?? '')).toLowerCase()

  const userRoles     = (user?.roles ?? []).map(getRoleName).filter(Boolean)
  const hasFullAccess = user?.isSuperAdmin || userRoles.some(r => FULL_ACCESS_ROLES.has(r))

  const canSeeModule = (moduleKey: string): boolean => {
    if (hasFullAccess) return true
    return userRoles.some(r => ROLE_MODULES[r]?.has(moduleKey) ?? false)
  }

  const roleDisplayName = user?.isSuperAdmin
    ? 'Super Admin'
    : userRoles.length > 0
      ? userRoles.map(r => ROLE_LABELS[r] ?? r.charAt(0).toUpperCase() + r.slice(1)).join(', ')
      : 'Usuario'

  // ── Filtrado del menú ─────────────────────────────────────────────────────
  // Paso 1: filtrar por módulos habilitados en la empresa activa
  const filteredMenuItems = menuItems.filter(item => {
    const alwaysVisible = ['/dashboard', 'configuracion', '/admin/platform']
    if (alwaysVisible.includes(item.key)) return true
    // Normaliza /pos → pos, /proyectos → proyectos para comparar con enabledModules
    const moduleKey = item.key.startsWith('/') ? item.key.slice(1) : item.key
    return isModuleEnabled(moduleKey)
  })

  const handleOpenChange = (keys: string[]) => {
    const newKey = keys.find(k => !openKeys.includes(k))
    setOpenKeys(newKey ? [newKey] : keys)
  }

  // Guard: cajero solo accede al POS
  const isCajero = !!(userRoles.includes('cajero') && !user?.isSuperAdmin)
  useEffect(() => {
    if (isCajero) navigate('/pos', { replace: true })
  }, [isCajero])

  useEffect(() => {
    if (!collapsed) setOpenKeys(getOpenKey(lastNavKey.current || location.pathname))
  }, [collapsed])

  // Paso 2: filtrar por rol del usuario
  const visibleMenuItems = filteredMenuItems.filter(item => {
    if (item.key === '/dashboard')      return true
    if (item.key === '/admin/platform') return !!user?.isSuperAdmin
    if (item.key === 'configuracion')   return true
    return canSeeModule(item.key)
  })

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
          background: '#ffffff',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          borderRight: '1px solid rgba(10,10,10,0.08)',
          boxShadow: '2px 0 8px rgba(10,10,10,0.04)',
          transition: 'width 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
        onClick={() => { if (collapsed) setCollapsed(false) }}
      >
        {/* Logo */}
        <div style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 10px 0 0',
          borderBottom: '1px solid rgba(10,10,10,0.06)',
          marginBottom: 8,
        }}>
          {collapsed ? (
            <img src="/lucia-icon.svg" alt="Lucía" style={{ width: 34, height: 34 }} />
          ) : (
            <img src="/lucia-logo.svg?v=3" alt="Lucía" style={{ height: 64, width: 'auto', marginLeft: 32 }} />
          )}
        </div>

        <div className="sidebar-scroll" style={{
          height: 'calc(100vh - 72px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            items={visibleMenuItems}
            onClick={({ key }) => { lastNavKey.current = key; navigate(key) }}
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
        transition: 'margin 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
            <CompanySelector placement="header" />
            {/* key fuerza remonte del badge al cambiar empresa → re-fetch del porcentaje */}
            <OnboardingProgressBadge key={activeCompany?.id} />
            {activeCompany && (
              <Tooltip title="ID de tu organización — clic para copiar">
                <Tag
                  color="cyan"
                  style={{ fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', margin: 0 }}
                  onClick={() => { navigator.clipboard.writeText(formatOrgId(activeCompany)) }}
                >
                  <span style={{ fontWeight: 400, opacity: 0.8 }}>ID org: </span>
                  <span style={{ fontWeight: 700 }}>{formatOrgId(activeCompany)}</span>
                </Tag>
              </Tooltip>
            )}
            {hasUpdate && (
              <Tooltip title="Hay cambios recientes — actualiza para ver la versión más reciente">
                <Tag
                  color="#1B3A6B"
                  style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, margin: 0 }}
                  onClick={() => window.location.reload()}
                >
                  ↻ Actualizar ahora
                </Tag>
              </Tooltip>
            )}
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
                    background: 'linear-gradient(135deg, #ff9a30, #ff7f00)',
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
                  <div style={{ fontSize: 10, color: '#9aa1ab' }}>
                    {roleDisplayName}
                  </div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Breadcrumb enterprise */}
        <EnterpriseBreadcrumb />

        {/* Contenido con transición */}
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 60px)' }} onClick={() => setCollapsed(true)}>
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

      <OnboardingChatDrawer />
    </Layout>
  )
}
