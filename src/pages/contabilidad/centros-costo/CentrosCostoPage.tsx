import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, Popconfirm, message, Modal, Form, Input, Select, Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getCentrosCosto, crearCentroCosto, actualizarCentroCosto, eliminarCentroCosto,
  type CentroCosto,
} from '../../../api/centros-costo'

const { Title } = Typography

const GRUPOS = [
  'Administración', 'Ventas', 'Compras', 'Producción',
  'Operaciones', 'Logística', 'Recursos Humanos', 'Tecnología', 'Finanzas',
]

export default function CentrosCostoPage() {
  const [data,    setData]    = useState<CentroCosto[]>([])
  const [loading, setLoading] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<CentroCosto | null>(null)
  const [form]  = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getCentrosCosto()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); form.resetFields(); setModal(true) }
  const openEdit = (r: CentroCosto) => {
    setEditing(r)
    form.setFieldsValue({
      codigo:      r.codigo,
      nombre:      r.nombre,
      grupo:       r.grupo ?? undefined,
      responsable: r.responsable ?? '',
      area:        r.area ?? '',
    })
    setModal(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await actualizarCentroCosto(editing.id, vals)
        message.success('Centro de costo actualizado')
      } else {
        await crearCentroCosto(vals)
        message.success('Centro de costo creado')
      }
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleEliminar = async (id: string) => {
    try { await eliminarCentroCosto(id); message.success('Desactivado'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const columns = [
    { title: 'Código',      dataIndex: 'codigo',      width: 100 },
    { title: 'Nombre',      dataIndex: 'nombre' },
    { title: 'Grupo',       dataIndex: 'grupo',       width: 140, render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Área',        dataIndex: 'area',        width: 130, render: (v: string) => v || '—' },
    { title: 'Responsable', dataIndex: 'responsable', width: 160, render: (v: string) => v || '—' },
    {
      title: 'Fecha Creación', dataIndex: 'fechaCreacion', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Estado', dataIndex: 'activo', width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', width: 110,
      render: (_: any, r: CentroCosto) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Desactivar este centro de costo?" onConfirm={() => handleEliminar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Centros de Costo</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
          style={{ background: '#1B3A6B' }}>Nuevo</Button>
      </div>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ pageSize: 50 }}
      />

      <Modal
        title={editing ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
        open={modal} onCancel={() => setModal(false)}
        onOk={handleSave} okText="Guardar" confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Form.Item name="codigo" label="Código" rules={[{ required: true }]}>
              <Input placeholder="CC-001" />
            </Form.Item>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
              <Input placeholder="Administración" />
            </Form.Item>
          </div>
          <Form.Item name="grupo" label="Grupo">
            <Select
              placeholder="Seleccionar grupo"
              allowClear
              showSearch
              options={GRUPOS.map(g => ({ label: g, value: g }))}
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="area" label="Área">
              <Input placeholder="Ej: Finanzas, Operaciones" />
            </Form.Item>
            <Form.Item name="responsable" label="Responsable">
              <Input placeholder="Nombre del responsable" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
