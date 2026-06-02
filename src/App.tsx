import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './store/authStore'
import MainLayout from './layouts/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

// Carga inmediata — rutas críticas
import LoginPage    from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Lazy loading — el resto carga solo cuando se navega ahí
const DashboardPage          = lazy(() => import('./pages/DashboardPage'))
const ConfiguracionPage      = lazy(() => import('./pages/configuracion/ConfiguracionPage'))
const IntegracionesPage      = lazy(() => import('./pages/configuracion/IntegracionesPage'))
const UnidadesMedidaPage     = lazy(() => import('./pages/configuracion/UnidadesMedidaPage'))
const UsuariosPage           = lazy(() => import('./pages/configuracion/usuarios/UsuariosPage'))
const EmpresasPage           = lazy(() => import('./pages/configuracion/empresas/EmpresasPage'))
const EmpresaFormPage        = lazy(() => import('./pages/configuracion/empresas/EmpresaFormPage'))
const SucursalesPage         = lazy(() => import('./pages/configuracion/empresas/SucursalesPage'))
const SeriesDocumentalesPage = lazy(() => import('./pages/configuracion/empresas/SeriesDocumentalesPage'))
const ElectronicInvoicingPage = lazy(() => import('./pages/configuracion/empresas/ElectronicInvoicingPage'))
const BankProfilesPage       = lazy(() => import('./pages/configuracion/empresas/BankProfilesPage'))
const PlatformAdminPage      = lazy(() => import('./pages/admin/PlatformAdminPage'))
const CompanyUsersPage       = lazy(() => import('./pages/configuracion/empresas/CompanyUsersPage'))
const OnboardingWizardPage   = lazy(() => import('./pages/onboarding/OnboardingWizardPage'))

// Ventas
const ClientesPage           = lazy(() => import('./pages/ventas/clientes/ClientesPage'))
const ClienteFormPage        = lazy(() => import('./pages/ventas/clientes/ClienteFormPage'))
const FacturasPage           = lazy(() => import('./pages/ventas/facturas/FacturasPage'))
const FacturaFormPage        = lazy(() => import('./pages/ventas/facturas/FacturaFormPage'))
const FacturaDetallePage     = lazy(() => import('./pages/ventas/facturas/FacturaDetallePage'))
const EstimacionesPage       = lazy(() => import('./pages/ventas/estimaciones/EstimacionesPage'))
const EstimacionFormPage     = lazy(() => import('./pages/ventas/estimaciones/EstimacionFormPage'))
const EstimacionPrintPage    = lazy(() => import('./pages/ventas/estimaciones/EstimacionPrintPage'))
const FacturaImprimirPage    = lazy(() => import('./pages/ventas/facturas/FacturaImprimirPage'))
const NotasCreditoPage       = lazy(() => import('./pages/ventas/notas-credito/NotasCreditoPage'))
const NotaCreditoFormPage    = lazy(() => import('./pages/ventas/notas-credito/NotaCreditoFormPage'))
const NotaCreditoDetallePage = lazy(() => import('./pages/ventas/notas-credito/NotaCreditoDetallePage'))
const PagosRecibidosPage     = lazy(() => import('./pages/ventas/pagos-recibidos/PagosRecibidosPage'))
const PagoRecibidoFormPage   = lazy(() => import('./pages/ventas/pagos-recibidos/PagoRecibidoFormPage'))
const PagoRecibidoDetallePage = lazy(() => import('./pages/ventas/pagos-recibidos/PagoRecibidoDetallePage'))

// Compras
const LibroVentasPage          = lazy(() => import('./pages/ventas/reportes/LibroVentasPage'))

const ProveedoresPage          = lazy(() => import('./pages/compras/proveedores/ProveedoresPage'))
const ProveedorFormPage        = lazy(() => import('./pages/compras/proveedores/ProveedorFormPage'))
const FacturasProveedorPage    = lazy(() => import('./pages/compras/facturas/FacturasProveedorPage'))
const FacturaProveedorFormPage = lazy(() => import('./pages/compras/facturas/FacturaProveedorFormPage'))
const ApAgingPage              = lazy(() => import('./pages/compras/reportes/ApAgingPage'))
const LibroComprasPage         = lazy(() => import('./pages/compras/reportes/LibroComprasPage'))
const OrdenesCompraPage        = lazy(() => import('./pages/compras/ordenes/OrdenesCompraPage'))
const OrdenCompraFormPage      = lazy(() => import('./pages/compras/ordenes/OrdenCompraFormPage'))

// Bancos
const BancosPage       = lazy(() => import('./pages/bancos/BancosPage'))
const BancoFormPage    = lazy(() => import('./pages/bancos/BancoFormPage'))
const BancoDetallePage = lazy(() => import('./pages/bancos/BancoDetallePage'))

// Contabilidad
const CatalogoPage    = lazy(() => import('./pages/contabilidad/CatalogoPage'))
const LibroDiarioPage = lazy(() => import('./pages/reportes/LibroDiarioPage'))
const LibroMayorPage  = lazy(() => import('./pages/reportes/LibroMayorPage'))

// Inventario
const InventarioPage        = lazy(() => import('./pages/inventario/InventarioPage'))
const ArticuloFormPage      = lazy(() => import('./pages/inventario/ArticuloFormPage'))
const ImportacionesPage     = lazy(() => import('./pages/inventario/ImportacionesPage'))
const ImportacionFormPage   = lazy(() => import('./pages/inventario/ImportacionFormPage'))
const ExpedientesPage       = lazy(() => import('./pages/inventario/ExpedientesPage'))
const ExpedienteDetallePage = lazy(() => import('./pages/inventario/ExpedienteDetallePage'))
const AlmacenesPage         = lazy(() => import('./pages/inventario/AlmacenesPage'))
const GruposPage            = lazy(() => import('./pages/inventario/GruposPage'))
const CentrosPage           = lazy(() => import('./pages/inventario/CentrosPage'))
const AjustesInventarioPage = lazy(() => import('./pages/inventario/AjustesInventarioPage'))
const ProduccionPage        = lazy(() => import('./pages/inventario/ProduccionPage'))
const EntregasPage          = lazy(() => import('./pages/inventario/EntregasPage'))
const UbicacionesPage       = lazy(() => import('./pages/inventario/UbicacionesPage'))
const MovimientosPage       = lazy(() => import('./pages/inventario/MovimientosPage'))

// POS
const POSPage = lazy(() => import('./pages/pos/POSPage'))

// Reportes
const ReportesPage          = lazy(() => import('./pages/reportes/ReportesPage'))
const BalanceGeneralPage    = lazy(() => import('./pages/reportes/BalanceGeneralPage'))
const EstadoResultadosPage  = lazy(() => import('./pages/reportes/EstadoResultadosPage'))
const FlujoEfectivoPage     = lazy(() => import('./pages/reportes/FlujoEfectivoPage'))
const TasasRendimientoPage  = lazy(() => import('./pages/reportes/TasasRendimientoPage'))
const MovimientoCapitalPage = lazy(() => import('./pages/reportes/MovimientoCapitalPage'))
const BalanzaPage           = lazy(() => import('./pages/reportes/BalanzaPage'))

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
)

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#8c8c8c' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#1B3A6B' }}>Módulo {title}</div>
      <div style={{ fontSize: 14, marginTop: 8 }}>En desarrollo — próximamente disponible</div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, user, bootstrapAuth } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && !user) bootstrapAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/pos" element={<PrivateRoute><POSPage /></PrivateRoute>} />
        <Route path="/ventas/estimaciones/:id/imprimir" element={<PrivateRoute><EstimacionPrintPage /></PrivateRoute>} />
        <Route path="/ventas/facturas/:id/imprimir"     element={<PrivateRoute><FacturaImprimirPage /></PrivateRoute>} />

        <Route path="/" element={<PrivateRoute><ErrorBoundary><MainLayout /></ErrorBoundary></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="ventas/clientes"            element={<ClientesPage />} />
          <Route path="ventas/clientes/nuevo"      element={<ClienteFormPage />} />
          <Route path="ventas/clientes/:id"        element={<ClienteFormPage />} />

          <Route path="ventas/facturas"            element={<FacturasPage />} />
          <Route path="ventas/facturas/nueva"      element={<FacturaFormPage />} />
          <Route path="ventas/facturas/:id"        element={<FacturaDetallePage />} />
          <Route path="ventas/facturas/:id/editar" element={<FacturaFormPage />} />

          <Route path="ventas/estimaciones"            element={<EstimacionesPage />} />
          <Route path="ventas/estimaciones/nueva"      element={<EstimacionFormPage />} />
          <Route path="ventas/estimaciones/:id"        element={<EstimacionFormPage />} />
          <Route path="ventas/estimaciones/:id/editar" element={<EstimacionFormPage />} />

          <Route path="ventas/notas-credito"           element={<NotasCreditoPage />} />
          <Route path="ventas/notas-credito/nueva"     element={<NotaCreditoFormPage />} />
          <Route path="ventas/notas-credito/:id/editar" element={<NotaCreditoFormPage />} />
          <Route path="ventas/notas-credito/:id"       element={<NotaCreditoDetallePage />} />

          <Route path="ventas/pagos-recibidos"              element={<PagosRecibidosPage />} />
          <Route path="ventas/pagos-recibidos/nuevo"        element={<PagoRecibidoFormPage />} />
          <Route path="ventas/pagos-recibidos/:id"          element={<PagoRecibidoDetallePage />} />
          <Route path="ventas/reportes/libro-ventas"        element={<LibroVentasPage />} />

          <Route path="compras/proveedores"         element={<ProveedoresPage />} />
          <Route path="compras/proveedores/nuevo"   element={<ProveedorFormPage />} />
          <Route path="compras/proveedores/:id"     element={<ProveedorFormPage />} />

          <Route path="compras/facturas"            element={<FacturasProveedorPage />} />
          <Route path="compras/facturas/nueva"      element={<FacturaProveedorFormPage />} />
          <Route path="compras/facturas/:id"        element={<FacturaProveedorFormPage />} />
          <Route path="compras/facturas/:id/editar"         element={<FacturaProveedorFormPage />} />
          <Route path="compras/reportes/ap-aging"           element={<ApAgingPage />} />
          <Route path="compras/reportes/libro-compras"      element={<LibroComprasPage />} />

          <Route path="compras/ordenes"             element={<OrdenesCompraPage />} />
          <Route path="compras/ordenes/nueva"       element={<OrdenCompraFormPage />} />
          <Route path="compras/ordenes/:id"         element={<OrdenCompraFormPage />} />
          <Route path="compras/ordenes/:id/editar"  element={<OrdenCompraFormPage />} />

          <Route path="bancos"            element={<BancosPage />} />
          <Route path="bancos/nuevo"      element={<BancoFormPage />} />
          <Route path="bancos/:id"        element={<BancoDetallePage />} />
          <Route path="bancos/:id/editar" element={<BancoFormPage />} />

          <Route path="contabilidad/catalogo" element={<CatalogoPage />} />
          <Route path="contabilidad/asientos" element={<LibroDiarioPage />} />
          <Route path="contabilidad/activos"  element={<ComingSoon title="Activos Fijos" />} />

          <Route path="inventario"                       element={<InventarioPage />} />
          <Route path="inventario/nuevo"                 element={<ArticuloFormPage />} />
          <Route path="inventario/:id/editar"            element={<ArticuloFormPage />} />
          <Route path="inventario/importaciones"         element={<ImportacionesPage />} />
          <Route path="inventario/importaciones/nueva"   element={<ImportacionFormPage />} />
          <Route path="inventario/importaciones/:id"     element={<ImportacionFormPage />} />
          <Route path="inventario/expedientes"           element={<ExpedientesPage />} />
          <Route path="inventario/expedientes/nuevo"     element={<ExpedienteDetallePage />} />
          <Route path="inventario/expedientes/:id"       element={<ExpedienteDetallePage />} />
          <Route path="inventario/almacenes"             element={<AlmacenesPage />} />
          <Route path="inventario/grupos"                element={<GruposPage />} />
          <Route path="inventario/centros"               element={<CentrosPage />} />
          <Route path="inventario/ajustes"               element={<AjustesInventarioPage />} />
          <Route path="inventario/produccion"            element={<ProduccionPage />} />
          <Route path="inventario/entregas"              element={<EntregasPage />} />
          <Route path="inventario/ubicaciones"           element={<UbicacionesPage />} />
          <Route path="inventario/movimientos"           element={<MovimientosPage />} />

          <Route path="reportes" element={<ReportesPage />}>
            <Route path="balance-general"    element={<BalanceGeneralPage />} />
            <Route path="estado-resultados"  element={<EstadoResultadosPage />} />
            <Route path="flujo-efectivo"     element={<FlujoEfectivoPage />} />
            <Route path="tasas-rendimiento"  element={<TasasRendimientoPage />} />
            <Route path="movimiento-capital" element={<MovimientoCapitalPage />} />
            <Route path="balanza"            element={<BalanzaPage />} />
            <Route path="libro-diario"       element={<LibroDiarioPage />} />
            <Route path="libro-mayor"        element={<LibroMayorPage />} />
          </Route>

          <Route path="proyectos"                   element={<ComingSoon title="Proyectos" />} />
          <Route path="configuracion"                                element={<ConfiguracionPage />} />
          <Route path="configuracion/integraciones"               element={<IntegracionesPage />} />
          <Route path="configuracion/unidades-medida"             element={<UnidadesMedidaPage />} />
          <Route path="configuracion/usuarios"                    element={<UsuariosPage />} />
          <Route path="configuracion/empresas"                               element={<EmpresasPage />} />
          <Route path="configuracion/empresas/nueva"                          element={<EmpresaFormPage />} />
          <Route path="configuracion/empresas/sucursales"                     element={<SucursalesPage />} />
          <Route path="configuracion/empresas/series"                         element={<SeriesDocumentalesPage />} />
          <Route path="configuracion/empresas/facturacion-electronica"        element={<ElectronicInvoicingPage />} />
          <Route path="configuracion/empresas/bancos"                         element={<BankProfilesPage />} />
          <Route path="configuracion/empresas/:id"                            element={<EmpresaFormPage />} />
          <Route path="configuracion/empresas/:id/usuarios"                   element={<CompanyUsersPage />} />
          <Route path="configuracion/empresas/:id/sucursales"                 element={<SucursalesPage />} />
          <Route path="admin"                                                  element={<Navigate to="/admin/platform" replace />} />
          <Route path="admin/platform"                                         element={<AdminRoute><PlatformAdminPage /></AdminRoute>} />
          <Route path="onboarding"                                             element={<AdminRoute><OnboardingWizardPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
