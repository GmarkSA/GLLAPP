import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space,
  message, Typography, Tag, Badge, Tooltip, Popconfirm,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companyIntegrationsApi, type BankProfile } from '../../../api/companyIntegrations'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

const PROVIDERS = [
  { value: 'bi_gt',       label: 'Banco Industrial (GT)' },
  { value: 'bac_gt',      label: 'BAC Credomatic (GT)' },
  { value: 'banrural_gt', label: 'Banrural (GT)' },
  { value: 'gyt_gt',      label: 'G&T Continental (GT)' },
  { value: 'bam_gt',      label: 'BAM (GT)' },
  { value: 'manual',      label: 'Manual / Extracto CSV' },
]

const STATUS_BADGE: Record<string, string> = {
  active:   'success',
  inactive: 'default',
  error:    'error',
  testing:  'processing',
}

export default function BankProfilesPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [profiles, setProfiles] = useState<BankProfile[]>([])
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<BankProfile | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setProfiles(await companyIntegrationsApi.getBankProfiles(activeCompany.id)) }
    catch { message.error('Error al cargar perfiles bancarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ countryCode: activeCompany?.countryCode, status: 'inactive' })
    setModal(true)
  }

  const openEdit = (p: BankProfile) => {
    setEditing(p)
    form.setFieldsValue({ ...p, ...p.apiConfigurationJson })
    setModal(true)
  }

  const handleSave = async () => {
    if (!activeCompany) return
    const { apiToken, baseUrl, ...rest } = await form.validateFields()
    const dto = { ...rest, apiConfigurationJson: { apiToken, baseUrl }, companyId: activeCompany.id }
    setSaving(true)
    try {
      if (editing) {
        await companyIntegrationsApi.updateBankProfile(editing.id, dto)
        message.success('Perfil bancario actualizado')
      } else {
        await companyIntegrationsApi.createBankProfile(activeCompany.id, dto)
        message.success('Perfil bancario creado')
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
      await companyIntegrationsApi.testBankProfile(id)
      message.success('Conexión bancaria exitosa')
      load()
    } catch {
      message.error('Error al probar la conexión bancaria')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await companyIntegrationsApi.removeBankProfile(id)
      message.success('Perfil eliminado')
      load()
    } catch {
      message.error('Error al eliminar')
    }
  }

  const columns: ColumnsType<BankProfile> = [
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Badge status={STATUS_BADGE[v] as any} text={v} />,
    },
    {
      title: 'Banco',
      dataIndex: 'bankName',
      render: (v: string) => <b>{v}</b>,
    },
    {
      title: 'Proveedor API',
      dataIndex: 'integrationProvider',
      render: (v?: string) => v
        ? <Tag color="#1faec2">{PROVIDERS.find(p => p.value === v)?.label ?? v}</Tag>
        : <Tag>Manual</Tag>,
    },
    {
      title: 'País',
      dataIndex: 'countryCode',
      width: 70,
    },
    {
      title: 'Último test',
      dataIndex: 'lastTestedAt',
      width: 160,
      render: (v?: string) => v ? new Date(v).toLocaleString('es-GT') : '—',
    },
    {
      title: '',
      width: 120,
      render: (_: any, r: BankProfile) => (
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
    return <div style={{ padding: 24, color: '#999' }}>Seleccione una empresa para configurar sus perfiles bancarios.</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Perfiles Bancarios</Title>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{activeCompany.legalName}</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }} onClick={openCreate}>
          Nuevo perfil
        </Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={profiles} loading={loading} size="small" pagination={false} />

      <Modal
        title={editing ? 'Editar perfil bancario' : 'Nuevo perfil bancario'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Guardar' : 'Crear'}
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="bankName" label="Nombre del Banco" rules={[{ required: true }]}>
              <Input placeholder="Banco Industrial, BAC..." />
            </Form.Item>
            <Form.Item name="countryCode" label="País" rules={[{ required: true }]}>
              <Select options={[
                { value: 'GT', label: '🇬🇹 GT' }, { value: 'HN', label: '🇭🇳 HN' },
                { value: 'SV', label: '🇸🇻 SV' }, { value: 'PA', label: '🇵🇦 PA' },
                { value: 'CR', label: '🇨🇷 CR' }, { value: 'MX', label: '🇲🇽 MX' },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="integrationProvider" label="Proveedor de Integración">
            <Select
              allowClear
              placeholder="Sin integración API (manual)"
              options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
            />
          </Form.Item>
          <Form.Item name="apiToken" label="Token / API Key">
            <Input.Password placeholder="Clave de acceso API bancaria" />
          </Form.Item>
          <Form.Item name="baseUrl" label="URL Base API">
            <Input placeholder="https://api.banco.com/v1" />
          </Form.Item>
          <Form.Item name="status" label="Estado">
            <Select options={[
              { value: 'inactive', label: 'Inactivo' },
              { value: 'active',   label: 'Activo' },
              { value: 'testing',  label: 'Pruebas' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
