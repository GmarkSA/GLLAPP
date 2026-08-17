import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, Input, Button,
  Card, Breadcrumb, Typography, Spin, Divider, message,
  Tag, Space, Table,
} from 'antd'
import {
  SaveOutlined, CheckOutlined, HomeOutlined,
  SyncOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createCreditNote, approveCreditNote, getBill, getBills,
  updateBill, voidBill, getJournalEntry, regenerateBillJournalEntry,
  getVendors,
  type JournalEntry, type JournalEntryLine,
} from '../../../api/compras'
import { getExchangeRateForDate } from '../../../api/monedas'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getAccounts, type Account } from '../../../api/catalogo'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import PaymentTermsSelect, { getPaymentTermDays } from '../../../components/PaymentTermsSelect'

const { Text } = Typography
const { Option } = Select

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function NotaCreditoProveedorFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [items,       setItems]       = useState<LineItem[]>([newLineItem()])
  const [taxes,       setTaxes]       = useState<Tax[]>([])
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [vendors,     setVendors]     = useState<{ value: string; label: string; defaultPurchaseTaxId?: string; currency?: string }[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [vendorCurrency, setVendorCurrency] = useState('GTQ')
  const [exchangeRate,   setExchangeRate]   = useState(1)
  const [editingRate,    setEditingRate]    = useState(false)
  const [loadingFx,      setLoadingFx]      = useState(false)
  const [fxMeta,         setFxMeta]         = useState<{ effectiveDate: string; source: string } | null>(null)
  const [loading,     setLoading]     = useState(!!id)
  const [saving,      setSaving]      = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [regenerating,setRegenerating]= useState(false)
  const [docStatus,   setDocStatus]   = useState('draft')
  const [vendorDefaultTaxId, setVendorDefaultTaxId] = useState<string | undefined>()
  const [journalEntry,  setJournalEntry]  = useState<JournalEntry | null>(null)
  const [originalBills, setOriginalBills] = useState<{ value: string; label: string }[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const watchCurr    = Form.useWatch('currency',      form) ?? 'GTQ'
  const invoiceDate  = Form.useWatch('invoiceDate',   form)
  const paymentTerms = Form.useWatch('paymentTerms',  form) as string ?? 'immediate'
  const customDays   = Form.useWatch('paymentTermsDays', form) as number
  const watchVendorId= Form.useWatch('vendorId',      form) as string | undefined

  // ── Load masters ────────────────────────────────────────────────────────────
  useEffect(() => {
    getTaxes().then((r: any) => setTaxes(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => {})
  }, [])

  useEffect(() => {
    getAccounts({ limit: 200 })
      .then((r: any) => {
        const list: Account[] = Array.isArray(r) ? r : (r?.data ?? [])
        setAccounts(list.filter(a => a.isActive && !a.isHeader))
      })
      .catch(() => {})
  }, [])

  const fetchVendors = useCallback((search: string) => {
    setLoadingVendors(true)
    getVendors({ search, limit: 30 })
      .then((r: any) => {
        const list: any[] = Array.isArray(r) ? r : (r?.data ?? [])
        setVendors(prev => {
          const map = new Map(prev.map(v => [v.value, v]))
          list.forEach((v: any) => map.set(v.id, {
            value: v.id,
            label: v.legalName ?? v.name,
            defaultPurchaseTaxId: v.defaultPurchaseTaxId,
            currency: v.currency,
          }))
          return [...map.values()]
        })
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false))
  }, [])

  useEffect(() => { fetchVendors('') }, [fetchVendors])

  // ── Load existing record ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getBill(id)
      .then(bill => {
        setDocStatus(bill.status)
        form.setFieldsValue({
          vendorId:            bill.vendorId,
          invoiceDate:         bill.invoiceDate ? dayjs(bill.invoiceDate) : undefined,
          dueDate:             bill.dueDate     ? dayjs(bill.dueDate)     : undefined,
          paymentTerms:        bill.paymentTerms ?? 'immediate',
          paymentTermsDays:    bill.paymentTermsDays,
          accountingDate:      bill.accountingDate ? dayjs(bill.accountingDate) : undefined,
          currency:            bill.currency ?? 'GTQ',
          vendorInvoiceNumber: bill.vendorInvoiceNumber ?? '',
          felSerie:            bill.felSerie,
          felNumber:           bill.felNumber,
          felUuid:             bill.felUuid,
          felAuthNumber:       bill.felAuthNumber,
          felCertDate:         bill.felCertDate ? dayjs(bill.felCertDate) : undefined,
          notes:               bill.notes,
          originalInvoiceId:   (bill as any).originalInvoiceId ?? undefined,
        })
        if (bill.vendorId && bill.vendorName) {
          setVendors(prev => {
            if (prev.find(v => v.value === bill.vendorId)) return prev
            return [{ value: bill.vendorId, label: bill.vendorName! }, ...prev]
          })
        }
        if (bill.currency && bill.currency !== 'GTQ' && Number(bill.exchangeRate) > 1) {
          setVendorCurrency(bill.currency)
          setExchangeRate(Number(bill.exchangeRate))
        }
        const loadedItems: LineItem[] = (bill.items ?? []).map(it =>
          newLineItem({
            _key: it.id,
            productId:       it.productId,
            description:     it.description,
            unit:            it.unit,
            quantity:        Number(it.quantity),
            unitPrice:       Number(it.unitPrice),
            discountPercent: Number(it.discountPercent ?? 0),
            taxPercent:      Number(it.taxPercent ?? 12),
            taxId:           it.taxId,
            accountId:       it.accountId,
          }),
        )
        setItems(loadedItems.length ? loadedItems : [newLineItem()])
        if (bill.journalEntryId) {
          getJournalEntry(bill.journalEntryId).then(je => setJournalEntry(je)).catch(() => {})
        }
      })
      .catch(() => message.error('No se pudo cargar la nota de crédito'))
      .finally(() => setLoading(false))
  }, [id, form])

  // ── Vendor sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!watchVendorId) return
    const found = vendors.find(v => v.value === watchVendorId)
    if (!found) return
    setVendorDefaultTaxId(found.defaultPurchaseTaxId)
    if (!id && found.currency) {
      form.setFieldValue('currency', found.currency)
      setVendorCurrency(found.currency)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, watchVendorId])

  useEffect(() => {
    if (!watchVendorId) { setOriginalBills([]); return }
    getBills({ vendorId: watchVendorId, limit: 100 })
      .then(res => {
        const list = (res as any)?.data ?? []
        setOriginalBills(
          list
            .filter((b: any) => b.invoiceType !== 'credit_note' && !['draft', 'voided'].includes(b.status))
            .map((b: any) => ({
              value: b.id,
              label: `${b.invoiceNumber} — Q ${Number(b.total ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} (saldo: Q ${Number(b.balance ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })})`,
            }))
        )
      })
      .catch(() => {})
  }, [watchVendorId])

  // ── Due date auto-calc ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!invoiceDate) return
    if (!paymentTerms || paymentTerms === 'immediate') { form.setFieldValue('dueDate', undefined); return }
    const stdDays = getPaymentTermDays(paymentTerms)
    const days    = stdDays !== null ? stdDays : (paymentTerms === 'custom' ? (customDays ?? 30) : 0)
    if (days > 0) form.setFieldValue('dueDate', dayjs(invoiceDate).add(days, 'day'))
  }, [paymentTerms, invoiceDate, customDays, form])

  // ── Exchange rate ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (watchCurr === 'GTQ') {
      setVendorCurrency('GTQ'); setExchangeRate(1); setFxMeta(null); return
    }
    setVendorCurrency(watchCurr)
    const date = invoiceDate ? dayjs(invoiceDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    setLoadingFx(true)
    getExchangeRateForDate(watchCurr, date)
      .then(r => {
        const rate = r.officialRate ?? (r.rate > 0 ? 1 / r.rate : 1)
        setExchangeRate(Number(rate.toFixed(6)))
        setFxMeta({ effectiveDate: r.effectiveDate, source: r.source })
      })
      .catch(() => message.warning('No se pudo cargar el tipo de cambio'))
      .finally(() => setLoadingFx(false))
  }, [watchCurr, invoiceDate])

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = calcTotals(items)

  // ── Build DTO ───────────────────────────────────────────────────────────────
  const buildDto = (status: string) => {
    const vals = form.getFieldsValue()
    return {
      vendorId:            vals.vendorId,
      invoiceType:         'credit_note',
      invoiceDate:         vals.invoiceDate ? vals.invoiceDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      accountingDate:      vals.accountingDate ? vals.accountingDate.format('YYYY-MM-DD') : undefined,
      dueDate:             vals.dueDate ? vals.dueDate.format('YYYY-MM-DD') : undefined,
      currency:            vals.currency ?? 'GTQ',
      exchangeRate:        vendorCurrency !== 'GTQ' ? exchangeRate : 1,
      paymentTerms:        vals.paymentTerms ?? 'immediate',
      paymentTermsDays:    vals.paymentTerms === 'custom' ? vals.paymentTermsDays : undefined,
      vendorInvoiceNumber: vals.vendorInvoiceNumber || undefined,
      felSerie:            vals.felSerie    || undefined,
      felNumber:           vals.felNumber   || undefined,
      felUuid:             vals.felUuid     || undefined,
      felAuthNumber:       vals.felAuthNumber || undefined,
      felCertDate:         vals.felCertDate ? vals.felCertDate.toISOString() : undefined,
      notes:               vals.notes,
      originalInvoiceId:   vals.originalInvoiceId || undefined,
      status,
      items: items.map(it => ({
        productId:       it.productId,
        description:     it.description,
        unit:            it.unit,
        quantity:        it.quantity,
        unitPrice:       it.unitPrice,
        discountPercent: it.discountPercent,
        taxPercent:      it.taxPercent,
        taxInclusive:    it.taxInclusive ?? true,
        taxId:           it.taxId,
        accountId:       it.accountId,
      })),
    }
  }

  const handleSaveDraft = async () => {
    try { await form.validateFields(['vendorId', 'invoiceDate']) } catch { return }
    setSaving(true)
    try {
      const dto = buildDto('draft')
      const result: any = id ? await updateBill(id, dto as any) : await createCreditNote(dto as any)
      message.success('Guardada como borrador')
      navigate(`/compras/notas-credito-proveedor/${result.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleSaveAndOpen = async () => {
    try { await form.validateFields(['vendorId', 'invoiceDate']) } catch { return }
    setApproving(true)
    try {
      const dto = buildDto('draft')
      const result: any = id ? await updateBill(id, dto as any) : await createCreditNote(dto as any)
      const docId = result.id ?? id
      await approveCreditNote(docId)
      message.success('Nota de crédito abierta — póliza de reversión generada')
      navigate(`/compras/notas-credito-proveedor/${docId}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al abrir')
    } finally { setApproving(false) }
  }

  const handleRegenerate = async () => {
    if (!id) return
    setRegenerating(true)
    try {
      const updated = await regenerateBillJournalEntry(id)
      if (updated.journalEntryId) {
        const je = await getJournalEntry(updated.journalEntryId)
        setJournalEntry(je)
      }
      message.success('Póliza regenerada')
    } catch (e: any) {
      message.error('Error: ' + (e?.response?.data?.message ?? 'intente de nuevo'))
    } finally { setRegenerating(false) }
  }

  const handleVoid = async () => {
    if (!id) return
    try {
      await voidBill(id)
      message.success('Nota de crédito anulada')
      navigate('/compras/notas-credito-proveedor')
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error al anular') }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )

  const allAccounts = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))
  const canApprove  = ['draft', 'pending_approval'].includes(docStatus) || !id

  return (
    <div>
      {/* ── Barra superior: breadcrumb + acciones ──────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Breadcrumb items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/notas-credito-proveedor">Notas de Crédito Proveedor</Link> },
          { title: <span style={{ color: '#e5484d' }}>{id ? 'Editar' : 'Nueva'}</span> },
        ]} />
        <Space size={6}>
          {canApprove && (
            <Button size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSaveDraft}
              style={{ borderColor: '#1faec2', color: '#1faec2' }}>
              Borrador
            </Button>
          )}
          {canApprove && (
            <Button size="small" type="primary" icon={<CheckOutlined />} loading={approving}
              onClick={handleSaveAndOpen}
              style={{ background: '#e5484d', borderColor: '#e5484d' }}>
              Guardar y abrir
            </Button>
          )}
          {!!id && docStatus === 'open' && <>
            <Button size="small" icon={<SyncOutlined />} loading={regenerating} onClick={handleRegenerate}
              style={{ borderColor: '#ff7f00', color: '#ff7f00' }}>
              Regenerar póliza
            </Button>
            <Button size="small" danger onClick={handleVoid}>Anular</Button>
          </>}
          {docStatus && (
            <Tag color={docStatus === 'paid' ? '#2ea172' : docStatus === 'voided' ? 'volcano' : docStatus === 'open' ? '#ff7f00' : 'default'}>
              {docStatus === 'pending_approval' ? 'Pendiente' : docStatus}
            </Tag>
          )}
        </Space>
      </div>

      {/* ── Tipo de cambio (solo moneda extranjera) ─────────────────────────── */}
      {vendorCurrency !== 'GTQ' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px',
          marginBottom: 8, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd',
        }}>
          <span style={{ fontWeight: 600, color: '#374151', fontSize: 12 }}>1 {vendorCurrency} =</span>
          {editingRate ? (
            <input type="number" value={exchangeRate} step={0.000001} autoFocus
              style={{ width: 110, border: '1px solid #bae6fd', borderRadius: 4, padding: '1px 6px', fontSize: 12 }}
              onChange={e => setExchangeRate(Number(e.target.value))}
              onBlur={() => setEditingRate(false)}
            />
          ) : (
            <span style={{ fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
              {loadingFx ? '...' : exchangeRate.toFixed(6)} GTQ
            </span>
          )}
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => setEditingRate(!editingRate)} style={{ color: '#374151' }} />
          <span style={{ fontSize: 11, color: '#9aa1ab' }}>
            {fxMeta ? `${dayjs(fxMeta.effectiveDate).format('DD/MM/YYYY')} — ${fxMeta.source}` : ''}
          </span>
        </div>
      )}

      <Form form={form} layout="vertical" size="small"
        initialValues={{ currency: 'GTQ', paymentTerms: 'immediate', accountingDate: dayjs() }}>

        {/* ── Card principal: todos los campos del encabezado ─────────────────── */}
        <Card styles={{ body: { padding: '10px 16px 2px' } }} style={{ marginBottom: 8 }}>
          {/* Fila 1: Proveedor | Fecha | Serie | No.SAT | Moneda */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0 10px' }}>
            <Form.Item name="vendorId" label="Proveedor" style={{ marginBottom: 8 }}
              rules={[{ required: true, message: 'Seleccione un proveedor' }]}>
              <Select showSearch placeholder="Buscar proveedor..." filterOption={false}
                loading={loadingVendors}
                onSearch={v => { clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => fetchVendors(v), 300) }}
                options={vendors.map(v => ({ value: v.value, label: v.label }))}
              />
            </Form.Item>
            <Form.Item name="invoiceDate" label="Fecha" style={{ marginBottom: 8 }}
              rules={[{ required: true, message: 'Requerido' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="felSerie" label="Serie FEL" style={{ marginBottom: 8 }}>
              <Input placeholder="A" />
            </Form.Item>
            <Form.Item name="felNumber" label="No. SAT" style={{ marginBottom: 8 }}>
              <Input placeholder="00001" />
            </Form.Item>
            <Form.Item name="currency" label="Moneda" style={{ marginBottom: 8 }}>
              <Select options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]} />
            </Form.Item>
          </div>

          {/* Fila 2: Autorización | Términos | Vencimiento | Contabilización | No.Doc */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0 10px' }}>
            <Form.Item name="felAuthNumber" label="Autorización SAT" style={{ marginBottom: 8 }}>
              <Input placeholder="Número de autorización" />
            </Form.Item>
            <Form.Item name="paymentTerms" label="Términos de pago" style={{ marginBottom: 8 }}>
              <PaymentTermsSelect size="small" />
            </Form.Item>
            <Form.Item name="dueDate" label="Vencimiento" style={{ marginBottom: 8 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="accountingDate" label="Contabilización" style={{ marginBottom: 8 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="vendorInvoiceNumber" label="No. Doc. Proveedor" style={{ marginBottom: 8 }}>
              <Input placeholder="Ref. proveedor" />
            </Form.Item>
          </div>

          {/* Fila 3: Factura original | Cuenta de gasto | UUID | Notas */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0 10px' }}>
            <Form.Item name="originalInvoiceId" label="Factura original del proveedor (opcional)" style={{ marginBottom: 8 }}>
              <Select allowClear showSearch placeholder="Buscar factura del proveedor..."
                optionFilterProp="label"
                options={originalBills}
                notFoundContent={!watchVendorId ? 'Seleccione un proveedor primero' : 'Sin facturas registradas'}
              />
            </Form.Item>
            <Form.Item name="accountId" label="Cuenta de gasto/activo" style={{ marginBottom: 8 }}
              tooltip="Opcional — cuenta a revertir en la póliza">
              <Select showSearch allowClear placeholder="6101 — Compras locales..."
                filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())}
                options={allAccounts}
              />
            </Form.Item>
            <Form.Item name="felUuid" label="UUID SAT" style={{ marginBottom: 8 }}>
              <Input placeholder="UUID de autorización" />
            </Form.Item>
            <Form.Item name="notes" label="Notas internas" style={{ marginBottom: 8 }}>
              <Input placeholder="Observaciones..." />
            </Form.Item>
          </div>
        </Card>

        {/* ── Líneas ──────────────────────────────────────────────────────────── */}
        <Card
          title={<span style={{ fontSize: 13, fontWeight: 600 }}>Líneas de la Nota de Crédito</span>}
          styles={{ body: { padding: '8px 14px' } }}
        >
          <LineItemsEditor
            items={items} taxes={taxes} onChange={setItems}
            docType="bill" vendorDefaultTaxId={vendorDefaultTaxId} currency={watchCurr}
          />
          <div style={{ borderTop: '1px solid rgba(10,10,10,0.08)', marginTop: 10, paddingTop: 8 }}>
            <div style={{ maxWidth: 360, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ color: '#6b7280', fontSize: 12 }}>Subtotal</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>Q {fmt(totals.subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ color: '#6b7280', fontSize: 12 }}>IVA</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>Q {fmt(totals.taxAmount)}</Text>
              </div>
              <Divider style={{ margin: '3px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#e5484d', borderRadius: 6, padding: '5px 14px' }}>
                <Text style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>Total N/C</Text>
                <Text style={{ color: '#fff', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                  {watchCurr} {fmt(totals.total)}
                </Text>
              </div>
              {vendorCurrency !== 'GTQ' && exchangeRate > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 11 }}>
                  <span>Equivalente GTQ</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Math.round(totals.total * exchangeRate * 100) / 100)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </Form>

      {/* ── Póliza contable (solo cuando está aprobada) ─────────────────────── */}
      {journalEntry && (
        <Card
          title={<span style={{ color: '#e5484d', fontWeight: 600, fontSize: 13 }}>Póliza — {journalEntry.entryNumber}</span>}
          styles={{ body: { padding: '4px 0 0 0' } }}
          style={{ marginTop: 8 }}
          extra={
            <Space size={4}>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>{dayjs(journalEntry.entryDate).format('DD/MM/YYYY')}</Text>
              <Tag color={journalEntry.status === 'posted' ? '#2ea172' : 'default'} style={{ fontSize: 10 }}>
                {journalEntry.status === 'posted' ? 'Publicado' : journalEntry.status}
              </Tag>
            </Space>
          }
        >
          <Table<JournalEntryLine>
            dataSource={journalEntry.lines ?? []} rowKey="id" size="small" pagination={false}
            columns={[
              {
                title: 'Cuenta', width: 220,
                render: (_: any, l: JournalEntryLine) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{l.accountCode} — {l.accountName}</span>
                ),
              },
              {
                title: 'Descripción', dataIndex: 'description',
                render: (v: string) => <span style={{ fontSize: 11, color: '#6b7280' }}>{v || '—'}</span>,
              },
              {
                title: 'Débito', dataIndex: 'debit', align: 'right', width: 110,
                render: (v: number) => Number(v) > 0
                  ? <span style={{ fontWeight: 600, color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>Q {fmt(Number(v))}</span>
                  : <span style={{ color: '#9aa1ab' }}>—</span>,
              },
              {
                title: 'Crédito', dataIndex: 'credit', align: 'right', width: 110,
                render: (v: number) => Number(v) > 0
                  ? <span style={{ fontWeight: 600, color: '#e5484d', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>Q {fmt(Number(v))}</span>
                  : <span style={{ color: '#9aa1ab' }}>—</span>,
              },
            ]}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fff5f5' }}>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Totales</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <span style={{ fontWeight: 800, color: '#1faec2', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>Q {fmt(Number(journalEntry.totalDebit))}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <span style={{ fontWeight: 800, color: '#e5484d', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>Q {fmt(Number(journalEntry.totalCredit))}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}
    </div>
  )
}
