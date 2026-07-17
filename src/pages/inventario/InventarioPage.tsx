import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Tag, Space, Input, Select,
  Switch, Card, Row, Col, Statistic, Tooltip, message, Empty,
} from 'antd'
import {
  PlusOutlined, EditOutlined, EyeOutlined, SearchOutlined,
  InboxOutlined, WarningOutlined,
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
  const columns: ColumnsType<Product> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 120,
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
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Precio venta',
      dataIndex: 'salesPrice',
      width: 110,
      align: 'right',
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
        </Row>
      </Card>

      {/* ── Table ── */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={products}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
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
    </div>
  )
}
