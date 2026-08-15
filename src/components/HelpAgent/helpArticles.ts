// ── Base de conocimiento del Agente de Ayuda (Fase 1, estática) ──────────────
// Cubre TODOS los módulos/submódulos reales de Lucía. Los nombres (modulo/submodulo)
// y las rutas se toman del menú real (src/layouts/MainLayout.tsx) — no inventar.
// La respuesta se genera a partir de módulo→submódulo; `pasos` solo se agregan
// donde el procedimiento es seguro/verificado.

export interface HelpArticle {
  id: string
  modulo: string              // nombre real del módulo (ej. 'Ventas')
  submodulo: string           // nombre real del submódulo (ej. 'Facturas de venta')
  ruta: string                // ruta real del menú (ej. '/ventas/facturas')
  keywords?: string[]         // sinónimos/frases naturales extra para el matching
  respuesta?: string          // override opcional; si no, se genera desde modulo→submodulo
  pasos?: string[]            // pasos opcionales (solo donde es seguro)
}

export const HELP_ARTICLES: HelpArticle[] = [
  // ── General ──
  { id: 'dashboard', modulo: 'General', submodulo: 'Dashboard', ruta: '/dashboard',
    keywords: ['inicio', 'resumen', 'panel', 'home'] },

  // ── Ventas ──
  { id: 'ventas-clientes', modulo: 'Ventas', submodulo: 'Clientes', ruta: '/ventas/clientes',
    keywords: ['cliente', 'contacto', 'alta cliente', 'crear cliente'] },
  { id: 'ventas-cotizaciones', modulo: 'Ventas', submodulo: 'Cotizaciones', ruta: '/ventas/estimaciones',
    keywords: ['cotizacion', 'estimacion', 'presupuesto de venta', 'cotizar'] },
  { id: 'ventas-facturas', modulo: 'Ventas', submodulo: 'Facturas de venta', ruta: '/ventas/facturas',
    keywords: ['facturar', 'emitir factura', 'fel', 'factura venta', 'nueva factura'],
    respuesta: 'Creá y gestionás tus facturas de venta (con FEL) en Ventas → Facturas de venta.',
    pasos: ['Entrá a Ventas → Facturas de venta → Nueva.',
            'Elegí el cliente, agregá los ítems y las cuentas.',
            'Completá los datos FEL si aplica y guardá.',
            'Emití el FEL para certificar la factura ante SAT.'] },
  { id: 'ventas-recurrentes', modulo: 'Ventas', submodulo: 'Facturas recurrentes', ruta: '/ventas/facturas-recurrentes',
    keywords: ['recurrente', 'suscripcion facturacion', 'factura automatica', 'plantilla'] },
  { id: 'ventas-notas-credito', modulo: 'Ventas', submodulo: 'Notas de crédito', ruta: '/ventas/notas-credito',
    keywords: ['nota credito', 'devolucion', 'anular factura venta', 'ncre'] },
  { id: 'ventas-pagos-recibidos', modulo: 'Ventas', submodulo: 'Pagos recibidos', ruta: '/ventas/pagos-recibidos',
    keywords: ['cobro', 'cobrar', 'pago recibido', 'abono', 'anticipo cliente'],
    respuesta: 'Registrá los cobros y anticipos de clientes en Ventas → Pagos recibidos.',
    pasos: ['Entrá a Ventas → Pagos recibidos → Nuevo.',
            'Elegí el cliente y el monto recibido.',
            'Aplicá el pago a una o varias facturas pendientes.',
            'Guardá para registrar el cobro.'] },
  { id: 'ventas-dte-emitidos', modulo: 'Ventas', submodulo: 'DTE SAT Emitidos', ruta: '/ventas/dte-sat',
    keywords: ['importar facturas emitidas', 'dte sat', 'portal sat', 'descargar emitidos'],
    respuesta: 'Importá tus facturas emitidas desde el portal SAT en Ventas → DTE SAT Emitidos.',
    pasos: ['Entrá a Ventas → DTE SAT Emitidos.',
            'Elegí el rango de fechas (máximo 3 meses por consulta, límite de SAT).',
            'Presioná Importar y esperá unos minutos.',
            'Recargá: los DTE quedan listos para contabilizar.'] },

  // ── Compras ──
  { id: 'compras-proveedores', modulo: 'Compras', submodulo: 'Proveedores', ruta: '/compras/proveedores',
    keywords: ['proveedor', 'alta proveedor', 'crear proveedor', 'nit'],
    respuesta: 'Das de alta y gestionás proveedores en Compras → Proveedores.',
    pasos: ['Entrá a Compras → Proveedores → Nuevo.',
            'Cargá el NIT, razón social y la Cuenta por Pagar (CxP).',
            'Guardá para poder asociarle facturas.'] },
  { id: 'compras-ordenes', modulo: 'Compras', submodulo: 'Órdenes de compra', ruta: '/compras/ordenes',
    keywords: ['orden compra', 'oc', 'pedido proveedor'] },
  { id: 'compras-facturas', modulo: 'Compras', submodulo: 'Facturas proveedor', ruta: '/compras/facturas',
    keywords: ['factura compra', 'gasto', 'registrar factura proveedor', 'contabilizar compra'] },
  { id: 'compras-notas-credito', modulo: 'Compras', submodulo: 'Notas de crédito', ruta: '/compras/notas-credito-proveedor',
    keywords: ['nota credito compra', 'devolucion proveedor'] },
  { id: 'compras-dte-recibidos', modulo: 'Compras', submodulo: 'DTE SAT Recibidos', ruta: '/compras/dte-sat',
    keywords: ['importar facturas recibidas', 'dte sat', 'portal sat', 'facturas proveedores', 'descargar recibidos'],
    respuesta: 'Importá las facturas de tus proveedores desde el portal SAT en Compras → DTE SAT Recibidos.',
    pasos: ['Entrá a Compras → DTE SAT Recibidos.',
            'Elegí el rango de fechas (máximo 3 meses por consulta, límite de SAT).',
            'Presioná Importar y esperá unos minutos.',
            'Recargá: los DTE aparecen listos para contabilizar.'] },
  { id: 'compras-anticipos', modulo: 'Compras', submodulo: 'Anticipos a proveedores', ruta: '/compras/anticipos-proveedor',
    keywords: ['anticipo proveedor', 'pago adelantado'] },

  // ── Bancos y Tesorería ──
  { id: 'bancos-cuentas', modulo: 'Bancos y Tesorería', submodulo: 'Cuentas bancarias', ruta: '/bancos',
    keywords: ['cuenta bancaria', 'banco', 'conciliacion'] },
  { id: 'bancos-pagos', modulo: 'Bancos y Tesorería', submodulo: 'Pagos a proveedores', ruta: '/bancos/pagos-realizados',
    keywords: ['pagar proveedor', 'pago realizado', 'cheque', 'transferencia', 'emitir pago'] },
  { id: 'bancos-lote-cheques', modulo: 'Bancos y Tesorería', submodulo: 'Emisión lote de cheques', ruta: '/bancos/pagos-realizados/lote',
    keywords: ['lote cheques', 'cheques masivos'] },
  { id: 'bancos-config', modulo: 'Bancos y Tesorería', submodulo: 'Config. cheques y ACH', ruta: '/bancos/config-pagos',
    keywords: ['configurar cheque', 'ach', 'formato cheque'] },

  // ── Contabilidad ──
  { id: 'cont-catalogo', modulo: 'Contabilidad', submodulo: 'Catálogo de cuentas', ruta: '/contabilidad/catalogo',
    keywords: ['plan de cuentas', 'nomenclatura', 'cuenta contable', 'catalogo cuentas'] },
  { id: 'cont-diarios-manuales', modulo: 'Contabilidad', submodulo: 'Diarios manuales', ruta: '/contabilidad/diarios-manuales',
    keywords: ['partida', 'asiento', 'diario', 'poliza', 'partida manual'] },
  { id: 'cont-diarios-recurrentes', modulo: 'Contabilidad', submodulo: 'Diarios recurrentes', ruta: '/contabilidad/diarios-recurrentes',
    keywords: ['asiento recurrente', 'partida recurrente'] },
  { id: 'cont-ajuste-moneda', modulo: 'Contabilidad', submodulo: 'Ajustes de moneda', ruta: '/contabilidad/ajuste-moneda',
    keywords: ['diferencial cambiario', 'ajuste moneda', 'tipo de cambio'] },
  { id: 'cont-bloqueo', modulo: 'Contabilidad', submodulo: 'Bloqueo de transacciones', ruta: '/contabilidad/bloqueo-transacciones',
    keywords: ['cierre periodo', 'bloquear fecha', 'periodo contable'] },

  // ── Activos Fijos ──
  { id: 'af-activos', modulo: 'Activos Fijos', submodulo: 'Activos fijos', ruta: '/contabilidad/activos-fijos',
    keywords: ['activo fijo', 'depreciacion', 'bien'] },
  { id: 'af-clases', modulo: 'Activos Fijos', submodulo: 'Clases de activo fijo', ruta: '/contabilidad/clases-activo-fijo',
    keywords: ['clase activo', 'categoria activo'] },

  // ── Financiero ──
  { id: 'fin-presupuesto', modulo: 'Financiero', submodulo: 'Presupuestos', ruta: '/contabilidad/presupuesto',
    keywords: ['presupuesto', 'presupuestar', 'presupuestos'] },
  { id: 'fin-centros-costo', modulo: 'Financiero', submodulo: 'Centros de costo', ruta: '/contabilidad/centros-costo',
    keywords: ['centro de costo', 'cc'] },
  { id: 'fin-division', modulo: 'Financiero', submodulo: 'División', ruta: '/contabilidad/centros-beneficio',
    keywords: ['division', 'centro de beneficio', 'cb'] },

  // ── Inventario ──
  { id: 'inv-articulos', modulo: 'Inventario', submodulo: 'Artículos', ruta: '/inventario',
    keywords: ['producto', 'articulo', 'item', 'crear producto'] },
  { id: 'inv-grupos', modulo: 'Inventario', submodulo: 'Grupos de artículos', ruta: '/inventario/grupos',
    keywords: ['grupo articulos', 'categoria producto'] },
  { id: 'inv-almacenes', modulo: 'Inventario', submodulo: 'Almacenes', ruta: '/inventario/almacenes',
    keywords: ['almacen', 'bodega'] },
  { id: 'inv-entregas', modulo: 'Inventario', submodulo: 'Entregas', ruta: '/inventario/entregas',
    keywords: ['entrega', 'despacho'] },
  { id: 'inv-expedientes', modulo: 'Inventario', submodulo: 'Expediente de importación', ruta: '/inventario/expedientes',
    keywords: ['expediente importacion', 'poliza importacion'] },
  { id: 'inv-produccion', modulo: 'Inventario', submodulo: 'Producción', ruta: '/inventario/produccion',
    keywords: ['produccion', 'ensamble', 'orden produccion'] },
  { id: 'inv-ubicaciones', modulo: 'Inventario', submodulo: 'Ubicación / POS', ruta: '/inventario/ubicaciones',
    keywords: ['ubicacion', 'ubicaciones pos'] },
  { id: 'inv-movimientos', modulo: 'Inventario', submodulo: 'Movimientos MIGO', ruta: '/inventario/movimientos',
    keywords: ['movimiento inventario', 'migo', 'entrada salida'] },

  // ── POS ──
  { id: 'pos', modulo: 'Terminal POS', submodulo: 'Terminal POS', ruta: '/pos',
    keywords: ['punto de venta', 'pos', 'caja', 'terminal'] },

  // ── Planillas ──
  { id: 'plan-corridas', modulo: 'Planillas', submodulo: 'Generar Planilla', ruta: '/planillas/corridas',
    keywords: ['generar planilla', 'nomina', 'corrida', 'pago sueldos'] },
  { id: 'plan-empleados', modulo: 'Planillas', submodulo: 'Empleados', ruta: '/planillas/empleados',
    keywords: ['empleado', 'colaborador', 'alta empleado'] },
  { id: 'plan-finiquitos', modulo: 'Planillas', submodulo: 'Finiquitos', ruta: '/planillas/finiquitos',
    keywords: ['finiquito', 'liquidacion', 'despido'] },
  { id: 'plan-parametros', modulo: 'Planillas', submodulo: 'Parámetros fiscales', ruta: '/planillas/configuracion/parametros-fiscales',
    keywords: ['parametros fiscales', 'igss', 'isr planilla'] },
  { id: 'plan-patrono', modulo: 'Planillas', submodulo: 'Datos del patrono', ruta: '/planillas/configuracion/datos-patrono',
    keywords: ['datos patrono', 'empresa patrono'] },
  { id: 'plan-cuentas', modulo: 'Planillas', submodulo: 'Cuentas contables', ruta: '/planillas/configuracion/cuentas-contables',
    keywords: ['cuentas contables planilla', 'contabilizacion planilla'] },
  { id: 'plan-centros-trabajo', modulo: 'Planillas', submodulo: 'Centros de trabajo', ruta: '/planillas/configuracion/centros-trabajo',
    keywords: ['centro de trabajo', 'sede'] },

  // ── Proyectos / Reportes ──
  { id: 'proyectos', modulo: 'Proyectos', submodulo: 'Proyectos', ruta: '/proyectos',
    keywords: ['proyecto', 'obra'] },
  { id: 'reportes', modulo: 'Reportes', submodulo: 'Reportes', ruta: '/reportes',
    keywords: ['reporte', 'informe', 'estado financiero', 'libros', 'balance'] },

  // ── Configuración (icono de engranaje) ──
  { id: 'cfg-general', modulo: 'Configuración', submodulo: 'Configuración', ruta: '/configuracion',
    keywords: ['configuracion', 'ajustes', 'engranaje', 'settings', 'configurar'],
    respuesta: 'La configuración del sistema está en el icono de engranaje (arriba). Desde ahí gestionás empresas, series, FEL, usuarios, plantillas, integraciones, cargas iniciales y tu suscripción.' },
  { id: 'cfg-empresas', modulo: 'Configuración', submodulo: 'Empresas', ruta: '/configuracion/empresas',
    keywords: ['empresa', 'datos de la empresa', 'razon social'] },
  { id: 'cfg-sucursales', modulo: 'Configuración', submodulo: 'Sucursales', ruta: '/configuracion/empresas/sucursales',
    keywords: ['sucursal', 'establecimiento'] },
  { id: 'cfg-series', modulo: 'Configuración', submodulo: 'Series', ruta: '/configuracion/empresas/series',
    keywords: ['serie', 'numeracion', 'correlativo'] },
  { id: 'cfg-fel', modulo: 'Configuración', submodulo: 'Facturación electrónica', ruta: '/configuracion/empresas/facturacion-electronica',
    keywords: ['fel', 'certificador', 'configurar fel', 'facturacion electronica'] },
  { id: 'cfg-bancos-empresa', modulo: 'Configuración', submodulo: 'Bancos', ruta: '/configuracion/empresas/bancos',
    keywords: ['bancos empresa', 'cuentas de la empresa'] },
  { id: 'cfg-usuarios', modulo: 'Configuración', submodulo: 'Usuarios', ruta: '/configuracion/usuarios',
    keywords: ['usuario', 'permisos', 'roles', 'crear usuario', 'bloquear usuario'] },
  { id: 'cfg-unidades', modulo: 'Configuración', submodulo: 'Unidades de medida', ruta: '/configuracion/unidades-medida',
    keywords: ['unidad de medida', 'unidades'] },
  { id: 'cfg-plantillas-correo', modulo: 'Configuración', submodulo: 'Plantillas de correo', ruta: '/configuracion/plantillas-correo',
    keywords: ['plantilla correo', 'email', 'plantilla email'] },
  { id: 'cfg-plantillas-impresion', modulo: 'Configuración', submodulo: 'Plantillas de impresión', ruta: '/configuracion/plantillas-impresion',
    keywords: ['plantilla impresion', 'formato factura', 'diseño factura'] },
  { id: 'cfg-integraciones', modulo: 'Configuración', submodulo: 'Integraciones', ruta: '/configuracion/integraciones',
    keywords: ['integracion', 'api', 'conectar'] },
  { id: 'cfg-cargas', modulo: 'Configuración', submodulo: 'Cargas iniciales', ruta: '/configuracion/cargas-iniciales',
    keywords: ['saldos iniciales', 'migracion', 'carga inicial', 'importar datos'] },
  { id: 'cfg-suscripcion', modulo: 'Configuración', submodulo: 'Suscripción', ruta: '/configuracion/suscripcion',
    keywords: ['suscripcion', 'plan', 'tarjeta', 'cobro', 'facturacion', 'cancelar suscripcion', 'voucher'],
    respuesta: 'Tu plan, la tarjeta de pago y el historial de cobros están en Configuración → Suscripción.',
    pasos: ['Entrá a Configuración → Suscripción.',
            'Ahí ves tu plan actual, podés cambiarlo y ver tus cobros.',
            'También podés descargar el voucher de cada cobro aprobado.'] },
]

// ── Normalización y matching ─────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar tildes (marcas diacríticas combinantes)
    .replace(/[^a-z0-9\s]/g, ' ')
}

/** Respuesta a mostrar: la propia del artículo o una generada desde módulo→submódulo. */
export function respuestaDe(a: HelpArticle): string {
  return a.respuesta ?? `Lo encontrás en ${a.modulo} → ${a.submodulo}.`
}

/** Texto del botón de deep-link. */
export function rutaLabelDe(a: HelpArticle): string {
  return `Ir a ${a.submodulo}`
}

/** Términos indexados de un artículo: submódulo + módulo + keywords. */
function terminosDe(a: HelpArticle): string[] {
  const base = `${a.submodulo} ${a.modulo} ${(a.keywords ?? []).join(' ')}`
  return normalizar(base).split(/\s+/).filter(w => w.length >= 3)
}

export interface HelpMatch {
  article: HelpArticle
  score: number
}

/**
 * Busca los artículos más relevantes contando coincidencias de términos
 * (submódulo/módulo/keywords) contra la consulta. Determinista (sin IA): en la
 * Fase 4 este motor se reemplaza por Claude anclado a esta misma base.
 */
export function buscarAyuda(query: string, limit = 3): HelpMatch[] {
  const q = normalizar(query)
  if (!q.trim()) return []
  const palabras = new Set(q.split(/\s+/).filter(w => w.length >= 3))

  const matches: HelpMatch[] = HELP_ARTICLES.map(article => {
    let score = 0
    for (const term of terminosDe(article)) {
      if (palabras.has(term) || q.includes(term)) score += 1
    }
    return { article, score }
  })

  return matches
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
