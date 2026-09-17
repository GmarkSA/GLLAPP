/**
 * A dónde ir al cambiar de empresa.
 *
 * Cambiar de empresa recargaba la misma dirección. Si esa dirección era la de un
 * documento —una factura, una cotización, un proveedor— el documento pertenece a
 * la empresa anterior y la nueva no lo encuentra: la pantalla quedaba en «Factura
 * no encontrada» y había que ir al inicio a mano. El servidor hace bien en no
 * entregarlo; lo que estaba mal era insistir en la misma dirección.
 *
 * La salida es el listado del módulo donde se estaba. Un documento abierto es del
 * cliente anterior, pero el listado de facturas de venta tiene sentido en
 * cualquiera de las dos empresas, así que se conserva el sitio de trabajo y solo
 * se suelta el documento.
 */

/** Un tramo que nombra a un documento concreto en vez de a una sección. */
const esDeUnDocumento = (tramo: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tramo) ||  // identificador
  /^\d+$/.test(tramo) ||                                                            // número correlativo
  ['nueva', 'nuevo', 'editar', 'imprimir', 'detalle'].includes(tramo.toLowerCase())

export function rutaAlCambiarDeEmpresa(rutaActual: string): string {
  const [camino] = rutaActual.split(/[?#]/)          // los filtros son de la empresa anterior
  const tramos = camino.split('/').filter(Boolean)

  const corte = tramos.findIndex(esDeUnDocumento)
  if (corte === -1) return camino || '/'             // ya es una sección: se queda donde está

  const seccion = tramos.slice(0, corte)
  return seccion.length ? `/${seccion.join('/')}` : '/'
}
