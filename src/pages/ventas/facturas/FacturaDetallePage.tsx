import { useEffect, useState } from 'react'
import {
  Card, Button, Tag, Descriptions, Table, Space, Modal, Form,
  InputNumber, DatePicker, Select, Input, Divider, Statistic, Row, Col,
  message, Spin, Typography, Badge, Alert, Dropdown, Tooltip, Progress, Popconfirm,
} from 'antd'
import { PageHeader } from '../../../components/ui/PageHeader'
import {
  ArrowLeftOutlined, DollarOutlined, SendOutlined, StopOutlined,
  PrinterOutlined, CopyOutlined, CheckCircleOutlined,
  FileTextOutlined, MoreOutlined, ExclamationCircleOutlined,
  SafetyCertificateOutlined, GlobalOutlined, BookOutlined,
  ThunderboltOutlined, SyncOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getInvoice, recordInvoicePayment, voidInvoice, sendInvoice, writeOffInvoice, emitirFelInvoice, anularFelInvoice, deleteInvoice,
  recomputeJournalLines, reprocessPaymentJournal, getAnticipos, applyAnticipo,
  INVOICE_STATUS_CONFIG, PAYMENT_MODES,
  type Invoice, type InvoiceItem, type Anticipo,
} from '../../../api/facturas'
import { deletePagoRecibido } from '../../../api/pagos-recibidos'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'
import PrintInvoiceButton from '../../../components/Print/PrintInvoiceButton'

const { Text } = Typography
const fmt = (n: any) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// \u0000\u0000\u0000 Partida contable calculada desde la factura \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000
function buildJournalEntries(inv: Invoice) {
  // Usar líneas reales del backend cuando están disponibles (cuentas configuradas)
  if (inv.journalLines?.length) {
    return inv.journalLines.map(l => ({
      key:    l.key,
      cuenta: `${l.accountCode} — ${l.accountName}`,
      debe:   Number(l.debe),
      haber:  Number(l.haber),
      tipo:   l.tipo,
    }))
  }

  // Fallback: preview desde los ítems (borradores o facturas previas al fix)
  const total    = Number(inv.total)
  const tax      = Number(inv.taxAmount)
  const discount = Number(inv.discountAmount ?? 0)

  const result: Array<{ key: string; cuenta: string; debe: number; haber: number; tipo: string }> = [
    { key: 'cxc', cuenta: '1130 — Cuentas por Cobrar Clientes', debe: total, haber: 0, tipo: 'activo' },
  ]
  if (discount > 0) {
    result.push({ key: 'desc', cuenta: '4130 — Descuentos sobre ventas', debe: discount, haber: 0, tipo: 'gasto' })
  }

  // Agrupar ingresos por cuenta del ítem si está disponible, sino genérica
  if (inv.items?.length) {
    const incomeGroups: Record<string, { cuenta: string; haber: number }> = {}
    inv.items.forEach((item) => {
      const lineBase = Number(item.lineTotal) - Number((item as any).taxAmount ?? 0)
      const grpKey   = (item as any).accountId ?? '_4110'
      const cuentaLabel = (item as any).accountCode
        ? `${(item as any).accountCode} — ${(item as any).accountName}`
        : '4110 — Ingresos por Ventas'
      if (!incomeGroups[grpKey]) incomeGroups[grpKey] = { cuenta: cuentaLabel, haber: 0 }
      incomeGroups[grpKey].haber += lineBase
    })
    Object.entries(incomeGroups).forEach(([, g], i) => {
      result.push({ key: `ing_${i}`, cuenta: g.cuenta, debe: 0, haber: Math.round(g.haber * 100) / 100, tipo: 'ingreso' })
    })
  } else {
    const subtotal = Number(inv.subtotal)
    result.push({ key: 'ing', cuenta: '4110 — Ingresos por Ventas', debe: 0, haber: subtotal + discount, tipo: 'ingreso' })
  }

  if (tax > 0) {
    result.push({ key: 'iva', cuenta: '2210 — IVA por Pagar', debe: 0, haber: tax, tipo: 'pasivo' })
  }
  return result
}

export default function FacturaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice,  setInvoice]  = useState<Invoice | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [company,  setCompany]  = useState<OrganizationProfile>({ name: '' })

  // Modals
  const [payModal,       setPayModal]       = useState(false)
  const [voidModal,      setVoidModal]      = useState(false)
  const [sendModal,      setSendModal]      = useState(false)
  const [writeOffModal,  setWriteOffModal]  = useState(false)
  const [anticipoModal,  setAnticipoModal]  = useState(false)
  const [emitirFelModal, setEmitirFelModal] = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [emittingFel,    setEmittingFel]    = useState(false)
  const [showJournal,    setShowJournal]    = useState(false)
  const [anticipos,      setAnticipos]      = useState<Anticipo[]>([])
  const [loadingAnt,     setLoadingAnt]     = useState(false)
  const [selectedAntId,  setSelectedAntId]  = useState<string | undefined>()
  const [anticipoAmount, setAnticipoAmount] = useState<number>(0)

  const [payForm]      = Form.useForm()
  const [voidForm]     = Form.useForm()
  const [sendForm]     = Form.useForm()
  const [writeOffForm] = Form.useForm()

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
    } catch {
      message.error('Error al cargar la factura')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!invoice) return <Alert type="error" message="Factura no encontrada" />

  const cfg        = INVOICE_STATUS_CONFIG[invoice.status as keyof typeof INVOICE_STATUS_CONFIG] ?? { label: invoice.status, color: 'default' }
  const isEditable = invoice.status === 'draft'
  const isPaid     = invoice.status === 'paid'
  const isVoided   = invoice.status === 'voided'
  const isWritten  = invoice.status === 'written_off'
  const isSent     = invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue'
  const canPay     = !isPaid && !isVoided && !isWritten && Number(invoice.balance) > 0
  const canVoid    = !isVoided && !isPaid && !isWritten
  const canWriteOff = isSent && Number(invoice.balance) > 0
  const balancePct = invoice.total > 0 ? Math.round((Number(invoice.paidAmount) / Number(invoice.total)) * 100) : 0

  const isFelCertified = !!invoice.felUuid

  const journalEntries = buildJournalEntries(invoice)
  const journalTotal   = journalEntries.reduce((s, r) => s + r.debe, 0)

  // \u0000\u0000 Actions \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000
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
        // Factura FEL: primero anula ante SAT, luego en el sistema
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
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
      message.error(errMsg ? `${errMsg}${status}` : `Sin conexión con el servidor${status}`, 10)
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
        message.success({
          content: (
            <span>
              \u0005 Factura certificada por SAT · UUID: <strong style={{ fontFamily: 'monospace', fontSize: 11 }}>{updated.felUuid}</strong>
            </span>
          ),
          duration: 8,
        })
      } else {
        message.warning(`FEL procesado: ${updated.felMensaje ?? 'Sin mensaje'}`)
      }
      setEmitirFelModal(false)
      load()
    } catch (e: any) {
      const raw = e?.response?.data?.message
      const msg = Array.isArray(raw) ? raw.join(' | ') : (raw ?? 'Error al emitir FEL')
      message.error(msg, 8)
    } finally {
      setEmittingFel(false)
    }
  }

  const handleWriteOff = async () => {
    const v = await writeOffForm.validateFields()
    setSaving(true)
    try {
      await writeOffInvoice(invoice.id, v.reason)
      message.success('Saldo condonado')
      setWriteOffModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al condonar')
    } finally { setSaving(false) }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: `Eliminar factura ${invoice.invoiceNumber}`,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>Esta acción eliminará <strong>permanentemente</strong> la factura y revertirá:</p>
          <ul style={{ paddingLeft: 16, margin: '8px 0', fontSize: 13 }}>
            <li>Todos los pagos aplicados</li>
            <li>Pólizas contables generadas</li>
            <li>Movimientos bancarios vinculados</li>
            <li>Stock descontado del inventario</li>
          </ul>
          <p style={{ color: '#ff4d4f', fontWeight: 500 }}>Esta acción no se puede deshacer.</p>
        </div>
      ),
      okText: 'Sí, eliminar todo',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await deleteInvoice(invoice.id)
          message.success('Factura y todos sus registros eliminados correctamente')
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
      message.success('Partida contable recalculada con las cuentas configuradas')
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
      message.success('Pago eliminado y saldo de factura revertido correctamente')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar el pago')
    }
  }

  //\u0000\u0000 More-actions dropdown \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000
  const moreItems = [
    {
      key: 'print',
      label: 'Imprimir / PDF',
      icon: <PrinterOutlined />,
      onClick: () => {
        // Handled by PrintInvoiceButton — this item kept for keyboard nav only
        document.getElementById('__print_btn__')?.click()
      },
    },
    {
      key: 'duplicate',
      label: 'Duplicar factura',
      icon: <CopyOutlined />,
    },
    ...(!isEditable ? [{
      key: 'recompute',
      label: 'Recalcular partida contable',
      icon: <BookOutlined />,
      onClick: handleRecompute,
    }] : []),
    { type: 'divider' as const },
    ...(canWriteOff ? [{
      key: 'writeoff',
      label: 'Condonar saldo pendiente',
      icon: <ExclamationCircleOutlined />,
      danger: true,
      onClick: () => setWriteOffModal(true),
    }] : []),
    ...(canVoid ? [{
      key: 'void',
      label: isFelCertified ? 'Anular DTE ante SAT' : 'Anular factura',
      icon: <StopOutlined />,
      danger: true,
      onClick: () => setVoidModal(true),
    }] : []),
    {
      key: 'delete',
      label: 'Eliminar factura',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDelete,
    },
  ]

  const itemColumns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v: string, row: InvoiceItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {row.unit && <Text type="secondary" style={{ fontSize: 11 }}>{row.unit}</Text>}
        </div>
      ),
    },
    { title: 'Cant.',   dataIndex: 'quantity',       width: 70,  align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'P. Unit', dataIndex: 'unitPrice',      width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Desc.',   dataIndex: 'discountPercent', width: 70,  align: 'center' as const, render: (v: number) => v > 0 ? <Tag color="orange">{v}%</Tag> : null },
    { title: 'IVA',     dataIndex: 'taxPercent',      width: 70,  align: 'center' as const, render: (v: number) => <Tag>{v}%</Tag> },
    { title: 'Total',   dataIndex: 'lineTotal',       width: 120, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1B3A6B' }}>{fmt(v)}</Text> },
  ]

  const paymentColumns = [
    { title: '# Pago',     dataIndex: 'paymentNumber', width: 140 },
    { title: 'Fecha',      dataIndex: 'paymentDate',   width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Forma',      dataIndex: 'mode',          width: 130, render: (v: string) => PAYMENT_MODES.find(m => m.value === v)?.label ?? v },
    { title: 'Referencia', dataIndex: 'reference' },
    { title: 'Monto',      dataIndex: 'amount',         align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text> },
    {
      title: 'Póliza', dataIndex: 'journalEntryId', width: 90, align: 'center' as const,
      render: (jeId: string | undefined, row: any) =>
        jeId
          ? <Tooltip title="Póliza contable generada"><CheckCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>
          : (
            <Tooltip title="Sin póliza — click para reprocesar">
              <Button
                size="small"
                icon={<SyncOutlined />}
                style={{ borderColor: '#faad14', color: '#faad14', padding: '0 6px' }}
                onClick={() => handleReprocessPayment(row.id)}
              />
            </Tooltip>
          ),
    },
    {
      title: '', dataIndex: 'id', width: 50, align: 'center' as const,
      render: (_: any, row: any) => (
        <Popconfirm
          title={`¿Eliminar el pago ${row.paymentNumber}?`}
          description="Se revertirá el saldo de la factura y se eliminará la póliza contable y el movimiento bancario asociados."
          okText="Sí, eliminar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeletePayment(row.id)}
        >
          <Tooltip title="Eliminar pago">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: '0 6px' }}
            />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ]

  const journalColumns = [
    {
      title: 'Cuenta Contable', dataIndex: 'cuenta',
      render: (v: string, row: any) => (
        <Space>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: row.tipo === 'activo' ? '#1890ff' : row.tipo === 'ingreso' ? '#52c41a' : row.tipo === 'pasivo' ? '#fa8c16' : '#ff4d4f',
          }} />
          <Text style={{ fontSize: 12 }}>{v}</Text>
        </Space>
      ),
    },
    { title: 'Debe',  dataIndex: 'debe',  width: 130, align: 'right' as const, render: (v: number) => v > 0 ? <Text style={{ color: '#1890ff', fontSize: 12 }}>{fmt(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Haber', dataIndex: 'haber', width: 130, align: 'right' as const, render: (v: number) => v > 0 ? <Text style={{ color: '#52c41a', fontSize: 12 }}>{fmt(v)}</Text> : <Text type="secondary">—</Text> },
  ]

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>

      {/* \u0000\u0000 Header + action bar \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <PageHeader
        icon={<FileTextOutlined />}
        title={invoice.invoiceNumber}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/facturas')}>
              Facturas
            </Button>
            <Tag color={cfg.color}>{cfg.label}</Tag>
            {isFelCertified && <Tag color="green" icon={<SafetyCertificateOutlined />}>FEL Certificada</Tag>}
            {invoice.felTipoDocumento && <Tag>{invoice.felTipoDocumento}</Tag>}
            {isEditable && (
              <Button onClick={() => navigate(`/ventas/facturas/${invoice.id}/editar`)}>Editar</Button>
            )}
            {isEditable && (
              <Button danger onClick={handleDelete}>Eliminar</Button>
            )}
            {!isVoided && !isWritten && !isFelCertified && (
              <Tooltip title="Certificar esta factura ante el SAT vía FelPlex">
                <Button icon={<SafetyCertificateOutlined />} onClick={() => setEmitirFelModal(true)}
                  style={{ borderColor: '#1B3A6B', color: '#1B3A6B', fontWeight: 600 }}>
                  Emitir FEL
                </Button>
              </Tooltip>
            )}
            {!isVoided && !isWritten && (
              <Button icon={<SendOutlined />} onClick={() => setSendModal(true)}>Enviar</Button>
            )}
            <span id="__print_btn__">
              <PrintInvoiceButton invoice={invoice} company={company} />
            </span>
            <Dropdown menu={{ items: moreItems }} placement="bottomRight">
              <Button icon={<MoreOutlined />}>Más acciones</Button>
            </Dropdown>
          </Space>
        }
      />

      {/* \u0000\u0000 Alerta si vencida \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      {invoice.status === 'overdue' && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`Factura vencida desde ${invoice.dueDate ? dayjs(invoice.dueDate).format('DD/MM/YYYY') : ''}. Saldo pendiente: ${fmt(invoice.balance)}`}
          action={canPay ? <Button size="small" type="primary" danger onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}>Registrar pago</Button> : null}
          style={{ marginBottom: 12 }}
        />
      )}

      <Row gutter={16}>
        {/* \u0000\u0000 LEFT: document \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
        <Col flex="1">

          {/* Header info */}
          <Card size="small" style={{ marginBottom: 12 }}>
            <Descriptions column={2} size="small" labelStyle={{ color: '#8c8c8c' }}>
              <Descriptions.Item label="Cliente">
                <Text strong>{invoice.customerName}</Text>
                {invoice.customerTaxId && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                    NIT: {invoice.customerTaxId}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Moneda">{invoice.currency}</Descriptions.Item>
              <Descriptions.Item label="Fecha emisión">
                {dayjs(invoice.invoiceDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Vencimiento">
                {invoice.dueDate ? (
                  <Text style={{ color: !isPaid && dayjs(invoice.dueDate).isBefore(dayjs()) ? '#ff4d4f' : undefined }}>
                    {dayjs(invoice.dueDate).format('DD/MM/YYYY')}
                  </Text>
                ) : '—'}
              </Descriptions.Item>
              {invoice.purchaseOrderRef && (
                <Descriptions.Item label="Ref. PO">{invoice.purchaseOrderRef}</Descriptions.Item>
              )}
              {invoice.lugarExpedicion && (
                <Descriptions.Item label="Lugar expedición">{invoice.lugarExpedicion}</Descriptions.Item>
              )}
              {invoice.notes && (
                <Descriptions.Item label="Notas" span={2}>{invoice.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Line items */}
          <Card size="small" title="Detalle de ítems" style={{ marginBottom: 12 }}>
            <Table
              dataSource={invoice.items ?? []}
              columns={itemColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 700 }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>Subtotal</div>
                <div>{fmt(invoice.subtotal)}</div>
              </div>
              {Number(invoice.discountAmount) > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>Descuento</div>
                  <div style={{ color: '#ff4d4f' }}>− {fmt(invoice.discountAmount)}</div>
                </div>
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>IVA {invoice.facturaExenta ? '(Exento)' : '(12%)'}</div>
                <div>{invoice.facturaExenta ? 'Q 0.00' : fmt(invoice.taxAmount)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, fontWeight: 600 }}>TOTAL</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1B3A6B' }}>{fmt(invoice.total)}</div>
              </div>
            </div>
          </Card>

          {/* \u0000\u0000 Partida contable \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
          <Card
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <BookOutlined style={{ color: '#1B3A6B' }} />
                <span>Partida Contable Generada</span>
                {!showJournal && <Tag color="geekblue" style={{ cursor: 'pointer' }} onClick={() => setShowJournal(true)}>Ver</Tag>}
              </Space>
            }
            extra={
              showJournal && (
                <Button size="small" type="text" onClick={() => setShowJournal(false)}>Ocultar</Button>
              )
            }
          >
            {showJournal ? (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="Asiento automático generado al emitir la factura"
                  style={{ marginBottom: 8 }}
                />
                <Table
                  dataSource={journalEntries}
                  columns={journalColumns}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ fontWeight: 700 }}>
                        <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong style={{ color: '#1890ff' }}>{fmt(journalTotal)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ color: '#52c41a' }}>{fmt(journalTotal)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
                <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
                  ✓ Débito = Crédito ({fmt(journalTotal)}) — Asiento balanceado
                </div>
              </>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: 13, padding: '4px 0' }}>
                Haga clic en <strong>Ver</strong> para mostrar la partida contable (débito/crédito) que este documento genera en el libro diario.
              </div>
            )}
          </Card>

          {/* FEL Info */}
          {isFelCertified && (
            <Card
              size="small"
              title={<Space><SafetyCertificateOutlined style={{ color: '#52c41a' }} /><span>Datos FEL</span><Badge status="success" text="Certificada SAT" /></Space>}
              style={{ marginBottom: 12 }}
            >
              <Descriptions column={2} size="small" labelStyle={{ color: '#8c8c8c' }}>
                <Descriptions.Item label="Tipo documento">
                  <Tag color="blue">{invoice.felTipoDocumento}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Serie">{invoice.felSerie}</Descriptions.Item>
                <Descriptions.Item label="Número SAT">{invoice.felNumero}</Descriptions.Item>
                <Descriptions.Item label="Autorización">{invoice.felAutorizacion}</Descriptions.Item>
                {invoice.felCertificadaAt && (
                  <Descriptions.Item label="Fecha certificación">
                    {dayjs(invoice.felCertificadaAt).format('DD/MM/YYYY HH:mm')}
                  </Descriptions.Item>
                )}
                {invoice.felUrl && (
                  <Descriptions.Item label="Verificar SAT" span={2}>
                    <a href={invoice.felUrl} target="_blank" rel="noreferrer">
                      <GlobalOutlined style={{ marginRight: 4 }} />
                      {invoice.felUrl}
                    </a>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="UUID" span={2}>
                  <Text code style={{ fontSize: 10, wordBreak: 'break-all' }}>{invoice.felUuid}</Text>
                </Descriptions.Item>
                {invoice.lugarExpedicion && (
                  <Descriptions.Item label="Lugar expedición">{invoice.lugarExpedicion}</Descriptions.Item>
                )}
                {invoice.incoterm && (
                  <Descriptions.Item label="INCOTERM"><Tag>{invoice.incoterm}</Tag></Descriptions.Item>
                )}
                {invoice.nombreConsignatario && (
                  <Descriptions.Item label="Consignatario">{invoice.nombreConsignatario}</Descriptions.Item>
                )}
                {invoice.felFrases && invoice.felFrases.length > 0 && (
                  <Descriptions.Item label="Frases exención" span={2}>
                    <Space wrap>
                      {invoice.felFrases.map((f, i) => (
                        <Tag key={i} color="purple">Tipo {f.tipoFrase} Esc. {f.codigoEscenario}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Payment history */}
          {(invoice.payments ?? []).length > 0 && (
            <Card
              size="small"
              title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Historial de pagos</span></Space>}
              style={{ marginBottom: 12 }}
              extra={canPay && (
                <Button size="small" type="primary" icon={<DollarOutlined />}
                  onClick={() => { payForm.resetFields(); payForm.setFieldValue('amount', Number(invoice.balance)); setPayModal(true) }}>
                  + Pago
                </Button>
              )}
            >
              <Table
                dataSource={invoice.payments}
                columns={paymentColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}

          {/* Sin pagos — mensaje compacto sin botón redundante */}
          {(invoice.payments ?? []).length === 0 && canPay && (
            <div style={{ color: '#8c8c8c', fontSize: 13, padding: '8px 0 4px', textAlign: 'center' }}>
              Sin pagos registrados — usa <strong>Aplicar pago</strong> en el panel derecho
            </div>
          )}
        </Col>

        {/* \u0000\u0000 RIGHT sidebar \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
        <Col style={{ width: 270, flexShrink: 0 }}>

          {/* Estado de cobro */}
          <Card size="small" title="Estado de cobro" style={{ marginBottom: 12 }}>
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Statistic title="Total" value={Number(invoice.total)} prefix="Q" precision={2}
                  valueStyle={{ fontSize: 14, color: '#1B3A6B' }} />
              </Col>
              <Col span={12}>
                <Statistic title="Cobrado" value={Number(invoice.paidAmount)} prefix="Q" precision={2}
                  valueStyle={{ fontSize: 14, color: '#52c41a' }} />
              </Col>
            </Row>
            <Progress
              percent={Math.min(100, balancePct)}
              strokeColor="#52c41a"
              size="small"
              format={(p) => `${p}%`}
            />
            <Statistic
              title={<span style={{ color: Number(invoice.balance) > 0 ? '#ff4d4f' : '#52c41a' }}>Saldo pendiente</span>}
              value={Number(invoice.balance)}
              prefix="Q" precision={2}
              valueStyle={{ color: Number(invoice.balance) > 0 ? '#ff4d4f' : '#52c41a', fontSize: 22 }}
              style={{ marginTop: 8 }}
            />
          </Card>

          {/* Quick actions for sent invoices */}
          {isSent && (
            <Card size="small" title="Acciones rápidas" style={{ marginBottom: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {canPay && (
                  <Button
                    block
                    type="primary"
                    icon={<DollarOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => {
                      payForm.resetFields()
                      payForm.setFieldValue('amount', Number(invoice.balance))
                      setPayModal(true)
                    }}
                  >
                    Aplicar pago
                  </Button>
                )}
                {canPay && (
                  <Button
                    block
                    icon={<ThunderboltOutlined />}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    onClick={openAnticipoModal}
                  >
                    Aplicar anticipo
                  </Button>
                )}
                <Button block icon={<SendOutlined />} onClick={() => setSendModal(true)}>
                  Reenviar por email
                </Button>
                {canWriteOff && (
                  <Button block danger icon={<ExclamationCircleOutlined />} onClick={() => setWriteOffModal(true)}>
                    Condonar saldo
                  </Button>
                )}
              </Space>
            </Card>
          )}

          {/* FEL status card */}
          <Card size="small" title={<><SafetyCertificateOutlined /> FEL Guatemala</>} style={{ marginBottom: 12 }}>
            {isFelCertified ? (
              <>
                <Badge status="success" text="Certificada" />
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <div><Text type="secondary">Tipo: </Text><Tag color="blue" style={{ marginLeft: 4 }}>{invoice.felTipoDocumento}</Tag></div>
                  <div><Text type="secondary">Serie: </Text><Text code>{invoice.felSerie}</Text></div>
                  <div><Text type="secondary">No.: </Text><Text code>{invoice.felNumero}</Text></div>
                  {invoice.felCertificadaAt && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(invoice.felCertificadaAt).format('DD/MM/YYYY HH:mm')}
                      </Text>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Badge status="warning" text="Pendiente de emisión" />
                <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                  Tipo: <Tag>{invoice.felTipoDocumento || 'FACT'}</Tag>
                  {invoice.lugarExpedicion && (
                    <div style={{ marginTop: 4 }}>📍 {invoice.lugarExpedicion}</div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Partida contable resumen */}
          <Card
            size="small"
            title={<><BookOutlined /> Contabilidad</>}
            style={{ marginBottom: 12 }}
            extra={<Button size="small" type="link" onClick={() => setShowJournal(v => !v)}>{showJournal ? 'Ocultar' : 'Ver asiento'}</Button>}
          >
            <div style={{ fontSize: 12 }}>
              {journalEntries.map((l, i) => (
                <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < journalEntries.length - 1 ? 4 : 0 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{l.cuenta}</Text>
                  {l.debe > 0
                    ? <Text style={{ color: '#1890ff', fontSize: 11 }}>{fmt(l.debe)}</Text>
                    : <Text style={{ color: '#52c41a', fontSize: 11 }}>{fmt(l.haber)}</Text>
                  }
                </div>
              ))}
            </div>
          </Card>

        </Col>
      </Row>

      {/* \u0000\u0000 Payment Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><DollarOutlined /> Registrar pago — {invoice.invoiceNumber}</>}
        open={payModal} onOk={handlePayment} onCancel={() => setPayModal(false)}
        okText="Registrar pago"
        okButtonProps={{ loading: saving, style: { background: '#52c41a', borderColor: '#52c41a' } }}
        width={520}
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} prefix="Q"
                  max={Number(invoice.balance)} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="mode" label="Forma de pago" initialValue="bank_transfer">
                <Select options={PAYMENT_MODES} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankAccountId" label="Cuenta bancaria">
                <Select allowClear placeholder="Sin cuenta específica"
                  options={accounts.map(a => ({ value: a.id, label: `${a.name}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reference" label="Referencia / # comprobante">
            <Input placeholder="Ej: TRF-2025-001, cheque #123" />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 4 }}
            message={`Saldo pendiente: ${fmt(invoice.balance)}`}
            description={Number(invoice.balance) === Number(invoice.total) ? 'Este pago saldará la factura completamente.' : 'Pago parcial — quedará saldo pendiente.'}
          />
        </Form>
      </Modal>

      {/* \u0000\u0000 Anticipo Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><ThunderboltOutlined style={{ color: '#722ed1' }} /> Aplicar anticipo — {invoice.invoiceNumber}</>}
        open={anticipoModal}
        onCancel={() => setAnticipoModal(false)}
        onOk={handleApplyAnticipo}
        okText="Aplicar anticipo"
        okButtonProps={{ loading: saving, style: { background: '#722ed1', borderColor: '#722ed1' }, disabled: !selectedAntId || anticipoAmount <= 0 }}
        cancelText="Cancelar"
        width={520}
      >
        {loadingAnt ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : anticipos.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="Sin anticipos disponibles para este cliente"
            description={
              <span>
                No hay anticipos (prepagos) con saldo disponible para <strong>{invoice.customerName}</strong>.
                Los anticipos se registran creando una <em>Factura de tipo Anticipo</em> para el cliente.
              </span>
            }
          />
        ) : (
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="Anticipo a aplicar" required>
              <Select
                placeholder="Seleccionar anticipo..."
                style={{ width: '100%' }}
                value={selectedAntId}
                onChange={(val) => {
                  setSelectedAntId(val)
                  const ant = anticipos.find(a => a.id === val)
                  if (ant) setAnticipoAmount(Math.min(Number(ant.balance), Number(invoice.balance)))
                }}
                options={anticipos.map(a => ({
                  value: a.id,
                  label: `${a.invoiceNumber} — Q ${Number(a.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })} disponible`,
                }))}
              />
            </Form.Item>
            {selectedAntId && (() => {
              const ant = anticipos.find(a => a.id === selectedAntId)!
              const maxAmt = Math.min(Number(ant.balance), Number(invoice.balance))
              return (
                <>
                  <Form.Item label={`Monto a aplicar (máx Q ${maxAmt.toLocaleString('es-GT', { minimumFractionDigits: 2 })})`}>
                    <InputNumber
                      style={{ width: '100%' }}
                      prefix="Q"
                      min={0.01}
                      max={maxAmt}
                      step={0.01}
                      precision={2}
                      value={anticipoAmount}
                      onChange={(v) => setAnticipoAmount(v ?? maxAmt)}
                    />
                  </Form.Item>
                  <Alert
                    type="info"
                    showIcon
                    message={`Anticipo ${ant.invoiceNumber} · Saldo disponible: Q ${Number(ant.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                    description={`Se aplicarán Q ${(anticipoAmount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} al saldo pendiente de la factura. Póliza: Dr Anticipos de Clientes → Cr Cuentas por Cobrar.`}
                  />
                </>
              )
            })()}
          </Form>
        )}
      </Modal>

      {/* \u0000\u0000 Write-off Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> Condonar saldo</>}
        open={writeOffModal} onOk={handleWriteOff} onCancel={() => setWriteOffModal(false)}
        okText="Condonar saldo" okButtonProps={{ loading: saving, danger: true }}
      >
        <Alert
          type="warning"
          showIcon
          message={`Se condonará el saldo pendiente de ${fmt(invoice.balance)}.`}
          description="Esta acción marca la factura como 'Condonada', registra el saldo como incobrable y genera automáticamente el asiento contable: Dr Gastos por Cuentas Incobrables → Cr Cuentas por Cobrar. No se puede deshacer."
          style={{ marginBottom: 16 }}
        />
        <Form form={writeOffForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de condonación" rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Describe el motivo de la condonación del saldo…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* \u0000\u0000 Void Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><StopOutlined /> {isFelCertified ? 'Anular DTE ante SAT' : 'Anular factura'}</>}
        open={voidModal}
        onOk={handleVoid}
        onCancel={() => { setVoidModal(false); voidForm.resetFields() }}
        okText={isFelCertified ? 'Anular ante SAT y en sistema' : 'Anular'}
        okButtonProps={{ loading: saving, danger: true }}
        width={480}
      >
        {isFelCertified ? (
          <Alert
            type="error"
            showIcon
            message="Anulación de Factura Electrónica (FEL)"
            description={
              <span>
                Esta factura está <strong>certificada ante el SAT</strong>. Al anular:<br />
                1. Se enviará la solicitud de anulación a FELPlex/SAT con el UUID <code style={{ fontSize: 11 }}>{invoice?.felUuid}</code><br />
                2. Si el SAT aprueba, la factura quedará anulada en el sistema.<br />
                3. Si el SAT rechaza, no se realizará ningún cambio.
              </span>
            }
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Alert type="warning" message="Esta acción no se puede deshacer." showIcon style={{ marginBottom: 16 }} />
        )}
        <Form form={voidForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Motivo de anulación"
            rules={[{ required: true, message: 'El motivo es requerido' }]}
            extra={isFelCertified ? 'Este motivo se enviará al SAT como justificación de la anulación.' : undefined}
          >
            <Input.TextArea rows={3} placeholder="Describe el motivo de la anulación…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* \u0000\u0000 Emitir FEL Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><SafetyCertificateOutlined style={{ color: '#1B3A6B' }} /> Emitir Factura Electrónica (FEL)</>}
        open={emitirFelModal}
        onCancel={() => setEmitirFelModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setEmitirFelModal(false)}>Cancelar</Button>,
          <Button
            key="emit"
            type="primary"
            loading={emittingFel}
            icon={<SafetyCertificateOutlined />}
            style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}
            onClick={handleEmitirFel}
          >
            Certificar ante SAT
          </Button>,
        ]}
        width={520}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Esta acción enviará la factura al certificador FelPlex para su validación ante el SAT de Guatemala."
          description="Una vez certificada no podrá modificarse. Se generarán automáticamente: UUID, Serie, Número, Autorización y URL de verificación."
        />
        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><Text type="secondary">Factura:</Text> <Text strong>{invoice.invoiceNumber}</Text></div>
            <div><Text type="secondary">Tipo doc.:</Text> <Tag color="blue">{invoice.felTipoDocumento || 'FACT'}</Tag></div>
            <div><Text type="secondary">Cliente:</Text> <Text>{invoice.customerName}</Text></div>
            <div><Text type="secondary">NIT:</Text> <Text>{invoice.customerTaxId || 'CF'}</Text></div>
            <div><Text type="secondary">Total:</Text> <Text strong style={{ color: '#1B3A6B' }}>Q {Number(invoice.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text></div>
            <div><Text type="secondary">Exenta:</Text> <Text>{invoice.facturaExenta ? 'Sí' : 'No'}</Text></div>
            {invoice.lugarExpedicion && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Text type="secondary">Lugar:</Text> <Text>{invoice.lugarExpedicion}</Text>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* \u0000\u0000 Send Modal \u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000 */}
      <Modal
        title={<><SendOutlined /> Enviar factura por correo</>}
        open={sendModal} onOk={handleSend} onCancel={() => setSendModal(false)}
        okText="Enviar" okButtonProps={{ loading: saving, style: { background: '#1B3A6B' } }}
      >
        <Form form={sendForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="to" label="Correo del destinatario" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="cliente@empresa.com" />
          </Form.Item>
          <Form.Item name="subject" label="Asunto"
            initialValue={`Factura ${invoice.invoiceNumber} — ${invoice.customerName}`}>
            <Input />
          </Form.Item>
          <Form.Item name="message" label="Mensaje">
            <Input.TextArea rows={3} placeholder="Mensaje adicional para el cliente…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
