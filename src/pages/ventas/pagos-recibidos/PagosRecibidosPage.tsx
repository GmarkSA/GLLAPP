import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  DatePicker, Tooltip, Popconfirm, message, Row, Col, Statistic, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, DollarOutlined, EyeOutlined, DeleteOutlined, ClearOutlined,
  BankOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPagosRecibidos, deletePagoRecibido,
  type PagoRecibido, PAYMENT_MODE_LABELS,
} from '../../../api/pagos-recibidos'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const INVOICE_STATUS_COLOR: Record<string, string> = {
  sent: 'blue', partial: 'geekblue', paid: 'green', voided: 'red', draft: 'default',
  pending: 'gold', overdue: 'orange',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada', partial: 'Parcial', paid: 'Pagada', voided: 'Anulada', draft: 'Borrador',
  pending: 'Pendiente', overdue: 'Vencida',
}

export default function PagosRecibidosPage() {
  const navigate = useNavigate()

  // Sin filtro de fecha por defecto — muestra TODOS los pagos sin importar cuándo se registraron
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate,   setToDate]   = useState<string | undefined>(undefined)
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<PagoRecibido[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPagosRecibidos({
        page,
        limit: 20,
        search:   search   || undefined,
        fromDate: fromDate || undefined,
        toDate:   toDate   || undefined,
      })
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      console.error('[PagosRecibidos] Error cargando:', e?.response?.data ?? e?.message)
      setData([])
      setTotal(0)
    }
    finally { setLoading(false) }
  }, [page, search, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try {
      await deletePagoRecibido(id)
      message.success('Pago eliminado y saldo revertido en la factura')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar el pago')
    }
  }

  // KPIs
  const totalPagos    = total
  const totalMonto    = data.reduce((s, p) => s + Number(p.amount), 0)
  const totalAnticipos = data.filter(p => p.isAdvance).reduce((s, p) => s + Number(p.amount), 0)
  const pagosHoy      = data.filter(p => dayjs(p.paymentDate).isSame(dayjs(), 'day')).length

  const columns: ColumnsType<PagoRecibido> = [
    {
      title: 'N° Pago', dataIndex: 'paymentNumber', width: 180,
      render: (v, r) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>
          {r.isAdvance && (
            <Tag icon={<BankOutlined />} color="gold" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
              Anticipo
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'paymentDate', width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Cliente', dataIndex: 'customerName',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v ?? r.customerId}</div>
          {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>{r.customerTaxId}</Text>}
        </div>
      ),
    },
    {
      title: 'Documento', dataIndex: 'invoiceNumber', width: 170,
      render: (v, r) => v
        ? (
          <Space direction="vertical" size={2}>
            <Text
              style={{
                fontFamily: 'monospace', fontSize: 12,
                color: r.isAdvance ? '#d48806' : undefined,
                fontWeight: r.isAdvance ? 600 : undefined,
              }}
            >
              {v}
            </Text>
            {r.isAdvance
              ? (
                <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>
                  Anticipo disponible
                </Tag>
              )
              : r.invoiceStatus && (
                <Tag
                  color={INVOICE_STATUS_COLOR[r.invoiceStatus] ?? 'default'}
                  style={{ fontSize: 10, lineHeight: '16px' }}
                >
                  {INVOICE_STATUS_LABEL[r.invoiceStatus] ?? r.invoiceStatus}
                </Tag>
              )
            }
          </Space>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Forma de pago', dataIndex: 'mode', width: 170,
      render: (v) => v ? <Tag>{PAYMENT_MODE_LABELS[v as keyof typeof PAYMENT_MODE_LABELS] ?? v}</Tag> : '—',
    },
    {
      title: 'Referencia', dataIndex: 'reference', width: 140,
      render: (v) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
    {
      title: 'Monto', dataIndex: 'amount', width: 130, align: 'right',
      render: (v) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Acciones', width: 100, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/ventas/pagos-recibidos/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Eliminar pago">
            <Popconfirm
              title="¿Eliminar este pago?"
              description="Se revertirá el saldo en la factura y se eliminará la póliza contable. Esta acción no se puede deshacer."
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#1B3A6B' }}
          onClick={() => navigate('/ventas/pagos-recibidos/nuevo')}
        >
          Registrar Pago
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
            placeholder={['Desde', 'Hasta']}
            onChange={(dates, strs) => {
              if (dates && strs[0] && strs[1]) {
                setFromDate(dayjs(strs[0], 'DD/MM/YYYY').format('YYYY-MM-DD'))
                setToDate(dayjs(strs[1], 'DD/MM/YYYY').format('YYYY-MM-DD'))
              } else {
                setFromDate(undefined)
                setToDate(undefined)
              }
              setPage(1)
            }}
            allowClear
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar N° pago, cliente, factura, referencia..."
            style={{ width: 300 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Tooltip title="Limpiar todos los filtros">
            <Button
              icon={<ClearOutlined />}
              onClick={() => {
                setFromDate(undefined)
                setToDate(undefined)
                setSearch('')
                setPage(1)
              }}
            >
              Limpiar
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { title: 'Total operaciones', value: totalPagos,     fmt: (v: number) => String(v),   color: '#1B3A6B' },
          { title: 'Monto cobrado',     value: totalMonto,     fmt: fmtQ,                         color: '#1B3A6B' },
          { title: 'Anticipos recibidos', value: totalAnticipos, fmt: fmtQ,                       color: '#d48806' },
          { title: 'Pagos hoy',         value: pagosHoy,       fmt: (v: number) => String(v),   color: '#1B3A6B' },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={s.title}
                value={s.value}
                formatter={v => s.fmt(Number(v))}
                valueStyle={{ fontSize: 16, color: s.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla */}
      <Card bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1100 }}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: t => `${t} pagos`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'No hay pagos registrados en el período' }}
        />
      </Card>
    </div>
  )
}
