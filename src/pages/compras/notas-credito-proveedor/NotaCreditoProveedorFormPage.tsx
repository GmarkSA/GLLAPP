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
  createCreditNote, approveCreditNote, getBill,
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
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/notas-credito-proveedor">Notas de Crédito Proveedor</Link> },
          { title: id ? 'Editar' : 'Nueva Nota de Crédito' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── COLUMNA IZQUIERDA ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card title={
            <span style={{ color: '#dc2626', fontWeight: 600 }}>
              {id ? 'Editar Nota de Crédito Proveedor' : 'Nueva Nota de Crédito Proveedor'}
            </span>
          }>
            <Form form={form} layout="vertical" size="small"
              initialValues={{ currency: 'GTQ', paymentTerms: 'immediate', accountingDate: dayjs() }}>

              {/* Proveedor */}
              <Form.Item name="vendorId" label="Proveedor"
                rules={[{ required: true, message: 'Seleccione un proveedor' }]}>
                <Select
                  showSearch placeholder="Buscar proveedor..."
                  filterOption={false}
                  loading={loadingVendors}
                  onSearch={v => {
                    clearTimeout(debounceRef.current)
                    debounceRef.current = setTimeout(() => fetchVendors(v), 300)
                  }}
                  options={vendors.map(v => ({ value: v.value, label: v.label }))}
                />
              </Form.Item>

              {/* Tipo de cambio — solo si moneda extranjera */}
              {vendorCurrency !== 'GTQ' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
                  marginBottom: 12, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd',
                }}>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>1 {vendorCurrency} =</span>
                  {editingRate ? (
                    <input
                      type="number" value={exchangeRate} step={0.000001}
                      style={{ width: 120, border: '1px solid #bae6fd', borderRadius: 4, padding: '2px 6px' }}
                      onChange={e => setExchangeRate(Number(e.target.value))}
                      onBlur={() => setEditingRate(false)}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: 700, color: '#0369a1', fontFamily: 'monospace' }}>
                      {loadingFx ? '...' : exchangeRate.toFixed(6)} GTQ
                    </span>
                  )}
                  <Button size="small" type="text" icon={<EditOutlined />}
                    onClick={() => setEditingRate(!editingRate)} style={{ color: '#0369a1' }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {fxMeta ? `Tasa del ${dayjs(fxMeta.effectiveDate).format('DD/MM/YYYY')} (${fxMeta.source})` : ''}
                  </span>
                </div>
              )}

              {/* Fechas + Serie FEL + No. SAT + Moneda */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="invoiceDate" label="Fecha" rules={[{ required: true, message: 'Ingrese la fecha' }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item name="felSerie" label="Serie FEL">
                  <Input placeholder="A" />
                </Form.Item>
                <Form.Item name="felNumber" label="Número SAT">
                  <Input placeholder="00001" />
                </Form.Item>
                <Form.Item name="currency" label="Moneda">
                  <Select options={[
                    { value: 'GTQ', label: 'GTQ — Quetzal' },
                    { value: 'USD', label: 'USD — Dólar' },
                  ]} />
                </Form.Item>
              </div>

              {/* Autorización + Términos de pago + Vencimiento + Contabilización */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="felAuthNumber" label="Autorización SAT">
                  <Input placeholder="Número de autorización SAT" />
                </Form.Item>
                <Form.Item name="paymentTerms" label="Términos de pago">
                  <PaymentTermsSelect size="small" />
                </Form.Item>
                <Form.Item name="dueDate" label="Vencimiento">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item name="accountingDate" label="Fecha contabilización">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </div>

              {/* Número documento proveedor */}
              <Form.Item name="vendorInvoiceNumber" label="No. documento proveedor">
                <Input placeholder="Número de nota de crédito del proveedor" />
              </Form.Item>

            </Form>
          </Card>

          {/* Líneas */}
          <Card title="Líneas de la Nota de Crédito" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor
              items={items}
              taxes={taxes}
              onChange={setItems}
              docType="bill"
              vendorDefaultTaxId={vendorDefaultTaxId}
              currency={watchCurr}
            />

            {/* Totales */}
            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 12 }}>
              <div style={{ maxWidth: 400, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#6b7280' }}>Subtotal (base)</Text>
                  <Text style={{ fontFamily: 'monospace' }}>Q {fmt(totals.subtotal)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#6b7280' }}>IVA</Text>
                  <Text style={{ fontFamily: 'monospace' }}>Q {fmt(totals.taxAmount)}</Text>
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: '#dc2626', borderRadius: 8, padding: '8px 16px',
                }}>
                  <Text style={{ color: '#fff', fontWeight: 600 }}>Total Nota de Crédito</Text>
                  <Text style={{ color: '#fff', fontWeight: 800, fontFamily: 'monospace', fontSize: 15 }}>
                    {watchCurr} {fmt(totals.total)}
                  </Text>
                </div>
                {vendorCurrency !== 'GTQ' && exchangeRate > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 12 }}>
                    <span>Equivalente GTQ</span>
                    <span style={{ fontFamily: 'monospace' }}>Q {fmt(Math.round(totals.total * exchangeRate * 100) / 100)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Póliza contable */}
          {journalEntry && (
            <Card
              title={<span style={{ color: '#dc2626', fontWeight: 600 }}>Póliza de Reversión — {journalEntry.entryNumber}</span>}
              styles={{ body: { padding: '8px 0 0 0' } }}
              extra={
                <Space>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{dayjs(journalEntry.entryDate).format('DD/MM/YYYY')}</Text>
                  <Tag color={journalEntry.status === 'posted' ? 'green' : 'default'}>
                    {journalEntry.status === 'posted' ? 'Publicado' : journalEntry.status}
                  </Tag>
                </Space>
              }
            >
              <Table<JournalEntryLine>
                dataSource={journalEntry.lines ?? []}
                rowKey="id"
                size="small"
                pagination={false}
                style={{ borderRadius: 0 }}
                columns={[
                  {
                    title: 'Cuenta', width: 220,
                    render: (_: any, l: JournalEntryLine) => (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {l.accountCode} — {l.accountName}
                      </span>
                    ),
                  },
                  {
                    title: 'Descripción', dataIndex: 'description',
                    render: (v: string) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</span>,
                  },
                  {
                    title: 'Débito', dataIndex: 'debit', align: 'right', width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#1B3A6B', fontFamily: 'monospace' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#d9d9d9' }}>—</span>,
                  },
                  {
                    title: 'Crédito', dataIndex: 'credit', align: 'right', width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#d9d9d9' }}>—</span>,
                  },
                ]}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fff5f5' }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>Totales</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <span style={{ fontWeight: 800, color: '#1B3A6B', fontFamily: 'monospace' }}>Q {fmt(Number(journalEntry.totalDebit))}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <span style={{ fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>Q {fmt(Number(journalEntry.totalCredit))}</span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>
          )}

          {/* Notas */}
          <Card title="Notas">
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="notes">
                <Input.TextArea rows={3} placeholder="Notas internas sobre esta nota de crédito..." />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* ── COLUMNA DERECHA ──────────────────────────────────────────────── */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card title="Acciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {canApprove && (
                <Button block icon={<SaveOutlined />} loading={saving}
                  onClick={handleSaveDraft}
                  style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}>
                  Guardar como borrador
                </Button>
              )}

              {canApprove && (
                <>
                  <Button block type="primary" icon={<CheckOutlined />} loading={approving}
                    onClick={handleSaveAndOpen}
                    style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                    Guardar y abrir
                  </Button>
                  <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                    Genera póliza de reversión automáticamente
                  </div>
                </>
              )}

              {!!id && docStatus === 'open' && (
                <>
                  <Button block icon={<SyncOutlined />} loading={regenerating}
                    onClick={handleRegenerate}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>
                    Regenerar póliza
                  </Button>
                  <Button block danger onClick={handleVoid}>
                    Anular nota de crédito
                  </Button>
                </>
              )}

              {docStatus && (
                <Tag color={
                  docStatus === 'paid'   ? 'green' :
                  docStatus === 'voided' ? 'volcano' :
                  docStatus === 'open'   ? 'orange' : 'default'
                } style={{ width: '100%', textAlign: 'center', marginTop: 4 }}>
                  Estado: {docStatus === 'pending_approval' ? 'Pendiente aprobación' : docStatus}
                </Tag>
              )}
            </div>
          </Card>

          {/* Ayuda contable */}
          <Card
            title={<span style={{ color: '#dc2626', fontSize: 13 }}>Póliza de Reversión</span>}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              Al aprobar se genera automáticamente:
              <br /><br />
              <strong>Dr.</strong> CxP Proveedor — reduce saldo adeudado<br />
              <strong>Cr.</strong> Gasto / Activo — revierte el gasto<br />
              <strong>Cr.</strong> IVA Crédito Fiscal — reduce IVA CF
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#fff5f5', borderRadius: 6, fontSize: 11, color: '#b91c1c' }}>
              Impacta en el Libro de Compras y en el Estado de Cuenta por Pagar del proveedor.
            </div>
          </Card>

          {/* Info de cuentas contables */}
          <Card title="Cuenta de gasto" styles={{ body: { padding: '12px 16px' } }}>
            <Form form={form} layout="vertical" size="small">
              <Form.Item
                name="accountId"
                label="Cuenta de gasto/activo a revertir"
                tooltip="Opcional — si no se especifica, usa la cuenta del ítem o la predeterminada del proveedor"
              >
                <Select
                  showSearch allowClear
                  placeholder="6101 — Compras locales..."
                  filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())}
                  options={allAccounts}
                />
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  )
}
