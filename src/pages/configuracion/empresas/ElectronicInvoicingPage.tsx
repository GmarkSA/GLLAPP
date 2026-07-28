import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space,
  message, Typography, Tag, Badge, Tooltip, Popconfirm, Alert, Result,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  ThunderboltOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companyIntegrationsApi, type ElectronicInvoicingProfile } from '../../../api/companyIntegrations'
import { useCompanyStore } from '../../../store/companyStore'
import {
  FEL_DOC_TYPES_BY_REGIME, FEL_DEFAULT_BY_REGIME, FEL_ALL_DOC_TYPES,
  REGIME_LABELS, type FelDocType,
} from '../../../api/fel'

const { Title, Text } = Typography

const PROVIDERS = [
  { value: 'felplex',      label: 'FelPlex (GT)',              country: 'GT' },
  { value: 'infile',       label: 'INFILE (GT)',               country: 'GT' },
  { value: 'digifact',     label: 'Digifact (GT)',             country: 'GT' },
  { value: 'cari',         label: 'CARI (GT)',                 country: 'GT' },
  { value: 'hacienda_cr',  label: 'Ministerio Hacienda (CR)', country: 'CR' },
  { value: 'sat_mx',       label: 'SAT / PAC (MX)',            country: 'MX' },
  { value: 'dgi_pa',       label: 'DGI (PA)',                  country: 'PA' },
  { value: 'sar_hn',       label: 'SAR (HN)',                  country: 'HN' },
]

// Proveedores con URL de NIT lookup ya conocida — los demás requieren nitLookupUrl manual
const KNOWN_LOOKUP_PROVIDERS = new Set(['felplex', 'infile', 'digifact'])

const GT_REGIMES = Object.entries(REGIME_LABELS).map(([value, label]) => ({ value, label }))

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
  const [testing, setTesting]   = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; detail?: any } | null>(null)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<ElectronicInvoicingProfile | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form] = Form.useForm()

  const watchRegime  = Form.useWatch('regimeCode',  form)
  const watchProvider = Form.useWatch('provider',   form)

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setProfiles(await companyIntegrationsApi.getEInvoicing(activeCompany.id)) }
    catch { message.error('Error al cargar perfiles FEL') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  // Tipos de doc disponibles según régimen seleccionado
  const availableDocTypes: FelDocType[] =
    watchRegime ? (FEL_DOC_TYPES_BY_REGIME[watchRegime] ?? FEL_ALL_DOC_TYPES) : FEL_ALL_DOC_TYPES

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ countryCode: activeCompany?.countryCode, environment: 'sandbox' })
    setModal(true)
  }

  const openEdit = (p: ElectronicInvoicingProfile) => {
    setEditing(p)
    form.setFieldsValue({
      provider:            p.provider,
      environment:         p.environment,
      countryCode:         p.countryCode,
      issuerTaxId:         p.issuerTaxId,
      // credenciales — guardadas en credentialsEncrypted
      entityId:            (p as any).credentialsEncrypted?.entityId ?? p.apiConfigurationJson?.entityId,
      apiKey:              (p as any).credentialsEncrypted?.apiKey   ?? p.apiConfigurationJson?.apiKey,
      // configuración
      regimeCode:          p.apiConfigurationJson?.regimeCode,
      defaultDocumentType: p.apiConfigurationJson?.defaultDocumentType,
      nitLookupUrl:        p.apiConfigurationJson?.nitLookupUrl,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!activeCompany) return
    const vals = await form.validateFields()
    const { entityId, apiKey, regimeCode, defaultDocumentType, nitLookupUrl, ...rest } = vals

    // Credenciales → credentialsEncrypted (donde el backend las lee para FEL)
    // Configuración de régimen/doc/lookup → apiConfigurationJson
    const dto = {
      ...rest,
      credentialsEncrypted: { entityId, apiKey },
      apiConfigurationJson: {
        ...(editing?.apiConfigurationJson ?? {}),
        regimeCode,
        defaultDocumentType,
        ...(nitLookupUrl ? { nitLookupUrl } : {}),
      },
      status: 'active',
    }

    setSaving(true)
    try {
      if (editing) {
        await companyIntegrationsApi.updateEInvoicing(editing.id, dto as any)
        message.success('Perfil FEL actualizado')
      } else {
        await companyIntegrationsApi.createEInvoicing(activeCompany.id, { ...dto, companyId: activeCompany.id } as any)
        message.success('Perfil FEL creado')
      }
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    setTestResult(null)
    try {
      const result = await companyIntegrationsApi.testEInvoicing(id) as any
      setTestResult(result)
      message.success(result.success ? 'Conexión FEL exitosa' : `Fallo: ${result.message}`)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error al probar la conexión FEL'
      setTestResult({ success: false, message: msg })
      message.error(msg)
    } finally { setTesting(null) }
  }

  const handleDelete = async (id: string) => {
    try {
      await companyIntegrationsApi.removeEInvoicing(id)
      message.success('Perfil desactivado')
      load()
    } catch { message.error('Error al eliminar perfil') }
  }

  const columns: ColumnsType<ElectronicInvoicingProfile> = [
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Badge status={STATUS_BADGE[v] as any} text={v} />,
    },
    {
      title: 'Proveedor',
      render: (_: any, p: ElectronicInvoicingProfile) => {
        const prov = PROVIDERS.find(x => x.value === p.provider)
        return <Tag color="#1faec2">{prov?.label ?? p.provider}</Tag>
      },
    },
    {
      title: 'Régimen',
      render: (_: any, p: ElectronicInvoicingProfile) => {
        const rc = p.apiConfigurationJson?.regimeCode
        return rc ? <Text style={{ fontSize: 12 }}>{REGIME_LABELS[rc] ?? rc}</Text> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Tipo doc. default',
      render: (_: any, p: ElectronicInvoicingProfile) => {
        const dt = p.apiConfigurationJson?.defaultDocumentType
        return dt ? <Tag color="#1faec2">{dt}</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Ambiente',
      dataIndex: 'environment',
      width: 100,
      render: (v: string) => v === 'production'
        ? <Tag color="#e5484d"   icon={<CheckCircleOutlined />}>Producción</Tag>
        : <Tag color="#ff7f00" icon={<ExclamationCircleOutlined />}>Sandbox</Tag>,
    },
    {
      title: 'Último test',
      dataIndex: 'lastTestedAt',
      width: 150,
      render: (v?: string) => v ? new Date(v).toLocaleString('es-GT') : '—',
    },
    {
      title: '',
      width: 120,
      render: (_: any, r: ElectronicInvoicingProfile) => (
        <Space>
          <Tooltip title="Probar conexión real">
            <Button size="small" icon={<ThunderboltOutlined />}
              loading={testing === r.id} onClick={() => handleTest(r.id)} />
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Desactivar perfil?" onConfirm={() => handleDelete(r.id)}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafetyCertificateOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Facturación Electrónica (FEL)</Title>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{activeCompany.legalName}</div>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }} onClick={openCreate}>
          Nuevo perfil
        </Button>
      </div>

      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          message={testResult.success ? 'Conexión exitosa' : 'Fallo de conexión'}
          description={testResult.message}
          showIcon
          closable
          onClose={() => setTestResult(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={profiles}
        loading={loading}
        size="small"
        pagination={false}
      />

      {/* Modal crear/editar perfil FEL */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined />
            {editing ? 'Editar perfil FEL' : 'Nuevo perfil FEL'}
          </Space>
        }
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Guardar' : 'Crear'}
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={540}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {/* Proveedor + Ambiente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="provider" label="Proveedor FEL" rules={[{ required: true }]}>
              <Select options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))} />
            </Form.Item>
            <Form.Item name="environment" label="Ambiente" rules={[{ required: true }]}>
              <Select options={[
                { value: 'sandbox',    label: '🧪 Sandbox (pruebas)' },
                { value: 'production', label: '🔴 Producción' },
              ]} />
            </Form.Item>
          </div>

          {/* País + NIT Emisor */}
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

          {/* Régimen fiscal → auto-filtra tipos de documento */}
          {(watchProvider === 'felplex' || watchProvider === 'infile' || watchProvider === 'digifact' || watchProvider === 'cari') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="regimeCode" label="Régimen del contribuyente"
                tooltip="Define qué tipos de documento puede emitir esta empresa">
                <Select
                  placeholder="Selecciona régimen"
                  options={GT_REGIMES}
                  onChange={regime => {
                    const defaultType = FEL_DEFAULT_BY_REGIME[regime]
                    if (defaultType) form.setFieldValue('defaultDocumentType', defaultType)
                  }}
                />
              </Form.Item>
              <Form.Item name="defaultDocumentType" label="Tipo doc. por defecto"
                tooltip="Se usará automáticamente al certificar facturas sin tipo definido">
                <Select
                  placeholder="Tipo de documento"
                  options={availableDocTypes.map(d => ({ value: d.code, label: d.label }))}
                />
              </Form.Item>
            </div>
          ) : null}

          {/* Credenciales API */}
          <Form.Item name="entityId" label="Entity ID" rules={[{ required: true, message: 'Requerido' }]}
            tooltip="Código de tu entidad en el certificador (entityId / código de acceso)">
            <Input placeholder="Código provisto por el certificador" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key / Token" rules={[{ required: true, message: 'Requerido' }]}
            tooltip="Token de autenticación (X-Authorization)">
            <Input.Password placeholder="Clave secreta de la API" />
          </Form.Item>

          {/* URL de consulta NIT — requerida para certifadores no estándar (CARI, etc.) */}
          {watchProvider && !KNOWN_LOOKUP_PROVIDERS.has(watchProvider) && (
            <Form.Item name="nitLookupUrl" label="URL base para consulta NIT/CUI"
              tooltip="Base URL del API del certifador para buscar NITs. Ejemplo: https://api.micertifador.com/v1">
              <Input placeholder="https://api.certifador.com/api" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
