import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Tag, Space, Input, Select,
  Switch, Card, Row, Col, Statistic, Tooltip, message, Empty,
  Drawer, InputNumber, Divider, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, EyeOutlined, SearchOutlined,
  InboxOutlined, WarningOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getProducts, ITEM_TYPE_CONFIG, USAGE_TYPE_CONFIG,
  type Product,
} from '../../api/inventario'

const { Title, Text } = Typography
const { Option } = Select

const fmtQ = (v: number) =>
  'Q ' + Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface InvAdFilters {
  filterSku?: string
  filterStockMin?: number | null
  filterStockMax?: number | null
  filterCostMin?: number | null
  filterCostMax?: number | null
  filterPriceMin?: number | null
  filterPriceMax?: number | null
}

const INV_EMPTY: InvAdFilters = {}

function applyInvFilters(data: Product[], f: InvAdFilters): Product[] {
  return data.filter(r => {
    if (f.filterSku && !r.sku?.toLowerCase().includes(f.filterSku.toLowerCase())) return false
    if (f.filterStockMin != null && Number(r.stockOnHand ?? 0) < f.filterStockMin) return false
    if (f.filterStockMax != null && Number(r.stockOnHand ?? 0) > f.filterStockMax) return false
    if (f.filterCostMin != null && Number(r.averageCost ?? 0) < f.filterCostMin) return false
    if (f.filterCostMax != null && Number(r.averageCost ?? 0) > f.filterCostMax) return false
    if (f.filterPriceMin != null && Number(r.salesPrice ?? 0) < f.filterPriceMin) return false
    if (f.filterPriceMax != null && Number(r.salesPrice ?? 0) > f.filterPriceMax) return false
    return true
  })
}

export default function InventarioPage() {
  const navigate = useNavigate()

  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(false)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [limit]                   = useState(20)

  // Filters
  const [search, setSearch]       = useState('')
  const [itemType, setItemType]   = useState<string | undefined>()
  const [usageType, setUsageType] = useState<string | undefined>()
  const [lowStock, setLowStock]   = useState(false)

  // Filtros avanzados
  const [invFilters,    setInvFilters]    = useState<InvAdFilters>(INV_EMPTY)
  const [invDraft,      setInvDraft]      = useState<InvAdFilters>(INV_EMPTY)
  const [invFilterOpen, setInvFilterOpen] = useState(false)

  const invActiveCount = useMemo(() =>
    Object.entries(invFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [invFilters])

  const filteredProducts = useMemo(() => applyInvFilters(products, invFilters), [products, invFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getProducts({
        page,
        limit,
        search: search || undefined,
        itemType,
        usageType,
        lowStock: lowStock || undefined,
      })
      setProducts(Array.isArray(res?.data) ? res.data : [])
      setTotal(res?.total ?? 0)
    } catch {
      message.error('Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, itemType, usageType, lowStock])

  useEffect(() => { load() }, [load])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const activeProducts   = products.filter(p => p.isActive)
  const skuCount         = new Set(products.map(p => p.sku).filter(Boolean)).size
  const totalValue       = products.reduce((s, p) => s + (p.stockOnHand || 0) * (p.averageCost || 0), 0)
  const belowMinCount    = products.filter(p =>
    p.isInventoriable && p.minimumStock != null && p.stockOnHand < p.minimumStock
  ).length

  // ── Table columns ────────────────────────────────────────────────────────────
  const openInvFilters = () => { setInvDraft(invFilters); setInvFilterOpen(true) }
  const applyInvFiltersHandler = () => { setInvFilters(invDraft); setInvFilterOpen(false) }
  const clearInvFilters = () => { setInvDraft(INV_EMPTY); setInvFilters(INV_EMPTY) }

  const columns: ColumnsType<Product> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 120,
      sorter: (a, b) => (a.sku ?? '').localeCompare(b.sku ?? ''),
      render: (v: string) => (
        <Text
          copyable
          style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}
        >
          {v || '—'}
        </Text>
      ),
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
      render: (name: string, r: Product) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          {r.description && (
            <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
              {r.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'itemType',
      width: 100,
      sorter: (a, b) => (a.itemType ?? '').localeCompare(b.itemType ?? ''),
      render: (v: string) => {
        const cfg = ITEM_TYPE_CONFIG[v as keyof typeof ITEM_TYPE_CONFIG]
        return cfg ? (
          <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>
        ) : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Uso',
      dataIndex: 'usageType',
      width: 120,
      sorter: (a, b) => (a.usageType ?? '').localeCompare(b.usageType ?? ''),
      render: (v: string) => {
        const cfg = USAGE_TYPE_CONFIG[v as keyof typeof USAGE_TYPE_CONFIG]
        return cfg ? (
          <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>
        ) : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Stock',
      dataIndex: 'stockOnHand',
      width: 90,
      align: 'right',
      sorter: (a, b) => Number(a.stockOnHand ?? 0) - Number(b.stockOnHand ?? 0),
      render: (v: number, r: Product) => {
        if (!r.isInventoriable) {
          return <Text type="secondary" style={{ fontSize: 12 }}>N/A</Text>
        }
        const isBelowReorder = r.reorderPoint != null && v <= r.reorderPoint
        const isBelowMin     = r.minimumStock != null && v < r.minimumStock
        const color = isBelowMin ? '#e5484d' : isBelowReorder ? '#ff7f00' : '#2ea172'
        return (
          <Tooltip title={isBelowMin ? 'Bajo mínimo' : isBelowReorder ? 'Bajo punto de reorden' : 'Stock OK'}>
            <Text style={{ fontVariantNumeric: 'tabular-nums', color, fontWeight: 600 }}>
              {Number(v || 0).toLocaleString('es-GT')}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: 'Costo prom.',
      dataIndex: 'averageCost',
      width: 110,
      align: 'right',
      sorter: (a, b) => Number(a.averageCost ?? 0) - Number(b.averageCost ?? 0),
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Precio venta',
      dataIndex: 'salesPrice',
      width: 110,
      align: 'right',
      sorter: (a, b) => Number(a.salesPrice ?? 0) - Number(b.salesPrice ?? 0),
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Acciones',
      width: 100,
      render: (_: any, r: Product) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/inventario/${r.id}`)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/inventario/${r.id}/editar`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            Inventario de Artículos
          </Title>
          <Text type="secondary">Gestiona tus productos, servicios y materiales</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/inventario/nuevo')}
          style={{ background: '#1faec2' }}
        >
          Nuevo artículo
        </Button>
      </div>

      {/* ── KPI Strip ── */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Artículos activos"
              value={activeProducts.length}
              valueStyle={{ color: '#0a0a0a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Total SKUs"
              value={skuCount}
              valueStyle={{ color: '#1faec2', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Valor total inventario"
              value={totalValue}
              precision={2}
              prefix="Q"
              valueStyle={{ color: '#2ea172', fontWeight: 700, fontSize: 18 }}
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, borderColor: belowMinCount > 0 ? '#ff7f00' : undefined }}>
            <Statistic
              title="Artículos bajo mínimo"
              value={belowMinCount}
              prefix={belowMinCount > 0 ? <WarningOutlined style={{ color: '#ff7f00' }} /> : undefined}
              valueStyle={{ color: belowMinCount > 0 ? '#ff7f00' : '#2ea172', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Filter Bar ── */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Buscar por nombre, SKU..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Tipo de artículo"
              allowClear
              value={itemType}
              onChange={v => { setItemType(v); setPage(1) }}
            >
              <Option value="bien">Bien</Option>
              <Option value="servicio">Servicio</Option>
              <Option value="exento">Exento</Option>
              <Option value="importado">Importado</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Uso"
              allowClear
              value={usageType}
              onChange={v => { setUsageType(v); setPage(1) }}
            >
              <Option value="purchase">Solo compra</Option>
              <Option value="sale">Solo venta</Option>
              <Option value="both">Compra y venta</Option>
            </Select>
          </Col>
          <Col xs={24} sm={4} md={4}>
            <Space>
              <Switch
                size="small"
                checked={lowStock}
                onChange={v => { setLowStock(v); setPage(1) }}
              />
              <Text style={{ fontSize: 13 }}>Solo bajo mínimo</Text>
            </Space>
          </Col>
          <Col>
            <Badge count={invActiveCount} size="small">
              <Button
                icon={<FilterOutlined />}
                onClick={openInvFilters}
                style={invActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
              >
                Filtros
              </Button>
            </Badge>
          </Col>
        </Row>
      </Card>

      {/* ── Table ── */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredProducts}
          loading={loading}
          rowKey="id"
          size="small"
          showSorterTooltip={false}
          scroll={{ x: 900, y: 'calc(100vh - 312px)' }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            showTotal: t => `${t} artículos`,
            onChange: p => setPage(p),
          }}
          locale={{
            emptyText: (
              <Empty
                image={<InboxOutlined style={{ fontSize: 48, color: '#9aa1ab' }} />}
                description={
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>
                      Sin artículos registrados
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate('/inventario/nuevo')}
                      style={{ background: '#1faec2' }}
                    >
                      Crear primer artículo
                    </Button>
                  </div>
                }
              />
            ),
          }}
        />
      </Card>
      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={340}
        open={invFilterOpen}
        onClose={() => setInvFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearInvFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyInvFiltersHandler}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Identificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="SKU" size="small" value={invDraft.filterSku ?? ''} onChange={e => setInvDraft(d => ({ ...d, filterSku: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Stock</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, marginBottom: 16 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={invDraft.filterStockMin ?? null} onChange={v => setInvDraft(d => ({ ...d, filterStockMin: v ?? null }))} min={0} />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={invDraft.filterStockMax ?? null} onChange={v => setInvDraft(d => ({ ...d, filterStockMax: v ?? null }))} min={0} />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Costo promedio</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, marginBottom: 16 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={invDraft.filterCostMin ?? null} onChange={v => setInvDraft(d => ({ ...d, filterCostMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={invDraft.filterCostMax ?? null} onChange={v => setInvDraft(d => ({ ...d, filterCostMax: v ?? null }))} min={0} prefix="Q" />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Precio de venta</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={invDraft.filterPriceMin ?? null} onChange={v => setInvDraft(d => ({ ...d, filterPriceMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={invDraft.filterPriceMax ?? null} onChange={v => setInvDraft(d => ({ ...d, filterPriceMax: v ?? null }))} min={0} prefix="Q" />
        </div>
      </Drawer>
    </div>
  )
}
