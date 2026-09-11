import type { ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'

/**
 * Gating de botones por permiso (matriz de roles): `modulo:submodulo:accion`.
 * - Admin/superadmin → siempre true (lo resuelve el store).
 * - Permisos aún no cargados (tras el login, hasta que llega /auth/me) → NO ocultar: el
 *   backend protege con 403 y así se evita el parpadeo de botones al entrar.
 *
 *   const can = useCan()
 *   {can('ventas:facturas:create') && <Button>Nueva factura</Button>}
 *   <Can slug="ventas:facturas:delete"><Button danger /></Can>
 */
export function useCan(): (slug: string) => boolean {
  const can  = useAuthStore(s => s.can)
  const size = useAuthStore(s => s.permissions.size)
  return (slug: string) => (size === 0 ? true : can(slug))
}

export function Can({ slug, children, fallback = null }: { slug: string; children: ReactNode; fallback?: ReactNode }) {
  const can = useCan()
  return <>{can(slug) ? children : fallback}</>
}
