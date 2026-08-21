import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  message, Tabs, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getCreditNotes, voidBill, deleteBill,
  BILL_STATUS_CONFIG,
  type PurchaseInvoice, type BillStatus,
} from '../../../api/compras'

const { Title, Text } = Typography

const fmtGTQ = (x: number | string) =>
  `Q ${Number(x).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_TABS = [
  { key: 'all',     label: 'Todas'    },
  { key: 'draft',   label: 'Borrador' },
  { key: 'open',    label: 'Abierta'  },
  { key: 'voided',  label: 'Anulada'  },
]

export default function NotasCreditoProveedorPage() {
  const navigate = useNavigate()
  const [data,      setData]      = useState<PurchaseInvoice[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page,      setPage]      = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (search)               params.search = search
      if (statusTab !== 'all')  params.status = statusTab
      const res = await getCreditNotes(params)
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('Error cargando notas de crédito')
      setData([]); setTotal(0)
    } finally { setLoading(false) }
  }, [page, search, statusTab])

  useEffect(() => { load() }, [load])

  const handleVoid = async (r: PurchaseInvoice) => {
    try {
      await voidBill(r.id)
      message.success('Nota de crédito anulada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo anular') }
  }

  const handleDelete = async (id: string) => {
    try { await deleteBill(id); message.success('Eliminada'); load() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const columns: ColumnsType<PurchaseInvoice> = [
    {
      title: '# Nota', dataIndex: 'invoiceNumber', width: 150, fixed: 'left',
      render: (v: string) => <Text strong style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '# Doc. Proveedor', dataIndex: 'vendorInvoiceNumber', width: 150,
      render: (v: string) => v
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Proveedor', width: 210,
      render: (_: any, r: PurchaseInvoice) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.vendorName}</div>
          {r.vendorTaxId && <Text type="secondary" style={{ fontSize: 11 }}>NIT: {r.vendorTaxId}</Text>}
        </div>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'invoiceDate', width: 105,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Serie FEL', dataIndex: 'felSerie', width: 90,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'No. SAT', dataIndex: 'felNumber', width: 110,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Monto', dataIndex: 'total', width: 130, align: 'right',
      render: (v: number, r: PurchaseInvoice) => {
        const cur = r.currency ?? 'GTQ'
        if (cur !== 'GTQ' && Number(r.exchangeRate) > 1) {
          return (
            <div style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 13, color: '#e5484d', fontWeight: 700 }}>
                {cur} {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                Q {(Number(v) * Number(r.exchangeRate)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )
        }
        return <Text strong style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(v)}</Text>
      },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: BillStatus) => {
        const cfg = BILL_STATUS_CONFIG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      key: 'actions', width: 130, align: 'center', fixed: 'right',
      render: (_: any, r: PurchaseInvoice) => (
        <Space size={4}>
          <Tooltip title="Ver / Editar">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/compras/notas-credito-proveedor/${r.id}`)} />
          </Tooltip>
          {r.status !== 'voided' && (
            <Tooltip title="Anular">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => handleVoid(r)} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 24, color: '#e5484d' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Notas de Crédito — Proveedor</Title>
            <Text type="secondary">Documentos que reducen saldo a pagar a proveedor</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/compras/notas-credito-proveedor/nueva')}
          style={{ background: '#e5484d', borderColor: '#e5484d' }}
        >
          Nueva nota de crédito
        </Button>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 0, position: 'sticky', top: 60, zIndex: 5 }}
        bodyStyle={{ padding: '12px 16px 0' }}
      >
        <Tabs
          activeKey={statusTab}
          onChange={k => { setStatusTab(k); setPage(1) }}
          items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <div style={{ paddingBottom: 8 }}>
              <Input
                placeholder="Buscar número, proveedor, serie FEL..."
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                style={{ width: 260 }}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                allowClear
                size="small"
              />
            </div>
          }
        />
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: '0 0 10px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1050, y: 'calc(100vh - 312px)' }}
          onRow={r => ({ onDoubleClick: () => navigate(`/compras/notas-credito-proveedor/${r.id}`) })}
          rowClassName={r => r.status === 'voided' ? 'row-void' : ''}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: t => `${t} notas de crédito`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin notas de crédito de proveedor' }}
        />
      </Card>

      <style>{`.row-void td { opacity: 0.45; text-decoration: line-through; }`}</style>
    </div>
  )
}
