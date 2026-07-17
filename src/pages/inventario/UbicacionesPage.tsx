import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Input, Card, message,
  Modal, Form, Select, Tag, Popconfirm, Switch, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, SearchOutlined,
  EnvironmentOutlined, ShopOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import {
  getUbicaciones, createUbicacion, updateUbicacion, deleteUbicacion,
  getAlmacenes,
  type Ubicacion, type UbicacionType, type Almacen,
} from '../../api/expedientes'

const { Title, Text } = Typography

const TIPO_CONFIG: Record<UbicacionType, { label: string; color: string; icon: string; desc: string }> = {
  bodega:   { label: 'Bodega / Almacén',   color: '#1faec2',    icon: '🏭', desc: 'Zona de almacenamiento físico dentro de un almacén' },
  pos:      { label: 'Punto de Venta',     color: '#2ea172',   icon: '🛒', desc: 'Terminal de venta — usa stock de todos los almacenes' },
  transito: { label: 'En tránsito',        color: '#ff7f00',  icon: '🚚', desc: 'Mercancía en camino entre ubicaciones' },
  scrap:    { label: 'Baja / Scrap',       color: 'default', icon: '🗑️', desc: 'Zona de productos dados de baja o dañados' },
}

function UbicacionModal({ open, record, almacenes, onClose, onSaved }: {
  open: boolean
  record: Ubicacion | null
  almacenes: Almacen[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const tipoWatch = Form.useWatch('type', form)

  useEffect(() => {
    if (!open) return
    if (record) form.setFieldsValue(record)
    else form.resetFields()
  }, [open, record, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (record) await updateUbicacion(record.id, values)
      else        await createUbicacion(values)
      message.success(record ? 'Ubicación actualizada' : 'Ubicación creada')
      onSaved(); onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={record ? 'Editar ubicación' : 'Nueva ubicación'}
      open={open} onOk={handleOk} onCancel={onClose}
      okText="Guardar" width={560}
      okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}
        initialValues={{ type: 'bodega', isActive: true, isDefault: false }}>
        <Space style={{ width: '100%', alignItems: 'flex-start' }} size={12}>
          <Form.Item name="code" label="Código" rules={[{ required: true }]} style={{ width: 120 }}>
            <Input placeholder="PV-001" />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]} style={{ width: '100%' }}>
            <Input placeholder="Ej: POS Zona 1, Bodega Sur" />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]} style={{ width: 200 }}>
            <Select options={Object.entries(TIPO_CONFIG).map(([v, c]) => ({
              value: v, label: `${c.icon} ${c.label}`,
            }))} />
          </Form.Item>
          <Form.Item name="almacenId" label="Almacén padre" style={{ flex: 1 }}>
            <Select allowClear placeholder="Seleccionar almacén (opcional)"
              options={almacenes.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          </Form.Item>
        </Space>

        {tipoWatch === 'pos' && (
          <div style={{ background: '#f0fff4', border: '1px solid #c3e5d8', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
            <strong style={{ color: '#2ea172' }}>🛒 Punto de Venta</strong>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
              Los POS acceden al <strong>stock consolidado de todos los almacenes</strong> para poder facturar.
              Al registrar una venta desde este POS, el sistema descontará del almacén con disponibilidad.
            </div>
          </div>
        )}

        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="address" label="Dirección / Referencia">
          <Input placeholder="Útil para POS con ubicación física propia" />
        </Form.Item>

        <Form.Item name="manager" label="Responsable">
          <Input placeholder="Nombre del encargado" />
        </Form.Item>

        <Space size={32}>
          <Form.Item name="isActive" label="Activa" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isDefault" label="Ubicación predeterminada" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

export default function UbicacionesPage() {
  const navigate = useNavigate()
  const [items,      setItems]      = useState<Ubicacion[]>([])
  const [almacenes,  setAlmacenes]  = useState<Almacen[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [tipoFilt,   setTipoFilt]   = useState<string | undefined>()
  const [almacenFilt,setAlmacenFilt]= useState<string | undefined>()
  const [modal,      setModal]      = useState(false)
  const [editing,    setEditing]    = useState<Ubicacion | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, alms] = await Promise.all([
        getUbicaciones({ search: search || undefined, type: tipoFilt, almacenId: almacenFilt }),
        getAlmacenes(),
      ])
      setItems(Array.isArray(res) ? res : [])
      setAlmacenes(Array.isArray(alms) ? alms : [])
    } catch { message.error('Error al cargar ubicaciones') }
    finally { setLoading(false) }
  }, [search, tipoFilt, almacenFilt])

  useEffect(() => { load() }, [load])

  const almacenMap = Object.fromEntries(almacenes.map(a => [a.id, a.name]))

  const columns: ColumnsType<Ubicacion> = [
    {
      title: 'Código', dataIndex: 'code', width: 110,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Nombre / Ubicación', dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.address && <div style={{ fontSize: 11, color: '#6b7280' }}>{r.address}</div>}
        </div>
      ),
    },
    {
      title: 'Tipo', dataIndex: 'type', width: 150,
      render: (v: UbicacionType) => {
        const cfg = TIPO_CONFIG[v] || { label: v, color: 'default', icon: '📦' }
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>
      },
    },
    {
      title: 'Almacén padre', dataIndex: 'almacenId', width: 160,
      render: v => v ? <Tag color="#1faec2">{almacenMap[v] || v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Responsable', dataIndex: 'manager', width: 140,
      render: v => v || '—',
    },
    {
      title: 'Estado', dataIndex: 'isActive', width: 90,
      render: (v, r) => (
        <Space size={4}>
          <Badge status={v ? 'success' : 'default'} text={v ? 'Activa' : 'Inactiva'} />
          {r.isDefault && <Tag color="gold" style={{ marginLeft: 4 }}>Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Acciones', width: 160, render: (_, row) => (
        <Space size={4}>
          {row.type === 'pos' && (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />}
              style={{ background: '#2ea172', borderColor: '#2ea172' }}
              onClick={() => navigate(`/pos${row.id ? `?pos=${row.id}` : ''}`)}>
              Abrir
            </Button>
          )}
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => { setEditing(row); setModal(true) }} />
          <Popconfirm
            title="¿Eliminar esta ubicación?"
            description="Esta acción no se puede deshacer."
            onConfirm={async () => {
              try { await deleteUbicacion(row.id); load() }
              catch { message.error('No se puede eliminar: puede tener stock asignado') }
            }}
            okText="Sí, eliminar" cancelText="Cancelar"
          >
            <Button size="small" type="text" danger>Eliminar</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <EnvironmentOutlined style={{ marginRight: 8 }} /> Ubicaciones / Puntos de Venta
          </Title>
          <Text type="secondary">
            Bodegas, zonas y puntos de venta — los POS acceden al stock global de todos los almacenes
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModal(true) }}
          style={{ background: '#1faec2' }}>
          Nueva ubicación
        </Button>
      </div>

      {/* Tipos info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(TIPO_CONFIG).map(([k, cfg]) => {
          const count = items.filter(i => i.type === k).length
          const active = tipoFilt === k
          return (
            <Card key={k} size="small" style={{ borderRadius: 8, textAlign: 'center', cursor: 'pointer',
              border: `2px solid ${active ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
              background: active ? '#fafbfc' : '#fff' }}
              onClick={() => setTipoFilt(active ? undefined : k)}>
              <div style={{ fontSize: 24 }}>{cfg.icon}</div>
              <div style={{ fontWeight: 600, color: '#1faec2', fontSize: 13 }}>{cfg.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1faec2' }}>{count}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{cfg.desc}</div>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Space>
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar ubicación..." style={{ width: 280 }}
            value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Select allowClear placeholder="Tipo" style={{ width: 190 }}
            value={tipoFilt} onChange={v => setTipoFilt(v)}
            options={Object.entries(TIPO_CONFIG).map(([v, c]) => ({ value: v, label: `${c.icon} ${c.label}` }))} />
          <Select allowClear placeholder="Filtrar por almacén" style={{ width: 200 }}
            value={almacenFilt} onChange={v => setAlmacenFilt(v)}
            options={almacenes.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
        </Space>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <ShopOutlined style={{ fontSize: 40, color: '#9aa1ab', display: 'block', marginBottom: 8 }} />
              <div style={{ color: '#6b7280' }}>Sin ubicaciones registradas</div>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
                Define bodegas, puntos de venta o zonas de almacenamiento
              </div>
            </div>
          )}}
        />
      </Card>

      <UbicacionModal
        open={modal}
        record={editing}
        almacenes={almacenes}
        onClose={() => setModal(false)}
        onSaved={load}
      />
    </div>
  )
}
