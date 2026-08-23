/**
 * Tours guiados por módulo (Tour nativo de Ant Design).
 * Diseño acordado con el dueño (ago 2026):
 *  - NO se disparan solos: viven en la guía de configuración ("Conoce Lucía") y en el asistente de ayuda.
 *  - Son un RECORRIDO POR TAREAS: cada parada vive en su pantalla (el motor navega y resalta el botón real).
 *  - ≤5 paradas, ~2 min, lenguaje de negocio; la última parada es la más importante del módulo (DTE SAT).
 */
export interface ModuleTourStep {
  route:        string          // pantalla donde vive la parada (el motor navega ahí)
  anchor:       string          // data-tour del elemento a resaltar (si está dentro de un botón, se resalta el botón)
  title:        string
  description:  string
  placement?:   'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftTop' | 'rightTop'
  cta?:         string          // texto del botón final (solo última parada)
}

export interface ModuleTourDef {
  key:       string
  name:      string
  summary:   string                         // para la tarjeta de la guía
  match:     (pathname: string) => boolean  // el usuario está dentro del módulo (ayuda → "Tour de …")
  minutes:   number
  intro:     string
  steps:     ModuleTourStep[]
}

export const MODULE_TOURS: ModuleTourDef[] = [
  {
    key: 'ventas', name: 'Ventas', minutes: 2, match: p => p.startsWith('/ventas'),
    summary: 'Clientes → cotización → factura → DTE SAT emitidos',
    intro: 'Recorrido corto por Ventas: dónde creas tu cliente, tu primera cotización y tu primera factura, y cómo importar desde SAT todo lo que ya emitiste.',
    steps: [
      { route: '/ventas/clientes', anchor: 'ventas-cliente-nuevo', placement: 'bottomRight',
        title: '1 · Crea tu cliente',
        description: 'Todo parte del cliente: NIT/CUI (se autocompleta desde SAT), condiciones de pago y datos de contacto. Desde aquí registras el primero.' },
      { route: '/ventas/estimaciones', anchor: 'ventas-cotizacion-nueva', placement: 'bottomRight',
        title: '2 · Tu primera cotización',
        description: 'Cotiza, envíala por correo y, cuando te la acepten, conviértela en factura con un clic — sin volver a capturar nada.' },
      { route: '/ventas/facturas', anchor: 'ventas-nueva', placement: 'bottomRight',
        title: '3 · Tu primera factura',
        description: 'Se certifica en SAT (FEL), se imprime en el formato que elijas y se envía al cliente. Desde el mismo listado registras el cobro.' },
      { route: '/ventas/dte-sat', anchor: 'ventas-dte-importar', placement: 'bottomRight',
        title: '4 · DTE SAT emitidos — lo más importante si ya facturas fuera de Lucía',
        description: 'Importa desde la Agencia Virtual todo lo que tu empresa (o la de tu cliente, si eres firma contable) ya emitió: quedan como facturas de venta listas para contabilizar y cobrar.',
        cta: 'Listo, a trabajar →' },
    ],
  },
  {
    key: 'compras', name: 'Compras', minutes: 2, match: p => p.startsWith('/compras'),
    summary: 'Proveedores → orden de compra → factura de proveedor → DTE SAT recibidos',
    intro: 'Recorrido corto por Compras: dónde creas tu proveedor, tu primera orden y tu primera factura de proveedor, y cómo importar desde SAT todo lo que ya recibiste.',
    steps: [
      { route: '/compras/proveedores', anchor: 'compras-proveedor-nuevo', placement: 'bottomRight',
        title: '1 · Crea tu proveedor',
        description: 'NIT, régimen y condiciones de pago del proveedor. Si es agente de retención o pequeño contribuyente, Lucía aplica el tratamiento correcto en sus facturas.' },
      { route: '/compras/ordenes', anchor: 'compras-orden-nueva', placement: 'bottomRight',
        title: '2 · Tu primera orden de compra',
        description: 'Pide con orden, recibe y conviértela en factura de proveedor: controlas lo que pediste contra lo que te facturaron.' },
      { route: '/compras/facturas', anchor: 'compras-factura-nueva', placement: 'bottomRight',
        title: '3 · Tu primera factura de proveedor',
        description: 'Registra la compra con su IVA y retenciones; se contabiliza sola y queda lista para programar el pago.' },
      { route: '/compras/dte-sat', anchor: 'compras-dte-importar', placement: 'bottomRight',
        title: '4 · DTE SAT recibidos — lo más importante si quieres traer lo que ya compraste',
        description: 'Importa desde la Agencia Virtual las facturas que tus proveedores te emitieron: las revisas, las asocias al proveedor y quedan contabilizadas sin capturar.',
        cta: 'Listo, a trabajar →' },
    ],
  },
]

export const getTourByKey  = (key: string) => MODULE_TOURS.find(t => t.key === key)
export const getTourForPath = (pathname: string) => MODULE_TOURS.find(t => t.match(pathname))

/** "Tour visto" por usuario y módulo (navegador, clave con id de usuario). Persistencia en servidor + métricas: T3. */
export const tourStorageKey = (userId: string | undefined, key: string) => `lucia_tour_v1_${userId ?? 'anon'}_${key}`
export const isTourSeen = (userId: string | undefined, key: string) => { try { return !!localStorage.getItem(tourStorageKey(userId, key)) } catch { return false } }
export const markTour = (userId: string | undefined, key: string, value: 'done' | 'skipped') => { try { localStorage.setItem(tourStorageKey(userId, key), `${value}:${new Date().toISOString()}`) } catch { /* sin storage */ } }

/** Lanza un tour desde cualquier parte (guía, ayuda). */
export const abrirTour = (key: string) => window.dispatchEvent(new CustomEvent('lucia:abrir-tour', { detail: { key } }))
