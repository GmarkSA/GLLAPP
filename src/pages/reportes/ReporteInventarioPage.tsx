import { useState, useEffect, useCallback } from 'react'
import {
  Typography, Table, Tag, Input, Select, Button, DatePicker,
  Statistic, Card, Tabs, Spin, Empty, Space, message,
} from 'antd'
import {
  SearchOutlined, DownloadOutlined, WarningOutlined,
  ArrowLeftOutlined, FileExcelOutlined,
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { getProducts, getKardex, type Product, type KardexMovimiento } from '../../api/inventario'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ─── Helpers ────────────────────────────────────────────────────────────────

const Q = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  entrada:       { label: 'Entrada',        color: '#2ea172' },
  salida:        { label: 'Salida',         color: '#e5484d' },
  apertura:      { label: 'Apertura',       color: '#1B3A6B' },
  conteo_fisico: { label: 'Conteo físico',  color: '#7c3aed' },
  merma:         { label: 'Merma',          color: '#f59e0b' },
  devolucion:    { label: 'Devolución',     color: '#1faec2' },
  ajuste:        { label: 'Ajuste',         color: '#6b7280' },
}

// ─── Tab 1: Valorización ─────────────────────────────────────────────────────

function ValorizacionTab() {
  const [all,      setAll]      = useState<Product[]>([])
  const [search,   setSearch]   = useState('')
  const [categoria, setCategoria] = useState<string | undefined>()
  const [soloLow,  setSoloLow]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getProducts({ limit: 999 })
      .then((r: any) => setAll((r.data ?? r) as Product[]))
      .catch(() => message.error('Error cargando artículos'))
      .finally(() => setLoading(false))
  }, [])

  const categorias = [...new Set(all.map(p => p.category).filter(Boolean))]

  const data = all
    .filter(p => p.isInventoriable)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    .filter(p => !categoria || p.category === categoria)
    .filter(p => !soloLow  || (p.reorderPoint != null && Number(p.stockOnHand) <= Number(p.reorderPoint)))

  const totalValor  = data.reduce((s, p) => s + Number(p.stockOnHand) * Number(p.averageCost), 0)
  const totalItems  = data.length
  const lowCount    = data.filter(p => p.reorderPoint != null && Number(p.stockOnHand) <= Number(p.reorderPoint)).length
  const zeroCount   = data.filter(p => Number(p.stockOnHand) <= 0).length

  const cols: ColumnType<Product>[] = [
    { title: 'SKU',       dataIndex: 'sku',         width: 110, fixed: 'left' as const },
    { title: 'Nombre',    dataIndex: 'name',         ellipsis: true },
    { title: 'Categoría', dataIndex: 'category',     width: 120, render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Unidad',    dataIndex: 'unit',         width: 80,  render: (v: string) => v || '—' },
    {
      title: 'Stock Actual', dataIndex: 'stockOnHand', width: 110, align: 'right' as const,
      render: (v: number, r: Product) => {
        const low = r.reorderPoint != null && Number(v) <= Number(r.reorderPoint)
        return <span style={{ color: low ? '#e5484d' : undefined, fontWeight: low ? 600 : undefined }}>
          {Number(v).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
          {low && <WarningOutlined style={{ marginLeft: 4, color: '#e5484d' }} />}
        </span>
      },
      sorter: (a, b) => Number(a.stockOnHand) - Number(b.stockOnHand),
    },
    {
      title: 'P. Reorden', dataIndex: 'reorderPoint', width: 100, align: 'right' as const,
      render: (v?: number) => v != null ? Number(v).toLocaleString('es-GT') : '—',
    },
    {
      title: 'Costo Prom.', dataIndex: 'averageCost', width: 115, align: 'right' as const,
      render: (v: number) => Q(v),
      sorter: (a, b) => Number(a.averageCost) - Number(b.averageCost),
    },
    {
      title: 'Costo Último', dataIndex: 'lastCost', width: 115, align: 'right' as const,
      render: (v: number) => Q(v ?? 0),
    },
    {
      title: 'Valor Total', width: 130, align: 'right' as const, fixed: 'right' as const,
      render: (_: any, r: Product) => {
        const v = Number(r.stockOnHand) * Number(r.averageCost)
        return <span style={{ fontWeight: 600, color: '#1B3A6B' }}>{Q(v)}</span>
      },
      sorter: (a, b) => Number(a.stockOnHand) * Number(a.averageCost) - Number(b.stockOnHand) * Number(b.averageCost),
    },
  ]

  const handleExport = () => {
    const headers = ['SKU', 'Nombre', 'Categoría', 'Unidad', 'Stock Actual', 'P. Reorden', 'Costo Prom.', 'Costo Último', 'Valor Total']
    const rows = data.map(p => [
      p.sku, `"${p.name}"`, p.category ?? '', p.unit ?? '',
      String(p.stockOnHand), String(p.reorderPoint ?? ''),
      String(p.averageCost), String(p.lastCost ?? 0),
      String((Number(p.stockOnHand) * Number(p.averageCost)).toFixed(2)),
    ])
    exportCsv('valoracion_inventario.csv', headers, rows)
  }

  return (
    <Spin spinning={loading}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <Card size="small" style={{ borderTop: '3px solid #1B3A6B' }}>
          <Statistic title="Valor Total Inventario" value={totalValor} precision={2} prefix="Q" valueStyle={{ color: '#1B3A6B', fontSize: 20 }} />
        </Card>
        <Card size="small" style={{ borderTop: '3px solid #1faec2' }}>
          <Statistic title="Artículos Activos" value={totalItems} valueStyle={{ color: '#1faec2', fontSize: 20 }} />
        </Card>
        <Card size="small" style={{ borderTop: '3px solid #f59e0b' }}>
          <Statistic title="Bajo Punto de Reorden" value={lowCount}
            valueStyle={{ color: lowCount > 0 ? '#f59e0b' : '#2ea172', fontSize: 20 }} />
        </Card>
        <Card size="small" style={{ borderTop: '3px solid #e5484d' }}>
          <Statistic title="Sin Stock" value={zeroCount}
            valueStyle={{ color: zeroCount > 0 ? '#e5484d' : '#2ea172', fontSize: 20 }} />
        </Card>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined />} placeholder="Buscar SKU o nombre…"
          style={{ width: 240 }} value={search}
          onChange={e => setSearch(e.target.value)} allowClear
        />
        <Select
          placeholder="Categoría" allowClear style={{ width: 160 }}
          value={categoria} onChange={setCategoria}
          options={categorias.map(c => ({ value: c, label: c }))}
        />
        <Button
          type={soloLow ? 'primary' : 'default'}
          danger={soloLow}
          icon={<WarningOutlined />}
          onClick={() => setSoloLow(v => !v)}
        >
          Solo bajo mínimo
        </Button>
        <div style={{ marginLeft: 'auto' }}>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Exportar CSV</Button>
        </div>
      </div>

      <Table
        dataSource={data}
        columns={cols}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true }}
        scroll={{ x: 1000 }}
        summary={() => (
          <Table.Summary.Row style={{ background: '#f5f8ff' }}>
            <Table.Summary.Cell index={0} colSpan={8}>
              <Text strong>{data.length} artículos</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right">
              <Text strong style={{ color: '#1B3A6B' }}>{Q(totalValor)}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Spin>
  )
}

// ─── Tab 2: Kardex ───────────────────────────────────────────────────────────

function KardexTab() {
  const [products,    setProducts]    = useState<Product[]>([])
  const [productId,   setProductId]   = useState<string | undefined>()
  const [rango,       setRango]       = useState<[Dayjs, Dayjs] | null>(null)
  const [movimientos, setMovimientos] = useState<KardexMovimiento[]>([])
  const [product,     setProduct]     = useState<Product | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [prodLoading, setProdLoading] = useState(false)

  const loadProducts = useCallback(async () => {
    if (products.length) return
    setProdLoading(true)
    try {
      const r: any = await getProducts({ limit: 999 })
      setProducts(((r.data ?? r) as Product[]).filter(p => p.isInventoriable))
    } finally { setProdLoading(false) }
  }, [products.length])

  const buscar = async () => {
    if (!productId) { message.warning('Selecciona un artículo'); return }
    setLoading(true)
    try {
      const result = await getKardex(productId, {
        desde: rango?.[0].format('YYYY-MM-DD'),
        hasta: rango?.[1].format('YYYY-MM-DD'),
      })
      setProduct(result.product)
      setMovimientos(result.movimientos)
    } catch {
      message.error('Error cargando kardex')
    } finally { setLoading(false) }
  }

  const totalEntradas  = movimientos.filter(m => Number(m.quantity) > 0).reduce((s, m) => s + Number(m.quantity), 0)
  const totalSalidas   = movimientos.filter(m => Number(m.quantity) < 0).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0)

  const cols: ColumnType<KardexMovimiento>[] = [
    { title: 'Fecha',      dataIndex: 'date',      width: 105,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Documento',  dataIndex: 'documento', width: 130 },
    { title: 'Tipo',       dataIndex: 'tipo',      width: 120,
      render: (v: string) => {
        const cfg = TIPO_LABEL[v] ?? { label: v, color: '#6b7280' }
        return <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>
      } },
    { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true },
    { title: 'Entrada', width: 100, align: 'right' as const,
      render: (_: any, r: KardexMovimiento) => Number(r.quantity) > 0
        ? <span style={{ color: '#2ea172', fontWeight: 600 }}>
            +{Number(r.quantity).toLocaleString('es-GT', { maximumFractionDigits: 4 })}
          </span>
        : '—' },
    { title: 'Salida', width: 100, align: 'right' as const,
      render: (_: any, r: KardexMovimiento) => Number(r.quantity) < 0
        ? <span style={{ color: '#e5484d', fontWeight: 600 }}>
            {Number(r.quantity).toLocaleString('es-GT', { maximumFractionDigits: 4 })}
          </span>
        : '—' },
    { title: 'Saldo', dataIndex: 'newStock', width: 100, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>
        {Number(v).toLocaleString('es-GT', { maximumFractionDigits: 4 })}
      </span> },
    { title: 'Costo Unit.', dataIndex: 'unitCost', width: 105, align: 'right' as const,
      render: (v: number) => v ? Q(v) : '—' },
    { title: 'Valor Mov.', dataIndex: 'totalCost', width: 115, align: 'right' as const,
      render: (v: number) => v ? Q(v) : '—' },
  ]

  const handleExport = () => {
    if (!movimientos.length) return
    const headers = ['Fecha','Documento','Tipo','Descripción','Entrada','Salida','Saldo','Costo Unit.','Valor Mov.']
    const rows = movimientos.map(m => [
      dayjs(m.date).format('DD/MM/YYYY'),
      m.documento, m.tipo, `"${m.descripcion}"`,
      Number(m.quantity) > 0 ? String(m.quantity) : '',
      Number(m.quantity) < 0 ? String(Math.abs(Number(m.quantity))) : '',
      String(m.newStock), String(m.unitCost), String(m.totalCost),
    ])
    exportCsv(`kardex_${product?.sku ?? 'inventario'}.csv`, headers, rows)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Artículo</Text>
          <Select
            showSearch optionFilterProp="label"
            placeholder="Selecciona artículo…"
            style={{ width: 320 }}
            loading={prodLoading}
            value={productId}
            onChange={setProductId}
            onFocus={loadProducts}
            options={products.map(p => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Período</Text>
          <RangePicker
            format="DD/MM/YYYY"
            value={rango}
            onChange={v => setRango(v as [Dayjs, Dayjs] | null)}
            allowEmpty={[true, true]}
          />
        </div>
        <Button type="primary" style={{ background: '#1B3A6B' }} onClick={buscar} loading={loading}>
          Consultar
        </Button>
        {movimientos.length > 0 && (
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Exportar CSV</Button>
        )}
      </div>

      {product && movimientos.length > 0 && (
        <div style={{
          padding: '10px 16px', marginBottom: 14, borderRadius: 8,
          background: '#f5f8ff', border: '1px solid #dbe4f0',
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Artículo</Text>
            <div style={{ fontWeight: 600 }}>{product.sku} — {product.name}</div></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Stock actual</Text>
            <div style={{ fontWeight: 600, color: '#1B3A6B' }}>
              {Number(product.stockOnHand).toLocaleString('es-GT', { maximumFractionDigits: 4 })} {product.unit}
            </div></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Total entradas</Text>
            <div style={{ fontWeight: 600, color: '#2ea172' }}>
              +{totalEntradas.toLocaleString('es-GT', { maximumFractionDigits: 4 })}
            </div></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Total salidas</Text>
            <div style={{ fontWeight: 600, color: '#e5484d' }}>
              -{totalSalidas.toLocaleString('es-GT', { maximumFractionDigits: 4 })}
            </div></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Movimientos</Text>
            <div style={{ fontWeight: 600 }}>{movimientos.length}</div></div>
        </div>
      )}

      <Spin spinning={loading}>
        {movimientos.length > 0 ? (
          <Table
            dataSource={movimientos}
            columns={cols}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary.Row style={{ background: '#f5f8ff' }}>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <Text strong>{movimientos.length} movimientos</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#2ea172' }}>
                    +{totalEntradas.toLocaleString('es-GT', { maximumFractionDigits: 4 })}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#e5484d' }}>
                    -{totalSalidas.toLocaleString('es-GT', { maximumFractionDigits: 4 })}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={3} />
              </Table.Summary.Row>
            )}
          />
        ) : !loading && productId ? (
          <Empty description="Sin movimientos en el período seleccionado" />
        ) : !loading ? (
          <Empty description="Selecciona un artículo y haz clic en Consultar" />
        ) : null}
      </Spin>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReporteInventarioPage() {
  const navigate = useNavigate()

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />} size="small"
          onClick={() => navigate('/reportes')}
        >
          Reportes
        </Button>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Reporte de Inventario</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Valorización por costo promedio ponderado y kardex de movimientos
          </Text>
        </div>
      </div>

      <Tabs
        defaultActiveKey="valoracion"
        items={[
          {
            key:      'valoracion',
            label:    <span><FileExcelOutlined /> Valorización</span>,
            children: <ValorizacionTab />,
          },
          {
            key:      'kardex',
            label:    <span><SearchOutlined /> Kardex</span>,
            children: <KardexTab />,
          },
        ]}
      />
    </div>
  )
}
