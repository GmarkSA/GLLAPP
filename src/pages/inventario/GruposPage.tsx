import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Input, Card, message,
  Modal, Form, Tag, Popconfirm, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, ApartmentOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import AccountSelect from '../../components/AccountSelect'
import { getGrupos, createGrupo, updateGrupo, deleteGrupo, type GrupoArticulo } from '../../api/expedientes'

const { Title, Text } = Typography

function GrupoModal({ open, record, onClose, onSaved }: {
  open: boolean; record: GrupoArticulo | null; onClose: () => void; onSaved: () => void
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
      if (record) await updateGrupo(record.id, values)
      else        await createGrupo(values)
      message.success(record ? 'Grupo actualizado' : 'Grupo creado')
      onSaved(); onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={record ? 'Editar grupo' : 'Nuevo grupo de artículos'}
      open={open} onOk={handleOk} onCancel={onClose}
      okText="Guardar" okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
      width={600} destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="code" label="Código" rules={[{ required: true }]} style={{ width: 120 }}>
            <Input placeholder="GRP-001" />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="Ej: Materiales de construcción" />
          </Form.Item>
        </Space>
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 8 }}>
            Cuentas contables por defecto para artículos de este grupo
          </Text>
          <Form.Item name="inventoryAccountId" label="Cuenta de inventario">
            <AccountSelect filter={{ isInventoryAccount: true }} placeholder="Cuenta de inventario por defecto..." />
          </Form.Item>
          <Form.Item name="salesAccountId" label="Cuenta de ingresos">
            <AccountSelect filter={{}} placeholder="Cuenta de ventas por defecto..." />
          </Form.Item>
          <Form.Item name="costAccountId" label="Cuenta de costo de ventas (COGS)">
            <AccountSelect filter={{}} placeholder="Cuenta COGS por defecto..." />
          </Form.Item>
          <Form.Item name="purchaseAccountId" label="Cuenta de compras" style={{ marginBottom: 0 }}>
            <AccountSelect filter={{ isVendorAccount: true }} placeholder="Cuenta de compras por defecto..." />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default function GruposPage() {
  const [items,   setItems]   = useState<GrupoArticulo[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<GrupoArticulo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getGrupos({ search: search || undefined })
      setItems(Array.isArray(res) ? res : [])
    } catch { message.error('Error al cargar grupos') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try { await deleteGrupo(id); message.success('Grupo eliminado'); load() }
    catch { message.error('Error al eliminar') }
  }

  const columns: ColumnsType<GrupoArticulo> = [
    { title: 'Código', dataIndex: 'code', width: 100,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text> },
    { title: 'Nombre', dataIndex: 'name' },
    { title: 'Descripción', dataIndex: 'description', ellipsis: true, render: v => v || '—' },
    { title: 'Ctas. contables', width: 120,
      render: (_, r) => {
        const count = [r.inventoryAccountId, r.salesAccountId, r.costAccountId, r.purchaseAccountId].filter(Boolean).length
        return count > 0
          ? <Tag color="#6b7280">{count} cuenta{count !== 1 ? 's' : ''}</Tag>
          : <Tag color="default">Sin configurar</Tag>
      } },
    { title: 'Acciones', width: 90, render: (_, row) => (
      <Space size={4}>
        <Tooltip title="Editar">
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => { setEditing(row); setModal(true) }} />
        </Tooltip>
        <Popconfirm title="¿Eliminar este grupo?" onConfirm={() => handleDelete(row.id)} okText="Sí" cancelText="No">
          <Button size="small" type="text" danger>Eliminar</Button>
        </Popconfirm>
      </Space>
    ) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <ApartmentOutlined style={{ marginRight: 8 }} /> Grupos de artículos
          </Title>
          <Text type="secondary">Agrupa artículos por familia y define cuentas contables y tasas de impuesto por defecto</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModal(true) }} style={{ background: '#1faec2' }}>
          Nuevo grupo
        </Button>
      </div>
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar grupo..." style={{ width: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} allowClear />
      </Card>
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={items} loading={loading}
          scroll={{ y: 'calc(100vh - 330px)' }}
          rowKey="id" size="small" pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'Sin grupos registrados' }} />
      </Card>
      <GrupoModal open={modal} record={editing} onClose={() => setModal(false)} onSaved={load} />
    </div>
  )
}
