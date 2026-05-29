import { useState, useEffect } from 'react'
import {
  Card, Table, Button, Input, InputNumber, Switch, Tag, Space,
  Form, Modal, Typography, Popconfirm, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  LockOutlined, SaveOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getUnidades, createUnidad, updateUnidad, deleteUnidad,
  type UnidadMedida,
} from '../../api/unidades-medida'

const { Title, Text } = Typography

export default function UnidadesMedidaPage() {
  const [units,   setUnits]   = useState<UnidadMedida[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState<UnidadMedida | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try   { setUnits(await getUnidades()) }
    catch { message.error('Error cargando unidades de medida') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true, sortOrder: 99 })
    setModal(true)
  }

  const openEdit = (u: UnidadMedida) => {
    setEditing(u)
    form.setFieldsValue({ name: u.name, description: u.description, isActive: u.isActive, sortOrder: u.sortOrder })
    setModal(true)
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateUnidad(editing.id, vals)
        message.success('Unidad actualizada')
      } else {
        await createUnidad(vals)
        message.success('Unidad creada')
      }
      setModal(false)
      load()
    } catch (e: any) {
      const raw = e?.response?.data?.error?.message
                ?? e?.response?.data?.message
                ?? e?.message
                ?? 'Error al guardar'
      const msg = Array.isArray(raw) ? raw.join(' · ') : String(raw)
      message.error(msg, 6)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUnidad(id)
      message.success('Unidad eliminada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se puede eliminar')
    }
  }

  const handleToggleActive = async (u: UnidadMedida, checked: boolean) => {
    try {
      await updateUnidad(u.id, { isActive: checked })
      setUnits(prev => prev.map(x => x.id === u.id ? { ...x, isActive: checked } : x))
    } catch { message.error('Error al actualizar') }
  }

  const columns: ColumnsType<UnidadMedida> = [
    {
      title: 'Código',
      dataIndex: 'code',
      width: 100,
      render: (v: string, r) => (
        <Space size={4}>
          <Tag color={r.isSystem ? 'blue' : 'default'} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {v}
          </Tag>
          {r.isSystem && (
            <Tooltip title="Unidad del sistema — no se puede eliminar">
              <LockOutlined style={{ fontSize: 11, color: '#6b7280' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      ellipsis: true,
      render: (v: string) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
    {
      title: 'Orden',
      dataIndex: 'sortOrder',
      width: 70,
      align: 'center',
      render: (v: number) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v}</Text>,
    },
    {
      title: 'Activa',
      dataIndex: 'isActive',
      width: 80,
      align: 'center',
      render: (v: boolean, r) => (
        <Switch
          size="small"
          checked={v}
          onChange={checked => handleToggleActive(r, checked)}
        />
      ),
    },
    {
      title: '',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {!r.isSystem && (
            <Popconfirm
              title="¿Eliminar esta unidad?"
              okText="Eliminar" cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r.id)}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Unidades de Medida</Title>
          <Text type="secondary">Configura las unidades disponibles en líneas de factura, cotización y órdenes de compra</Text>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={openCreate}
          style={{ background: '#1B3A6B' }}
        >
          Nueva unidad
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={units}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={false}
          locale={{ emptyText: 'Sin unidades de medida' }}
          rowClassName={(r) => !r.isActive ? 'ant-table-row-disabled' : ''}
        />
      </Card>

      {/* Modal crear / editar */}
      <Modal
        title={editing ? `Editar — ${editing.code}` : 'Nueva unidad de medida'}
        open={modal}
        onCancel={() => { setModal(false); form.resetFields() }}
        onOk={handleSave}
        okText={<><SaveOutlined /> Guardar</>}
        okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
        width={440}
      >
        <Form form={form} layout="vertical" size="small">
          {!editing && (
            <Form.Item
              name="code"
              label="Código"
              rules={[{ required: true, message: 'Ingresa el código' }]}
              extra="Ejemplo: UND, KG, BOX, TON, etc."
            >
              <Input
                placeholder="UND"
                maxLength={10}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                onChange={e => form.setFieldValue('code', e.target.value.toUpperCase())}
              />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="Nombre"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}
          >
            <Input placeholder="Unidad, Kilogramo, Caja..." maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="Descripción (opcional)">
            <Input placeholder="Descripción adicional..." maxLength={100} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="sortOrder" label="Orden de visualización">
              <InputNumber min={0} max={999} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="isActive" label="Activa" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
