/**
 * El archivo que el usuario eligió en un `<Upload>` de Ant Design.
 *
 * Con `beforeUpload={() => false}` —que es como se usa en Lucía, porque el
 * archivo lo manda nuestro propio código y no el componente— antd entrega en
 * `onChange` un `File` CRUDO, no el objeto envuelto. Esto es `Upload.js`:
 *
 *     if (!filteredFileInfoList[index].parsedFile) {
 *       // `beforeUpload` return false
 *       clone = new File([originFileObj], originFileObj.name, …)
 *       triggerFileObj = clone;      // ← esto llega a onChange
 *     }
 *
 * Así que `info.file.originFileObj` viene `undefined`. Las pantallas lo leían
 * y salían con un `if (!file) return`: al elegir una imagen no pasaba
 * absolutamente nada —ni mensaje, ni petición, ni error en la consola—, y
 * desde afuera parecía que el servidor no recibía nada. Le pasaba al logo de
 * la empresa y a la foto del artículo por igual.
 *
 * `info.fileList` sí trae el objeto envuelto, así que se aceptan las dos
 * formas: la cruda de hoy y la envuelta por si cambia en otra versión.
 */
export function archivoDeSubida(info: any): File | undefined {
  const elegido = info?.file

  // Lo normal con beforeUpload=false: el File crudo.
  if (elegido instanceof File) return elegido

  // La forma envuelta, por si antd vuelve a entregarla así.
  if (elegido?.originFileObj instanceof File) return elegido.originFileObj

  // Último recurso: la lista, que siempre lleva el objeto envuelto.
  const deLaLista = info?.fileList?.[info.fileList.length - 1]?.originFileObj
  return deLaLista instanceof File ? deLaLista : undefined
}
