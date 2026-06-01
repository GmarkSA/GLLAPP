import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, message, Typography, Tag, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, NumberOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi, type DocumentSeries } from '../../../api/companies'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

const DOC_TYPES = [
  { value: 'FACT',  label: 'Facturas de Venta',     color: 'blue' },
  { value: 'NC',    label: 'Notas de Crédito',       color: 'orange' },
  { value: 'ND',    label: 'Notas de Débito',        color: 'red' },
  { value: 'REC',   label: 'Recibos',                color: 'cyan' },
  { value: 'PAG',   label: 'Pagos Recibidos',        color: 'green' },
  { value: 'ANT',   label: 'Anticipos',              color: 'lime' },
  { value: 'OC',    label: 'Órdenes de Compra',      color: 'purple' },
  { value: 'GAS',   label: 'Gastos',                 color: 'volcano' },
  { value: 'AF',    label: 'Activos Fijos',           color: 'magenta' },
  { value: 'COT',   label: 'Cotizaciones',            color: 'geekblue' },
  { value: 'FPROV', label: 'Facturas Proveedor',      color: 'gold' },
  { value: 'MOV',   label: 'Movimientos Inventario', color: 'default' },
]

const typeLabel = (code: string) => DOC_TYPES.find(d => d.value === code)?.label ?? code
const typeColor = (code: string) => DOC_TYPES.find(d => d.value === code)?.color ?? 'default'

export default function SeriesDocumentalesPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [series, setSeries]     = useState<DocumentSeries[]>([])
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<DocumentSeries | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setSeries(await companiesApi.getDocumentSeries(activeCompany.id)) }
    catch { message.error('Error al cargar series') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ series: 'A', currentNumber: 1, padding: 5 })
    setModal(true)
  }

  const openEdit = (s: DocumentSeries) => {
    setEditing(s)
    form.setFieldsValue(s)
    setModal(true)
  }

  const handleSave = async () => {
    if (!activeCompany) return
    const vals = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await companiesApi.updateDocumentSeries(editing.id, vals)
        message.success('Serie actualizada')
      } else {
        await companiesApi.createDocumentSeries(activeCompany.id, vals)
        message.success('Serie creada')
      }
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<DocumentSeries> = [
    {
      title: 'Tipo de Documento',
      dataIndex: 'documentType',
      render: (v: string) => (
        <Tag color={typeColor(v)}>{typeLabel(v)}</Tag>
      ),
    },
    {
      title: 'Serie',
      dataIndex: 'series',
      width: 80,
      render: (v: string) => <b>{v}</b>,
    },
    {
      title: 'Número Actual',
      dataIndex: 'currentNumber',
      width: 120,
      render: (v: number, r: DocumentSeries) => {
        const padded = String(v).padStart(r.padding, '0')
        return <code style={{ fontSize: 13 }}>{r.series}-{padded}</code>
      },
    },
    {
      title: 'Relleno',
      dataIndex: 'padding',
      width: 80,
      render: (v: number) => `${v} dígitos`,
    },
    {
      title: 'Ejemplo',
      width: 150,
      render: (_: any, r: DocumentSeries) => {
        const next = String(r.currentNumber + 1).padStart(r.padding, '0')
        return <span style={{ color: '#1B3A6B', fontWeight: 600 }}>→ {r.series}-{next}</span>
      },
    },
    {
      title: '',
      width: 60,
      render: (_: any, r: DocumentSeries) => (
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ]

  if (!activeCompany) {
    return <div style={{ padding: 24, color: '#999' }}>Seleccione una empresa para configurar sus series.</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <NumberOutlined style={{ marginRight: 8, color: '#1B3A6B' }} />
            Series de Documentos
          </Title>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{activeCompany.legalName}</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }} onClick={openCreate}>
          Nueva serie
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={series}
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title={editing ? 'Editar serie' : 'Nueva serie de documento'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Guardar' : 'Crear'}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="documentType" label="Tipo de Documento" rules={[{ required: true }]}>
            <Select
              options={DOC_TYPES.map(d => ({ value: d.value, label: d.label }))}
              placeholder="Seleccionar tipo"
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="series" label="Serie" rules={[{ required: true }]}>
              <Input placeholder="A" maxLength={10} />
            </Form.Item>
            <Form.Item name="currentNumber" label="Número actual" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="padding" label="Dígitos" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
