import * as Sentry from '@sentry/react'

/**
 * Único punto por el que la aplicación habla con el panel de errores.
 *
 * Sentry estaba inicializado en main.tsx y nada más: no se identificaba al
 * usuario ni al cliente, así que un error llegaba sin decir a quién le pasó, y
 * el ErrorBoundary no reportaba nada.
 */

const activo = (): boolean => Boolean(import.meta.env.VITE_SENTRY_DSN)

/** Tras iniciar sesión o recuperar el perfil: así se sabe a quién le falló. */
export function identificarUsuario(datos: {
  id?: string
  email?: string
  tenantId?: string | null
  empresaId?: string | null
}): void {
  if (!activo()) return
  try {
    Sentry.setUser(datos.id ? { id: datos.id, email: datos.email } : null)
    Sentry.setTag('tenant', datos.tenantId ?? 'sin-tenant')
    Sentry.setTag('empresa', datos.empresaId ?? 'sin-empresa')
  } catch { /* nunca debe estorbar al usuario */ }
}

/** Al cerrar sesión: los errores posteriores no son de esa persona. */
export function olvidarUsuario(): void {
  if (!activo()) return
  try {
    Sentry.setUser(null)
    Sentry.setTag('tenant', 'sin-tenant')
    Sentry.setTag('empresa', 'sin-empresa')
  } catch { /* ignorado */ }
}

/** Un fallo de pantalla capturado por el ErrorBoundary. */
export function reportarErrorDePantalla(error: Error, componentStack?: string): void {
  if (!activo()) return
  try {
    Sentry.withScope((scope) => {
      if (componentStack) scope.setContext('react', { componentStack })
      Sentry.captureException(error)
    })
  } catch { /* ignorado */ }
}

/**
 * Enlaza el fallo del navegador con el del servidor: el backend devuelve
 * X-Request-Id y con él se encuentra la línea exacta en su registro.
 */
export function anotarFalloDeServidor(datos: { metodo?: string; url?: string; estado?: number; peticionId?: string }): void {
  if (!activo()) return
  try {
    Sentry.addBreadcrumb({
      category: 'http',
      level: 'error',
      message: `${datos.metodo ?? ''} ${datos.url ?? ''} → ${datos.estado ?? ''}`.trim(),
      data: { peticionId: datos.peticionId },
    })
  } catch { /* ignorado */ }
}
