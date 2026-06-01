import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Table, Button, Modal, Form, Input, Switch, Space, Popconfirm, message, Typography, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { branchesApi, type Branch } from '../../../api/branches'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

export default function SucursalesPage() {
  const { id: paramId }    = useParams<{ id: string }>()
  const activeCompany      = useCompanyStore(s => s.activeCompany)
  const companyId          = paramId ?? activeCompany?.id
  const navigate           = useNavigate()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Branch | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form]                    = Form.useForm()

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try { setBranches(await branchesApi.getAll(companyId)) }
    catch { message.error('Error al cargar sucursales') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [companyId])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit   = (b: Branch) => { setEditing(b); form.setFieldsValue(b); setModalOpen(true) }

  const handleSave = async (values: any) => {
    if (!companyId) return
    setSaving(true)
    try {
      if (editing) {
        await branchesApi.update(editing.id, values)
        message.success('Sucursal actualizada')
      } else {
        await branchesApi.create(companyId, values)
        message.success('Sucursal creada')
      }
      setModalOpen(false)
      load()
    } catch {
      message.error('Error al guardar sucursal')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try { await branchesApi.remove(id); message.success('Sucursal desactivada'); load() }
    catch { message.error('Error al desactivar sucursal') }
  }

  const columns: ColumnsType<Branch> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      render: (v: string, r: Branch) => (
        <Space>
          {v}
          {r.isDefault && <Tag color="blue">Principal</Tag>}
        </Space>
      ),
    },
    { title: 'Código',    dataIndex: 'code',     width: 90 },
    { title: 'Ciudad',    dataIndex: 'city',     width: 120 },
    { title: 'Teléfono',  dataIndex: 'phone',    width: 130 },
    { title: 'Encargado', dataIndex: 'managerName' },
    {
      title: 'Acciones',
      width: 120,
      render: (_: any, r: Branch) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {!r.isDefault && (
            <Popconfirm title="¿Desactivar sucursal?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/configuracion/empresas')} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Sucursales</Title>
          {activeCompany && <div style={{ fontSize: 12, color: '#888' }}>{activeCompany.legalName}</div>}
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginLeft: 'auto', background: '#1B3A6B' }}
          onClick={openCreate}>Nueva Sucursal</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={branches} loading={loading} size="small" pagination={false} />

      <Modal title={editing ? 'Editar Sucursal' : 'Nueva Sucursal'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()}
        confirmLoading={saving} okText="Guardar">
        <Form form={form} layout="vertical" size="small" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="Nombre" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Código" name="code">
              <Input placeholder="GUA-Z10" />
            </Form.Item>
            <Form.Item label="Dirección" name="address">
              <Input />
            </Form.Item>
            <Form.Item label="Ciudad" name="city">
              <Input />
            </Form.Item>
            <Form.Item label="Teléfono" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="Encargado" name="managerName">
              <Input />
            </Form.Item>
          </div>
          <Form.Item label="Sucursal Principal" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
