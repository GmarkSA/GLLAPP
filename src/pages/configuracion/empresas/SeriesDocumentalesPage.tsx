import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, InputNumber, Space, message, Typography, Tag, Tooltip } from 'antd'
import { EditOutlined, NumberOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi, type DocumentSeries } from '../../../api/companies'
import { useCompanyStore } from '../../../store/companyStore'

const { Title } = Typography

type DocMeta = { label: string; color: string; group: string }

const DOC_META: Record<string, DocMeta> = {
  // Entidades
  cliente_local:           { label: 'Clientes Locales',         color: '#1faec2', group: 'Entidades' },
  cliente_exterior:        { label: 'Clientes Exterior',        color: '#1faec2', group: 'Entidades' },
  cliente_intercompany:    { label: 'Clientes Intercompany',    color: '#1faec2', group: 'Entidades' },
  proveedor_local:         { label: 'Proveedores Locales',      color: '#6b7280', group: 'Entidades' },
  proveedor_exterior:      { label: 'Proveedores Exterior',     color: '#6b7280', group: 'Entidades' },
  proveedor_intercompany:  { label: 'Proveedores Interco.',     color: '#6b7280', group: 'Entidades' },
  empleado:                { label: 'Empleados',                color: '#6b7280', group: 'Entidades' },
  // Ventas
  factura_venta:           { label: 'Facturas de Venta',        color: '#1faec2', group: 'Ventas' },
  cotizacion:              { label: 'Cotizaciones',              color: '#1faec2', group: 'Ventas' },
  nota_credito_venta:      { label: 'Notas de Crédito Venta',   color: '#ff7f00', group: 'Ventas' },
  pago_recibido:           { label: 'Pagos Recibidos',          color: '#2ea172', group: 'Ventas' },
  anticipo:                { label: 'Anticipos',                color: '#2ea172', group: 'Ventas' },
  // Compras
  factura_proveedor:       { label: 'Facturas Proveedor',       color: '#6b7280', group: 'Compras' },
  nota_credito_compra:     { label: 'Notas Crédito Compra',     color: '#ff7f00', group: 'Compras' },
  pago_proveedor:          { label: 'Pagos a Proveedores',      color: '#6b7280', group: 'Compras' },
  orden_compra:            { label: 'Órdenes de Compra',        color: '#6b7280', group: 'Compras' },
  // Contabilidad
  diario_manual:           { label: 'Diarios Manuales',         color: '#1B3A6B', group: 'Contabilidad' },
  diario_recurrente:       { label: 'Diarios Recurrentes',      color: '#1B3A6B', group: 'Contabilidad' },
  poliza:                  { label: 'Pólizas Contables',        color: '#1B3A6B', group: 'Contabilidad' },
  transferencia:           { label: 'Transferencias',            color: '#6b7280', group: 'Contabilidad' },
  cheque:                  { label: 'Cheques',                  color: '#6b7280', group: 'Contabilidad' },
  // Planillas
  corrida_planilla:        { label: 'Corridas de Planilla',     color: '#2ea172', group: 'Planillas' },
  finiquito:               { label: 'Finiquitos',               color: '#2ea172', group: 'Planillas' },
  // Activos Fijos (ISR Guatemala)
  activo_1000:             { label: 'AF: Terrenos',             color: '#ff7f00', group: 'Activos Fijos' },
  activo_2000:             { label: 'AF: Mobiliario y Equipo',  color: '#ff7f00', group: 'Activos Fijos' },
  activo_3000:             { label: 'AF: Equipo de Cómputo',    color: '#ff7f00', group: 'Activos Fijos' },
  activo_4000:             { label: 'AF: Programas de Cómputo', color: '#ff7f00', group: 'Activos Fijos' },
  activo_5000:             { label: 'AF: Vehículos',            color: '#ff7f00', group: 'Activos Fijos' },
  activo_6000:             { label: 'AF: Herramientas',         color: '#ff7f00', group: 'Activos Fijos' },
  activo_7000:             { label: 'AF: Maquinaria y Equipo',  color: '#ff7f00', group: 'Activos Fijos' },
  activo_8000:             { label: 'AF: Edificios',            color: '#ff7f00', group: 'Activos Fijos' },
  activo_9000:             { label: 'AF: Títulos y Derechos',   color: '#ff7f00', group: 'Activos Fijos' },
}

const GROUP_ORDER = ['Entidades', 'Ventas', 'Compras', 'Contabilidad', 'Planillas', 'Activos Fijos']

function formatNumber(s: DocumentSeries, n: number): string {
  const sep = s.separator ?? '-'
  const padded = String(n).padStart(s.padding, '0')
  const parts = [s.prefix, s.series, padded].filter(v => v != null && v !== '')
  return parts.join(sep)
}

export default function SeriesDocumentalesPage() {
  const activeCompany = useCompanyStore(st => st.activeCompany)
  const [series, setSeries]   = useState<DocumentSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<DocumentSeries | null>(null)
  const [saving, setSaving]   = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setSeries(await companiesApi.getDocumentSeries(activeCompany.id)) }
    catch { message.error('Error al cargar series') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  const openEdit = (s: DocumentSeries) => {
    setEditing(s)
    form.setFieldsValue({ currentNumber: s.currentNumber, padding: s.padding })
    setModal(true)
  }

  const handleSave = async () => {
    if (!editing) return
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await companiesApi.updateDocumentSeries(editing.id, vals)
      message.success('Serie actualizada')
      setModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: series.filter(s => (DOC_META[s.documentType]?.group ?? 'Otros') === group),
  })).filter(g => g.items.length > 0)

  const columns: ColumnsType<DocumentSeries> = [
    {
      title: 'Tipo de Documento',
      dataIndex: 'documentType',
      render: (v: string) => {
        const meta = DOC_META[v]
        return meta
          ? <Tag color={meta.color} style={{ fontSize: 12 }}>{meta.label}</Tag>
          : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Prefijo',
      dataIndex: 'prefix',
      width: 80,
      render: (v: string) => <code style={{ fontSize: 13, fontWeight: 600 }}>{v}</code>,
    },
    {
      title: 'Contador actual',
      dataIndex: 'currentNumber',
      width: 130,
      render: (v: number, r: DocumentSeries) => (
        <code style={{ fontSize: 13 }}>{formatNumber(r, v)}</code>
      ),
    },
    {
      title: 'Próximo',
      width: 140,
      render: (_: any, r: DocumentSeries) => (
        <span style={{ color: '#1faec2', fontWeight: 600 }}>
          → {formatNumber(r, r.currentNumber + 1)}
        </span>
      ),
    },
    {
      title: 'Dígitos',
      dataIndex: 'padding',
      width: 80,
      render: (v: number) => `${v} díg.`,
    },
    {
      title: '',
      width: 50,
      render: (_: any, r: DocumentSeries) => (
        <Tooltip title="Ajustar contador">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ]

  if (!activeCompany) {
    return <div style={{ padding: 24, color: '#999' }}>Seleccione una empresa para ver sus series.</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <NumberOutlined style={{ marginRight: 8, color: '#1faec2' }} />
          Correlativos Internos
        </Title>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
          {activeCompany.legalName} — las series se inicializan automáticamente
        </div>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size={20}>
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              {group}
            </div>
            <Table
              scroll={{ y: 'calc(100vh - 330px)' }}
              rowKey="id"
              columns={columns}
              dataSource={items}
              loading={loading}
              size="small"
              pagination={false}
              style={{ background: '#fff', borderRadius: 8 }}
            />
          </div>
        ))}
      </Space>

      <Modal
        title={`Ajustar serie — ${editing ? (DOC_META[editing.documentType]?.label ?? editing.documentType) : ''}`}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1faec2' } }}
      >
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
          Ajusta el contador si necesitas continuar desde un número específico (ej. al migrar datos).
        </div>
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="currentNumber" label="Número actual" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="padding" label="Dígitos de relleno" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
