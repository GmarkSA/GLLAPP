import { useEffect, useState, useCallback } from 'react'
import {
  Typography, Button, Table, Space, Tag, Card, message,
  Modal, Form, Input, InputNumber, Select, DatePicker,
  Popconfirm, Badge, Divider, Tooltip, Row, Col, Statistic,
} from 'antd'
import {
  PlusOutlined, ToolOutlined, PlayCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined,
  MinusCircleOutlined, SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getOrdenes, createOrden, iniciarOrden, completarOrden, cancelarOrden, deleteOrden,
  getAlmacenes,
  type OrdenProduccion, type OrdenProduccionLinea, type Almacen,
} from '../../api/expedientes'
import { getProducts, type Product } from '../../api/inventario'

const { Title, Text } = Typography

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador:   { label: 'Borrador',    color: 'default', icon: <ToolOutlined /> },
  en_proceso: { label: 'En proceso',  color: '#1faec2',    icon: <PlayCircleOutlined /> },
  completada: { label: 'Completada',  color: 'success', icon: <CheckCircleOutlined /> },
  cancelada:  { label: 'Cancelada',   color: 'error',   icon: <CloseCircleOutlined /> },
}

// ─── BOM Line row inside the form ────────────────────────────────────────────
interface PendingMaterial {
  _key: number
  productId: string
  productName: string
  productSku: string
  cantidadRequerida: number
  unitCost?: number
}

// ─── Create Order Modal ───────────────────────────────────────────────────────
function NuevaOrdenModal({ open, almacenes, onClose, onSaved }: {
  open: boolean
  almacenes: Almacen[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form]     = Form.useForm()
  const [lineForm] = Form.useForm()
  const [saving, setSaving]               = useState(false)
  const [ptProducts, setPtProducts]       = useState<Product[]>([])
  const [mpProducts, setMpProducts]       = useState<Product[]>([])
  const [searchingPT, setSearchingPT]     = useState(false)
  const [searchingMP, setSearchingMP]     = useState(false)
  const [materials, setMaterials]         = useState<PendingMaterial[]>([])
  const [matKey, setMatKey]               = useState(0)

  useEffect(() => {
    if (!open) { form.resetFields(); lineForm.resetFields(); setMaterials([]) }
  }, [open, form, lineForm])

  const searchPT = async (q: string) => {
    if (!q) return
    setSearchingPT(true)
    getProducts({ search: q, limit: 30 }).then(r => setPtProducts((r as any).data ?? [])).finally(() => setSearchingPT(false))
  }

  const searchMP = async (q: string) => {
    if (!q) return
    setSearchingMP(true)
    getProducts({ search: q, limit: 30 }).then(r => setMpProducts((r as any).data ?? [])).finally(() => setSearchingMP(false))
  }

  const handleAddMaterial = async () => {
    try {
      const v = await lineForm.validateFields()
      const product = mpProducts.find(p => p.id === v.productId)
      setMaterials(prev => [...prev, {
        _key: matKey,
        productId: v.productId,
        productName: product?.name || v.productId,
        productSku: product?.sku || '',
        cantidadRequerida: Number(v.cantidadRequerida),
        unitCost: v.unitCost ? Number(v.unitCost) : undefined,
      }])
      setMatKey(k => k + 1)
      lineForm.resetFields()
    } catch { /* validation */ }
  }

  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      if (materials.length === 0) { message.warning('Agrega al menos un material (BOM)'); return }
      setSaving(true)
      await createOrden({
        productoId: v.productoId,
        cantidadOrdenada: v.cantidadOrdenada,
        almacenId: v.almacenId,
        fechaEstimada: v.fechaEstimada ? dayjs(v.fechaEstimada).toISOString() : undefined,
        costoManoObra: v.costoManoObra ?? 0,
        costoIndirecto: v.costoIndirecto ?? 0,
        notas: v.notas,
        lineas: materials.map(m => ({
          productId: m.productId,
          productName: m.productName,
          productSku: m.productSku,
          cantidadRequerida: m.cantidadRequerida,
          unitCost: m.unitCost,
        })),
      })
      message.success('Orden de producción creada')
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al crear orden')
    } finally { setSaving(false) }
  }

  const matCols: ColumnsType<PendingMaterial> = [
    {
      title: 'Material / Componente', render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.productName}</div>
          {r.productSku && <span style={{ fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{r.productSku}</span>}
        </div>
      ),
    },
    { title: 'Cantidad', dataIndex: 'cantidadRequerida', width: 90, align: 'right' },
    {
      title: 'Costo u.', dataIndex: 'unitCost', width: 100, align: 'right',
      render: v => v ? `Q ${Number(v).toFixed(2)}` : '—',
    },
    {
      title: '', width: 44, render: (_, r) => (
        <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
          onClick={() => setMaterials(prev => prev.filter(m => m._key !== r._key))} />
      ),
    },
  ]

  return (
    <Modal
      title={<><ToolOutlined /> Nueva orden de producción</>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="Crear orden" width={760}
      okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
      destroyOnClose
    >
      <Divider titlePlacement="left" style={{ marginTop: 0 }}>Producto a producir</Divider>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="productoId" label="Producto terminado (PT)" rules={[{ required: true }]}>
              <Select
                showSearch filterOption={false} onSearch={searchPT} loading={searchingPT}
                placeholder="Buscar producto terminado..." notFoundContent="Escribe para buscar"
                options={ptProducts.map(p => ({ value: p.id, label: `${p.sku ? `[${p.sku}] ` : ''}${p.name}` }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="cantidadOrdenada" label="Cantidad a producir" rules={[{ required: true }]}>
              <InputNumber min={0.0001} style={{ width: '100%' }} placeholder="100" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="almacenId" label="Almacén destino">
              <Select allowClear placeholder="Seleccionar almacén"
                options={almacenes.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="fechaEstimada" label="Fecha estimada">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="costoManoObra" label="Costo mano de obra (Q)">
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="Q" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="costoIndirecto" label="Costos indirectos (Q)">
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="Q" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notas" label="Notas / Instrucciones">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>

      <Divider titlePlacement="left">Lista de materiales (BOM)</Divider>
      <Form form={lineForm} layout="inline" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
        <Form.Item name="productId" rules={[{ required: true, message: '' }]} style={{ flex: '0 0 260px' }}>
          <Select
            showSearch filterOption={false} onSearch={searchMP} loading={searchingMP}
            placeholder="Materia prima / componente..." notFoundContent="Escribe para buscar"
            options={mpProducts.map(p => ({ value: p.id, label: `${p.sku ? `[${p.sku}] ` : ''}${p.name}` }))}
          />
        </Form.Item>
        <Form.Item name="cantidadRequerida" rules={[{ required: true, message: '' }]} style={{ width: 100 }}>
          <InputNumber placeholder="Cantidad" style={{ width: '100%' }} min={0.0001} step={1} />
        </Form.Item>
        <Form.Item name="unitCost" style={{ width: 110 }}>
          <InputNumber placeholder="Costo/u" style={{ width: '100%' }} min={0} step={0.01} prefix="Q" />
        </Form.Item>
        <Form.Item>
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddMaterial}>Agregar</Button>
        </Form.Item>
      </Form>

      {materials.length > 0 ? (
        <Table columns={matCols} dataSource={materials} rowKey="_key" size="small" pagination={false}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <Text strong>{materials.length} componente(s)</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} />
            </Table.Summary.Row>
          )}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '12px', background: '#fafbfc', borderRadius: 6, color: '#bbb' }}>
          Sin materiales — define qué componentes se necesitan para producir
        </div>
      )}
    </Modal>
  )
}

// ─── Completar modal (allows overriding cantidadProducida) ───────────────────
function CompletarModal({ open, orden, onClose, onDone }: {
  open: boolean
  orden: OrdenProduccion | null
  onClose: () => void
  onDone: () => void
}) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && orden) form.setFieldsValue({ cantidadProducida: orden.cantidadOrdenada })
  }, [open, orden, form])

  const handleOk = async () => {
    if (!orden) return
    const v = await form.validateFields()
    setLoading(true)
    try {
      await completarOrden(orden.id, { cantidadProducida: v.cantidadProducida })
      message.success('Orden completada — stock actualizado')
      onDone()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al completar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Completar orden de producción" open={open} onOk={handleOk} onCancel={onClose}
      okText="Completar" okButtonProps={{ loading, style: { background: '#2ea172' } }}>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Al completar, se descontarán los materiales del stock y se agregará el producto terminado.
      </p>
      <Form form={form} layout="vertical">
        <Form.Item name="cantidadProducida" label="Cantidad producida real" rules={[{ required: true }]}>
          <InputNumber min={0} step={1} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProduccionPage() {
  const [items,       setItems]       = useState<OrdenProduccion[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [statusFilt,  setStatusFilt]  = useState<string | undefined>()
  const [page,        setPage]        = useState(1)
  const [almacenes,   setAlmacenes]   = useState<Almacen[]>([])
  const [modalNew,    setModalNew]    = useState(false)
  const [completarOrdenObj, setCompletarOrdenObj] = useState<OrdenProduccion | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOrdenes({ page, limit: 20, search: search || undefined, status: statusFilt })
      const r = res as any
      const data = r.data ?? r
      setItems(Array.isArray(data) ? data : [])
      setTotal(r.total ?? data.length)
    } catch { message.error('Error al cargar órdenes de producción') }
    finally { setLoading(false) }
  }, [page, search, statusFilt])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getAlmacenes().then(r => setAlmacenes(Array.isArray(r) ? r : []))
  }, [])

  const almacenMap = Object.fromEntries(almacenes.map(a => [a.id, a.name]))

  const stats = {
    borrador:   items.filter(i => i.status === 'borrador').length,
    en_proceso: items.filter(i => i.status === 'en_proceso').length,
    completada: items.filter(i => i.status === 'completada').length,
    cancelada:  items.filter(i => i.status === 'cancelada').length,
  }

  const handleIniciar = async (id: string) => {
    try { await iniciarOrden(id); message.success('Orden iniciada'); load() }
    catch (err: any) { message.error(err?.response?.data?.message || 'Error al iniciar') }
  }

  const handleCancelar = async (id: string) => {
    try { await cancelarOrden(id); message.success('Orden cancelada'); load() }
    catch (err: any) { message.error(err?.response?.data?.message || 'Error al cancelar') }
  }

  const handleDelete = async (id: string) => {
    try { await deleteOrden(id); message.success('Orden eliminada'); load() }
    catch (err: any) { message.error(err?.response?.data?.message || 'Solo se pueden eliminar órdenes en borrador') }
  }

  const columns: ColumnsType<OrdenProduccion> = [
    {
      title: 'Código', dataIndex: 'codigo', width: 150,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Producto terminado', render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.productoNombre || r.productoId}</div>
          {r.productoSku && <span style={{ fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{r.productoSku}</span>}
        </div>
      ),
    },
    {
      title: 'Cantidad', width: 120,
      render: (_, r) => (
        <div>
          <div><Text strong>{Number(r.cantidadOrdenada)}</Text> <Text type="secondary" style={{ fontSize: 11 }}>ordenada</Text></div>
          {Number(r.cantidadProducida) > 0 && (
            <div><Text style={{ color: '#2ea172' }}>{Number(r.cantidadProducida)}</Text> <Text type="secondary" style={{ fontSize: 11 }}>producida</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Almacén', dataIndex: 'almacenId', width: 140,
      render: v => v ? <Tag color="#1faec2">{almacenMap[v] || v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Fecha estimada', dataIndex: 'fechaEstimada', width: 130,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      render: v => {
        const cfg = STATUS_CONFIG[v] || { label: v, color: 'default' }
        return <Badge status={cfg.color as any} text={cfg.label} />
      },
    },
    {
      title: 'Acciones', width: 200,
      render: (_, row) => (
        <Space size={4} wrap>
          {row.status === 'borrador' && (
            <Tooltip title="Iniciar producción">
              <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                style={{ background: '#1faec2' }}
                onClick={() => handleIniciar(row.id)}>
                Iniciar
              </Button>
            </Tooltip>
          )}
          {row.status === 'en_proceso' && (
            <Tooltip title="Marcar como completada">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#2ea172' }}
                onClick={() => setCompletarOrdenObj(row)}>
                Completar
              </Button>
            </Tooltip>
          )}
          {(row.status === 'borrador' || row.status === 'en_proceso') && (
            <Popconfirm title="¿Cancelar esta orden?" onConfirm={() => handleCancelar(row.id)}
              okText="Sí" cancelText="No">
              <Button size="small" danger icon={<CloseCircleOutlined />}>Cancelar</Button>
            </Popconfirm>
          )}
          {row.status === 'borrador' && (
            <Popconfirm title="¿Eliminar esta orden?" onConfirm={() => handleDelete(row.id)}
              okText="Sí" cancelText="No">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <ToolOutlined style={{ marginRight: 8 }} /> Producción
          </Title>
          <Text type="secondary">Órdenes de producción — convierte materias primas en productos terminados</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
          onClick={() => setModalNew(true)}>
          Nueva orden
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
          <Col key={k} xs={12} sm={6}>
            <Card size="small" style={{
              borderRadius: 8, cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${statusFilt === k ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
              background: statusFilt === k ? '#fafbfc' : '#fff',
            }}
              onClick={() => setStatusFilt(statusFilt === k ? undefined : k)}>
              <div style={{ fontSize: 22, marginBottom: 2 }}>
                {k === 'borrador' ? '📋' : k === 'en_proceso' ? '⚙️' : k === 'completada' ? '✅' : '❌'}
              </div>
              <Statistic title={cfg.label} value={stats[k as keyof typeof stats]}
                valueStyle={{ fontSize: 22, color: '#0a0a0a' }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Space>
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Buscar por código, producto..." style={{ width: 280 }}
            value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Select allowClear placeholder="Estado" style={{ width: 160 }}
            value={statusFilt} onChange={v => setStatusFilt(v)}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
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
          pagination={{
            current: page, total, pageSize: 20,
            onChange: p => setPage(p),
            showTotal: t => `${t} órdenes`,
          }}
          locale={{ emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <ToolOutlined style={{ fontSize: 40, color: '#9aa1ab', display: 'block', marginBottom: 8 }} />
              <div style={{ color: '#6b7280' }}>Sin órdenes de producción</div>
              <div style={{ fontSize: 12, color: '#bbb' }}>Crea una nueva orden para comenzar</div>
            </div>
          )}}
        />
      </Card>

      <NuevaOrdenModal
        open={modalNew} almacenes={almacenes}
        onClose={() => setModalNew(false)} onSaved={load}
      />
      <CompletarModal
        open={!!completarOrdenObj} orden={completarOrdenObj}
        onClose={() => setCompletarOrdenObj(null)} onDone={load}
      />
    </div>
  )
}
