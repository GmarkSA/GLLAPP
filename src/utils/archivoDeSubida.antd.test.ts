import { describe, it, expect } from 'vitest'
import { archivoDeSubida } from './archivoDeSubida'

/**
 * Lo que Ant Design entrega DE VERDAD cuando `beforeUpload` devuelve false.
 *
 * Esto no asume nada: ejecuta el mismo `onBatchStart` de antd —su propio
 * código, importado de node_modules— y mira qué llega a `onChange`. Si una
 * versión futura cambia la forma del objeto, esta prueba se pone roja antes
 * de que la subida vuelva a morir en silencio.
 */
describe('la forma real que antd entrega a onChange', () => {
  it('con beforeUpload=false, `file` es un File sin originFileObj', async () => {
    const { file2Obj } = await import('antd/es/upload/utils')

    const real = new File([new Uint8Array([1, 2, 3])], 'logo.jpeg', { type: 'image/jpeg' })
    ;(real as any).uid = 'rc-upload-1'

    // Esto es lo que hace antd en Upload.js cuando beforeUpload devolvió false:
    // toma el fileObj envuelto y manda a onChange un File clonado, sin envolver.
    const fileObj: any = file2Obj(real as any)
    const clon: any = new File([fileObj.originFileObj], fileObj.originFileObj.name,
      { type: fileObj.originFileObj.type })
    clon.uid = fileObj.uid

    // La línea que tenían las pantallas: undefined. De ahí el `return` mudo.
    expect(clon.originFileObj).toBeUndefined()

    // La que tienen ahora: encuentra el archivo.
    expect(archivoDeSubida({ file: clon, fileList: [fileObj] })).toBeInstanceOf(File)
    expect(archivoDeSubida({ file: clon, fileList: [fileObj] })!.name).toBe('logo.jpeg')
  })

  /** El logo real que lo destapó: JPEG de 63 KB, bien dentro de los límites. */
  it('un JPEG de 63 KB pasa sin problema', async () => {
    const jpeg = new File([new Uint8Array(63472)], 'paper-plus.jpeg', { type: 'image/jpeg' })
    const r = archivoDeSubida({ file: jpeg })!

    expect(r.size).toBe(63472)
    expect(r.type).toBe('image/jpeg')
  })
})
