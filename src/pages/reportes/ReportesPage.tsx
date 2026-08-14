import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Typography } from 'antd'
import {
  BarChartOutlined, LineChartOutlined, FundOutlined,
  AuditOutlined, RiseOutlined, AccountBookOutlined,
  FileTextOutlined, BookOutlined, ShopOutlined,
  PieChartOutlined, DashboardOutlined, TeamOutlined,
  WalletOutlined, BankOutlined, FileProtectOutlined,
  ReconciliationOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

interface ReportCard {
  key:   string
  icon:  React.ReactNode
  title: string
  desc:  string
  path:  string
  color: string
}

interface ReportGroup {
  id:      string
  label:   string
  reports: ReportCard[]
}

const GROUPS: ReportGroup[] = [
  {
    id: 'financieros',
    label: 'Financieros',
    reports: [
      { key: 'balance-general',    icon: <AuditOutlined />,       title: 'Balance General',        desc: 'Activos, pasivos y patrimonio al cierre del período.',          path: '/reportes/balance-general',    color: '#1faec2' },
      { key: 'estado-resultados',  icon: <LineChartOutlined />,   title: 'Estado de Resultados',   desc: 'Ingresos, costos, gastos y utilidad neta del período.',          path: '/reportes/estado-resultados',  color: '#2ea172' },
      { key: 'flujo-efectivo',     icon: <FundOutlined />,        title: 'Flujo de Caja',          desc: 'Entradas y salidas de efectivo: operación, inversión y fin.',    path: '/reportes/flujo-efectivo',     color: '#1faec2' },
      { key: 'tasas-rendimiento',  icon: <RiseOutlined />,        title: 'Tasas de Rendimiento',   desc: 'Ratios de liquidez, endeudamiento y rentabilidad ROA/ROE.',      path: '/reportes/tasas-rendimiento',  color: '#f59e0b' },
      { key: 'movimiento-capital', icon: <BarChartOutlined />,    title: 'Movimiento de Capital',  desc: 'Cambios en patrimonio, utilidades retenidas y distribuciones.',  path: '/reportes/movimiento-capital', color: '#e5484d' },
    ],
  },
  {
    id: 'libros-sat',
    label: 'Libros SAT',
    reports: [
      { key: 'balanza',       icon: <AccountBookOutlined />, title: 'Balanza de Comprobación', desc: 'Débitos y créditos por cuenta. Base para estados financieros.',       path: '/reportes/balanza',       color: '#1faec2' },
      { key: 'libro-diario',  icon: <FileTextOutlined />,   title: 'Libro Diario',            desc: 'Pólizas contables en orden cronológico. Requerido por SAT.',          path: '/reportes/libro-diario',  color: '#1faec2' },
      { key: 'libro-mayor',   icon: <BookOutlined />,       title: 'Libro Mayor',             desc: 'Saldo y movimientos por cuenta contable del catálogo.',                path: '/reportes/libro-mayor',   color: '#2ea172' },
      { key: 'libro-compras', icon: <ShopOutlined />,       title: 'Libro de Compras',        desc: 'Facturas de proveedor con IVA y totales del período. Obligatorio.',    path: '/reportes/libro-compras', color: '#f59e0b' },
      { key: 'libro-ventas',  icon: <LineChartOutlined />,  title: 'Libro de Ventas',         desc: 'Facturas emitidas con IVA y totales del período. Obligatorio.',        path: '/reportes/libro-ventas',  color: '#e5484d' },
    ],
  },
  {
    id: 'cartera',
    label: 'Cartera',
    reports: [
      { key: 'ap-aging',          icon: <WalletOutlined />,  title: 'AP Aging — CxP',      desc: 'Cuentas por pagar clasificadas por antigüedad de saldo.',             path: '/reportes/ap-aging',          color: '#f59e0b' },
      { key: 'ar-aging',          icon: <BankOutlined />,    title: 'AR Aging — CxC',      desc: 'Cuentas por cobrar clasificadas por antigüedad de saldo.',             path: '/reportes/ar-aging',          color: '#1faec2' },
      { key: 'proyectado-pagos',  icon: <TeamOutlined />,    title: 'Proyectado de Pagos', desc: 'Flujo proyectado de pagos y cobros por vencer.',                       path: '/reportes/proyectado-pagos',  color: '#2ea172' },
    ],
  },
  {
    id: 'analiticos',
    label: 'Analíticos',
    reports: [
      { key: 'activos-fijos',      icon: <DashboardOutlined />, title: 'Activos Fijos',              desc: 'Depreciación acumulada, valor en libros y vida útil restante.',        path: '/reportes/activos-fijos',      color: '#6b7280' },
      { key: 'centros-beneficio',  icon: <PieChartOutlined />,  title: 'Rentabilidad por División',  desc: 'P&L por línea de negocio con análisis de concentración y tendencia.',   path: '/reportes/centros-beneficio',  color: '#1faec2' },
      { key: 'centros-costo',      icon: <DashboardOutlined />, title: 'Ejecución C. Costo',         desc: 'Gasto real vs presupuesto por centro de costo y proyección al cierre.',  path: '/reportes/centros-costo',      color: '#f59e0b' },
    ],
  },
  {
    id: 'impuestos',
    label: 'Impuestos',
    reports: [
      { key: 'declaracion-iva', icon: <FileProtectOutlined />, title: 'Declaración IVA', desc: 'Cierre mensual: débito fiscal, crédito fiscal y póliza de regularización SAT-2237.', path: '/reportes/declaracion-iva', color: '#1B3A6B' },
      { key: 'declaracion-isr', icon: <FileProtectOutlined />, title: 'ISR Opcional Mensual', desc: 'Declaración mensual ISR Opcional Simplificado (SAT-1311). 5%/7% sobre renta imponible.', path: '/reportes/declaracion-isr', color: '#1B3A6B' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    reports: [
      { key: 'inventario', icon: <PieChartOutlined />, title: 'Inventario', desc: 'Valorización por costo promedio ponderado y kardex de movimientos por artículo.', path: '/reportes/inventario', color: '#2ea172' },
    ],
  },
  {
    id: 'cierre',
    label: 'Cierre Contable',
    reports: [
      { key: 'estados-financieros', icon: <AuditOutlined />, title: 'Estados Financieros', desc: 'Balance General y Estado de Resultados con drill-down a la integración de cada cuenta.', path: '/reportes/estados-financieros', color: '#1B3A6B' },
      { key: 'integraciones-contables', icon: <ReconciliationOutlined />, title: 'Integraciones Contables', desc: 'Paquete de cierre mensual — integración y conciliación de saldos por cuenta contable.', path: '/reportes/integraciones-contables', color: '#1B3A6B' },
    ],
  },
]

function ReportCard({ report, onClick }: { report: ReportCard; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid rgba(10,10,10,0.07)',
        background: '#fff',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minWidth: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = report.color
        el.style.boxShadow = `0 2px 8px rgba(0,0,0,0.08)`
        el.style.background = '#fafeff'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(10,10,10,0.07)'
        el.style.boxShadow = 'none'
        el.style.background = '#fff'
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: `${report.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: report.color,
      }}>
        {report.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {report.title}
        </div>
        <div style={{ fontSize: 11, color: '#9aa1ab', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {report.desc}
        </div>
      </div>
    </div>
  )
}

export default function ReportesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHub    = location.pathname === '/reportes' || location.pathname === '/reportes/'

  if (!isHub) return <Outlet />

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Reportes</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Estados financieros, libros SAT y reportes analíticos
        </Text>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {GROUPS.map(group => (
          <div key={group.id}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#9aa1ab',
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: '1px solid rgba(10,10,10,0.06)',
            }}>
              {group.label}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 8,
            }}>
              {group.reports.map(r => (
                <ReportCard key={r.key} report={r} onClick={() => navigate(r.path)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
