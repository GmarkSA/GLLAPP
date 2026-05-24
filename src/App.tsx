import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ConfiguracionPage   from './pages/configuracion/ConfiguracionPage'
import IntegracionesPage   from './pages/configuracion/IntegracionesPage'

// ── Ventas ────────────────────────────────────────────────────────────────────
import ClientesPage           from './pages/ventas/clientes/ClientesPage'
import ClienteFormPage        from './pages/ventas/clientes/ClienteFormPage'
import FacturasPage           from './pages/ventas/facturas/FacturasPage'
import FacturaFormPage        from './pages/ventas/facturas/FacturaFormPage'
import FacturaDetallePage     from './pages/ventas/facturas/FacturaDetallePage'
import EstimacionesPage       from './pages/ventas/estimaciones/EstimacionesPage'
import EstimacionFormPage     from './pages/ventas/estimaciones/EstimacionFormPage'
import EstimacionPrintPage    from './pages/ventas/estimaciones/EstimacionPrintPage'
import FacturaImprimirPage    from './pages/ventas/facturas/FacturaImprimirPage'
import NotasCreditoPage       from './pages/ventas/notas-credito/NotasCreditoPage'
import NotaCreditoFormPage    from './pages/ventas/notas-credito/NotaCreditoFormPage'
import NotaCreditoDetallePage from './pages/ventas/notas-credito/NotaCreditoDetallePage'
import PagosRecibidosPage     from './pages/ventas/pagos-recibidos/PagosRecibidosPage'
import PagoRecibidoFormPage   from './pages/ventas/pagos-recibidos/PagoRecibidoFormPage'
import PagoRecibidoDetallePage from './pages/ventas/pagos-recibidos/PagoRecibidoDetallePage'

// ── Compras ───────────────────────────────────────────────────────────────────
import ProveedoresPage          from './pages/compras/proveedores/ProveedoresPage'
import ProveedorFormPage        from './pages/compras/proveedores/ProveedorFormPage'
import FacturasProveedorPage    from './pages/compras/facturas/FacturasProveedorPage'
import FacturaProveedorFormPage from './pages/compras/facturas/FacturaProveedorFormPage'
import OrdenesCompraPage        from './pages/compras/ordenes/OrdenesCompraPage'
import OrdenCompraFormPage      from './pages/compras/ordenes/OrdenCompraFormPage'

// ── Bancos ────────────────────────────────────────────────────────────────────
import BancosPage        from './pages/bancos/BancosPage'
import BancoFormPage     from './pages/bancos/BancoFormPage'
import BancoDetallePage  from './pages/bancos/BancoDetallePage'

// ── Contabilidad ──────────────────────────────────────────────────────────────
import CatalogoPage from './pages/contabilidad/CatalogoPage'

// ── Inventario ────────────────────────────────────────────────────────────────
import InventarioPage          from './pages/inventario/InventarioPage'
import ArticuloFormPage        from './pages/inventario/ArticuloFormPage'
import ImportacionesPage       from './pages/inventario/ImportacionesPage'
import ImportacionFormPage     from './pages/inventario/ImportacionFormPage'
import ExpedientesPage         from './pages/inventario/ExpedientesPage'
import ExpedienteDetallePage   from './pages/inventario/ExpedienteDetallePage'
import AlmacenesPage           from './pages/inventario/AlmacenesPage'
import GruposPage              from './pages/inventario/GruposPage'
import CentrosPage             from './pages/inventario/CentrosPage'
import AjustesInventarioPage   from './pages/inventario/AjustesInventarioPage'
import ProduccionPage          from './pages/inventario/ProduccionPage'
import EntregasPage            from './pages/inventario/EntregasPage'
import UbicacionesPage         from './pages/inventario/UbicacionesPage'
import MovimientosPage         from './pages/inventario/MovimientosPage'

// ── POS ───────────────────────────────────────────────────────────────────────
import POSPage from './pages/pos/POSPage'

// ── Reportes ──────────────────────────────────────────────────────────────────
import ReportesPage          from './pages/reportes/ReportesPage'
import BalanceGeneralPage    from './pages/reportes/BalanceGeneralPage'
import EstadoResultadosPage  from './pages/reportes/EstadoResultadosPage'
import FlujoEfectivoPage     from './pages/reportes/FlujoEfectivoPage'
import TasasRendimientoPage  from './pages/reportes/TasasRendimientoPage'
import MovimientoCapitalPage from './pages/reportes/MovimientoCapitalPage'
import BalanzaPage           from './pages/reportes/BalanzaPage'
import LibroDiarioPage       from './pages/reportes/LibroDiarioPage'
import LibroMayorPage        from './pages/reportes/LibroMayorPage'

import { ErrorBoundary } from './components/ErrorBoundary'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* POS Terminal — full screen, no sidebar */}
      <Route path="/pos" element={<PrivateRoute><POSPage /></PrivateRoute>} />

      {/* Print views — full page, no sidebar */}
      <Route path="/ventas/estimaciones/:id/imprimir" element={<PrivateRoute><EstimacionPrintPage /></PrivateRoute>} />
      <Route path="/ventas/facturas/:id/imprimir"     element={<PrivateRoute><FacturaImprimirPage /></PrivateRoute>} />

      <Route path="/" element={<PrivateRoute><ErrorBoundary><MainLayout /></ErrorBoundary></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* ── Ventas ─────────────────────────────────────────────────────── */}
        <Route path="ventas/clientes"            element={<ClientesPage />} />
        <Route path="ventas/clientes/nuevo"      element={<ClienteFormPage />} />
        <Route path="ventas/clientes/:id"        element={<ClienteFormPage />} />

        <Route path="ventas/facturas"            element={<FacturasPage />} />
        <Route path="ventas/facturas/nueva"      element={<FacturaFormPage />} />
        <Route path="ventas/facturas/:id"        element={<FacturaDetallePage />} />
        <Route path="ventas/facturas/:id/editar" element={<FacturaFormPage />} />

        <Route path="ventas/estimaciones"              element={<EstimacionesPage />} />
        <Route path="ventas/estimaciones/nueva"        element={<EstimacionFormPage />} />
        <Route path="ventas/estimaciones/:id"          element={<EstimacionFormPage />} />
        <Route path="ventas/estimaciones/:id/editar"   element={<EstimacionFormPage />} />

        <Route path="ventas/notas-credito"              element={<NotasCreditoPage />} />
        <Route path="ventas/notas-credito/nueva"         element={<NotaCreditoFormPage />} />
        <Route path="ventas/notas-credito/:id/editar"    element={<NotaCreditoFormPage />} />
        <Route path="ventas/notas-credito/:id"           element={<NotaCreditoDetallePage />} />

        <Route path="ventas/pagos-recibidos"          element={<PagosRecibidosPage />} />
        <Route path="ventas/pagos-recibidos/nuevo"   element={<PagoRecibidoFormPage />} />
        <Route path="ventas/pagos-recibidos/:id"     element={<PagoRecibidoDetallePage />} />

        {/* ── Compras ────────────────────────────────────────────────────── */}
        <Route path="compras/proveedores"            element={<ProveedoresPage />} />
        <Route path="compras/proveedores/nuevo"      element={<ProveedorFormPage />} />
        <Route path="compras/proveedores/:id"        element={<ProveedorFormPage />} />

        <Route path="compras/facturas"               element={<FacturasProveedorPage />} />
        <Route path="compras/facturas/nueva"         element={<FacturaProveedorFormPage />} />
        <Route path="compras/facturas/:id"           element={<FacturaProveedorFormPage />} />
        <Route path="compras/facturas/:id/editar"    element={<FacturaProveedorFormPage />} />

        <Route path="compras/ordenes"                element={<OrdenesCompraPage />} />
        <Route path="compras/ordenes/nueva"          element={<OrdenCompraFormPage />} />
        <Route path="compras/ordenes/:id"            element={<OrdenCompraFormPage />} />
        <Route path="compras/ordenes/:id/editar"     element={<OrdenCompraFormPage />} />

        <Route path="compras/gastos" element={<ComingSoon title="Gastos" />} />

        {/* ── Bancos ─────────────────────────────────────────────────────── */}
        <Route path="bancos"               element={<BancosPage />} />
        <Route path="bancos/nuevo"         element={<BancoFormPage />} />
        <Route path="bancos/:id"           element={<BancoDetallePage />} />
        <Route path="bancos/:id/editar"    element={<BancoFormPage />} />

        {/* ── Contabilidad ───────────────────────────────────────────────── */}
        <Route path="contabilidad/catalogo"  element={<CatalogoPage />} />
        <Route path="contabilidad/asientos"  element={<LibroDiarioPage />} />
        <Route path="contabilidad/activos"   element={<ComingSoon title="Activos Fijos" />} />

        {/* ── Inventario ─────────────────────────────────────────────────── */}
        <Route path="inventario"                             element={<InventarioPage />} />
        <Route path="inventario/nuevo"                       element={<ArticuloFormPage />} />
        <Route path="inventario/:id/editar"                  element={<ArticuloFormPage />} />
        <Route path="inventario/importaciones"               element={<ImportacionesPage />} />
        <Route path="inventario/importaciones/nueva"         element={<ImportacionFormPage />} />
        <Route path="inventario/importaciones/:id"           element={<ImportacionFormPage />} />
        <Route path="inventario/expedientes"                 element={<ExpedientesPage />} />
        <Route path="inventario/expedientes/nuevo"           element={<ExpedienteDetallePage />} />
        <Route path="inventario/expedientes/:id"             element={<ExpedienteDetallePage />} />
        <Route path="inventario/almacenes"                   element={<AlmacenesPage />} />
        <Route path="inventario/grupos"                      element={<GruposPage />} />
        <Route path="inventario/centros"                     element={<CentrosPage />} />
        <Route path="inventario/ajustes"                     element={<AjustesInventarioPage />} />
        <Route path="inventario/produccion"                  element={<ProduccionPage />} />
        <Route path="inventario/entregas"                    element={<EntregasPage />} />
        <Route path="inventario/ubicaciones"                 element={<UbicacionesPage />} />
        <Route path="inventario/movimientos"                 element={<MovimientosPage />} />

        {/* ── Reportes ───────────────────────────────────────────────────── */}
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

        <Route path="proyectos"     element={<ComingSoon title="Proyectos" />} />
        <Route path="configuracion"              element={<ConfiguracionPage />} />
        <Route path="configuracion/integraciones" element={<IntegracionesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', color: '#8c8c8c',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#1B3A6B' }}>Módulo {title}</div>
      <div style={{ fontSize: 14, marginTop: 8 }}>En desarrollo — próximamente disponible</div>
    </div>
  )
}
