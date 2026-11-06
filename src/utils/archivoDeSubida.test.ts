import { describe, it, expect } from 'vitest'
import { archivoDeSubida } from './archivoDeSubida'

/**
 * De dónde se saca el archivo que el usuario eligió.
 *
 * Con `beforeUpload={() => false}` antd entrega un `File` crudo en
 * `info.file`, no el objeto envuelto: `originFileObj` viene `undefined`. Las
 * pantallas leían `info.file.originFileObj` y salían con `if (!file) return`,
 * así que al elegir una imagen no pasaba NADA —ni mensaje, ni petición, ni
 * error—, y parecía que el servidor no recibía nada. Pasaba con el logo de la
 * empresa y con la foto del artículo, que comparten el mismo patrón.
 */
const imagen = (nombre = 'logo.png', tipo = 'image/png') =>
  new File([new Uint8Array([1, 2, 3])], nombre, { type: tipo })

describe('el archivo que eligió el usuario', () => {
  /** Lo que antd 6 entrega de verdad: el File crudo, con un uid pegado. */
  it('lo encuentra cuando antd entrega el File crudo', () => {
    const crudo = imagen()
    ;(crudo as any).uid = 'rc-upload-1'

    expect(archivoDeSubida({ file: crudo })).toBe(crudo)
  })

  /** La forma envuelta, por si otra versión vuelve a entregarla así. */
  it('lo encuentra cuando viene envuelto', () => {
    const real = imagen()

    expect(archivoDeSubida({ file: { name: 'logo.png', originFileObj: real } })).toBe(real)
  })

  /** `fileList` siempre lleva el objeto envuelto. */
  it('lo encuentra en la lista si no está en `file`', () => {
    const real = imagen()

    expect(archivoDeSubida({
      file: { name: 'logo.png' },
      fileList: [{ name: 'logo.png', originFileObj: real }],
    })).toBe(real)
  })

  it('con varios, toma el último elegido', () => {
    const viejo = imagen('viejo.png')
    const nuevo = imagen('nuevo.png')

    expect(archivoDeSubida({
      file: {},
      fileList: [{ originFileObj: viejo }, { originFileObj: nuevo }],
    })).toBe(nuevo)
  })

  it('sin archivo, no devuelve nada', () => {
    expect(archivoDeSubida({ file: {} })).toBeUndefined()
    expect(archivoDeSubida({})).toBeUndefined()
    expect(archivoDeSubida(null)).toBeUndefined()
  })

  /** Un estado intermedio de antd no es un archivo. */
  it('no confunde un objeto cualquiera con un archivo', () => {
    expect(archivoDeSubida({ file: { originFileObj: { name: 'x' } } })).toBeUndefined()
  })

  it('conserva nombre, tipo y tamaño', () => {
    const r = archivoDeSubida({ file: imagen('paper-plus.webp', 'image/webp') })!

    expect(r.name).toBe('paper-plus.webp')
    expect(r.type).toBe('image/webp')
    expect(r.size).toBe(3)
  })
})
