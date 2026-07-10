import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, Popconfirm, message, Modal, Form, Input, Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  getCentrosBeneficio, crearCentroBeneficio, actualizarCentroBeneficio, eliminarCentroBeneficio,
  type CentroBeneficio,
} from '../../../api/centros-beneficio'

const { Title } = Typography

export default function CentrosBeneficioPage() {
  const [data,    setData]    = useState<CentroBeneficio[]>([])
  const [loading, setLoading] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<CentroBeneficio | null>(null)
  const [form]  = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getCentrosBeneficio()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); form.resetFields(); setModal(true) }
  const openEdit = (r: CentroBeneficio) => {
    setEditing(r)
    form.setFieldsValue({ codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion ?? '' })
    setModal(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await actualizarCentroBeneficio(editing.id, vals)
        message.success('Centro de beneficio actualizado')
      } else {
        await crearCentroBeneficio(vals)
        message.success('Centro de beneficio creado')
      }
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleEliminar = async (id: string) => {
    try { await eliminarCentroBeneficio(id); message.success('Desactivado'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', width: 110 },
    { title: 'Línea de negocio', dataIndex: 'nombre' },
    { title: 'Descripción', dataIndex: 'descripcion', render: (v: string) => v || '—' },
    {
      title: 'Estado', dataIndex: 'activo', width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', width: 110,
      render: (_: any, r: CentroBeneficio) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Desactivar este centro de beneficio?" onConfirm={() => handleEliminar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Centros de Beneficio / Líneas de Negocio</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
          style={{ background: '#1B3A6B' }}>Nueva</Button>
      </div>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ pageSize: 50 }}
      />

      <Modal
        title={editing ? 'Editar Centro de Beneficio' : 'Nuevo Centro de Beneficio'}
        open={modal} onCancel={() => setModal(false)}
        onOk={handleSave} okText="Guardar" confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Form.Item name="codigo" label="Código" rules={[{ required: true }]}>
              <Input placeholder="LN-001" />
            </Form.Item>
            <Form.Item name="nombre" label="Línea de negocio" rules={[{ required: true }]}>
              <Input placeholder="Línea Retail" />
            </Form.Item>
          </div>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
