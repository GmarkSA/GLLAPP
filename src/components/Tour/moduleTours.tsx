/**
 * Registro de micro-tours por módulo (Tour nativo de Ant Design).
 * Regla de diseño: ≤5 pasos, ~1 minuto, lenguaje de negocio, cada paso ancla un elemento REAL
 * (`data-tour="…"` en la pantalla) y el último paso termina en una acción.
 */
export interface ModuleTourStep {
  anchor:       string          // valor de data-tour del elemento a resaltar
  title:        string
  description:  string
  placement?:   'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftTop' | 'rightTop'
  cta?:         string          // texto del botón final (solo último paso)
}

export interface ModuleTourDef {
  key:       string                        // identificador (persistencia)
  name:      string                        // nombre visible del módulo
  route:     string                        // ruta donde viven las anclas (el tour corre aquí)
  match:     (pathname: string) => boolean // el usuario está "dentro" del módulo (para ofrecer relanzarlo)
  minutes:   number
  intro:     string
  ctaRoute?: string                        // a dónde lleva la acción final
  steps:     ModuleTourStep[]
}

export const MODULE_TOURS: ModuleTourDef[] = [
  {
    key: 'ventas', name: 'Ventas', route: '/ventas/facturas', match: p => p.startsWith('/ventas'),
    minutes: 1,
    intro: 'En un minuto te mostramos lo esencial: clientes, cotizaciones, facturas con FEL y cobros. Luego creas tu primera factura.',
    ctaRoute: '/ventas/facturas/nueva',
    steps: [
      { anchor: 'ventas-clientes',     placement: 'right',
        title: 'Aquí viven tus clientes',
        description: 'Registra clientes con NIT/CUI (se autocompletan desde SAT), define crédito y condiciones de pago. Todo lo que factures parte de aquí.' },
      { anchor: 'ventas-cotizaciones', placement: 'right',
        title: 'Cotiza y convierte en factura',
        description: 'Crea cotizaciones, envíalas por correo y, cuando el cliente acepte, conviértelas en factura con un clic — sin volver a capturar.' },
      { anchor: 'ventas-acciones',     placement: 'bottomRight',
        title: 'FEL, PDF y correo desde la misma fila',
        description: 'Cada factura se certifica en SAT (FEL), se imprime en el formato que elijas, se envía al cliente y se cobra sin salir del listado.' },
      { anchor: 'ventas-cxc',          placement: 'bottom',
        title: 'Cobra y mira quién te debe',
        description: 'Registra cobros (efectivo, transferencia, tarjeta) y sigue la cartera por antigüedad: sabrás a quién llamar hoy.' },
      { anchor: 'ventas-nueva',        placement: 'bottomRight',
        title: '¿Listo? Haz tu primera factura',
        description: 'Con el cliente y el producto cargados, tu primera factura toma menos de un minuto. Te acompañamos en el formulario.',
        cta: 'Crear mi primera factura →' },
    ],
  },
]

export const getTourForPath = (pathname: string) => MODULE_TOURS.find(t => t.match(pathname))

/** "Tour visto" por usuario y módulo. T1: navegador (clave con id de usuario). T3: servidor + métricas. */
export const tourStorageKey = (userId: string | undefined, key: string) => `lucia_tour_v1_${userId ?? 'anon'}_${key}`
export const isTourSeen = (userId: string | undefined, key: string) => { try { return !!localStorage.getItem(tourStorageKey(userId, key)) } catch { return false } }
export const markTour = (userId: string | undefined, key: string, value: 'done' | 'skipped') => { try { localStorage.setItem(tourStorageKey(userId, key), `${value}:${new Date().toISOString()}`) } catch { /* sin storage */ } }
