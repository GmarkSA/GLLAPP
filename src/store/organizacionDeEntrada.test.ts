import { describe, it, expect, beforeEach } from 'vitest'
import { organizacionDeEntrada, recordarOrganizacion } from './authStore'

/**
 * Con qué organización (cliente) arranca la sesión.
 *
 * info@gllconsulting tiene acceso a Kaizen, Mario y LUUM. Antes se tomaba siempre
 * la primera de la lista —también al recargar la página—, así que cambiarse de
 * cliente no duraba nada: al siguiente F5 estaba de vuelta en Kaizen.
 */
const KAIZEN = 'org-kaizen'
const MARIO  = 'org-mario'
const LUUM   = 'org-luum'
const AJENA  = 'org-de-otro'

const usuario = (extra: any = {}) => ({ id: 'u-1', tenantIds: [KAIZEN, MARIO, LUUM], ...extra })

describe('organización con la que arranca la sesión', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

  it('manda la de esta pestaña', () => {
    sessionStorage.setItem('tenantId', LUUM)

    expect(organizacionDeEntrada(usuario())).toBe(LUUM)
  })

  it('sin nada en la pestaña, la última que usó ese usuario', () => {
    recordarOrganizacion('u-1', MARIO)

    expect(organizacionDeEntrada(usuario())).toBe(MARIO)
  })

  it('la última es por usuario: la de otro no se hereda', () => {
    recordarOrganizacion('u-2', MARIO)

    expect(organizacionDeEntrada(usuario())).toBe(KAIZEN)
  })

  it('una organización a la que ya no tiene acceso se descarta', () => {
    sessionStorage.setItem('tenantId', AJENA)
    recordarOrganizacion('u-1', AJENA)

    expect(organizacionDeEntrada(usuario())).toBe(KAIZEN)
  })

  it('un Super Admin de la plataforma puede quedarse en cualquiera', () => {
    sessionStorage.setItem('tenantId', AJENA)

    expect(organizacionDeEntrada(usuario({ isSuperAdmin: true }))).toBe(AJENA)
  })

  it('sin accesos no inventa ninguna', () => {
    expect(organizacionDeEntrada({ id: 'u-1', tenantIds: [] })).toBeUndefined()
  })
})
