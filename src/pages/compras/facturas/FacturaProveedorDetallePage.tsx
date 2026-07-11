import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getApiError } from '../../../api/axios'
import {
  Button, Typography, Tag, Table, Divider, Spin, message,
  Modal, Form, Input, InputNumber, Select, DatePicker, Alert, Popconfirm, Space,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckOutlined, DollarOutlined,
  SyncOutlined, StopOutlined, DeleteOutlined, GlobalOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBill, approveBill, voidBill, deleteBill, regenerateBillJournalEntry,
  getJournalEntry, recordBillPayment, getVendorAdvances, applyVendorAdvanceToBill,
  updateBill,
  BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice, type JournalEntry, type JournalEntryLine, type VendorAdvance,
} from '../../../api/compras'
import { getBankAccounts } from '../../../api/bancos'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const fmtQ   = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: number, cur = 'GTQ') => `${cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const PAYMENT_MODE_LABELS: Record<string, string> = {
  bank_transfer: 'Transferencia bancaria', cash: 'Efectivo',
  check: 'Cheque', credit_card: 'Tarjeta crédito', debit_card: 'Tarjeta débito', other: 'Otro',
}

export default function FacturaProveedorDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [bill,         setBill]         = useState<PurchaseInvoice | null>(null)
  const [company,      setCompany]      = useState<OrganizationProfile>({ name: '' })
  const [journal,      setJournal]      = useState<JournalEntry | null>(null)
  const [reclasEntry,  setReclasEntry]  = useState<JournalEntry | null>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [advances,     setAdvances]     = useState<VendorAdvance[]>([])
  const [loading,      setLoading]      = useState(true)
  const [approving,    setApproving]    = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [voiding,      setVoiding]      = useState(false)
  const [showVoid,     setShowVoid]     = useState(false)
  const [showPay,      setShowPay]      = useState(false)
  const [paying,       setPaying]       = useState(false)
  const [showAdv,      setShowAdv]      = useState(false)
  const [loadingAdv,   setLoadingAdv]   = useState(false)
  const [applyingAdv,  setApplyingAdv]  = useState(false)
  const [selectedAdvId, setSelectedAdvId] = useState<string | undefined>()
  const [advAmount,    setAdvAmount]    = useState(0)
  const [voidForm]  = Form.useForm()
  const [payForm]   = Form.useForm()
  const [showEdit,   setShowEdit]   = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm]  = Form.useForm()

  const loadBill = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [b, org] = await Promise.all([
        getBill(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setBill(b)
      setCompany(org)
      if (b.journalEntryId) getJournalEntry(b.journalEntryId).then(setJournal).catch(() => {})
      if (b.reclassificationJournalEntryId) getJournalEntry(b.reclassificationJournalEntryId).then(setReclasEntry).catch(() => {})
    } catch { message.error('No se pudo cargar la factura') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadBill() }, [loadBill])

  const handleApprove = async () => {
    if (!bill) return
    setApproving(true)
    try {
      await approveBill(bill.id)
      message.success('Factura aprobada — póliza contable generada')
      loadBill()
    } catch (e: any) { message.error(getApiError(e, 'Error al aprobar')) }
    finally { setApproving(false) }
  }

  const handlePay = async () => {
    try { await payForm.validateFields() } catch { return }
    setPaying(true)
    try {
      const vals = payForm.getFieldsValue()
      await recordBillPayment(bill!.id, {
        amount:        vals.amount,
        paymentDate:   vals.paymentDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        mode:          vals.mode || 'bank_transfer',
        reference:     vals.reference,
        bankAccountId: vals.bankAccountId,
      })
      message.success('Pago registrado')
      setShowPay(false); payForm.resetFields(); loadBill()
    } catch (e: any) { message.error(getApiError(e, 'Error al registrar pago')) }
    finally { setPaying(false) }
  }

  const handleVoid = async () => {
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      await voidBill(bill!.id, reason)
      message.success('Factura anulada')
      setShowVoid(false); voidForm.resetFields(); loadBill()
    } catch (e: any) { message.error(getApiError(e, 'Error al anular')) }
    finally { setVoiding(false) }
  }

  const handleDelete = async () => {
    try { await deleteBill(bill!.id); message.success('Factura eliminada'); navigate('/compras/facturas') }
    catch (e: any) { message.error(getApiError(e, 'Error al eliminar')) }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updated = await regenerateBillJournalEntry(bill!.id)
      if (updated.journalEntryId) getJournalEntry(updated.journalEntryId).then(setJournal).catch(() => {})
      if (updated.reclassificationJournalEntryId) getJournalEntry(updated.reclassificationJournalEntryId).then(setReclasEntry).catch(() => {})
      else setReclasEntry(null)
      message.success('Póliza regenerada')
    } catch (e: any) { message.error(getApiError(e, 'Error al regenerar')) }
    finally { setRegenerating(false) }
  }

  const openAdvModal = async () => {
    if (!bill) return
    setSelectedAdvId(undefined); setAdvAmount(0); setLoadingAdv(true); setShowAdv(true)
    try {
      const [open, partial] = await Promise.all([
        getVendorAdvances({ vendorId: bill.vendorId, status: 'open', limit: 50 }),
        getVendorAdvances({ vendorId: bill.vendorId, status: 'partial', limit: 50 }),
      ])
      setAdvances([...(open.data ?? []), ...(partial.data ?? [])])
    } catch { message.error('No se pudieron cargar los anticipos') }
    finally { setLoadingAdv(false) }
  }

  const handleApplyAdv = async () => {
    if (!selectedAdvId || !bill) return
    setApplyingAdv(true)
    try {
      await applyVendorAdvanceToBill(selectedAdvId, bill.id, advAmount || undefined)
      message.success('Anticipo aplicado')
      setShowAdv(false); loadBill()
    } catch (e: any) { message.error(getApiError(e, 'Error al aplicar anticipo')) }
    finally { setApplyingAdv(false) }
  }

  const openEditModal = () => {
    editForm.setFieldsValue({
      accountingDate: bill?.accountingDate ? dayjs(bill.accountingDate) : null,
      dueDate:        bill?.dueDate        ? dayjs(bill.dueDate)        : null,
      notes:          bill?.notes ?? '',
    })
    setShowEdit(true)
  }

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      const vals = editForm.getFieldsValue()
      await updateBill(bill!.id, {
        accountingDate: vals.accountingDate?.format('YYYY-MM-DD') ?? undefined,
        dueDate:        vals.dueDate?.format('YYYY-MM-DD')        ?? undefined,
        notes:          vals.notes ?? undefined,
      } as any)
      message.success('Factura actualizada')
      setShowEdit(false)
      loadBill()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al guardar'))
    } finally { setEditSaving(false) }
  }

  const openPayModal = () => {
    getBankAccounts({ status: 'active' }).then(r => setBankAccounts(Array.isArray(r) ? r : (r as any)?.data ?? [])).catch(() => {})
    payForm.resetFields()
    payForm.setFieldsValue({ paymentDate: dayjs(), mode: 'bank_transfer', amount: Number(bill?.balance ?? 0) })
    setShowPay(true)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!bill)   return <div style={{ padding: 40 }}><Text>Factura no encontrada</Text></div>

  const statusCfg  = BILL_STATUS_CONFIG[bill.status] ?? { label: bill.status, color: 'default' }
  const typeCfg    = BILL_TYPE_CONFIG[bill.invoiceType] ?? { label: bill.invoiceType }
  const canEdit       = ['draft', 'pending_approval'].includes(bill.status)
  const canEditOpen   = !['voided', 'paid'].includes(bill.status)   // edición limitada post-aprobación
  const canApprove    = ['draft', 'pending_approval'].includes(bill.status)
  const canPay     = ['open', 'partial', 'overdue'].includes(bill.status) && Number(bill.balance) > 0
  const canVoid    = ['open', 'partial', 'overdue'].includes(bill.status)
  const hasFel     = !!bill.felSerie || !!bill.felNumber || !!bill.felUuid
  const isReimb    = bill.isExpenseReimbursement

  const ribbonColors: Record<string, string> = {
    voided: '#ff4d4f', draft: '#8c8c8c', paid: '#52c41a',
    open: '#fa8c16', partial: '#1890ff', overdue: '#ff4d4f', pending_approval: '#722ed1',
  }
  const ribbonColor = ribbonColors[bill.status] ?? '#8c8c8c'

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

  const journalCols = [
    { title: 'CUENTA', dataIndex: 'cuenta', render: (v: string) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'UBICACIÓN', width: 160, render: () => <Text type="secondary" style={{ fontSize: 12 }}>{company.name ?? '—'}</Text> },
    {
      title: 'DÉBITO', dataIndex: 'debit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
    {
      title: 'CRÉDITO', dataIndex: 'credit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace', color: v > 0 ? '#389e0d' : undefined }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
  ]

  const makeJournalRows = (je: JournalEntry) =>
    (je.lines ?? []).map(l => ({
      key: l.id, cuenta: `${l.accountCode} — ${l.accountName}`, debit: Number(l.debit), credit: Number(l.credit),
    }))

  const totalRetention = Number(bill.isrRetentionAmount ?? 0) + Number(bill.ivaRetentionAmount ?? 0)
  const netPayable     = Number(bill.total) + Number(bill.idpAmount ?? 0) - totalRetention

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/compras/facturas')}>
          Facturas proveedor
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        <Divider type="vertical" />
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/compras/facturas/${bill.id}/editar`)}>
            Editar
          </Button>
        )}
        {!canEdit && canEditOpen && (
          <Button icon={<EditOutlined />} onClick={openEditModal}>
            Editar
          </Button>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckOutlined />} loading={approving} onClick={handleApprove}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}>
            Aprobar
          </Button>
        )}
        {canPay && (
          <Button type="primary" icon={<DollarOutlined />} onClick={openPayModal}
            style={{ background: '#1B3A6B', borderColor: '#1B3A6B' }}>
            Registrar pago
          </Button>
        )}
        {canPay && (
          <Button icon={<ThunderboltOutlined />} onClick={openAdvModal}
            style={{ color: '#722ed1', borderColor: '#722ed1' }}>
            Aplicar anticipo
          </Button>
        )}
        {!canEdit && bill.status !== 'voided' && (
          <Button icon={<SyncOutlined />} loading={regenerating} onClick={handleRegenerate}
            style={{ color: '#722ed1', borderColor: '#722ed1' }}>
            Regenerar póliza
          </Button>
        )}
        {canVoid && (
          <Button danger icon={<StopOutlined />} onClick={() => setShowVoid(true)}>Anular</Button>
        )}
        {canEdit && (
          <Popconfirm title="¿Eliminar esta factura?" onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        )}
      </div>

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
            <Title level={3} style={{ margin: '0 0 4px', color: '#1B3A6B' }}>Factura Proveedor</Title>
            <Tag style={{ marginBottom: 12 }}>{typeCfg.label}</Tag>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                {canPay ? 'Saldo pendiente' : 'Total factura'}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: canPay ? '#fa8c16' : '#1B3A6B' }}>
                {fmtGTQ(canPay ? Number(bill.balance) : Number(bill.total), bill.currency)}
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Proveedor + Metadatos */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Factura de
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1B3A6B', display: 'block' }}>{bill.vendorName}</Text>
            {bill.vendorTaxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {bill.vendorTaxId}</Text>}
            {isReimb && bill.employeeName && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#f5f0ff', borderRadius: 6 }}>
                <Text style={{ fontSize: 12, color: '#722ed1' }}>Reembolso → {bill.employeeName}</Text>
              </div>
            )}
            {bill.notes && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Notas</Text>
                <Text style={{ fontSize: 12 }}>{bill.notes}</Text>
              </div>
            )}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, width: '50%' }}>Número interno</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{bill.invoiceNumber}</Text>
                  </td>
                </tr>
                {bill.vendorInvoiceNumber && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Número proveedor</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ fontFamily: 'monospace' }}>{bill.vendorInvoiceNumber}</Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Fecha factura</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(bill.invoiceDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {bill.dueDate && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Vencimiento</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ color: canPay && dayjs(bill.dueDate).isBefore(dayjs()) ? '#ff4d4f' : undefined }}>
                        {dayjs(bill.dueDate).format('DD MMM YYYY')}
                      </Text>
                    </td>
                  </tr>
                )}
                {bill.felSerie && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Serie FEL</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{bill.felSerie}</Text></td>
                  </tr>
                )}
                {bill.felNumber && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Número SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{bill.felNumber}</Text></td>
                  </tr>
                )}
                {bill.felAuthNumber && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Autorización SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{bill.felAuthNumber}</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table columns={itemColumns} dataSource={bill.items ?? []} rowKey={(_, i) => String(i)}
            pagination={false} size="small" scroll={{ x: 620 }}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 300 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">Subtotal</Text>
                <Text style={{ fontFamily: 'monospace' }}>{fmtGTQ(Number(bill.subtotal), bill.currency)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA</Text>
                <Text style={{ fontFamily: 'monospace' }}>{fmtGTQ(Number(bill.taxAmount), bill.currency)}</Text>
              </div>
              {Number(bill.idpAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#d97706' }}>IDP Combustible</Text>
                  <Text style={{ color: '#d97706', fontFamily: 'monospace' }}>+{fmtGTQ(Number(bill.idpAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.isrRetentionAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#722ed1' }}>Retención ISR</Text>
                  <Text style={{ color: '#722ed1', fontFamily: 'monospace' }}>−{fmtGTQ(Number(bill.isrRetentionAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.ivaRetentionAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#dc2626' }}>Retención IVA</Text>
                  <Text style={{ color: '#dc2626', fontFamily: 'monospace' }}>−{fmtGTQ(Number(bill.ivaRetentionAmount), bill.currency)}</Text>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              {totalRetention > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text strong>Neto a pagar proveedor</Text>
                  <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtGTQ(netPayable, bill.currency)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total factura</Text>
                <Text strong style={{ fontSize: 14, color: '#1B3A6B', fontFamily: 'monospace' }}>{fmtGTQ(Number(bill.total), bill.currency)}</Text>
              </div>
              {Number(bill.paidAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text type="secondary">Pagado</Text>
                  <Text style={{ color: '#52c41a', fontFamily: 'monospace' }}>−{fmtGTQ(Number(bill.paidAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.balance) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text strong style={{ fontSize: 14, color: '#fa8c16' }}>Saldo pendiente</Text>
                  <Text strong style={{ fontSize: 14, color: '#fa8c16', fontFamily: 'monospace' }}>{fmtGTQ(Number(bill.balance), bill.currency)}</Text>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Más información ─────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px', background: '#fafafa' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° interno</Text>
            <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{bill.invoiceNumber}</Text>
            <Text type="secondary">Tipo</Text><Text>{typeCfg.label}</Text>
            <Text type="secondary">Moneda</Text><Text>{bill.currency}{bill.currency !== 'GTQ' && ` (TC: ${Number(bill.exchangeRate).toFixed(6)})`}</Text>
            {bill.accountingDate && <><Text type="secondary">Fecha contabilización</Text><Text>{dayjs(bill.accountingDate).format('DD/MM/YYYY')}</Text></>}
            {bill.paymentTerms && <><Text type="secondary">Términos de pago</Text><Text>{bill.paymentTerms === 'immediate' ? 'Contado' : bill.paymentTerms}</Text></>}
            {bill.purchaseOrderId && <><Text type="secondary">Orden de compra</Text><Link to={`/compras/ordenes/${bill.purchaseOrderId}`} style={{ color: '#1B3A6B' }}>Ver OC</Link></>}
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
          </div>

          {hasFel && (
            <>
              <Divider style={{ margin: '16px 0 14px' }} />
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 12 }}>
                Campos FEL / SAT
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
                {bill.felSerie && <><Text type="secondary">Serie</Text><Text style={{ fontFamily: 'monospace' }}>{bill.felSerie}</Text></>}
                {bill.felNumber && <><Text type="secondary">Número</Text><Text style={{ fontFamily: 'monospace' }}>{bill.felNumber}</Text></>}
                {bill.felAuthNumber && <><Text type="secondary">Autorización</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{bill.felAuthNumber}</Text></>}
                {bill.felUuid && <><Text type="secondary">UUID</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{bill.felUuid}</Text></>}
                {bill.felCertDate && <><Text type="secondary">Fecha certificación</Text><Text>{dayjs(bill.felCertDate).format('DD/MM/YYYY HH:mm:ss')}</Text></>}
                {(bill as any).felUrl && (
                  <>
                    <Text type="secondary">URL</Text>
                    <a href={(bill as any).felUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      <GlobalOutlined style={{ marginRight: 4 }} />{(bill as any).felUrl}
                    </a>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Diario ─────────────────────────────────────────────────────── */}
        {(journal || reclasEntry) && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: '20px 40px 28px' }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
                Diario
              </Text>

              {journal && (
                <>
                  <Space size={8} style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
                      Póliza de compra — {journal.entryNumber}
                    </Text>
                    <Tag color={journal.status === 'posted' ? 'green' : 'default'} style={{ margin: 0 }}>
                      {journal.status === 'posted' ? 'Publicada' : journal.status}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(journal.entryDate).format('DD/MM/YYYY')}</Text>
                  </Space>
                  <Table dataSource={makeJournalRows(journal)} columns={journalCols} rowKey="key"
                    size="small" pagination={false}
                    style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', marginBottom: reclasEntry ? 16 : 0 }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row style={{ background: '#fafafa' }}>
                          <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>{Number(journal.totalDebit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            <Text strong style={{ fontSize: 12, fontFamily: 'monospace', color: '#389e0d' }}>{Number(journal.totalCredit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                </>
              )}

              {reclasEntry && (
                <>
                  <Space size={8} style={{ marginBottom: 8, marginTop: journal ? 0 : 0 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1' }}>
                      Reclasificación — {reclasEntry.entryNumber}
                    </Text>
                    <Tag color="purple" style={{ margin: 0 }}>CxP Proveedor → CxP Empleado</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(reclasEntry.entryDate).format('DD/MM/YYYY')}</Text>
                  </Space>
                  <Table dataSource={makeJournalRows(reclasEntry)} columns={journalCols} rowKey="key"
                    size="small" pagination={false}
                    style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }} />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modales ─────────────────────────────────────────────────────────── */}
      <Modal title="Registrar pago" open={showPay}
        onCancel={() => { setShowPay(false); payForm.resetFields() }}
        onOk={handlePay} confirmLoading={paying} okText="Registrar pago"
        okButtonProps={{ style: { background: '#1B3A6B' } }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Saldo pendiente: <Text strong style={{ color: '#fa8c16' }}>{fmtGTQ(Number(bill.balance), bill.currency)}</Text>
        </Text>
        <Form form={payForm} layout="vertical">
          <Form.Item name="amount" label="Monto pagado"
            rules={[{ required: true, message: 'Ingresa el monto' }, { type: 'number', max: Number(bill.balance), message: `Máximo ${fmtQ(Number(bill.balance))}` }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix={bill.currency === 'GTQ' ? 'Q' : bill.currency} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="paymentDate" label="Fecha" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="mode" label="Forma de pago">
              <Select options={Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Form.Item>
          </div>
          <Form.Item name="bankAccountId" label="Cuenta bancaria">
            <Select allowClear placeholder="Seleccionar..."
              options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.name} — ${b.currency}` }))} />
          </Form.Item>
          <Form.Item name="reference" label="Referencia / N° cheque">
            <Input placeholder="Ej: TRF-20250101" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Anular factura" open={showVoid}
        onCancel={() => { setShowVoid(false); voidForm.resetFields() }}
        onOk={handleVoid} confirmLoading={voiding} okText="Confirmar anulación"
        okButtonProps={{ danger: true }}>
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="Se revertirán las pólizas contables y la factura quedará anulada." />
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo" rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Error en importes, factura duplicada..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Editar factura"
        open={showEdit}
        onCancel={() => setShowEdit(false)}
        onOk={handleEditSave}
        confirmLoading={editSaving}
        okText="Guardar"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={440}
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="Solo se pueden editar campos informativos. Los montos y la póliza contable no cambian."
        />
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item name="accountingDate" label="Fecha de contabilización">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
              placeholder="Fecha del período contable" />
          </Form.Item>
          <Form.Item name="dueDate" label="Fecha de vencimiento">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={3} placeholder="Observaciones..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Aplicar anticipo" open={showAdv}
        onCancel={() => setShowAdv(false)}
        onOk={handleApplyAdv}
        okText="Aplicar"
        okButtonProps={{ loading: applyingAdv, style: { background: '#722ed1' }, disabled: !selectedAdvId || advAmount <= 0 }}>
        {loadingAdv ? <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          : advances.length === 0
            ? <Alert type="info" showIcon message="Sin anticipos disponibles para este proveedor." />
            : (
              <Form layout="vertical" style={{ marginTop: 8 }}>
                <Form.Item label="Anticipo">
                  <Select placeholder="Seleccionar anticipo..." value={selectedAdvId}
                    onChange={v => { setSelectedAdvId(v); const a = advances.find(x => x.id === v); if (a) setAdvAmount(Math.min(Number(a.balance), Number(bill?.balance ?? 0))) }}
                    options={advances.map(a => ({ value: a.id, label: `${a.advanceNumber} — Q ${Number(a.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })} disponible` }))} />
                </Form.Item>
                {selectedAdvId && (
                  <Form.Item label="Monto a aplicar">
                    <InputNumber style={{ width: '100%' }} min={0.01} max={Math.min(Number(advances.find(a => a.id === selectedAdvId)?.balance ?? 0), Number(bill?.balance ?? 0))}
                      precision={2} prefix="Q" value={advAmount} onChange={v => setAdvAmount(Number(v ?? 0))} />
                  </Form.Item>
                )}
              </Form>
            )}
      </Modal>
    </div>
  )
}
