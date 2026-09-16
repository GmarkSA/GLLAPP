import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store/authStore'
import { nivelPorPermisos, nivelEfectivo, opcionesRecorte, valorSelector } from './nivelModulo'

/**
 * Quién ve qué.
 *
 * Decide el menú, las rutas y, desde hace poco, cada botón de acción. Un error
 * aquí tiene dos caras: esconder algo a quien debe verlo, o mostrar a un usuario
 * lo que no le toca. La segunda ya ocurrió: un administrador con una empresa
 * asignada seguía viéndolo todo porque su rol general mandaba sobre la asignación.
 *
 * El backend es quien manda de verdad y responde 403; esto es la presentación,
 * pero tiene que coincidir con él.
 */
describe('Permisos del usuario', () => {
  const entrar = (user: any, permisos: string[] = []) =>
    useAuthStore.setState({ user, permissions: new Set(permisos) })

  beforeEach(() => {
    useAuthStore.setState({ user: null, permissions: new Set() })
  })

  const can = (slug: string) => useAuthStore.getState().can(slug)
  const canAny = (prefijo: string) => useAuthStore.getState().canAny(prefijo)

  describe('un usuario con rol acotado', () => {
    beforeEach(() => {
      entrar({ id: 'u1', email: 'contador@x', roles: [{ name: 'contador' }] },
        ['ventas:facturas:read', 'ventas:facturas:create', 'contabilidad:asientos:read'])
    })

    it('puede lo que tiene marcado', () => {
      expect(can('ventas:facturas:create')).toBe(true)
    })

    it('no puede lo que no tiene marcado', () => {
      expect(can('ventas:facturas:delete')).toBe(false)
      expect(can('planillas:corridas:create')).toBe(false)
    })

    it('ve el módulo si tiene cualquier permiso dentro', () => {
      expect(canAny('ventas')).toBe(true)
      expect(canAny('contabilidad')).toBe(true)
      expect(canAny('planillas')).toBe(false)
    })
  })

  describe('un administrador', () => {
    it('puede todo aunque la lista venga vacía', () => {
      entrar({ id: 'u2', email: 'admin@x', roles: [{ name: 'admin' }] }, [])
      expect(can('planillas:corridas:delete')).toBe(true)
      expect(canAny('bancos')).toBe(true)
    })

    // Tras iniciar sesión los roles llegan como texto; tras pedir el perfil, como objetos
    it('se reconoce igual si el rol llega como texto', () => {
      entrar({ id: 'u2', email: 'admin@x', roles: ['admin'] }, [])
      expect(can('planillas:corridas:delete')).toBe(true)
    })

    it('el Super Admin de plataforma también', () => {
      entrar({ id: 'u3', email: 'gll@x', isSuperAdmin: true, roles: [] }, [])
      expect(can('configuracion:usuarios:delete')).toBe(true)
    })
  })

  // El caso que el dueño encontró probando: administrador con una empresa asignada
  describe('un administrador acotado por su asignación a una empresa', () => {
    beforeEach(() => {
      entrar({
        id: 'u4',
        email: 'edwin@x',
        roles: [{ name: 'admin' }],
        accesoEmpresa: { companyId: 'empresa-B', rolPorEmpresa: true, moduleOverrides: {} },
      }, ['planillas:corridas:read', 'planillas:corridas:create'])
    })

    it('deja de poder todo: manda lo que recibió del servidor', () => {
      expect(can('ventas:facturas:create')).toBe(false)
      expect(can('configuracion:usuarios:read')).toBe(false)
    })

    it('puede lo que le da su rol en esa empresa', () => {
      expect(can('planillas:corridas:create')).toBe(true)
      expect(canAny('planillas')).toBe(true)
    })

    it('y no ve los módulos donde no tiene nada', () => {
      expect(canAny('ventas')).toBe(false)
    })
  })

  describe('sin sesión', () => {
    it('no puede nada', () => {
      expect(can('ventas:facturas:read')).toBe(false)
      expect(canAny('ventas')).toBe(false)
    })
  })
})

/**
 * El acceso por módulo de la asignación por empresa.
 *
 * Solo puede recortar lo que ya da el rol, nunca ampliarlo. Antes el panel
 * mostraba "Completo" en todos los módulos aunque el rol no tuviera nada ahí, lo
 * que hacía creer que el usuario tendría acceso.
 */
describe('Acceso por módulo', () => {
  const permisos = (slugs: string[]) => slugs.map(slug => ({ slug }))

  describe('el nivel que da un rol en un módulo', () => {
    it('sin ninguna casilla, no hay acceso', () => {
      expect(nivelPorPermisos(permisos(['contabilidad:catalogo:read']), 'ventas')).toBe('none')
    })

    it('solo con ver y exportar, es lectura', () => {
      expect(nivelPorPermisos(permisos(['contabilidad:catalogo:read', 'contabilidad:catalogo:export']), 'contabilidad'))
        .toBe('read')
    })

    it('con cualquier casilla que modifique, es completo', () => {
      expect(nivelPorPermisos(permisos(['ventas:facturas:create']), 'ventas')).toBe('full')
      expect(nivelPorPermisos(permisos(['compras:oc:approve']), 'compras')).toBe('full')
    })
  })

  describe('el recorte', () => {
    it('reduce el nivel del rol', () => {
      expect(nivelEfectivo('full', 'read')).toBe('read')
      expect(nivelEfectivo('full', 'none')).toBe('none')
      expect(nivelEfectivo('read', 'none')).toBe('none')
    })

    it('nunca amplía: un módulo sin acceso sigue sin acceso', () => {
      expect(nivelEfectivo('none', 'full')).toBe('none')
      expect(nivelEfectivo('read', 'full')).toBe('read')
      expect(nivelEfectivo('none', undefined)).toBe('none')
    })
  })

  describe('lo que se ofrece en pantalla', () => {
    it('si el rol no da acceso, no hay nada que recortar', () => {
      expect(opcionesRecorte('none').map(o => o.value)).toEqual(['full'])
    })

    it('si el rol da lectura, solo se puede quitar del todo', () => {
      expect(opcionesRecorte('read').map(o => o.value)).toEqual(['full', 'none'])
    })

    it('si el rol da acceso completo, se puede bajar a lectura o quitar', () => {
      expect(opcionesRecorte('full').map(o => o.value)).toEqual(['full', 'read', 'none'])
    })

    it('un recorte que no recorta nada se muestra como "sin recorte"', () => {
      expect(valorSelector('read', 'read')).toBe('full')
      expect(valorSelector('full', 'read')).toBe('read')
    })
  })
})
