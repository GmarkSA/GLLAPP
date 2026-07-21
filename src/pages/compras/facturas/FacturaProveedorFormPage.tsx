import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, InputNumber, Input, Button,
  Card, Breadcrumb, Typography, Spin, Divider, message,
  Tag, Alert, Space, Table, Checkbox, Modal,
} from 'antd'
import {
  SaveOutlined, CheckOutlined, HomeOutlined, ThunderboltOutlined,
  SwapOutlined, EditOutlined, SyncOutlined, TeamOutlined, DollarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getApiError } from '../../../api/axios'

import {
  createBill, updateBill, getBill, approveBill, getVendors,
  getJournalEntry, regenerateBillJournalEntry,
  getVendorAdvances, applyVendorAdvanceToBill,
  type BillType, type PaymentTerms, type JournalEntry, type JournalEntryLine, type VendorAdvance,
  BILL_TYPE_CONFIG, IDP_RATES,
} from '../../../api/compras'
import { getOrganizationProfile } from '../../../api/configuracion'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getExchangeRateForDate } from '../../../api/monedas'
import LineItemsEditor, {
  type LineItem,
  newLineItem,
  calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'
import PaymentTermsSelect, { getPaymentTermDays } from '../../../components/PaymentTermsSelect'
import SelectorDimensionesAnaliticas, { type DimensionesValue } from '../../../components/SelectorDimensionesAnaliticas'

const { Text } = Typography

const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Calcula ISR progresivo por tramos (igual que la vista previa de configuración fiscal).
 *  tiers deben tener upTo (null = sin límite) y rate (%). */
function calcProgressiveISR(base: number, tiers: { upTo: number | null; rate: number }[]): number {
  const sorted = [...tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
  let total    = 0
  let prevLimit = 0
  for (const tier of sorted) {
    if (base <= prevLimit) break
    const limit   = tier.upTo ?? Infinity
    const taxable = Math.min(base, limit) - prevLimit
    total    += taxable * tier.rate / 100
    prevLimit = limit
  }
  return Math.round(total * 100) / 100
}

const BILL_TYPES: { value: BillType; label: string }[] = [
  { value: 'goods',    label: BILL_TYPE_CONFIG.goods.label    },
  { value: 'services', label: BILL_TYPE_CONFIG.services.label },
  { value: 'special',  label: BILL_TYPE_CONFIG.special.label  },
  { value: 'fuel',     label: BILL_TYPE_CONFIG.fuel.label     },
]


const FUEL_UNITS = new Set(Object.keys(IDP_RATES))

export default function FacturaProveedorFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromPO   = !id ? (location.state as any)?.fromPO as { purchaseOrderId: string; vendorId: string; vendorName: string; items: LineItem[] } | undefined : undefined
  const [form] = Form.useForm()

  const [items, setItems]               = useState<LineItem[]>([newLineItem()])
  const [taxes, setTaxes]               = useState<Tax[]>([])
  const [vendors, setVendors]           = useState<{ value: string; label: string; commercialName?: string; type?: string; defaultPurchaseTaxId?: string; tdsEnabled?: boolean; tdsTaxCode?: string; paymentTerms?: string; paymentTermsDays?: number; expenseAccountId?: string; payableAccountId?: string; currency?: string }[]>([])
  const [vendorCurrency, setVendorCurrency] = useState<string>('GTQ')
  const [exchangeRate,   setExchangeRate]   = useState<number>(1)
  const [rateDate,       setRateDate]       = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [editingRate,    setEditingRate]    = useState(false)
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)
  const [exchangeRateMeta, setExchangeRateMeta] = useState<{ effectiveDate: string; source: string } | null>(null)
  const [accounts, setAccounts]         = useState<Account[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loading, setLoading]           = useState(!!id)
  const [saving, setSaving]             = useState(false)
  const [approving, setApproving]       = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [billStatus, setBillStatus]         = useState<string>('draft')
  const [billBalance, setBillBalance]       = useState<number>(0)
  const [billInvoiceNumber, setBillInvoiceNumber] = useState<string>('')
  const [antModal, setAntModal]             = useState(false)
  const [advances, setAdvances]             = useState<VendorAdvance[]>([])
  const [loadingAdv, setLoadingAdv]         = useState(false)
  const [selectedAdvId, setSelectedAdvId]   = useState<string | undefined>()
  const [antAmount, setAntAmount]           = useState<number>(0)
  const [applyingAdv, setApplyingAdv]       = useState(false)
  const [purchaseOrderId, setPurchaseOrderId]         = useState<string | undefined>(fromPO?.purchaseOrderId)
  const [vendorDefaultTaxId, setVendorDefaultTaxId]   = useState<string | undefined>()
  const [vendorIsrTax, setVendorIsrTax]               = useState<Tax | undefined>()
  const [isrAppliedRate, setIsrAppliedRate]           = useState(0)  // tasa efectiva (puede ser tier)
  const [loadedIsrAccountId, setLoadedIsrAccountId]   = useState<string | undefined>()
  const [journalEntry, setJournalEntry]               = useState<JournalEntry | null>(null)
  const [reclasEntry, setReclasEntry]                 = useState<JournalEntry | null>(null)

  // Retention amounts (controlled outside form for live calculation)
  const [isrAmount, setIsrAmount]       = useState(0)
  const [ivaRetAmount, setIvaRetAmount] = useState(0)
  const [editingIsr, setEditingIsr]     = useState(false)
  const [editingIvaRet, setEditingIvaRet] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Impuestos especiales
  const [hasTimbrePrens, setHasTimbrePrens] = useState(false)
  const [hasTurismo,     setHasTurismo]     = useState(false)
  const [orgImpEsp, setOrgImpEsp] = useState<{ idpAccountCode?: string; timbrePrensaAccountCode?: string; turismoAccountCode?: string; timbrePrensaRate?: number; turismoRate?: number } | null>(null)

  // Watched form values
  const invoiceType      = Form.useWatch('invoiceType',              form) as BillType   ?? 'goods'
  const paymentTerms     = Form.useWatch('paymentTerms',             form) as PaymentTerms ?? 'immediate'
  const invoiceDate      = Form.useWatch('invoiceDate',              form)
  const customDays       = Form.useWatch('paymentTermsDays',         form) as number
  const watchCurr        = Form.useWatch('currency',                 form) ?? 'GTQ'
  const watchVendorId    = Form.useWatch('vendorId',                 form) as string | undefined
  const isReimbursement  = Form.useWatch('isExpenseReimbursement',   form) as boolean ?? false

  // Auto-fill accounts from org settings when fuel type selected or service checkboxes checked
  useEffect(() => {
    if (invoiceType === 'fuel' && orgImpEsp?.idpAccountCode && !form.getFieldValue('idpAccountId')) {
      const acc = accounts.find(a => a.code === orgImpEsp.idpAccountCode)
      if (acc) form.setFieldValue('idpAccountId', acc.id)
    }
  }, [invoiceType, orgImpEsp, accounts, form])

  useEffect(() => {
    if (hasTimbrePrens && orgImpEsp?.timbrePrensaAccountCode && !form.getFieldValue('timbrePrensaAccountId')) {
      const acc = accounts.find(a => a.code === orgImpEsp.timbrePrensaAccountCode)
      if (acc) form.setFieldValue('timbrePrensaAccountId', acc.id)
    }
  }, [hasTimbrePrens, orgImpEsp, accounts, form])

  useEffect(() => {
    if (hasTurismo && orgImpEsp?.turismoAccountCode && !form.getFieldValue('turismoAccountId')) {
      const acc = accounts.find(a => a.code === orgImpEsp.turismoAccountCode)
      if (acc) form.setFieldValue('turismoAccountId', acc.id)
    }
  }, [hasTurismo, orgImpEsp, accounts, form])

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getAccounts({ limit: 200 })
      .then((res: any) => {
        const list: Account[] = Array.isArray(res) ? res : (res?.data ?? [])
        setAccounts(list.filter(a => a.isActive && !a.isHeader))
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchVendors('') }, [])

  useEffect(() => {
    getOrganizationProfile()
      .then((p: any) => {
        const ie = p?.settings?.impuestosEspeciales
        if (ie) setOrgImpEsp({
          idpAccountCode:          ie.idp?.accountCode,
          timbrePrensaAccountCode: ie.timbre_prensa?.accountCode,
          turismoAccountCode:      ie.turismo?.accountCode,
          timbrePrensaRate:        ie.timbre_prensa?.rate ?? 0.5,
          turismoRate:             ie.turismo?.rate ?? 10,
        })
      })
      .catch(() => null)
  }, [])

  // Pre-fill from Purchase Order when converting OC → Factura Proveedor
  useEffect(() => {
    if (!fromPO) return
    setPurchaseOrderId(fromPO.purchaseOrderId)
    if (fromPO.vendorId && fromPO.vendorName) {
      setVendors(prev => {
        if (prev.find(v => v.value === fromPO.vendorId)) return prev
        return [{ value: fromPO.vendorId, label: fromPO.vendorName }, ...prev]
      })
      form.setFieldValue('vendorId', fromPO.vendorId)
    }
    if (fromPO.items?.length) {
      setItems(fromPO.items.map(it => newLineItem({
        productId:       it.productId,
        description:     it.description,
        unit:            it.unit,
        quantity:        Number(it.quantity),
        unitPrice:       Number(it.unitPrice),
        discountPercent: Number(it.discountPercent ?? 0),
        taxPercent:      Number(it.taxPercent ?? 12),
        taxId:           it.taxId,
        accountId:       it.accountId,
        projectId:       it.projectId,
      })))
    }
    form.setFieldValue('invoiceDate', dayjs())
  // run once on mount when fromPO is present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getBill(id)
      .then((bill) => {
        setBillStatus(bill.status)
        setBillBalance(Number(bill.balance ?? 0))
        setBillInvoiceNumber(bill.invoiceNumber ?? '')
        form.setFieldsValue({
          vendorId:            bill.vendorId,
          invoiceType:         bill.invoiceType    ?? 'goods',
          invoiceDate:         bill.invoiceDate ? dayjs(bill.invoiceDate) : undefined,
          dueDate:             bill.dueDate    ? dayjs(bill.dueDate)    : undefined,
          paymentTerms:        bill.paymentTerms   ?? 'immediate',
          paymentTermsDays:    bill.paymentTermsDays,
          accountingDate:      bill.accountingDate ? dayjs(bill.accountingDate) : undefined,
          currency:            bill.currency       ?? 'GTQ',
          vendorInvoiceNumber: bill.vendorInvoiceNumber ?? '',
          accountId:           bill.accountId,
          // FEL
          felSerie:            bill.felSerie,
          felNumber:           bill.felNumber,
          felUuid:             bill.felUuid,
          felAuthNumber:       bill.felAuthNumber,
          felMessage:          bill.felMessage,
          felCertDate:         bill.felCertDate ? dayjs(bill.felCertDate) : undefined,
          // Reembolso
          isExpenseReimbursement:   bill.isExpenseReimbursement ?? false,
          employeeId:               bill.employeeId,
          employeePayableAccountId: bill.employeePayableAccountId,
          // IDP
          fuelType:            undefined,
          idpAccountId:        bill.idpAccountId,
          // Notes
          notes:               bill.notes,
          dimensiones: {
            centroCostoId:    bill.centroCostoId    ?? null,
            centroBeneficioId: bill.centroBeneficioId ?? null,
          } satisfies DimensionesValue,
        })
        if (bill.vendorId && bill.vendorName) {
          setVendors(prev => {
            if (prev.find(v => v.value === bill.vendorId)) return prev
            return [{ value: bill.vendorId, label: bill.vendorName }, ...prev]
          })
        }
        setIsrAmount(Number(bill.isrRetentionAmount ?? 0))
        setIvaRetAmount(Number(bill.ivaRetentionAmount ?? 0))
        // Restaurar tipo de cambio si la factura es en moneda extranjera
        if (bill.currency && bill.currency !== 'GTQ') {
          setVendorCurrency(bill.currency)
          if (bill.exchangeRate && Number(bill.exchangeRate) > 1) {
            setExchangeRate(Number(bill.exchangeRate))
          }
        }
        setLoadedIsrAccountId(bill.isrRetentionAccountId ?? undefined)
        if (bill.journalEntryId) {
          getJournalEntry(bill.journalEntryId)
            .then(je => setJournalEntry(je))
            .catch(() => {})
        }
        if (bill.reclassificationJournalEntryId) {
          getJournalEntry(bill.reclassificationJournalEntryId)
            .then(je => setReclasEntry(je))
            .catch(() => {})
        }
        const loadedItems: LineItem[] = (bill.items ?? []).map(it =>
          newLineItem({
            _key: it.id ?? undefined,
            productId: it.productId,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discountPercent: Number(it.discountPercent ?? 0),
            taxPercent: Number(it.taxPercent ?? 12),
            taxId: it.taxId,
            accountId: it.accountId,
            projectId: it.projectId,
          }),
        )
        setItems(loadedItems.length ? loadedItems : [newLineItem()])
      })
      .catch(() => message.error('No se pudo cargar la factura de proveedor'))
      .finally(() => setLoading(false))
  }, [id, form])

  // Auto-update due date cuando cambian los términos de pago o la fecha de factura.
  // getPaymentTermDays() resuelve cualquier net_N (7, 10, 25, 45...) automáticamente.
  useEffect(() => {
    if (!invoiceDate) return
    const termValue = paymentTerms as string
    if (!termValue || termValue === 'immediate') {
      form.setFieldValue('dueDate', undefined)
      return
    }
    // Resolución de días: estándar (net_7, net_30...) o custom con días
    const stdDays = getPaymentTermDays(termValue)
    const days    = stdDays !== null ? stdDays : (termValue === 'custom' ? (customDays ?? 30) : 0)
    if (days > 0) form.setFieldValue('dueDate', dayjs(invoiceDate).add(days, 'day'))
  }, [paymentTerms, invoiceDate, customDays, form])

  // Sincroniza impuesto, términos de pago y moneda del proveedor cuando cambia el vendorId
  useEffect(() => {
    if (!watchVendorId) return
    const found = vendors.find(v => v.value === watchVendorId)
    if (!found) return
    setVendorDefaultTaxId(found.defaultPurchaseTaxId)

    // Auto-set moneda y tipo de cambio según el proveedor
    if (!id && found.currency) {
      form.setFieldValue('currency', found.currency)
      const isForex = found.currency !== 'GTQ'
      setVendorCurrency(found.currency)
      if (isForex) setRateDate(dayjs().format('YYYY-MM-DD'))
    }

    // Auto-fill payment terms solo en facturas nuevas.
    // PaymentTermsSelect acepta cualquier net_N (7, 10, 25, 45...) — no hay mapeo needed.
    if (!id && found.paymentTerms) {
      form.setFieldValue('paymentTerms', found.paymentTerms)
      if (found.paymentTermsDays != null) {
        form.setFieldValue('paymentTermsDays', found.paymentTermsDays)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, watchVendorId])

  // Resuelve el Tax de ISR configurado en el proveedor y determina la tasa inicial
  useEffect(() => {
    if (!watchVendorId || !taxes.length) { setVendorIsrTax(undefined); setIsrAppliedRate(0); return }
    const vendor = vendors.find(v => v.value === watchVendorId)
    if (vendor?.tdsEnabled && vendor.tdsTaxCode) {
      const tax = taxes.find(t => t.code === vendor.tdsTaxCode && t.isActive)
      setVendorIsrTax(tax)
      if (tax) {
        const defaultRate = tax.subtype === 'progressive' && tax.tiers?.length
          ? Math.min(...tax.tiers.map(t => t.rate))  // tasa mínima del tramo como punto de partida
          : Number(tax.rate)
        setIsrAppliedRate(defaultRate)
      }
    } else {
      setVendorIsrTax(undefined)
      setIsrAppliedRate(0)
    }
  }, [vendors, watchVendorId, taxes])

  // Auto-calcula ISR solo en facturas nuevas (no en edición — el monto guardado prevalece)
  useEffect(() => {
    if (id || !vendorIsrTax) return
    const subtotal = calcTotals(items).subtotal
    const amount = vendorIsrTax.subtype === 'progressive' && vendorIsrTax.tiers?.length
      ? calcProgressiveISR(subtotal, vendorIsrTax.tiers)
      : Math.round(subtotal * isrAppliedRate / 100 * 100) / 100
    setIsrAmount(amount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, vendorIsrTax, isrAppliedRate])

  // Auto-carga el tipo de cambio desde Banguat cuando cambia la moneda o la fecha de factura
  useEffect(() => {
    if (watchCurr === 'GTQ') {
      setVendorCurrency('GTQ')
      setExchangeRate(1)
      setExchangeRateMeta(null)
      return
    }
    setVendorCurrency(watchCurr)
    const date = invoiceDate ? dayjs(invoiceDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    setRateDate(date)
    setLoadingExchangeRate(true)
    getExchangeRateForDate(watchCurr, date)
      .then((result) => {
        const rate = result.officialRate ?? (result.rate > 0 ? 1 / result.rate : 1)
        setExchangeRate(Number(rate.toFixed(6)))
        setExchangeRateMeta({ effectiveDate: result.effectiveDate, source: result.source })
      })
      .catch(() => {
        message.warning('No se pudo cargar el tipo de cambio para la fecha seleccionada')
      })
      .finally(() => setLoadingExchangeRate(false))
  }, [watchCurr, invoiceDate])

  // ── Vendor search ──────────────────────────────────────────────────────────

  const fetchVendors = useCallback((search: string) => {
    setLoadingVendors(true)
    getVendors({ search, limit: 30 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setVendors(prev => {
          const map = new Map(prev.map(v => [v.value, v]))
          list.forEach((v: any) => map.set(v.id, {
            value: v.id,
            // Mostrar Razón Social (SAT) como nombre principal; nombre comercial como subtítulo
            label: v.legalName ?? v.name,
            commercialName:       v.name ?? undefined,
            type:                 v.type ?? undefined,
            expenseAccountId:     v.expenseAccountId  ?? undefined,
            payableAccountId:     v.payableAccountId  ?? undefined,
            defaultPurchaseTaxId: v.defaultPurchaseTaxId ?? undefined,
            tdsEnabled:           v.tdsEnabled ?? false,
            tdsTaxCode:           v.tdsTaxCode ?? undefined,
            paymentTerms:         v.paymentTerms ?? undefined,
            paymentTermsDays:     v.paymentTermsDays ?? undefined,
            currency:             v.currency ?? undefined,
          }))
          return [...map.values()]
        })
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false))
  }, [])

  const handleVendorSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchVendors(val), 300)
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totals = calcTotals(items)

  // IDP calculation: per-line, derived from unit (super/regular/diesel)
  const idpAmount = invoiceType === 'fuel'
    ? Math.round(items.reduce((sum, it) => {
        const rate = FUEL_UNITS.has(it.unit ?? '') ? (IDP_RATES[it.unit!] ?? 0) : 0
        return sum + Number(it.quantity || 0) * rate
      }, 0) * 100) / 100
    : 0

  // For special invoices, IVA retention = taxAmount (buyer retains it)
  const ivaRetForSpecial = invoiceType === 'special' ? totals.taxAmount : ivaRetAmount
  const totalRetention   = isrAmount + (invoiceType === 'special' ? ivaRetForSpecial : ivaRetAmount)

  // Impuestos especiales de servicios
  const timbrePrensaRate = orgImpEsp?.timbrePrensaRate ?? 0.5
  const turismoRate      = orgImpEsp?.turismoRate ?? 10
  const timbrePrensaAmount = (invoiceType === 'services' && hasTimbrePrens)
    ? Math.round(totals.subtotal * (timbrePrensaRate / 100) * 100) / 100 : 0
  const turismoAmount = (invoiceType === 'services' && hasTurismo)
    ? Math.round(totals.subtotal * (turismoRate / 100) * 100) / 100 : 0

  // IDP se suma al gross porque el precio SAT ("P. Unitario con IVA") no lo incluye
  const netPayable = Math.round((totals.total + idpAmount + timbrePrensaAmount + turismoAmount - totalRetention) * 100) / 100

  // ── Account options ────────────────────────────────────────────────────────

  const allAccounts = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))

  // ── Save ───────────────────────────────────────────────────────────────────

  const buildDto = (status: string) => {
    const vals = form.getFieldsValue()
    const dim = vals.dimensiones as DimensionesValue | undefined
    const lineItems = items.map(it => ({
      productId: it.productId,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      taxInclusive: it.taxInclusive ?? true,
      taxId: it.taxId,
      accountId: it.accountId,
      projectId: it.projectId,
      // Para facturas de combustible: el idpType se deriva de la unidad de medida
      idpType: FUEL_UNITS.has(it.unit ?? '') ? it.unit : undefined,
    }))
    const isReim = vals.isExpenseReimbursement ?? false
    return {
      vendorId:            vals.vendorId,
      invoiceDate:         vals.invoiceDate ? vals.invoiceDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      accountingDate:      vals.accountingDate ? vals.accountingDate.format('YYYY-MM-DD') : undefined,
      dueDate:             vals.dueDate ? vals.dueDate.format('YYYY-MM-DD') : undefined,
      currency:            vals.currency ?? 'GTQ',
      exchangeRate:        vendorCurrency !== 'GTQ' ? exchangeRate : 1,
      invoiceType:         vals.invoiceType ?? 'goods',
      paymentTerms:        vals.paymentTerms ?? 'immediate',
      paymentTermsDays:    vals.paymentTerms === 'custom' ? vals.paymentTermsDays : undefined,
      vendorInvoiceNumber: vals.vendorInvoiceNumber || undefined,
      accountId:           vals.accountId,
      // FEL
      felSerie:            vals.felSerie   || undefined,
      felNumber:           vals.felNumber  || undefined,
      felUuid:             vals.felUuid    || undefined,
      felAuthNumber:       vals.felAuthNumber || undefined,
      felMessage:          vals.felMessage   || undefined,
      felCertDate:         vals.felCertDate ? vals.felCertDate.toISOString() : undefined,
      // Retenciones
      isrRetentionAmount:    isrAmount,
      ivaRetentionAmount:    invoiceType === 'special' ? totals.taxAmount : ivaRetAmount,
      isrRetentionAccountId: vendorIsrTax?.retentionAccountId ?? vendorIsrTax?.purchaseAccountId ?? loadedIsrAccountId,
      // Reembolso
      isExpenseReimbursement:   isReim,
      employeeId:               isReim ? vals.employeeId : undefined,
      employeeName:             isReim ? vendors.find(e => e.value === vals.employeeId && e.type === 'employee')?.label : undefined,
      employeePayableAccountId: isReim ? vals.employeePayableAccountId : undefined,
      // IDP
      idpAmount:           idpAmount,
      idpAccountId:        vals.invoiceType === 'fuel' ? vals.idpAccountId : undefined,
      // Impuestos especiales servicios
      timbrePrensaAmount:     timbrePrensaAmount || undefined,
      timbrePrensaAccountId:  (invoiceType === 'services' && hasTimbrePrens) ? vals.timbrePrensaAccountId : undefined,
      turismoAmount:          turismoAmount || undefined,
      turismoAccountId:       (invoiceType === 'services' && hasTurismo) ? vals.turismoAccountId : undefined,
      status,
      notes: vals.notes,
      items: lineItems,
      purchaseOrderId:    purchaseOrderId ?? undefined,
      centroCostoId:      dim?.centroCostoId    || undefined,
      centroBeneficioId:  dim?.centroBeneficioId || undefined,
    }
  }

  /** Guarda como borrador — sin generar póliza contable */
  const handleSaveDraft = async () => {
    try { await form.validateFields(['vendorId', 'invoiceDate']) } catch { return }
    setSaving(true)
    try {
      const dto = buildDto('draft')
      const result: any = id ? await updateBill(id, dto as any) : await createBill(dto as any)
      message.success('Guardado como borrador')
      navigate(`/compras/facturas/${result.id}`)
    } catch (err: any) {
      message.error(getApiError(err, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  /** Guarda y abre — genera la póliza contable automáticamente en un solo paso */
  const handleSaveAndOpen = async () => {
    try { await form.validateFields(['vendorId', 'invoiceDate']) } catch { return }
    setApproving(true)
    try {
      // Paso 1: guardar / crear
      const dto = buildDto('draft')
      const result: any = id ? await updateBill(id, dto as any) : await createBill(dto as any)
      const invoiceId = result.id ?? id
      // Paso 2: aprobar → genera póliza contable (CxP + IVA CF + retenciones)
      await approveBill(invoiceId)
      message.success('Factura abierta — póliza contable generada')
      navigate(`/compras/facturas/${invoiceId}`)
    } catch (err: any) {
      message.error(getApiError(err, 'Error al abrir la factura'))
    } finally {
      setApproving(false)
    }
  }

  const handleApprove = handleSaveAndOpen   // alias — usado por flujos internos existentes

  const handleRegenerate = async () => {
    if (!id) return
    setRegenerating(true)
    try {
      const updated = await regenerateBillJournalEntry(id)
      if (updated.journalEntryId) {
        const je = await getJournalEntry(updated.journalEntryId)
        setJournalEntry(je)
      }
      if (updated.reclassificationJournalEntryId) {
        const rje = await getJournalEntry(updated.reclassificationJournalEntryId)
        setReclasEntry(rje)
      } else {
        setReclasEntry(null)
      }
      message.success('Póliza contable regenerada')
    } catch (err: any) {
      message.error('Error al regenerar: ' + getApiError(err, 'intente de nuevo'))
    } finally {
      setRegenerating(false)
    }
  }

  const canApprove  = !!id && ['draft', 'pending_approval'].includes(billStatus)
  const canPayBill  = !!id && ['open', 'partial', 'overdue'].includes(billStatus) && billBalance > 0

  const openAnticipoModal = async () => {
    if (!watchVendorId) return
    setSelectedAdvId(undefined)
    setAntAmount(0)
    setLoadingAdv(true)
    setAntModal(true)
    try {
      const res = await getVendorAdvances({ vendorId: watchVendorId, status: 'open', limit: 50 })
      const partials = await getVendorAdvances({ vendorId: watchVendorId, status: 'partial', limit: 50 })
      setAdvances([...(res.data ?? []), ...(partials.data ?? [])])
    } catch { message.error('No se pudieron cargar los anticipos') }
    finally { setLoadingAdv(false) }
  }

  const handleApplyAnticipo = async () => {
    if (!selectedAdvId || !id) return
    setApplyingAdv(true)
    try {
      await applyVendorAdvanceToBill(selectedAdvId, id, antAmount || undefined)
      message.success('Anticipo aplicado correctamente — póliza contable generada')
      setAntModal(false)
      // Reload bill to reflect new balance/status
      const updated = await getBill(id)
      setBillStatus(updated.status)
      setBillBalance(Number(updated.balance ?? 0))
    } catch (e: any) {
      message.error(getApiError(e, 'Error al aplicar el anticipo'))
    } finally { setApplyingAdv(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  )

  return (
    <div style={{ padding: 24, background: '#fafbfc', minHeight: '100vh' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/compras/facturas">Facturas Proveedor</Link> },
          { title: id ? 'Editar' : 'Nueva Factura Proveedor' },
        ]}
      />

      {fromPO && (
        <Alert
          type="info"
          icon={<SwapOutlined />}
          showIcon
          message="Factura creada desde Orden de Compra"
          description={`Proveedor, líneas e importes copiados de la OC. Completa los datos FEL y guarda.`}
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Encabezado unificado: datos generales + FEL ─────────────────── */}
          <Card title={<span style={{ color: '#1faec2', fontWeight: 600 }}>
            {id ? 'Editar Factura Proveedor' : 'Nueva Factura Proveedor'}
          </span>}>
            <Form form={form} layout="vertical" size="small" initialValues={{ currency: 'GTQ', invoiceType: 'goods', paymentTerms: 'immediate', accountingDate: dayjs() }}>

              {/* Fila 1: Proveedor | Tipo de factura + checkboxes servicios */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr minmax(180px, auto)', gap: '0 16px' }}>
                <Form.Item name="vendorId" label="Proveedor / Empleado" rules={[{ required: true, message: 'Seleccione un proveedor' }]}>
                  <Select
                    showSearch
                    placeholder="Buscar por Razón Social o nombre comercial…"
                    filterOption={false}
                    loading={loadingVendors}
                    onSearch={handleVendorSearch}
                    notFoundContent={loadingVendors ? 'Buscando…' : 'Sin resultados'}
                    optionRender={(opt) => {
                      const v = vendors.find(x => x.value === opt.value)
                      return (
                        <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                          {v?.commercialName && v.commercialName !== opt.label?.toString() && (
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{v.commercialName}</div>
                          )}
                        </div>
                      )
                    }}
                    options={vendors.map(v => ({ value: v.value, label: v.label }))}
                  />
                </Form.Item>
                <div>
                  <Form.Item name="invoiceType" label="Tipo de factura" rules={[{ required: true }]}>
                    <Select options={BILL_TYPES} />
                  </Form.Item>
                  {invoiceType === 'services' && (
                    <div style={{ display: 'flex', gap: 16, marginTop: -8, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Checkbox
                        checked={hasTimbrePrens}
                        onChange={e => setHasTimbrePrens(e.target.checked)}
                      >
                        <span style={{ fontSize: 12 }}>Timbre de Prensa</span>
                      </Checkbox>
                      <Checkbox
                        checked={hasTurismo}
                        onChange={e => setHasTurismo(e.target.checked)}
                      >
                        <span style={{ fontSize: 12 }}>Turismo INGUAT</span>
                      </Checkbox>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo de cambio — visible solo cuando la moneda del proveedor no es GTQ */}
              {vendorCurrency !== 'GTQ' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', marginBottom: 12,
                  background: '#f0f9ff', borderRadius: 6,
                  border: '1px solid #bae6fd',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    1 {vendorCurrency} =
                  </span>
                  {editingRate ? (
                    <InputNumber
                      value={exchangeRate}
                      precision={6}
                      min={0.000001}
                      step={0.01}
                      style={{ width: 130 }}
                      autoFocus
                      onChange={v => setExchangeRate(v ?? 1)}
                      onBlur={() => setEditingRate(false)}
                      onPressEnter={() => setEditingRate(false)}
                      addonAfter="GTQ"
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                      {loadingExchangeRate ? '...' : exchangeRate.toFixed(6)} GTQ
                    </span>
                  )}
                  <Button
                    size="small" type="text" icon={<EditOutlined />}
                    onClick={() => setEditingRate(!editingRate)}
                    title="Editar tipo de cambio manualmente"
                    style={{ color: '#374151' }}
                    disabled={loadingExchangeRate}
                  />
                  <span style={{ fontSize: 11, color: '#9aa1ab', marginLeft: 4 }}>
                    {loadingExchangeRate
                      ? 'Consultando Banguat...'
                      : exchangeRateMeta
                        ? `Tasa del ${dayjs(exchangeRateMeta.effectiveDate).format('DD/MM/YYYY')} (${exchangeRateMeta.source})`
                        : `Vigente al ${rateDate}`}
                  </span>
                </div>
              )}

              {/* Fila 2: Fecha | Serie | Número SAT | Moneda */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="invoiceDate" label="Fecha de factura" rules={[{ required: true, message: 'Ingrese la fecha' }]}>
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

              {/* Fila 3: Autorización SAT | Términos de pago | Fecha de vencimiento | Fecha de contabilización */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="felAuthNumber" label="Autorización SAT">
                  <Input placeholder="Número de autorización SAT" />
                </Form.Item>
                <Form.Item name="paymentTerms" label="Términos de pago">
                  <PaymentTermsSelect size="small" />
                </Form.Item>
                <Form.Item name="dueDate" label="Fecha de vencimiento">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item
                  name="accountingDate"
                  label={
                    <span>
                      Fecha de contabilización
                      <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4, fontWeight: 400 }}>
                        (período contable)
                      </span>
                    </span>
                  }
                  tooltip="Fecha en que se registra en libros contables. Puede diferir de la fecha de factura cuando se recibe en un período distinto."
                >
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </div>

              {/* Dimensiones analíticas */}
              <Form.Item name="dimensiones" style={{ marginBottom: 4 }}>
                <SelectorDimensionesAnaliticas layout="form" />
              </Form.Item>

            </Form>
          </Card>

          {/* Checkbox Reembolso de Gastos */}
          <Card styles={{ body: { padding: '12px 16px' } }}>
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="isExpenseReimbursement" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>
                  <span style={{ fontWeight: 600, color: '#1faec2' }}>
                    <TeamOutlined style={{ marginRight: 6 }} />
                    Reembolso de gastos
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                    — la deuda se traslada al empleado mediante un asiento de reclasificación
                  </span>
                </Checkbox>
              </Form.Item>
            </Form>
          </Card>

          {/* Sección de empleado — visible solo si el checkbox está activo */}
          {isReimbursement && (
            <Card
              title={<span style={{ color: '#ff7f00', fontWeight: 600 }}><TeamOutlined style={{ marginRight: 6 }} />Datos del Empleado</span>}
              style={{ border: '1px solid rgba(10,10,10,0.08)' }}
            >
              <Form form={form} layout="vertical" size="small">
                <Form.Item name="employeePayableAccountId" hidden><Input /></Form.Item>
                <Form.Item name="employeeId" label="Empleado" rules={[{ required: true, message: 'Seleccione el empleado' }]}>
                  <Select
                    showSearch
                    placeholder="Buscar empleado…"
                    filterOption={(v, opt) => String(opt?.label ?? '').toLowerCase().includes(v.toLowerCase())}
                    options={vendors.filter(v => v.type === 'employee')}
                    notFoundContent="Sin empleados — registre empleados en Proveedores"
                    onChange={(v) => {
                      const emp = vendors.find(e => e.value === v && e.type === 'employee')
                      // Cuenta puente del empleado = payableAccountId configurado en el empleado
                      // (NO expenseAccountId — esa es la cuenta transitoria de pasivo del empleado)
                      const acctId = emp?.payableAccountId ?? emp?.expenseAccountId
                      if (acctId) {
                        form.setFieldValue('employeePayableAccountId', acctId)
                      }
                    }}
                  />
                </Form.Item>
                <div style={{ padding: '8px 12px', background: '#fafbfc', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
                  Al aprobar se generan <strong>dos asientos</strong>: (1) Dr Gasto / Cr CxP Proveedor — para el Libro de Compras; (2) Dr CxP Proveedor / Cr Cuenta Transitoria Empleado — reclasificación interna.
                </div>
              </Form>
            </Card>
          )}

          {/* Line items + Retenciones & Neto a Pagar */}
          <Card title="Líneas de Factura" styles={{ body: { padding: '12px 16px' } }}>
            <LineItemsEditor items={items} taxes={taxes} onChange={setItems} docType="bill" vendorDefaultTaxId={vendorDefaultTaxId} currency={watchCurr} />

            {/* ── Retenciones & Neto a Pagar ─────────────────────────────── */}
            <div style={{ borderTop: '1px solid rgba(10,10,10,0.08)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ maxWidth: 560, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ISR — con info del proveedor si está configurado */}
                {vendorIsrTax ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <Space size={6} style={{ marginBottom: 2 }}>
                        <Tag color="#6b7280" style={{ margin: 0, fontSize: 11 }}>{vendorIsrTax.code}</Tag>
                        <Text style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 500 }}>{vendorIsrTax.name}</Text>
                      </Space>
                      {vendorIsrTax.subtype === 'progressive' && vendorIsrTax.tiers?.length ? (
                        <Text style={{ fontSize: 11, color: '#9aa1ab', display: 'block', marginTop: 2 }}>
                          Progresivo — Base Q {fmt(totals.subtotal)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: '#9aa1ab', display: 'block', marginTop: 2 }}>
                          Base Q {fmt(totals.subtotal)} × {isrAppliedRate}%
                        </Text>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 13, color: '#0a0a0a', fontWeight: 600 }}>−</Text>
                      {editingIsr ? (
                        <>
                          <InputNumber
                            size="small" min={0} step={0.01} prefix="Q" precision={2}
                            value={isrAmount} onChange={(v) => setIsrAmount(v ?? 0)}
                            style={{ width: 120 }}
                            formatter={v => { const p = `${v ?? ''}`.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.') }}
                            parser={v => parseFloat((v ?? '').replace(/,/g, '')) || 0}
                          />
                          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => setEditingIsr(false)} style={{ color: '#2ea172' }} />
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a', fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
                            Q {fmt(isrAmount)}
                          </Text>
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingIsr(true)} style={{ color: '#9aa1ab' }} />
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Retención ISR</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#6b7280' }}>−</Text>
                      {editingIsr ? (
                        <>
                          <InputNumber
                            size="small" min={0} step={0.01} prefix="Q" precision={2}
                            value={isrAmount} onChange={(v) => setIsrAmount(v ?? 0)}
                            style={{ width: 120 }}
                            formatter={v => { const p = `${v ?? ''}`.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.') }}
                            parser={v => parseFloat((v ?? '').replace(/,/g, '')) || 0}
                          />
                          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => setEditingIsr(false)} style={{ color: '#2ea172' }} />
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
                            Q {fmt(isrAmount)}
                          </Text>
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingIsr(true)} style={{ color: '#9aa1ab' }} />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* IVA Retention */}
                {invoiceType === 'special' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text style={{ fontSize: 12, color: '#e5484d', fontWeight: 500 }}>IVA Retenido — Factura Especial</Text>
                      <Text style={{ fontSize: 11, color: '#9aa1ab', display: 'block' }}>El comprador retiene el 100% del IVA</Text>
                    </div>
                    <Text style={{ fontSize: 13, color: '#e5484d', fontWeight: 600 }}>− Q {fmt(totals.taxAmount)}</Text>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Retención IVA</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#6b7280' }}>−</Text>
                      {editingIvaRet ? (
                        <>
                          <InputNumber
                            size="small" min={0} step={0.01} prefix="Q" precision={2}
                            value={ivaRetAmount} onChange={(v) => setIvaRetAmount(v ?? 0)}
                            style={{ width: 120 }}
                            formatter={v => { const p = `${v ?? ''}`.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.') }}
                            parser={v => parseFloat((v ?? '').replace(/,/g, '')) || 0}
                          />
                          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => setEditingIvaRet(false)} style={{ color: '#2ea172' }} />
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
                            Q {fmt(ivaRetAmount)}
                          </Text>
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingIvaRet(true)} style={{ color: '#9aa1ab' }} />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* IDP row (combustible) */}
                {idpAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#ff7f00' }}>IDP Combustible</Text>
                    <Text style={{ fontSize: 13, color: '#ff7f00', fontWeight: 600 }}>+ Q {fmt(idpAmount)}</Text>
                  </div>
                )}

                {/* Equivalente GTQ — cuando la factura es en moneda extranjera */}
                {vendorCurrency !== 'GTQ' && exchangeRate > 1 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f0f9ff', borderRadius: 6, padding: '6px 12px',
                    border: '1px solid #bae6fd',
                  }}>
                    <Text style={{ fontSize: 11, color: '#6b7280' }}>
                      Equivalente en GTQ ({vendorCurrency} × {exchangeRate.toFixed(6)})
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                      Q {fmt(Math.round(netPayable * exchangeRate * 100) / 100)}
                    </Text>
                  </div>
                )}

                {/* Neto a Pagar — cuando hay retenciones o IDP */}
                {(totalRetention > 0 || idpAmount > 0) && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#1faec2', borderRadius: 8, padding: '10px 16px', marginTop: 2,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: 600, color: '#adc6ff' }}>Neto a Pagar Proveedor</Text>
                    <Text style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                      {watchCurr} {fmt(netPayable)}
                    </Text>
                  </div>
                )}

              </div>
            </div>
          </Card>

          {/* Póliza Contable — visible cuando la factura fue aprobada */}
          {journalEntry && (
            <Card
              title={
                <span style={{ color: '#1faec2', fontWeight: 600 }}>
                  Póliza Contable — {journalEntry.entryNumber}
                </span>
              }
              styles={{ body: { padding: '8px 0 0 0' } }}
              extra={
                <Space size={8}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                    {dayjs(journalEntry.entryDate).format('DD/MM/YYYY')}
                  </Text>
                  <Tag color={journalEntry.status === 'posted' ? '#2ea172' : 'default'} style={{ margin: 0 }}>
                    {journalEntry.status === 'posted' ? 'Publicado' : journalEntry.status}
                  </Tag>
                </Space>
              }
            >
              <Table<JournalEntryLine>
                dataSource={journalEntry.lines ?? []}
                rowKey="id"
                locale={{ emptyText: 'Sin líneas — verifique que el plan de cuentas tenga los códigos: 2101, 1104, 6107' }}
                size="small"
                pagination={false}
                style={{ borderRadius: 0 }}
                columns={[
                  {
                    title: 'Cuenta',
                    width: 220,
                    render: (_: any, line: JournalEntryLine) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {line.accountCode} — {line.accountName}
                      </span>
                    ),
                  },
                  {
                    title: 'Descripción',
                    dataIndex: 'description',
                    render: (v: string) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</span>,
                  },
                  {
                    title: 'Débito',
                    dataIndex: 'debit',
                    align: 'right' as const,
                    width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#9aa1ab' }}>—</span>,
                  },
                  {
                    title: 'Crédito',
                    dataIndex: 'credit',
                    align: 'right' as const,
                    width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#9aa1ab' }}>—</span>,
                  },
                ]}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafbfc' }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Totales</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <span style={{ fontWeight: 800, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(journalEntry.totalDebit))}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <span style={{ fontWeight: 800, color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(journalEntry.totalCredit))}</span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>
          )}

          {/* Póliza de Reclasificación — solo si es reembolso aprobado */}
          {reclasEntry && (
            <Card
              title={
                <span style={{ color: '#ff7f00', fontWeight: 600 }}>
                  Reclasificación — {reclasEntry.entryNumber}
                </span>
              }
              styles={{ body: { padding: '8px 0 0 0' } }}
              extra={
                <Space size={8}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                    {dayjs(reclasEntry.entryDate).format('DD/MM/YYYY')}
                  </Text>
                  <Tag color="#6b7280" style={{ margin: 0 }}>CxP Proveedor → CxP Empleado</Tag>
                </Space>
              }
            >
              <Table<JournalEntryLine>
                dataSource={reclasEntry.lines ?? []}
                rowKey="id"
                size="small"
                pagination={false}
                style={{ borderRadius: 0 }}
                columns={[
                  {
                    title: 'Cuenta',
                    width: 220,
                    render: (_: any, line: JournalEntryLine) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {line.accountCode} — {line.accountName}
                      </span>
                    ),
                  },
                  { title: 'Descripción', dataIndex: 'description', render: (v: string) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</span> },
                  {
                    title: 'Débito', dataIndex: 'debit', align: 'right' as const, width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#9aa1ab' }}>—</span>,
                  },
                  {
                    title: 'Crédito', dataIndex: 'credit', align: 'right' as const, width: 120,
                    render: (v: number) => Number(v) > 0
                      ? <span style={{ fontWeight: 600, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(Number(v))}</span>
                      : <span style={{ color: '#9aa1ab' }}>—</span>,
                  },
                ]}
              />
            </Card>
          )}

          {/* Notes */}
          <Card title="Notas">
            <Form form={form} layout="vertical" size="small">
              <Form.Item name="notes">
                <Input.TextArea rows={3} placeholder="Notas internas sobre esta factura…" />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* IDP — solo si fuel */}
          {invoiceType === 'fuel' && (
            <Card title={<span style={{ color: '#ff7f00', fontWeight: 600 }}>IDP — Combustible</span>}>
              <Form form={form} layout="vertical" size="small">
                <div style={{ marginBottom: 12 }}>
                  {Object.entries(IDP_RATES).map(([ft, rate]) => {
                    const fuelLines = items.filter(it => it.unit === ft)
                    if (!fuelLines.length) return null
                    const qty = fuelLines.reduce((s, it) => s + Number(it.quantity || 0), 0)
                    const amt = Math.round(qty * rate * 100) / 100
                    const labels: Record<string, string> = {
                      super: 'Gasolina Super', regular: 'Gasolina Regular', aviacion: 'Aviación',
                      diesel: 'Diésel', propano: 'Gas Propano', bunker: 'Bunker C',
                      kerosina: 'Kerosina', other: 'Otros',
                    }
                    return (
                      <div key={ft} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                          {labels[ft] ?? ft}
                          <span style={{ color: '#d1d5db', marginLeft: 4, fontSize: 11 }}>({fmt(qty)} gal × Q{rate})</span>
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: 600, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>
                          Q {fmt(amt)}
                        </Text>
                      </div>
                    )
                  })}
                  {idpAmount > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #fde68a', paddingTop: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: 700, color: '#ff7f00' }}>Total IDP</Text>
                      <Text style={{ fontSize: 14, fontWeight: 800, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>Q {fmt(idpAmount)}</Text>
                    </div>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#9aa1ab', display: 'block', marginBottom: 4 }}>
                      Selecciona el tipo de combustible en la columna Unidad de cada línea
                    </Text>
                  )}
                </div>
                <Form.Item name="idpAccountId" label="Cuenta IDP por acreditar">
                  <Select showSearch placeholder="Ej. 1106 — IDP por Acreditar" filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())} options={allAccounts} allowClear />
                </Form.Item>
              </Form>
            </Card>
          )}

          {/* Impuestos especiales servicios — Timbre de Prensa / Turismo */}
          {invoiceType === 'services' && (hasTimbrePrens || hasTurismo) && (
            <Card title={<span style={{ color: '#7c3aed', fontWeight: 600 }}>Impuestos Especiales</span>}>
              <Form form={form} layout="vertical" size="small">
                {hasTimbrePrens && (
                  <div style={{ marginBottom: hasTurismo ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>
                        Timbre de Prensa ({timbrePrensaRate}%)
                        <span style={{ color: '#d1d5db', marginLeft: 4, fontSize: 11 }}>
                          (Q{fmt(totals.subtotal)} × {timbrePrensaRate}%)
                        </span>
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                        Q {fmt(timbrePrensaAmount)}
                      </Text>
                    </div>
                    <Form.Item name="timbrePrensaAccountId" label="Cuenta Timbre de Prensa" style={{ marginBottom: 0 }}>
                      <Select showSearch placeholder="Ej. 6108 — Timbre de Prensa"
                        filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())}
                        options={allAccounts} allowClear />
                    </Form.Item>
                  </div>
                )}
                {hasTurismo && (
                  <div style={{ marginTop: hasTimbrePrens ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>
                        Turismo INGUAT ({turismoRate}%)
                        <span style={{ color: '#d1d5db', marginLeft: 4, fontSize: 11 }}>
                          (Q{fmt(totals.subtotal)} × {turismoRate}%)
                        </span>
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                        Q {fmt(turismoAmount)}
                      </Text>
                    </div>
                    <Form.Item name="turismoAccountId" label="Cuenta Turismo INGUAT" style={{ marginBottom: 0 }}>
                      <Select showSearch placeholder="Ej. 6109 — Turismo INGUAT"
                        filterOption={(v, opt) => (opt?.label ?? '').toLowerCase().includes(v.toLowerCase())}
                        options={allAccounts} allowClear />
                    </Form.Item>
                  </div>
                )}
              </Form>
            </Card>
          )}

          {/* Actions */}
          <Card title="Acciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>

              {/* Botón 1: Guardar como borrador */}
              {(billStatus === 'draft' || billStatus === 'pending_approval' || !id) && (
                <Button
                  block icon={<SaveOutlined />} loading={saving}
                  onClick={handleSaveDraft}
                  style={{ borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Guardar como borrador
                </Button>
              )}

              {/* Botón 2: Guardar como abierto (guarda + genera póliza en un paso) */}
              {(billStatus === 'draft' || billStatus === 'pending_approval' || !id) && (
                <Button
                  block type="primary" icon={<CheckOutlined />} loading={approving}
                  onClick={handleSaveAndOpen}
                  style={{ background: '#2ea172', borderColor: '#2ea172' }}
                >
                  Guardar como abierto
                </Button>
              )}
              {(billStatus === 'draft' || billStatus === 'pending_approval' || !id) && (
                <div style={{ fontSize: 11, color: '#9aa1ab', textAlign: 'center' }}>
                  Genera póliza contable automáticamente
                </div>
              )}

              {/* Regenerar póliza — solo para facturas ya abiertas */}
              {!!id && billStatus === 'open' && (
                <>
                  <Button
                    block icon={<SyncOutlined />} loading={regenerating}
                    onClick={handleRegenerate}
                    style={{ borderColor: '#ff7f00', color: '#ff7f00' }}
                  >
                    Regenerar póliza contable
                  </Button>
                  <div style={{ fontSize: 11, color: '#9aa1ab', textAlign: 'center' }}>
                    Recalcula cuentas con la configuración actual
                  </div>
                </>
              )}
              {/* Aplicar Anticipo — facturas abiertas/parciales con saldo */}
              {canPayBill && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Button
                    block icon={<DollarOutlined />}
                    style={{ borderColor: '#6b7280', color: '#6b7280' }}
                    onClick={openAnticipoModal}
                  >
                    Aplicar anticipo
                  </Button>
                </>
              )}

              {billStatus && (
                <Tag color={
                  billStatus === 'paid' ? '#2ea172' :
                  billStatus === 'voided' ? 'volcano' :
                  billStatus === 'pending_approval' ? '#6b7280' :
                  billStatus === 'open' ? '#ff7f00' : 'default'
                } style={{ width: '100%', textAlign: 'center', marginTop: 4 }}>
                  Estado: {billStatus === 'pending_approval' ? 'Pendiente aprobación' : billStatus}
                </Tag>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Anticipo Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={<><DollarOutlined style={{ color: '#6b7280' }} /> Aplicar anticipo — {billInvoiceNumber}</>}
        open={antModal}
        onCancel={() => setAntModal(false)}
        onOk={handleApplyAnticipo}
        okText="Aplicar anticipo"
        okButtonProps={{ loading: applyingAdv, style: { background: '#6b7280', borderColor: '#6b7280' }, disabled: !selectedAdvId || antAmount <= 0 }}
        width={520}
      >
        {loadingAdv ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : advances.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="Sin anticipos disponibles"
            description="Este proveedor no tiene anticipos con saldo disponible. Los anticipos se registran en el módulo de Pagos a Proveedores seleccionando 'Anticipo a proveedor'."
          />
        ) : (
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="Anticipo a aplicar" required>
              <Select
                placeholder="Seleccionar anticipo..."
                style={{ width: '100%' }}
                value={selectedAdvId}
                onChange={(val) => {
                  setSelectedAdvId(val)
                  const adv = advances.find(a => a.id === val)
                  if (adv) setAntAmount(Math.min(Number(adv.balance), billBalance))
                }}
                options={advances.map(a => ({
                  value: a.id,
                  label: `${a.advanceNumber} — Q ${Number(a.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })} disponible`,
                }))}
              />
            </Form.Item>
            {selectedAdvId && (() => {
              const adv = advances.find(a => a.id === selectedAdvId)!
              const maxAmt = Math.min(Number(adv.balance), billBalance)
              return (
                <>
                  <Form.Item label={`Monto a aplicar (máx Q ${maxAmt.toLocaleString('es-GT', { minimumFractionDigits: 2 })})`}>
                    <InputNumber
                      style={{ width: '100%' }}
                      value={antAmount}
                      min={0.01}
                      max={maxAmt}
                      step={0.01}
                      precision={2}
                      prefix="Q"
                      onChange={v => setAntAmount(Number(v ?? 0))}
                    />
                  </Form.Item>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 4 }}
                    message={`Saldo pendiente factura: Q ${billBalance.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                    description="Póliza: Dr CxP Proveedor → Cr Anticipos a Proveedores"
                  />
                </>
              )
            })()}
          </Form>
        )}
      </Modal>
    </div>
  )
}
