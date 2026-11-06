import { describe, it, expect } from 'vitest'
import { LIMITE_DE_LOGO, MB_DE_LOGO, FORMATOS_DE_LOGO } from './logoDeLaEmpresa'

/**
 * Lo que la pantalla acepta como logo.
 *
 * Estuvo desalineado con el servidor: la pantalla rechazaba a 1 MB y el
 * servidor aceptaba hasta 2 MB. Un logo normal —un PNG de 1600 px a todo
 * color pasa del megabyte sin ser raro— se rechazaba antes de salir del
 * navegador, y desde afuera se veía como que la subida no funcionaba.
 *
 * Estos valores tienen que seguir siendo los mismos que los de
 * `shared/identidad/logo-de-la-empresa.ts` en el backend.
 */
describe('el límite del logo', () => {
  it('es el mismo que el del servidor', () => {
    expect(LIMITE_DE_LOGO).toBe(2 * 1024 * 1024)
  })

  it('el número del mensaje sale del límite, no está escrito aparte', () => {
    expect(LIMITE_DE_LOGO).toBe(MB_DE_LOGO * 1024 * 1024)
  })

  /** El logo que destapó esto: un PNG grande, por encima del megabyte. */
  it('un PNG de 1.4 MB se acepta', () => {
    expect(1.4 * 1024 * 1024 <= LIMITE_DE_LOGO).toBe(true)
  })

  it('uno de 3 MB no', () => {
    expect(3 * 1024 * 1024 <= LIMITE_DE_LOGO).toBe(false)
  })
})

describe('los formatos', () => {
  it('son los que el servidor sabe guardar', () => {
    expect(FORMATOS_DE_LOGO).toEqual(
      ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'])
  })

  it('un PDF no es un logo', () => {
    expect(FORMATOS_DE_LOGO).not.toContain('application/pdf')
  })
})
