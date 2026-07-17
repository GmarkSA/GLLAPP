import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Button, Table, Space, Input, Card, message,
  Modal, Form, InputNumber, Select, DatePicker, Tag, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined, AuditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getAjustes, createAjuste, AJUSTE_TYPE_CONFIG, type AjusteInventario } from '../../api/expedientes'
import { getProducts, type Product } from '../../api/inventario'
import AccountSelect from '../../components/AccountSelect'

const { Title, Text } = Typography
const { Option } = Select

// ── Modal: Nuevo ajuste ───────────────────────────────────────────────────────
function NuevoAjusteModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form]     = Form.useForm()
  const [saving,   setSaving]   = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [lines,    setLines]    = useState<any[]>([{ _key: 0, productId: '', quantity: 0 }])
  const [keyC,     setKeyC]     = useState(1)

  useEffect(() => {
    if (!open) return
    getProducts({ limit: 100 }).then(r => setProducts(Array.isArray(r?.data) ? r.data : []))
  }, [open])

  const addLine = () => {
    setLines(prev => [...prev, { _key: keyC, productId: '', quantity: 0 }])
    setKeyC(k => k + 1)
  }

  const removeLine = (key: number) => setLines(prev => prev.filter(l => l._key !== key))

  const handleOk = async () => {
    const values = await form.validateFields()
    if (!lines.some(l => l.productId)) { message.warning('Agrega al menos un artículo'); return }
    setSaving(true)
    try {
      const dto = {
        ...values,
        date: values.date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        items: lines.filter(l => l.productId && l.quantity).map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      }
      await createAjuste(dto)
      message.success('Ajuste registrado y stock actualizado')
      form.resetFields()
      setLines([{ _key: 0, productId: '', quantity: 0 }])
      onSaved(); onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al registrar ajuste')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={<Space><AuditOutlined /> Nuevo ajuste de inventario</Space>}
      open={open} onOk={handleOk} onCancel={() => { form.resetFields(); setLines([{ _key: 0, productId: '', quantity: 0 }]); onClose() }}
      okText="Registrar ajuste" okButtonProps={{ loading: saving, style: { background: '#1faec2' } }}
      width={680} destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}
        initialValues={{ date: dayjs(), ajusteType: 'entrada' }}>
        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="ajusteType" label="Tipo de ajuste" rules={[{ required: true }]} style={{ width: 180 }}>
            <Select>
              {Object.entries(AJUSTE_TYPE_CONFIG).map(([k, v]) => (
                <Option key={k} value={k}>
                  <Tag color={v.color} style={{ fontSize: 11 }}>{v.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
        </Space>
        <Form.Item name="reason" label="Motivo / Razón">
          <Input placeholder="Ej: Ajuste por toma física, merma por vencimiento..." />
        </Form.Item>
        <Form.Item name="adjustmentAccountId" label="Cuenta contable del ajuste">
          <AccountSelect filter={{}} placeholder="Cuenta para contabilizar el ajuste..." />
        </Form.Item>
        <Form.Item name="notes" label="Notas">
          <Input.TextArea rows={2} />
        </Form.Item>

        {/* Lines */}
        <div style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13 }}>Artículos</Text>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addLine}>
              Agregar artículo
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={line._key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <Select
                showSearch filterOption={(input, opt) =>
                  (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                style={{ flex: 1 }}
                placeholder="Artículo"
                options={products.map(p => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
                value={line.productId || undefined}
                onChange={v => setLines(prev => prev.map(l => l._key === line._key ? { ...l, productId: v } : l))}
              />
              <InputNumber
                style={{ width: 110 }} min={0} precision={4} placeholder="Cantidad"
                value={line.quantity || undefined}
                onChange={v => setLines(prev => prev.map(l => l._key === line._key ? { ...l, quantity: v } : l))}
              />
              <InputNumber
                style={{ width: 120 }} min={0} precision={4} prefix="Q" placeholder="Costo/u"
                value={line.unitCost || undefined}
                onChange={v => setLines(prev => prev.map(l => l._key === line._key ? { ...l, unitCost: v } : l))}
              />
              {lines.length > 1 && (
                <Button type="text" danger size="small" onClick={() => removeLine(line._key)}>✕</Button>
              )}
            </div>
          ))}
        </div>
      </Form>
    </Modal>
  )
}

export default function AjustesInventarioPage() {
  const [items,   setItems]   = useState<AjusteInventario[]>([])
  const [loading, setLoading] = useState(false)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAjustes({ page, limit: 20, search: search || undefined })
      setItems(Array.isArray(res?.data) ? res.data : [])
      setTotal(res?.total ?? 0)
    } catch { message.error('Error al cargar ajustes') }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<AjusteInventario> = [
    { title: 'Código', dataIndex: 'code', width: 130,
      render: v => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text> },
    { title: 'Fecha', dataIndex: 'date', width: 100,
      render: d => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Tipo', dataIndex: 'ajusteType', width: 130,
      render: v => {
        const c = AJUSTE_TYPE_CONFIG[v as keyof typeof AJUSTE_TYPE_CONFIG]
        return c ? <Tag color={c.color}>{c.label}</Tag> : <Tag>{v}</Tag>
      } },
    { title: 'Motivo', dataIndex: 'reason', ellipsis: true, render: v => v || '—' },
    { title: 'Artículos', width: 80,
      render: (_, r) => <Tag>{r.lineas?.length || '—'}</Tag> },
    { title: 'Estado', dataIndex: 'status', width: 100,
      render: v => <Tag color={v === 'confirmed' ? '#2ea172' : '#ff7f00'}>{v === 'confirmed' ? 'Confirmado' : 'Borrador'}</Tag> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <AuditOutlined style={{ marginRight: 8 }} /> Ajustes de inventario
          </Title>
          <Text type="secondary">Registra entradas, salidas, mermas, devoluciones y conteos físicos</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => setModal(true)} style={{ background: '#1faec2' }}>
          Nuevo ajuste
        </Button>
      </div>
      <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Buscar por código, motivo..." style={{ width: 280 }}
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} allowClear />
      </Card>
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={items} loading={loading}
          rowKey="id" size="small"
          pagination={{ current: page, pageSize: 20, total, showSizeChanger: false,
            showTotal: t => `${t} ajustes`, onChange: p => setPage(p) }}
          locale={{ emptyText: 'Sin ajustes registrados' }} />
      </Card>
      <NuevoAjusteModal open={modal} onClose={() => setModal(false)} onSaved={load} />
    </div>
  )
}
