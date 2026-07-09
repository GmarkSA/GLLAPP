import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Tag, Table, Divider, Spin, message,
  Modal, Form, Input, Alert, Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, SendOutlined,
  CheckCircleOutlined, FileTextOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPurchaseOrder, sendPurchaseOrder, approvePurchaseOrder, deletePurchaseOrder,
  PO_STATUS_CONFIG, type PurchaseOrder,
} from '../../../api/compras'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const fmtQ   = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: number, cur = 'GTQ') => `${cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function OrdenCompraDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [po,          setPo]          = useState<PurchaseOrder | null>(null)
  const [company,     setCompany]     = useState<OrganizationProfile>({ name: '' })
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [showSend,    setShowSend]    = useState(false)
  const [sendForm]  = Form.useForm()

  const loadPO = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, org] = await Promise.all([
        getPurchaseOrder(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setPo(data)
      setCompany(org)
    } catch { message.error('No se pudo cargar la orden de compra') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadPO() }, [loadPO])

  const handleSend = async () => {
    try { await sendForm.validateFields() } catch { return }
    setSending(true)
    try {
      const { to } = sendForm.getFieldsValue()
      await sendPurchaseOrder(po!.id, { to })
      message.success(`Orden enviada a ${to}`)
      setShowSend(false); sendForm.resetFields(); loadPO()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al enviar') }
    finally { setSending(false) }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await approvePurchaseOrder(po!.id)
      message.success('Orden de compra aprobada')
      loadPO()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al aprobar') }
    finally { setApproving(false) }
  }

  const handleDelete = async () => {
    try { await deletePurchaseOrder(po!.id); message.success('Orden eliminada'); navigate('/compras/ordenes') }
    catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  const handleConvert = () => {
    if (!po) return
    navigate('/compras/facturas/nueva', {
      state: {
        fromPO: {
          purchaseOrderId: po.id,
          vendorId:        po.vendorId,
          vendorName:      po.vendorName,
          items:           po.items ?? [],
        },
      },
    })
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!po)     return <div style={{ padding: 40 }}><Text>Orden de compra no encontrada</Text></div>

  const statusCfg  = PO_STATUS_CONFIG[po.status] ?? { label: po.status, color: 'default' }
  const canEdit    = ['draft'].includes(po.status)
  const canSend    = ['draft', 'received'].includes(po.status)
  const canApprove = po.status === 'draft'
  const canConvert = ['sent', 'received'].includes(po.status)

  const ribbonColors: Record<string, string> = {
    draft: '#8c8c8c', sent: '#1890ff', received: '#06b6d4',
    billed: '#722ed1', cancelled: '#ff4d4f',
  }
  const ribbonColor = ribbonColors[po.status] ?? '#8c8c8c'

  const itemColumns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text> },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v: string, row: any) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {row.unit && <Text type="secondary" style={{ fontSize: 11 }}>{row.unit}</Text>}
        </div>
      ),
    },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Precio', dataIndex: 'unitPrice', width: 130, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</Text> },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'center' as const, render: (v: number) => <Tag>{v ?? 12}%</Tag> },
    {
      title: 'Total línea', dataIndex: 'lineTotal', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 13 }}>{fmtQ(v)}</Text>,
    },
  ]

  const calcTotal = (po.items ?? []).reduce((s, it) => s + Number(it.lineTotal ?? 0), 0)
  const calcTax   = (po.items ?? []).reduce((s, it) => {
    const base = Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1)
    return s + base * Number(it.taxPercent ?? 12) / 100
  }, 0)

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/compras/ordenes')}>
          Órdenes de compra
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        <Divider type="vertical" />
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/compras/ordenes/${po.id}/editar`)}>
            Editar
          </Button>
        )}
        {canSend && (
          <Button icon={<SendOutlined />} onClick={() => { sendForm.resetFields(); setShowSend(true) }}>
            Enviar al proveedor
          </Button>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={approving} onClick={handleApprove}
            style={{ background: '#06b6d4', borderColor: '#06b6d4' }}>
            Aprobar OC
          </Button>
        )}
        {canConvert && (
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleConvert}
            style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}>
            Convertir a factura proveedor
          </Button>
        )}
        {(canEdit || po.status === 'cancelled') && (
          <Popconfirm title="¿Eliminar esta orden de compra?" onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        )}
      </div>

      {/* ── Alerta borrador ─────────────────────────────────────────────────── */}
      {po.status === 'draft' && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Esta orden está en borrador. Apruébala o envíala al proveedor para continuar." />
      )}

      {/* ── Documento ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', position: 'relative' }}>

        {/* Ribbon */}
        <div style={{
          position: 'absolute', top: 18, left: -28, width: 120, textAlign: 'center',
          background: ribbonColor, color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 0', transform: 'rotate(-45deg)', letterSpacing: 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 1, textTransform: 'uppercase',
        }}>
          {statusCfg.label}
        </div>

        {/* Cabecera */}
        <div style={{ padding: '32px 40px 24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24 }}>
          <div>
            {company.logoUrl && (
              <img src={company.logoUrl} alt="logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain', marginBottom: 12 }} />
            )}
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{company.name}</Title>
            {company.address && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{company.address}</Text>}
            {(company.city || company.country) && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {company.taxId && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>NIT: {company.taxId}</Text>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 240 }}>
            <Title level={3} style={{ margin: '0 0 12px', color: '#1B3A6B' }}>Orden de Compra</Title>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Total estimado
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#1B3A6B' }}>
                {fmtGTQ(Number(po.total) || calcTotal, po.currency)}
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Proveedor + Metadatos */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Orden a
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1B3A6B', display: 'block' }}>{po.vendorName}</Text>
            {po.notes && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Notas</Text>
                <Text style={{ fontSize: 12 }}>{po.notes}</Text>
              </div>
            )}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, width: '50%' }}>Número OC</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{po.orderNumber}</Text>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Fecha</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(po.orderDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {po.expectedDeliveryDate && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Entrega esperada</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong>{dayjs(po.expectedDeliveryDate).format('DD MMM YYYY')}</Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Moneda</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>{po.currency}</Text></td>
                </tr>
                {po.paymentTerms && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Términos de pago</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text>{po.paymentTerms}</Text></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table columns={itemColumns} dataSource={po.items ?? []} rowKey={(_, i) => String(i)}
            pagination={false} size="small" scroll={{ x: 620 }}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA estimado</Text>
                <Text style={{ fontFamily: 'monospace' }}>{fmtGTQ(calcTax, po.currency)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 14, color: '#1B3A6B', fontFamily: 'monospace' }}>{fmtGTQ(Number(po.total) || calcTotal, po.currency)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── Más información ─────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px 28px', background: '#fafafa' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° Orden de compra</Text>
            <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{po.orderNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            <Text type="secondary">Moneda</Text><Text>{po.currency}</Text>
            <Text type="secondary">Creada</Text><Text>{dayjs(po.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
          </div>
        </div>
      </div>

      {/* ── Modal enviar ─────────────────────────────────────────────────── */}
      <Modal title={`Enviar OC ${po.orderNumber} al proveedor`} open={showSend}
        onCancel={() => { setShowSend(false); sendForm.resetFields() }}
        onOk={handleSend} confirmLoading={sending} okText="Enviar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}>
        <Form form={sendForm} layout="vertical">
          <Form.Item name="to" label="Correo del proveedor"
            rules={[{ required: true, message: 'El correo es requerido' }, { type: 'email', message: 'Correo inválido' }]}>
            <Input placeholder="proveedor@empresa.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
