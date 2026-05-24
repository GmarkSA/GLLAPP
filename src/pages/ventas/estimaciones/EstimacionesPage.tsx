import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Dropdown, Modal, message, Tabs, Popconfirm,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileOutlined, MoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getEstimates, deleteEstimate, convertEstimate,
  ESTIMATE_STATUS_CONFIG, type Estimate, type EstimateStatus,
} from '../../../api/facturas'

const { Title, Text } = Typography

const fmt = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_TABS = [
  { key: 'all',      label: 'Todos'     },
  { key: 'draft',    label: 'Borrador'  },
  { key: 'sent',     label: 'Enviada'   },
  { key: 'accepted', label: 'Aceptada'  },
  { key: 'declined', label: 'Rechazada' },
  { key: 'invoiced', label: 'Facturada' },
  { key: 'expired',  label: 'Vencida'   },
]

export default function EstimacionesPage() {
  const navigate = useNavigate()
  const [estimates, setEstimates]     = useState<Estimate[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [statusTab, setStatusTab]     = useState('all')

  // Convert confirmation modal
  const [convertModal, setConvertModal] = useState(false)
  const [convertTarget, setConvertTarget] = useState<Estimate | null>(null)
  const [convertLoading, setConvertLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const fetchEstimates = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusTab !== 'all') params.status = statusTab
      const res = await getEstimates(params)
      setEstimates(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando cotizaciones')
      setEstimates([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => { fetchEstimates() }, [fetchEstimates])

  const handleDelete = async (id: string) => {
    try {
      await deleteEstimate(id)
      message.success('Cotización eliminada')
      fetchEstimates()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const openConvert = (est: Estimate) => { setConvertTarget(est); setConvertModal(true) }

  const handleConvert = async () => {
    if (!convertTarget) return
    setConvertLoading(true)
    try {
      const invoice = await convertEstimate(convertTarget.id)
      message.success('Cotización convertida a factura exitosamente')
      setConvertModal(false); setConvertTarget(null)
      navigate(`/ventas/facturas/${invoice.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo convertir')
    } finally {
      setConvertLoading(false)
    }
  }

  const columns: ColumnsType<Estimate> = [
    {
      title: '# Cotización',
      dataIndex: 'estimateNumber',
      width: 140,
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
      dataIndex: 'estimateDate',
      width: 105,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Vence',
      dataIndex: 'expiryDate',
      width: 105,
      render: (v: string, r) => {
        if (!v) return '—'
        const isExpired = r.status === 'expired'
        return <span style={{ color: isExpired ? '#ff4d4f' : undefined }}>{dayjs(v).format('DD/MM/YYYY')}</span>
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
      title: 'Estado',
      dataIndex: 'status',
      width: 120,
      render: (v: EstimateStatus) => {
        const cfg = ESTIMATE_STATUS_CONFIG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '',
      width: 50,
      render: (_, r) => {
        const canEdit    = r.status === 'draft' || r.status === 'sent'
        const canConvert = r.status !== 'invoiced' && r.status !== 'declined'
        const items: any[] = [
          { key: 'view', label: 'Ver' },
        ]
        if (canEdit) items.push({ key: 'edit', label: 'Editar' })
        if (canConvert) items.push({ key: 'convert', label: 'Convertir a Factura' })
        items.push({ type: 'divider' })
        items.push({ key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Eliminar</span> })

        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view')    navigate(`/ventas/estimaciones/${r.id}`)
                if (key === 'edit')    navigate(`/ventas/estimaciones/${r.id}/editar`)
                if (key === 'convert') openConvert(r)
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
          <FileOutlined style={{ fontSize: 24, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Cotizaciones</Title>
            <Text type="secondary">Propuestas y estimaciones enviadas a clientes</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/ventas/estimaciones/nueva')}
          style={{ background: '#1B3A6B' }}
        >
          Nueva cotización
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
                placeholder="Buscar cotización, cliente..."
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
          dataSource={estimates}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/estimaciones/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} cotizaciones`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin cotizaciones — crea la primera con el botón "Nueva cotización"' }}
        />
      </Card>

      {/* Convert Modal */}
      <Modal
        title="Convertir a Factura"
        open={convertModal}
        onCancel={() => { setConvertModal(false); setConvertTarget(null) }}
        onOk={handleConvert}
        okText="Convertir"
        okButtonProps={{ loading: convertLoading, style: { background: '#1B3A6B' } }}
        cancelText="Cancelar"
      >
        <p>
          Â¿Convertir la cotización <strong>{convertTarget?.estimateNumber}</strong> a factura de venta?
        </p>
        <p style={{ color: '#8c8c8c', fontSize: 13 }}>
          Se creará una nueva factura con los mismos ítems y montos. La cotización quedará marcada como <em>Facturada</em>.
        </p>
      </Modal>
    </div>
  )
}

