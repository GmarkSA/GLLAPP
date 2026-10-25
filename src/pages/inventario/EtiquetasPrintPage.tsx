import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { getProducts } from '../../api/inventario'
import { totalDe } from '../../api/paginacion'
import { getApiError } from '../../api/axios'
import {
  FORMATOS_ETIQUETA, etiquetasDeArticulos, generarCodigosBarras,
  type ArticuloParaEtiqueta, type Etiqueta, type FormatoEtiqueta,
} from './etiquetas'

/**
 * Hoja de etiquetas para pegar en el producto.
 *
 * Ruta real y no `document.write`: en `about:blank` Chrome ignora
 * `@page { margin: 0 }` y mete su propio encabezado en la hoja, que en una
 * etiqueta adhesiva descuadra toda la rejilla.
 *
 * Se abre con los artículos a etiquetar:
 *   /inventario/etiquetas?ids=a1,a2&formato=hoja-24&copias=1
 *   /inventario/etiquetas?todos=1&formato=termica-50x25&porExistencia=1
 */
export default function EtiquetasPrintPage() {
  const [params] = useSearchParams()
  const formato: FormatoEtiqueta =
    FORMATOS_ETIQUETA.find(f => f.id === params.get('formato')) ?? FORMATOS_ETIQUETA[0]

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [codigos,   setCodigos]   = useState<Map<string, string>>(new Map())
  const [loading,   setLoading]   = useState(true)
  const [fallo,     setFallo]     = useState<string | null>(null)

  useEffect(() => {
    const ids = (params.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const opciones = {
      copias:        Number(params.get('copias')) || 1,
      porExistencia: params.get('porExistencia') === '1',
      soloSinCodigoPropio: params.get('soloSinCodigoPropio') === '1',
    }

    /**
     * El listado topa el límite en 500 por página, así que se recorre por
     * páginas: un inventario de 1,584 artículos no cabe en una sola, y pedir
     * más de 500 devuelve 400.
     */
    const traerTodos = async (): Promise<ArticuloParaEtiqueta[]> => {
      const POR_PAGINA = 500
      const todos: ArticuloParaEtiqueta[] = []
      for (let pagina = 1; pagina <= 20; pagina++) {
        const res: any = await getProducts({ page: pagina, limit: POR_PAGINA })
        const lote: ArticuloParaEtiqueta[] = Array.isArray(res) ? res : res?.data ?? []
        todos.push(...lote)
        /**
         * El total viene en `meta.total`. Leyéndolo como `res.total` salía
         * indefinido y se caía al largo del lote —500—, con lo que la condición
         * de abajo cortaba el recorrido en la primera vuelta: de 1,584
         * artículos solo se imprimían etiquetas de los primeros 500, sin aviso.
         *
         * Si el servidor no manda total, se sigue hasta que una página venga
         * incompleta, que es la última.
         */
        const total = totalDe(res)
        if (lote.length < POR_PAGINA || (total > 0 && todos.length >= total)) break
      }
      return todos
    }

    traerTodos()
      .then(todos => {
        const elegidos = ids.length > 0 ? todos.filter(a => ids.includes(a.id)) : todos
        const lista = etiquetasDeArticulos(elegidos, opciones)
        setEtiquetas(lista)
        setCodigos(generarCodigosBarras(lista, formato))
      })
      // Lo que responda el servidor se muestra: tragarse el error hacía que la
      // hoja dijera «no hay etiquetas» con el inventario lleno.
      .catch((e: unknown) => {
        setEtiquetas([])
        setFallo(getApiError(e, 'No se pudieron traer los artículos del inventario'))
      })
      .finally(() => setLoading(false))
  }, [params, formato])

  // El código de barras tiene que estar pintado antes de abrir el diálogo de
  // impresión, o la hoja sale con los recuadros vacíos.
  useEffect(() => {
    if (!loading && etiquetas.length > 0 && codigos.size > 0) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [loading, etiquetas.length, codigos.size])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Generando etiquetas…" />
      </div>
    )
  }

  if (fallo) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        <h3 style={{ marginTop: 0 }}>No se pudieron traer los artículos</h3>
        <p style={{ color: '#9b3a3a', maxWidth: 560 }}>{fallo}</p>
      </div>
    )
  }

  if (etiquetas.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        <h3 style={{ marginTop: 0 }}>No hay etiquetas que imprimir</h3>
        <p style={{ color: '#666', maxWidth: 520 }}>
          Ningún artículo seleccionado necesita etiqueta: o no tiene código de barras
          ni SKU, o la existencia está en cero, o todos traen ya el código del
          fabricante y pediste imprimir solo los que llevan el código interno.
        </p>
      </div>
    )
  }

  const filas = Math.max(1, Math.round(formato.porHoja / formato.columnas))

  return (
    <>
      <style>{`
        @page { size: ${formato.pageSize}; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; }
          .hoja { page-break-after: always; }
          .hoja:last-child { page-break-after: auto; }
        }
        body { margin: 0; background: #f5f5f5; }
        .rejilla {
          display: grid;
          grid-template-columns: repeat(${formato.columnas}, ${formato.anchoMm}mm);
          grid-auto-rows: ${formato.altoMm}mm;
          justify-content: center;
          background: #fff;
        }
        /*
         * El nombre arriba, el código al centro y el precio abajo: apilados y
         * no en fila, porque en fila el código no pasaba del 60% del ancho de
         * la etiqueta y ahí es donde se quedaba corto —el ancho es lo que fija
         * el grosor de la barra más angosta, que es lo que el lector lee—.
         */
        .etiqueta {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 0.5mm;
          padding: 1mm;
          box-sizing: border-box;
          overflow: hidden;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        /* El ancho manda; el alto sale de la proporción con la que se generó. */
        .etiqueta img { width: ${formato.codigoAnchoMm}mm; height: auto; display: block; flex: none; }
        .nombre {
          font-size: ${formato.altoMm < 28 ? 6 : 7}pt; line-height: 1.1;
          font-weight: 600; color: #111; text-align: center;
          width: 100%;
          display: -webkit-box; -webkit-line-clamp: ${formato.altoMm < 28 ? 1 : 2};
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .precio {
          font-size: ${formato.altoMm < 28 ? 7.5 : 9}pt; font-weight: 700;
          color: #111; font-variant-numeric: tabular-nums; line-height: 1;
        }
      `}</style>

      {Array.from({ length: Math.ceil(etiquetas.length / formato.porHoja) }, (_, h) => (
        <div className="hoja" key={h}>
          <div className="rejilla" style={{ minHeight: `${filas * formato.altoMm}mm` }}>
            {etiquetas.slice(h * formato.porHoja, (h + 1) * formato.porHoja).map((e, i) => (
              <div className="etiqueta" key={`${e.articuloId}-${i}`}>
                <div className="nombre">{e.nombre}</div>
                {codigos.get(e.codigo) && <img src={codigos.get(e.codigo)} alt="" />}
                {e.precio && <div className="precio">{e.precio}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
