import { useMemo, useState } from 'react'
import { Modal, Select, Radio, InputNumber, Typography, Space, Alert, Checkbox, message } from 'antd'
import {
  FORMATOS_ETIQUETA, etiquetasDeArticulos, codigosBajoElMinimo,
  type ArticuloParaEtiqueta,
} from './etiquetas'

const { Text } = Typography

/**
 * Elegir cómo imprimir las etiquetas.
 *
 * Abre la ruta real `/inventario/etiquetas` en una ventana nueva, no
 * `document.write`: en `about:blank` Chrome ignora `@page { margin: 0 }` y mete
 * su encabezado en la hoja, que en una etiqueta adhesiva descuadra la rejilla
 * entera y despega los códigos de su recuadro.
 */
export default function EtiquetasModal({ open, seleccionados, articulos = [], onClose }: {
  open: boolean
  /** Artículos marcados en el listado. Vacío = todos. */
  seleccionados: string[]
  /** Los del listado, para revisar el tamaño del código antes de imprimir. */
  articulos?: ArticuloParaEtiqueta[]
  onClose: () => void
}) {
  const [formato,  setFormato]  = useState(FORMATOS_ETIQUETA[0].id)
  const [cuantas,  setCuantas]  = useState<'fijas' | 'existencia'>('fijas')
  const [copias,   setCopias]   = useState(1)
  const [soloInternos, setSoloInternos] = useState(true)

  const imprimir = () => {
    const params = new URLSearchParams({ formato })
    if (seleccionados.length > 0) params.set('ids', seleccionados.join(','))
    if (cuantas === 'existencia') params.set('porExistencia', '1')
    else params.set('copias', String(copias))
    if (soloInternos) params.set('soloSinCodigoPropio', '1')

    // Si el navegador bloquea la ventana nueva, hay que decirlo: antes la
    // impresión simplemente no aparecía y no había forma de saber por qué.
    const ventana = window.open(`/inventario/etiquetas/imprimir?${params.toString()}`, '_blank')
    if (!ventana) {
      message.warning(
        'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes ' +
        'para este sitio y vuelve a intentarlo.',
        6,
      )
      return
    }
    onClose()
  }

  const elegido = FORMATOS_ETIQUETA.find(f => f.id === formato)!

  /**
   * Los que van a salir ilegibles con este formato: casi siempre el artículo
   * que todavía trae el SKU como código de barras. Se revisa aquí y no en la
   * hoja porque ahí ya es tarde —la hoja se manda a imprimir sola— y porque
   * esto no se arregla imprimiendo: hay que regenerarles el código.
   */
  const cortos = useMemo(() => {
    const elegidos = seleccionados.length > 0
      ? articulos.filter(a => seleccionados.includes(a.id))
      : articulos
    const lista = etiquetasDeArticulos(elegidos, {
      copias: 1,
      soloSinCodigoPropio: soloInternos,
    })
    return codigosBajoElMinimo(lista, elegido)
  }, [articulos, seleccionados, soloInternos, elegido])

  return (
    <Modal
      title="Imprimir etiquetas"
      open={open}
      onCancel={onClose}
      onOk={imprimir}
      okText="Generar e imprimir"
      okButtonProps={{ style: { background: '#1B3A6B' } }}
      width={520}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="info" showIcon
          message={seleccionados.length > 0
            ? `${seleccionados.length} artículo(s) seleccionado(s)`
            : 'Se imprimirán todos los artículos del listado'}
          description="Cada etiqueta lleva el nombre, el código de barras y el precio de venta."
        />

        <div>
          <Text style={{ fontSize: 12 }}>Formato de etiqueta</Text>
          <Select
            style={{ width: '100%' }}
            value={formato}
            onChange={setFormato}
            options={FORMATOS_ETIQUETA.map(f => ({ value: f.id, label: f.label }))}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>{elegido.description}</Text>
        </div>

        {cortos.length > 0 && (
          <Alert
            type="warning" showIcon
            message={`${cortos.length} artículo(s) van a salir con el código demasiado angosto`}
            description={
              <div style={{ fontSize: 11 }}>
                <div style={{ marginBottom: 6 }}>
                  Su código de barras es todavía el SKU, que ocupa mucho más ancho que el
                  EAN-13 interno: en esta etiqueta las barras salen por debajo del mínimo
                  que lee el lector, y van a fallar una sí y otra no. Cerrá esta ventana y
                  usá <Text strong style={{ fontSize: 11 }}>Regenerar códigos de barras</Text> antes
                  de imprimirlas.
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 96, overflowY: 'auto' }}>
                  {cortos.slice(0, 8).map(c => (
                    <li key={c.codigo}>
                      {c.nombre} — <Text code style={{ fontSize: 10 }}>{c.codigo}</Text>{' '}
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        ({Math.round(c.magnificacion * 100)}% del tamaño normal)
                      </Text>
                    </li>
                  ))}
                </ul>
                {cortos.length > 8 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    …y {cortos.length - 8} más.
                  </Text>
                )}
              </div>
            }
          />
        )}

        <div>
          <Checkbox checked={soloInternos} onChange={e => setSoloInternos(e.target.checked)}>
            Solo los que llevan el código interno de Lucía
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginLeft: 24 }}>
            Deja fuera los que ya traen el código del fabricante impreso: pegarles otra
            etiqueta les dejaría dos códigos y la cajera escanearía el que esté más a mano.
          </Text>
        </div>

        <div>
          <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>¿Cuántas de cada artículo?</Text>
          <Radio.Group value={cuantas} onChange={e => setCuantas(e.target.value)}>
            <Radio value="fijas">Un número fijo</Radio>
            <Radio value="existencia">Una por unidad en existencia</Radio>
          </Radio.Group>
          {cuantas === 'fijas' && (
            <InputNumber
              min={1} max={100} value={copias} onChange={v => setCopias(Number(v) || 1)}
              style={{ width: 110, marginTop: 8 }} addonAfter="por artículo"
            />
          )}
          {cuantas === 'existencia' && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
              Los artículos con existencia en cero no imprimen etiqueta.
            </Text>
          )}
        </div>
      </Space>
    </Modal>
  )
}
