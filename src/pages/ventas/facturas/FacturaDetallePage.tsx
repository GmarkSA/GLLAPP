import { useEffect, useState } from 'react'
import {
  Button, Tag, Table, Space, Modal, Form,
  InputNumber, DatePicker, Select, Input, Divider,
  message, Spin, Typography, Alert, Dropdown, Tooltip, Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined, DollarOutlined, SendOutlined, StopOutlined,
  PrinterOutlined, CopyOutlined, CheckCircleOutlined,
  FileTextOutlined, MoreOutlined, ExclamationCircleOutlined,
  SafetyCertificateOutlined, GlobalOutlined, BookOutlined,
  ThunderboltOutlined, SyncOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getInvoice, recordInvoicePayment, voidInvoice, sendInvoice, emitirFelInvoice, anularFelInvoice, deleteInvoice,
  recomputeJournalLines, reprocessPaymentJournal, getAnticipos, applyAnticipo,
  INVOICE_STATUS_CONFIG, PAYMENT_MODES,
  type Invoice, type InvoiceItem, type Anticipo,
} from '../../../api/facturas'
import { deletePagoRecibido } from '../../../api/pagos-recibidos'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'
import PrintInvoiceButton from '../../../components/Print/PrintInvoiceButton'

const { Text, Title } = Typography
const fmt = (n: any) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: any) => `GTQ ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function buildJournalEntries(inv: Invoice) {
  if (inv.journalLines?.length) {
    return inv.journalLines.map(l => ({
      key:    l.key,
      cuenta: `${l.accountCode} — ${l.accountName}`,
      debe:   Number(l.debe),
      haber:  Number(l.haber),
      tipo:   l.tipo,
    }))
  }
  const total    = Number(inv.total)
  const tax      = Number(inv.taxAmount)
  const discount = Number(inv.discountAmount ?? 0)
  const result: Array<{ key: string; cuenta: string; debe: number; haber: number; tipo: string }> = [
    { key: 'cxc', cuenta: '1130 — Cuentas por Cobrar Clientes', debe: total, haber: 0, tipo: 'activo' },
  ]
  if (discount > 0) result.push({ key: 'desc', cuenta: '4130 — Descuentos sobre ventas', debe: discount, haber: 0, tipo: 'gasto' })
  if (inv.items?.length) {
    const groups: Record<string, { cuenta: string; haber: number }> = {}
    inv.items.forEach((item) => {
      const lineBase = Number(item.lineTotal) - Number((item as any).taxAmount ?? 0)
      const grpKey   = (item as any).accountId ?? '_4110'
      const label = (item as any).accountCode ? `${(item as any).accountCode} — ${(item as any).accountName}` : '4110 — Ingresos por Ventas'
      if (!groups[grpKey]) groups[grpKey] = { cuenta: label, haber: 0 }
      groups[grpKey].haber += lineBase
    })
    Object.entries(groups).forEach(([, g], i) => {
      result.push({ key: `ing_${i}`, cuenta: g.cuenta, debe: 0, haber: Math.round(g.haber * 100) / 100, tipo: 'ingreso' })
    })
  } else {
    const subtotal = Number(inv.subtotal)
    result.push({ key: 'ing', cuenta: '4110 — Ingresos por Ventas', debe: 0, haber: subtotal + discount, tipo: 'ingreso' })
  }
  if (tax > 0) result.push({ key: 'iva', cuenta: '2210 — IVA por Pagar', debe: 0, haber: tax, tipo: 'pasivo' })
  return result
}

export default function FacturaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice,  setInvoice]  = useState<Invoice | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [company,  setCompany]  = useState<OrganizationProfile>({ name: '' })

  const [payModal,       setPayModal]       = useState(false)
  const [voidModal,      setVoidModal]      = useState(false)
  const [sendModal,      setSendModal]      = useState(false)
  const [anticipoModal,  setAnticipoModal]  = useState(false)
  const [emitirFelModal, setEmitirFelModal] = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [emittingFel,    setEmittingFel]    = useState(false)
  const [anticipos,      setAnticipos]      = useState<Anticipo[]>([])
  const [loadingAnt,     setLoadingAnt]     = useState(false)
  const [selectedAntId,  setSelectedAntId]  = useState<string | undefined>()
  const [anticipoAmount, setAnticipoAmount] = useState<number>(0)

  const [payForm]  = Form.useForm()
  const [voidForm] = Form.useForm()
  const [sendForm] = Form.useForm()

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [inv, accts, org] = await Promise.all([
        getInvoice(id),
        getBankAccounts({ status: 'active' }).catch(() => []),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setInvoice(inv)
      setAccounts(Array.isArray(accts) ? accts : [])
      setCompany(org)
    } catch { message.error('Error al cargar la factura') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!invoice) return <Alert type="error" message="Factura no encontrada" />

  const cfg         = INVOICE_STATUS_CONFIG[invoice.status as keyof typeof INVOICE_STATUS_CONFIG] ?? { label: invoice.status, color: 'default' }
  const isEditable  = invoice.status === 'draft'
  const isPaid      = invoice.status === 'paid'
  const isVoided    = invoice.status === 'voided'
  const isWritten   = invoice.status === 'written_off'
  const isSent      = invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue'
  const canPay      = !isPaid && !isVoided && !isWritten && Number(invoice.balance) > 0
  const canVoid     = !isVoided && !isPaid && !isWritten
  const isFelCertified = !!invoice.felUuid
  const journalEntries = buildJournalEntries(invoice)
  const journalTotal   = journalEntries.reduce((s, r) => s + r.debe, 0)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePayment = async () => {
    const v = await payForm.validateFields()
    setSaving(true)
    try {
      await recordInvoicePayment(invoice.id, {
        paymentDate:   v.paymentDate.format('YYYY-MM-DD'),
        amount:        v.amount,
        mode:          v.mode,
        reference:     v.reference,
        bankAccountId: v.bankAccountId,
        notes:         v.notes,
      })
      message.success('Pago registrado exitosamente')
      setPayModal(false)
      payForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al registrar pago')
    } finally { setSaving(false) }
  }

  const handleVoid = async () => {
    const v = await voidForm.validateFields()
    setSaving(true)
    try {
      if (isFelCertified) {
        await anularFelInvoice(invoice.id, v.reason)
        message.success('Factura anulada ante el SAT y en el sistema')
      } else {
        await voidInvoice(invoice.id, v.reason)
        message.success('Factura anulada')
      }
      setVoidModal(false)
      voidForm.resetFields()
      load()
    } catch (e: any) {
      const data   = e?.response?.data
      const raw    = data?.message ?? data?.error ?? data
      const errMsg = Array.isArray(raw) ? raw.join(' | ') : (typeof raw === 'string' ? raw : JSON.stringify(raw))
      message.error(errMsg || 'Error al anular', 10)
    } finally { setSaving(false) }
  }

  const handleSend = async () => {
    const v = await sendForm.validateFields()
    setSaving(true)
    try {
      await sendInvoice(invoice.id, { to: v.to, subject: v.subject, message: v.message })
      message.success(`Factura enviada a ${v.to}`)
      setSendModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al enviar')
    } finally { setSaving(false) }
  }

  const handleEmitirFel = async () => {
    setEmittingFel(true)
    try {
      const updated = await emitirFelInvoice(invoice.id)
      if (updated.felUuid) {
        message.success({ content: `Factura certificada · UUID: ${updated.felUuid}`, duration: 8 })
      } else {
        message.warning(`FEL procesado: ${updated.felMensaje ?? 'Sin mensaje'}`)
      }
      setEmitirFelModal(false)
      load()
    } catch (e: any) {
      const raw = e?.response?.data?.message
      message.error(Array.isArray(raw) ? raw.join(' | ') : (raw ?? 'Error al emitir FEL'), 8)
    } finally { setEmittingFel(false) }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: `Eliminar factura ${invoice.invoiceNumber}`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>Esta acción eliminará <strong>permanentemente</strong> la factura y revertirá pagos, pólizas, movimientos bancarios e inventario.</p>
          <p style={{ color: '#ff4d4f', fontWeight: 500 }}>Esta acción no se puede deshacer.</p>
        </div>
      ),
      okText: 'Sí, eliminar todo', okButtonProps: { danger: true }, cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await deleteInvoice(invoice.id)
          message.success('Factura eliminada')
          navigate('/ventas/facturas')
        } catch (e: any) {
          message.error(e?.response?.data?.message || 'Error al eliminar')
        }
      },
    })
  }

  const handleRecompute = async () => {
    setSaving(true)
    try {
      const updated = await recomputeJournalLines(invoice.id)
      setInvoice(updated)
      message.success('Partida contable recalculada')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al recalcular')
    } finally { setSaving(false) }
  }

  const openAnticipoModal = async () => {
    setSelectedAntId(undefined)
    setAnticipoAmount(0)
    setLoadingAnt(true)
    setAnticipoModal(true)
    try {
      const res = await getAnticipos({ customerId: invoice!.customerId })
      setAnticipos(res.data ?? [])
    } catch { message.error('No se pudieron cargar los anticipos') }
    finally { setLoadingAnt(false) }
  }

  const handleApplyAnticipo = async () => {
    if (!selectedAntId) { message.warning('Seleccione un anticipo'); return }
    setSaving(true)
    try {
      await applyAnticipo(selectedAntId, invoice!.id, anticipoAmount || undefined)
      message.success('Anticipo aplicado correctamente')
      setAnticipoModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al aplicar el anticipo')
    } finally { setSaving(false) }
  }

  const handleReprocessPayment = async (paymentId: string) => {
    try {
      const res = await reprocessPaymentJournal(paymentId)
      message.success(res.message ?? 'Póliza del pago reprocesada correctamente')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al reprocesar la póliza del pago')
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePagoRecibido(paymentId)
      message.success('Pago eliminado y saldo de factura revertido')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar el pago')
    }
  }

  const moreItems = [
    { key: 'copy', label: 'Duplicar factura', icon: <CopyOutlined /> },
    ...(!isEditable ? [{ key: 'recompute', label: 'Recalcular partida contable', icon: <BookOutlined />, onClick: handleRecompute }] : []),
    { type: 'divider' as const },
    ...(canVoid ? [{ key: 'void', label: isFelCertified ? 'Anular DTE ante SAT' : 'Anular factura', icon: <StopOutlined />, danger: true, onClick: () => setVoidModal(true) }] : []),
    { key: 'delete', label: 'Eliminar factura', icon: <DeleteOutlined />, danger: true, onClick: handleDelete },
  ]

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
    { title: 'Tipo', dataIndex: 'unit', width: 80, render: (v: string) => <Text style={{ fontSize: 12 }}>{v ?? 'UND'}</Text> },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Precio', dataIndex: 'unitPrice', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text> },
    {
      title: 'Total', dataIndex: 'lineTotal', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1B3A6B', fontSize: 13 }}>{fmt(v)}</Text>,
    },
  ]

  const paymentColumns = [
    { title: '# Pago', dataIndex: 'paymentNumber', width: 140 },
    { title: 'Fecha', dataIndex: 'paymentDate', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Forma', dataIndex: 'mode', width: 130, render: (v: string) => PAYMENT_MODES.find(m => m.value === v)?.label ?? v },
    { title: 'Referencia', dataIndex: 'reference' },
    { title: 'Monto', dataIndex: 'amount', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text> },
    {
      title: 'Póliza', dataIndex: 'journalEntryId', width: 70, align: 'center' as const,
      render: (jeId: string | undefined, row: any) => jeId
        ? <Tooltip title="Póliza contable generada"><CheckCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>
        : <Tooltip title="Sin póliza — click para reprocesar">
            <Button size="small" icon={<SyncOutlined />} style={{ borderColor: '#faad14', color: '#faad14', padding: '0 6px' }} onClick={() => handleReprocessPayment(row.id)} />
          </Tooltip>,
    },
    {
      title: '', width: 50, align: 'center' as const,
      render: (_: any, row: any) => (
        <Popconfirm title={`¿Eliminar el pago ${row.paymentNumber}?`} description="Se revertirá el saldo y se eliminará la póliza y movimiento bancario asociados." okText="Sí, eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => handleDeletePayment(row.id)}>
          <Tooltip title="Eliminar pago"><Button size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 6px' }} /></Tooltip>
        </Popconfirm>
      ),
    },
  ]

  const journalCols = [
    {
      title: 'CUENTA', dataIndex: 'cuenta',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'UBICACIÓN', width: 160,
      render: () => <Text type="secondary" style={{ fontSize: 12 }}>{company.name ?? '—'}</Text>,
    },
    {
      title: 'DÉBITO', dataIndex: 'debe', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
    {
      title: 'CRÉDITO', dataIndex: 'haber', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace', color: v > 0 ? '#389e0d' : undefined }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
  ]

  // ── Ribbon de estado ────────────────────────────────────────────────────────
  const ribbonColors: Record<string, string> = { voided: '#ff4d4f', draft: '#8c8c8c', paid: '#52c41a', sent: '#1890ff', partial: '#1890ff', overdue: '#ff4d4f' }
  const ribbonColor = ribbonColors[invoice.status] ?? '#1890ff'

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Barra de acciones ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/facturas')}>
          Facturas
        </Button>
        <Divider type="vertical" />
        <Tag color={cfg.color} style={{ margin: 0, fontSize: 12 }}>{cfg.label}</Tag>
        {isFelCertified && <Tag color="green" icon={<SafetyCertificateOutlined />} style={{ margin: 0 }}>FEL</Tag>}
        {invoice.felTipoDocumento && <Tag style={{ margin: 0, fontSize: 11 }}>{invoice.felTipoDocumento}</Tag>}
        <Divider type="vertical" />
        {isEditable && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/ventas/facturas/${invoice.id}/editar`)}>
            Editar
          </Button>
        )}
        <Button icon={<SendOutlined />} onClick={() => setSendModal(true)}>
          Enviar correo
        </Button>
        <span id="__print_btn__">
          <PrintInvoiceButton invoice={invoice} company={company} />
        </span>
        {canPay && (
          <Button
            type="primary"
            icon={<DollarOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}
          >
            Registrar pago
          </Button>
        )}
        {canPay && (
          <Button
            icon={<ThunderboltOutlined />}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
            onClick={openAnticipoModal}
          >
            Aplicar anticipo
          </Button>
        )}
        {!isVoided && !isWritten && !isFelCertified && (
          <Button
            icon={<SafetyCertificateOutlined />}
            style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
            onClick={() => setEmitirFelModal(true)}
          >
            Emitir FEL
          </Button>
        )}
        {isFelCertified && canVoid && (
          <Button danger icon={<StopOutlined />} onClick={() => setVoidModal(true)}>
            Anulación FEL
          </Button>
        )}
        <Dropdown menu={{ items: moreItems }} placement="bottomRight">
          <Button icon={<MoreOutlined />} />
        </Dropdown>
      </div>

      {/* ── Alertas de estado ────────────────────────────────────────────── */}
      {invoice.status === 'overdue' && (
        <Alert
          type="error" showIcon icon={<ExclamationCircleOutlined />}
          message={`Factura vencida desde ${invoice.dueDate ? dayjs(invoice.dueDate).format('DD/MM/YYYY') : ''}. Saldo pendiente: ${fmt(invoice.balance)}`}
          action={canPay ? <Button size="small" type="primary" danger onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}>Registrar pago</Button> : null}
          style={{ marginBottom: 12 }}
        />
      )}
      {!isVoided && !invoice.journalEntryId && invoice.status !== 'draft' && (
        <Alert
          type="warning" showIcon
          message="Esta factura no tiene póliza contable"
          description={<Space size={4} direction="vertical" style={{ fontSize: 12 }}>
            <span>Configure la cuenta CxC en <strong>Ventas → Clientes → {invoice.customerName}</strong> y luego regenere la póliza.</span>
            <Button size="small" icon={<SyncOutlined />} loading={saving} onClick={handleRecompute}>Regenerar póliza ahora</Button>
          </Space>}
          style={{ marginBottom: 12 }}
        />
      )}
      {isSent && canPay && (
        <Alert
          type="info" showIcon
          message={<span>¿CÓMO CONTINUAR? Se ha enviado la Factura. Registre su pago tan pronto como lo reciba.</span>}
          action={<Button size="small" type="primary" style={{ background: '#1B3A6B' }} onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}>Registrar pago</Button>}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* ── Documento de factura ─────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', position: 'relative' }}>

        {/* Ribbon de estado */}
        <div style={{
          position: 'absolute', top: 18, left: -28, width: 120, textAlign: 'center',
          background: ribbonColor, color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 0', transform: 'rotate(-45deg)', letterSpacing: 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 1,
          textTransform: 'uppercase',
        }}>
          {cfg.label}
        </div>

        {/* Cabecera del documento */}
        <div style={{ padding: '32px 40px 24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24 }}>
          {/* Izquierda: datos de la empresa */}
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
            {company.website && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{company.website}</Text>}
          </div>

          {/* Derecha: tipo documento + saldo adeudado */}
          <div style={{ textAlign: 'right', minWidth: 240 }}>
            <Title level={3} style={{ margin: '0 0 4px', color: '#1B3A6B' }}>
              {invoice.felTipoDocumento ?? 'Factura'}
            </Title>
            {invoice.facturaExenta && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                No genera derecho a crédito fiscal
              </Text>
            )}
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                {isPaid ? 'Pagado' : 'Saldo adeudado'}
              </Text>
              <Text style={{
                fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                color: isPaid ? '#52c41a' : Number(invoice.balance) > 0 ? '#1B3A6B' : '#52c41a',
              }}>
                {fmtGTQ(invoice.balance)}
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Datos de cliente + metadatos de factura */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Facturar a
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1B3A6B', display: 'block' }}>{invoice.customerName}</Text>
            {invoice.customerTaxId && (
              <Text type="secondary" style={{ fontSize: 12 }}>NIT: {invoice.customerTaxId}</Text>
            )}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, width: '50%' }}>Fecha de la factura</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>{dayjs(invoice.invoiceDate).format('DD MMM YYYY')}</Text></td>
                </tr>
                {invoice.dueDate && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Fecha de vencimiento</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ color: !isPaid && dayjs(invoice.dueDate).isBefore(dayjs()) ? '#ff4d4f' : undefined }}>
                        {dayjs(invoice.dueDate).format('DD MMM YYYY')}
                      </Text>
                    </td>
                  </tr>
                )}
                {invoice.purchaseOrderRef && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>N.° de orden de compra</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>OC: {invoice.purchaseOrderRef}</Text></td>
                  </tr>
                )}
                {invoice.felSerie && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Serie</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{invoice.felSerie}</Text></td>
                  </tr>
                )}
                {invoice.felNumero && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Número</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{invoice.felNumero}</Text></td>
                  </tr>
                )}
                {invoice.felAutorizacion && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Autorización</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{invoice.felAutorizacion}</Text>
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
            dataSource={invoice.items ?? []}
            columns={itemColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
          />

          {/* Totales */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              {Number(invoice.discountAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text type="secondary">Descuento</Text>
                  <Text style={{ color: '#ff4d4f' }}>− {fmt(invoice.discountAmount)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA {invoice.facturaExenta ? '(Exento)' : '(12%)'}</Text>
                <Text>{invoice.facturaExenta ? 'Q 0.00' : fmt(invoice.taxAmount)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 14, color: '#1B3A6B', fontFamily: 'monospace' }}>{fmtGTQ(invoice.total)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Saldo adeudado</Text>
                <Text strong style={{ fontSize: 14, color: isPaid ? '#52c41a' : '#1B3A6B', fontFamily: 'monospace' }}>{fmtGTQ(invoice.balance)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del documento */}
        {invoice.notes && (
          <div style={{ padding: '0 40px 20px' }}>
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>{invoice.notes}</Text>
          </div>
        )}

        {/* ── Más información ──────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px', background: '#fafafa' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">Factura N°</Text>
            <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{invoice.invoiceNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            {invoice.currency && <><Text type="secondary">Moneda</Text><Text>{invoice.currency}</Text></>}
            {invoice.lugarExpedicion && <><Text type="secondary">Lugar de expedición</Text><Text>{invoice.lugarExpedicion}</Text></>}
          </div>

          {/* Campos FEL personalizados */}
          {isFelCertified && (
            <>
              <Divider style={{ margin: '16px 0 14px' }} />
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 12 }}>
                Campos FEL / SAT
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 0', fontSize: 13 }}>
                {invoice.felTipoDocumento && <><Text type="secondary">Tipo de documento</Text><Text>{invoice.felTipoDocumento}</Text></>}
                {invoice.felSerie && <><Text type="secondary">Serie</Text><Text style={{ fontFamily: 'monospace' }}>{invoice.felSerie}</Text></>}
                {invoice.felNumero && <><Text type="secondary">Número</Text><Text style={{ fontFamily: 'monospace' }}>{invoice.felNumero}</Text></>}
                {invoice.felAutorizacion && <><Text type="secondary">Autorización</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{invoice.felAutorizacion}</Text></>}
                {(invoice as any).felMensaje && <><Text type="secondary">Mensaje</Text><Text>{(invoice as any).felMensaje}</Text></>}
                {invoice.felUuid && <><Text type="secondary">UUID</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{invoice.felUuid}</Text></>}
                {invoice.felUrl && (
                  <>
                    <Text type="secondary">URL</Text>
                    <a href={invoice.felUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      <GlobalOutlined style={{ marginRight: 4 }} />{invoice.felUrl}
                    </a>
                  </>
                )}
                {invoice.felCertificadaAt && (
                  <><Text type="secondary">Fecha de certificación</Text><Text>{dayjs(invoice.felCertificadaAt).format('DD/MM/YYYY HH:mm:ss')}</Text></>
                )}
              </div>
              {invoice.felFrases && invoice.felFrases.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Frases: </Text>
                  <Space wrap style={{ marginLeft: 8 }}>
                    {invoice.felFrases.map((f, i) => (
                      <Tag key={i} color="purple" style={{ fontSize: 11 }}>Tipo {f.tipoFrase} Esc. {f.codigoEscenario}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Diario / Póliza contable ──────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Diario
            </Text>
            <Space>
              <Tag color="default" style={{ fontSize: 11, cursor: 'default' }}>
                {invoice.currency ?? 'GTQ'}
              </Tag>
              {invoice.journalEntryId && (
                <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {(invoice as any).journalEntryNumber ?? invoice.journalEntryId?.slice(0, 8)}
                </Text>
              )}
            </Space>
          </div>
          {journalEntries.length > 0 ? (
            <>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 10 }}>
                El importe se muestra en su moneda base <Tag style={{ fontSize: 10 }}>{invoice.currency ?? 'GTQ'}</Tag>
              </Text>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#555', marginBottom: 6 }}>Factura</div>
              <Table
                dataSource={journalEntries}
                columns={journalCols}
                rowKey="key"
                size="small"
                pagination={false}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong style={{ fontSize: 12 }}>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>
                          {Number(journalTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace', color: '#389e0d' }}>
                          {Number(journalTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </>
          ) : (
            <Alert type="info" showIcon message="Sin partida contable — use Regenerar póliza para crearla." />
          )}
        </div>

        {/* ── Historial de pagos ───────────────────────────────────────────── */}
        {(invoice.payments ?? []).length > 0 && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: '20px 40px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Historial de pagos
                </Text>
                {canPay && (
                  <Button size="small" type="primary" icon={<DollarOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}>
                    + Pago
                  </Button>
                )}
              </div>
              <Table
                dataSource={invoice.payments}
                columns={paymentColumns}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
              />
            </div>
          </>
        )}

      </div>

      {/* ── Modales (sin cambios de lógica) ──────────────────────────────── */}

      <Modal
        title={<><DollarOutlined /> Registrar pago — {invoice.invoiceNumber}</>}
        open={payModal} onOk={handlePayment} onCancel={() => setPayModal(false)}
        okText="Registrar pago"
        okButtonProps={{ loading: saving, style: { background: '#52c41a', borderColor: '#52c41a' } }}
        width={520}
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true }]} initialValue={dayjs()}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} prefix="Q" max={Number(invoice.balance)} precision={2} />
            </Form.Item>
            <Form.Item name="mode" label="Forma de pago" initialValue="bank_transfer">
              <Select options={PAYMENT_MODES} />
            </Form.Item>
            <Form.Item name="bankAccountId" label="Cuenta bancaria">
              <Select allowClear placeholder="Sin cuenta específica" options={accounts.map(a => ({ value: a.id, label: a.name }))} />
            </Form.Item>
          </div>
          <Form.Item name="reference" label="Referencia / # comprobante">
            <Input placeholder="Ej: TRF-2025-001, cheque #123" />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Alert type="info" showIcon message={`Saldo pendiente: ${fmt(invoice.balance)}`}
            description={Number(invoice.balance) === Number(invoice.total) ? 'Este pago saldará la factura completamente.' : 'Pago parcial — quedará saldo pendiente.'} />
        </Form>
      </Modal>

      <Modal
        title={<><ThunderboltOutlined style={{ color: '#722ed1' }} /> Aplicar anticipo — {invoice.invoiceNumber}</>}
        open={anticipoModal} onCancel={() => setAnticipoModal(false)} onOk={handleApplyAnticipo}
        okText="Aplicar anticipo"
        okButtonProps={{ loading: saving, style: { background: '#722ed1', borderColor: '#722ed1' }, disabled: !selectedAntId || anticipoAmount <= 0 }}
        cancelText="Cancelar" width={520}
      >
        {loadingAnt ? <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div> : anticipos.length === 0 ? (
          <Alert type="info" showIcon message="Sin anticipos disponibles para este cliente"
            description={<span>No hay anticipos con saldo disponible para <strong>{invoice.customerName}</strong>.</span>} />
        ) : (
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="Anticipo a aplicar" required>
              <Select placeholder="Seleccionar anticipo..." style={{ width: '100%' }} value={selectedAntId}
                onChange={(val) => { setSelectedAntId(val); const ant = anticipos.find(a => a.id === val); if (ant) setAnticipoAmount(Math.min(Number(ant.balance), Number(invoice.balance))) }}
                options={anticipos.map(a => ({ value: a.id, label: `${a.invoiceNumber} — Q ${Number(a.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })} disponible` }))}
              />
            </Form.Item>
            {selectedAntId && (() => {
              const ant = anticipos.find(a => a.id === selectedAntId)!
              const maxAmt = Math.min(Number(ant.balance), Number(invoice.balance))
              return (<>
                <Form.Item label={`Monto a aplicar (máx Q ${maxAmt.toLocaleString('es-GT', { minimumFractionDigits: 2 })})`}>
                  <InputNumber style={{ width: '100%' }} prefix="Q" min={0.01} max={maxAmt} step={0.01} precision={2} value={anticipoAmount} onChange={(v) => setAnticipoAmount(v ?? maxAmt)} />
                </Form.Item>
                <Alert type="info" showIcon message={`Anticipo ${ant.invoiceNumber} · Saldo: Q ${Number(ant.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                  description={`Se aplicarán Q ${(anticipoAmount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} al saldo pendiente.`} />
              </>)
            })()}
          </Form>
        )}
      </Modal>

      <Modal
        title={<><StopOutlined /> {isFelCertified ? 'Anular DTE ante SAT' : 'Anular factura'}</>}
        open={voidModal} onOk={handleVoid} onCancel={() => { setVoidModal(false); voidForm.resetFields() }}
        okText={isFelCertified ? 'Anular ante SAT y en sistema' : 'Anular'}
        okButtonProps={{ loading: saving, danger: true }} width={480}
      >
        {isFelCertified ? (
          <Alert type="error" showIcon message="Anulación de Factura Electrónica (FEL)"
            description={<span>Esta factura está <strong>certificada ante el SAT</strong>. Si el SAT aprueba, quedará anulada en el sistema. UUID: <code style={{ fontSize: 11 }}>{invoice?.felUuid}</code></span>}
            style={{ marginBottom: 16 }} />
        ) : (
          <Alert type="warning" message="Esta acción no se puede deshacer." showIcon style={{ marginBottom: 16 }} />
        )}
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de anulación" rules={[{ required: true, message: 'El motivo es requerido' }]}
            extra={isFelCertified ? 'Este motivo se enviará al SAT como justificación.' : undefined}>
            <Input.TextArea rows={3} placeholder="Describe el motivo de la anulación…" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<><SafetyCertificateOutlined style={{ color: '#1B3A6B' }} /> Emitir Factura Electrónica (FEL)</>}
        open={emitirFelModal} onCancel={() => setEmitirFelModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setEmitirFelModal(false)}>Cancelar</Button>,
          <Button key="emit" type="primary" loading={emittingFel} icon={<SafetyCertificateOutlined />}
            style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }} onClick={handleEmitirFel}>
            Certificar ante SAT
          </Button>,
        ]}
        width={520}
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Esta acción enviará la factura a FelPlex para su validación ante el SAT de Guatemala."
          description="Una vez certificada no podrá modificarse. Se generarán UUID, Serie, Número, Autorización y URL." />
        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><Text type="secondary">Factura:</Text> <Text strong>{invoice.invoiceNumber}</Text></div>
            <div><Text type="secondary">Tipo doc.:</Text> <Tag color="blue">{invoice.felTipoDocumento || 'FACT'}</Tag></div>
            <div><Text type="secondary">Cliente:</Text> <Text>{invoice.customerName}</Text></div>
            <div><Text type="secondary">NIT:</Text> <Text>{invoice.customerTaxId || 'CF'}</Text></div>
            <div><Text type="secondary">Total:</Text> <Text strong style={{ color: '#1B3A6B' }}>Q {Number(invoice.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text></div>
            <div><Text type="secondary">Exenta:</Text> <Text>{invoice.facturaExenta ? 'Sí' : 'No'}</Text></div>
            {invoice.lugarExpedicion && <div style={{ gridColumn: '1 / -1' }}><Text type="secondary">Lugar:</Text> <Text>{invoice.lugarExpedicion}</Text></div>}
          </div>
        </div>
      </Modal>

      <Modal
        title={<><SendOutlined /> Enviar factura por correo</>}
        open={sendModal} onOk={handleSend} onCancel={() => setSendModal(false)}
        okText="Enviar" okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      >
        <Form form={sendForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="to" label="Correo del destinatario" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="cliente@empresa.com" />
          </Form.Item>
          <Form.Item name="subject" label="Asunto" initialValue={`Factura ${invoice.invoiceNumber} — ${invoice.customerName}`}>
            <Input />
          </Form.Item>
          <Form.Item name="message" label="Mensaje">
            <Input.TextArea rows={3} placeholder="Mensaje adicional para el cliente…" />
          </Form.Item>
        </Form>
      </Modal>

      <span id="__print_btn__" style={{ display: 'none' }}>
        <PrintInvoiceButton invoice={invoice} company={company} />
      </span>
    </div>
  )
}
