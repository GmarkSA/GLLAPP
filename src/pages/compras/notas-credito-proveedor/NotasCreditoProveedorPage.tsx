import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  message, Tabs, Tooltip, Drawer, InputNumber, Divider, Badge, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, StopOutlined, DeleteOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getCreditNotes, voidBill, deleteBill,
  BILL_STATUS_CONFIG,
  type PurchaseInvoice, type BillStatus,
} from '../../../api/compras'

const { Title, Text } = Typography

const fmtGTQ = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_TABS = [
  { key: 'all',     label: 'Todas'    },
  { key: 'draft',   label: 'Borrador' },
  { key: 'open',    label: 'Abierta'  },
  { key: 'voided',  label: 'Anulada'  },
]

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface NcpAdFilters {
  filterVendor?: string
  filterVendorTaxId?: string
  filterInvoiceNumber?: string
  filterStatus?: string[]
  filterCurrency?: string[]
  filterTotalMin?: number | null
  filterTotalMax?: number | null
}

const NCP_EMPTY: NcpAdFilters = {}

function applyNcpFilters(data: PurchaseInvoice[], f: NcpAdFilters): PurchaseInvoice[] {
  return data.filter(r => {
    if (f.filterVendor && !r.vendorName?.toLowerCase().includes(f.filterVendor.toLowerCase())) return false
    if (f.filterVendorTaxId && !r.vendorTaxId?.toLowerCase().includes(f.filterVendorTaxId.toLowerCase())) return false
    if (f.filterInvoiceNumber && !r.invoiceNumber?.toLowerCase().includes(f.filterInvoiceNumber.toLowerCase())) return false
    if (f.filterStatus?.length && !f.filterStatus.includes(r.status ?? '')) return false
    if (f.filterCurrency?.length && !f.filterCurrency.includes(r.currency ?? 'GTQ')) return false
    if (f.filterTotalMin != null && Number(r.total ?? 0) < f.filterTotalMin) return false
    if (f.filterTotalMax != null && Number(r.total ?? 0) > f.filterTotalMax) return false
    return true
  })
}

export default function NotasCreditoProveedorPage() {
  const navigate = useNavigate()
  const [data,      setData]      = useState<PurchaseInvoice[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page,      setPage]      = useState(1)

  // Filtros avanzados
  const [ncpFilters,    setNcpFilters]    = useState<NcpAdFilters>(NCP_EMPTY)
  const [ncpDraft,      setNcpDraft]      = useState<NcpAdFilters>(NCP_EMPTY)
  const [ncpFilterOpen, setNcpFilterOpen] = useState(false)

  const activeCount = useMemo(() =>
    Object.entries(ncpFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [ncpFilters])

  const filteredData = useMemo(() => applyNcpFilters(data, ncpFilters), [data, ncpFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (search)               params.search = search
      if (statusTab !== 'all')  params.status = statusTab
      const res = await getCreditNotes(params)
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando notas de crédito')
      setData([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, search, statusTab])

  useEffect(() => { load() }, [load])

  const handleVoid = async (r: PurchaseInvoice) => {
    try {
      await voidBill(r.id)
      message.success('Nota de crédito anulada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo anular') }
  }

  const handleDelete = async (id: string) => {
    try { await deleteBill(id); message.success('Eliminada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const openFilters = () => { setNcpDraft(ncpFilters); setNcpFilterOpen(true) }
  const applyFilters = () => { setNcpFilters(ncpDraft); setNcpFilterOpen(false) }
  const clearFilters = () => { setNcpDraft(NCP_EMPTY); setNcpFilters(NCP_EMPTY) }

  const columns: ColumnsType<PurchaseInvoice> = [
    {
      title: '# Nota', dataIndex: 'invoiceNumber', width: 150, fixed: 'left',
      sorter: (a, b) => (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? ''),
      render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '# Doc. Proveedor', dataIndex: 'vendorInvoiceNumber', width: 150,
      sorter: (a, b) => (a.vendorInvoiceNumber ?? '').localeCompare(b.vendorInvoiceNumber ?? ''),
      render: (v: string) => v
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Proveedor', width: 210,
      sorter: (a, b) => (a.vendorName ?? '').localeCompare(b.vendorName ?? ''),
      render: (_: any, r: PurchaseInvoice) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vendorName}</div>
          {r.vendorTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.vendorTaxId}</Text>}
        </div>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'invoiceDate', width: 105,
      defaultSortOrder: 'descend' as const,
      sorter: (a, b) => (a.invoiceDate ?? '').localeCompare(b.invoiceDate ?? ''),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Serie FEL', dataIndex: 'felSerie', width: 90,
      sorter: (a, b) => (a.felSerie ?? '').localeCompare(b.felSerie ?? ''),
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'No. SAT', dataIndex: 'felNumber', width: 110,
      sorter: (a, b) => (a.felNumber ?? '').localeCompare(b.felNumber ?? ''),
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Monto', dataIndex: 'total', width: 130, align: 'right',
      sorter: (a, b) => Number(a.total ?? 0) - Number(b.total ?? 0),
      render: (v: number, r: PurchaseInvoice) => {
        const cur = r.currency ?? 'GTQ'
        if (cur !== 'GTQ' && Number(r.exchangeRate) > 1) {
          return (
            <div style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 13, color: '#e5484d', fontWeight: 700 }}>
                {cur} {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                Q {(Number(v) * Number(r.exchangeRate)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )
        }
        return <Text strong style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(v)}</Text>
      },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      sorter: (a, b) => (a.status ?? '').localeCompare(b.status ?? ''),
      render: (v: BillStatus) => {
        const cfg = BILL_STATUS_CONFIG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      key: 'actions', width: 130, align: 'center', fixed: 'right',
      render: (_: any, r: PurchaseInvoice) => (
        <Space size={4}>
          <Tooltip title="Ver / Editar">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/compras/notas-credito-proveedor/${r.id}`)} />
          </Tooltip>
          {r.status !== 'voided' && (
            <Tooltip title="Anular">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => handleVoid(r)} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 24, color: '#e5484d' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Notas de Crédito — Proveedor</Title>
            <Text type="secondary">Documentos que reducen saldo a pagar a proveedor</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/compras/notas-credito-proveedor/nueva')}
          style={{ background: '#e5484d', borderColor: '#e5484d' }}
        >
          Nueva nota de crédito
        </Button>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0, position: 'sticky', top: 60, zIndex: 5 }}
        bodyStyle={{ padding: '12px 16px 0' }}
      >
        <Tabs
          activeKey={statusTab}
          onChange={k => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space wrap style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar número, proveedor, serie FEL..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 260 }}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                allowClear
                size="small"
              />
              <Badge count={activeCount} size="small">
                <Button
                  size="small"
                  icon={<FilterOutlined />}
                  onClick={openFilters}
                  style={activeCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
                >
                  Filtros
                </Button>
              </Badge>
            </Space>
          }
        />
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          size="middle"
          showSorterTooltip={false}
          scroll={{ x: 1050, y: 'calc(100vh - 312px)' }}
          onRow={r => ({ onDoubleClick: () => navigate(`/compras/notas-credito-proveedor/${r.id}`) })}
          rowClassName={r => r.status === 'voided' ? 'row-void' : ''}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: t => `${t} notas de crédito`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin notas de crédito de proveedor' }}
        />
      </Card>

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={360}
        open={ncpFilterOpen}
        onClose={() => setNcpFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyFilters}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Proveedor</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="Nombre proveedor" size="small" value={ncpDraft.filterVendor ?? ''} onChange={e => setNcpDraft(d => ({ ...d, filterVendor: e.target.value || undefined }))} allowClear />
          <Input placeholder="NIT proveedor" size="small" value={ncpDraft.filterVendorTaxId ?? ''} onChange={e => setNcpDraft(d => ({ ...d, filterVendorTaxId: e.target.value || undefined }))} allowClear />
          <Input placeholder="# Nota de crédito" size="small" value={ncpDraft.filterInvoiceNumber ?? ''} onChange={e => setNcpDraft(d => ({ ...d, filterInvoiceNumber: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clasificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Select
            mode="multiple" size="small" placeholder="Estado"
            value={ncpDraft.filterStatus ?? []}
            onChange={v => setNcpDraft(d => ({ ...d, filterStatus: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(BILL_STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Moneda"
            value={ncpDraft.filterCurrency ?? []}
            onChange={v => setNcpDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]}
          />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Monto</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={ncpDraft.filterTotalMin ?? null} onChange={v => setNcpDraft(d => ({ ...d, filterTotalMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={ncpDraft.filterTotalMax ?? null} onChange={v => setNcpDraft(d => ({ ...d, filterTotalMax: v ?? null }))} min={0} prefix="Q" />
        </div>
      </Drawer>

      <style>{`.row-void td { opacity: 0.45; text-decoration: line-through; }`}</style>
    </div>
  )
}
