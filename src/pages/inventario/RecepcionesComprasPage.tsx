import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Typography, Tag, Button, Modal, Select, message, Alert } from 'antd'
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getPurchaseOrders, recibirPurchaseOrder, type PurchaseOrder } from '../../api/compras'
import { getUbicaciones, type Ubicacion } from '../../api/expedientes'

const { Title, Text } = Typography
const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur} ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

/**
 * Recepciones de compra (Bodega) — lista las órdenes de compra enviadas (estado
 * 'sent') pendientes de ingresar a inventario. Al recibir se elige el almacén /
 * ubicación destino y se genera el ingreso de producto (movimiento entrada_compra)
 * que suma stock y recalcula el costo promedio. Es la puerta de Bodega al mismo
 * flujo que el botón de la OC.
 */
export default function RecepcionesComprasPage() {
  const navigate = useNavigate()
  const [rows,        setRows]        = useState<PurchaseOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [target,      setTarget]      = useState<PurchaseOrder | null>(null)
  const [destino,     setDestino]     = useState<string | undefined>()
  const [receiving,   setReceiving]   = useState(false)

  const load = () => {
    setLoading(true)
    getPurchaseOrders({ status: 'sent', limit: 200 })
      .then(r => setRows(r.data ?? []))
      .catch(() => message.error('No se pudieron cargar las órdenes pendientes de recibir'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  useEffect(() => { getUbicaciones().then(r => setUbicaciones(Array.isArray(r) ? r : [])).catch(() => setUbicaciones([])) }, [])

  const openReceive = (po: PurchaseOrder) => { setTarget(po); setDestino(undefined) }

  const confirmReceive = async () => {
    if (!target) return
    setReceiving(true)
    try {
      const res = await recibirPurchaseOrder(target.id, destino)
      message.success(`Mercadería recibida: ${res.lineas} artículo(s) ingresado(s) a inventario`)
      setTarget(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al recibir la mercadería')
    } finally {
      setReceiving(false)
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
      title: 'Acción', width: 150, align: 'right' as const,
      render: (_: any, po: PurchaseOrder) => (
        <Button size="small" icon={<InboxOutlined />} onClick={() => openReceive(po)}
          style={{ background: '#2ea172', borderColor: '#2ea172', color: '#fff' }}>
          Recibir
        </Button>
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
        scroll={{ y: 'calc(100vh - 330px)' }}
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'No hay órdenes de compra pendientes de recibir' }}
        size="middle"
      />

      <Modal
        open={!!target}
        title={`Recibir mercadería · ${target?.orderNumber ?? ''}`}
        onCancel={() => setTarget(null)}
        onOk={confirmReceive}
        okText="Recibir"
        cancelText="Cancelar"
        confirmLoading={receiving}
        okButtonProps={{ style: { background: '#2ea172', borderColor: '#2ea172' } }}
      >
        <p style={{ marginTop: 0 }}>
          Se ingresarán los artículos inventariables al stock y se recalculará el costo promedio.
        </p>
        <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Almacén / ubicación destino</div>
        <Select
          allowClear showSearch optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="¿A qué almacén / ubicación entra? (opcional)"
          value={destino}
          onChange={setDestino}
          options={ubicaciones.map(u => ({ value: u.id, label: u.name }))}
        />
        <div style={{ fontSize: 11, color: '#8b9aa8', marginTop: 6 }}>
          Si no eliges ubicación, entra al stock general. Elegir el almacén permite monitorear el movimiento por almacén.
        </div>
      </Modal>
    </div>
  )
}
