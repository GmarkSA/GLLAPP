import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Space, Button } from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShopOutlined,
  BankOutlined, BarChartOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined, BellOutlined,
  ProjectOutlined, AuditOutlined, InboxOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BookOutlined,
  TabletOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard',        icon: <DashboardOutlined />,    label: 'Dashboard' },
  { key: 'ventas',            icon: <ShoppingCartOutlined />, label: 'Ventas', children: [
    { key: '/ventas/clientes',      label: 'Clientes' },
    { key: '/ventas/estimaciones',  label: 'Cotizaciones' },
    { key: '/ventas/facturas',      label: 'Facturas de venta' },
    { key: '/ventas/notas-credito',    label: 'Notas de crédito' },
    { key: '/ventas/pagos-recibidos', label: 'Pagos recibidos' },
  ]},
  { key: 'compras',           icon: <ShopOutlined />,         label: 'Compras', children: [
    { key: '/compras/proveedores',  label: 'Proveedores' },
    { key: '/compras/facturas',     label: 'Facturas proveedor' },
    { key: '/compras/ordenes',      label: 'Órdenes de compra' },
    { key: '/compras/gastos',       label: 'Gastos' },
  ]},
  { key: 'bancos',             icon: <BankOutlined />,         label: 'Bancos y Tesorería', children: [
    { key: '/bancos',              label: 'Cuentas bancarias' },
    { key: '/bancos/nuevo',        label: '+ Nueva cuenta' },
  ]},
  { key: 'contabilidad',      icon: <AuditOutlined />,        label: 'Contabilidad', children: [
    { key: '/contabilidad/catalogo', label: 'Catálogo de cuentas' },
    { key: '/contabilidad/asientos', label: 'Libro diario' },
    { key: '/contabilidad/activos',  label: 'Activos fijos' },
  ]},
  { key: 'inventario',         icon: <InboxOutlined />,        label: 'Inventario', children: [
    { key: '/inventario',                       label: 'Artículos' },
    { key: '/inventario/grupos',                label: 'Grupos de artículos' },
    { key: '/inventario/almacenes',             label: 'Almacenes' },
    { key: '/inventario/entregas',              label: 'Entregas' },
    { key: '/inventario/expedientes',           label: 'Expediente de importación' },
    { key: '/inventario/produccion',            label: 'Producción' },
    { key: '/inventario/ubicaciones',           label: 'Ubicación / POS' },
    { key: '/inventario/movimientos',           label: 'Movimientos MIGO' },
  ]},
  { key: '/pos',               icon: <TabletOutlined />,       label: '🛒 Terminal POS' },
  { key: '/proyectos',        icon: <ProjectOutlined />,      label: 'Proyectos' },
  { key: 'reportes',           icon: <BarChartOutlined />,     label: 'Reportes', children: [
    { key: '/reportes/balance-general',    label: 'Balance General' },
    { key: '/reportes/estado-resultados',  label: 'Estado de Resultados' },
    { key: '/reportes/flujo-efectivo',     label: 'Flujo de Caja' },
    { key: '/reportes/tasas-rendimiento',  label: 'Tasas de Rendimiento' },
    { key: '/reportes/movimiento-capital', label: 'Movimiento de Capital' },
    { key: '/reportes/balanza',            label: 'Balanza de Comprobación' },
  ]},
  { key: 'configuracion',     icon: <SettingOutlined />,      label: 'Configuración', children: [
    { key: '/configuracion',               label: 'General' },
    { key: '/configuracion/integraciones', label: '🔌 Espacio de Desarrollador' },
  ]},
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{ background: '#1B3A6B', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}
      >
        {/* Logo */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          gap: 10,
        }}>
          <BookOutlined style={{ fontSize: 22, color: '#60a5fa' }} />
          {!collapsed && <Text strong style={{ color: '#fff', fontSize: 16 }}>ContaERP</Text>}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['ventas', 'compras', 'bancos', 'inventario', 'contabilidad', 'reportes', 'configuracion']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#1B3A6B', borderRight: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin 0.2s' }}>
        {/* Header */}
        <Header style={{
          position: 'sticky', top: 0, zIndex: 99,
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          <Space size={16}>
            <Badge count={3} size="small">
              <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>

            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: '#1B3A6B' }} size={34}>
                  {user?.firstName?.[0] || 'U'}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>Administrador</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Contenido */}
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
