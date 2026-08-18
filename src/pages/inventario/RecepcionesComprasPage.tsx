import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Typography, Tag, Button, Popconfirm, message, Alert } from 'antd'
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getPurchaseOrders, recibirPurchaseOrder, type PurchaseOrder } from '../../api/compras'

const { Title, Text } = Typography
const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur} ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

/**
 * Recepciones de compra (Bodega) — lista las órdenes de compra enviadas (estado
 * 'sent') pendientes de ingresar a inventario. Al recibir, se genera el ingreso
 * de producto (movimiento entrada_compra) que suma stock y recalcula el costo
 * promedio. Es la puerta de Bodega al mismo flujo que el botón de la OC.
 */
export default function RecepcionesComprasPage() {
  const navigate = useNavigate()
  const [rows,        setRows]        = useState<PurchaseOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [receivingId, setReceivingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getPurchaseOrders({ status: 'sent', limit: 200 })
      .then(r => setRows(r.data ?? []))
      .catch(() => message.error('No se pudieron cargar las órdenes pendientes de recibir'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleReceive = async (po: PurchaseOrder) => {
    setReceivingId(po.id)
    try {
      const res = await recibirPurchaseOrder(po.id)
      message.success(`Mercadería recibida: ${res.lineas} artículo(s) ingresado(s) a inventario`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al recibir la mercadería')
    } finally {
      setReceivingId(null)
    }
  }

  const columns = [
    {
      title: 'Orden', dataIndex: 'orderNumber', width: 150,
      render: (v: string, po: PurchaseOrder) => (
        <a onClick={() => navigate(`/compras/ordenes/${po.id}`)} style={{ color: '#1faec2', fontWeight: 600 }}>{v}</a>
      ),
    },
    { title: 'Proveedor', dataIndex: 'vendorName', render: (v: string) => <Text>{v || '—'}</Text> },
    {
      title: 'Fecha', dataIndex: 'orderDate', width: 120,
      render: (v: string) => <Text type="secondary">{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</Text>,
    },
    {
      title: 'Artículos', dataIndex: 'items', width: 90, align: 'center' as const,
      render: (items: any[]) => <Tag>{Array.isArray(items) ? items.filter(i => i.productId).length : 0}</Tag>,
    },
    {
      title: 'Total', dataIndex: 'total', width: 150, align: 'right' as const,
      render: (v: number, po: PurchaseOrder) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v, po.currency)}</Text>
      ),
    },
    {
      title: 'Acción', width: 180, align: 'right' as const,
      render: (_: any, po: PurchaseOrder) => (
        <Popconfirm
          title="Recibir mercadería"
          description="Ingresa los artículos inventariables al stock (actualiza existencia y costo promedio). ¿Continuar?"
          okText="Recibir" cancelText="Cancelar"
          onConfirm={() => handleReceive(po)}
        >
          <Button size="small" icon={<InboxOutlined />} loading={receivingId === po.id}
            style={{ background: '#2ea172', borderColor: '#2ea172', color: '#fff' }}>
            Recibir
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Recepciones de compra</Title>
          <Text type="secondary">Órdenes de compra enviadas, pendientes de ingresar a inventario (Bodega)</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>Actualizar</Button>
      </div>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Al recibir, se genera el ingreso de producto (movimiento de entrada) que suma existencia y recalcula el costo promedio. La factura del proveedor se registra por separado desde Compras."
      />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'No hay órdenes de compra pendientes de recibir' }}
        size="middle"
      />
    </div>
  )
}
