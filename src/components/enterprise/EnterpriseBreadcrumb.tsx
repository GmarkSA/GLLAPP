import { Breadcrumb } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../store/companyStore'
import { useAuthStore } from '../../store/authStore'

const ROUTE_LABELS: Record<string, string> = {
  dashboard:          'Dashboard',
  ventas:             'Ventas',
  clientes:           'Clientes',
  facturas:           'Facturas de Venta',
  estimaciones:       'Cotizaciones',
  'notas-credito':    'Notas de Crédito',
  'pagos-recibidos':  'Pagos Recibidos',
  compras:            'Compras',
  proveedores:        'Proveedores',
  ordenes:            'Órdenes de Compra',
  gastos:             'Gastos',
  bancos:             'Bancos',
  contabilidad:       'Contabilidad',
  catalogo:           'Catálogo de Cuentas',
  asientos:           'Libro Diario',
  activos:            'Activos Fijos',
  inventario:         'Inventario',
  reportes:           'Reportes',
  configuracion:      'Configuración',
  empresas:           'Empresas',
  sucursales:         'Sucursales',
  series:             'Series de Documentos',
  'facturacion-electronica': 'Facturación Electrónica',
  bancos2:            'Perfiles Bancarios',
  usuarios:           'Usuarios y Roles',
  admin:              'Platform Admin',
  nueva:              'Nuevo',
  editar:             'Editar',
}

export default function EnterpriseBreadcrumb() {
  const location        = useLocation()
  const navigate        = useNavigate()
  const activeCompany   = useCompanyStore(s => s.activeCompany)
  const tenantGroupName = useAuthStore(s => s.tenantGroupName)

  const segments = location.pathname.split('/').filter(Boolean)

  // Omitir si es solo el dashboard
  if (segments.length <= 1) return null

  const items = []

  // Grupo empresarial como raíz (solo cuando existe)
  if (tenantGroupName) {
    items.push({
      title: <span style={{ fontSize: 11, color: '#aaa' }}>{tenantGroupName}</span>,
    })
  }

  // Empresa activa como segundo nivel contextual
  if (activeCompany) {
    items.push({
      title: <span style={{ fontSize: 11, color: '#1faec2', fontWeight: 600 }}>{activeCompany.legalName}</span>,
    })
  }

  // Segmentos de ruta
  let path = ''
  for (const seg of segments) {
    path += `/${seg}`
    const label = ROUTE_LABELS[seg]
    if (!label) continue   // IDs UUID — omitir

    const currentPath = path
    const isLast = segments.indexOf(seg) === segments.length - 1

    items.push({
      title: isLast
        ? <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
        : <span style={{ fontSize: 11, color: '#1faec2', cursor: 'pointer' }} onClick={() => navigate(currentPath)}>{label}</span>,
    })
  }

  if (items.length <= 1) return null

  return (
    <div style={{ padding: '4px 24px 0', borderBottom: '1px solid #fafbfc' }}>
      <Breadcrumb items={items} separator="›" style={{ fontSize: 11 }} />
    </div>
  )
}
