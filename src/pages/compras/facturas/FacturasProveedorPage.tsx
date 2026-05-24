import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Modal, Form, InputNumber, DatePicker, Select,
  message, Tabs,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ShopOutlined, MoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getBills, deleteBill, voidBill, recordBillPayment,
  BILL_STATUS_CONFIG, type PurchaseInvoice, type BillStatus,
} from '../../../api/compras'

const { Title, Text } = Typography
const { Option } = Select

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Efectivo'              },
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'check',         label: 'Cheque'                },
  { value: 'credit_card',   label: 'Tarjeta de crédito'   },
  { value: 'debit_card',    label: 'Tarjeta de débito'     },
]

const STATUS_TABS = [
  { key: 'all',     label: 'Todos'        },
  { key: 'draft',   label: 'Borrador'     },
  { key: 'open',    label: 'Pendiente'    },
  { key: 'partial', label: 'Pago parcial' },
  { key: 'paid',    label: 'Pagada'       },
  { key: 'overdue', label: 'Vencida'      },
  { key: 'voided',  label: 'Anulada'      },
]

export default function FacturasProveedorPage() {
  const navigate = useNavigate()
  const [bills, setBills]             = useState<PurchaseInvoice[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [statusTab, setStatusTab]     = useState('all')

  // Void modal
  const [voidModal, setVoidModal]     = useState(false)
  const [voidTarget, setVoidTarget]   = useState<PurchaseInvoice | null>(null)
  const [voidReason, setVoidReason]   = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  // Pay modal
  const [payModal, setPayModal]       = useState(false)
  const [payTarget, setPayTarget]     = useState<PurchaseInvoice | null>(null)
  const [payLoading, setPayLoading]   = useState(false)
  const [payForm]                     = Form.useForm()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getBills(params)
      setBills(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando facturas de proveedor')
      setBills([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => { fetchBills() }, [fetchBills])

  const handleDelete = async (id: string) => {
    try {
      await deleteBill(id)
      message.success('Factura eliminada')
      fetchBills()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    setVoidLoading(true)
    try {
      await voidBill(voidTarget.id, voidReason)
      message.success('Factura anulada')
      setVoidModal(false); setVoidReason(''); setVoidTarget(null)
      fetchBills()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo anular')
    } finally {
      setVoidLoading(false)
    }
  }

  const handlePay = async () => {
    if (!payTarget) return
    try {
      const values = await payForm.validateFields()
      setPayLoading(true)
      await recordBillPayment(payTarget.id, {
        amount:      values.amount,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        mode:        values.mode,
        reference:   values.reference,
      })
      message.success('Pago registrado')
      setPayModal(false); payForm.resetFields(); setPayTarget(null)
      fetchBills()
    } catch (e: any) {
      if (e?.response) message.error(e?.response?.data?.message || 'No se pudo registrar el pago')
    } finally {
      setPayLoading(false)
    }
  }

  const openPay = (bill: PurchaseInvoice) => {
    setPayTarget(bill)
    payForm.setFieldsValue({
      amount:      bill.balance,
      paymentDate: dayjs(),
      mode:        'bank_transfer',
    })
    setPayModal(true)
  }

  const columns: ColumnsType<PurchaseInvoice> = [
    {
      title: '# Factura',
      dataIndex: 'invoiceNumber',
      width: 130,
      render: (v: string) => <Text strong style={{ color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: '# Fact. Proveedor',
      dataIndex: 'vendorInvoiceNumber',
      width: 145,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Proveedor',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vendorName}</div>
          {r.vendorTaxId && (
            <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.vendorTaxId}</Text>
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
      render: (v: BillStatus) => {
        const cfg = BILL_STATUS_CONFIG[v]
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
          { key: 'view', label: 'Ver' },
        ]
        if (isDraft) items.push({ key: 'edit', label: 'Editar' })
        if (!isPaid && !isVoided) items.push({ key: 'pay', label: 'Registrar pago' })
        if (!isVoided)            items.push({ key: 'void', label: 'Anular' })
        items.push({ type: 'divider' })
        items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span> })

        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')   navigate(`/compras/facturas/${r.id}`)
                if (key === 'edit')   navigate(`/compras/facturas/${r.id}/editar`)
                if (key === 'pay')    openPay(r)
                if (key === 'void')   { setVoidTarget(r); setVoidModal(true) }
                if (key === 'delete') handleDelete(r.id)
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShopOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Facturas de proveedor</Title>
            <Text type="secondary">Registro de facturas recibidas de proveedores</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/compras/facturas/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva factura proveedor
        </Button>
      </div>

      {/* Filters + Tabs */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0 }} bodyStyle={{ padding: '12px 16px 0' }}>
        <Tabs
          activeKey={statusTab}
          onChange={(k) => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar factura, proveedor..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 260 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                size="small"
              />
            </Space>
          }
        />
      </Card>

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={bills}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/facturas/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} facturas`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin facturas de proveedor' }}
        />
      </Card>

      {/* Void Modal */}
      <Modal
        title="Anular factura de proveedor"
        open={voidModal}
        onCancel={() => { setVoidModal(false); setVoidReason(''); setVoidTarget(null) }}
        onOk={handleVoid}
        okText="Anular"
        okButtonProps={{ danger: true, loading: voidLoading, disabled: !voidReason.trim() }}
        cancelText="Cancelar"
      >
        <p>
          Â¿Anular la factura <strong>{voidTarget?.invoiceNumber}</strong>? Esta acción no se puede deshacer.
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

      {/* Pay Modal */}
      <Modal
        title={`Registrar pago — ${payTarget?.invoiceNumber}`}
        open={payModal}
        onCancel={() => { setPayModal(false); payForm.resetFields(); setPayTarget(null) }}
        onOk={handlePay}
        okText="Registrar pago"
        okButtonProps={{ loading: payLoading, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
      >
        {payTarget && (
          <p style={{ color: '#8c8c8c', marginBottom: 16 }}>
            Saldo pendiente: <strong style={{ color: '#1B3A6B' }}>{fmt(payTarget.balance)}</strong>
          </p>
        )}
        <Form form={payForm} layout="vertical">
          <Form.Item name="amount" label="Monto" rules={[{ required: true, message: 'Ingresa el monto' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              step={0.01}
              prefix="Q"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true, message: 'Selecciona la fecha' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Forma de pago">
            <Select placeholder="Selecciona...">
              {PAYMENT_MODES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Referencia / No. documento">
            <Input placeholder="Número de transferencia, cheque..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

