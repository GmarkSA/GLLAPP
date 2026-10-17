import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Tag, Space, Input, Select,
  Switch, Card, Row, Col, Statistic, Tooltip, message, Empty,
  Drawer, InputNumber, Divider, Badge, Dropdown, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, EyeOutlined, SearchOutlined,
  InboxOutlined, WarningOutlined, FilterOutlined, PrinterOutlined,
  DownloadOutlined, SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import EtiquetasModal from './EtiquetasModal'
import { exportarArticulos } from '../configuracion/plantillaInventario'
import { getAccounts } from '../../api/catalogo'
import { getTaxes } from '../../api/impuestos'
import { getGrupos } from '../../api/expedientes'
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

/**
 * Las columnas que se ven al entrar. El resto está disponible en el selector:
 * el inventario tiene los campos de las tres pestañas del artículo y mostrarlos
 * todos de golpe vuelve la tabla ilegible.
 */
const COLUMNAS_POR_OMISION = [
  'SKU', 'Nombre', 'Tipo', 'Uso', 'Stock', 'Costo prom.', 'Precio venta',
]

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
  const [etiquetasOpen, setEtiquetasOpen] = useState(false)
  // Artículos marcados para etiquetar. Vacío = todos los del listado.
  const [etiquetasSeleccion, setEtiquetasSeleccion] = useState<string[]>([])

  // Qué columnas ve el usuario. Se recuerda por navegador: con 26 campos
  // posibles, volver a elegirlas en cada visita es un trabajo repetido.
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>(() => {
    try {
      const guardado = localStorage.getItem('inventario.columnas')
      if (guardado) return JSON.parse(guardado) as string[]
    } catch { /* sin almacenamiento: se usan las de siempre */ }
    return COLUMNAS_POR_OMISION
  })

  useEffect(() => {
    try { localStorage.setItem('inventario.columnas', JSON.stringify(columnasVisibles)) }
    catch { /* no poder recordarlas no debe romper la pantalla */ }
  }, [columnasVisibles])

  // El artículo guarda sus cuentas por id; la tabla tiene que mostrar el código.
  const [cuentasPorId, setCuentasPorId] = useState<Map<string, string>>(new Map())
  const [cuentasCrudas, setCuentasCrudas] = useState<any[]>([])

  const [impuestosPorId, setImpuestosPorId] = useState<Map<string, string>>(new Map())
  const [gruposPorId,    setGruposPorId]    = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const etiqueta = (c: any) => `${c.code ?? ''} — ${c.name ?? ''}`.replace(/^ — | — $/, '').trim()
    Promise.all([
      getAccounts().catch(() => []),
      getTaxes().catch(() => []),
      getGrupos().catch(() => []),
    ]).then(([cuentas, impuestos, grupos]) => {
      const lista = Array.isArray(cuentas) ? cuentas : []
      setCuentasCrudas(lista)
      setCuentasPorId(new Map(lista.filter((c: any) => c?.id && c?.code)
        .map((c: any) => [String(c.id), etiqueta(c)])))
      setImpuestosPorId(new Map((Array.isArray(impuestos) ? impuestos : [])
        .filter((t: any) => t?.id).map((t: any) => [String(t.id), etiqueta(t)])))
      setGruposPorId(new Map((Array.isArray(grupos) ? grupos : [])
        .filter((g: any) => g?.id).map((g: any) => [String(g.id), etiqueta(g)])))
    }).catch(() => { /* sin catálogo la tabla muestra «—», no se rompe */ })
  }, [])

  const cuenta = (id?: string) => (id ? cuentasPorId.get(id) ?? '—' : '—')

  /** Una columna de texto corto, de las que vienen ocultas por omisión. */
  const columnaTexto = (
    title: string, leer: (r: Product) => string, width = 140,
  ): ColumnsType<Product>[number] => ({
    title, width, ellipsis: true,
    render: (_: any, r: Product) => {
      const v = leer(r)
      return <Text style={{ fontSize: 11 }}>{v || '—'}</Text>
    },
  })

  /** Una columna numérica, alineada a la derecha. */
  const columnaNumero = (
    title: string, leer: (r: Product) => number | undefined,
    { moneda = false, width = 110 }: { moneda?: boolean; width?: number } = {},
  ): ColumnsType<Product>[number] => ({
    title, width, align: 'right',
    sorter: (a, b) => Number(leer(a) ?? 0) - Number(leer(b) ?? 0),
    render: (_: any, r: Product) => {
      const v = leer(r)
      return <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {v == null ? '—' : moneda ? fmtQ(v) : Number(v).toLocaleString('es-GT')}
      </Text>
    },
  })

  const descargarArticulos = async () => {
    try {
      const [todos, cuentas, impuestos, grupos] = await Promise.all([
        getProducts({ limit: 500 }).then((r: any) => r?.data ?? r),
        cuentasCrudas.length > 0 ? Promise.resolve(cuentasCrudas) : getAccounts().catch(() => []),
        getTaxes().catch(() => []),
        getGrupos().catch(() => []),
      ])
      const datos = exportarArticulos(Array.isArray(todos) ? todos : [], {
        cuentas: (Array.isArray(cuentas) ? cuentas : [])
          .filter((c: any) => c?.code)
          .map((c: any) => ({ id: String(c.id ?? ''), code: String(c.code), name: String(c.name ?? '') })),
        impuestos: (Array.isArray(impuestos) ? impuestos : [])
          .filter((t: any) => t?.code).map((t: any) => ({ code: String(t.code), name: String(t.name ?? ''), rate: Number(t.rate) || 0 })),
        grupos: (Array.isArray(grupos) ? grupos : [])
          .map((g: any) => ({ code: String(g.code ?? ''), name: String(g.name ?? '') })),
        unidades:  ['UND', 'CAJA', 'BOLSA', 'PAQUETE', 'YARDA', 'RESMA', 'ROLLO', 'SET', 'KG', 'LT', 'MT'],
        almacenes: [],
      })
      const url = URL.createObjectURL(new Blob([datos], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'Articulos de inventario.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('No se pudo generar el archivo de artículos')
    }
  }

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
      title: 'Unidad', dataIndex: 'unit', width: 90,
      sorter: (a, b) => (a.unit ?? '').localeCompare(b.unit ?? ''),
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Categoría', dataIndex: 'category', width: 140, ellipsis: true,
      sorter: (a, b) => (a.category ?? '').localeCompare(b.category ?? ''),
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Marca', dataIndex: 'brand', width: 120, ellipsis: true,
      sorter: (a, b) => (a.brand ?? '').localeCompare(b.brand ?? ''),
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Código de barras', dataIndex: 'barCodes', width: 150,
      render: (v: string[] | undefined, r: Product) => {
        const codigos = (v ?? []).map(c => String(c ?? '').trim()).filter(Boolean)
        if (codigos.length === 0) {
          return <Tooltip title="Sin código: no se puede escanear en el POS">
            <Tag color="warning" style={{ fontSize: 11 }}>Sin código</Tag>
          </Tooltip>
        }
        const propio = codigos[0].toUpperCase() !== String(r.sku ?? '').toUpperCase()
        return (
          <Tooltip title={propio ? 'Código del fabricante' : 'Código interno de Lucía'}>
            <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {codigos[0]}{codigos.length > 1 && ` +${codigos.length - 1}`}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: 'Precio compra', dataIndex: 'purchasePrice', width: 115, align: 'right',
      sorter: (a, b) => Number(a.purchasePrice ?? 0) - Number(b.purchasePrice ?? 0),
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Cuenta de ingresos', width: 190, ellipsis: true,
      render: (_: any, r: Product) => {
        const texto = cuenta(r.salesAccountId)
        return texto === '—'
          ? <Tooltip title="Sin cuenta de ingresos: la factura no se podrá contabilizar">
              <Tag color="error" style={{ fontSize: 11 }}>Sin cuenta</Tag>
            </Tooltip>
          : <Text style={{ fontSize: 11 }}>{texto}</Text>
      },
    },
    {
      title: 'Cuenta de inventario', width: 190, ellipsis: true,
      render: (_: any, r: Product) => {
        if (!r.isInventoriable) return <Text type="secondary" style={{ fontSize: 11 }}>N/A</Text>
        const texto = cuenta(r.inventoryAccountId)
        // Sin ella la venta NO falla: omite la línea de costo en silencio y el
        // inventario nunca se descarga en la contabilidad.
        return texto === '—'
          ? <Tooltip title="Sin cuenta de inventario: al vender no se descarga el inventario en la contabilidad">
              <Tag color="error" style={{ fontSize: 11 }}>Sin cuenta</Tag>
            </Tooltip>
          : <Text style={{ fontSize: 11 }}>{texto}</Text>
      },
    },
    columnaTexto('Descripción',  r => r.description ?? '', 200),
    columnaTexto('Categoría inv.', r => r.itemCategory ?? ''),
    columnaTexto('Trazabilidad',  r => ({ none: 'Ninguno', lot: 'Lote', serial: 'Serie' } as any)[r.trackingType] ?? ''),
    columnaTexto('Grupo',         r => (r.groupId ? gruposPorId.get(r.groupId) ?? '' : ''), 170),
    columnaTexto('Impuesto ventas',  r => (r.salesTaxId ? impuestosPorId.get(r.salesTaxId) ?? '' : ''), 190),
    columnaTexto('Impuesto compras', r => (r.purchaseTaxId ? impuestosPorId.get(r.purchaseTaxId) ?? '' : ''), 190),
    columnaTexto('Cuenta de costo',   r => cuenta(r.costAccountId), 190),
    columnaTexto('Cuenta de compras', r => cuenta(r.purchaseAccountId), 190),
    columnaTexto('Cuenta de ajustes', r => cuenta(r.adjustmentAccountId), 190),
    columnaTexto('Moneda',  r => r.currency ?? ''),
    columnaTexto('Se produce', r => (r.isProduced ? 'Sí' : 'No'), 100),
    columnaNumero('Último costo', r => r.lastCost, { moneda: true }),
    columnaNumero('Stock mínimo', r => r.minimumStock),
    columnaNumero('Stock máximo', r => r.maximumStock),
    columnaNumero('Cant. de reorden', r => r.reorderQuantity, { width: 125 }),
    columnaNumero('Peso (lb)', r => r.weight),
    {
      title: 'Punto reorden', dataIndex: 'reorderPoint', width: 110, align: 'right',
      sorter: (a, b) => Number(a.reorderPoint ?? 0) - Number(b.reorderPoint ?? 0),
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {v == null ? '—' : Number(v).toLocaleString('es-GT')}</Text>,
    },
    {
      title: 'Valor en existencia', width: 140, align: 'right',
      sorter: (a, b) => (Number(a.stockOnHand ?? 0) * Number(a.averageCost ?? 0))
                      - (Number(b.stockOnHand ?? 0) * Number(b.averageCost ?? 0)),
      render: (_: any, r: Product) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {fmtQ(Number(r.stockOnHand ?? 0) * Number(r.averageCost ?? 0))}</Text>,
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

  // «Acciones» no se puede ocultar: sin ella la fila queda sin forma de abrirse.
  const columnasOpcionales = columns
    .map(c => String((c as any).title ?? ''))
    .filter(t => t && t !== 'Acciones')

  const columnasMostradas = columns.filter(c => {
    const t = String((c as any).title ?? '')
    return t === 'Acciones' || columnasVisibles.includes(t)
  })

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
        <Space>
          <Dropdown
            trigger={['click']}
            menu={{
              items: columnasOpcionales.map(t => ({
                key: t,
                label: (
                  <Checkbox
                    checked={columnasVisibles.includes(t)}
                    onChange={e => setColumnasVisibles(v =>
                      e.target.checked ? [...v, t] : v.filter(x => x !== t))}
                  >{t}</Checkbox>
                ),
              })),
            }}
          >
            <Button icon={<SettingOutlined />}>Columnas</Button>
          </Dropdown>
          <Button icon={<DownloadOutlined />} onClick={descargarArticulos}>
            Descargar artículos
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => setEtiquetasOpen(true)}>
            Imprimir etiquetas
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventario/nuevo')}
            style={{ background: '#1faec2' }}
          >
            Nuevo artículo
          </Button>
        </Space>
      </div>

      <EtiquetasModal
        open={etiquetasOpen}
        seleccionados={etiquetasSeleccion}
        onClose={() => setEtiquetasOpen(false)}
      />

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
          columns={columnasMostradas}
          rowSelection={{
            selectedRowKeys: etiquetasSeleccion,
            onChange: keys => setEtiquetasSeleccion(keys as string[]),
            preserveSelectedRowKeys: true,
          }}
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
