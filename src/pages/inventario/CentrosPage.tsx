import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Input, Card, message,
  Modal, Form, Tag, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, BranchesOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import AccountSelect from '../../components/AccountSelect'
import { getCentros, createCentro, updateCentro, deleteCentro, type Centro } from '../../api/expedientes'

const { Title, Text } = Typography

function CentroModal({ open, record, onClose, onSaved }: {
  open: boolean; record: Centro | null; onClose: () => void; onSaved: () => void
}) {
  const [form]   = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) record ? form.setFieldsValue(record) : form.resetFields()
  }, [open, record, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (record) await updateCentro(record.id, values)
      else        await createCentro(values)
      message.success(record ? 'Centro actualizado' : 'Centro creado')
      onSaved(); onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={record ? 'Editar centro de costo' : 'Nuevo centro de costo'}
      open={open} onOk={handleOk} onCancel={onClose}
      okText="Guardar" okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }} initialValues={{ isActive: true }}>
        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="code" label="Código" rules={[{ required: true }]} style={{ width: 120 }}>
            <Input placeholder="CC-001" />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="Ej: Departamento de Operaciones" />
          </Form.Item>
        </Space>
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="glAccountId" label="Cuenta contable vinculada">
          <AccountSelect filter={{}} placeholder="Cuenta del catálogo (opcional)..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function CentrosPage() {
  const [items,   setItems]   = useState<Centro[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<Centro | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCentros({ search: search || undefined })
      setItems(Array.isArray(res) ? res : [])
    } catch { message.error('Error al cargar centros') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<Centro> = [
    { title: 'Código', dataIndex: 'code', width: 100,
      render: v => <Text style={{ fontFamily: 'monospace', color: '#1B3A6B', fontWeight: 600 }}>{v}</Text> },
    { title: 'Nombre', dataIndex: 'name' },
    { title: 'Descripción', dataIndex: 'description', ellipsis: true, render: v => v || '—' },
    { title: 'Cta. GL', width: 100,
      render: (_, r) => r.glAccountId ? <Tag color="purple">Vinculada</Tag> : <Tag color="default">Sin vínculo</Tag> },
    { title: 'Acciones', width: 80, render: (_, row) => (
      <Space size={4}>
        <Button size="small" type="text" icon={<EditOutlined />}
          onClick={() => { setEditing(row); setModal(true) }} />
        <Popconfirm title="¿Eliminar este centro?" onConfirm={async () => {
          try { await deleteCentro(row.id); load() } catch { message.error('Error') }
        }} okText="Sí" cancelText="No">
          <Button size="small" type="text" danger>Eliminar</Button>
        </Popconfirm>
      </Space>
    ) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
            <BranchesOutlined style={{ marginRight: 8 }} /> Centros de costo
          </Title>
          <Text type="secondary">Define centros de costo para distribución de inventario y gastos por área</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModal(true) }} style={{ background: '#1B3A6B' }}>
          Nuevo centro
        </Button>
      </div>
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar centro..." style={{ width: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} allowClear />
      </Card>
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={items} loading={loading}
          rowKey="id" size="small" pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'Sin centros de costo registrados' }} />
      </Card>
      <CentroModal open={modal} record={editing} onClose={() => setModal(false)} onSaved={load} />
    </div>
  )
}
