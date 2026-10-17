import { useState } from 'react'
import { Modal, Select, Radio, InputNumber, Typography, Space, Alert } from 'antd'
import { FORMATOS_ETIQUETA } from './etiquetas'

const { Text } = Typography

/**
 * Elegir cómo imprimir las etiquetas.
 *
 * Abre la ruta real `/inventario/etiquetas` en una ventana nueva, no
 * `document.write`: en `about:blank` Chrome ignora `@page { margin: 0 }` y mete
 * su encabezado en la hoja, que en una etiqueta adhesiva descuadra la rejilla
 * entera y despega los códigos de su recuadro.
 */
export default function EtiquetasModal({ open, seleccionados, onClose }: {
  open: boolean
  /** Artículos marcados en el listado. Vacío = todos. */
  seleccionados: string[]
  onClose: () => void
}) {
  const [formato,  setFormato]  = useState(FORMATOS_ETIQUETA[0].id)
  const [cuantas,  setCuantas]  = useState<'fijas' | 'existencia'>('fijas')
  const [copias,   setCopias]   = useState(1)

  const imprimir = () => {
    const params = new URLSearchParams({ formato })
    if (seleccionados.length > 0) params.set('ids', seleccionados.join(','))
    if (cuantas === 'existencia') params.set('porExistencia', '1')
    else params.set('copias', String(copias))

    window.open(`/inventario/etiquetas?${params.toString()}`, '_blank')
    onClose()
  }

  const elegido = FORMATOS_ETIQUETA.find(f => f.id === formato)!

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
          description="Cada etiqueta lleva el código QR, el nombre y el precio de venta."
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
