import { useEffect, useState } from 'react'
import { Alert, Button, Divider, Drawer, Input, InputNumber, Select, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, LinkOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import AccountSelect from '../../components/AccountSelect'
import type { Account } from '../../api/catalogo'
import { updateTransaction, type BankAccount, type BankTransaction } from '../../api/bancos'
import { getInvoices, createAnticipo, type Invoice } from '../../api/facturas'
import { getBills, getJournalEntry, recordBillPayment, getAccountDefaults, createVendorAdvance, getVendors, type PurchaseInvoice, type AccountDefaults, type Vendor } from '../../api/compras'
import { getCustomers, type Customer } from '../../api/contactos'
import { createPagoRecibido, getPagoRecibido, reprocessPagoJournal } from '../../api/pagos-recibidos'
import { createAsiento, updateAsiento } from '../../api/asientos'
import { getExchangeRateForDate } from '../../api/monedas'
import { moneyFmt, NAVY } from './bancosShared'

const { Text, Title } = Typography

type JournalLine  = { accountCode: string; accountName: string; debe: number; haber: number }
type Resultado    = { titulo: string; invoiceRef?: string; journalEntryId?: string; journalEntryNumber?: string; journalLines: JournalLine[] }
type InvoiceItem  = { invoice: Invoice; amount: number }
type BillItem     = { bill: PurchaseInvoice; amount: number }

export default function CategorizarDrawer({
  open, transaction, account, onClose, onSaved,
}: {
  open: boolean
  transaction: BankTransaction | null
  account: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const [search, setSearch]               = useState('')
  const [invoices, setInvoices]           = useState<Invoice[]>([])
  const [bills, setBills]                 = useState<PurchaseInvoice[]>([])
  const [loadingList, setLoadingList]     = useState(false)
  const [applying, setApplying]           = useState(false)
  const [manualAccountId, setManualAccountId] = useState<string | undefined>()
  const [manualAccount, setManualAccount]     = useState<Account | undefined>()
  const [savingManual, setSavingManual]       = useState(false)
  const [savingAdvance, setSavingAdvance]     = useState(false)
  const [showVendorForm, setShowVendorForm]   = useState(false)
  const [vendors, setVendors]                 = useState<Vendor[]>([])
  const [vendorSearching, setVendorSearching] = useState(false)
  const [selectedVendorId, setSelectedVendorId]     = useState<string | undefined>()
  const [selectedVendorName, setSelectedVendorName] = useState<string | undefined>()
  const [showCustomerForm, setShowCustomerForm]   = useState(false)
  const [customers, setCustomers]                 = useState<Customer[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId]     = useState<string | undefined>()
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | undefined>()
  const [exchangeRate, setExchangeRate]       = useState<number>(1)
  const [resultado, setResultado]             = useState<Resultado | null>(null)
  const [accountDefaults, setAccountDefaults] = useState<AccountDefaults>({})
  const [editingJE, setEditingJE]             = useState(false)
  const [jeEditDate, setJeEditDate]           = useState('')
  const [jeEditRate, setJeEditRate]           = useState<number>(1)
  const [savingJE, setSavingJE]               = useState(false)

  // ── Cola multi-factura ──────────────────────────────────────────────────────
  const [selectedInvoices, setSelectedInvoices] = useState<InvoiceItem[]>([])
  const [selectedBills,    setSelectedBills]    = useState<BillItem[]>([])

  const isCredit  = transaction?.type === 'credit'
  const isForeign = account?.currency !== 'GTQ'
  const txAmount  = Number(transaction?.amount || 0)

  const allocatedInv  = selectedInvoices.reduce((s, x) => s + x.amount, 0)
  const allocatedBill = selectedBills.reduce((s, x) => s + x.amount, 0)
  const remaining     = txAmount - (isCredit ? allocatedInv : allocatedBill)

  useEffect(() => {
    getAccountDefaults().then(setAccountDefaults).catch(() => null)
  }, [])

  useEffect(() => {
    if (!open || !transaction) return
    setSearch('')
    setManualAccountId(undefined)
    setManualAccount(undefined)
    setExchangeRate(1)
    setResultado(null)
    setShowVendorForm(false)
    setSelectedVendorId(undefined)
    setSelectedVendorName(undefined)
    setVendors([])
    setShowCustomerForm(false)
    setSelectedCustomerId(undefined)
    setSelectedCustomerName(undefined)
    setCustomers([])
    setSelectedInvoices([])
    setSelectedBills([])
    fetchMatches('')
    if (account?.currency && account.currency !== 'GTQ') {
      const txDate = String(transaction.transactionDate || '').split('T')[0]
      getExchangeRateForDate(account.currency, txDate)
        .then(r => { if (r.rate > 0) setExchangeRate(r.rate) })
        .catch(() => { /* mantiene default 1 */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => fetchMatches(search), 280)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const fetchMatches = async (q: string) => {
    if (!transaction) return
    setLoadingList(true)
    try {
      if (isCredit) {
        const r = await getInvoices({ status: 'sent,pending,partial,overdue', search: q || undefined, limit: 50 })
        setInvoices(r.data)
      } else {
        const [r1, r2] = await Promise.all([
          getBills({ status: 'open', search: q || undefined, limit: 15 }),
          getBills({ status: 'partial', search: q || undefined, limit: 10 }),
        ])
        setBills([...r1.data, ...r2.data])
      }
    } catch {
      // silent
    } finally {
      setLoadingList(false)
    }
  }

  const handleClose = () => {
    if (resultado) onSaved()
    onClose()
  }

  // ── Agregar / quitar factura de venta de la cola ────────────────────────────
  const toggleInvoice = (invoice: Invoice) => {
    const exists = selectedInvoices.find(x => x.invoice.id === invoice.id)
    if (exists) {
      setSelectedInvoices(prev => prev.filter(x => x.invoice.id !== invoice.id))
      return
    }
    const maxAmt = Math.min(remaining, Number(invoice.balance))
    if (maxAmt < 0.005) { message.warning('El monto disponible ya está distribuido'); return }
    setSelectedInvoices(prev => [...prev, { invoice, amount: maxAmt }])
  }

  // ── Agregar / quitar factura de proveedor de la cola ───────────────────────
  const toggleBill = (bill: PurchaseInvoice) => {
    const exists = selectedBills.find(x => x.bill.id === bill.id)
    if (exists) {
      setSelectedBills(prev => prev.filter(x => x.bill.id !== bill.id))
      return
    }
    const maxAmt = Math.min(remaining, Number(bill.balance))
    if (maxAmt < 0.005) { message.warning('El monto disponible ya está distribuido'); return }
    setSelectedBills(prev => [...prev, { bill, amount: maxAmt }])
  }

  // ── Obtener líneas de póliza del backend; fallback cliente si no llegan ─────
  const fetchJournalLines = async (pagoId: string): Promise<JournalLine[]> => {
    try {
      let detail = await getPagoRecibido(pagoId)
      let rawLines = detail.journalEntry?.lines || detail.journalEntry?.entries || []
      if (rawLines.length === 0) {
        await reprocessPagoJournal(pagoId).catch(() => null)
        detail = await getPagoRecibido(pagoId)
        rawLines = detail.journalEntry?.lines || detail.journalEntry?.entries || []
      }
      if (rawLines.length > 0) {
        return rawLines.map((l: any) => ({
          accountCode: l.accountCode || l.account?.code || '',
          accountName: l.accountName || l.account?.name || '',
          debe:  Number(l.debit  || l.debe  || 0),
          haber: Number(l.credit || l.haber || 0),
        }))
      }
    } catch { /* silent */ }
    return []
  }

  // ── Aplicar cola de facturas de venta ───────────────────────────────────────
  const applyAllInvoices = async () => {
    if (!transaction || !account || selectedInvoices.length === 0) return
    setApplying(true)
    const txDate = String(transaction.transactionDate || '').split('T')[0]
    const allLines: JournalLine[] = []
    const refs: string[] = []

    try {
      for (const { invoice, amount } of selectedInvoices) {
        const pago = await createPagoRecibido({
          customerId:       invoice.customerId,
          invoiceId:        invoice.id,
          paymentDate:      txDate,
          amount,
          mode:             'bank_transfer',
          reference:        transaction.reference || undefined,
          bankAccountId:    account.id,
          bankTransactionId: transaction.id,
          currency:         account.currency,
          exchangeRate:     isForeign ? exchangeRate : 1,
        })

        await updateTransaction(account.id, transaction.id, {
          status:           'categorized',
          matchedPaymentId: pago.id,
          matchedInvoiceId: invoice.id,
        } as any)

        refs.push(invoice.invoiceNumber)
        const lines = await fetchJournalLines(pago.id)
        allLines.push(...lines)
      }

      // Fallback: construir póliza esperada si el backend no la generó
      if (allLines.length === 0) {
        const totalGTQ = allocatedInv * (isForeign ? exchangeRate : 1)
        allLines.push(
          { accountCode: account.glAccountCode || '', accountName: account.glAccountName || 'Banco', debe: totalGTQ, haber: 0 },
          { accountCode: '1110', accountName: 'Cuentas por Cobrar', debe: 0, haber: totalGTQ },
        )
      }

      message.success(`${selectedInvoices.length} cobro(s) aplicado(s)`)
      setResultado({ titulo: `Cobros aplicados — ${refs.join(', ')}`, journalLines: allLines })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo aplicar uno o más cobros')
    } finally {
      setApplying(false)
    }
  }

  // ── Aplicar cola de facturas de proveedor ───────────────────────────────────
  const applyAllBills = async () => {
    if (!transaction || !account || selectedBills.length === 0) return
    setApplying(true)
    const txDate = String(transaction.transactionDate || '').split('T')[0]
    const allLines: JournalLine[] = []
    const refs: string[] = []

    try {
      for (const { bill, amount } of selectedBills) {
        // Obtener cuenta CxP del asiento original de la factura
        let cxpCode = ''; let cxpName = ''
        if (bill.journalEntryId) {
          try {
            const billJe  = await getJournalEntry(bill.journalEntryId)
            const cxpLine = billJe.lines.find(l => l.credit > 0)
            if (cxpLine) { cxpCode = cxpLine.accountCode; cxpName = cxpLine.accountName }
          } catch { /* silent */ }
        }

        await recordBillPayment(bill.id, {
          amount,
          currency:      account.currency,
          exchangeRate:  isForeign ? exchangeRate : 1,
          paymentDate:   txDate,
          mode:          'bank_transfer',
          reference:     transaction.reference || undefined,
          bankAccountId: account.id,
        })

        await updateTransaction(account.id, transaction.id, {
          status:             'categorized',
          sourceDocumentId:   bill.id,
          sourceDocumentType: 'bill',
          accountId:          bill.accountId || undefined,
        } as any)

        refs.push(bill.invoiceNumber)
        const amtGTQ = amount * (isForeign ? exchangeRate : 1)
        if (cxpCode) {
          allLines.push(
            { accountCode: cxpCode, accountName: cxpName, debe: amtGTQ, haber: 0 },
            { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '', debe: 0, haber: amtGTQ },
          )
        }
      }

      if (allLines.length === 0) {
        const totalGTQ = allocatedBill * (isForeign ? exchangeRate : 1)
        allLines.push(
          { accountCode: '2110', accountName: 'Cuentas por Pagar', debe: totalGTQ, haber: 0 },
          { accountCode: account.glAccountCode || '', accountName: account.glAccountName || 'Banco', debe: 0, haber: totalGTQ },
        )
      }

      message.success(`${selectedBills.length} pago(s) aplicado(s)`)
      setResultado({ titulo: `Pagos a proveedor — ${refs.join(', ')}`, journalLines: allLines })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo registrar uno o más pagos')
    } finally {
      setApplying(false)
    }
  }

  const applyManual = async () => {
    if (!transaction || !account || !manualAccountId) return
    setSavingManual(true)
    try {
      await updateTransaction(account.id, transaction.id, {
        status:    'categorized',
        accountId: manualAccountId,
      })

      const txDate    = String(transaction.transactionDate || '').split('T')[0]
      const amountGTQ = Number(transaction.amount) * (isForeign ? exchangeRate : 1)
      const glCode    = manualAccount?.code || ''
      const glName    = manualAccount?.name || ''
      const bankCode  = account.glAccountCode || ''
      const bankName  = account.glAccountName || ''
      const bankId    = account.glAccountId   || ''

      let journalLines: JournalLine[] = []
      let jeId = ''; let jeNumber = ''
      try {
        const lines = isCredit
          ? [
              { accountId: bankId, accountCode: bankCode, accountName: bankName, debit: amountGTQ, credit: 0, description: transaction.description, sortOrder: 1 },
              { accountId: manualAccountId, accountCode: glCode, accountName: glName, debit: 0, credit: amountGTQ, description: transaction.description, sortOrder: 2 },
            ]
          : [
              { accountId: manualAccountId, accountCode: glCode, accountName: glName, debit: amountGTQ, credit: 0, description: transaction.description, sortOrder: 1 },
              { accountId: bankId, accountCode: bankCode, accountName: bankName, debit: 0, credit: amountGTQ, description: transaction.description, sortOrder: 2 },
            ]

        const asiento = await createAsiento({
          lines,
          entryDate:          txDate,
          description:        transaction.description || 'Categorización bancaria',
          reference:          transaction.reference || undefined,
          exchangeRate:       isForeign ? exchangeRate : 1,
          sourceDocumentId:   transaction.id,
          sourceDocumentType: 'bank_transaction',
          autoPost:           true,
        })

        jeId = asiento.id; jeNumber = asiento.entryNumber

        await updateTransaction(account.id, transaction.id, {
          matchedJournalEntryId: asiento.id,
        } as any)

        journalLines = lines.map(l => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          debe:  l.debit,
          haber: l.credit,
        }))
      } catch {
        // póliza no crítica — continuar sin mostrarla
      }

      message.success('Movimiento categorizado')
      setResultado({
        titulo:             `Movimiento categorizado — ${glName || 'cuenta seleccionada'}`,
        journalEntryId:     jeId || undefined,
        journalEntryNumber: jeNumber || undefined,
        journalLines,
      })
    } catch {
      message.error('No se pudo categorizar')
    } finally {
      setSavingManual(false)
    }
  }

  const searchCustomers = async (q: string) => {
    setCustomerSearching(true)
    try {
      const res = await getCustomers({ search: q || undefined, limit: 100 })
      const list: Customer[] = Array.isArray(res) ? res : (res as any).data ?? []
      setCustomers(list)
    } catch { setCustomers([]) }
    finally { setCustomerSearching(false) }
  }

  const searchVendors = async (q: string) => {
    setVendorSearching(true)
    try {
      const res = await getVendors({ search: q || undefined, limit: 100 })
      const list: Vendor[] = Array.isArray(res) ? res : (res as any).data ?? []
      setVendors(list)
    } catch { setVendors([]) }
    finally { setVendorSearching(false) }
  }

  const applyAsVendorAdvance = async () => {
    if (!transaction || !account) return
    if (!selectedVendorId) { message.warning('Selecciona el proveedor'); return }
    setSavingAdvance(true)
    try {
      const txDate    = String(transaction.transactionDate || '').split('T')[0]
      const amountGTQ = Number(transaction.amount) * (isForeign ? exchangeRate : 1)

      const advance = await createVendorAdvance({
        vendorId:           selectedVendorId,
        vendorName:         selectedVendorName,
        amount:             Number(transaction.amount),
        date:               txDate,
        currency:           account.currency,
        exchangeRate:       isForeign ? exchangeRate : 1,
        reference:          transaction.reference || undefined,
        bankAccountId:      account.id,
        advanceAccountCode: accountDefaults.vendorAdvanceAccountCode,
      })

      await updateTransaction(account.id, transaction.id, {
        status:             'categorized',
        sourceDocumentId:   advance.id,
        sourceDocumentType: 'vendor_advance',
      } as any)

      const journalLines: JournalLine[] = advance.journalLines?.map(l => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debe:        l.debit,
        haber:       l.credit,
      })) ?? (advance.advanceAccountCode ? [
        { accountCode: advance.advanceAccountCode, accountName: advance.advanceAccountName || '', debe: amountGTQ, haber: 0 },
        { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '',    debe: 0,         haber: amountGTQ },
      ] : [])

      message.success(`Anticipo registrado — ${advance.advanceNumber}`)
      setResultado({ titulo: `Anticipo a proveedor — ${advance.advanceNumber}`, journalLines })
    } catch (e: any) {
      const raw = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'No se pudo registrar el anticipo'
      message.error(Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : 'No se pudo registrar el anticipo')
    } finally {
      setSavingAdvance(false)
    }
  }

  const applyAsCustomerAdvance = async () => {
    if (!transaction || !account) return
    if (!selectedCustomerId) { message.warning('Selecciona el cliente'); return }
    setSavingAdvance(true)
    try {
      const txDate    = String(transaction.transactionDate || '').split('T')[0]
      const amountGTQ = Number(transaction.amount) * (isForeign ? exchangeRate : 1)

      const advance = await createAnticipo({
        customerId:    selectedCustomerId,
        amount:        Number(transaction.amount),
        date:          txDate,
        currency:      account.currency,
        reference:     transaction.reference || undefined,
        bankAccountId: account.id,
      })

      await updateTransaction(account.id, transaction.id, {
        status:             'categorized',
        sourceDocumentId:   advance.id,
        sourceDocumentType: 'advance',
      } as any)

      const advCode = accountDefaults.customerAdvanceAccountCode || '2110'
      const journalLines: JournalLine[] = [
        { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '', debe: amountGTQ, haber: 0 },
        { accountCode: advCode,                     accountName: 'Anticipo de cliente',        debe: 0,         haber: amountGTQ },
      ]

      message.success(`Anticipo registrado — ${advance.invoiceNumber}`)
      setResultado({ titulo: `Anticipo de cliente — ${advance.invoiceNumber}${selectedCustomerName ? ` (${selectedCustomerName})` : ''}`, journalLines })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo registrar el anticipo')
    } finally {
      setSavingAdvance(false)
    }
  }

  const saveJE = async () => {
    if (!resultado?.journalEntryId) return
    setSavingJE(true)
    try {
      await updateAsiento(resultado.journalEntryId, {
        entryDate:    jeEditDate || undefined,
        exchangeRate: isForeign ? jeEditRate : undefined,
      })
      message.success('Póliza actualizada')
      setEditingJE(false)
    } catch {
      message.error('No se pudo actualizar la póliza')
    } finally {
      setSavingJE(false)
    }
  }

  const isExactMatch = (docAmt: number) =>
    Math.abs(Number(docAmt) - txAmount) < 0.015

  // ── Columnas factura venta ───────────────────────────────────────────────────
  const invoiceCols: ColumnsType<Invoice> = [
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      ellipsis: true,
      render: (v, row) => (
        <div>
          <div style={{ fontSize: 12 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{row.invoiceNumber}</Text>
        </div>
      ),
    },
    {
      title: 'Pendiente',
      dataIndex: 'balance',
      width: 110,
      align: 'right',
      render: (v, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Text strong style={{ color: '#e5484d', fontSize: 12 }}>{moneyFmt(Number(v), account?.currency)}</Text>
          {isExactMatch(Number(row.balance)) && <Tag color="#2ea172" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>Coincide</Tag>}
        </div>
      ),
    },
    {
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, row) => {
        const inQueue = selectedInvoices.some(x => x.invoice.id === row.id)
        return (
          <Tooltip title={inQueue ? 'Quitar de la selección' : 'Agregar al cobro'}>
            <Button
              size="small"
              type={inQueue ? 'default' : 'primary'}
              icon={inQueue ? <MinusOutlined /> : <PlusOutlined />}
              danger={inQueue}
              disabled={!inQueue && remaining < 0.005}
              style={!inQueue ? { background: NAVY } : {}}
              onClick={() => toggleInvoice(row)}
            />
          </Tooltip>
        )
      },
    },
  ]

  // ── Columnas factura proveedor ───────────────────────────────────────────────
  const billCols: ColumnsType<PurchaseInvoice> = [
    {
      title: 'Proveedor',
      dataIndex: 'vendorName',
      ellipsis: true,
      render: (v, row) => (
        <div>
          <div style={{ fontSize: 12 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{row.invoiceNumber}</Text>
        </div>
      ),
    },
    {
      title: 'Pendiente',
      dataIndex: 'balance',
      width: 110,
      align: 'right',
      render: (v, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Text strong style={{ color: '#e5484d', fontSize: 12 }}>{moneyFmt(Number(v), account?.currency)}</Text>
          {isExactMatch(Number(row.balance)) && <Tag color="#2ea172" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>Coincide</Tag>}
        </div>
      ),
    },
    {
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, row) => {
        const inQueue = selectedBills.some(x => x.bill.id === row.id)
        return (
          <Tooltip title={inQueue ? 'Quitar de la selección' : 'Agregar al pago'}>
            <Button
              size="small"
              type={inQueue ? 'default' : 'primary'}
              icon={inQueue ? <MinusOutlined /> : <LinkOutlined />}
              danger={inQueue}
              disabled={!inQueue && remaining < 0.005}
              onClick={() => toggleBill(row)}
            />
          </Tooltip>
        )
      },
    },
  ]

  const journalCols = [
    { title: 'Cuenta', key: 'cuenta', ellipsis: true, render: (_: any, l: any) => <Text style={{ fontSize: 12 }}>{l.accountCode} — {l.accountName}</Text> },
    { title: 'Debe',  dataIndex: 'debe',  width: 110, align: 'right' as const, render: (v: number) => v ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{moneyFmt(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Haber', dataIndex: 'haber', width: 110, align: 'right' as const, render: (v: number) => v ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{moneyFmt(v)}</Text> : <Text type="secondary">—</Text> },
  ]

  if (!transaction) return null

  const txDate = String(transaction.transactionDate || '').split('T')[0]
  const [y, mo, d] = txDate.split('-')
  const fmtTxDate = y && mo && d ? `${d}/${mo}/${y}` : txDate

  const selectedList = isCredit ? selectedInvoices : selectedBills
  const allocated    = isCredit ? allocatedInv : allocatedBill

  return (
    <Drawer
      title={resultado ? 'Resultado de categorización' : 'Categorizar movimiento'}
      open={open}
      onClose={handleClose}
      width={640}
      extra={
        <Tag color={isCredit ? 'success' : 'error'} style={{ fontSize: 13, padding: '2px 10px' }}>
          {isCredit ? 'INGRESO' : 'EGRESO'}
        </Tag>
      }
      styles={{ body: { padding: 16 } }}
    >
      {/* ── Resumen del movimiento ───────────────────────────────────────── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>FECHA</Text>
            <div><Text strong>{fmtTxDate}</Text></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>MONTO{isForeign ? ` (${account?.currency})` : ''}</Text>
            <div>
              <Text strong style={{ fontSize: 18, color: isCredit ? '#2ea172' : '#e5484d' }}>
                {isCredit ? '+' : '–'} {moneyFmt(txAmount, account?.currency)}
              </Text>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>DESCRIPCIÓN</Text>
            <div><Text strong>{transaction.description}</Text></div>
            {transaction.reference && <Text type="secondary" style={{ fontSize: 12 }}>Ref. {transaction.reference}</Text>}
          </div>
        </div>

        {isForeign && !resultado && (
          <div style={{ marginTop: 10, borderTop: '1px dashed #cbd5e1', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Tipo de cambio 1 {account?.currency} =</Text>
            <InputNumber size="small" min={0.000001} precision={6} value={exchangeRate}
              onChange={v => setExchangeRate(Number(v) || 1)} style={{ width: 140 }} />
            <Text style={{ fontSize: 12 }}>GTQ</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>≈ {moneyFmt(txAmount * exchangeRate)} GTQ</Text>
          </div>
        )}
      </div>

      {/* ── RESULTADO ───────────────────────────────────────────────────── */}
      {resultado ? (
        <div>
          <Alert type="success" showIcon message={resultado.titulo} style={{ marginBottom: 16 }} />

          {resultado.journalLines.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {resultado.journalEntryNumber ? `Póliza ${resultado.journalEntryNumber}` : 'Póliza contable'}
                </Title>
                {resultado.journalEntryId && (
                  <Button size="small" icon={<EditOutlined />}
                    onClick={() => { setJeEditDate(txDate); setJeEditRate(exchangeRate); setEditingJE(v => !v) }}>
                    Editar
                  </Button>
                )}
              </div>

              {editingJE && resultado.journalEntryId && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isForeign ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <Text style={{ fontSize: 12 }}>Fecha del asiento</Text>
                      <Input size="small" type="date" value={jeEditDate} onChange={e => setJeEditDate(e.target.value)} />
                    </div>
                    {isForeign && (
                      <div>
                        <Text style={{ fontSize: 12 }}>Tipo de cambio (GTQ)</Text>
                        <InputNumber size="small" min={0.000001} precision={6} value={jeEditRate}
                          onChange={v => setJeEditRate(Number(v) || 1)} style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                  <Button size="small" type="primary" loading={savingJE} style={{ background: NAVY }} onClick={saveJE}>
                    Guardar cambios
                  </Button>
                </div>
              )}

              <Table size="small" dataSource={resultado.journalLines} rowKey={(_, i) => String(i)}
                columns={journalCols} pagination={false} style={{ marginBottom: 16 }} />
            </>
          ) : (
            <Alert type="info" message="La póliza contable se procesará en segundo plano." style={{ marginBottom: 16 }} />
          )}

          <Button type="primary" block style={{ background: NAVY }} onClick={handleClose}>Cerrar</Button>
        </div>

      ) : (
        <>
          {/* ── Lista de documentos ───────────────────────────────────── */}
          <Title level={5} style={{ margin: '0 0 8px' }}>
            {isCredit ? 'Facturas pendientes de cobro' : 'Facturas proveedor pendientes'}
          </Title>
          <Input.Search
            size="small" allowClear
            placeholder={isCredit ? 'Buscar cliente o N° factura...' : 'Buscar proveedor o N° factura...'}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />

          {isCredit ? (
            <Table<Invoice> size="small" dataSource={invoices} rowKey="id" columns={invoiceCols}
              loading={loadingList} pagination={false} scroll={{ y: 200 }}
              locale={{ emptyText: 'Sin facturas pendientes' }} />
          ) : (
            <Table<PurchaseInvoice> size="small" dataSource={bills} rowKey="id" columns={billCols}
              loading={loadingList} pagination={false} scroll={{ y: 200 }}
              locale={{ emptyText: 'Sin facturas proveedor pendientes' }} />
          )}

          {/* ── Cola de distribución ─────────────────────────────────── */}
          {selectedList.length > 0 && (
            <div style={{ border: `1px solid ${NAVY}30`, borderRadius: 8, padding: 12, marginTop: 12, background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 13 }}>Distribución del {isCredit ? 'cobro' : 'pago'}</Text>
                <Tag color={Math.abs(remaining) < 0.01 ? '#2ea172' : remaining < 0 ? '#e5484d' : '#ff7f00'}>
                  {remaining < -0.005
                    ? `Excede Q ${Math.abs(remaining).toFixed(2)}`
                    : `Restante: ${moneyFmt(remaining, account?.currency)}`}
                </Tag>
              </div>

              {isCredit
                ? selectedInvoices.map(({ invoice, amount }, i) => (
                    <div key={invoice.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{invoice.invoiceNumber}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{invoice.customerName}</Text>
                      </div>
                      <InputNumber
                        size="small" min={0.01} max={Number(invoice.balance)} precision={2} value={amount}
                        onChange={v => setSelectedInvoices(prev => prev.map((x, xi) => xi === i ? { ...x, amount: Number(v) || 0 } : x))}
                        style={{ width: 110 }}
                        prefix={account?.currency === 'GTQ' ? 'Q' : account?.currency}
                      />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => setSelectedInvoices(prev => prev.filter((_, xi) => xi !== i))} />
                    </div>
                  ))
                : selectedBills.map(({ bill, amount }, i) => (
                    <div key={bill.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{bill.invoiceNumber}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{bill.vendorName}</Text>
                      </div>
                      <InputNumber
                        size="small" min={0.01} max={Number(bill.balance)} precision={2} value={amount}
                        onChange={v => setSelectedBills(prev => prev.map((x, xi) => xi === i ? { ...x, amount: Number(v) || 0 } : x))}
                        style={{ width: 110 }}
                        prefix={account?.currency === 'GTQ' ? 'Q' : account?.currency}
                      />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => setSelectedBills(prev => prev.filter((_, xi) => xi !== i))} />
                    </div>
                  ))
              }

              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {selectedList.length} documento{selectedList.length > 1 ? 's' : ''} · Total: <strong>{moneyFmt(allocated, account?.currency)}</strong>
                </Text>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={applying}
                  disabled={allocated < 0.005 || remaining < -0.005}
                  style={{ background: NAVY }}
                  onClick={isCredit ? applyAllInvoices : applyAllBills}
                >
                  {isCredit ? 'Aplicar cobros' : 'Registrar pagos'}
                </Button>
              </div>
            </div>
          )}

          <Divider style={{ margin: '14px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>o categorizar como</Text>
          </Divider>

          {/* ── Anticipo ───────────────────────────────────────────────── */}
          {isCredit ? showCustomerForm ? (
            <div style={{ border: '1px solid #6b7280', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                Cliente para el anticipo (cta {accountDefaults.customerAdvanceAccountCode || '2110'})
              </Text>
              <Select showSearch allowClear placeholder="Buscar cliente..." size="small"
                style={{ width: '100%', marginBottom: 8 }} filterOption={false}
                onSearch={searchCustomers} onFocus={() => searchCustomers('')}
                loading={customerSearching} value={selectedCustomerId}
                onChange={(val, opt: any) => { setSelectedCustomerId(val); setSelectedCustomerName(opt?.label ?? '') }}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                notFoundContent={customerSearching ? 'Buscando…' : 'Sin resultados'} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" type="primary" icon={<ClockCircleOutlined />} loading={savingAdvance}
                  disabled={!selectedCustomerId} style={{ flex: 1, background: '#6b7280', borderColor: '#6b7280' }}
                  onClick={applyAsCustomerAdvance}>Registrar anticipo</Button>
                <Button size="small" onClick={() => { setShowCustomerForm(false); setSelectedCustomerId(undefined); setSelectedCustomerName(undefined) }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button block icon={<ClockCircleOutlined />} style={{ marginBottom: 8, borderColor: '#6b7280', color: '#6b7280' }}
              onClick={() => { setShowCustomerForm(true); searchCustomers('') }}>
              Anticipo de cliente
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({accountDefaults.customerAdvanceAccountCode || '2110'})</Text>
            </Button>
          ) : showVendorForm ? (
            <div style={{ border: '1px solid #6b7280', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                Proveedor para el anticipo (cta {accountDefaults.vendorAdvanceAccountCode || '1500'})
              </Text>
              <Select showSearch allowClear placeholder="Buscar proveedor..." size="small"
                style={{ width: '100%', marginBottom: 8 }} filterOption={false}
                onSearch={searchVendors} onFocus={() => searchVendors('')}
                loading={vendorSearching} value={selectedVendorId}
                onChange={(val, opt: any) => { setSelectedVendorId(val); setSelectedVendorName(opt?.label ?? '') }}
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                notFoundContent={vendorSearching ? 'Buscando…' : 'Sin resultados'} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" type="primary" icon={<ClockCircleOutlined />} loading={savingAdvance}
                  disabled={!selectedVendorId} style={{ flex: 1, background: '#6b7280', borderColor: '#6b7280' }}
                  onClick={applyAsVendorAdvance}>Registrar anticipo</Button>
                <Button size="small" onClick={() => { setShowVendorForm(false); setSelectedVendorId(undefined); setSelectedVendorName(undefined) }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button block icon={<ClockCircleOutlined />} style={{ marginBottom: 8, borderColor: '#6b7280', color: '#6b7280' }}
              onClick={() => { setShowVendorForm(true); searchVendors('') }}>
              Anticipo a proveedor
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({accountDefaults.vendorAdvanceAccountCode || '1500'})</Text>
            </Button>
          )}

          <Divider style={{ margin: '14px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>o seleccionar cuenta contable</Text>
          </Divider>

          <div style={{ display: 'grid', gap: 8 }}>
            <AccountSelect filter={{}} placeholder="Selecciona cuenta contable..."
              value={manualAccountId} onChange={setManualAccountId}
              onChangeAccount={setManualAccount} size="small" />
            <Button type="primary" block disabled={!manualAccountId} loading={savingManual}
              style={{ background: NAVY }} onClick={applyManual}>
              Categorizar con cuenta seleccionada
            </Button>
          </div>
        </>
      )}
    </Drawer>
  )
}
