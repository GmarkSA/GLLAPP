import type { CSSProperties } from 'react'
import { companiesApi } from '../api/companies'

/** Color y resalte uniforme de la guía de configuración (bloques que el usuario debe completar). */
export const GUIDE_COLOR = '#1faec2'
export const guideHighlight: CSSProperties = {
  borderColor: GUIDE_COLOR,
  boxShadow: '0 0 0 3px rgba(31,174,194,0.28)',
}

/** Rutas de cada paso cuando se llega desde la guía (`from=setup`). */
export const SETUP_ROUTES = {
  guide:    '/onboarding/setup',
  empresa:  (companyId: string) => `/configuracion/empresas/${companyId}?from=setup`,
  perfil:   '/configuracion?tab=organization&from=setup',
  catalogo: '/contabilidad/catalogo?from=setup',
  contabilidad: '/configuracion?tab=contabilidad&from=setup',
  clases_af:    '/contabilidad/clases-activo-fijo?from=setup',
  impuestos:    '/configuracion?tab=taxes&from=setup',
  clientes:     '/ventas/clientes/nuevo?from=setup',
  proveedores:  '/compras/proveedores/nuevo?from=setup',
  bancos:       '/bancos/nuevo?from=setup',
}

/** stepId → fecha ISO en que el usuario lo completó desde la guía, o 'skipped' si eligió "Omitir por ahora".
 *  `null` = la empresa nunca ha usado la guía. */
export const SKIPPED = 'skipped'
export type SetupStepFlags = Record<string, string>

export async function getSetupStepFlags(companyId: string): Promise<SetupStepFlags | null> {
  const s = await companiesApi.getSettings(companyId).catch(() => null)
  const flags = s?.settingsJson?.setupSteps
  return flags && typeof flags === 'object' ? (flags as SetupStepFlags) : null
}

/** Persiste el paso como completado. settingsJson se reemplaza completo en backend → leer, fusionar y escribir. */
export async function markSetupStepDone(companyId: string, stepId: string): Promise<void> {
  await setSetupStepFlag(companyId, stepId, new Date().toISOString())
}

/** "Omitir por ahora": cuenta como resuelto para el progreso, pero la tarjeta queda marcada para volver. */
export async function markSetupStepSkipped(companyId: string, stepId: string): Promise<void> {
  await setSetupStepFlag(companyId, stepId, SKIPPED)
}

async function setSetupStepFlag(companyId: string, stepId: string, value: string): Promise<void> {
  const s = await companiesApi.getSettings(companyId).catch(() => null)
  const existing = s?.settingsJson ?? {}
  const setupSteps = { ...(existing.setupSteps ?? {}), [stepId]: value }
  await companiesApi.updateSettings(companyId, { settingsJson: { ...existing, setupSteps } } as any)
}
