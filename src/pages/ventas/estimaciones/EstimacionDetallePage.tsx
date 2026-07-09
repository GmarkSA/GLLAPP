import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Button, Space, Typography, Tag, Table, Divider,
  Spin, message, Modal, Form, Input, Popconfirm, Alert,
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, PrinterOutlined,
  EditOutlined, FileTextOutlined, DeleteOutlined, CopyOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getEstimate, sendEstimate, convertEstimate, duplicateEstimate, deleteEstimate,
  ESTIMATE_STATUS_CONFIG, type Estimate, type InvoiceItem,
} from '../../../api/facturas'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const fmtQ   = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: number) => `GTQ ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function EstimacionDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [est,       setEst]       = useState<Estimate | null>(null)
  const [company,   setCompany]   = useState<OrganizationProfile>({ name: '' })
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState(false)
  const [converting, setConverting] = useState(false)
  const [showSend,  setShowSend]  = useState(false)
  const [sendForm]  = Form.useForm()

  const loadEst = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, org] = await Promise.all([
        getEstimate(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setEst(data)
      setCompany(org)
    } catch { message.error('No se pudo cargar la cotización') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadEst() }, [loadEst])

  const handleSend = async () => {
    try { await sendForm.validateFields() } catch { return }
    setSending(true)
    try {
      const { to } = sendForm.getFieldsValue()
      await sendEstimate(est!.id, { to })
      message.success(`Cotización enviada a ${to}`)
      setShowSend(false); sendForm.resetFields(); loadEst()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al enviar') }
    finally { setSending(false) }
  }

  const handleConvert = async () => {
    if (!est) return
    setConverting(true)
    try {
      const invoice = await convertEstimate(est.id)
      message.success('Cotización convertida a factura')
      navigate(`/ventas/facturas/${(invoice as any).id}`)
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al convertir') }
    finally { setConverting(false) }
  }

  const handleDuplicate = async () => {
    if (!est) return
    try {
      const copy = await duplicateEstimate(est.id)
      message.success('Cotización duplicada')
      navigate(`/ventas/estimaciones/${(copy as any).id}`)
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al duplicar') }
  }

  const handleDelete = async () => {
    if (!est) return
    try {
      await deleteEstimate(est.id)
      message.success('Cotización eliminada')
      navigate('/ventas/estimaciones')
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!est)    return <div style={{ padding: 40 }}><Text>Cotización no encontrada</Text></div>

  const statusCfg = ESTIMATE_STATUS_CONFIG[est.status] ?? { label: est.status, color: 'default' }
  const isExpired = est.expiryDate && dayjs(est.expiryDate).isBefore(dayjs(), 'day') && est.status !== 'invoiced' && est.status !== 'declined'
  const canConvert = est.status === 'accepted' || est.status === 'sent'
  const canEdit    = est.status !== 'invoiced'

  const itemColumns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text> },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v: string, row: InvoiceItem) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {row.unit && <Text type="secondary" style={{ fontSize: 11 }}>{row.unit}</Text>}
        </div>
      ),
    },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Precio', dataIndex: 'unitPrice', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</Text> },
    { title: 'Dto.%', dataIndex: 'discountPercent', width: 70, align: 'center' as const, render: (v: number) => v ? <Tag color="orange">{v}%</Tag> : null },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'center' as const, render: (v: number) => <Tag>{v ?? 12}%</Tag> },
    {
      title: 'Total línea', dataIndex: 'lineTotal', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B', fontSize: 13 }}>{fmtQ(v)}</Text>,
    },
  ]

  const ribbonColors: Record<string, string> = {
    draft: '#8c8c8c', sent: '#1890ff', accepted: '#52c41a',
    declined: '#ff4d4f', invoiced: '#722ed1', expired: '#fa8c16',
  }
  const ribbonColor = ribbonColors[est.status] ?? '#8c8c8c'

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/estimaciones')}>
          Cotizaciones
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        {isExpired && <Tag color="orange"><CalendarOutlined style={{ marginRight: 4 }} />Vencida</Tag>}
        <Divider type="vertical" />
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/ventas/estimaciones/${est.id}/editar`)}>
            Editar
          </Button>
        )}
        {est.status === 'draft' || est.status === 'sent' ? (
          <Button icon={<SendOutlined />} onClick={() => { sendForm.resetFields(); setShowSend(true) }}>
            Enviar correo
          </Button>
        ) : null}
        <Button icon={<PrinterOutlined />} onClick={() => window.open(`/ventas/estimaciones/${est.id}/imprimir`, '_blank')}>
          Imprimir / PDF
        </Button>
        {canConvert && (
          <Button
            type="primary" icon={<FileTextOutlined />} loading={converting} onClick={handleConvert}
            style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}
          >
            Convertir a factura
          </Button>
        )}
        {est.status === 'invoiced' && est.invoiceId && (
          <Link to={`/ventas/facturas/${est.invoiceId}`}>
            <Button icon={<FileTextOutlined />} style={{ color: '#722ed1', borderColor: '#722ed1' }}>Ver factura</Button>
          </Link>
        )}
        <Button icon={<CopyOutlined />} onClick={handleDuplicate}>Duplicar</Button>
        <Popconfirm title="¿Eliminar esta cotización?" onConfirm={handleDelete} okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
        </Popconfirm>
      </div>

      {/* ── Alerta vencimiento ────────────────────────────────────────────── */}
      {isExpired && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`Esta cotización venció el ${dayjs(est.expiryDate).format('DD/MM/YYYY')}. Si el cliente aún desea continuar, puedes editar la fecha de vencimiento.`} />
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
            <Title level={3} style={{ margin: '0 0 4px', color: '#1B3A6B' }}>Cotización</Title>
            <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 12 }}>
              {est.estimateNumber}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Total
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#1B3A6B' }}>
                {fmtGTQ(Number(est.total))}
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Cliente + Metadatos */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Cotizando a
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1B3A6B', display: 'block' }}>{est.customerName}</Text>
            {est.customerTaxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {est.customerTaxId}</Text>}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, width: '50%' }}>Número</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{est.estimateNumber}</Text>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Fecha</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(est.estimateDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {est.expiryDate && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Vence</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ color: isExpired ? '#fa8c16' : undefined }}>
                        {dayjs(est.expiryDate).format('DD MMM YYYY')}
                      </Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Moneda</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>{est.currency}</Text></td>
                </tr>
                {est.invoiceId && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Factura</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Link to={`/ventas/facturas/${est.invoiceId}`} style={{ color: '#722ed1', fontFamily: 'monospace', fontSize: 12 }}>
                        Ver factura
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table
            columns={itemColumns}
            dataSource={est.items ?? []}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">Subtotal</Text>
                <Text style={{ fontFamily: 'monospace' }}>{fmtQ(Number(est.subtotal))}</Text>
              </div>
              {Number(est.discountAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text type="secondary">Descuento</Text>
                  <Text style={{ color: '#fa8c16', fontFamily: 'monospace' }}>−{fmtQ(Number(est.discountAmount))}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA (12%)</Text>
                <Text style={{ fontFamily: 'monospace' }}>{fmtQ(Number(est.taxAmount))}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 14, color: '#1B3A6B', fontFamily: 'monospace' }}>{fmtGTQ(Number(est.total))}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Notas / Términos */}
        {(est.notes || est.termsAndConditions) && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: est.notes && est.termsAndConditions ? '1fr 1fr' : '1fr', gap: 24 }}>
              {est.notes && (
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                    Observaciones
                  </Text>
                  <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{est.notes}</Text>
                </div>
              )}
              {est.termsAndConditions && (
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                    Términos y condiciones
                  </Text>
                  <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{est.termsAndConditions}</Text>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Más información ───────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px 28px', background: '#fafafa' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° Cotización</Text>
            <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{est.estimateNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            <Text type="secondary">Moneda</Text><Text>{est.currency}</Text>
            <Text type="secondary">Fecha creación</Text>
            <Text>{dayjs(est.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
            {est.invoiceId && (
              <>
                <Text type="secondary">Factura generada</Text>
                <Link to={`/ventas/facturas/${est.invoiceId}`} style={{ color: '#722ed1' }}>
                  Ver factura vinculada
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal enviar por correo ───────────────────────────────────────── */}
      <Modal
        title={`Enviar cotización ${est.estimateNumber}`}
        open={showSend}
        onCancel={() => { setShowSend(false); sendForm.resetFields() }}
        onOk={handleSend} confirmLoading={sending} okText="Enviar" okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={sendForm} layout="vertical">
          <Form.Item name="to" label="Correo del cliente"
            rules={[{ required: true, message: 'El correo es requerido' }, { type: 'email', message: 'Correo inválido' }]}
          >
            <Input placeholder="cliente@empresa.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
