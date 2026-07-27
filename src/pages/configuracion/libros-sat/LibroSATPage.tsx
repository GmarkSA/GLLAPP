import { useState, useEffect } from 'react'
import {
  Card, Button, Input, Switch, Space, Typography, message,
  Popconfirm, Tag, Divider, Tooltip, Badge,
} from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined, BookOutlined, DeleteOutlined,
  PlusOutlined, SaveOutlined, ReloadOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import {
  getLibroSATConfig, saveLibroSATConfig,
  DEFAULT_COMPRAS, DEFAULT_VENTAS,
  type LibroColumn, type LibroSATConfig,
} from '../../../api/libros-sat'
import { getTaxes, type Tax } from '../../../api/impuestos'

const { Title, Text } = Typography

// ── Editor de columnas para un libro ──────────────────────────────────────────

function ColumnsEditor({
  title, subtitle, columns, onChange, taxCounts,
}: {
  title:     string
  subtitle:  string
  columns:   LibroColumn[]
  onChange:  (cols: LibroColumn[]) => void
  taxCounts: Record<string, number>
}) {
  const [addingKey,   setAddingKey]   = useState('')
  const [addingLabel, setAddingLabel] = useState('')
  const [showAdd,     setShowAdd]     = useState(false)

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= columns.length) return
    const next = [...columns]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next.map((c, i) => ({ ...c, sortOrder: i + 1 })))
  }

  const updateLabel = (key: string, label: string) =>
    onChange(columns.map(c => c.key === key ? { ...c, label } : c))

  const toggleActive = (key: string, isActive: boolean) =>
    onChange(columns.map(c => c.key === key ? { ...c, isActive } : c))

  const remove = (key: string) =>
    onChange(columns.filter(c => c.key !== key).map((c, i) => ({ ...c, sortOrder: i + 1 })))

  const addColumn = () => {
    const cleanKey = addingKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!cleanKey || !addingLabel.trim()) { message.warning('Completa la clave y la etiqueta'); return }
    if (columns.find(c => c.key === cleanKey)) { message.error(`Ya existe la clave "${cleanKey}"`); return }
    onChange([...columns, { key: cleanKey, label: addingLabel.trim(), sortOrder: columns.length + 1, isActive: true }])
    setAddingKey('')
    setAddingLabel('')
    setShowAdd(false)
  }

  return (
    <Card
      bordered={false}
      style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, minWidth: 0 }}
      bodyStyle={{ padding: 0 }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(10,10,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text strong style={{ color: '#0a0a0a', fontSize: 14 }}>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setShowAdd(v => !v)}>
          Nueva columna
        </Button>
      </div>

      {/* Cabecera de columnas */}
      <div style={{
        display: 'grid', gridTemplateColumns: '44px 120px 1fr 56px 36px',
        alignItems: 'center', gap: '0 8px',
        padding: '6px 16px', background: '#fafbfc', borderBottom: '1px solid rgba(10,10,10,0.08)',
      }}>
        <div />
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clave</Text>
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Etiqueta en el reporte</Text>
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Activa</Text>
        <div />
      </div>

      {/* Filas */}
      {columns.map((col, idx) => (
        <div
          key={col.key}
          style={{
            display: 'grid', gridTemplateColumns: '44px 120px 1fr 56px 36px',
            alignItems: 'center', gap: '0 8px',
            padding: '9px 16px', borderBottom: '1px solid #f8f8f8',
            background: col.isActive ? '#fff' : '#fafbfc',
            opacity: col.isActive ? 1 : 0.55,
            transition: 'opacity 0.2s',
          }}
        >
          {/* Flechas orden */}
          <Space size={2} style={{ justifyContent: 'center' }}>
            <Tooltip title="Subir">
              <Button
                size="small" type="text"
                icon={<ArrowUpOutlined style={{ fontSize: 10 }} />}
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                style={{ padding: '0 4px', height: 20 }}
              />
            </Tooltip>
            <Tooltip title="Bajar">
              <Button
                size="small" type="text"
                icon={<ArrowDownOutlined style={{ fontSize: 10 }} />}
                onClick={() => move(idx, 1)}
                disabled={idx === columns.length - 1}
                style={{ padding: '0 4px', height: 20 }}
              />
            </Tooltip>
          </Space>

          {/* Clave (readonly) + badge de impuestos vinculados */}
          <Tooltip title={taxCounts[col.key] ? `${taxCounts[col.key]} impuesto(s) vinculado(s) a esta columna` : 'Sin impuestos vinculados aún'}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {col.key}
              </Tag>
              <Badge
                count={taxCounts[col.key] ?? 0}
                style={{ backgroundColor: taxCounts[col.key] ? '#2ea172' : '#d9d9d9', fontSize: 10 }}
                size="small"
              />
            </span>
          </Tooltip>

          {/* Etiqueta editable */}
          <Input
            size="small"
            value={col.label}
            onChange={e => updateLabel(col.key, e.target.value)}
            style={{ fontSize: 13 }}
          />

          {/* Activa */}
          <div style={{ textAlign: 'center' }}>
            <Switch size="small" checked={col.isActive} onChange={v => toggleActive(col.key, v)} />
          </div>

          {/* Eliminar */}
          <Popconfirm
            title="¿Eliminar columna?"
            description="Los impuestos con esta clave quedarán sin columna asignada."
            onConfirm={() => remove(col.key)}
            okText="Eliminar" cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />} style={{ padding: '0 6px' }} />
          </Popconfirm>
        </div>
      ))}

      {columns.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
          Sin columnas — agrega una con el botón de arriba
        </div>
      )}

      {/* Formulario agregar nueva columna */}
      {showAdd && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(10,10,10,0.08)', background: '#e6fafd' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Nueva columna — la clave es el identificador interno; la etiqueta es lo que ve el usuario
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto auto', gap: 8, alignItems: 'center' }}>
            <div>
              <Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Clave (key)</Text>
              <Input
                size="small"
                placeholder="ej: accesorios"
                value={addingKey}
                onChange={e => setAddingKey(e.target.value)}
                style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}
              />
            </div>
            <div>
              <Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Etiqueta en el reporte</Text>
              <Input
                size="small"
                placeholder="ej: Compra de Accesorios"
                value={addingLabel}
                onChange={e => setAddingLabel(e.target.value)}
                onPressEnter={addColumn}
                autoFocus
              />
            </div>
            <Button size="small" type="primary" onClick={addColumn} style={{ background: '#1faec2', marginTop: 16 }}>
              Agregar
            </Button>
            <Button size="small" onClick={() => { setShowAdd(false); setAddingKey(''); setAddingLabel('') }} style={{ marginTop: 16 }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function LibroSATPage() {
  const [config,  setConfig]  = useState<LibroSATConfig>({ compras: [], ventas: [] })
  const [taxes,   setTaxes]   = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    Promise.all([getLibroSATConfig(), getTaxes()])
      .then(([cfg, txs]) => { setConfig(cfg); setTaxes(txs) })
      .finally(() => setLoading(false))
  }, [])

  // Cuenta cuántos impuestos activos apuntan a cada clave de columna
  const comprasCounts = taxes.reduce<Record<string, number>>((acc, t) => {
    if (t.libroComprasCol) acc[t.libroComprasCol] = (acc[t.libroComprasCol] ?? 0) + 1
    return acc
  }, {})
  const ventasCounts = taxes.reduce<Record<string, number>>((acc, t) => {
    if (t.libroVentasCol) acc[t.libroVentasCol] = (acc[t.libroVentasCol] ?? 0) + 1
    return acc
  }, {})

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveLibroSATConfig(config)
      message.success('Configuración de Libros SAT guardada')
    } catch {
      message.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig({ compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] })
    message.info('Restaurado a valores predeterminados Guatemala — recuerda guardar')
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Columnas de Libros SAT</Title>
            <Text type="secondary">
              Define las columnas del Libro de Compras y Ventas. Los impuestos se vinculan a estas columnas.
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={loading}>
            Restaurar Guatemala
          </Button>
          <Button
            type="primary" icon={<SaveOutlined />}
            loading={saving} disabled={loading}
            onClick={handleSave}
            style={{ background: '#1faec2' }}
          >
            Guardar cambios
          </Button>
        </Space>
      </div>

      {/* Nota explicativa */}
      <div style={{
        background: '#e6fafd', border: '1px solid rgba(31,174,194,0.2)', borderRadius: 8,
        padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <InfoCircleOutlined style={{ color: '#1faec2', marginTop: 2, flexShrink: 0 }} />
        <Text style={{ fontSize: 12 }}>
          <strong>Clave</strong> = identificador interno estable que se asigna en cada impuesto — no cambia aunque renombres la etiqueta.{' '}
          <strong>Etiqueta</strong> = texto que aparece en el encabezado del reporte SAT.
          Puedes agregar columnas personalizadas para adaptarlo a otros países de Centroamérica.
        </Text>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#bbb' }}>Cargando configuración…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ColumnsEditor
            title="Libro de Compras y Servicios"
            subtitle="Columnas para facturas de proveedor"
            columns={config.compras.sort((a, b) => a.sortOrder - b.sortOrder)}
            onChange={compras => setConfig(prev => ({ ...prev, compras }))}
            taxCounts={comprasCounts}
          />
          <ColumnsEditor
            title="Libro de Ventas y Servicios"
            subtitle="Columnas para facturas de venta"
            columns={config.ventas.sort((a, b) => a.sortOrder - b.sortOrder)}
            onChange={ventas => setConfig(prev => ({ ...prev, ventas }))}
            taxCounts={ventasCounts}
          />
        </div>
      )}

      <Divider style={{ margin: '24px 0 12px' }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        Los cambios aquí solo afectan etiquetas y orden del reporte. Los datos contables no se modifican.
      </Text>
    </div>
  )
}
