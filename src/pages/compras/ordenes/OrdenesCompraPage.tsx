import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Modal, message, Tabs, Popover, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ShoppingOutlined, MoreOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getPurchaseOrders, deletePurchaseOrder, approvePurchaseOrder,
  PO_STATUS_CONFIG, type PurchaseOrder, type POStatus,
} from '../../../api/compras'
import { getPaymentTermLabel } from '../../../components/PaymentTermsSelect'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Title, Text } = Typography

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_ordenes_compra'

const ALL_COL_META: ColMeta[] = [
  { key: 'orderNumber',          label: '# OC',                  description: 'Número interno de la orden' },
  { key: 'vendorName',           label: 'Proveedor' },
  { key: 'orderDate',            label: 'Fecha Orden' },
  { key: 'expectedDeliveryDate', label: 'Entrega esperada' },
  { key: 'currency',             label: 'Moneda' },
  { key: 'paymentTerms',         label: 'Términos de Pago' },
  { key: 'itemsCount',           label: '# Líneas',              description: 'Cantidad de líneas de la orden' },
  { key: 'total',                label: 'Total' },
  { key: 'status',               label: 'Estado' },
  { key: 'notes',                label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['orderNumber', 'vendorName', 'orderDate', 'expectedDeliveryDate', 'total', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

// ── Definiciones de columna por clave ────────────────────────────────────────
function buildColDef(
  key: string,
  navigate: (path: string) => void,
): ColumnsType<PurchaseOrder>[number] | null {
  const base = { key }
  switch (key) {
    case 'orderNumber':
      return { ...base, title: '# OC', dataIndex: 'orderNumber', width: 140,
        render: (v: string) => <Text strong style={{ color: '#1B3A6B', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> }
    case 'vendorName':
      return { ...base, title: 'Proveedor', dataIndex: 'vendorName',
        render: (v: string) => <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span> }
    case 'orderDate':
      return { ...base, title: 'Fecha Orden', dataIndex: 'orderDate', width: 110,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'expectedDeliveryDate':
      return { ...base, title: 'Entrega esperada', dataIndex: 'expectedDeliveryDate', width: 140,
        render: (v: string) => {
          if (!v) return <Text type="secondary">—</Text>
          const isPast = dayjs(v).isBefore(dayjs(), 'day')
          return <span style={{ fontSize: 12, color: isPast ? '#fa8c16' : undefined, fontWeight: isPast ? 600 : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        } }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'paymentTerms':
      return { ...base, title: 'Términos Pago', dataIndex: 'paymentTerms', width: 140,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? getPaymentTermLabel(v) : '—'}</span> }
    case 'itemsCount':
      return { ...base, title: '# Líneas', width: 80, align: 'center' as const,
        render: (_: any, r: PurchaseOrder) => (
          <Tag style={{ fontSize: 11 }}>{r.items?.length ?? 0}</Tag>
        ) }
    case 'total':
      return { ...base, title: 'Total', dataIndex: 'total', width: 130, align: 'right' as const,
        render: (v: number) => <Text strong>{fmt(v)}</Text> }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 120,
        render: (v: POStatus) => {
          const cfg = PO_STATUS_CONFIG[v]
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
  { key: 'all',       label: 'Todos'     },
  { key: 'draft',     label: 'Borrador'  },
  { key: 'sent',      label: 'Enviada'   },
  { key: 'received',  label: 'Recibida'  },
  { key: 'billed',    label: 'Facturada' },
  { key: 'cancelled', label: 'Cancelada' },
]

// ── Página principal ──────────────────────────────────────────────────────────
export default function OrdenesCompraPage() {
  const navigate = useNavigate()
  const [orders, setOrders]             = useState<PurchaseOrder[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [statusTab, setStatusTab]       = useState('all')

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Approve modal
  const [approveModal, setApproveModal]     = useState(false)
  const [approveTarget, setApproveTarget]   = useState<PurchaseOrder | null>(null)
  const [approveLoading, setApproveLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getPurchaseOrders(params)
      setOrders(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando órdenes de compra')
      setOrders([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleDelete = async (id: string) => {
    try { await deletePurchaseOrder(id); message.success('Orden eliminada'); fetchOrders() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const handleApprove = async () => {
    if (!approveTarget) return
    setApproveLoading(true)
    try {
      await approvePurchaseOrder(approveTarget.id)
      message.success('Orden aprobada y enviada al proveedor')
      setApproveModal(false); setApproveTarget(null)
      fetchOrders()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo aprobar la orden')
    } finally { setApproveLoading(false) }
  }

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<PurchaseOrder> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key, navigate))
      .filter((c): c is ColumnsType<PurchaseOrder>[number] => c !== null),
    // Acciones — siempre al final
    {
      key: '_actions',
      title: '',
      width: 50,
      render: (_: any, r: PurchaseOrder) => {
        const isDraft     = r.status === 'draft'
        const isCancelled = r.status === 'cancelled'
        const isBilled    = r.status === 'billed'
        const canApprove  = r.status === 'draft' || r.status === 'sent'
        const items: any[] = [{ key: 'view', label: 'Ver' }]
        if (isDraft)   items.push({ key: 'edit', label: 'Editar' })
        if (canApprove) items.push({ key: 'approve', label: 'Aprobar' })
        if (!isCancelled && !isBilled) {
          items.push({ type: 'divider' })
          items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span> })
        }
        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')    navigate(`/compras/ordenes/${r.id}`)
                if (key === 'edit')    navigate(`/compras/ordenes/${r.id}/editar`)
                if (key === 'approve') { setApproveTarget(r); setApproveModal(true) }
                if (key === 'delete')  handleDelete(r.id)
              },
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShoppingOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Órdenes de compra</Title>
            <Text type="secondary">Solicitudes de compra enviadas a proveedores</Text>
          </div>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/compras/ordenes/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva orden
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
                placeholder="Buscar OC, proveedor..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 240 }}
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
                      border: colPopover ? '1px solid #1B3A6B' : undefined,
                      color:  colPopover ? '#1B3A6B' : undefined,
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
          dataSource={orders}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/ordenes/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} órdenes`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin órdenes de compra' }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title="Aprobar orden de compra"
        open={approveModal}
        onCancel={() => { setApproveModal(false); setApproveTarget(null) }}
        onOk={handleApprove}
        okText="Aprobar"
        okButtonProps={{ loading: approveLoading, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
      >
        <p>
          ¿Aprobar la orden <strong>{approveTarget?.orderNumber}</strong> por{' '}
          <strong>{approveTarget ? fmt(approveTarget.total) : ''}</strong>?
        </p>
        <p style={{ color: '#8c8c8c', fontSize: 13 }}>
          Al aprobar, la orden quedará marcada como <em>Enviada</em> y se notificará al proveedor{' '}
          <strong>{approveTarget?.vendorName}</strong>.
        </p>
      </Modal>
    </div>
  )
}
