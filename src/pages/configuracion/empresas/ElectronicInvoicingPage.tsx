import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space,
  message, Typography, Tag, Badge, Tooltip, Popconfirm,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companyIntegrationsApi, type ElectronicInvoicingProfile } from '../../../api/companyIntegrations'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

const PROVIDERS = [
  { value: 'felplex',   label: 'FelPlex (GT)',         country: 'GT' },
  { value: 'infile',    label: 'INFILE (GT)',            country: 'GT' },
  { value: 'digifact',  label: 'Digifact (GT)',          country: 'GT' },
  { value: 'hacienda_cr', label: 'Ministerio Hacienda (CR)', country: 'CR' },
  { value: 'sat_mx',    label: 'SAT / PAC (MX)',         country: 'MX' },
  { value: 'dgi_pa',    label: 'DGI (PA)',               country: 'PA' },
  { value: 'sar_hn',    label: 'SAR (HN)',               country: 'HN' },
]

const STATUS_BADGE: Record<string, string> = {
  active:   'success',
  inactive: 'default',
  error:    'error',
  testing:  'processing',
}

export default function ElectronicInvoicingPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [profiles, setProfiles] = useState<ElectronicInvoicingProfile[]>([])
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<ElectronicInvoicingProfile | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setProfiles(await companyIntegrationsApi.getEInvoicing(activeCompany.id)) }
    catch { message.error('Error al cargar perfiles FEL') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ countryCode: activeCompany?.countryCode, environment: 'sandbox' })
    setModal(true)
  }

  const openEdit = (p: ElectronicInvoicingProfile) => {
    setEditing(p)
    form.setFieldsValue({ ...p, entityId: p.apiConfigurationJson?.entityId, apiKey: p.apiConfigurationJson?.apiKey })
    setModal(true)
  }

  const handleSave = async () => {
    if (!activeCompany) return
    const vals = await form.validateFields()
    const { entityId, apiKey, ...rest } = vals
    const dto = { ...rest, apiConfigurationJson: { entityId, apiKey } }
    setSaving(true)
    try {
      if (editing) {
        await companyIntegrationsApi.updateEInvoicing(editing.id, dto)
        message.success('Perfil FEL actualizado')
      } else {
        await companyIntegrationsApi.createEInvoicing(activeCompany.id, { ...dto, companyId: activeCompany.id })
        message.success('Perfil FEL creado')
      }
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: string) => {
    try {
      await companyIntegrationsApi.testEInvoicing(id)
      message.success('Conexión FEL exitosa')
      load()
    } catch {
      message.error('Error al probar la conexión FEL')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await companyIntegrationsApi.removeEInvoicing(id)
      message.success('Perfil eliminado')
      load()
    } catch {
      message.error('Error al eliminar perfil')
    }
  }

  const columns: ColumnsType<ElectronicInvoicingProfile> = [
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => <Badge status={STATUS_BADGE[v] as any} text={v} />,
    },
    {
      title: 'Proveedor',
      dataIndex: 'provider',
      render: (v: string) => {
        const p = PROVIDERS.find(x => x.value === v)
        return <Tag color="blue">{p?.label ?? v}</Tag>
      },
    },
    {
      title: 'País',
      dataIndex: 'countryCode',
      width: 70,
    },
    {
      title: 'Ambiente',
      dataIndex: 'environment',
      width: 100,
      render: (v: string) => v === 'production'
        ? <Tag color="red" icon={<CheckCircleOutlined />}>Producción</Tag>
        : <Tag color="orange" icon={<ExclamationCircleOutlined />}>Sandbox</Tag>,
    },
    {
      title: 'Último test',
      dataIndex: 'lastTestedAt',
      width: 160,
      render: (v?: string) => v ? new Date(v).toLocaleString('es-GT') : '—',
    },
    {
      title: '',
      width: 130,
      render: (_: any, r: ElectronicInvoicingProfile) => (
        <Space>
          <Tooltip title="Probar conexión">
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleTest(r.id)} />
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar perfil?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!activeCompany) {
    return <div style={{ padding: 24, color: '#999' }}>Seleccione una empresa para configurar su FEL.</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Facturación Electrónica (FEL)</Title>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{activeCompany.legalName}</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }} onClick={openCreate}>
          Nuevo perfil
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={profiles}
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title={editing ? 'Editar perfil FEL' : 'Nuevo perfil FEL'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Guardar' : 'Crear'}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="provider" label="Proveedor FEL" rules={[{ required: true }]}>
              <Select options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))} />
            </Form.Item>
            <Form.Item name="environment" label="Ambiente" rules={[{ required: true }]}>
              <Select options={[
                { value: 'sandbox', label: '🧪 Sandbox (pruebas)' },
                { value: 'production', label: '🔴 Producción' },
              ]} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="countryCode" label="País" rules={[{ required: true }]}>
              <Select options={[
                { value: 'GT', label: '🇬🇹 Guatemala' },
                { value: 'HN', label: '🇭🇳 Honduras' },
                { value: 'SV', label: '🇸🇻 El Salvador' },
                { value: 'PA', label: '🇵🇦 Panamá' },
                { value: 'CR', label: '🇨🇷 Costa Rica' },
                { value: 'MX', label: '🇲🇽 México' },
              ]} />
            </Form.Item>
            <Form.Item name="issuerTaxId" label="NIT Emisor">
              <Input placeholder="NIT del establecimiento" />
            </Form.Item>
          </div>
          <Form.Item name="entityId" label="Entity ID / Código de Acceso">
            <Input placeholder="Código provisto por el certificador" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key / Token">
            <Input.Password placeholder="Clave de acceso a la API" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
