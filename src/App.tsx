import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './store/authStore'
import { useCompanyStore } from './store/companyStore'
import MainLayout from './layouts/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

// Carga inmediata — rutas críticas
import LoginPage    from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import SetPasswordPage from './pages/auth/SetPasswordPage'
import OlvideContrasenaPage from './pages/auth/OlvideContrasenaPage'

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
const BankProfilesPage           = lazy(() => import('./pages/configuracion/empresas/BankProfilesPage'))
const PlantillasImpresionPage    = lazy(() => import('./pages/configuracion/PlantillasImpresionPage'))
const PlantillasCorreoPage       = lazy(() => import('./pages/configuracion/PlantillasCorreoPage'))
const PlatformAdminPage          = lazy(() => import('./pages/admin/PlatformAdminPage'))
const CompanyUsersPage       = lazy(() => import('./pages/configuracion/empresas/CompanyUsersPage'))
const OnboardingWizardPage   = lazy(() => import('./pages/onboarding/OnboardingWizardPage'))
const SetupGuidePage         = lazy(() => import('./pages/onboarding/SetupGuidePage'))
const OnboardingRapidoPage   = lazy(() => import('./pages/onboarding/OnboardingRapidoPage'))
const SubscriptionPage       = lazy(() => import('./pages/billing/SubscriptionPage'))

// Ventas
const ClientesPage           = lazy(() => import('./pages/ventas/clientes/ClientesPage'))
const ClienteFormPage        = lazy(() => import('./pages/ventas/clientes/ClienteFormPage'))
const ClienteDetallePage     = lazy(() => import('./pages/ventas/clientes/ClienteDetallePage'))
const FacturasPage                  = lazy(() => import('./pages/ventas/facturas/FacturasPage'))
const FacturaFormPage               = lazy(() => import('./pages/ventas/facturas/FacturaFormPage'))
const FacturaDetallePage            = lazy(() => import('./pages/ventas/facturas/FacturaDetallePage'))
const FacturasRecurrentesPage       = lazy(() => import('./pages/ventas/facturas-recurrentes/FacturasRecurrentesPage'))
const FacturaRecurrenteFormPage     = lazy(() => import('./pages/ventas/facturas-recurrentes/FacturaRecurrenteFormPage'))
const EstimacionesPage       = lazy(() => import('./pages/ventas/estimaciones/EstimacionesPage'))
const EstimacionFormPage     = lazy(() => import('./pages/ventas/estimaciones/EstimacionFormPage'))
const EstimacionDetallePage  = lazy(() => import('./pages/ventas/estimaciones/EstimacionDetallePage'))
const EstimacionPrintPage    = lazy(() => import('./pages/ventas/estimaciones/EstimacionPrintPage'))
const FacturaImprimirPage    = lazy(() => import('./pages/ventas/facturas/FacturaImprimirPage'))
const NotasCreditoPage       = lazy(() => import('./pages/ventas/notas-credito/NotasCreditoPage'))
const NotaCreditoFormPage    = lazy(() => import('./pages/ventas/notas-credito/NotaCreditoFormPage'))
const NotaCreditoDetallePage = lazy(() => import('./pages/ventas/notas-credito/NotaCreditoDetallePage'))
const PagosRecibidosPage     = lazy(() => import('./pages/ventas/pagos-recibidos/PagosRecibidosPage'))
const PagoRecibidoFormPage   = lazy(() => import('./pages/ventas/pagos-recibidos/PagoRecibidoFormPage'))
const PagoRecibidoDetallePage = lazy(() => import('./pages/ventas/pagos-recibidos/PagoRecibidoDetallePage'))

// Compras — Pagos Realizados
const PagosRealizadosPage      = lazy(() => import('./pages/compras/pagos-realizados/PagosRealizadosPage'))
const PagoRealizadoFormPage    = lazy(() => import('./pages/compras/pagos-realizados/PagoRealizadoFormPage'))
const ChequePrintPage          = lazy(() => import('./pages/compras/pagos-realizados/ChequePrintPage'))
const ChequeLotePrintPage      = lazy(() => import('./pages/compras/pagos-realizados/ChequeLotePrintPage'))
const TransferenciaPrintPage        = lazy(() => import('./pages/bancos/TransferenciaPrintPage'))
const ConciliacionImprimirPage      = lazy(() => import('./pages/bancos/ConciliacionImprimirPage'))
const NotasCreditoProveedorPage          = lazy(() => import('./pages/compras/notas-credito-proveedor/NotasCreditoProveedorPage'))
const NotaCreditoProveedorFormPage       = lazy(() => import('./pages/compras/notas-credito-proveedor/NotaCreditoProveedorFormPage'))
const NotaCreditoProveedorDetallePage    = lazy(() => import('./pages/compras/notas-credito-proveedor/NotaCreditoProveedorDetallePage'))
const ReporteProyectadoPagosPage = lazy(() => import('./pages/reportes/ReporteProyectadoPagosPage'))

// Compras
const LibroVentasPage          = lazy(() => import('./pages/reportes/LibroVentasPage'))

const ProveedoresPage          = lazy(() => import('./pages/compras/proveedores/ProveedoresPage'))
const ProveedorFormPage        = lazy(() => import('./pages/compras/proveedores/ProveedorFormPage'))
const ProveedorDetallePage     = lazy(() => import('./pages/compras/proveedores/ProveedorDetallePage'))
const FacturasProveedorPage         = lazy(() => import('./pages/compras/facturas/FacturasProveedorPage'))
const FacturaProveedorFormPage      = lazy(() => import('./pages/compras/facturas/FacturaProveedorFormPage'))
const FacturaProveedorDetallePage   = lazy(() => import('./pages/compras/facturas/FacturaProveedorDetallePage'))
const DteSatPage               = lazy(() => import('./pages/compras/dte-sat/DteSatPage'))
const DteSatVentasPage         = lazy(() => import('./pages/ventas/dte-sat/DteSatVentasPage'))
const AnticiposProveedorPage   = lazy(() => import('./pages/compras/anticipos-proveedor/AnticiposProveedorPage'))
const ApAgingPage              = lazy(() => import('./pages/reportes/ApAgingPage'))
const ArAgingPage              = lazy(() => import('./pages/reportes/ArAgingPage'))
const LibroComprasPage         = lazy(() => import('./pages/reportes/LibroComprasPage'))
const DeclaracionIvaPage       = lazy(() => import('./pages/reportes/DeclaracionIvaPage'))
const OrdenesCompraPage        = lazy(() => import('./pages/compras/ordenes/OrdenesCompraPage'))
const OrdenCompraFormPage      = lazy(() => import('./pages/compras/ordenes/OrdenCompraFormPage'))
const OrdenCompraDetallePage   = lazy(() => import('./pages/compras/ordenes/OrdenCompraDetallePage'))

// Bancos
const CuentasBancariasPage = lazy(() => import('./pages/bancos/CuentasBancariasPage'))
const CuentaFormPage       = lazy(() => import('./pages/bancos/CuentaFormPage'))
const TransaccionesPage    = lazy(() => import('./pages/bancos/TransaccionesPage'))
const ConciliacionPage     = lazy(() => import('./pages/bancos/ConciliacionPage'))
const TransferenciaPage    = lazy(() => import('./pages/bancos/TransferenciaPage'))
const ImportarEstadoPage   = lazy(() => import('./pages/bancos/ImportarEstadoPage'))
const ReglasBancariasPage    = lazy(() => import('./pages/bancos/ReglasBancariasPage'))
const BankPaymentConfigPage    = lazy(() => import('./pages/bancos/BankPaymentConfigPage'))
const EmisionLoteChequesPage   = lazy(() => import('./pages/bancos/EmisionLoteChequesPage'))

// Contabilidad
const CatalogoPage               = lazy(() => import('./pages/contabilidad/CatalogoPage'))
const CentrosCostoPage           = lazy(() => import('./pages/contabilidad/centros-costo/CentrosCostoPage'))
const CentrosBeneficioPage       = lazy(() => import('./pages/contabilidad/centros-beneficio/CentrosBeneficioPage'))
const BloqueoTransaccionesPage   = lazy(() => import('./pages/contabilidad/bloqueo-transacciones/BloqueoTransaccionesPage'))
const ActivosFijosPage           = lazy(() => import('./pages/contabilidad/activos-fijos/ActivosFijosPage'))
const ActivoFijoDetallePage      = lazy(() => import('./pages/contabilidad/activos-fijos/ActivoFijoDetallePage'))
const ClasesActivoFijoPage       = lazy(() => import('./pages/contabilidad/activos-fijos/ClasesActivoFijoPage'))
const ReporteActivosFijosPage    = lazy(() => import('./pages/reportes/ReporteActivosFijosPage'))
// Diarios
const DiariosManualesPage        = lazy(() => import('./pages/contabilidad/diarios-manuales/DiariosManualesPage'))
const DiarioManualFormPage       = lazy(() => import('./pages/contabilidad/diarios-manuales/DiarioManualFormPage'))
const DiariosRecurrentesPage     = lazy(() => import('./pages/contabilidad/diarios-recurrentes/DiariosRecurrentesPage'))
const DiarioRecurrenteFormPage   = lazy(() => import('./pages/contabilidad/diarios-recurrentes/DiarioRecurrenteFormPage'))
// Presupuesto
const PresupuestosPage       = lazy(() => import('./pages/contabilidad/presupuesto/PresupuestosPage'))
const PresupuestoFormPage    = lazy(() => import('./pages/contabilidad/presupuesto/PresupuestoFormPage'))
const PresupuestoDetallePage = lazy(() => import('./pages/contabilidad/presupuesto/PresupuestoDetallePage'))
const PresupuestoVsRealPage  = lazy(() => import('./pages/contabilidad/presupuesto/PresupuestoVsRealPage'))
const AjusteMonedaListPage    = lazy(() => import('./pages/contabilidad/ajuste-moneda/AjusteMonedaListPage'))
const AjusteMonedaDetallePage = lazy(() => import('./pages/contabilidad/ajuste-moneda/AjusteMonedaDetallePage'))
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
const RentabilidadCentrosBeneficioPage = lazy(() => import('./pages/reportes/RentabilidadCentrosBeneficioPage'))
const EjecucionCentrosCostoPage        = lazy(() => import('./pages/reportes/EjecucionCentrosCostoPage'))
const ParametrosFiscalesPage = lazy(() => import('./pages/planillas/configuracion/ParametrosFiscalesPage'))
const DatosPatronoPage       = lazy(() => import('./pages/planillas/configuracion/DatosPatronoPage'))
const CuentasPlanillaPage    = lazy(() => import('./pages/planillas/configuracion/CuentasPlanillaPage'))
const CentrosTrabajoPage     = lazy(() => import('./pages/planillas/configuracion/CentrosTrabajoPage'))
const EmpleadosPage          = lazy(() => import('./pages/planillas/empleados/EmpleadosPage'))
const EmpleadoFormPage       = lazy(() => import('./pages/planillas/empleados/EmpleadoFormPage'))
const PeriodosPlanillaPage   = lazy(() => import('./pages/planillas/corrida/PeriodosPlanillaPage'))
const CorridaPlanillaPage    = lazy(() => import('./pages/planillas/corrida/CorridaPlanillaPage'))
const DetalleMensualPlanillaPage = lazy(() => import('./pages/planillas/corrida/DetalleMensualPlanillaPage'))
const BoletasPagoImprimirPage    = lazy(() => import('./pages/planillas/corrida/BoletasPagoImprimirPage'))
const FiniquitosListPage     = lazy(() => import('./pages/planillas/finiquito/FiniquitosListPage'))
const FiniquitoPage          = lazy(() => import('./pages/planillas/finiquito/FiniquitoPage'))

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6b7280' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a' }}>Módulo {title}</div>
      <div style={{ fontSize: 14, marginTop: 8 }}>En desarrollo — próximamente disponible</div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, user, bootstrapAuth } = useAuthStore()
  const clearCompany = useCompanyStore(s => s.clearCompany)

  useEffect(() => {
    if (isAuthenticated && !user) bootstrapAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resetear estado de empresa en memoria cuando se cierra sesión —
  // evita que la caché de companies/lastLoaded de un usuario
  // contamine la sesión del siguiente usuario en la misma pestaña.
  useEffect(() => {
    if (!isAuthenticated) clearCompany()
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/olvide-contrasena"      element={<OlvideContrasenaPage />} />
        <Route path="/definir-contrasena"     element={<SetPasswordPage mode="invite" />} />
        <Route path="/restablecer-contrasena" element={<SetPasswordPage mode="reset" />} />

        <Route path="/pos" element={<PrivateRoute><POSPage /></PrivateRoute>} />
        <Route path="/ventas/estimaciones/:id/imprimir" element={<PrivateRoute><EstimacionPrintPage /></PrivateRoute>} />
        <Route path="/ventas/facturas/:id/imprimir"     element={<PrivateRoute><FacturaImprimirPage /></PrivateRoute>} />
        <Route path="/planillas/mensual/:anio/:mes/imprimir-boletas" element={<PrivateRoute><BoletasPagoImprimirPage /></PrivateRoute>} />
        <Route path="/bancos/pagos-realizados/:id/cheque"         element={<PrivateRoute><ChequePrintPage /></PrivateRoute>} />
        <Route path="/bancos/pagos-realizados/:id/comprobante"  element={<PrivateRoute><TransferenciaPrintPage /></PrivateRoute>} />
        <Route path="/bancos/cheques/imprimir-lote"             element={<PrivateRoute><ChequeLotePrintPage /></PrivateRoute>} />
        <Route path="/bancos/:id/conciliacion/imprimir"         element={<PrivateRoute><ConciliacionImprimirPage /></PrivateRoute>} />

        <Route path="/" element={<PrivateRoute><ErrorBoundary><MainLayout /></ErrorBoundary></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="ventas/clientes"            element={<ClientesPage />} />
          <Route path="ventas/clientes/nuevo"      element={<ClienteFormPage />} />
          <Route path="ventas/clientes/:id"        element={<ClienteDetallePage />} />
          <Route path="ventas/clientes/:id/editar" element={<ClienteFormPage />} />

          <Route path="ventas/facturas"            element={<FacturasPage />} />
          <Route path="ventas/facturas/nueva"      element={<FacturaFormPage />} />
          <Route path="ventas/facturas/:id"        element={<FacturaDetallePage />} />
          <Route path="ventas/facturas/:id/editar" element={<FacturaFormPage />} />

          <Route path="ventas/facturas-recurrentes"            element={<FacturasRecurrentesPage />} />
          <Route path="ventas/facturas-recurrentes/nueva"      element={<FacturaRecurrenteFormPage />} />
          <Route path="ventas/facturas-recurrentes/:id/editar" element={<FacturaRecurrenteFormPage />} />

          <Route path="ventas/estimaciones"            element={<EstimacionesPage />} />
          <Route path="ventas/estimaciones/nueva"      element={<EstimacionFormPage />} />
          <Route path="ventas/estimaciones/:id"        element={<EstimacionDetallePage />} />
          <Route path="ventas/estimaciones/:id/editar" element={<EstimacionFormPage />} />

          <Route path="ventas/notas-credito"           element={<NotasCreditoPage />} />
          <Route path="ventas/notas-credito/nueva"     element={<NotaCreditoFormPage />} />
          <Route path="ventas/notas-credito/:id/editar" element={<NotaCreditoFormPage />} />
          <Route path="ventas/notas-credito/:id"       element={<NotaCreditoDetallePage />} />

          <Route path="ventas/pagos-recibidos"              element={<PagosRecibidosPage />} />
          <Route path="ventas/pagos-recibidos/nuevo"        element={<PagoRecibidoFormPage />} />
          <Route path="ventas/pagos-recibidos/:id"          element={<PagoRecibidoDetallePage />} />

          <Route path="compras/proveedores"              element={<ProveedoresPage />} />
          <Route path="compras/proveedores/nuevo"        element={<ProveedorFormPage />} />
          <Route path="compras/proveedores/:id"          element={<ProveedorDetallePage />} />
          <Route path="compras/proveedores/:id/editar"   element={<ProveedorFormPage />} />

          <Route path="compras/facturas"                element={<FacturasProveedorPage />} />
          <Route path="compras/facturas/nueva"          element={<FacturaProveedorFormPage />} />
          <Route path="compras/facturas/:id"            element={<FacturaProveedorDetallePage />} />
          <Route path="compras/facturas/:id/editar"     element={<FacturaProveedorFormPage />} />
          <Route path="compras/notas-credito-proveedor"              element={<NotasCreditoProveedorPage />} />
          <Route path="compras/notas-credito-proveedor/nueva"        element={<NotaCreditoProveedorFormPage />} />
          <Route path="compras/notas-credito-proveedor/:id"          element={<NotaCreditoProveedorDetallePage />} />
          <Route path="compras/notas-credito-proveedor/:id/editar"   element={<NotaCreditoProveedorFormPage />} />
          <Route path="compras/dte-sat"                     element={<DteSatPage />} />
          <Route path="compras/anticipos-proveedor"         element={<AnticiposProveedorPage />} />
          <Route path="ventas/dte-sat"                      element={<DteSatVentasPage />} />

          <Route path="bancos/pagos-realizados"              element={<PagosRealizadosPage />} />
          <Route path="bancos/pagos-realizados/nuevo"     element={<PagoRealizadoFormPage />} />
          <Route path="bancos/pagos-realizados/lote"      element={<EmisionLoteChequesPage />} />
          <Route path="bancos/config-pagos"               element={<BankPaymentConfigPage />} />

          <Route path="compras/ordenes"             element={<OrdenesCompraPage />} />
          <Route path="compras/ordenes/nueva"       element={<OrdenCompraFormPage />} />
          <Route path="compras/ordenes/:id"         element={<OrdenCompraDetallePage />} />
          <Route path="compras/ordenes/:id/editar"  element={<OrdenCompraFormPage />} />

          <Route path="bancos"                      element={<CuentasBancariasPage />} />
          <Route path="bancos/nuevo"               element={<CuentaFormPage />} />
          <Route path="bancos/importar"            element={<ImportarEstadoPage />} />
          <Route path="bancos/reglas"              element={<ReglasBancariasPage />} />
          <Route path="bancos/transferencias/nueva" element={<TransferenciaPage />} />
          <Route path="bancos/:id"                 element={<TransaccionesPage />} />
          <Route path="bancos/:id/editar"          element={<CuentaFormPage />} />
          <Route path="bancos/:id/conciliacion"    element={<ConciliacionPage />} />

          <Route path="contabilidad/catalogo"              element={<CatalogoPage />} />
          <Route path="contabilidad/activos-fijos"        element={<ActivosFijosPage />} />
          <Route path="contabilidad/activos-fijos/:id"    element={<ActivoFijoDetallePage />} />
          <Route path="contabilidad/clases-activo-fijo"   element={<ClasesActivoFijoPage />} />
          <Route path="contabilidad/diarios-manuales"            element={<DiariosManualesPage />} />
          <Route path="contabilidad/diarios-manuales/nuevo"      element={<DiarioManualFormPage />} />
          <Route path="contabilidad/diarios-manuales/:id"        element={<DiarioManualFormPage />} />
          <Route path="contabilidad/diarios-recurrentes"         element={<DiariosRecurrentesPage />} />
          <Route path="contabilidad/diarios-recurrentes/nueva"   element={<DiarioRecurrenteFormPage />} />
          <Route path="contabilidad/diarios-recurrentes/:id"     element={<DiarioRecurrenteFormPage />} />
          <Route path="contabilidad/presupuesto"              element={<PresupuestosPage />} />
          <Route path="contabilidad/presupuesto/nuevo"       element={<PresupuestoFormPage />} />
          <Route path="contabilidad/presupuesto/:id"         element={<PresupuestoDetallePage />} />
          <Route path="contabilidad/presupuesto/:id/vs-real" element={<PresupuestoVsRealPage />} />
          <Route path="contabilidad/ajuste-moneda"          element={<AjusteMonedaListPage />} />
          <Route path="contabilidad/ajuste-moneda/:id"      element={<AjusteMonedaDetallePage />} />
          <Route path="contabilidad/bloqueo-transacciones" element={<BloqueoTransaccionesPage />} />
          <Route path="contabilidad/centros-costo"        element={<CentrosCostoPage />} />
          <Route path="contabilidad/centros-beneficio"    element={<CentrosBeneficioPage />} />

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
            <Route path="libro-compras"      element={<LibroComprasPage />} />
            <Route path="libro-ventas"       element={<LibroVentasPage />} />
            <Route path="ap-aging"                   element={<ApAgingPage />} />
            <Route path="ar-aging"                   element={<ArAgingPage />} />
            <Route path="proyectado-pagos"           element={<ReporteProyectadoPagosPage />} />
            <Route path="activos-fijos"              element={<ReporteActivosFijosPage />} />
            <Route path="centros-beneficio"          element={<RentabilidadCentrosBeneficioPage />} />
            <Route path="centros-costo"              element={<EjecucionCentrosCostoPage />} />
            <Route path="declaracion-iva"            element={<DeclaracionIvaPage />} />
          </Route>

          <Route path="planillas/corridas"                           element={<PeriodosPlanillaPage />} />
          <Route path="planillas/corridas/:id"                       element={<CorridaPlanillaPage />} />
          <Route path="planillas/mensual/:anio/:mes"                 element={<DetalleMensualPlanillaPage />} />
          <Route path="planillas/finiquitos"                         element={<FiniquitosListPage />} />
          <Route path="planillas/finiquitos/nuevo/:empleadoId"       element={<FiniquitoPage />} />
          <Route path="planillas/finiquitos/:id"                     element={<FiniquitoPage />} />
          <Route path="planillas/empleados"                          element={<EmpleadosPage />} />
          <Route path="planillas/empleados/nuevo"                    element={<EmpleadoFormPage />} />
          <Route path="planillas/empleados/:id"                      element={<EmpleadoFormPage />} />
          <Route path="planillas/configuracion/parametros-fiscales" element={<ParametrosFiscalesPage />} />
          <Route path="planillas/configuracion/datos-patrono"       element={<DatosPatronoPage />} />
          <Route path="planillas/configuracion/cuentas-contables"   element={<CuentasPlanillaPage />} />
          <Route path="planillas/configuracion/centros-trabajo"    element={<CentrosTrabajoPage />} />

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
          <Route path="configuracion/plantillas-impresion"                   element={<PlantillasImpresionPage />} />
          <Route path="configuracion/plantillas-correo"                     element={<PlantillasCorreoPage />} />
          <Route path="configuracion/empresas/:id"                            element={<EmpresaFormPage />} />
          <Route path="configuracion/empresas/:id/usuarios"                   element={<CompanyUsersPage />} />
          <Route path="configuracion/empresas/:id/sucursales"                 element={<SucursalesPage />} />
          <Route path="admin"                                                  element={<Navigate to="/admin/platform" replace />} />
          <Route path="admin/platform"                                         element={<AdminRoute><PlatformAdminPage /></AdminRoute>} />
          <Route path="onboarding"                                             element={<OnboardingWizardPage />} />
          <Route path="onboarding/setup"                                       element={<SetupGuidePage />} />
          <Route path="onboarding/rapido"                                      element={<OnboardingRapidoPage />} />
          <Route path="configuracion/suscripcion"                              element={<SubscriptionPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
