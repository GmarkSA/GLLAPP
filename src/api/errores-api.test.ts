import { describe, it, expect } from 'vitest'
import { getApiError, getApiErrorBody } from './axios'

/**
 * De dónde se lee el error que redacta el backend.
 *
 * El HttpExceptionFilter anida el cuerpo dentro de `error`, y varias pantallas lo
 * leían un nivel más arriba: el mensaje salía undefined y el usuario veía siempre
 * el texto genérico. Pasó en el alta de usuarios: el backend explicaba que el
 * correo ya tenía cuenta en otra empresa cliente y la pantalla decía nada más
 * «Error al crear usuario», sin ofrecer la vinculación.
 */
const error = (data: any) => ({ response: { status: 409, data } })

describe('lectura del error que manda el backend', () => {
  it('toma el mensaje del cuerpo anidado', () => {
    const e = error({ success: false, statusCode: 409, error: { statusCode: 409, message: 'El correo ya tiene usuario en esta cuenta' } })
    expect(getApiError(e, 'genérico')).toBe('El correo ya tiene usuario en esta cuenta')
  })

  it('devuelve el cuerpo completo, con el código que decide qué ofrecer', () => {
    const e = error({ success: false, error: { code: 'usuario_existe_en_otra_cuenta', message: 'ya tiene una cuenta' } })
    expect(getApiErrorBody(e).code).toBe('usuario_existe_en_otra_cuenta')
  })

  it('aguanta la forma plana, por si algún error no pasa por el filtro', () => {
    expect(getApiError(error({ message: 'sin envolver' }), 'genérico')).toBe('sin envolver')
  })

  it('sin cuerpo utilizable se queda con el texto de respaldo', () => {
    expect(getApiError({ message: 'Network Error' }, 'genérico')).toBe('genérico')
  })
})
