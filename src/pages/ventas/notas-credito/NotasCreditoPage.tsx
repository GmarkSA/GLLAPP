import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  DatePicker, Tooltip, Popconfirm, message, Row, Col, Statistic,
  Modal, Form, Popover,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, DeleteOutlined, SendOutlined, EditOutlined,
  StopOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getNotasCredito, deleteNotaCredito, emitirNotaCredito, anularNotaCredito,
  type NotaCredito, NC_STATUS_CONFIG,
} from '../../../api/notas-credito'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_notas_credito'

const ALL_COL_META: ColMeta[] = [
  { key: 'invoiceNumber',      label: 'N° NC',             description: 'Número de la nota de crédito' },
  { key: 'invoiceDate',        label: 'Fecha' },
  { key: 'customer',           label: 'Cliente',            description: 'Nombre y NIT del cliente' },
  { key: 'customerTaxId',      label: 'NIT Cliente',        description: 'Solo el NIT, columna separada' },
  { key: 'originalInvoice',    label: 'Factura Original',   description: 'Número de la factura que se rectifica' },
  { key: 'creditNoteReason',   label: 'Motivo' },
  { key: 'currency',           label: 'Moneda' },
  { key: 'subtotal',           label: 'Subtotal (Base)' },
  { key: 'taxAmount',          label: 'IVA' },
  { key: 'total',              label: 'Total' },
  { key: 'creditBalance',      label: 'Crédito disponible' },
  { key: 'appliedCreditAmount',label: 'Crédito aplicado' },
  { key: 'status',             label: 'Estado' },
  { key: 'felStatus',          label: 'Estado FEL' },
  { key: 'felSerie',           label: 'Serie FEL' },
  { key: 'felNumero',          label: 'Número SAT' },
  { key: 'notes',              label: 'Notas' },
  { key: 'itemsCount',         label: '# Líneas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['invoiceNumber', 'invoiceDate', 'customer', 'originalInvoice', 'creditNoteReason', 'status', 'felStatus', 'total', 'creditBalance'].includes(c.key),
  sortOrder: i + 1,
}))

const COL_WIDTHS: Record<string, number> = {
  invoiceNumber: 155, invoiceDate: 105, customer: 200,
  customerTaxId: 120, originalInvoice: 150, creditNoteReason: 160,
  currency: 80, subtotal: 110, taxAmount: 100,
  total: 120, creditBalance: 120, appliedCreditAmount: 130,
  status: 130, felStatus: 100, felSerie: 80,
  felNumero: 100, notes: 150, itemsCount: 80,
}

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(key: string): ColumnsType<NotaCredito>[number] | null {
  const base = { key }
  switch (key) {
    case 'invoiceNumber':
      return { ...base, title: 'N° NC', dataIndex: 'invoiceNumber', width: 155, fixed: 'left' as const,
        sorter: (a: NotaCredito, b: NotaCredito) => String(a.invoiceNumber ?? '').localeCompare(String(b.invoiceNumber ?? '')),
        render: (v: string) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontSize: 12 }}>{v}</Text> }
    case 'invoiceDate':
      return { ...base, title: 'Fecha', dataIndex: 'invoiceDate', width: 105,
        sorter: (a: NotaCredito, b: NotaCredito) => String(a.invoiceDate ?? '').localeCompare(String(b.invoiceDate ?? '')),
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'customer':
      return { ...base, title: 'Cliente', dataIndex: 'customerName',
        sorter: (a: NotaCredito, b: NotaCredito) => String(a.customerName ?? '').localeCompare(String(b.customerName ?? '')),
        render: (_: any, r: NotaCredito) => (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.customerName}</div>
            {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>{r.customerTaxId}</Text>}
          </div>
        ) }
    case 'customerTaxId':
      return { ...base, title: 'NIT Cliente', dataIndex: 'customerTaxId', width: 120,
        sorter: (a: NotaCredito, b: NotaCredito) => String(a.customerTaxId ?? '').localeCompare(String(b.customerTaxId ?? '')),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'originalInvoice':
      return { ...base, title: 'Factura Original', width: 150,
        render: (_: any, r: NotaCredito) => r.originalInvoice
          ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.originalInvoice.invoiceNumber}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text> }
    case 'creditNoteReason':
      return { ...base, title: 'Motivo', dataIndex: 'creditNoteReason', ellipsis: true,
        render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v ?? '—'}</Text> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 110, align: 'right' as const,
        sorter: (a: NotaCredito, b: NotaCredito) => Number(a.subtotal ?? 0) - Number(b.subtotal ?? 0),
        render: (v: number) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</span> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 100, align: 'right' as const,
        render: (v: number) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</span> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 120, align: 'right' as const,
        sorter: (a: NotaCredito, b: NotaCredito) => Number(a.total ?? 0) - Number(b.total ?? 0),
        render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtQ(v)}</Text> }
    case 'creditBalance':
      return { ...base, title: 'Crédito disp.', dataIndex: 'creditBalance', width: 120, align: 'right' as const,
        sorter: (a: NotaCredito, b: NotaCredito) => Number(a.creditBalance ?? 0) - Number(b.creditBalance ?? 0),
        render: (v: number) => (
          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: Number(v) > 0 ? '#2ea172' : '#bbb' }}>
            {fmtQ(v)}
          </Text>
        ) }
    case 'appliedCreditAmount':
      return { ...base, title: 'Crédito aplicado', dataIndex: 'appliedCreditAmount', width: 130, align: 'right' as const,
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 130,
        sorter: (a: NotaCredito, b: NotaCredito) => String(a.status ?? '').localeCompare(String(b.status ?? '')),
        render: (v: string) => {
          const cfg = NC_STATUS_CONFIG[v as keyof typeof NC_STATUS_CONFIG]
          return <Tag color={cfg?.color ?? 'default'}>{cfg?.label ?? v}</Tag>
        } }
    case 'felStatus':
      return { ...base, title: 'FEL', dataIndex: 'felStatus', width: 100,
        render: (v: string) => v
          ? <Tag color={v === 'certificada' ? '#2ea172' : v === 'error' ? '#e5484d' : 'default'}>{v}</Tag>
          : <Text type="secondary">—</Text> }
    case 'felSerie':
      return { ...base, title: 'Serie FEL', dataIndex: 'felSerie', width: 80,
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'felNumero':
      return { ...base, title: 'No. SAT', dataIndex: 'felNumero', width: 100,
        render: (v: string) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 150, ellipsis: true,
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    case 'itemsCount':
      return { ...base, title: '# Líneas', width: 80, align: 'center' as const,
        render: (_: any, r: NotaCredito) => <Tag style={{ fontSize: 11 }}>{r.items?.length ?? 0}</Tag> }
    default: return null
  }
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function NotasCreditoPage() {
  const navigate = useNavigate()
  const today = dayjs()

  const [fromDate, setFromDate] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [toDate,   setToDate]   = useState(today.format('YYYY-MM-DD'))
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<NotaCredito[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [emitting, setEmitting] = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<NotaCredito | null>(null)
  const [voiding,    setVoiding]    = useState(false)
  const [voidForm]   = Form.useForm()

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotasCredito({ page, limit: 20, search: search || undefined, fromDate, toDate })
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch { setData([]); setTotal(0) }
    finally { setLoading(false) }
  }, [page, search, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const handleEmitir = async (id: string) => {
    setEmitting(id)
    try { await emitirNotaCredito(id); message.success('Nota de crédito emitida'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'Error al emitir') }
    finally { setEmitting(null) }
  }

  const handleDelete = async (id: string) => {
    try { await deleteNotaCredito(id); message.success('Nota de crédito eliminada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      await anularNotaCredito(voidTarget.id, reason)
      message.success(`${voidTarget.invoiceNumber} anulada correctamente`)
      setVoidTarget(null); voidForm.resetFields(); load()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al anular') }
    finally { setVoiding(false) }
  }

  const totalMonto   = data.reduce((s, nc) => s + Number(nc.total), 0)
  const totalCredito = data.reduce((s, nc) => s + Number(nc.creditBalance), 0)

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 150 // +acciones
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<NotaCredito> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key))
      .filter((c): c is ColumnsType<NotaCredito>[number] => c !== null),
    // Acciones — siempre fija al final (inline buttons, no dropdown)
    {
      key: '_actions',
      title: 'Acciones',
      width: 150,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, r: NotaCredito) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/ventas/notas-credito/${r.id}`)} />
          </Tooltip>
          {r.status === 'draft' && (
            <Tooltip title="Editar">
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1faec2' }} />}
                onClick={() => navigate(`/ventas/notas-credito/${r.id}/editar`)} />
            </Tooltip>
          )}
          {r.status === 'draft' && (
            <Tooltip title="Emitir FEL">
              <Button size="small" type="text" icon={<SendOutlined style={{ color: '#2ea172' }} />}
                loading={emitting === r.id}
                onClick={() => handleEmitir(r.id)} />
            </Tooltip>
          )}
          {(r.status === 'sent' || r.status === 'partial') && (
            <Tooltip title="Anular">
              <Button size="small" type="text" icon={<StopOutlined style={{ color: '#fa541c' }} />}
                onClick={() => setVoidTarget(r)} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar">
            <Popconfirm
              title="¿Eliminar esta nota de crédito?"
              description={r.status !== 'draft' ? 'Se eliminarán también las pólizas contables.' : 'Esta acción no se puede deshacer.'}
              onConfirm={() => handleDelete(r.id)}
              okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Notas de Crédito</Title>
            <Text type="secondary">Gestión de devoluciones y ajustes a clientes</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
          onClick={() => navigate('/ventas/notas-credito/nueva')}>
          Nueva Nota de Crédito
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <RangePicker
            format="YYYY-MM-DD"
            value={[dayjs(fromDate), dayjs(toDate)]}
            onChange={(_, strs) => {
              if (strs[0] && strs[1]) { setFromDate(strs[0]); setToDate(strs[1]); setPage(1) }
            }}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar NC, cliente, motivo..."
            style={{ width: 260 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Popover
            open={colPopover}
            onOpenChange={setColPopover}
            trigger="click"
            placement="bottomRight"
            title={null}
            content={
              <ColumnConfigurator
                config={colConfig}
                allColMeta={ALL_COL_META}
                defaultConfig={DEFAULT_COL_CONFIG}
                storageKey={STORAGE_KEY}
                onChange={setColConfig}
              />
            }
          >
            <Tooltip title="Configurar columnas">
              <Button size="small" icon={<SettingOutlined />}
                style={{ border: colPopover ? '1px solid #1faec2' : undefined, color: colPopover ? '#1faec2' : undefined }}>
                Columnas
              </Button>
            </Tooltip>
          </Popover>
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { title: 'Total NCs',          value: total,        fmt: (v: number) => String(v) },
          { title: 'Monto total',        value: totalMonto,   fmt: fmtQ },
          { title: 'Crédito disponible', value: totalCredito, fmt: fmtQ },
        ].map(s => (
          <Col span={8} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic title={s.title} value={s.value} formatter={v => s.fmt(Number(v))} valueStyle={{ fontSize: 16, color: '#0a0a0a' }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={activeColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          showSorterTooltip={false}
          scroll={{ x: scrollX, y: 'calc(100vh - 312px)' }}
          pagination={{ total, current: page, pageSize: 20, onChange: setPage, showTotal: t => `${t} notas de crédito`, showSizeChanger: false }}
          locale={{ emptyText: 'No hay notas de crédito en el período' }}
        />
      </Card>

      {/* Modal anular */}
      <Modal
        title={`Anular ${voidTarget?.invoiceNumber}`}
        open={!!voidTarget}
        onCancel={() => { setVoidTarget(null); voidForm.resetFields() }}
        onOk={handleVoid}
        confirmLoading={voiding}
        okText="Anular nota de crédito"
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Esta acción eliminará las pólizas contables asociadas y marcará la nota como anulada.
        </Text>
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de anulación" rules={[{ required: true, message: 'Ingresa el motivo' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Emitida por error — datos incorrectos" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
