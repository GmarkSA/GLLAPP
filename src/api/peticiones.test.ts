import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Lo que viaja en cada petición al servidor.
 *
 * Aquí se decide con qué sesión y en qué cliente se trabaja. Un error manda los
 * datos de una empresa al contexto de otra, así que hay una salvaguarda explícita:
 * si falta el cliente en una ruta que lo necesita, la petición no sale.
 */
describe('Cabeceras de cada petición', () => {
  let api: any

  beforeEach(async () => {
    sessionStorage.clear()
    vi.resetModules()
    api = (await import('./axios')).default
  })

  /** Ejecuta el interceptor de salida tal como lo haría axios. */
  const preparar = async (url: string) => {
    const interceptor: any = (api.interceptors.request as any).handlers[0]
    return interceptor.fulfilled({ url, headers: {} })
  }

  it('manda la sesión y el cliente', async () => {
    sessionStorage.setItem('accessToken', 'token-normal')
    sessionStorage.setItem('tenantId', 'cliente-A')
    sessionStorage.setItem('activeCompanyId', 'empresa-1')

    const config = await preparar('/ventas/facturas')
    expect(config.headers.Authorization).toBe('Bearer token-normal')
    expect(config.headers['X-Tenant-ID']).toBe('cliente-A')
    expect(config.headers['X-Company-ID']).toBe('empresa-1')
  })

  // Soporte entrando como un cliente: token y cliente tienen que ir juntos,
  // porque el servidor comprueba que coincidan
  it('durante una suplantación manda el token y el cliente suplantado, no los propios', async () => {
    sessionStorage.setItem('accessToken', 'token-propio')
    sessionStorage.setItem('tenantId', 'cliente-propio')
    sessionStorage.setItem('impersonationToken', 'token-suplantado')
    sessionStorage.setItem('impersonationTenantId', 'cliente-suplantado')

    const config = await preparar('/ventas/facturas')
    expect(config.headers.Authorization).toBe('Bearer token-suplantado')
    expect(config.headers['X-Tenant-ID']).toBe('cliente-suplantado')
  })

  it.each([
    '/auth/login', '/auth/register', '/auth/refresh',
    '/auth/forgot-password', '/auth/reset-password', '/auth/accept-invitation',
    '/auth/plans',
  ])('no exige cliente en %s, que el servidor atiende sin sesión', async (ruta) => {
    await expect(preparar(ruta)).resolves.toBeTruthy()
  })

  // La lista de planes es lo primero que pide la pantalla de registro: al no estar
  // entre las rutas sin sesión, a un visitante se le cerraba la sesión y se le
  // mandaba a iniciar sesión, de modo que nunca veía los planes.
  it('un visitante sin sesión puede consultar los planes', async () => {
    await expect(preparar('/auth/plans')).resolves.toBeTruthy()
  })

  // Sin esta salvaguarda, el servidor decidiría el cliente por su cuenta
  it('bloquea una petición de datos si no hay cliente', async () => {
    sessionStorage.setItem('accessToken', 'token-normal')
    await expect(preparar('/ventas/facturas')).rejects.toBeTruthy()
  })
})
