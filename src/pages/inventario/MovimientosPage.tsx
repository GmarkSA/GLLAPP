import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Input, Card, message, Tag,
  Modal, Form, Select, DatePicker, InputNumber, Popconfirm,
  Divider, Row, Col, Alert, Badge, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, SwapOutlined,
  CheckCircleOutlined, DeleteOutlined, MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getMovimientos, createMovimiento, confirmarMovimiento, deleteMovimiento,
  addMovimientoLinea, getMovimiento,
  getUbicaciones, getAlmacenes,
  type Movimiento, type MovimientoLinea, type Ubicacion, type Almacen,
  TIPO_MOVIMIENTO_CONFIG, type TipoMovimiento,
} from '../../api/expedientes'
import { getProducts, type Product } from '../../api/inventario'
import AccountSelect from '../../components/AccountSelect'

const { Title, Text } = Typography

// ─── Tipo selector (visual cards) ─────────────────────────────────────────────
function TipoCard({ tipo, selected, onClick }: { tipo: TipoMovimiento; selected: boolean; onClick: () => void }) {
  const cfg = TIPO_MOVIMIENTO_CONFIG[tipo]
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
        border: `2px solid ${selected ? cfg.color : 'rgba(10,10,10,0.08)'}`,
        background: selected ? `${cfg.color}18` : '#fafbfc',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 20 }}>{cfg.icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: selected ? cfg.color : '#666', marginTop: 3, lineHeight: 1.3 }}>
        {cfg.label}
      </div>
    </div>
  )
}

// ─── Pending line (local state before saving) ─────────────────────────────────
interface PendingLine {
  _key: number
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitCost: number
  totalCost: number
  lote?: string
}

// ─── Create / Edit modal ───────────────────────────────────────────────────────
function MovimientoFormModal({ open, ubicaciones, onClose, onSaved }: {
  open: boolean
  ubicaciones: Ubicacion[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form]         = Form.useForm()
  const [lineForm]     = Form.useForm()
  const [tipo, setTipo]           = useState<TipoMovimiento | undefined>()
  const [saving, setSaving]       = useState(false)
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [lineKey, setLineKey]     = useState(0)
  const [prodInit, setProdInit]   = useState(false)

  useEffect(() => {
    if (!open) { setTipo(undefined); setPendingLines([]); form.resetFields(); lineForm.resetFields(); setProdInit(false) }
  }, [open, form, lineForm])

  const cfg = tipo ? TIPO_MOVIMIENTO_CONFIG[tipo] : null

  const loadInitialProducts = async () => {
    if (prodInit) return
    setSearching(true)
    try {
      const res = await getProducts({ limit: 40 })
      setProducts((res as any).data ?? [])
      setProdInit(true)
    } finally { setSearching(false) }
  }

  const searchProducts = async (q: string) => {
    setSearching(true)
    try {
      const res = await getProducts({ search: q || undefined, limit: 40 })
      setProducts((res as any).data ?? [])
    } finally { setSearching(false) }
  }

  const handleAddLine = async () => {
    try {
      const v = await lineForm.validateFields()
      const product = products.find(p => p.id === v.productId)
      const qty = Number(v.quantity)
      const cost = Number(v.unitCost || 0)
      setPendingLines(prev => [...prev, {
        _key: lineKey,
        productId: v.productId,
        productName: product?.name || v.productId,
        productSku: product?.sku || '',
        quantity: qty,
        unitCost: cost,
        totalCost: Math.abs(qty) * cost,
        lote: v.lote,
      }])
      setLineKey(k => k + 1)
      lineForm.resetFields()
    } catch { /* validation error shown by antd */ }
  }

  const handleSave = async (autoConfirm = false) => {
    if (!tipo) { message.error('Selecciona el tipo de movimiento'); return }
    if (pendingLines.length === 0) { message.error('Agrega al menos un artículo'); return }
    const values = await form.validateFields()
    setSaving(true)
    try {
      // 1. Create movement header
      const mov = await createMovimiento({
        tipoMovimiento: tipo,
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        ubicacionOrigenId: values.ubicacionOrigenId,
        ubicacionDestinoId: values.ubicacionDestinoId,
        reason: values.reason,
        notes: values.notes,
        adjustmentAccountId: values.adjustmentAccountId,
      })
      // 2. Add lines
      for (const line of pendingLines) {
        await addMovimientoLinea(mov.id, {
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          lote: line.lote,
        })
      }
      // 3. Auto-confirm if requested
      if (autoConfirm) {
        await confirmarMovimiento(mov.id)
        message.success('Movimiento confirmado — stock actualizado')
      } else {
        message.success('Movimiento guardado en borrador')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar movimiento')
    } finally { setSaving(false) }
  }

  const isAjuste = tipo === 'ajuste'

  const lineCols: ColumnsType<PendingLine> = [
    {
      title: 'Artículo', render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.productName}</div>
          {r.productSku && <div style={{ fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{r.productSku}</div>}
        </div>
      ),
    },
    {
      title: 'Cantidad', dataIndex: 'quantity', width: 90, align: 'right',
      render: v => {
        const n = Number(v)
        const color = n > 0 ? '#2ea172' : n < 0 ? '#e5484d' : '#6b7280'
        return <span style={{ color, fontWeight: 600 }}>{n > 0 && isAjuste ? '+' : ''}{n}</span>
      },
    },
    {
      title: 'Costo u.', dataIndex: 'unitCost', width: 100, align: 'right',
      render: v => `Q ${Number(v).toFixed(2)}`,
    },
    {
      title: 'Total', dataIndex: 'totalCost', width: 100, align: 'right',
      render: v => <strong>Q {Number(v).toFixed(2)}</strong>,
    },
    {
      title: '', width: 44, render: (_, r) => (
        <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
          onClick={() => setPendingLines(p => p.filter(l => l._key !== r._key))} />
      ),
    },
  ]

  return (
    <Modal
      title={<Space><SwapOutlined /> Nuevo movimiento de inventario</Space>}
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnClose
      footer={
        tipo ? (
          <Space>
            <Button onClick={onClose}>Cancelar</Button>
            <Button onClick={() => handleSave(false)} loading={saving}
              disabled={pendingLines.length === 0}>
              Guardar borrador
            </Button>
            <Button type="primary" icon={<CheckCircleOutlined />}
              onClick={() => handleSave(true)} loading={saving}
              disabled={pendingLines.length === 0}
              style={{ background: '#1faec2' }}>
              Guardar y confirmar
            </Button>
          </Space>
        ) : null
      }
    >
      {/* ── Paso 1: Tipo ── */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ color: '#1faec2', display: 'block', marginBottom: 10 }}>
          1. Selecciona el tipo de movimiento
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 6 }}>
          {(['entrada_compra', 'entrada_produccion', 'entrada_devolucion', 'salida_venta'] as TipoMovimiento[]).map(t => (
            <TipoCard key={t} tipo={t} selected={tipo === t} onClick={() => setTipo(t)} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {(['salida_produccion', 'salida_baja', 'traslado', 'ajuste'] as TipoMovimiento[]).map(t => (
            <TipoCard key={t} tipo={t} selected={tipo === t} onClick={() => setTipo(t)} />
          ))}
        </div>
      </div>

      {tipo && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12, padding: '6px 12px' }}
            message={
              cfg?.flow === 'traslado' ? 'Traslado: mueve stock entre ubicaciones sin alterar el total global.'
              : cfg?.flow === 'entrada' ? 'Entrada: incrementa el stock en la ubicación destino.'
              : cfg?.flow === 'salida'  ? 'Salida: reduce el stock en la ubicación origen.'
              : 'Ajuste: usa cantidad positiva (+) para incrementar o negativa (−) para reducir.'
            }
          />

          <Divider style={{ margin: '10px 0' }} />

          {/* ── Paso 2: Header ── */}
          <Text strong style={{ color: '#1faec2', display: 'block', marginBottom: 10 }}>
            2. Datos del movimiento
          </Text>
          <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="reason" label="Referencia / Motivo">
                  <Input placeholder="Ej: OC-2026-001, Devolución cliente #123..." />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              {cfg?.needsOrigen && (
                <Col span={12}>
                  <Form.Item name="ubicacionOrigenId" label="Ubicación origen" rules={[{ required: true }]}>
                    <Select placeholder="¿De dónde sale?" options={ubicaciones.map(u => ({
                      value: u.id, label: `${u.type === 'pos' ? '🛒' : '🏭'} ${u.name} (${u.code})`,
                    }))} />
                  </Form.Item>
                </Col>
              )}
              {cfg?.needsDestino && (
                <Col span={12}>
                  <Form.Item name="ubicacionDestinoId" label="Ubicación destino" rules={[{ required: true }]}>
                    <Select placeholder="¿A dónde entra?" options={ubicaciones.map(u => ({
                      value: u.id, label: `${u.type === 'pos' ? '🛒' : '🏭'} ${u.name} (${u.code})`,
                    }))} />
                  </Form.Item>
                </Col>
              )}
              {isAjuste && (
                <Col span={12}>
                  <Form.Item name="adjustmentAccountId" label="Cuenta contable de ajuste">
                    <AccountSelect filter={{}} placeholder="Cuenta del asiento (opcional)..." />
                  </Form.Item>
                </Col>
              )}
              <Col span={!cfg?.needsOrigen && !cfg?.needsDestino && !isAjuste ? 24 : 12}>
                <Form.Item name="notes" label="Notas internas">
                  <Input.TextArea rows={1} placeholder="Observaciones opcionales" />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Divider style={{ margin: '10px 0' }} />

          {/* ── Paso 3: Artículos ── */}
          <Text strong style={{ color: '#1faec2', display: 'block', marginBottom: 10 }}>
            3. Artículos
          </Text>

          {/* Mini form to add a line */}
          <Form form={lineForm} layout="inline" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
            <Form.Item name="productId" rules={[{ required: true, message: '' }]} style={{ flex: '0 0 270px' }}>
              <Select
                showSearch
                filterOption={false}
                onSearch={searchProducts}
                onDropdownVisibleChange={open => { if (open) loadInitialProducts() }}
                loading={searching}
                placeholder="Buscar artículo por nombre o SKU..."
                notFoundContent={searching ? 'Buscando...' : 'Sin resultados'}
                options={products.map(p => ({
                  value: p.id,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{p.sku ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280', marginRight: 4 }}>[{p.sku}]</span> : null}{p.name}</span>
                      {p.isInventoriable && (
                        <span style={{ fontSize: 11, color: Number(p.stockOnHand) > 0 ? '#2ea172' : '#e5484d', whiteSpace: 'nowrap' }}>
                          Stock: {Number(p.stockOnHand ?? 0).toFixed(0)}
                        </span>
                      )}
                    </div>
                  ),
                }))}
                popupMatchSelectWidth={false}
                listHeight={300}
              />
            </Form.Item>
            <Form.Item name="quantity" rules={[{ required: true, message: '' }]} style={{ width: 100 }}>
              <InputNumber
                placeholder={isAjuste ? '±Cant.' : 'Cantidad'}
                style={{ width: '100%' }}
                min={isAjuste ? -9999999 : 0.0001}
                step={1}
              />
            </Form.Item>
            <Form.Item name="unitCost" style={{ width: 110 }}>
              <InputNumber placeholder="Costo/u" style={{ width: '100%' }} min={0} step={0.01} prefix="Q" />
            </Form.Item>
            <Form.Item name="lote" style={{ width: 110 }}>
              <Input placeholder="Lote (opc.)" />
            </Form.Item>
            <Form.Item>
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddLine}>
                Agregar
              </Button>
            </Form.Item>
          </Form>

          {/* Lines table */}
          {pendingLines.length > 0 ? (
            <Table
              columns={lineCols}
              dataSource={pendingLines}
              rowKey="_key"
              size="small"
              pagination={false}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>{pendingLines.length} artículo(s)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>Q {pendingLines.reduce((s, l) => s + l.totalCost, 0).toFixed(2)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', background: '#fafbfc', borderRadius: 6 }}>
              Sin artículos — completa el formulario arriba y haz clic en "Agregar"
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── Detail modal (view confirmed / manage draft) ────────────────────────────
function MovimientoDetailModal({ movimientoId, open, ubicaciones, onClose, onConfirmado }: {
  movimientoId: string | null
  open: boolean
  ubicaciones: Ubicacion[]
  onClose: () => void
  onConfirmado: () => void
}) {
  const [mov, setMov]           = useState<Movimiento | null>(null)
  const [loading, setLoading]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [addForm]               = Form.useForm()
  const [products, setProducts] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [detailProdInit, setDetailProdInit] = useState(false)

  useEffect(() => {
    if (open && movimientoId) {
      setLoading(true)
      setDetailProdInit(false)
      getMovimiento(movimientoId)
        .then(setMov)
        .catch(() => message.error('Error cargando movimiento'))
        .finally(() => setLoading(false))
    }
  }, [open, movimientoId])

  const ubicMap = Object.fromEntries(ubicaciones.map(u => [u.id, u.name]))
  const cfg  = mov ? TIPO_MOVIMIENTO_CONFIG[mov.tipoMovimiento as TipoMovimiento] : null
  const isDraft = mov?.status === 'draft'

  const loadDetailProducts = async () => {
    if (detailProdInit) return
    setSearching(true)
    getProducts({ limit: 30 })
      .then(r => { setProducts((r as any).data ?? []); setDetailProdInit(true) })
      .finally(() => setSearching(false))
  }

  const searchProducts = async (q: string) => {
    setSearching(true)
    getProducts({ search: q || undefined, limit: 30 })
      .then(r => setProducts((r as any).data ?? []))
      .finally(() => setSearching(false))
  }

  const handleAddLine = async () => {
    if (!mov) return
    const v = await addForm.validateFields()
    const product = products.find(p => p.id === v.productId)
    try {
      await addMovimientoLinea(mov.id, {
        productId: v.productId,
        quantity: v.quantity,
        unitCost: v.unitCost,
        lote: v.lote,
      })
      message.success(`${product?.name} agregado`)
      addForm.resetFields()
      const updated = await getMovimiento(mov.id)
      setMov(updated)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al agregar')
    }
  }

  const handleConfirmar = async () => {
    if (!mov) return
    setConfirming(true)
    try {
      await confirmarMovimiento(mov.id)
      message.success('Movimiento confirmado — stock actualizado')
      onConfirmado()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al confirmar')
    } finally { setConfirming(false) }
  }

  const lineas: MovimientoLinea[] = (mov?.lineas ?? []) as MovimientoLinea[]

  const lineCols: ColumnsType<MovimientoLinea> = [
    {
      title: 'Artículo', render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.productName}</div>
          {r.productSku && <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.productSku}</div>}
        </div>
      ),
    },
    {
      title: 'Cantidad', dataIndex: 'quantity', width: 90, align: 'right',
      render: v => {
        const n = Number(v)
        return <span style={{ fontWeight: 600, color: n > 0 ? '#2ea172' : n < 0 ? '#e5484d' : '#6b7280' }}>
          {n > 0 ? '+' : ''}{n}
        </span>
      },
    },
    { title: 'Costo u.',  dataIndex: 'unitCost',  width: 100, align: 'right', render: v => `Q ${Number(v).toFixed(2)}` },
    { title: 'Total',     dataIndex: 'totalCost', width: 110, align: 'right', render: v => <strong>Q {Number(v).toFixed(2)}</strong> },
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      title={mov ? (
        <Space>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{mov.code}</span>
          <Tag color={cfg?.color}>{cfg?.icon} {cfg?.label}</Tag>
          {isDraft
            ? <Badge status="processing" text="Borrador" />
            : <Badge status="success" text="Confirmado" />}
        </Space>
      ) : 'Detalle del movimiento'}
      footer={isDraft ? (
        <Space>
          <Button onClick={onClose}>Cerrar</Button>
          <Button type="primary" icon={<CheckCircleOutlined />}
            loading={confirming} onClick={handleConfirmar}
            disabled={lineas.length === 0}
            style={{ background: '#2ea172', borderColor: '#2ea172' }}>
            Confirmar movimiento
          </Button>
        </Space>
      ) : <Button onClick={onClose}>Cerrar</Button>}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Cargando...</div>
      ) : mov ? (
        <>
          {/* Info strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Fecha', value: dayjs(mov.date).format('DD/MM/YYYY') },
              { label: 'Origen', value: mov.ubicacionOrigenId ? ubicMap[mov.ubicacionOrigenId] || '—' : '—' },
              { label: 'Destino', value: mov.ubicacionDestinoId ? ubicMap[mov.ubicacionDestinoId] || '—' : '—' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fafbfc', borderRadius: 6, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{k.label}</div>
                <div style={{ fontWeight: 600 }}>{k.value}</div>
              </div>
            ))}
          </div>
          {mov.reason && <Alert type="info" message={`Referencia: ${mov.reason}`} showIcon style={{ marginBottom: 12 }} />}

          {/* Add line (only on draft) */}
          {isDraft && (
            <Form form={addForm} layout="inline" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
              <Form.Item name="productId" rules={[{ required: true, message: '' }]} style={{ flex: '0 0 240px' }}>
                <Select
                  showSearch filterOption={false} onSearch={searchProducts} loading={searching}
                  onDropdownVisibleChange={open => { if (open) loadDetailProducts() }}
                  placeholder="Buscar artículo..."
                  notFoundContent={searching ? 'Buscando...' : 'Sin resultados'}
                  options={products.map(p => ({ value: p.id, label: `${p.sku ? `[${p.sku}] ` : ''}${p.name}` }))}
                  popupMatchSelectWidth={false}
                />
              </Form.Item>
              <Form.Item name="quantity" rules={[{ required: true, message: '' }]} style={{ width: 90 }}>
                <InputNumber placeholder="Cant." style={{ width: '100%' }} min={-9999999} step={1} />
              </Form.Item>
              <Form.Item name="unitCost" rules={[{ required: true, message: '' }]} style={{ width: 100 }}>
                <InputNumber placeholder="Q costo" style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <Form.Item name="lote" style={{ width: 90 }}>
                <Input placeholder="Lote" />
              </Form.Item>
              <Form.Item>
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddLine}>Agregar</Button>
              </Form.Item>
            </Form>
          )}

          {/* Lines */}
          <Table columns={lineCols} dataSource={lineas} rowKey="id" size="small" pagination={false}
            locale={{ emptyText: 'Sin artículos' }}
            summary={() => lineas.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><Text strong>{lineas.length} artículo(s)</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">
                  <Text strong>Q {lineas.reduce((s, l) => s + Number(l.totalCost), 0).toFixed(2)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null}
          />
        </>
      ) : null}
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MovimientosPage() {
  const [items,      setItems]      = useState<Movimiento[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [tipoFilt,   setTipoFilt]   = useState<string | undefined>()
  const [statusFilt, setStatusFilt] = useState<string | undefined>()
  const [page,       setPage]       = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId,   setDetailId]   = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [almacenes,  setAlmacenes]  = useState<Almacen[]>([])
  const [almacenFilt, setAlmacenFilt] = useState<string | undefined>()
  const [productoFilt, setProductoFilt] = useState<string | undefined>()
  const [prodOpts,   setProdOpts]   = useState<Product[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMovimientos({
        page, limit: 20, search: search || undefined,
        tipoMovimiento: tipoFilt, status: statusFilt,
        productId: productoFilt, almacenId: almacenFilt,
      })
      const r = res as any
      const data = r.data ?? r
      setItems(Array.isArray(data) ? data : [])
      setTotal(r.total ?? data.length)
    } catch { message.error('Error al cargar movimientos') }
    finally { setLoading(false) }
  }, [page, search, tipoFilt, statusFilt, productoFilt, almacenFilt])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getUbicaciones().then(r => setUbicaciones(Array.isArray(r) ? r : []))
    getAlmacenes().then(r => setAlmacenes(Array.isArray(r) ? r : [])).catch(() => setAlmacenes([]))
  }, [])

  const searchProdFilter = async (q: string) => {
    if (!q || q.length < 2) { setProdOpts([]); return }
    try {
      const res = await getProducts({ search: q, limit: 20 })
      setProdOpts((res as any)?.data ?? [])
    } catch { setProdOpts([]) }
  }

  const ubicMap = Object.fromEntries(ubicaciones.map(u => [u.id, u.name]))

  const handleDelete = async (id: string) => {
    try { await deleteMovimiento(id); load() }
    catch { message.error('Solo se pueden eliminar movimientos en borrador') }
  }

  const columns: ColumnsType<Movimiento> = [
    {
      title: 'Código', dataIndex: 'code', width: 140,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Tipo', dataIndex: 'tipoMovimiento', width: 200,
      render: (v: TipoMovimiento) => {
        const c = TIPO_MOVIMIENTO_CONFIG[v]
        return c ? <Tag color={c.color}>{c.icon} {c.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Fecha', dataIndex: 'date', width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Origen / Destino', width: 220,
      render: (_, r) => {
        const c = TIPO_MOVIMIENTO_CONFIG[r.tipoMovimiento as TipoMovimiento]
        if (!c) return '—'
        if (c.flow === 'traslado') return (
          <Space size={4}>
            <Tag color="#ff7f00">{ubicMap[r.ubicacionOrigenId!] || '—'}</Tag>
            →
            <Tag color="#2ea172">{ubicMap[r.ubicacionDestinoId!] || '—'}</Tag>
          </Space>
        )
        if (c.needsOrigen && r.ubicacionOrigenId) return <Tag>{ubicMap[r.ubicacionOrigenId]}</Tag>
        if (c.needsDestino && r.ubicacionDestinoId) return <Tag color="#2ea172">{ubicMap[r.ubicacionDestinoId]}</Tag>
        return <Tag color="gold">—</Tag>
      },
    },
    { title: 'Referencia', dataIndex: 'reason', ellipsis: true, render: v => v || '—' },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: v => v === 'confirmed'
        ? <Badge status="success" text="Confirmado" />
        : <Badge status="processing" text="Borrador" />,
    },
    {
      title: 'Acciones', width: 130, render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => { setDetailId(row.id); setDetailOpen(true) }}>
            Ver
          </Button>
          {row.status === 'draft' && (
            <Tooltip title="Eliminar borrador">
              <Popconfirm title="¿Eliminar movimiento?" onConfirm={() => handleDelete(row.id)} okText="Sí" cancelText="No">
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // Summary counts by flow type
  const counts = { entrada: 0, salida: 0, traslado: 0, ajuste: 0 }
  items.forEach(i => {
    const c = TIPO_MOVIMIENTO_CONFIG[i.tipoMovimiento as TipoMovimiento]
    if (c) counts[c.flow] = (counts[c.flow] || 0) + 1
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <SwapOutlined style={{ marginRight: 8 }} /> Movimientos de Inventario
          </Title>
          <Text type="secondary">Entradas, salidas, traslados y ajustes (estilo SAP MIGO)</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)} style={{ background: '#1faec2' }}>
          Nuevo movimiento
        </Button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Entradas',  count: counts.entrada,  color: '#2ea172', icon: '📥' },
          { label: 'Salidas',   count: counts.salida,   color: '#e5484d', icon: '📤' },
          { label: 'Traslados', count: counts.traslado, color: '#6b7280', icon: '🔄' },
          { label: 'Ajustes',   count: counts.ajuste,   color: '#ff7f00', icon: '⚖️' },
        ].map(k => (
          <Card key={k.label} size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.count}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Space wrap>
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar código o referencia..." style={{ width: 260 }}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} allowClear />
          <Select allowClear placeholder="Tipo de movimiento" style={{ width: 220 }}
            value={tipoFilt} onChange={v => { setTipoFilt(v); setPage(1) }}
            options={Object.entries(TIPO_MOVIMIENTO_CONFIG).map(([v, c]) => ({
              value: v, label: `${c.icon} ${c.label}`,
            }))} />
          <Select allowClear placeholder="Estado" style={{ width: 140 }}
            value={statusFilt} onChange={v => { setStatusFilt(v); setPage(1) }}
            options={[
              { value: 'draft',     label: '⏳ Borrador' },
              { value: 'confirmed', label: '✅ Confirmado' },
            ]} />
          <Select allowClear showSearch placeholder="Almacén" style={{ width: 180 }}
            value={almacenFilt} onChange={v => { setAlmacenFilt(v); setPage(1) }}
            optionFilterProp="label"
            options={almacenes.map(a => ({ value: a.id, label: a.name }))} />
          <Select allowClear showSearch placeholder="Artículo (código/nombre)" style={{ width: 240 }}
            value={productoFilt} onChange={v => { setProductoFilt(v); setPage(1) }}
            filterOption={false} onSearch={searchProdFilter} notFoundContent={null}
            options={prodOpts.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` }))} />
        </Space>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: 20, total, showSizeChanger: false,
            showTotal: t => `${t} movimientos`, onChange: setPage }}
          locale={{ emptyText: 'Sin movimientos registrados' }}
        />
      </Card>

      {/* Modals */}
      <MovimientoFormModal
        open={createOpen}
        ubicaciones={ubicaciones}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); load() }}
      />
      <MovimientoDetailModal
        movimientoId={detailId}
        open={detailOpen}
        ubicaciones={ubicaciones}
        onClose={() => setDetailOpen(false)}
        onConfirmado={() => { setDetailOpen(false); load() }}
      />
    </div>
  )
}
