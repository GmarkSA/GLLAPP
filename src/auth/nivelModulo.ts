/**
 * Nivel de acceso que otorga un rol en un módulo, a partir de las casillas de su matriz
 * (Configuración › Roles). Misma semántica que el backend (acceso-empresa.ts):
 *   none = ninguna casilla del módulo · read = solo ver/exportar/imprimir · full = crea/edita/elimina/otros
 * El "Acceso por módulo" de la asignación por empresa solo puede RECORTAR este nivel, nunca ampliarlo.
 */
export type NivelModulo = 'full' | 'read' | 'none'

export const ACCIONES_LECTURA = ['read', 'export', 'print', 'view']
export const NIVEL_LABEL: Record<NivelModulo, string> = { full: 'Completo', read: 'Solo lectura', none: 'Sin acceso' }
const ORDEN: Record<NivelModulo, number> = { none: 0, read: 1, full: 2 }

type PermisoLike = { slug?: string; module?: string; action?: string }

export function nivelPorPermisos(perms: PermisoLike[], mod: string): NivelModulo {
  const del = perms.filter(p => (p.module ?? p.slug?.split(':')[0]) === mod)
  if (del.length === 0) return 'none'
  const accion = (p: PermisoLike) => p.action ?? p.slug?.split(':').pop() ?? ''
  return del.some(p => !ACCIONES_LECTURA.includes(accion(p))) ? 'full' : 'read'
}

/** Nivel efectivo = el menor entre lo que da el rol y el recorte guardado ('full' = sin recorte) */
export function nivelEfectivo(base: NivelModulo, override?: NivelModulo | null): NivelModulo {
  if (!override || override === 'full') return base
  return ORDEN[override] < ORDEN[base] ? override : base
}

/** Opciones del selector de recorte para un módulo: "según rol" + solo los niveles inferiores al del rol */
export function opcionesRecorte(base: NivelModulo): Array<{ value: NivelModulo; label: string }> {
  const ops: Array<{ value: NivelModulo; label: string }> = [{ value: 'full', label: `Según rol · ${NIVEL_LABEL[base]}` }]
  if (base === 'full') ops.push({ value: 'read', label: 'Solo lectura' })
  if (base !== 'none') ops.push({ value: 'none', label: 'Sin acceso' })
  return ops
}

/** Valor a mostrar en el selector: un recorte igual o mayor al nivel del rol equivale a "según rol" */
export function valorSelector(base: NivelModulo, override?: NivelModulo | null): NivelModulo {
  if (!override || override === 'full') return 'full'
  return ORDEN[override] < ORDEN[base] ? override : 'full'
}
