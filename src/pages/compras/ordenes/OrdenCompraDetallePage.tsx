import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Tag, Table, Divider, Spin, message,
  Modal, Form, Input, Alert, Popconfirm, Select,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, SendOutlined,
  CheckCircleOutlined, FileTextOutlined, DeleteOutlined, UploadOutlined, InboxOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPurchaseOrder, sendPurchaseOrder, approvePurchaseOrder, deletePurchaseOrder,
  recibirPurchaseOrder, attachPoFile, PO_STATUS_CONFIG, type PurchaseOrder,
} from '../../../api/compras'
import { getUbicaciones, type Ubicacion } from '../../../api/expedientes'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'
import { getEmailTemplates, getDefaultEmailTemplate, replaceVars, type EmailTemplate } from '../../../api/emailTemplates'

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
  const [receiving,   setReceiving]   = useState(false)
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [showReceive, setShowReceive] = useState(false)
  const [destino,     setDestino]     = useState<string | undefined>()
  const [showSend,    setShowSend]    = useState(false)
  const [sendForm]  = Form.useForm()
  const [uploadingFile,      setUploadingFile]      = useState(false)
  const [emailTemplates,     setEmailTemplates]     = useState<EmailTemplate[]>([])
  const [selectedEmailTplId, setSelectedEmailTplId] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  useEffect(() => { getUbicaciones().then(r => setUbicaciones(Array.isArray(r) ? r : [])).catch(() => setUbicaciones([])) }, [])

  const applyEmailTemplate = (tplId: string | undefined, tpls: EmailTemplate[], currentPo: PurchaseOrder, currentCompany: OrganizationProfile) => {
    const tpl = tpls.find(t => t.id === tplId)
    if (!tpl) return
    const vars: Record<string, string> = {
      nombreCliente: currentPo.vendorName ?? '',
      numeroFactura: currentPo.orderNumber ?? '',
      total:         `${currentPo.currency ?? 'GTQ'} ${Number(currentPo.total ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
      saldo:         '',
      fecha:         currentPo.orderDate ? new Date(currentPo.orderDate + 'T12:00:00').toLocaleDateString('es-GT') : '',
      nombreEmpresa: currentCompany.name ?? '',
      moneda:        currentPo.currency ?? 'GTQ',
    }
    sendForm.setFieldsValue({ subject: replaceVars(tpl.subject, vars), message: replaceVars(tpl.message, vars) })
  }

  const handleSend = async () => {
    try { await sendForm.validateFields() } catch { return }
    setSending(true)
    try {
      const { to, subject, message: msg } = sendForm.getFieldsValue()
      await sendPurchaseOrder(po!.id, { to, subject, message: msg })
      message.success(`Orden enviada a ${to}`)
      setShowSend(false); sendForm.resetFields(); loadPO()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al enviar') }
    finally { setSending(false) }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !po) return
    setUploadingFile(true)
    try {
      await attachPoFile(po.id, file, po)
      message.success(`Archivo "${file.name}" adjuntado`)
      loadPO()
    } catch { message.error('Error al cargar el archivo') }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = '' }
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

  const handleReceive = async () => {
    setReceiving(true)
    try {
      const res = await recibirPurchaseOrder(po!.id, destino)
      message.success(`Mercadería recibida: ${res.lineas} artículo(s) ingresado(s) a inventario`)
      setShowReceive(false)
      loadPO()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al recibir la mercadería') }
    finally { setReceiving(false) }
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
  const canReceive = po.status === 'sent'
  const canConvert = ['sent', 'received'].includes(po.status)

  const ribbonColors: Record<string, string> = {
    draft: '#6b7280', sent: '#1faec2', received: '#06b6d4',
    billed: '#6b7280', cancelled: '#e5484d',
  }
  const ribbonColor = ribbonColors[po.status] ?? '#6b7280'

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
    { title: 'Precio', dataIndex: 'unitPrice', width: 130, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</Text> },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'center' as const, render: (v: number) => <Tag>{v ?? 12}%</Tag> },
    {
      title: 'Total línea', dataIndex: 'lineTotal', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontSize: 13 }}>{fmtQ(v)}</Text>,
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
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
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
          <Button icon={<SendOutlined />} onClick={() => {
            const tpls = getEmailTemplates().filter(t => t.documentType === 'orden_compra')
            const defTpl = tpls.find(t => t.isDefault) ?? tpls[0] ?? getDefaultEmailTemplate('orden_compra')
            setEmailTemplates(tpls)
            setSelectedEmailTplId(defTpl?.id)
            sendForm.resetFields()
            if (defTpl && po) applyEmailTemplate(defTpl.id, tpls.length ? tpls : getEmailTemplates(), po, company)
            setShowSend(true)
          }}>
            Enviar al proveedor
          </Button>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={approving} onClick={handleApprove}
            style={{ background: '#06b6d4', borderColor: '#06b6d4' }}>
            Aprobar OC
          </Button>
        )}
        {canReceive && (
          <Button icon={<InboxOutlined />} loading={receiving}
            onClick={() => { setDestino(undefined); setShowReceive(true) }}
            style={{ background: '#2ea172', borderColor: '#2ea172', color: '#fff' }}>
            Recibir mercadería
          </Button>
        )}
        {canConvert && (
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleConvert}
            style={{ background: '#1faec2', borderColor: '#1faec2' }}>
            Convertir a factura proveedor
          </Button>
        )}
        {(canEdit || po.status === 'cancelled') && (
          <Popconfirm title="¿Eliminar esta orden de compra?" onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        )}
        <Divider type="vertical" />
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUploadFile} />
        <Button icon={<UploadOutlined />} loading={uploadingFile} onClick={() => fileInputRef.current?.click()}>
          Cargar archivo
        </Button>
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
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{company.name}</Title>
            {company.address && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{company.address}</Text>}
            {(company.city || company.country) && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {company.taxId && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>NIT: {company.taxId}</Text>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 240 }}>
            <Title level={3} style={{ margin: '0 0 12px', color: '#0a0a0a' }}>Orden de Compra</Title>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Total estimado
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>
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
            <Text strong style={{ fontSize: 15, color: '#1faec2', display: 'block' }}>{po.vendorName}</Text>
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
                  <td style={{ color: '#6b7280', paddingBottom: 6, width: '50%' }}>Número OC</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{po.orderNumber}</Text>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280', paddingBottom: 6 }}>Fecha</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(po.orderDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {po.expectedDeliveryDate && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Entrega esperada</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong>{dayjs(po.expectedDeliveryDate).format('DD MMM YYYY')}</Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#6b7280', paddingBottom: 6 }}>Moneda</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>{po.currency}</Text></td>
                </tr>
                {po.paymentTerms && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Términos de pago</td>
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
            style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA estimado</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(calcTax, po.currency)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 14, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(po.total) || calcTotal, po.currency)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── Más información ─────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px 28px', background: '#fafbfc' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° Orden de compra</Text>
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{po.orderNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            <Text type="secondary">Moneda</Text><Text>{po.currency}</Text>
            <Text type="secondary">Creada</Text><Text>{dayjs(po.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
          </div>
        </div>
      </div>

      {/* ── Modal enviar ─────────────────────────────────────────────────── */}
      <Modal title={<><SendOutlined /> Enviar OC {po.orderNumber} al proveedor</>} open={showSend}
        onCancel={() => { setShowSend(false); sendForm.resetFields() }}
        onOk={handleSend} confirmLoading={sending} okText="Enviar"
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={520}
      >
        <Form form={sendForm} layout="vertical" style={{ marginTop: 8 }}>
          {emailTemplates.length > 0 && (
            <Form.Item label="Plantilla de correo" style={{ marginBottom: 12 }}>
              <Select
                value={selectedEmailTplId}
                onChange={id => { setSelectedEmailTplId(id); applyEmailTemplate(id, emailTemplates, po, company) }}
                options={emailTemplates.map(t => ({ label: t.name, value: t.id }))}
                placeholder="Seleccionar plantilla"
              />
            </Form.Item>
          )}
          <Form.Item name="to" label="Correo del proveedor"
            rules={[{ required: true, message: 'El correo es requerido' }, { type: 'email', message: 'Correo inválido' }]}>
            <Input placeholder="proveedor@empresa.com" />
          </Form.Item>
          <Form.Item name="subject" label="Asunto">
            <Input />
          </Form.Item>
          <Form.Item name="message" label="Mensaje adicional">
            <Input.TextArea rows={3} placeholder="Mensaje personalizado (opcional)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={showReceive}
        title={`Recibir mercadería · ${po.orderNumber}`}
        onCancel={() => setShowReceive(false)}
        onOk={handleReceive}
        okText="Recibir" cancelText="Cancelar"
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
