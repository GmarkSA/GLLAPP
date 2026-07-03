import { useEffect, useState } from 'react'
import { Alert, Button, Divider, Drawer, Input, InputNumber, Select, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined, ClockCircleOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons'
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

type Resultado = {
  titulo:              string
  invoiceRef?:         string
  journalEntryId?:     string
  journalEntryNumber?: string
  journalLines:        { accountCode: string; accountName: string; debe: number; haber: number }[]
}

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
  const [applying, setApplying]           = useState<string | null>(null)
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

  const isCredit  = transaction?.type === 'credit'
  const isForeign = account?.currency !== 'GTQ'

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

  const applyToInvoice = async (invoice: Invoice) => {
    if (!transaction || !account) return
    setApplying(invoice.id)
    try {
      const txDate = String(transaction.transactionDate || '').split('T')[0]
      const applyAmt = Math.min(Number(transaction.amount), Number(invoice.balance))
      const pago = await createPagoRecibido({
        customerId:    invoice.customerId,
        invoiceId:     invoice.id,
        paymentDate:   txDate,
        amount:        applyAmt,
        mode:          'bank_transfer',
        reference:     transaction.reference || undefined,
        bankAccountId: account.id,
        currency:      account.currency,
        exchangeRate:  isForeign ? exchangeRate : 1,
      })

      await updateTransaction(account.id, transaction.id, {
        status:           'categorized',
        matchedPaymentId: pago.id,
        matchedInvoiceId: invoice.id,
      } as any)

      // Obtener póliza contable del pago
      let journalLines: Resultado['journalLines'] = []
      try {
        let detail = await getPagoRecibido(pago.id)
        let rawLines = detail.journalEntry?.lines || detail.journalEntry?.entries || []

        // Si la póliza no fue generada en la creación, intentar regenerarla
        if (rawLines.length === 0) {
          await reprocessPagoJournal(pago.id).catch(() => null)
          detail = await getPagoRecibido(pago.id)
          rawLines = detail.journalEntry?.lines || detail.journalEntry?.entries || []
        }

        journalLines = rawLines.map((l: any) => ({
          accountCode: l.accountCode || l.account?.code || '',
          accountName: l.accountName || l.account?.name || '',
          debe:  Number(l.debit  || l.debe  || 0),
          haber: Number(l.credit || l.haber || 0),
        }))
      } catch {
        // si no hay póliza disponible, continuar sin mostrarla
      }

      message.success(`Cobro aplicado a factura ${invoice.invoiceNumber}`)
      setResultado({
        titulo: `Cobro aplicado — Factura ${invoice.invoiceNumber} (${invoice.customerName})`,
        invoiceRef: invoice.invoiceNumber,
        journalLines,
      })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo aplicar el cobro')
    } finally {
      setApplying(null)
    }
  }

  const applyToBill = async (bill: PurchaseInvoice) => {
    if (!transaction || !account) return
    setApplying(bill.id)
    try {
      const txDate   = String(transaction.transactionDate || '').split('T')[0]
      const applyAmt = Math.min(Number(transaction.amount), Number(bill.balance))

      // Prefetch cuenta CxP desde el asiento original de la factura
      let cxpCode = ''; let cxpName = ''
      if (bill.journalEntryId) {
        try {
          const billJe  = await getJournalEntry(bill.journalEntryId)
          const cxpLine = billJe.lines.find(l => l.credit > 0)
          if (cxpLine) { cxpCode = cxpLine.accountCode; cxpName = cxpLine.accountName }
        } catch { /* silent */ }
      }

      // Registrar pago — genera Dr.CxP / Cr.Banco en el backend
      await recordBillPayment(bill.id, {
        amount:        applyAmt,
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

      const amtGTQ = applyAmt * (isForeign ? exchangeRate : 1)
      const journalLines: Resultado['journalLines'] = cxpCode
        ? [
            { accountCode: cxpCode, accountName: cxpName, debe: amtGTQ, haber: 0 },
            { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '', debe: 0, haber: amtGTQ },
          ]
        : []

      message.success(`Pago aplicado — ${bill.invoiceNumber} (${bill.vendorName})`)
      setResultado({
        titulo: `Pago a proveedor — ${bill.invoiceNumber} (${bill.vendorName})`,
        journalLines,
      })
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo registrar el pago')
    } finally {
      setApplying(null)
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

      // Generar póliza contable
      const txDate    = String(transaction.transactionDate || '').split('T')[0]
      const amountGTQ = Number(transaction.amount) * (isForeign ? exchangeRate : 1)
      const glCode    = manualAccount?.code || ''
      const glName    = manualAccount?.name || ''
      const bankCode  = account.glAccountCode || ''
      const bankName  = account.glAccountName || ''
      const bankId    = account.glAccountId   || ''

      let journalLines: Resultado['journalLines'] = []
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
        titulo:              `Movimiento categorizado — ${glName || 'cuenta seleccionada'}`,
        journalEntryId:      jeId || undefined,
        journalEntryNumber:  jeNumber || undefined,
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
      // res puede ser Vendor[] directo o { data: Vendor[], meta: {...} }
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
        vendorId:            selectedVendorId,
        vendorName:          selectedVendorName,
        amount:              Number(transaction.amount),
        date:                txDate,
        currency:            account.currency,
        exchangeRate:        isForeign ? exchangeRate : 1,
        reference:           transaction.reference || undefined,
        bankAccountId:       account.id,
        advanceAccountCode:  accountDefaults.vendorAdvanceAccountCode,
      })

      await updateTransaction(account.id, transaction.id, {
        status:             'categorized',
        sourceDocumentId:   advance.id,
        sourceDocumentType: 'vendor_advance',
      } as any)

      const journalLines: Resultado['journalLines'] = advance.journalLines?.map(l => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debe:        l.debit,
        haber:       l.credit,
      })) ?? (advance.advanceAccountCode ? [
        { accountCode: advance.advanceAccountCode, accountName: advance.advanceAccountName || '', debe: amountGTQ, haber: 0 },
        { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '',    debe: 0,         haber: amountGTQ },
      ] : [])

      message.success(`Anticipo registrado — ${advance.advanceNumber}`)
      setResultado({
        titulo: `Anticipo a proveedor — ${advance.advanceNumber}`,
        journalLines,
      })
    } catch (e: any) {
      const raw = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'No se pudo registrar el anticipo'
      const msg = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : 'No se pudo registrar el anticipo'
      message.error(msg)
      console.error('[AnticipoProveedor]', e?.response?.data ?? e)
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
      const journalLines: Resultado['journalLines'] = [
        { accountCode: account.glAccountCode || '', accountName: account.glAccountName || '', debe: amountGTQ, haber: 0 },
        { accountCode: advCode,                     accountName: 'Anticipo de cliente',        debe: 0,         haber: amountGTQ },
      ]

      message.success(`Anticipo registrado — ${advance.invoiceNumber}`)
      setResultado({
        titulo: `Anticipo de cliente — ${advance.invoiceNumber}${selectedCustomerName ? ` (${selectedCustomerName})` : ''}`,
        journalLines,
      })
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
    Math.abs(Number(docAmt) - Number(transaction?.amount || 0)) < 0.015

  const invoiceCols: ColumnsType<Invoice> = [
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      ellipsis: true,
      render: (v, row) => (
        <div>
          <div>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{row.invoiceNumber}</Text>
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 115,
      align: 'right',
      render: v => moneyFmt(Number(v), account?.currency),
    },
    {
      title: 'Pendiente',
      dataIndex: 'balance',
      width: 115,
      align: 'right',
      render: (v, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Text strong style={{ color: '#cf1322' }}>{moneyFmt(Number(v), account?.currency)}</Text>
          {isExactMatch(Number(row.balance)) && <Tag color="green" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>Coincide</Tag>}
        </div>
      ),
    },
    {
      key: 'action',
      width: 85,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={applying === row.id}
          disabled={!!applying && applying !== row.id}
          style={{ background: NAVY }}
          onClick={() => applyToInvoice(row)}
        >
          Aplicar
        </Button>
      ),
    },
  ]

  const billCols: ColumnsType<PurchaseInvoice> = [
    {
      title: 'Proveedor',
      dataIndex: 'vendorName',
      ellipsis: true,
      render: (v, row) => (
        <div>
          <div>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{row.invoiceNumber}</Text>
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 115,
      align: 'right',
      render: v => moneyFmt(Number(v), account?.currency),
    },
    {
      title: 'Pendiente',
      dataIndex: 'balance',
      width: 115,
      align: 'right',
      render: (v, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Text strong style={{ color: '#cf1322' }}>{moneyFmt(Number(v), account?.currency)}</Text>
          {isExactMatch(Number(row.balance)) && <Tag color="green" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>Coincide</Tag>}
        </div>
      ),
    },
    {
      key: 'action',
      width: 85,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          icon={<LinkOutlined />}
          loading={applying === row.id}
          disabled={!!applying && applying !== row.id}
          onClick={() => applyToBill(row)}
        >
          Vincular
        </Button>
      ),
    },
  ]

  const journalCols = [
    { title: 'Cuenta', key: 'cuenta', ellipsis: true, render: (_: any, l: any) => <Text style={{ fontSize: 12 }}>{l.accountCode} — {l.accountName}</Text> },
    { title: 'Debe', dataIndex: 'debe', width: 110, align: 'right' as const, render: (v: number) => v ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{moneyFmt(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Haber', dataIndex: 'haber', width: 110, align: 'right' as const, render: (v: number) => v ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{moneyFmt(v)}</Text> : <Text type="secondary">—</Text> },
  ]

  if (!transaction) return null

  const txDate = String(transaction.transactionDate || '').split('T')[0]
  const [y, mo, d] = txDate.split('-')
  const fmtTxDate = y && mo && d ? `${d}/${mo}/${y}` : txDate

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
      {/* Resumen del movimiento */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>FECHA</Text>
            <div><Text strong>{fmtTxDate}</Text></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>MONTO{isForeign ? ` (${account?.currency})` : ''}</Text>
            <div>
              <Text strong style={{ fontSize: 18, color: isCredit ? '#389e0d' : '#cf1322' }}>
                {isCredit ? '+' : '–'} {moneyFmt(Number(transaction.amount), account?.currency)}
              </Text>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>DESCRIPCIÓN</Text>
            <div><Text strong>{transaction.description}</Text></div>
            {transaction.reference && <Text type="secondary" style={{ fontSize: 12 }}>Ref. {transaction.reference}</Text>}
          </div>
        </div>

        {/* Tipo de cambio — solo para cuentas en moneda extranjera */}
        {isForeign && !resultado && (
          <div style={{ marginTop: 10, borderTop: '1px dashed #cbd5e1', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Tipo de cambio 1 {account?.currency} =</Text>
            <InputNumber
              size="small"
              min={0.000001}
              precision={6}
              value={exchangeRate}
              onChange={v => setExchangeRate(Number(v) || 1)}
              style={{ width: 140 }}
            />
            <Text style={{ fontSize: 12 }}>GTQ</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>≈ {moneyFmt(Number(transaction.amount) * exchangeRate)} GTQ</Text>
          </div>
        )}
      </div>

      {/* ── RESULTADO después de aplicar ─────────────────────────────── */}
      {resultado ? (
        <div>
          <Alert
            type="success"
            showIcon
            message={resultado.titulo}
            style={{ marginBottom: 16 }}
          />

          {resultado.journalLines.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {resultado.journalEntryNumber
                    ? `Póliza ${resultado.journalEntryNumber}`
                    : 'Póliza contable generada'}
                </Title>
                {resultado.journalEntryId && (
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      const txDate = String(transaction?.transactionDate || '').split('T')[0]
                      setJeEditDate(txDate)
                      setJeEditRate(exchangeRate)
                      setEditingJE(v => !v)
                    }}
                  >
                    Editar
                  </Button>
                )}
              </div>

              {/* ── Edición inline de la póliza ───────────────────────── */}
              {editingJE && resultado.journalEntryId && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isForeign ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <Text style={{ fontSize: 12 }}>Fecha del asiento</Text>
                      <Input
                        size="small"
                        type="date"
                        value={jeEditDate}
                        onChange={e => setJeEditDate(e.target.value)}
                      />
                    </div>
                    {isForeign && (
                      <div>
                        <Text style={{ fontSize: 12 }}>Tipo de cambio (GTQ)</Text>
                        <InputNumber
                          size="small"
                          min={0.000001}
                          precision={6}
                          value={jeEditRate}
                          onChange={v => setJeEditRate(Number(v) || 1)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                  <Button size="small" type="primary" loading={savingJE} style={{ background: NAVY }} onClick={saveJE}>
                    Guardar cambios
                  </Button>
                </div>
              )}

              <Table
                size="small"
                dataSource={resultado.journalLines}
                rowKey={(_, i) => String(i)}
                columns={journalCols}
                pagination={false}
                style={{ marginBottom: 16 }}
              />
            </>
          ) : (
            <Alert type="info" message="La póliza contable se procesará en segundo plano." style={{ marginBottom: 16 }} />
          )}

          <Button type="primary" block style={{ background: NAVY }} onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <>
          {/* ── Facturas pendientes ───────────────────────────────────── */}
          <Title level={5} style={{ margin: '0 0 8px' }}>
            {isCredit ? 'Facturas pendientes de cobro' : 'Facturas proveedor pendientes'}
          </Title>
          <Input.Search
            size="small"
            allowClear
            placeholder={isCredit ? 'Buscar cliente o N° factura...' : 'Buscar proveedor o N° factura...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />

          {isCredit ? (
            <Table<Invoice>
              size="small"
              dataSource={invoices}
              rowKey="id"
              columns={invoiceCols}
              loading={loadingList}
              pagination={false}
              scroll={{ y: 220 }}
              locale={{ emptyText: 'Sin facturas pendientes' }}
            />
          ) : (
            <Table<PurchaseInvoice>
              size="small"
              dataSource={bills}
              rowKey="id"
              columns={billCols}
              loading={loadingList}
              pagination={false}
              scroll={{ y: 220 }}
              locale={{ emptyText: 'Sin facturas proveedor pendientes' }}
            />
          )}

          <Divider style={{ margin: '14px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>o categorizar como</Text>
          </Divider>

          {/* ── Anticipo ─────────────────────────────────────────────── */}
          {isCredit ? showCustomerForm ? (
            <div style={{ border: '1px solid #722ed1', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#722ed1', display: 'block', marginBottom: 6 }}>
                Cliente para el anticipo (cta {accountDefaults.customerAdvanceAccountCode || '2110'})
              </Text>
              <Select
                showSearch
                allowClear
                placeholder="Buscar cliente..."
                size="small"
                style={{ width: '100%', marginBottom: 8 }}
                filterOption={false}
                onSearch={searchCustomers}
                onFocus={() => searchCustomers('')}
                loading={customerSearching}
                value={selectedCustomerId}
                onChange={(val, opt: any) => {
                  setSelectedCustomerId(val)
                  setSelectedCustomerName(opt?.label ?? '')
                }}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                notFoundContent={customerSearching ? 'Buscando…' : 'Sin resultados'}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  icon={<ClockCircleOutlined />}
                  loading={savingAdvance}
                  disabled={!selectedCustomerId}
                  style={{ flex: 1, background: '#722ed1', borderColor: '#722ed1' }}
                  onClick={applyAsCustomerAdvance}
                >
                  Registrar anticipo
                </Button>
                <Button size="small" onClick={() => { setShowCustomerForm(false); setSelectedCustomerId(undefined); setSelectedCustomerName(undefined) }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              block
              icon={<ClockCircleOutlined />}
              style={{ marginBottom: 8, borderColor: '#722ed1', color: '#722ed1' }}
              onClick={() => { setShowCustomerForm(true); searchCustomers('') }}
            >
              Anticipo de cliente
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                ({accountDefaults.customerAdvanceAccountCode || '2110'})
              </Text>
            </Button>
          ) : showVendorForm ? (
            <div style={{ border: '1px solid #722ed1', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#722ed1', display: 'block', marginBottom: 6 }}>
                Proveedor para el anticipo (cta {accountDefaults.vendorAdvanceAccountCode || '1500'})
              </Text>
              <Select
                showSearch
                allowClear
                placeholder="Buscar proveedor..."
                size="small"
                style={{ width: '100%', marginBottom: 8 }}
                filterOption={false}
                onSearch={searchVendors}
                onFocus={() => searchVendors('')}
                loading={vendorSearching}
                value={selectedVendorId}
                onChange={(val, opt: any) => {
                  setSelectedVendorId(val)
                  setSelectedVendorName(opt?.label ?? '')
                }}
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                notFoundContent={vendorSearching ? 'Buscando…' : 'Sin resultados'}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  icon={<ClockCircleOutlined />}
                  loading={savingAdvance}
                  disabled={!selectedVendorId}
                  style={{ flex: 1, background: '#722ed1', borderColor: '#722ed1' }}
                  onClick={applyAsVendorAdvance}
                >
                  Registrar anticipo
                </Button>
                <Button size="small" onClick={() => { setShowVendorForm(false); setSelectedVendorId(undefined); setSelectedVendorName(undefined) }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              block
              icon={<ClockCircleOutlined />}
              style={{ marginBottom: 8, borderColor: '#722ed1', color: '#722ed1' }}
              onClick={() => { setShowVendorForm(true); searchVendors('') }}
            >
              Anticipo a proveedor
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                ({accountDefaults.vendorAdvanceAccountCode || '1500'})
              </Text>
            </Button>
          )}

          <Divider style={{ margin: '14px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>o seleccionar cuenta contable</Text>
          </Divider>

          <div style={{ display: 'grid', gap: 8 }}>
            <AccountSelect
              filter={{}}
              placeholder="Selecciona cuenta contable..."
              value={manualAccountId}
              onChange={setManualAccountId}
              onChangeAccount={setManualAccount}
              size="small"
            />
            <Button
              type="primary"
              block
              disabled={!manualAccountId}
              loading={savingManual}
              style={{ background: NAVY }}
              onClick={applyManual}
            >
              Categorizar con cuenta seleccionada
            </Button>
          </div>
        </>
      )}
    </Drawer>
  )
}
