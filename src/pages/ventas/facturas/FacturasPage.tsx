import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Statistic, Row, Col, Modal, Form, DatePicker,
  message, Tabs,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  MoreOutlined, DollarOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RangePickerProps } from 'antd/es/date-picker'
import dayjs from 'dayjs'
import {
  getInvoices, deleteInvoice, voidInvoice, marcarEnviadasMasivo,
  INVOICE_STATUS_CONFIG, type Invoice, type InvoiceStatus,
} from '../../../api/facturas'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_TABS = [
  { key: 'all',     label: 'Todos'        },
  { key: 'draft',   label: 'Borradores'   },
  { key: 'pending', label: 'Pendiente'    },
  { key: 'sent',    label: 'Emitidas'     },
  { key: 'partial', label: 'Pago parcial' },
  { key: 'paid',    label: 'Pagadas'      },
  { key: 'overdue', label: 'Vencidas'     },
  { key: 'voided',  label: 'Anuladas'     },
]

export default function FacturasPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices]       = useState<Invoice[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [statusTab, setStatusTab]     = useState('all')
  const [dateRange, setDateRange]     = useState<[string, string] | null>(null)

  // Row selection (for bulk actions)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [bulkLoading, setBulkLoading]         = useState(false)

  // Void modal
  const [voidModal, setVoidModal]     = useState(false)
  const [voidTarget, setVoidTarget]   = useState<Invoice | null>(null)
  const [voidReason, setVoidReason]   = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      if (dateRange) { params.fromDate = dateRange[0]; params.toDate = dateRange[1] }
      const res = await getInvoices(params)
      setInvoices(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando facturas')
      setInvoices([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusTab, dateRange])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // Stats computed from current page — best-effort; real totals need separate aggregate endpoint
  const stats = {
    totalFacturado: invoices.reduce((s, i) => s + Number(i.total), 0),
    pendiente:      invoices.filter(i => ['draft', 'sent', 'partial'].includes(i.status)).reduce((s, i) => s + Number(i.balance), 0),
    vencidas:       invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.balance), 0),
    cobradas:       invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
  }

  const handleDelete = (inv: Invoice) => {
    const isVoided = inv.status === 'voided'
    Modal.confirm({
      title: 'Eliminar factura',
      content: isVoided
        ? `¿Eliminar permanentemente la factura anulada ${inv.invoiceNumber}? Se eliminarán también sus asientos contables asociados. Esta acción no se puede deshacer.`
        : `¿Eliminar permanentemente la factura ${inv.invoiceNumber}? Esta acción no se puede deshacer.`,
      okText: 'Eliminar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await deleteInvoice(inv.id)
          message.success('Factura eliminada')
          fetchInvoices()
        } catch (e: any) {
          message.error(e?.response?.data?.message || 'No se pudo eliminar')
        }
      },
    })
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    setVoidLoading(true)
    try {
      await voidInvoice(voidTarget.id, voidReason)
      message.success('Factura anulada')
      setVoidModal(false); setVoidReason(''); setVoidTarget(null)
      fetchInvoices()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo anular')
    } finally {
      setVoidLoading(false)
    }
  }

  const openVoid = (inv: Invoice) => { setVoidTarget(inv); setVoidModal(true) }

  const handleBulkMarcarEnviadas = async () => {
    if (!selectedRowKeys.length) return
    setBulkLoading(true)
    try {
      const res = await marcarEnviadasMasivo(selectedRowKeys as string[])
      const errors = res.errors?.length ?? 0
      if (errors > 0) {
        message.warning(`${res.updated} marcadas como enviadas. ${errors} con error.`)
      } else {
        message.success(`${res.updated} factura(s) marcadas como enviadas con partida contable generada.`)
      }
      setSelectedRowKeys([])
      fetchInvoices()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al marcar como enviadas')
    } finally {
      setBulkLoading(false)
    }
  }

  const columns: ColumnsType<Invoice> = [
    {
      title: '# Factura',
      dataIndex: 'invoiceNumber',
      width: 130,
      render: (v: string) => <Text strong style={{ color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Cliente',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
          {r.customerTaxId && (
            <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.customerTaxId}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'invoiceDate',
      width: 105,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Vence',
      dataIndex: 'dueDate',
      width: 105,
      render: (v: string, r) => {
        if (!v) return '—'
        const isOver = r.status === 'overdue'
        return <span style={{ color: isOver ? '#ff4d4f' : undefined }}>{dayjs(v).format('DD/MM/YYYY')}</span>
      },
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 130,
      align: 'right',
      render: (v) => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      width: 130,
      align: 'right',
      render: (v) => (
        <Text style={{ color: Number(v) > 0 ? '#cf1322' : '#52c41a' }}>
          {fmt(v)}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 120,
      render: (v: InvoiceStatus) => {
        const cfg = INVOICE_STATUS_CONFIG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '',
      width: 50,
      render: (_, r) => {
        const isDraft  = r.status === 'draft'
        const isPaid   = r.status === 'paid'
        const isVoided = r.status === 'voided'
        const items: any[] = [
          { key: 'view', label: 'Ver detalle' },
        ]
        if (isDraft) {
          items.push({ key: 'edit', label: 'Editar' })
        }
        if (isDraft || isVoided) {
          items.push({ type: 'divider' })
          items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span>, danger: false })
        }
        if (!isPaid && !isVoided) {
          items.push({ key: 'pay', label: 'Registrar pago' })
        }
        if (!isVoided) {
          items.push({ key: 'void', label: 'Anular' })
        }
        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')   navigate(`/ventas/facturas/${r.id}`)
                if (key === 'edit')   navigate(`/ventas/facturas/${r.id}/editar`)
                if (key === 'pay')    navigate(`/ventas/facturas/${r.id}?accion=pago`)
                if (key === 'void')   openVoid(r)
                if (key === 'delete') handleDelete(r)
              },
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ]

  const onDateChange: RangePickerProps['onChange'] = (_, strs) => {
    setDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
    setPage(1)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Facturas de venta</Title>
            <Text type="secondary">Gestión de facturas emitidas a clientes</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/ventas/facturas/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva factura
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total Facturado', value: stats.totalFacturado, icon: <DollarOutlined />, color: '#1B3A6B' },
          { title: 'Pendiente',       value: stats.pendiente,       icon: <ClockCircleOutlined />, color: '#fa8c16' },
          { title: 'Vencidas',        value: stats.vencidas,        icon: <ExclamationCircleOutlined />, color: '#ff4d4f' },
          { title: 'Cobradas',        value: stats.cobradas,        icon: <CheckCircleOutlined />, color: '#52c41a' },
        ].map(s => (
          <Col span={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
                formatter={(v) => fmt(Number(v))}
                valueStyle={{ fontSize: 18, color: s.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0 }} bodyStyle={{ padding: '12px 16px 0' }}>
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space style={{ paddingBottom: 8 }}>
              <RangePicker
                format="YYYY-MM-DD"
                onChange={onDateChange}
                size="small"
                placeholder={['Desde', 'Hasta']}
              />
              <Input
                placeholder="Buscar factura, cliente..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 240 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
              />
            </Space>
          }
        />
      </Card>

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8,
          padding: '8px 16px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Text strong style={{ color: '#1677ff' }}>
            {selectedRowKeys.length} factura(s) seleccionada(s)
          </Text>
          <Button
            type="primary"
            size="small"
            icon={<CheckSquareOutlined />}
            loading={bulkLoading}
            onClick={handleBulkMarcarEnviadas}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Marcar como Enviadas
          </Button>
          <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>
            Deseleccionar
          </Button>
        </div>
      )}

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          loading={loading}
          size="middle"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (r) => ({
              disabled: r.status === 'voided' || r.status === 'written_off',
            }),
          }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/facturas/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} facturas`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin facturas' }}
        />
      </Card>

      {/* Void Modal */}
      <Modal
        title="Anular factura"
        open={voidModal}
        onCancel={() => { setVoidModal(false); setVoidReason(''); setVoidTarget(null) }}
        onOk={handleVoid}
        okText="Anular"
        okButtonProps={{ danger: true, loading: voidLoading, disabled: !voidReason.trim() }}
        cancelText="Cancelar"
      >
        <p>
          Â¿Estás seguro de anular la factura <strong>{voidTarget?.invoiceNumber}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <Form layout="vertical">
          <Form.Item label="Motivo de anulación" required>
            <Input.TextArea
              rows={3}
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="Ingresa el motivo..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

