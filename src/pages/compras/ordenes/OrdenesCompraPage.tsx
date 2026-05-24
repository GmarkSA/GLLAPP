import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Modal, message, Tabs,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ShoppingOutlined, MoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getPurchaseOrders, deletePurchaseOrder, approvePurchaseOrder,
  PO_STATUS_CONFIG, type PurchaseOrder, type POStatus,
} from '../../../api/compras'

const { Title, Text } = Typography

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_TABS = [
  { key: 'all',       label: 'Todos'     },
  { key: 'draft',     label: 'Borrador'  },
  { key: 'sent',      label: 'Enviada'   },
  { key: 'received',  label: 'Recibida'  },
  { key: 'billed',    label: 'Facturada' },
  { key: 'cancelled', label: 'Cancelada' },
]

export default function OrdenesCompraPage() {
  const navigate = useNavigate()
  const [orders, setOrders]           = useState<PurchaseOrder[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [statusTab, setStatusTab]     = useState('all')

  // Approve confirmation modal
  const [approveModal, setApproveModal] = useState(false)
  const [approveTarget, setApproveTarget] = useState<PurchaseOrder | null>(null)
  const [approveLoading, setApproveLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getPurchaseOrders(params)
      setOrders(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando órdenes de compra')
      setOrders([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleDelete = async (id: string) => {
    try {
      await deletePurchaseOrder(id)
      message.success('Orden eliminada')
      fetchOrders()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const handleApprove = async () => {
    if (!approveTarget) return
    setApproveLoading(true)
    try {
      await approvePurchaseOrder(approveTarget.id)
      message.success('Orden aprobada y enviada al proveedor')
      setApproveModal(false); setApproveTarget(null)
      fetchOrders()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo aprobar la orden')
    } finally {
      setApproveLoading(false)
    }
  }

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: '# OC',
      dataIndex: 'orderNumber',
      width: 130,
      render: (v: string) => <Text strong style={{ color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Proveedor',
      dataIndex: 'vendorName',
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Fecha',
      dataIndex: 'orderDate',
      width: 105,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Entrega esperada',
      dataIndex: 'expectedDeliveryDate',
      width: 150,
      render: (v: string) => {
        if (!v) return <Text type="secondary">—</Text>
        const isPast = dayjs(v).isBefore(dayjs(), 'day')
        return (
          <span style={{ color: isPast ? '#fa8c16' : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 140,
      align: 'right',
      render: (v) => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 120,
      render: (v: POStatus) => {
        const cfg = PO_STATUS_CONFIG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '',
      width: 50,
      render: (_, r) => {
        const isDraft      = r.status === 'draft'
        const isCancelled  = r.status === 'cancelled'
        const isBilled     = r.status === 'billed'
        const canApprove   = r.status === 'draft' || r.status === 'sent'
        const canEdit      = isDraft
        const items: any[] = [
          { key: 'view', label: 'Ver' },
        ]
        if (canEdit)    items.push({ key: 'edit', label: 'Editar' })
        if (canApprove) items.push({ key: 'approve', label: 'Aprobar' })
        if (!isCancelled && !isBilled) {
          items.push({ type: 'divider' })
          items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span> })
        }

        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')    navigate(`/compras/ordenes/${r.id}`)
                if (key === 'edit')    navigate(`/compras/ordenes/${r.id}/editar`)
                if (key === 'approve') { setApproveTarget(r); setApproveModal(true) }
                if (key === 'delete')  handleDelete(r.id)
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
          <ShoppingOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Órdenes de compra</Title>
            <Text type="secondary">Solicitudes de compra enviadas a proveedores</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/compras/ordenes/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva orden
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
                placeholder="Buscar OC, proveedor..."
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

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/ordenes/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} órdenes`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin órdenes de compra — crea la primera con "Nueva orden"' }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title="Aprobar orden de compra"
        open={approveModal}
        onCancel={() => { setApproveModal(false); setApproveTarget(null) }}
        onOk={handleApprove}
        okText="Aprobar"
        okButtonProps={{ loading: approveLoading, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
      >
        <p>
          Â¿Aprobar la orden <strong>{approveTarget?.orderNumber}</strong> por{' '}
          <strong>{approveTarget ? fmt(approveTarget.total) : ''}</strong>?
        </p>
        <p style={{ color: '#8c8c8c', fontSize: 13 }}>
          Al aprobar, la orden quedará marcada como <em>Enviada</em> y se notificará al proveedor{' '}
          <strong>{approveTarget?.vendorName}</strong>.
        </p>
      </Modal>
    </div>
  )
}

