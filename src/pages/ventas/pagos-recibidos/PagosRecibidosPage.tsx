import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  DatePicker, Tooltip, Popconfirm, message, Row, Col, Statistic, Popover,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, DollarOutlined, EyeOutlined, DeleteOutlined,
  ClearOutlined, BankOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPagosRecibidos, deletePagoRecibido,
  type PagoRecibido, PAYMENT_MODE_LABELS,
} from '../../../api/pagos-recibidos'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const INVOICE_STATUS_COLOR: Record<string, string> = {
  sent: 'blue', partial: 'geekblue', paid: 'green', voided: 'red', draft: 'default',
  pending: 'gold', overdue: 'orange',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada', partial: 'Parcial', paid: 'Pagada', voided: 'Anulada',
  draft: 'Borrador', pending: 'Pendiente', overdue: 'Vencida',
}

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_pagos_recibidos'

const ALL_COL_META: ColMeta[] = [
  { key: 'paymentNumber', label: 'N° Pago',          description: 'Número del pago (incluye indicador de anticipo)' },
  { key: 'paymentDate',   label: 'Fecha' },
  { key: 'customer',      label: 'Cliente',           description: 'Nombre y NIT del cliente' },
  { key: 'customerTaxId', label: 'NIT Cliente',       description: 'Solo el NIT, columna separada' },
  { key: 'documento',     label: 'Documento',         description: 'Factura aplicada con su estado' },
  { key: 'invoiceTotal',  label: 'Total Factura',     description: 'Total de la factura asociada' },
  { key: 'currency',      label: 'Moneda' },
  { key: 'mode',          label: 'Forma de pago' },
  { key: 'reference',     label: 'Referencia' },
  { key: 'amount',        label: 'Monto' },
  { key: 'isAdvance',     label: 'Anticipo',          description: 'Indica si es un anticipo' },
  { key: 'notes',         label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['paymentNumber', 'paymentDate', 'customer', 'documento', 'mode', 'reference', 'amount'].includes(c.key),
  sortOrder: i + 1,
}))

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(key: string): ColumnsType<PagoRecibido>[number] | null {
  const base = { key }
  switch (key) {
    case 'paymentNumber':
      return { ...base, title: 'N° Pago', dataIndex: 'paymentNumber', width: 175,
        render: (v: string, r: PagoRecibido) => (
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 12 }}>{v}</Text>
            {r.isAdvance && (
              <Tag icon={<BankOutlined />} color="gold" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>Anticipo</Tag>
            )}
          </Space>
        ) }
    case 'paymentDate':
      return { ...base, title: 'Fecha', dataIndex: 'paymentDate', width: 105,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</span> }
    case 'customer':
      return { ...base, title: 'Cliente', dataIndex: 'customerName',
        render: (v: string, r: PagoRecibido) => (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{v ?? r.customerId}</div>
            {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>{r.customerTaxId}</Text>}
          </div>
        ) }
    case 'customerTaxId':
      return { ...base, title: 'NIT Cliente', dataIndex: 'customerTaxId', width: 120,
        render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</Text> }
    case 'documento':
      return { ...base, title: 'Documento', dataIndex: 'invoiceNumber', width: 165,
        render: (v: string, r: PagoRecibido) => v ? (
          <Space direction="vertical" size={2}>
            <Text style={{ fontFamily: 'monospace', fontSize: 12, color: r.isAdvance ? '#d48806' : undefined, fontWeight: r.isAdvance ? 600 : undefined }}>
              {v}
            </Text>
            {r.isAdvance
              ? <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>Anticipo disponible</Tag>
              : r.invoiceStatus && (
                  <Tag color={INVOICE_STATUS_COLOR[r.invoiceStatus] ?? 'default'} style={{ fontSize: 10, lineHeight: '16px' }}>
                    {INVOICE_STATUS_LABEL[r.invoiceStatus] ?? r.invoiceStatus}
                  </Tag>
                )
            }
          </Space>
        ) : <Text type="secondary">—</Text> }
    case 'invoiceTotal':
      return { ...base, title: 'Total Factura', dataIndex: 'invoiceTotal', width: 120, align: 'right' as const,
        render: (v: number) => v != null
          ? <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</span>
          : <Text type="secondary">—</Text> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || 'GTQ'}</Tag> }
    case 'mode':
      return { ...base, title: 'Forma de pago', dataIndex: 'mode', width: 160,
        render: (v: string) => v
          ? <Tag>{PAYMENT_MODE_LABELS[v as keyof typeof PAYMENT_MODE_LABELS] ?? v}</Tag>
          : <Text type="secondary">—</Text> }
    case 'reference':
      return { ...base, title: 'Referencia', dataIndex: 'reference', width: 140, ellipsis: true,
        render: (v: string) => v
          ? <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    case 'amount':
      return { ...base, title: 'Monto', dataIndex: 'amount', width: 130, align: 'right' as const,
        render: (v: number) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 13 }}>{fmtQ(v)}</Text> }
    case 'isAdvance':
      return { ...base, title: 'Anticipo', dataIndex: 'isAdvance', width: 90, align: 'center' as const,
        render: (v: boolean) => v
          ? <Tag color="gold" style={{ fontSize: 11 }}>Sí</Tag>
          : <Text type="secondary" style={{ fontSize: 12 }}>No</Text> }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 150, ellipsis: true,
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PagosRecibidosPage() {
  const navigate = useNavigate()

  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate,   setToDate]   = useState<string | undefined>(undefined)
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<PagoRecibido[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)

  // Column config
  const [colConfig, setColConfig] = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPagosRecibidos({ page, limit: 20, search: search || undefined, fromDate, toDate })
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch { setData([]); setTotal(0) }
    finally { setLoading(false) }
  }, [page, search, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try { await deletePagoRecibido(id); message.success('Pago eliminado y saldo revertido'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  const totalMonto     = data.reduce((s, p) => s + Number(p.amount), 0)
  const totalAnticipos = data.filter(p => p.isAdvance).reduce((s, p) => s + Number(p.amount), 0)
  const pagosHoy       = data.filter(p => dayjs(p.paymentDate).isSame(dayjs(), 'day')).length

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<PagoRecibido> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key))
      .filter((c): c is ColumnsType<PagoRecibido>[number] => c !== null),
    {
      key: '_actions',
      title: 'Acciones',
      width: 100,
      align: 'center' as const,
      render: (_: any, r: PagoRecibido) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/ventas/pagos-recibidos/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Eliminar pago">
            <Popconfirm
              title="¿Eliminar este pago?"
              description="Se revertirá el saldo en la factura y se eliminará la póliza contable."
              onConfirm={() => handleDelete(r.id)}
              okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Pagos Recibidos</Title>
            <Text type="secondary">Registro de cobros aplicados a facturas</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }}
          onClick={() => navigate('/ventas/pagos-recibidos/nuevo')}>
          Registrar Pago
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
            placeholder={['Desde', 'Hasta']}
            onChange={(dates, strs) => {
              if (dates && strs[0] && strs[1]) {
                setFromDate(dayjs(strs[0], 'DD/MM/YYYY').format('YYYY-MM-DD'))
                setToDate(dayjs(strs[1],   'DD/MM/YYYY').format('YYYY-MM-DD'))
              } else { setFromDate(undefined); setToDate(undefined) }
              setPage(1)
            }}
            allowClear
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar N° pago, cliente, factura, referencia..."
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Tooltip title="Limpiar filtros">
            <Button icon={<ClearOutlined />} onClick={() => { setFromDate(undefined); setToDate(undefined); setSearch(''); setPage(1) }}>
              Limpiar
            </Button>
          </Tooltip>
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
              <Button size="small" icon={<SettingOutlined />}
                style={{ border: colPopover ? '1px solid #1B3A6B' : undefined, color: colPopover ? '#1B3A6B' : undefined }}>
                Columnas
              </Button>
            </Tooltip>
          </Popover>
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { title: 'Total operaciones',   value: total,         fmt: (v: number) => String(v), color: '#1B3A6B' },
          { title: 'Monto cobrado',       value: totalMonto,    fmt: fmtQ,                       color: '#1B3A6B' },
          { title: 'Anticipos recibidos', value: totalAnticipos,fmt: fmtQ,                       color: '#d48806' },
          { title: 'Pagos hoy',           value: pagosHoy,      fmt: (v: number) => String(v), color: '#1B3A6B' },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic title={s.title} value={s.value} formatter={v => s.fmt(Number(v))} valueStyle={{ fontSize: 16, color: s.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={activeColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ total, current: page, pageSize: 20, onChange: setPage, showTotal: t => `${t} pagos`, showSizeChanger: false }}
          locale={{ emptyText: 'No hay pagos registrados en el período' }}
        />
      </Card>
    </div>
  )
}
