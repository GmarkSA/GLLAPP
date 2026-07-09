import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Space, Typography, Tag,
  Select, message, Popconfirm, Tooltip, Modal, Descriptions,
} from 'antd'
import {
  ReloadOutlined, StopOutlined, BookOutlined, WalletOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { getVendorAdvances, voidVendorAdvance, type VendorAdvance } from '../../../api/compras'

const { Text, Title } = Typography

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  open:    'blue',
  partial: 'orange',
  applied: 'green',
  voided:  'red',
}

const STATUS_LABEL: Record<string, string> = {
  open:    'Abierto',
  partial: 'Parcial',
  applied: 'Aplicado',
  voided:  'Anulado',
}

export default function AnticiposProveedorPage() {
  const [data,    setData]    = useState<VendorAdvance[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [page,    setPage]    = useState(1)
  const [status,  setStatus]  = useState<string | undefined>()
  const [voiding, setVoiding] = useState<string | null>(null)
  const [detail,  setDetail]  = useState<VendorAdvance | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVendorAdvances({ page, limit: 50, status })
      setData(res.data)
      setTotal(res.total)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const handleVoid = async (id: string) => {
    setVoiding(id)
    try {
      await voidVendorAdvance(id)
      message.success('Anticipo anulado correctamente')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al anular')
    } finally {
      setVoiding(null)
    }
  }

  const columns: ColumnsType<VendorAdvance> = [
    {
      title: 'Número', dataIndex: 'advanceNumber', width: 160,
      render: (v) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true,
      render: (v) => <Text>{v ?? <Text type="secondary">Sin proveedor</Text>}</Text>,
    },
    {
      title: 'Fecha', dataIndex: 'advanceDate', width: 115,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Monto', dataIndex: 'amount', width: 140, align: 'right',
      render: (v, r) => <Text style={{ fontFamily: 'monospace' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 140, align: 'right',
      render: (v, r) => (
        <Text strong style={{ fontFamily: 'monospace', color: Number(v) > 0 ? '#d46b08' : '#52c41a' }}>
          {fmtQ(v, r.currency)}
        </Text>
      ),
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      key: 'actions', width: 100, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<BookOutlined />} onClick={() => setDetail(r)} />
          </Tooltip>
          {r.status !== 'voided' && r.status !== 'applied' && (
            <Popconfirm
              title="¿Anular anticipo?"
              description="Se creará un asiento de reverso contable."
              okText="Anular"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleVoid(r.id)}
            >
              <Tooltip title="Anular">
                <Button size="small" danger icon={<StopOutlined />} loading={voiding === r.id} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <WalletOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Anticipos a Proveedores</Title>
            <Text type="secondary">Prepagos y anticipos registrados a proveedores</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
          Actualizar
        </Button>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Select
          placeholder="Estado"
          allowClear
          value={status}
          onChange={v => { setStatus(v); setPage(1) }}
          style={{ width: 150 }}
          options={[
            { value: 'open',    label: 'Abierto' },
            { value: 'partial', label: 'Parcial' },
            { value: 'applied', label: 'Aplicado' },
            { value: 'voided',  label: 'Anulado' },
          ]}
        />
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          rowClassName={(r) => r.status === 'voided' ? 'row-void' : ''}
          pagination={{
            total,
            current: page,
            pageSize: 50,
            onChange: setPage,
            showTotal: t => `${t} anticipos`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin anticipos registrados' }}
        />
      </Card>

      <Modal
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        title={`Anticipo ${detail?.advanceNumber}`}
        width={520}
      >
        {detail && (
          <Descriptions column={2} size="small" bordered style={{ marginTop: 8 }}>
            <Descriptions.Item label="Proveedor" span={2}>{detail.vendorName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Fecha">{dayjs(detail.advanceDate).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Estado">
              <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Monto">{fmtQ(detail.amount, detail.currency)}</Descriptions.Item>
            <Descriptions.Item label="Saldo">{fmtQ(detail.balance, detail.currency)}</Descriptions.Item>
            {detail.advanceAccountCode && (
              <Descriptions.Item label="Cuenta anticipo" span={2}>
                {detail.advanceAccountCode} — {detail.advanceAccountName}
              </Descriptions.Item>
            )}
            {detail.reference && (
              <Descriptions.Item label="Referencia" span={2}>{detail.reference}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      <style>{`
        .row-void td { opacity: 0.45; text-decoration: line-through; }
      `}</style>
    </div>
  )
}
