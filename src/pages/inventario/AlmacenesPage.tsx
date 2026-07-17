import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Input, Card, message,
  Modal, Form, Switch, Tag, Popconfirm, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, HomeOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen, type Almacen,
} from '../../api/expedientes'

const { Title, Text } = Typography

function AlmacenModal({ open, record, onClose, onSaved }: {
  open: boolean; record: Almacen | null; onClose: () => void; onSaved: () => void
}) {
  const [form]   = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (record) form.setFieldsValue(record)
    else form.resetFields()
  }, [open, record, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (record) await updateAlmacen(record.id, values)
      else        await createAlmacen(values)
      message.success(record ? 'Almacén actualizado' : 'Almacén creado')
      onSaved(); onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={record ? 'Editar almacén' : 'Nuevo almacén'}
      open={open} onOk={handleOk} onCancel={onClose}
      okText="Guardar" okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}
        initialValues={{ isActive: true, isPrimary: false }}>
        <Form.Item name="code" label="Código" rules={[{ required: true }]}>
          <Input placeholder="Ej: ALM-001" />
        </Form.Item>
        <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
          <Input placeholder="Ej: Bodega Principal" />
        </Form.Item>
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="address" label="Dirección / Ubicación">
          <Input placeholder="Dirección física del almacén" />
        </Form.Item>
        <Form.Item name="manager" label="Responsable">
          <Input placeholder="Nombre del encargado" />
        </Form.Item>
        <Space>
          <Form.Item name="isPrimary" label="Almacén principal" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
          <Form.Item name="isActive" label="Activo" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

export default function AlmacenesPage() {
  const [items,   setItems]   = useState<Almacen[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<Almacen | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAlmacenes({ search: search || undefined })
      setItems(Array.isArray(res) ? res : [])
    } catch { message.error('Error al cargar almacenes') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try { await deleteAlmacen(id); message.success('Almacén desactivado'); load() }
    catch { message.error('Error al eliminar') }
  }

  const columns: ColumnsType<Almacen> = [
    { title: 'Código', dataIndex: 'code', width: 100,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text> },
    { title: 'Nombre', dataIndex: 'name',
      render: (v, r) => (
        <Space>
          {v}
          {r.isPrimary && <Tag color="#1faec2" style={{ fontSize: 10 }}>Principal</Tag>}
        </Space>
      ) },
    { title: 'Responsable', dataIndex: 'manager', render: v => v || '—' },
    { title: 'Dirección', dataIndex: 'address', ellipsis: true, render: v => v || '—' },
    { title: 'Estado', dataIndex: 'isActive', width: 90,
      render: v => <Tag color={v ? '#2ea172' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag> },
    { title: 'Acciones', width: 90, render: (_, row) => (
      <Space size={4}>
        <Tooltip title="Editar">
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => { setEditing(row); setModal(true) }} />
        </Tooltip>
        <Popconfirm title="¿Desactivar este almacén?" onConfirm={() => handleDelete(row.id)} okText="Sí" cancelText="No">
          <Button size="small" type="text" danger>Desactivar</Button>
        </Popconfirm>
      </Space>
    ) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <HomeOutlined style={{ marginRight: 8 }} /> Almacenes
          </Title>
          <Text type="secondary">Gestión de bodegas y ubicaciones de inventario</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModal(true) }} style={{ background: '#1faec2' }}>
          Nuevo almacén
        </Button>
      </div>
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar almacén..." style={{ width: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} allowClear />
      </Card>
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={items} loading={loading}
          rowKey="id" size="small" pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'Sin almacenes registrados' }} />
      </Card>
      <AlmacenModal open={modal} record={editing}
        onClose={() => setModal(false)} onSaved={load} />
    </div>
  )
}
