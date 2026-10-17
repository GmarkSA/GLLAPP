import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { getProducts } from '../../api/inventario'
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
        const total = Number(res?.total ?? lote.length)
        if (lote.length < POR_PAGINA || todos.length >= total) break
      }
      return todos
    }

    traerTodos()
      .then(todos => {
        const elegidos = ids.length > 0 ? todos.filter(a => ids.includes(a.id)) : todos
        const lista = etiquetasDeArticulos(elegidos, opciones)
        setEtiquetas(lista)
        setCodigos(generarCodigosBarras(lista))
      })
      // Lo que responda el servidor se muestra: tragarse el error hacía que la
      // hoja dijera «no hay etiquetas» con el inventario lleno.
      .catch((e: unknown) => {
        setEtiquetas([])
        setFallo(getApiError(e, 'No se pudieron traer los artículos del inventario'))
      })
      .finally(() => setLoading(false))
  }, [params])

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
        .etiqueta {
          display: flex; align-items: center; gap: 2mm;
          padding: 1.5mm 2mm;
          box-sizing: border-box;
          overflow: hidden;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .etiqueta img { height: ${formato.codigoAltoMm}mm; width: auto; max-width: 60%; flex: none; }
        .datos { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .nombre {
          font-size: ${formato.altoMm < 28 ? 6.5 : 7.5}pt; line-height: 1.15;
          font-weight: 600; color: #111;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .codigo {
          font-size: ${formato.altoMm < 28 ? 5.5 : 6}pt; color: #666;
          font-variant-numeric: tabular-nums; margin-top: 0.6mm;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .precio {
          font-size: ${formato.altoMm < 28 ? 8 : 9.5}pt; font-weight: 700;
          color: #111; margin-top: 0.6mm; font-variant-numeric: tabular-nums;
        }
      `}</style>

      {Array.from({ length: Math.ceil(etiquetas.length / formato.porHoja) }, (_, h) => (
        <div className="hoja" key={h}>
          <div className="rejilla" style={{ minHeight: `${filas * formato.altoMm}mm` }}>
            {etiquetas.slice(h * formato.porHoja, (h + 1) * formato.porHoja).map((e, i) => (
              <div className="etiqueta" key={`${e.articuloId}-${i}`}>
                {codigos.get(e.codigo) && <img src={codigos.get(e.codigo)} alt="" />}
                <div className="datos">
                  <div className="nombre">{e.nombre}</div>
                  {e.precio && <div className="precio">{e.precio}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
