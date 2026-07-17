import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Modal, message, Tabs, Popover, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, FileAddOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getEstimates, deleteEstimate, convertEstimate,
  ESTIMATE_STATUS_CONFIG, type Estimate, type EstimateStatus,
} from '../../../api/facturas'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Title, Text } = Typography

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_cotizaciones'

const ALL_COL_META: ColMeta[] = [
  { key: 'estimateNumber', label: '# Cotización',     description: 'Número interno' },
  { key: 'customer',       label: 'Cliente',           description: 'Nombre y NIT del cliente' },
  { key: 'customerTaxId',  label: 'NIT Cliente',       description: 'Solo el NIT, en columna separada' },
  { key: 'estimateDate',   label: 'Fecha Cotización' },
  { key: 'expiryDate',     label: 'Fecha Vencimiento' },
  { key: 'currency',       label: 'Moneda' },
  { key: 'exchangeRate',   label: 'Tipo de Cambio' },
  { key: 'subtotal',       label: 'Subtotal (Base)' },
  { key: 'discountAmount', label: 'Descuento' },
  { key: 'taxAmount',      label: 'IVA' },
  { key: 'total',          label: 'Total' },
  { key: 'itemsCount',     label: '# Líneas',          description: 'Cantidad de ítems en la cotización' },
  { key: 'status',         label: 'Estado' },
  { key: 'notes',          label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['estimateNumber', 'customer', 'estimateDate', 'expiryDate', 'total', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

const COL_WIDTHS: Record<string, number> = {
  estimateNumber: 140, customer: 200, customerTaxId: 120,
  estimateDate: 105, expiryDate: 105, currency: 80,
  exchangeRate: 90, subtotal: 110, discountAmount: 100,
  taxAmount: 100, total: 130, itemsCount: 80,
  status: 120, notes: 160,
}

// ── Definiciones de columna por clave ─────────────────────────────────────────
function buildColDef(key: string): ColumnsType<Estimate>[number] | null {
  const base = { key }
  switch (key) {
    case 'estimateNumber':
      return { ...base, title: '# Cotización', dataIndex: 'estimateNumber', width: 140, fixed: 'left' as const,
        render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> }
    case 'customer':
      return { ...base, title: 'Cliente',
        render: (_: any, r: Estimate) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
            {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.customerTaxId}</Text>}
          </div>
        ) }
    case 'customerTaxId':
      return { ...base, title: 'NIT Cliente', dataIndex: 'customerTaxId', width: 120,
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'estimateDate':
      return { ...base, title: 'Fecha', dataIndex: 'estimateDate', width: 105,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'expiryDate':
      return { ...base, title: 'Vence', dataIndex: 'expiryDate', width: 105,
        render: (v: string, r: Estimate) => {
          if (!v) return <Text type="secondary">—</Text>
          const isExpired = r.status === 'expired'
          return <span style={{ fontSize: 12, color: isExpired ? '#e5484d' : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'exchangeRate':
      return { ...base, title: 'T/C', dataIndex: 'exchangeRate', width: 90, align: 'right' as const,
        render: (v: number, r: Estimate) =>
          r.currency && r.currency !== 'GTQ'
            ? <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Number(v).toFixed(4)}</span>
            : <Text type="secondary">—</Text> }
    case 'subtotal':
      return { ...base, title: 'Subtotal', dataIndex: 'subtotal', width: 110, align: 'right' as const,
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'discountAmount':
      return { ...base, title: 'Descuento', dataIndex: 'discountAmount', width: 100, align: 'right' as const,
        render: (v: number) => Number(v) > 0
          ? <span style={{ fontSize: 12, color: '#059669' }}>- {fmt(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'taxAmount':
      return { ...base, title: 'IVA', dataIndex: 'taxAmount', width: 100, align: 'right' as const,
        render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span> }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        render: (v: number) => <Text strong style={{ fontSize: 13 }}>{fmt(v)}</Text> }
    case 'itemsCount':
      return { ...base, title: '# Líneas', width: 80, align: 'center' as const,
        render: (_: any, r: Estimate) => <Tag style={{ fontSize: 11 }}>{r.items?.length ?? 0}</Tag> }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 120,
        render: (v: EstimateStatus) => {
          const cfg = ESTIMATE_STATUS_CONFIG[v]
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Status tabs ───────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'all',      label: 'Todos'     },
  { key: 'draft',    label: 'Borrador'  },
  { key: 'sent',     label: 'Enviada'   },
  { key: 'accepted', label: 'Aceptada'  },
  { key: 'declined', label: 'Rechazada' },
  { key: 'invoiced', label: 'Facturada' },
  { key: 'expired',  label: 'Vencida'   },
]

// ── Página principal ──────────────────────────────────────────────────────────
export default function EstimacionesPage() {
  const navigate = useNavigate()
  const [estimates, setEstimates]       = useState<Estimate[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [statusTab, setStatusTab]       = useState('all')

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Convert modal
  const [convertModal, setConvertModal]     = useState(false)
  const [convertTarget, setConvertTarget]   = useState<Estimate | null>(null)
  const [convertLoading, setConvertLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchEstimates = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getEstimates(params)
      setEstimates(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando cotizaciones')
      setEstimates([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => { fetchEstimates() }, [fetchEstimates])

  const handleDelete = async (id: string) => {
    try { await deleteEstimate(id); message.success('Cotización eliminada'); fetchEstimates() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const openConvert = (est: Estimate) => { setConvertTarget(est); setConvertModal(true) }

  const handleConvert = async () => {
    if (!convertTarget) return
    setConvertLoading(true)
    try {
      const invoice = await convertEstimate(convertTarget.id)
      message.success('Cotización convertida a factura exitosamente')
      setConvertModal(false); setConvertTarget(null)
      navigate(`/ventas/facturas/${invoice.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo convertir')
    } finally { setConvertLoading(false) }
  }

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 160 // +acciones
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<Estimate> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key))
      .filter((c): c is ColumnsType<Estimate>[number] => c !== null),
    {
      key: '_actions',
      title: 'Acciones',
      align: 'center' as const,
      width: 160,
      fixed: 'right' as const,
      render: (_: any, r: Estimate) => {
        const canEdit    = r.status === 'draft' || r.status === 'sent'
        const canConvert = r.status !== 'invoiced' && r.status !== 'declined'
        return (
          <Space size={6}>
            <Tooltip title="Ver detalle">
              <Button size="small" icon={<EyeOutlined />}
                onClick={() => navigate(`/ventas/estimaciones/${r.id}`)} />
            </Tooltip>
            {canEdit && (
              <Tooltip title="Editar">
                <Button size="small" icon={<EditOutlined />}
                  onClick={() => navigate(`/ventas/estimaciones/${r.id}/editar`)} />
              </Tooltip>
            )}
            {canConvert && (
              <Tooltip title="Convertir a Factura">
                <Button size="small" icon={<FileAddOutlined />}
                  style={{ color: '#1faec2', borderColor: '#1faec2' }}
                  onClick={() => openConvert(r)} />
              </Tooltip>
            )}
            <Tooltip title="Eliminar">
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => handleDelete(r.id)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileOutlined style={{ fontSize: 24, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Cotizaciones</Title>
            <Text type="secondary">Propuestas y estimaciones enviadas a clientes</Text>
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/ventas/estimaciones/nueva')}
          style={{ background: '#1faec2' }}
        >
          Nueva cotización
        </Button>
      </div>

      {/* Filters + Tabs */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0 }} bodyStyle={{ padding: '12px 16px 0' }}>
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar cotización, cliente..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 260 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
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
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    style={{
                      border: colPopover ? '1px solid #1faec2' : undefined,
                      color:  colPopover ? '#1faec2' : undefined,
                    }}
                  >
                    Columnas
                  </Button>
                </Tooltip>
              </Popover>
            </Space>
          }
        />
      </Card>

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={activeColumns}
          dataSource={estimates}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: scrollX, y: 'calc(100vh - 280px)' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/estimaciones/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} cotizaciones`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin cotizaciones — crea la primera con "Nueva cotización"' }}
        />
      </Card>

      {/* Convert Modal */}
      <Modal
        title="Convertir a Factura"
        open={convertModal}
        onCancel={() => { setConvertModal(false); setConvertTarget(null) }}
        onOk={handleConvert}
        okText="Convertir"
        okButtonProps={{ loading: convertLoading, style: { background: '#1faec2' } }}
        cancelText="Cancelar"
      >
        <p>¿Convertir la cotización <strong>{convertTarget?.estimateNumber}</strong> a factura de venta?</p>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Se creará una nueva factura con los mismos ítems y montos. La cotización quedará marcada como <em>Facturada</em>.
        </p>
      </Modal>
    </div>
  )
}
