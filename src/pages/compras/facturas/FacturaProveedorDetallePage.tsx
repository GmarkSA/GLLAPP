import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getApiError } from '../../../api/axios'
import {
  Button, Typography, Tag, Table, Divider, Spin, message,
  Modal, Form, Input, InputNumber, Select, DatePicker, Alert, Popconfirm, Space,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckOutlined, DollarOutlined,
  SyncOutlined, StopOutlined, DeleteOutlined, GlobalOutlined, ThunderboltOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBill, approveBill, voidBill, deleteBill, regenerateBillJournalEntry,
  getJournalEntry, recordBillPayment, getVendorAdvances, applyVendorAdvanceToBill,
  updateBill,
  BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice, type JournalEntry, type JournalEntryLine, type VendorAdvance, type BillItem,
} from '../../../api/compras'
import { getBankAccounts } from '../../../api/bancos'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { useCentrosOptions } from '../../../components/SelectorDimensionesAnaliticas'

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
  const [inlineEdit,  setInlineEdit]  = useState(false)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [editedItems,  setEditedItems]  = useState<BillItem[]>([])
  const [taxOptions,   setTaxOptions]   = useState<Tax[]>([])
  const [centrosCosto, centrosBeneficio] = useCentrosOptions()

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

  const enterInlineEdit = () => {
    if (taxOptions.length === 0) {
      getTaxes().then((res: any) => setTaxOptions(Array.isArray(res) ? res : (res?.data ?? []))).catch(() => {})
    }
    setEditedItems((bill?.items ?? []).map(it => ({ ...it })))
    setInlineEdit(true)
  }

  const cancelInlineEdit = () => { setInlineEdit(false); setEditedItems([]) }

  const saveInlineEdit = async () => {
    setInlineSaving(true)
    try {
      await updateBill(bill!.id, { items: editedItems } as any)
      await regenerateBillJournalEntry(bill!.id)
      message.success('Factura actualizada y póliza recalculada')
      setInlineEdit(false)
      setEditedItems([])
      await loadBill()
    } catch (e: any) {
      message.error(getApiError(e, 'Error al guardar'))
    } finally { setInlineSaving(false) }
  }

  const updateItemTax = (idx: number, taxId: string) => {
    const tax = taxOptions.find(t => t.id === taxId)
    setEditedItems(prev => prev.map((it, i) => i !== idx ? it : {
      ...it,
      taxId,
      taxPercent: tax?.rate ?? it.taxPercent,
    }))
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
  const canEditOpen   = !['voided', 'paid'].includes(bill.status)
  const canEdit       = canEditOpen   // inline edit disponible para cualquier factura no pagada/anulada
  const canApprove    = ['draft', 'pending_approval'].includes(bill.status)
  const canPay     = ['open', 'partial', 'overdue'].includes(bill.status) && Number(bill.balance) > 0
  const canVoid    = ['open', 'partial', 'overdue'].includes(bill.status)
  const hasFel     = !!bill.felSerie || !!bill.felNumber || !!bill.felUuid
  const isReimb    = bill.isExpenseReimbursement

  const ribbonColors: Record<string, string> = {
    voided: '#e5484d', draft: '#6b7280', paid: '#2ea172',
    open: '#ff7f00', partial: '#1faec2', overdue: '#e5484d', pending_approval: '#6b7280',
  }
  const ribbonColor = ribbonColors[bill.status] ?? '#6b7280'

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
    {
      title: 'IVA', dataIndex: 'taxId', width: inlineEdit ? 200 : 80, align: 'center' as const,
      render: (taxId: string, _row: any, idx: number) => {
        if (inlineEdit) {
          return (
            <Select
              size="small"
              value={editedItems[idx]?.taxId ?? taxId}
              style={{ width: '100%' }}
              placeholder="Selecciona código"
              onChange={val => updateItemTax(idx, val)}
              options={taxOptions
                .filter(t => ['purchases', 'both'].includes(t.applicability))
                .map(t => ({ value: t.id, label: `${t.code} — ${t.name}` }))}
            />
          )
        }
        const pct = _row.taxPercent ?? 0
        const tax = taxOptions.find(t => t.id === taxId)
        return <Tag color={tax ? 'blue' : 'default'}>{tax ? `${tax.code} (${pct}%)` : `${pct}%`}</Tag>
      },
    },
    {
      title: 'Total línea', width: 140, align: 'right' as const,
      render: (_v: any, row: any) => {
        const qty      = Number(row.quantity ?? 1)
        const price    = Number(row.unitPrice ?? 0)
        const discount = Number(row.discountPercent ?? 0)
        const total    = qty * price * (1 - discount / 100)
        return <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontSize: 13 }}>{fmtQ(total)}</Text>
      },
    },
  ]

  const journalCols = [
    { title: 'CUENTA', dataIndex: 'cuenta', render: (v: string) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v}</Text> },
    { title: 'UBICACIÓN', width: 140, render: () => <Text type="secondary" style={{ fontSize: 12 }}>{company.name ?? '—'}</Text> },
    {
      title: 'C. COSTO', dataIndex: 'ccNombre', width: 110,
      render: (v: string) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'C. BENEFICIO', dataIndex: 'cbNombre', width: 110,
      render: (v: string) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'DÉBITO', dataIndex: 'debit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
    {
      title: 'CRÉDITO', dataIndex: 'credit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#2ea172' : undefined }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
  ]

  const makeJournalRows = (je: JournalEntry) =>
    (je.lines ?? []).map(l => ({
      key:      l.id,
      cuenta:   `${l.accountCode} — ${l.accountName}`,
      debit:    Number(l.debit),
      credit:   Number(l.credit),
      ccNombre: l.centroCostoId    ? (centrosCosto.find(c => c.id === l.centroCostoId)?.nombre    ?? l.centroCostoId)    : null,
      cbNombre: l.centroBeneficioId ? (centrosBeneficio.find(c => c.id === l.centroBeneficioId)?.nombre ?? l.centroBeneficioId) : null,
    }))

  const totalRetention = Number(bill.isrRetentionAmount ?? 0) + Number(bill.ivaRetentionAmount ?? 0)
  const netPayable     = Number(bill.total) + Number(bill.idpAmount ?? 0) - totalRetention

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/compras/facturas')}>
          Facturas proveedor
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        <Divider type="vertical" />
        {(canEdit || canEditOpen) && !inlineEdit && (
          <Button icon={<EditOutlined />} onClick={canEdit ? enterInlineEdit : openEditModal}>
            Editar
          </Button>
        )}
        {inlineEdit && (
          <>
            <Button type="primary" icon={<SaveOutlined />} loading={inlineSaving} onClick={saveInlineEdit}
              style={{ background: '#2ea172' }}>
              Guardar cambios
            </Button>
            <Button icon={<CloseOutlined />} onClick={cancelInlineEdit} disabled={inlineSaving}>
              Cancelar
            </Button>
          </>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckOutlined />} loading={approving} onClick={handleApprove}
            style={{ background: '#2ea172', borderColor: '#2ea172' }}>
            Aprobar
          </Button>
        )}
        {canPay && (
          <Button type="primary" icon={<DollarOutlined />} onClick={openPayModal}
            style={{ background: '#1faec2', borderColor: '#1faec2' }}>
            Registrar pago
          </Button>
        )}
        {canPay && (
          <Button icon={<ThunderboltOutlined />} onClick={openAdvModal}
            style={{ color: '#6b7280', borderColor: '#6b7280' }}>
            Aplicar anticipo
          </Button>
        )}
        {!['draft', 'pending_approval', 'voided'].includes(bill.status) && (
          <Button icon={<SyncOutlined />} loading={regenerating} onClick={handleRegenerate}
            style={{ color: '#6b7280', borderColor: '#6b7280' }}>
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
            <Title level={3} style={{ margin: '0 0 4px', color: '#0a0a0a' }}>Factura Proveedor</Title>
            <Tag style={{ marginBottom: 12 }}>{typeCfg.label}</Tag>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                {canPay ? 'Saldo pendiente' : 'Total factura'}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: canPay ? '#ff7f00' : '#1faec2' }}>
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
            <Link to={`/compras/proveedores/${bill.vendorId}`} style={{ fontSize: 15, fontWeight: 600, color: '#1faec2', display: 'block' }}>{bill.vendorName}</Link>
            {bill.vendorTaxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {bill.vendorTaxId}</Text>}
            {isReimb && bill.employeeName && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#f5f0ff', borderRadius: 6 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Reembolso → {bill.employeeName}</Text>
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
                  <td style={{ color: '#6b7280', paddingBottom: 6, width: '50%' }}>Número interno</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{bill.invoiceNumber}</Text>
                  </td>
                </tr>
                {bill.vendorInvoiceNumber && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Número proveedor</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.vendorInvoiceNumber}</Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#6b7280', paddingBottom: 6 }}>Fecha factura</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(bill.invoiceDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {bill.dueDate && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Vencimiento</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ color: canPay && dayjs(bill.dueDate).isBefore(dayjs()) ? '#e5484d' : undefined }}>
                        {dayjs(bill.dueDate).format('DD MMM YYYY')}
                      </Text>
                    </td>
                  </tr>
                )}
                {bill.felSerie && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Serie FEL</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felSerie}</Text></td>
                  </tr>
                )}
                {bill.felNumber && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Número SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felNumber}</Text></td>
                  </tr>
                )}
                {bill.felAuthNumber && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Autorización SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{bill.felAuthNumber}</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table columns={itemColumns} dataSource={inlineEdit ? editedItems : (bill.items ?? [])} rowKey={(_, i) => String(i)}
            pagination={false} size="small" scroll={{ x: 620 }}
            style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 300 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">Subtotal</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.subtotal), bill.currency)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.taxAmount), bill.currency)}</Text>
              </div>
              {Number(bill.idpAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#ff7f00' }}>IDP Combustible</Text>
                  <Text style={{ color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>+{fmtGTQ(Number(bill.idpAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.isrRetentionAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#6b7280' }}>Retención ISR</Text>
                  <Text style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>−{fmtGTQ(Number(bill.isrRetentionAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.ivaRetentionAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text style={{ color: '#e5484d' }}>Retención IVA</Text>
                  <Text style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>−{fmtGTQ(Number(bill.ivaRetentionAmount), bill.currency)}</Text>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              {totalRetention > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text strong>Neto a pagar proveedor</Text>
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtGTQ(netPayable, bill.currency)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total factura</Text>
                <Text strong style={{ fontSize: 14, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.total), bill.currency)}</Text>
              </div>
              {Number(bill.paidAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <Text type="secondary">Pagado</Text>
                  <Text style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>−{fmtGTQ(Number(bill.paidAmount), bill.currency)}</Text>
                </div>
              )}
              {Number(bill.balance) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text strong style={{ fontSize: 14, color: '#ff7f00' }}>Saldo pendiente</Text>
                  <Text strong style={{ fontSize: 14, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.balance), bill.currency)}</Text>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Más información ─────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px', background: '#fafbfc' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° interno</Text>
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{bill.invoiceNumber}</Text>
            <Text type="secondary">Tipo</Text><Text>{typeCfg.label}</Text>
            <Text type="secondary">Moneda</Text><Text>{bill.currency}{bill.currency !== 'GTQ' && ` (TC: ${Number(bill.exchangeRate).toFixed(6)})`}</Text>
            {bill.accountingDate && <><Text type="secondary">Fecha contabilización</Text><Text>{dayjs(bill.accountingDate).format('DD/MM/YYYY')}</Text></>}
            {bill.paymentTerms && <><Text type="secondary">Términos de pago</Text><Text>{bill.paymentTerms === 'immediate' ? 'Contado' : bill.paymentTerms}</Text></>}
            {bill.purchaseOrderId && <><Text type="secondary">Orden de compra</Text><Link to={`/compras/ordenes/${bill.purchaseOrderId}`} style={{ color: '#1faec2' }}>Ver OC</Link></>}
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
          </div>

          {hasFel && (
            <>
              <Divider style={{ margin: '16px 0 14px' }} />
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#1faec2', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 12 }}>
                Campos FEL / SAT
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
                {bill.felSerie && <><Text type="secondary">Serie</Text><Text style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felSerie}</Text></>}
                {bill.felNumber && <><Text type="secondary">Número</Text><Text style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felNumber}</Text></>}
                {bill.felAuthNumber && <><Text type="secondary">Autorización</Text><Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, wordBreak: 'break-all' }}>{bill.felAuthNumber}</Text></>}
                {bill.felUuid && <><Text type="secondary">UUID</Text><Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, wordBreak: 'break-all' }}>{bill.felUuid}</Text></>}
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
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
                Diario
              </Text>

              {journal && (
                <>
                  <Space size={8} style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
                      Póliza de compra — {journal.entryNumber}
                    </Text>
                    <Tag color={journal.status === 'posted' ? '#2ea172' : 'default'} style={{ margin: 0 }}>
                      {journal.status === 'posted' ? 'Publicada' : journal.status}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(journal.accountingDate ?? journal.entryDate).format('DD/MM/YYYY')}
                      {journal.accountingDate && journal.accountingDate.slice(0,10) !== journal.entryDate.slice(0,10) && (
                        <span style={{ color: '#aaa' }}> (doc: {dayjs(journal.entryDate).format('DD/MM/YYYY')})</span>
                      )}
                    </Text>
                  </Space>
                  <Table dataSource={makeJournalRows(journal)} columns={journalCols} rowKey="key"
                    size="small" pagination={false}
                    style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: reclasEntry ? 16 : 0 }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row style={{ background: '#fafbfc' }}>
                          <Table.Summary.Cell index={0} colSpan={4}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">
                            <Text strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Number(journal.totalDebit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="right">
                            <Text strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{Number(journal.totalCredit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
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
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                      Reclasificación — {reclasEntry.entryNumber}
                    </Text>
                    <Tag color="#6b7280" style={{ margin: 0 }}>CxP Proveedor → CxP Empleado</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(reclasEntry.entryDate).format('DD/MM/YYYY')}</Text>
                  </Space>
                  <Table dataSource={makeJournalRows(reclasEntry)} columns={journalCols} rowKey="key"
                    size="small" pagination={false}
                    style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }} />
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
        okButtonProps={{ style: { background: '#1faec2' } }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Saldo pendiente: <Text strong style={{ color: '#ff7f00' }}>{fmtGTQ(Number(bill.balance), bill.currency)}</Text>
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
        okButtonProps={{ style: { background: '#1faec2' } }}
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
        okButtonProps={{ loading: applyingAdv, style: { background: '#6b7280' }, disabled: !selectedAdvId || advAmount <= 0 }}>
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
