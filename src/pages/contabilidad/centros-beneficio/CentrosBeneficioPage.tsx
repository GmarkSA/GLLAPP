import { useEffect, useState, useCallback } from 'react'
import {
  Button, Table, Tag, Space, Popconfirm, message, Modal, Form, Input, Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
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
    form.setFieldsValue({
      codigo:      r.codigo,
      nombre:      r.nombre,
      grupo:       r.grupo ?? '',
      responsable: r.responsable ?? '',
    })
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

  const handleBloquear = async (id: string, activo: boolean) => {
    try {
      await actualizarCentroBeneficio(id, { activo: !activo })
      message.success(activo ? 'Centro de beneficio bloqueado' : 'Centro de beneficio desbloqueado')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const columns = [
    { title: 'Grupo',            dataIndex: 'grupo',       width: 140, render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Código',           dataIndex: 'codigo',      width: 100 },
    { title: 'Línea de negocio', dataIndex: 'nombre' },
    { title: 'Responsable',      dataIndex: 'responsable', width: 160, render: (v: string) => v || '—' },
    {
      title: 'Fecha Creación', dataIndex: 'fechaCreacion', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Estado', dataIndex: 'activo', width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', width: 130,
      render: (_: any, r: CentroBeneficio) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title={r.activo ? '¿Bloquear este centro de beneficio?' : '¿Desbloquear este centro de beneficio?'}
            onConfirm={() => handleBloquear(r.id, r.activo)}
          >
            <Button
              size="small"
              icon={r.activo ? <LockOutlined /> : <UnlockOutlined />}
              danger={r.activo}
              style={!r.activo ? { color: '#52c41a', borderColor: '#52c41a' } : undefined}
            >
              {r.activo ? 'Bloquear' : 'Desbloquear'}
            </Button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="grupo" label="Grupo">
              <Input placeholder="Ej: Comercial, Industrial, Servicios" />
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
