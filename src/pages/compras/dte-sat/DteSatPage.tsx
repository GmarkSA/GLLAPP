import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Checkbox, DatePicker, Descriptions, Divider, Form, Input,
  message, Modal, Radio, Segmented, Select, Space, Spin, Steps, Switch, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined, BookOutlined, CheckCircleOutlined, CloudSyncOutlined,
  DeleteOutlined, EyeOutlined, FileTextOutlined, ReloadOutlined, RollbackOutlined,
  SearchOutlined, StopOutlined, SyncOutlined, TeamOutlined, ThunderboltOutlined, UserAddOutlined, WarningOutlined,
} from '@ant-design/icons'
import DocumentLink from '../../../components/DocumentLink'
import dayjs, { Dayjs } from 'dayjs'
import {
  createSatDteVendor, deleteSatDte, reactivateSatDte,
  getSatDteDocuments, getSatDteJobs, getSatDteStats,
  getPurchaseOrders, getBills, postSatDte,
  resolveSatDteVendor, resubirR2SatDte,
  startSatDteImport, syncSatDteJob,
  type PurchaseOrder, type SatDte, type SatDteStatus, type SatImportJob,
  PAYMENT_TERMS_CONFIG,
} from '../../../api/compras'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getOrganizationProfile } from '../../../api/configuracion'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getVendor, getVendors } from '../../../api/contactos'
import { getUnidadesActivas, type UnidadMedida } from '../../../api/unidades-medida'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const POLL_INTERVAL_MS = 20_000 // 20 segundos — polling para jobs en ejecución

const IDP_RATES_FE: Record<string, { label: string; rate: number }> = {
  super:    { label: 'Gasolina superior',      rate: 4.70 },
  regular:  { label: 'Gasolina regular',       rate: 4.60 },
  aviacion: { label: 'Gasolina de aviación',   rate: 4.70 },
  diesel:   { label: 'Diésel y gas oil',       rate: 1.30 },
  propano:  { label: 'Gas propano vehicular',  rate: 0.60 },
  bunker:   { label: 'Fuel oil / Bunker C',    rate: 0.55 },
  kerosina: { label: 'Kerosina (DPK)',         rate: 0.50 },
  other:    { label: 'Otros derivados',        rate: 0.50 },
}

const statusConfig: Record<SatDteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Proveedor pendiente', color: 'gold',    icon: <WarningOutlined /> },
  ready:      { label: 'Listo',               color: '#2ea172',   icon: <CheckCircleOutlined /> },
  duplicate:  { label: 'Duplicado',           color: 'volcano', icon: <FileTextOutlined /> },
  posted:     { label: 'Contabilizado',        color: '#1faec2',    icon: <BookOutlined /> },
  error:      { label: 'Error',               color: '#e5484d',     icon: <WarningOutlined /> },
}

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  queued:    { label: 'En cola',    color: 'default' },
  running:   { label: 'Ejecutando', color: 'processing' },
  succeeded: { label: 'Finalizado', color: '#2ea172' },
  failed:    { label: 'Error',      color: '#e5484d' },
}

function money(value: unknown, currency = 'GTQ') {
  const amount = Number(value ?? 0) || 0
  try {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
  }
}

function getErrorMessage(err: unknown, fallback: string) {
  const data = (err as any)?.response?.data
  // NestJS custom filter: { error: { message: string | string[] } }
  // Algunos endpoints ponen message directo en data, otros dentro de data.error
  const raw = data?.message ?? data?.error?.message ?? (err as any)?.message
  if (Array.isArray(raw)) return raw.join(' · ')
  return (typeof raw === 'string' && raw) ? raw : fallback
}

export default function DteSatPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [documents, setDocuments] = useState<SatDte[]>([])
  const [jobs, setJobs] = useState<SatImportJob[]>([])
  const [stats, setStats] = useState<Record<string, { count: number; total: number }>>({})
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [syncingJob, setSyncingJob] = useState<string | null>(null)
  const [vendorActionId, setVendorActionId] = useState<string | null>(null)
  const [postingDte, setPostingDte] = useState<SatDte | null>(null)
  const [postLoading, setPostLoading] = useState(false)
  const [vendorModalDte, setVendorModalDte] = useState<SatDte | null>(null)
  const [createVendorLoading, setCreateVendorLoading] = useState(false)
  const [resubirId, setResubirId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [postForm] = Form.useForm()
  const [vendorForm] = Form.useForm()

  // ── Stepper ────────────────────────────────────────────────────────────────
  const [stepperDte, setStepperDte]           = useState<SatDte | null>(null)
  const [stepperStep, setStepperStep]         = useState(0)
  const [stepperLoading, setStepperLoading]   = useState(false)
  const [stepperOcChoice, setStepperOcChoice]       = useState<'select' | 'skip' | 'reimbursement' | null>(null)
  const [stepperOcId, setStepperOcId]               = useState<string | undefined>()
  const [stepperPOs, setStepperPOs]                 = useState<PurchaseOrder[]>()
  const [stepperResult, setStepperResult]           = useState<{ invoice: any; dte: SatDte } | null>(null)
  const [stepperForm]                               = Form.useForm()
  const [stepperVendorForm]                         = Form.useForm()
  const [stepperVendorPayableMissing, setStepperVendorPayableMissing] = useState(false)
  const [vendors, setVendors] = useState<{ value: string; label: string; type?: string }[]>([])
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [satCredentials, setSatCredentials] = useState<{ satNit?: string }>({})
  const [originalBills, setOriginalBills] = useState<{ value: string; label: string }[]>([])
  const [orgImpEsp, setOrgImpEsp] = useState<{ idpAccountCode?: string; timbrePrensaAccountCode?: string; turismoAccountCode?: string; timbrePrensaRate?: number; turismoRate?: number } | null>(null)
  const [stepperHasTimbre, setStepperHasTimbre] = useState(false)
  const [stepperHasTurismo, setStepperHasTurismo] = useState(false)
  const [stepperIsAnulado, setStepperIsAnulado] = useState(false)
  const [accountMode, setAccountMode] = useState<'expense' | 'asset' | 'all'>('expense')

  // ── Batch (registro masivo) ────────────────────────────────────────────────
  type BatchRowStatus = 'pending' | 'processing' | 'ok' | 'skipped' | 'error'
  interface BatchLineItem {
    descripcion?: string; description?: string
    cantidad?: string; precio_unitario?: string; total_linea?: string; iva?: string
    accountId?: string; accountLabel?: string
  }
  interface BatchRow {
    id: string; label: string; vendorName: string; dteRef: string
    total: number; moneda: string; status: BatchRowStatus
    accountId?: string; accountLabel?: string
    taxId?: string; taxLabel?: string
    invoiceType?: string
    idpType?: string; idpAccountId?: string
    ocType?: 'direct' | 'select' | 'reimbursement'
    employeeId?: string
    paymentTerms?: string; paymentTermsLabel?: string
    defaultUnit?: string
    accountingDate?: Dayjs
    dteItems?: BatchLineItem[]
    result?: string; error?: string; missing?: string
  }
  const [batchOpen,    setBatchOpen]    = useState(false)
  const [batchRows,    setBatchRows]    = useState<BatchRow[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])

  // ── Bulk Vendor Registration ────────────────────────────────────────────────
  interface BulkVendorRow {
    dteId: string; nitEmisor: string; name: string
    payableAccountId?: string; paymentTerms: string
    expenseAccountId?: string; defaultPurchaseTaxId?: string
    status: 'pending' | 'processing' | 'ok' | 'error'
    errorMsg?: string; dteCount: number
  }
  const [bulkVendorOpen,    setBulkVendorOpen]    = useState(false)
  const [bulkVendorRows,    setBulkVendorRows]    = useState<BulkVendorRow[]>([])
  const [bulkVendorRunning, setBulkVendorRunning] = useState(false)
  const [bulkCommonPayable, setBulkCommonPayable] = useState<string | undefined>()
  const [bulkCommonTerms,   setBulkCommonTerms]   = useState('net_30')
  const [bulkCommonExpense, setBulkCommonExpense] = useState<string | undefined>()
  const [bulkCommonTax,     setBulkCommonTax]     = useState<string | undefined>()

  const isBatchable = (dte: SatDte) =>
    dte.status === 'ready' &&
    !['NCRE', 'NABN'].includes(((dte as any).tipoDocumento ?? '').toUpperCase())

  // ── Cuentas e impuestos ────────────────────────────────────────────────────
  useEffect(() => {
    getAccounts({ isActive: true, limit: 500 })
      .then((res: any) => setAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
    getTaxes()
      .then((res: any) => {
        const list: Tax[] = Array.isArray(res) ? res : (res?.data ?? [])
        setTaxes(list.filter(t => t.applicability === 'purchases' || t.applicability === 'both'))
      })
      .catch(() => {})
    getVendors({ type: 'employee', limit: 100 })
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? [])
        setVendors(list.map((v: any) => ({ value: v.id, label: v.name, type: 'employee' })))
      })
      .catch(() => {})
    getUnidadesActivas()
      .then((list) => setUnidades(list))
      .catch(() => {})
    getOrganizationProfile()
      .then((p: any) => {
        setSatCredentials({ satNit: p?.settings?.satNit })
        const ie = p?.settings?.impuestosEspeciales
        if (ie) setOrgImpEsp({
          idpAccountCode:          ie.idp?.accountCode,
          timbrePrensaAccountCode: ie.timbre_prensa?.accountCode,
          turismoAccountCode:      ie.turismo?.accountCode,
          timbrePrensaRate:        ie.timbre_prensa?.rate ?? 0.5,
          turismoRate:             ie.turismo?.rate ?? 10,
        })
      })
      .catch(() => {})
  }, [])

  // ── Carga principal ────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [docsRes, jobsRes, statsRes] = await Promise.all([
        getSatDteDocuments({ limit: 50, search: search || undefined, status: statusFilter }),
        getSatDteJobs({ limit: 10 }),
        getSatDteStats(),
      ])
      setDocuments(docsRes.data ?? [])
      setJobs(jobsRes.data ?? [])
      setStats(statsRes ?? {})
    } finally {
      if (!silent) setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  // ── Auto-polling para jobs en ejecución ────────────────────────────────────
  // Mientras haya algún job en estado "running", se sincroniza automáticamente
  // cada 20 segundos. El polling se detiene cuando todos terminan.

  const hasRunningJobs = jobs.some(j => j.status === 'running')

  useEffect(() => {
    if (hasRunningJobs) {
      pollRef.current = setInterval(async () => {
        const running = jobs.filter(j => j.status === 'running')
        for (const job of running) {
          try {
            const updated = await syncSatDteJob(job.id)
            if (updated.status === 'succeeded') {
              message.success(`APIFY completó: ${updated.importedCount} nuevos DTEs importados`)
            } else if (updated.status === 'failed') {
              message.error(`APIFY falló: ${updated.errorMessage ?? 'error desconocido'}`)
            }
          } catch { /* silencioso durante polling */ }
        }
        await load(true)
      }, POLL_INTERVAL_MS)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasRunningJobs, jobs, load])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleImport = async (values: { range: [Dayjs, Dayjs] }) => {
    if (!satCredentials.satNit) {
      message.error('Configura el NIT SAT en Configuración → Configuración fiscal antes de importar')
      return
    }
    setImporting(true)
    try {
      const job = await startSatDteImport({
        fechaInicio: values.range[0].format('YYYY-MM-DD'),
        fechaFin: values.range[1].format('YYYY-MM-DD'),
      })
      message.success(`Importación SAT iniciada — Run APIFY: ${job.apifyRunId ?? job.id}`)
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo iniciar la importación'))
    } finally {
      setImporting(false)
    }
  }

  const handleSync = async (job: SatImportJob) => {
    setSyncingJob(job.id)
    try {
      const updated = await syncSatDteJob(job.id)
      if (updated.status === 'succeeded') {
        message.success(
          `Sincronización completa: ${updated.importedCount} nuevos, ` +
          `${updated.duplicateCount} duplicados` +
          ((updated as any).errorCount > 0 ? `, ${(updated as any).errorCount} errores` : '')
        )
      } else if (updated.status === 'failed') {
        message.error(updated.errorMessage ?? 'El run APIFY falló')
      } else {
        message.info('APIFY sigue ejecutando — se sincronizará automáticamente cada 20 segundos.')
      }
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo sincronizar APIFY'))
    } finally {
      setSyncingJob(null)
    }
  }

  // ── Totales ────────────────────────────────────────────────────────────────

  const handleResolveVendor = async (row: SatDte) => {
    setVendorActionId(row.id)
    try {
      const result = await resolveSatDteVendor(row.id)
      if (result?.vendor) {
        message.success('Proveedor vinculado al DTE SAT')
      } else {
        message.info('No se encontro proveedor con ese NIT. Puedes crearlo desde el DTE.')
      }
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo resolver el proveedor'))
    } finally {
      setVendorActionId(null)
    }
  }

  const handlePost = async (values: {
    concepto: string
    taxId?: string
    accountId?: string
    paymentTerms: string
    accountingDate?: Dayjs
  }) => {
    if (!postingDte) return
    setPostLoading(true)
    try {
      const result = await postSatDte(postingDte.id, {
        taxId:          values.taxId,
        accountId:      values.accountId,
        paymentTerms:   values.paymentTerms,
        accountingDate: values.accountingDate?.format('YYYY-MM-DD'),
        notes:          values.concepto,
      })
      message.success(`DTE contabilizado — Factura ${result.invoice.invoiceNumber} creada`)
      setPostingDte(null)
      postForm.resetFields()
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo contabilizar el DTE'))
    } finally {
      setPostLoading(false)
    }
  }

  const handleCreateVendor = (row: SatDte) => {
    vendorForm.setFieldsValue({ name: row.nombreEmisor ?? '', payableAccountId: undefined })
    setVendorModalDte(row)
  }

  const handleCreateVendorSubmit = async (values: { name?: string; payableAccountId?: string }) => {
    if (!vendorModalDte) return
    setCreateVendorLoading(true)
    try {
      await createSatDteVendor(vendorModalDte.id, {
        name: values.name || undefined,
        payableAccountId: values.payableAccountId,
      })
      message.success('Proveedor creado y vinculado al DTE SAT')
      setVendorModalDte(null)
      vendorForm.resetFields()
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo crear el proveedor'))
    } finally {
      setCreateVendorLoading(false)
    }
  }

  const handleDeleteDte = (row: SatDte) => {
    const hasInvoice = !!row.purchaseInvoiceId
    Modal.confirm({
      title: 'Eliminar DTE de la bandeja',
      content: (
        <div>
          {hasInvoice && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 10, fontSize: 12 }}
              message="Este DTE ya fue contabilizado. La factura de proveedor NO se elimina — debes hacerlo manualmente desde Compras → Facturas de Proveedor antes de reimportar."
            />
          )}
          <Text>¿Eliminar <Text strong>{row.nombreEmisor}</Text> ({row.serie}/{row.numeroDte}) de la bandeja?</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Al eliminar, podrás volver a importar el mismo DTE desde SAT.
          </Text>
        </div>
      ),
      okText: 'Eliminar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await deleteSatDte(row.id)
          message.success('DTE eliminado de la bandeja')
          await load()
        } catch (err: unknown) {
          message.error(getErrorMessage(err, 'No se pudo eliminar el DTE'))
        }
      },
    })
  }

  const handleReactivate = (row: SatDte) => {
    Modal.confirm({
      title: 'Reactivar DTE para re-procesarlo',
      content: (
        <div>
          <Alert type="info" showIcon style={{ marginBottom: 10, fontSize: 12 }}
            message="Usa esta opción si eliminaste la factura vinculada y necesitas volver a contabilizarla." />
          <Text>¿Reactivar <Text strong>{row.nombreEmisor}</Text> ({row.serie}/{row.numeroDte})?</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            El DTE volverá al estado "Listo para procesar" y podrás generar una nueva factura.
          </Text>
        </div>
      ),
      okText: 'Reactivar',
      okButtonProps: { style: { background: '#7c3aed', borderColor: '#7c3aed' } },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await reactivateSatDte(row.id)
          message.success('DTE reactivado — ya puedes procesarlo nuevamente')
          await load()
        } catch (err: unknown) {
          message.error(getErrorMessage(err, 'No se pudo reactivar el DTE'))
        }
      },
    })
  }

  const handleResubirR2 = async (row: SatDte) => {
    setResubirId(row.id)
    try {
      await resubirR2SatDte(row.id)
      message.success('Documentos subidos a R2 correctamente')
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudieron re-subir los documentos. Las URLs APIFY pueden haber expirado — reimporta el período.'))
    } finally {
      setResubirId(null)
    }
  }

  // ── Stepper handlers ───────────────────────────────────────────────────────

  // ── Preferencias por proveedor (localStorage) ─────────────────────────────
  const saveDtePrefs = (vendorId: string, vals: Record<string, any>) => {
    try {
      localStorage.setItem(`dte_compras_prefs_${vendorId}`, JSON.stringify({
        taxId: vals.taxId, accountId: vals.accountId, defaultUnit: vals.defaultUnit,
        invoiceType: vals.invoiceType, idpType: vals.idpType,
      }))
    } catch { /* silent */ }
  }

  // Carga prefs cuando el usuario llega al paso "Registrar" (step 3) y el proveedor está vinculado
  useEffect(() => {
    if (stepperStep !== 3 || !stepperDte?.vendorId) return
    try {
      const raw = localStorage.getItem(`dte_compras_prefs_${stepperDte.vendorId}`)
      if (raw) stepperForm.setFieldsValue(JSON.parse(raw))
    } catch { /* silent */ }
  }, [stepperStep, stepperDte?.vendorId])  // eslint-disable-line react-hooks/exhaustive-deps

  const openStepper = async (row: SatDte) => {
    const lineas: any[] = Array.isArray(row.items) ? row.items : []
    const autoConcepto = lineas.length > 0
      ? lineas.map(l => l.descripcion || l.description).filter(Boolean).join(' / ')
      : ''
    setStepperDte(row)
    setStepperStep(0)
    setStepperOcChoice(null)
    setStepperOcId(undefined)
    setStepperPOs(undefined)
    setStepperResult(null)
    setStepperHasTimbre(false)
    setStepperHasTurismo(false)
    setStepperIsAnulado(false)
    setAccountMode('expense')

    // Limpiar completamente el formulario para no heredar campos del DTE anterior
    stepperForm.resetFields()

    // Pre-llenar desde datos maestros del proveedor (términos, cuenta de gasto, IVA)
    let vendorPaymentTerms = 'immediate'
    let vendorExpenseAccountId: string | undefined
    let vendorDefaultTaxId: string | undefined
    if (row.vendorId) {
      try {
        const vendor = await getVendor(row.vendorId) as any
        if (vendor?.paymentTerms)        vendorPaymentTerms    = vendor.paymentTerms
        if (vendor?.expenseAccountId)    vendorExpenseAccountId = vendor.expenseAccountId
        if (vendor?.defaultPurchaseTaxId) vendorDefaultTaxId   = vendor.defaultPurchaseTaxId
        setStepperVendorPayableMissing(!vendor?.payableAccountId)
      } catch { setStepperVendorPayableMissing(false) }
    } else {
      setStepperVendorPayableMissing(false)
    }

    // Valores base desde el maestro del proveedor
    const baseVals: Record<string, any> = {
      invoiceType:    'goods',
      taxId:          vendorDefaultTaxId,
      paymentTerms:   vendorPaymentTerms,
      accountingDate: row.fechaEmision ? dayjs(row.fechaEmision) : dayjs(),
      concepto:       autoConcepto,
      accountId:      vendorExpenseAccountId,
    }

    // Prefs guardadas de sesiones anteriores sobreescriben el maestro (más específicas)
    if (row.vendorId) {
      try {
        const raw = localStorage.getItem(`dte_compras_prefs_${row.vendorId}`)
        if (raw) {
          const saved = JSON.parse(raw)
          if (saved.accountId)   baseVals.accountId   = saved.accountId
          if (saved.taxId)       baseVals.taxId        = saved.taxId
          if (saved.invoiceType) baseVals.invoiceType  = saved.invoiceType
          if (saved.defaultUnit) baseVals.defaultUnit  = saved.defaultUnit
          if (saved.idpType)     baseVals.idpType      = saved.idpType
        }
      } catch { /* silent */ }
    }

    stepperForm.setFieldsValue(baseVals)
    stepperVendorForm.setFieldsValue({ name: row.nombreEmisor ?? '', paymentTerms: 'net_30' })
  }

  const handleStepperResolveVendor = async () => {
    if (!stepperDte) return
    setStepperLoading(true)
    try {
      const result = await resolveSatDteVendor(stepperDte.id)
      if (result?.dte) setStepperDte(result.dte as SatDte)
      if (!result?.vendor) {
        message.info('No se encontró proveedor — puedes crearlo abajo.')
      } else {
        // También vincular los demás DTEs del mismo NIT que estén pendientes
        const sameNitPending = documents.filter(d =>
          d.id !== stepperDte.id &&
          d.nitEmisor === stepperDte.nitEmisor &&
          d.status === 'pending',
        )
        let autoLinked = 0
        for (const dte of sameNitPending) {
          try { await resolveSatDteVendor(dte.id); autoLinked++ } catch { /* silencioso */ }
        }
        if (autoLinked > 0) message.success(`Proveedor vinculado a ${autoLinked + 1} DTE(s) del mismo NIT`)
      }
      await load(true)
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo buscar el proveedor'))
    } finally {
      setStepperLoading(false)
    }
  }

  const handleStepperCreateVendor = async (values: { name?: string; payableAccountId?: string; expenseAccountId?: string; defaultPurchaseTaxId?: string; paymentTerms?: string }) => {
    if (!stepperDte) return
    setStepperLoading(true)
    try {
      const result = await createSatDteVendor(stepperDte.id, {
        name:                values.name,
        payableAccountId:    values.payableAccountId,
        expenseAccountId:    values.expenseAccountId,
        defaultPurchaseTaxId: values.defaultPurchaseTaxId,
        paymentTerms:        values.paymentTerms,
      })
      if ((result as any)?.dte) setStepperDte((result as any).dte as SatDte)
      setStepperVendorPayableMissing(!values.payableAccountId)
      // Guardar preferencias para pre-llenar el paso Registrar
      const createdVendorId = (result as any)?.dte?.vendorId
      if (createdVendorId && (values.expenseAccountId || values.defaultPurchaseTaxId)) {
        saveDtePrefs(createdVendorId, {
          accountId: values.expenseAccountId,
          taxId: values.defaultPurchaseTaxId,
        })
      }

      // Auto-vincular todos los demás DTEs del mismo NIT que aún están pendientes
      const sameNitPending = documents.filter(d =>
        d.id !== stepperDte.id &&
        d.nitEmisor === stepperDte.nitEmisor &&
        d.status === 'pending',
      )
      let autoLinked = 0
      for (const dte of sameNitPending) {
        try { await resolveSatDteVendor(dte.id); autoLinked++ } catch { /* silencioso */ }
      }

      message.success(
        autoLinked > 0
          ? `Proveedor creado y vinculado a ${autoLinked + 1} DTE(s) del mismo NIT`
          : 'Proveedor creado y vinculado',
      )
      await load(true)
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo crear el proveedor'))
    } finally {
      setStepperLoading(false)
    }
  }

  const loadOriginalBills = (vendorId: string) => {
    getBills({ vendorId, limit: 100 })
      .then(res => {
        const list = res?.data ?? []
        setOriginalBills(
          list
            .filter((b: any) => b.invoiceType !== 'credit_note')
            .map((b: any) => ({
              value: b.id,
              label: `${b.invoiceNumber} — Q ${Number(b.total ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${b.status})`,
            }))
        )
      })
      .catch(() => {})
  }

  const handleEnterOcStep = async () => {
    if (!stepperDte?.vendorId || stepperPOs !== undefined) return
    try {
      const res = await getPurchaseOrders({ limit: 50 }) as any
      const all: PurchaseOrder[] = res?.data ?? res ?? []
      setStepperPOs(all.filter(po => po.vendorId === stepperDte.vendorId && ['sent', 'received'].includes(po.status)))
    } catch { setStepperPOs([]) }
  }

  const handleStepperPost = async (values: {
    concepto: string; taxId?: string; invoiceType?: string; accountId?: string; paymentTerms: string
    accountingDate?: Dayjs; employeeId?: string; idpAccountId?: string; idpType?: string; defaultUnit?: string
    originalInvoiceId?: string; creditNoteReason?: string
    timbrePrensaAccountId?: string; turismoAccountId?: string
  }) => {
    if (!stepperDte) return
    setStepperLoading(true)
    try {
      const isNC = ['NCRE', 'NABN'].includes(((stepperDte as any).tipoDocumento ?? '').toUpperCase())
      const isReimbursement = stepperOcChoice === 'reimbursement'
      const invType = values.invoiceType ?? 'goods'
      // Base gravable para Timbre/Turismo: extraer desde IVA del DTE (totalIva / 0.12)
      // NO usar subtotal: cuando hay Turismo, subtotal = total − IVA incluye el turismo → base inflada
      const dteIva      = Number(stepperDte.totalIva ?? 0)
      const dteSubtotal = dteIva > 0
        ? Math.round((dteIva / 0.12) * 100) / 100
        : Number(stepperDte.subtotal ?? 0)
      const timbreRate  = orgImpEsp?.timbrePrensaRate ?? 0.5
      const turismoRate = orgImpEsp?.turismoRate ?? 10
      const timbrePrensaAmount = (invType === 'services' && stepperHasTimbre)
        ? Math.round(dteSubtotal * (timbreRate / 100) * 100) / 100 : 0
      const turismoAmount = (invType === 'services' && stepperHasTurismo)
        ? Math.round(dteSubtotal * (turismoRate / 100) * 100) / 100 : 0
      const result = await postSatDte(stepperDte.id, {
        invoiceType:         invType,
        taxId:               stepperIsAnulado ? undefined : values.taxId,
        accountId:           values.accountId,
        paymentTerms:        values.paymentTerms,
        accountingDate:      values.accountingDate?.format('YYYY-MM-DD'),
        notes:               values.concepto,
        purchaseOrderId:     isReimbursement || isNC ? undefined : stepperOcId,
        isExpenseReimbursement: isReimbursement,
        employeeId:          isReimbursement ? values.employeeId : undefined,
        idpAccountId:        invType === 'fuel' ? values.idpAccountId : undefined,
        idpType:             invType === 'fuel' ? values.idpType : undefined,
        defaultUnit:         values.defaultUnit,
        originalInvoiceId:   isNC ? values.originalInvoiceId : undefined,
        creditNoteReason:    isNC ? values.creditNoteReason : undefined,
        timbrePrensaAmount:     timbrePrensaAmount || undefined,
        timbrePrensaAccountId:  timbrePrensaAmount > 0 ? values.timbrePrensaAccountId : undefined,
        turismoAmount:          turismoAmount || undefined,
        turismoAccountId:       turismoAmount > 0 ? values.turismoAccountId : undefined,
        forceZeroAmount:        stepperIsAnulado || undefined,
      })
      if (stepperDte.vendorId) saveDtePrefs(stepperDte.vendorId, values)
      setStepperResult(result)
      if (result?.dte) setStepperDte(result.dte as SatDte)
      await load(true)
      setStepperStep(4)
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo contabilizar el DTE'))
    } finally {
      setStepperLoading(false)
    }
  }

  // ── Registro masivo ────────────────────────────────────────────────────────
  const openBatchModal = async (overrideDtes?: SatDte[]) => {
    const dtes = overrideDtes ?? documents.filter(d => selectedIds.includes(d.id) && isBatchable(d))
    if (!dtes.length) { message.warning('Selecciona al menos un DTE listo para procesar'); return }
    setBatchLoading(true)
    setBatchOpen(true)
    const rows: BatchRow[] = []
    for (const d of dtes) {
      let accountId: string | undefined
      let taxId: string | undefined
      let paymentTerms: string | undefined
      let savedInvoiceType: string | undefined
      let savedDefaultUnit: string | undefined
      // 1. Preferencias guardadas de sesiones anteriores (más recientes)
      if (d.vendorId) {
        try {
          const raw = localStorage.getItem(`dte_compras_prefs_${d.vendorId}`)
          if (raw) {
            const p = JSON.parse(raw)
            accountId = p.accountId; taxId = p.taxId
            savedInvoiceType = p.invoiceType; savedDefaultUnit = p.defaultUnit
          }
        } catch {}
      }
      // 2. Datos maestros del proveedor como fallback
      if (d.vendorId && (!accountId || !paymentTerms)) {
        try {
          const v = await getVendor(d.vendorId) as any
          if (!accountId && v?.expenseAccountId) accountId = v.expenseAccountId
          if (!taxId && v?.defaultPurchaseTaxId) taxId = v.defaultPurchaseTaxId
          paymentTerms = v?.paymentTerms ?? 'immediate'
        } catch {}
      }
      const accObj = accounts.find(a => a.id === accountId)
      const taxObj = taxes.find(t => t.id === taxId)
      const idpAcc = orgImpEsp?.idpAccountCode ? accounts.find(a => a.code === orgImpEsp!.idpAccountCode) : undefined
      const dteItems: BatchLineItem[] = (d.items ?? []).map(it => ({
        ...it,
        accountId,
        accountLabel: accObj ? `${accObj.code} — ${accObj.name}` : undefined,
      }))
      // Auto-detect tipo factura y unidad desde los items del DTE (bien_o_servicio / unidad_medida)
      const firstItem = (d.items as any[])?.[0]
      const autoInvoiceType = savedInvoiceType
        ?? ((firstItem?.bien_o_servicio === 'S') ? 'services' : 'goods')
      const autoDefaultUnit = savedDefaultUnit ?? firstItem?.unidad_medida ?? undefined
      rows.push({
        id: d.id,
        label: `${d.nombreEmisor ?? 'Sin nombre'} · ${d.serie ?? '—'}/${d.numeroDte ?? '—'}`,
        vendorName: d.nombreEmisor ?? 'Sin nombre',
        dteRef: `${d.serie ?? '—'} / ${d.numeroDte ?? '—'}`,
        total: Number(d.total),
        moneda: d.moneda ?? 'GTQ',
        status: 'pending',
        accountId,
        accountLabel: accObj ? `${accObj.code} — ${accObj.name}` : accountId ? '(cuenta configurada)' : undefined,
        taxId,
        taxLabel: taxObj ? (taxObj.subtype === 'exempt' ? `Exento — ${taxObj.name}` : `${Number(taxObj.rate)}% — ${taxObj.name}`) : undefined,
        invoiceType: autoInvoiceType,
        defaultUnit: autoDefaultUnit,
        idpAccountId: idpAcc?.id,
        ocType: 'direct',
        paymentTerms: paymentTerms ?? 'immediate',
        paymentTermsLabel: PAYMENT_TERMS_CONFIG[(paymentTerms ?? 'immediate') as keyof typeof PAYMENT_TERMS_CONFIG] ?? paymentTerms ?? 'Inmediato',
        accountingDate: d.fechaEmision ? dayjs(d.fechaEmision) : dayjs(),
        dteItems,
        missing: !accountId ? 'Falta cuenta de gasto — configúrala en el maestro del proveedor' : undefined,
      })
    }
    setBatchRows(rows)
    setBatchLoading(false)
  }

  const handleBatchPost = async () => {
    const processable = batchRows.filter(r => !r.missing)
    if (!processable.length) { message.error('Ningún DTE tiene datos completos para procesar'); return }
    setBatchRunning(true)
    for (const row of batchRows) {
      if (row.missing) continue
      setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'processing' } : r))
      try {
        const dte = documents.find(d => d.id === row.id)!
        const multiLine = (row.dteItems?.length ?? 0) > 1
        const result = await postSatDte(row.id, {
          taxId:                  row.taxId,
          invoiceType:            row.invoiceType,
          accountId:              row.accountId,
          paymentTerms:           row.paymentTerms ?? 'immediate',
          defaultUnit:            row.defaultUnit,
          accountingDate:         row.accountingDate?.format('YYYY-MM-DD'),
          isExpenseReimbursement: row.ocType === 'reimbursement',
          employeeId:             row.ocType === 'reimbursement' ? row.employeeId : undefined,
          idpType:                row.invoiceType === 'fuel' ? row.idpType : undefined,
          idpAccountId:           row.invoiceType === 'fuel' ? row.idpAccountId : undefined,
          lineAccounts:           multiLine
            ? row.dteItems!.map((item, idx) => ({ index: idx, accountId: item.accountId ?? row.accountId ?? '' }))
            : undefined,
        })
        if (dte.vendorId) saveDtePrefs(dte.vendorId, { accountId: row.accountId, taxId: row.taxId, invoiceType: row.invoiceType, defaultUnit: row.defaultUnit, idpType: row.idpType })
        setBatchRows(prev => prev.map(r => r.id === row.id
          ? { ...r, status: 'ok', result: result.invoice?.invoiceNumber ?? 'OK' }
          : r))
      } catch (err) {
        const errMsg = getErrorMessage(err, 'Error al registrar')
        const alreadyExists = errMsg.includes('Ya existe una factura')
        setBatchRows(prev => prev.map(r => r.id === row.id
          ? { ...r, status: alreadyExists ? 'skipped' : 'error', error: alreadyExists ? 'Esta factura ya estaba registrada' : errMsg }
          : r))
      }
    }
    setBatchRunning(false)
    setSelectedIds([])
    await load(true)
  }

  const openBulkVendorModal = async () => {
    const res = await getSatDteDocuments({ status: 'pending', limit: 500 })
    const pendingDtes = res.data ?? []
    const byNit = new Map<string, SatDte[]>()
    for (const d of pendingDtes) {
      const nit = d.nitEmisor ?? 'CF'
      if (!byNit.has(nit)) byNit.set(nit, [])
      byNit.get(nit)!.push(d)
    }
    const rows: BulkVendorRow[] = Array.from(byNit.entries()).map(([nit, dtes]) => ({
      dteId:                dtes[0].id,
      nitEmisor:            nit,
      name:                 dtes[0].nombreEmisor ?? '',
      payableAccountId:     undefined,
      paymentTerms:         'net_30',
      expenseAccountId:     undefined,
      defaultPurchaseTaxId: undefined,
      status:               'pending' as const,
      dteCount:             dtes.length,
    }))
    setBulkVendorRows(rows)
    setBulkCommonPayable(undefined)
    setBulkCommonTerms('net_30')
    setBulkCommonExpense(undefined)
    setBulkCommonTax(undefined)
    setBulkVendorOpen(true)
  }

  const handleBulkVendorPost = async () => {
    setBulkVendorRunning(true)
    for (const row of bulkVendorRows) {
      if (row.status === 'ok') continue
      setBulkVendorRows(prev => prev.map(r => r.dteId === row.dteId ? { ...r, status: 'processing' } : r))
      try {
        await createSatDteVendor(row.dteId, {
          name:                 row.name || undefined,
          payableAccountId:     row.payableAccountId,
          paymentTerms:         row.paymentTerms,
          expenseAccountId:     row.expenseAccountId,
          defaultPurchaseTaxId: row.defaultPurchaseTaxId,
        })
        // Vincular automáticamente los demás DTEs del mismo NIT
        const sameNitOthers = documents.filter(d =>
          d.nitEmisor === row.nitEmisor && d.id !== row.dteId && d.status === 'pending'
        )
        for (const dte of sameNitOthers) {
          try { await resolveSatDteVendor(dte.id) } catch { /* silencioso */ }
        }
        setBulkVendorRows(prev => prev.map(r => r.dteId === row.dteId ? { ...r, status: 'ok' } : r))
      } catch (err: unknown) {
        setBulkVendorRows(prev => prev.map(r =>
          r.dteId === row.dteId ? { ...r, status: 'error', errorMsg: getErrorMessage(err, 'Error al crear proveedor') } : r
        ))
      }
    }
    setBulkVendorRunning(false)
    await load(true)
  }

  const totals = useMemo(() => ({
    pending:  { count: stats.pending?.count ?? 0,   amount: stats.pending?.total ?? 0 },
    ready:    { count: stats.ready?.count ?? 0,     amount: stats.ready?.total ?? 0 },
    duplicate:{ count: stats.duplicate?.count ?? 0, amount: stats.duplicate?.total ?? 0 },
    posted:   { count: stats.posted?.count ?? 0,    amount: stats.posted?.total ?? 0 },
    total:    Object.values(stats).reduce((s, r) => s + Number(r.total ?? 0), 0),
  }), [stats])

  // ── Columnas documentos ────────────────────────────────────────────────────

  const columns: ColumnsType<SatDte> = [
    {
      title: 'Fecha',
      dataIndex: 'fechaEmision',
      width: 95,
      defaultSortOrder: 'descend' as const,
      sorter: (a, b) => (a.fechaEmision ?? '').localeCompare(b.fechaEmision ?? ''),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Proveedor SAT',
      render: (_, row) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{row.nombreEmisor ?? 'Sin nombre'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>NIT: {row.nitEmisor ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Tipo / Serie / DTE',
      width: 200,
      render: (_, row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
          <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '18px', flexShrink: 0 }}>
            {(row as any).tipoDocumento ?? 'FACT'}
          </Tag>
          <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {row.serie ?? '—'} / {row.numeroDte ?? '—'}
          </Text>
        </span>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      width: 160,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'default' }}>
            {v?.slice(0, 14)}…
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      align: 'right',
      width: 100,
      sorter: (a, b) => Number(a.subtotal) - Number(b.subtotal),
      render: (v: number, row) => <Text style={{ fontSize: 12 }}>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'IVA',
      dataIndex: 'totalIva',
      align: 'right',
      width: 90,
      sorter: (a, b) => Number(a.totalIva) - Number(b.totalIva),
      render: (v: number, row) => <Text style={{ fontSize: 12 }}>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      width: 110,
      sorter: (a, b) => Number(a.total) - Number(b.total),
      render: (v: number, row) => <Text strong style={{ fontSize: 12 }}>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'Proceso',
      width: 140,
      filters: Object.entries(statusConfig).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (val, row) => row.status === val,
      render: (_, row) => {
        if (row.status === 'error') return (
          <Tag color="#e5484d" icon={<WarningOutlined />} style={{ fontSize: 10 }}>Error</Tag>
        )
        if (row.status === 'duplicate') return (
          <Tag color="volcano" icon={<FileTextOutlined />} style={{ fontSize: 10 }}>Duplicado</Tag>
        )

        const s1 = true                                    // 1 Importado
        const s2 = !!row.vendorId                         // 2 Proveedor vinculado
        const s3 = false                                   // 3 OC (stepper pendiente)
        const s4 = !!(row.purchaseInvoiceId || row.expenseId) // 4 Registrado
        const s5 = row.status === 'posted'                 // 5 Contabilizado

        const steps = [
          { done: s1, tip: 'Importado desde SAT' },
          { done: s2, tip: s2 ? `Proveedor vinculado` : 'Proveedor pendiente' },
          { done: s3, tip: 'Orden de Compra (pendiente)' },
          { done: s4, tip: s4 ? 'Factura registrada' : 'Sin registrar' },
          { done: s5, tip: s5 ? 'Contabilizado ✓' : 'Sin contabilizar', last: true },
        ]

        const currentLabel =
          s5 ? 'Contabilizado ✓' :
          s4 ? 'Registrado' :
          s2 ? 'Listo' :
               'Proveedor pendiente'

        return (
          <div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}>
              {steps.map((step, i) => (
                <Tooltip key={i} title={step.tip}>
                  <span style={{
                    fontSize: 13,
                    lineHeight: 1,
                    cursor: 'default',
                    color: step.done
                      ? (step.last ? '#2ea172' : '#1faec2')
                      : '#d1d5db',
                  }}>
                    {step.done ? '●' : '○'}
                  </span>
                </Tooltip>
              ))}
            </div>
            <Text type={s5 ? undefined : 'secondary'} style={{
              fontSize: 10,
              color: s5 ? '#2ea172' : undefined,
            }}>
              {currentLabel}
            </Text>
          </div>
        )
      },
    },
    {
      title: 'Archivos',
      width: 100,
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DocumentLink documentKey={row.xmlKey} docType="fel-xml-proveedor" label="XML" />
          {row.pdfKey
            ? <DocumentLink documentKey={row.pdfKey} docType="fel-pdf-proveedor" label="PDF" />
            : row.pdfUrl
              ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>PDF ↗</a>
              : (
                <Space size={4}>
                  {row.uuid && (
                    <Tooltip title="Ver en portal SAT (verificación FEL)">
                      <a
                        href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${row.uuid}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: '#ff7f00' }}
                      >
                        SAT ↗
                      </a>
                    </Tooltip>
                  )}
                  <Tooltip title="Re-subir PDF a R2 (requiere URL APIFY vigente)">
                    <Button
                      size="small"
                      type="link"
                      icon={<SyncOutlined spin={resubirId === row.id} />}
                      loading={resubirId === row.id}
                      onClick={() => handleResubirR2(row)}
                      style={{ padding: 0, fontSize: 11, color: '#6b7280' }}
                    />
                  </Tooltip>
                </Space>
              )}
        </div>
      ),
    },
    {
      title: 'Acción',
      width: 110,
      fixed: 'right',
      render: (_, row) => (
        <Space size={4}>
          {row.status === 'posted'
            ? <Tooltip title="Ver factura y póliza contable">
                <Button size="small" icon={<EyeOutlined />}
                  onClick={() => row.purchaseInvoiceId && navigate(`/compras/facturas/${row.purchaseInvoiceId}`)}
                  style={{ fontSize: 11, borderColor: '#1faec2', color: '#1faec2' }}>
                  Ver factura
                </Button>
              </Tooltip>
            : row.status === 'duplicate'
              ? <Tag color="volcano" style={{ fontSize: 10 }}>Duplicado</Tag>
              : <Button size="small" type="primary" icon={<BookOutlined />}
                  onClick={() => openStepper(row)}
                  style={{ fontSize: 11, background: '#1faec2' }}>
                  Procesar
                </Button>
          }
          {row.status === 'posted' && (
            <Tooltip title="Re-procesar — usar si la factura vinculada fue eliminada">
              <Button size="small" icon={<RollbackOutlined />}
                onClick={() => handleReactivate(row)}
                style={{ fontSize: 11, color: '#7c3aed', borderColor: '#c4b5fd' }} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar de la bandeja">
            <Button size="small" danger icon={<DeleteOutlined />}
              onClick={() => handleDeleteDte(row)} style={{ fontSize: 11 }} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // ── Columnas jobs ──────────────────────────────────────────────────────────

  const jobColumns: ColumnsType<SatImportJob> = [
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '—',
    },
    {
      title: 'Rango',
      width: 190,
      render: (_, row) =>
        `${dayjs(String(row.fechaInicio)).format('DD/MM/YYYY')} → ${dayjs(String(row.fechaFin)).format('DD/MM/YYYY')}`,
    },
    { title: 'NIT SAT', dataIndex: 'satNit', width: 110 },
    {
      title: 'Run APIFY',
      dataIndex: 'apifyRunId',
      render: (v: string) => (
        <Tooltip title={v}>
          <Text code style={{ fontSize: 10 }}>{v ? v.slice(0, 16) + '…' : '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => (
        <Space size={4}>
          <Badge status={v === 'running' ? 'processing' : v === 'succeeded' ? 'success' : v === 'failed' ? 'error' : 'default'} />
          <Tag color={jobStatusConfig[v]?.color} style={{ marginInlineEnd: 0 }}>
            {jobStatusConfig[v]?.label ?? v}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Total / Nuevos / Dup. / Err.',
      width: 160,
      render: (_, row) => (
        <Space size={2} wrap>
          <Tag style={{ fontSize: 10 }}>{(row as any).totalCount ?? '?'} total</Tag>
          <Tag color="#2ea172" style={{ fontSize: 10 }}>{row.importedCount} nuevos</Tag>
          <Tag color="#ff7f00" style={{ fontSize: 10 }}>{row.duplicateCount} dup.</Tag>
          {(row as any).errorCount > 0 && (
            <Tag color="#e5484d" style={{ fontSize: 10 }}>{(row as any).errorCount} err.</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Acciones',
      width: 130,
      render: (_, row) => (
        <Button
          size="small"
          icon={<CloudSyncOutlined />}
          loading={syncingJob === row.id}
          onClick={() => handleSync(row)}
          disabled={row.status === 'succeeded' || row.status === 'failed'}
        >
          Sincronizar
        </Button>
      ),
    },
  ]

  // ── Valores reactivos del formulario del stepper ──────────────────────────
  const watchedTaxId    = Form.useWatch('taxId',        stepperForm) as string | undefined
  const watchedInvType  = Form.useWatch('invoiceType',  stepperForm) as string | undefined ?? 'goods'
  const watchedIdpType  = Form.useWatch('idpType',      stepperForm) as string | undefined
  const isFuelStep3     = watchedInvType === 'fuel'
  const isServiceStep3  = watchedInvType === 'services'

  const idpCalcAmount = useMemo(() => {
    if (!watchedIdpType || !isFuelStep3 || !stepperDte) return 0
    const qty = ((stepperDte.items as any[]) ?? []).reduce((s: number, l: any) => s + (Number(l.cantidad) || 0), 0)
    return Math.round(qty * (IDP_RATES_FE[watchedIdpType]?.rate ?? 0) * 100) / 100
  }, [watchedIdpType, isFuelStep3, stepperDte])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* ── Modal Stepper — Procesar DTE SAT ─────────────────────────────── */}
      <Modal
        open={!!stepperDte}
        width={740}
        title={null}
        footer={null}
        closable
        maskClosable={false}
        onCancel={() => setStepperDte(null)}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
      >
        {stepperDte && (() => {
          const vendorLinked = !!stepperDte.vendorId
          const isNC = ['NCRE', 'NABN'].includes(((stepperDte as any).tipoDocumento ?? '').toUpperCase())
          const canNext =
            stepperStep === 0 ? true :
            stepperStep === 1 ? (vendorLinked && !stepperVendorPayableMissing) :
            stepperStep === 2 ? (
              isNC ||
              stepperIsAnulado ||
              stepperOcChoice === 'skip' ||
              stepperOcChoice === 'reimbursement' ||
              (stepperOcChoice === 'select' && !!stepperOcId)
            ) :
            false

          return (
            <div>
              {/* Header fijo */}
              <div style={{ padding: '20px 24px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{stepperDte.nombreEmisor ?? '—'}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>NIT: {stepperDte.nitEmisor}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {(stepperDte as any).tipoDocumento ?? 'FACT'} · {stepperDte.serie ?? '—'}/{stepperDte.numeroDte ?? '—'}
                    </Text>
                  </div>
                  {stepperIsAnulado
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StopOutlined style={{ color: '#dc2626', fontSize: 14 }} />
                        <Text strong style={{ fontSize: 16, color: '#dc2626' }}>Q0.00 ANULADA</Text>
                      </span>
                    : <Text strong style={{ fontSize: 18, color: '#1faec2' }}>{money(stepperDte.total, stepperDte.moneda)}</Text>
                  }
                </div>
                <Steps current={stepperStep} size="small" style={{ marginBottom: 14 }} items={[
                  { title: 'DTE' },
                  { title: 'Proveedor' },
                  { title: 'Orden de Compra' },
                  { title: 'Registrar' },
                  { title: 'Listo' },
                ]} />
                <Divider style={{ margin: '0 0 16px' }} />
              </div>

              {/* Contenido del paso actual */}
              <div style={{ padding: '0 24px 8px', minHeight: 200 }}>

                {/* Paso 0 — Datos del DTE */}
                {stepperStep === 0 && (() => {
                  const isNC0 = ['NCRE', 'NABN'].includes(((stepperDte as any).tipoDocumento ?? '').toUpperCase())
                  return (<>
                  {isNC0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
                      <strong>Nota de Crédito Proveedor</strong> — Este DTE ({(stepperDte as any).tipoDocumento}) se registrará como Nota de Crédito de Proveedor.
                    </div>
                  )}

                  {/* Toggle Anulada SAT */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: stepperIsAnulado ? '#fff1f0' : '#f8fafc',
                    border: `1px solid ${stepperIsAnulado ? '#fca5a5' : '#e2e8f0'}`,
                    borderRadius: 6, padding: '10px 14px', marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StopOutlined style={{ color: stepperIsAnulado ? '#dc2626' : '#9ca3af', fontSize: 16 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: stepperIsAnulado ? '#dc2626' : '#374151' }}>
                          Factura anulada en SAT
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          Activa si el PDF del SAT tiene sello <strong>ANULADO</strong>. Se registrará con valor Q0.00 y estado Anulada.
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={stepperIsAnulado}
                      onChange={setStepperIsAnulado}
                      style={{ background: stepperIsAnulado ? '#dc2626' : undefined }}
                    />
                  </div>
                  {stepperIsAnulado && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 12, fontSize: 12 }}
                      message="Factura será registrada con monto Q0.00 y estado ANULADA"
                      description="Se creará el registro para cumplimiento legal/fiscal, pero no generará saldo en el proveedor ni gasto contable."
                    />
                  )}

                  <Descriptions size="small" column={2} style={{ background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                    <Descriptions.Item label="Emisor" span={2}><Text strong>{stepperDte.nombreEmisor}</Text></Descriptions.Item>
                    <Descriptions.Item label="Fecha">{stepperDte.fechaEmision ? dayjs(stepperDte.fechaEmision).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                    <Descriptions.Item label="Serie / DTE">{stepperDte.serie ?? '—'} / {stepperDte.numeroDte ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Subtotal">{money(stepperDte.subtotal, stepperDte.moneda)}</Descriptions.Item>
                    <Descriptions.Item label="IVA">{money(stepperDte.totalIva, stepperDte.moneda)}</Descriptions.Item>
                    <Descriptions.Item label="Total" span={2}>
                      <Text strong style={{ fontSize: 14, color: '#1faec2' }}>{money(stepperDte.total, stepperDte.moneda)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Archivos" span={2}>
                      <Space size={16}>
                        {stepperDte.xmlKey
                          ? <DocumentLink documentKey={stepperDte.xmlKey} docType="fel-xml-proveedor" label="XML" />
                          : stepperDte.xmlUrl ? <a href={stepperDte.xmlUrl} target="_blank" rel="noreferrer">XML ↗</a> : <Text type="secondary">XML</Text>}
                        {stepperDte.pdfKey
                          ? <DocumentLink documentKey={stepperDte.pdfKey} docType="fel-pdf-proveedor" label="PDF" />
                          : stepperDte.pdfUrl
                            ? <a href={stepperDte.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>PDF ↗</a>
                            : <a href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${stepperDte.uuid}`} target="_blank" rel="noreferrer" style={{ color: '#ff7f00' }}>Ver en SAT ↗</a>}
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                  </>)
                })()}

                {/* Paso 1 — Proveedor */}
                {stepperStep === 1 && (
                  vendorLinked ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <CheckCircleOutlined style={{ fontSize: 44, color: '#2ea172', display: 'block', marginBottom: 10 }} />
                      <Text strong style={{ fontSize: 15 }}>Proveedor vinculado</Text>
                      <br />
                      <Text type="secondary">{stepperDte.nombreEmisor} · NIT: {stepperDte.nitEmisor}</Text>
                      {stepperVendorPayableMissing && (
                        <Alert
                          type="error"
                          showIcon
                          style={{ marginTop: 16, textAlign: 'left', fontSize: 12 }}
                          message="Falta la Cuenta por Pagar (CxP) en este proveedor"
                          description={<>No se puede registrar el DTE ni generar la póliza sin esta cuenta. Ve a <strong>Compras → Proveedores</strong>, abre el proveedor y configura su Cuenta por Pagar antes de continuar.</>}
                        />
                      )}
                    </div>
                  ) : (
                    <div>
                      <Alert type="warning" showIcon style={{ marginBottom: 14, fontSize: 12 }}
                        message={`NIT ${stepperDte.nitEmisor} no está registrado. Busca si existe o créalo.`} />
                      <Button icon={<SearchOutlined />} loading={stepperLoading} style={{ marginBottom: 14 }} onClick={handleStepperResolveVendor}>
                        Buscar proveedor por NIT {stepperDte.nitEmisor}
                      </Button>
                      <Divider plain style={{ fontSize: 12 }}>o crear nuevo proveedor</Divider>
                      <Form form={stepperVendorForm} layout="vertical" size="small" onFinish={handleStepperCreateVendor}>
                        {/* Fila 1: Nombre | Cuenta CxP | Términos de pago */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '0 12px' }}>
                          <Form.Item name="name" label="Nombre" style={{ marginBottom: 8 }}>
                            <Input placeholder={stepperDte.nombreEmisor ?? 'Nombre del proveedor'} />
                          </Form.Item>
                          <Form.Item name="payableAccountId" label="Cuenta por pagar (CxP)" style={{ marginBottom: 8 }}
                            tooltip="Requerida para generar la póliza automáticamente">
                            <Select showSearch allowClear placeholder="2101 — Proveedores"
                              options={accounts.filter(a => !a.isHeader && a.isActive && a.code?.startsWith('2'))
                                .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                          </Form.Item>
                          <Form.Item name="paymentTerms" label="Términos de pago" style={{ marginBottom: 8 }}>
                            <Select placeholder="Neto 30 días"
                              options={Object.entries(PAYMENT_TERMS_CONFIG).map(([k, v]) => ({ value: k, label: v }))} />
                          </Form.Item>
                        </div>
                        {/* Fila 2: Cuenta de gasto | Impuesto IVA */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                          <Form.Item name="expenseAccountId" label="Cuenta de gasto" style={{ marginBottom: 8 }}
                            tooltip="Cuenta de gasto o activo que se debita en la póliza">
                            <Select showSearch allowClear placeholder="Busca por código o nombre..."
                              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                              options={accounts.filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('6') || a.code?.startsWith('5') || a.type === 'expense'))
                                .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                          </Form.Item>
                          <Form.Item name="defaultPurchaseTaxId" label="Impuesto IVA" style={{ marginBottom: 8 }}
                            tooltip="Impuesto predeterminado al registrar facturas de este proveedor">
                            <Select showSearch allowClear placeholder="12% — Tasa general 12%"
                              options={taxes.filter(t => !t.isWithholding).map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))} />
                          </Form.Item>
                        </div>
                        <Button type="primary" htmlType="submit" loading={stepperLoading} style={{ background: '#1faec2' }}>
                          Crear y vincular proveedor
                        </Button>
                      </Form>
                    </div>
                  )
                )}

                {/* Paso 2 — Orden de Compra / Tipo de registro */}
                {stepperStep === 2 && (() => {
                  const isNC2 = ['NCRE', 'NABN'].includes(((stepperDte as any).tipoDocumento ?? '').toUpperCase())
                  if (isNC2) return (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
                      <strong>Nota de Crédito Proveedor</strong> — No aplica Orden de Compra.
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>Continúa para registrar la nota de crédito.</Text>
                    </div>
                  )
                  if (stepperIsAnulado) return (
                    <div style={{ background: '#fff1f0', border: '1px solid #fca5a5', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>
                      <strong>Factura Anulada</strong> — No aplica Orden de Compra.
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>Continúa para registrar la factura con valor Q0.00.</Text>
                    </div>
                  )
                  return (
                  <div>
                    <Text style={{ display: 'block', marginBottom: 18, fontSize: 13 }}>
                      ¿Cómo se registra este DTE?
                    </Text>
                    <Radio.Group value={stepperOcChoice} style={{ width: '100%' }}
                      onChange={e => { setStepperOcChoice(e.target.value); if (e.target.value !== 'select') setStepperOcId(undefined) }}>
                      <Space direction="vertical" size={14} style={{ width: '100%' }}>
                        <Radio value="skip">
                          <Text strong>Compra directa</Text>
                          <br /><Text type="secondary" style={{ fontSize: 12 }}>La factura se registra sin orden de compra</Text>
                        </Radio>
                        <Radio value="select">
                          <Text strong>Vincular a una Orden de Compra existente</Text>
                          <br /><Text type="secondary" style={{ fontSize: 12 }}>Cierra la OC y vincula la factura</Text>
                        </Radio>
                        <Radio value="reimbursement">
                          <Text strong>Reembolso de Gastos (Empleado)</Text>
                          <br /><Text type="secondary" style={{ fontSize: 12 }}>La deuda se reclasifica al empleado mediante un asiento de reclasificación</Text>
                        </Radio>
                      </Space>
                    </Radio.Group>
                    {stepperOcChoice === 'select' && (
                      <div style={{ marginTop: 14 }}>
                        {stepperPOs === undefined
                          ? <Spin size="small" />
                          : stepperPOs.length === 0
                            ? <Alert type="info" showIcon style={{ fontSize: 12 }}
                                message="No hay OC abiertas para este proveedor. Selecciona 'Continuar sin OC'." />
                            : <Select showSearch style={{ width: '100%' }} placeholder="Selecciona una Orden de Compra"
                                value={stepperOcId} onChange={setStepperOcId}
                                options={stepperPOs.map(po => ({ value: po.id, label: `${po.orderNumber} — ${money(po.total, po.currency)}` }))} />
                        }
                      </div>
                    )}
                  </div>
                  )
                })()}

                {/* Paso 3 — Registrar */}
                {stepperStep === 3 && (
                  <Form form={stepperForm} layout="vertical" size="small" onFinish={handleStepperPost}
                    initialValues={{ invoiceType: 'goods' }}>
                    {stepperIsAnulado && (
                      <Alert
                        type="error"
                        showIcon
                        icon={<StopOutlined />}
                        style={{ marginBottom: 12, fontSize: 12 }}
                        message={<span style={{ fontWeight: 700 }}>ANULADA — Se registrará con Q0.00</span>}
                        description="Selecciona la cuenta contable de referencia. El asiento será Q0 y el estado quedará como ANULADA."
                      />
                    )}
                    {isNC && (
                      <>
                      <Form.Item name="originalInvoiceId" label="Factura original del proveedor (opcional)">
                        <Select allowClear showSearch placeholder="Buscar factura del proveedor..."
                          optionFilterProp="label"
                          options={originalBills}
                          notFoundContent={originalBills.length === 0 ? 'Sin facturas — se puede vincular después' : 'No encontrada'} />
                      </Form.Item>
                      <Form.Item name="creditNoteReason" label="Motivo de la Nota de Crédito">
                        <Input.TextArea rows={2} placeholder="Ej: Devolución de mercadería defectuosa" />
                      </Form.Item>
                      </>
                    )}
                    <Form.Item name="concepto" label="Concepto de la compra"
                      rules={[{ required: true, message: 'Describe qué se está comprando' }]}>
                      <Input.TextArea rows={2} placeholder="Ej: Alimentos para cafetería — Abril 2026" />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      <div>
                        <Form.Item name="invoiceType" label="Tipo de factura" style={{ marginBottom: 6 }}>
                          <Select
                            options={[
                              { value: 'goods',          label: 'Compra de bienes' },
                              { value: 'services',       label: 'Prestación de servicios' },
                              { value: 'fuel',           label: 'Combustible con IDP' },
                              { value: 'special',        label: 'Factura especial' },
                              { value: 'exempt',         label: 'Exenta' },
                              { value: 'donation',       label: 'Recibo de donación' },
                              { value: 'small_taxpayer', label: 'Pequeño contribuyente' },
                            ]}
                            onChange={(val) => {
                              setStepperHasTimbre(false)
                              setStepperHasTurismo(false)
                              if (val === 'fuel' && orgImpEsp?.idpAccountCode) {
                                const acc = accounts.find(a => a.code === orgImpEsp!.idpAccountCode)
                                if (acc) stepperForm.setFieldValue('idpAccountId', acc.id)
                              }
                            }}
                          />
                        </Form.Item>
                        {isServiceStep3 && (
                          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                            <Checkbox checked={stepperHasTimbre}
                              onChange={e => {
                                setStepperHasTimbre(e.target.checked)
                                if (e.target.checked && orgImpEsp?.timbrePrensaAccountCode) {
                                  const acc = accounts.find(a => a.code === orgImpEsp.timbrePrensaAccountCode)
                                  if (acc) stepperForm.setFieldValue('timbrePrensaAccountId', acc.id)
                                }
                              }}>
                              <span style={{ fontSize: 11 }}>Timbre de Prensa</span>
                            </Checkbox>
                            <Checkbox checked={stepperHasTurismo}
                              onChange={e => {
                                setStepperHasTurismo(e.target.checked)
                                if (e.target.checked && orgImpEsp?.turismoAccountCode) {
                                  const acc = accounts.find(a => a.code === orgImpEsp.turismoAccountCode)
                                  if (acc) stepperForm.setFieldValue('turismoAccountId', acc.id)
                                }
                              }}>
                              <span style={{ fontSize: 11 }}>Turismo INGUAT</span>
                            </Checkbox>
                          </div>
                        )}
                      </div>
                      <Form.Item name="taxId" label="Impuesto"
                        rules={[{ required: true, message: 'Selecciona el impuesto aplicable' }]}>
                        <Select
                          placeholder="Selecciona el impuesto (IVA)"
                          options={taxes.map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))}
                        />
                      </Form.Item>
                    </div>
                    <Form.Item name="paymentTerms" hidden><input /></Form.Item>
                    <Form.Item
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span>Cuenta contable</span>
                          <Segmented
                            size="small"
                            value={accountMode}
                            onChange={v => { setAccountMode(v as typeof accountMode); stepperForm.setFieldValue('accountId', undefined) }}
                            options={[
                              { value: 'expense', label: 'Gasto / Costo' },
                              { value: 'asset',   label: 'Activo' },
                              { value: 'all',     label: 'Todas' },
                            ]}
                          />
                        </div>
                      }
                      name="accountId"
                      rules={[{ required: true, message: 'Selecciona la cuenta contable' }]}
                    >
                      <Select showSearch allowClear
                        placeholder={
                          accountMode === 'asset'   ? 'Busca activo fijo (ej: 1205 Mobiliario)' :
                          accountMode === 'all'      ? 'Busca en todo el catálogo...' :
                                                       'Busca por código o nombre (ej: 6101 Compras)'
                        }
                        filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={accounts
                          .filter(a => {
                            if (a.isHeader || !a.isActive) return false
                            if (accountMode === 'asset')   return a.code?.startsWith('1')
                            if (accountMode === 'all')     return true
                            return a.code?.startsWith('5') || a.code?.startsWith('6') || (a as any).type === 'expense'
                          })
                          .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                      />
                    </Form.Item>

                    {/* IDP — visible cuando tipo = Combustible */}
                    {isFuelStep3 && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#92400e', display: 'block', marginBottom: 8 }}>
                          IDP — Combustible (Dto. 38-92)
                        </Text>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                          <Form.Item name="idpType" label="Tipo de combustible"
                            rules={[{ required: true, message: 'Selecciona el tipo de combustible' }]}
                            style={{ marginBottom: 6 }}>
                            <Select placeholder="Gasolina, diésel..."
                              options={Object.entries(IDP_RATES_FE).map(([k, v]) => ({
                                value: k,
                                label: `${v.label} (Q${v.rate.toFixed(2)}/gal)`,
                              }))}
                            />
                          </Form.Item>
                          <Form.Item name="idpAccountId" label="Cuenta IDP"
                            rules={[{ required: true, message: 'Selecciona la cuenta IDP' }]}
                            style={{ marginBottom: 6 }}>
                            <Select showSearch allowClear placeholder="630011 — IDP"
                              options={accounts.filter(a => !a.isHeader && a.isActive)
                                .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                          </Form.Item>
                        </div>
                        {idpCalcAmount > 0 && (
                          <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                            IDP calculado: <strong>Q {idpCalcAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</strong>
                            {' · '}
                            {((stepperDte?.items as any[]) ?? []).reduce((s: number, l: any) => s + (Number(l.cantidad) || 0), 0).toFixed(5)} gal × Q{(IDP_RATES_FE[watchedIdpType!]?.rate ?? 0).toFixed(2)}/gal
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timbre de Prensa / Turismo — cuando tipo = Servicios y checkbox activo */}
                    {isServiceStep3 && (stepperHasTimbre || stepperHasTurismo) && (() => {
                      // Base gravable: se extrae desde el IVA del DTE (totalIva / 0.12)
                      // NO usar subtotal cuando hay impuestos adicionales (Turismo):
                      //   subtotal = total − IVA incluye el Turismo → base inflada
                      // Con IVA: totalIva / 0.12 = base exacta en ambos casos
                      const dteIva  = Number(stepperDte?.totalIva ?? 0)
                      const sub     = dteIva > 0
                        ? Math.round((dteIva / 0.12) * 100) / 100
                        : Number(stepperDte?.subtotal ?? 0)
                      const timbreRate  = orgImpEsp?.timbrePrensaRate ?? 0.5
                      const turismoRate = orgImpEsp?.turismoRate ?? 10
                      const fmt2 = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2 })
                      return (
                        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                          <Text strong style={{ fontSize: 12, color: '#6d28d9', display: 'block', marginBottom: 8 }}>
                            Impuestos Especiales
                          </Text>
                          {stepperHasTimbre && (
                            <div style={{ marginBottom: stepperHasTurismo ? 10 : 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 11, color: '#6b7280' }}>Timbre de Prensa ({timbreRate}%)</Text>
                                <Text strong style={{ fontSize: 12, color: '#6d28d9' }}>Q {fmt2(Math.round(sub * timbreRate / 100 * 100) / 100)}</Text>
                              </div>
                              <Form.Item name="timbrePrensaAccountId" label="Cuenta Timbre de Prensa" style={{ marginBottom: 0 }}>
                                <Select showSearch allowClear placeholder="Ej. 6108 — Timbre de Prensa"
                                  options={accounts.filter(a => !a.isHeader && a.isActive).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                              </Form.Item>
                            </div>
                          )}
                          {stepperHasTurismo && (
                            <div style={{ marginTop: stepperHasTimbre ? 8 : 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 11, color: '#6b7280' }}>Turismo INGUAT ({turismoRate}%)</Text>
                                <Text strong style={{ fontSize: 12, color: '#6d28d9' }}>Q {fmt2(Math.round(sub * turismoRate / 100 * 100) / 100)}</Text>
                              </div>
                              <Form.Item name="turismoAccountId" label="Cuenta Turismo INGUAT" style={{ marginBottom: 0 }}>
                                <Select showSearch allowClear placeholder="Ej. 6109 — Turismo INGUAT"
                                  options={accounts.filter(a => !a.isHeader && a.isActive).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                              </Form.Item>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Empleado — visible solo en modo Reembolso de Gastos */}
                    {stepperOcChoice === 'reimbursement' && (
                      <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#5b21b6', display: 'block', marginBottom: 4 }}>
                          Datos del Empleado
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                          Al aprobar se generan dos asientos: (1) Dr Gasto / Cr CxP Proveedor; (2) Dr CxP Proveedor / Cr Cuenta Transitoria Empleado
                        </Text>
                        <Form.Item name="employeeId" label="Empleado"
                          rules={[{ required: true, message: 'Selecciona el empleado' }]}
                          style={{ marginBottom: 0 }}>
                          <Select showSearch allowClear placeholder="Buscar empleado…"
                            options={vendors}
                            notFoundContent="Sin empleados — regístralos en Compras → Proveedores (tipo Empleado)" />
                        </Form.Item>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      <Form.Item name="accountingDate" label="Fecha contable">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                      </Form.Item>
                      {!isFuelStep3 && (
                        <Form.Item name="defaultUnit" label="Unidad de medida">
                          <Select allowClear showSearch placeholder="Unidad por defecto para las líneas"
                            options={unidades.map(u => ({ value: u.code, label: `${u.code} — ${u.name}` }))}
                          />
                        </Form.Item>
                      )}
                    </div>
                    {stepperOcId && (
                      <Form.Item label="OC vinculada" style={{ marginBottom: 6 }}>
                        <Tag color="#1faec2">{stepperPOs?.find(p => p.id === stepperOcId)?.orderNumber ?? 'OC seleccionada'}</Tag>
                      </Form.Item>
                    )}
                  </Form>
                )}

                {/* Paso 4 — Listo */}
                {stepperStep === 4 && stepperResult && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircleOutlined style={{ fontSize: 52, color: '#2ea172', marginBottom: 14 }} />
                    <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>DTE Procesado Correctamente</Text>
                    <div style={{ background: '#e8f5ef', border: '1px solid #c3e5d8', borderRadius: 8, padding: '12px 32px', display: 'inline-block', textAlign: 'left', marginTop: 8 }}>
                      <div>
                        <Text type="secondary">{isNC ? 'Nota de Crédito:' : 'Factura:'}</Text>{' '}
                        <Text strong>{stepperResult.invoice?.invoiceNumber}</Text>
                      </div>
                      {stepperResult.invoice?.journalEntryId && (
                        <div><Text type="secondary">Póliza:</Text> <Text strong style={{ color: '#2ea172' }}>Generada automáticamente</Text></div>
                      )}
                      <div><Text type="secondary">Total:</Text> <Text strong>{money(stepperDte.total, stepperDte.moneda)}</Text></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer navegación */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(10,10,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={() => setStepperStep(s => s - 1)}
                  disabled={stepperStep === 0 || stepperStep === 4 || stepperLoading}>
                  ← Anterior
                </Button>
                <Space>
                  {stepperStep < 3 && (
                    <Tooltip title={stepperStep === 1 && vendorLinked && stepperVendorPayableMissing
                      ? 'Configura la Cuenta CxP del proveedor antes de continuar'
                      : undefined}>
                    <Button type="primary" style={{ background: '#1faec2' }}
                      disabled={!canNext || stepperLoading}
                      onClick={async () => {
                        if (stepperStep === 1) {
                          setStepperStep(2)
                          await handleEnterOcStep()
                        } else if (stepperStep === 2) {
                          if (isNC && stepperDte?.vendorId) loadOriginalBills(stepperDte.vendorId)
                          setStepperStep(3)
                        } else {
                          setStepperStep(s => s + 1)
                        }
                      }}
                    >
                      Siguiente →
                    </Button>
                    </Tooltip>
                  )}
                  {stepperStep === 3 && (
                    <Button type="primary" icon={<BookOutlined />} loading={stepperLoading}
                      style={{ background: '#1faec2' }} onClick={() => stepperForm.submit()}>
                      Registrar y Contabilizar
                    </Button>
                  )}
                  {stepperStep === 4 && (
                    <Space>
                      <Button onClick={() => {
                        const next = documents.find(d => d.id !== stepperDte?.id && (d.status === 'pending' || d.status === 'ready'))
                        if (next) openStepper(next); else setStepperDte(null)
                      }}>
                        Procesar siguiente DTE
                      </Button>
                      <Button type="primary" style={{ background: '#1faec2' }} onClick={() => setStepperDte(null)}>
                        Cerrar
                      </Button>
                    </Space>
                  )}
                </Space>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Modal Registro Masivo ─────────────────────────────────────────── */}
      {(() => {
        const expenseAccounts = accounts.filter(a => !a.isHeader && a.isActive &&
          (a.code?.startsWith('6') || (a as any).type === 'expense'))
        const allDone = batchRows.length > 0 && batchRows.every(r => r.status === 'ok' || r.status === 'skipped' || r.status === 'error' || r.missing)
        const canProcess = !batchRunning && batchRows.some(r => !r.missing && r.accountId && r.status === 'pending')
        return (
        <Modal
          open={batchOpen}
          title={<Space><ThunderboltOutlined style={{ color: '#2ea172' }} /><span>Registro Masivo — {batchRows.length} documento{batchRows.length !== 1 ? 's' : ''}</span></Space>}
          width={1360}
          footer={null}
          onCancel={() => { if (!batchRunning) { setBatchOpen(false); setBatchRows([]) } }}
          maskClosable={false}
          destroyOnClose
        >
          {batchLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin />  <Text type="secondary" style={{ marginLeft: 8 }}>Cargando datos de proveedores…</Text></div>
          ) : (
            <>
              {/* Tabla con cuenta y unidad editables por fila */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, minWidth: 155 }}>Proveedor / DTE</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 165 }}>Tipo factura</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 195 }}>Registro</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, minWidth: 185 }}>Cuenta de gasto</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 90 }}>Unidad</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 130 }}>Fecha contable</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, fontSize: 11, width: 80 }}>Total</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, width: 100 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map(row => {
                    const lines = row.dteItems ?? []
                    const multiLine = lines.length > 1
                    return (
                      <React.Fragment key={row.id}>
                        {/* Fila principal del DTE */}
                        <tr style={{ borderBottom: lines.length > 0 ? undefined : '1px solid rgba(10,10,10,0.08)', background: row.missing ? 'rgba(255,127,0,0.10)' : undefined }}>
                          <td style={{ padding: '6px 10px' }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{row.vendorName}</div>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{row.dteRef}</div>
                            {row.taxLabel && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{row.taxLabel}</div>}
                          </td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                            {row.status === 'pending' ? (
                              <>
                                <Select size="small" style={{ width: '100%' }}
                                  value={row.invoiceType ?? 'goods'}
                                  onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, invoiceType: val } : r))}
                                  options={[
                                    { value: 'goods',          label: 'Bienes' },
                                    { value: 'services',       label: 'Servicios' },
                                    { value: 'fuel',           label: 'Combustible' },
                                    { value: 'special',        label: 'Especial' },
                                    { value: 'exempt',         label: 'Exenta' },
                                    { value: 'donation',       label: 'Donación' },
                                    { value: 'small_taxpayer', label: 'Peq. Contrib.' },
                                  ]}
                                />
                                {row.invoiceType === 'fuel' && (
                                  <Select size="small" style={{ width: '100%', marginTop: 3 }}
                                    placeholder="Tipo combustible"
                                    value={row.idpType}
                                    onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, idpType: val } : r))}
                                    options={Object.entries(IDP_RATES_FE).map(([k, v]) => ({ value: k, label: `${v.label} (Q${v.rate.toFixed(2)}/gal)` }))}
                                  />
                                )}
                              </>
                            ) : (
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>{row.invoiceType ?? 'goods'}</Text>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            {row.status === 'pending' ? (
                              <>
                                <Select size="small" style={{ width: '100%' }}
                                  value={row.ocType ?? 'direct'}
                                  onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id
                                    ? { ...r, ocType: val as BatchRow['ocType'], employeeId: undefined }
                                    : r))}
                                  options={[
                                    { value: 'direct',        label: 'Compra directa' },
                                    { value: 'select',        label: 'Vincular OC existente' },
                                    { value: 'reimbursement', label: 'Reembolso (Empleado)' },
                                  ]}
                                />
                                {row.ocType === 'reimbursement' && (
                                  <div style={{ marginTop: 4, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '5px 7px' }}>
                                    <Text style={{ fontSize: 10, color: '#5b21b6', display: 'block', marginBottom: 3 }}>Empleado</Text>
                                    <Select size="small" style={{ width: '100%' }} showSearch allowClear
                                      placeholder="Buscar empleado…"
                                      value={row.employeeId}
                                      options={vendors}
                                      filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                      onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, employeeId: val } : r))}
                                      notFoundContent="Sin empleados registrados"
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                {row.ocType === 'reimbursement' ? 'Reembolso' : row.ocType === 'select' ? 'Vincular OC' : 'Compra directa'}
                              </Text>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            {row.status === 'pending' && !multiLine ? (
                              <Select size="small" style={{ width: '100%' }} showSearch
                                placeholder="Seleccionar cuenta…"
                                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                value={row.accountId}
                                status={!row.accountId ? 'error' : undefined}
                                onChange={val => {
                                  const acc = expenseAccounts.find(a => a.id === val)
                                  const lbl = acc ? `${acc.code} — ${acc.name}` : val
                                  setBatchRows(prev => prev.map(r => r.id === row.id
                                    ? { ...r, accountId: val, accountLabel: lbl, missing: undefined,
                                        dteItems: r.dteItems?.map(li => ({ ...li, accountId: val, accountLabel: lbl })) }
                                    : r))
                                }}
                                options={expenseAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                              />
                            ) : row.status === 'pending' && multiLine ? (
                              <Text style={{ fontSize: 10, color: '#6b7280' }}>← asigna por línea</Text>
                            ) : (
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>{row.accountLabel ?? '—'}</Text>
                            )}
                            {row.missing && row.status === 'pending' && (
                              <div style={{ color: '#ff7f00', fontSize: 10, marginTop: 2 }}>⚠ {row.missing}</div>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            {row.status === 'pending' ? (
                              <Select size="small" style={{ width: '100%' }} allowClear placeholder="UND"
                                value={row.defaultUnit}
                                onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, defaultUnit: val ?? undefined } : r))}
                                options={unidades.map(u => ({ value: u.code, label: u.code }))} />
                            ) : (
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>{row.defaultUnit ?? '—'}</Text>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            {row.status === 'pending' ? (
                              <DatePicker size="small" style={{ width: '100%' }} format="DD/MM/YYYY"
                                value={row.accountingDate}
                                onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, accountingDate: val ?? dayjs() } : r))}
                              />
                            ) : (
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>{row.accountingDate?.format('DD/MM/YYYY') ?? '—'}</Text>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{money(row.total, row.moneda)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {row.status === 'pending' && !row.missing && <Tag color="default" style={{ fontSize: 10 }}>Pendiente</Tag>}
                            {row.status === 'pending' && row.missing  && <Tag color="warning" style={{ fontSize: 10 }}>Sin cuenta</Tag>}
                            {row.status === 'processing'              && <Tag color="processing" style={{ fontSize: 10 }}>Procesando…</Tag>}
                            {row.status === 'ok'                      && <Tag color="success" style={{ fontSize: 10 }}>✓ {row.result}</Tag>}
                            {row.status === 'skipped'                 && <Tooltip title={row.error}><Tag color="orange" style={{ fontSize: 10 }}>↓ Ya registrada</Tag></Tooltip>}
                            {row.status === 'error'                   && <Tooltip title={row.error}><Tag color="error" style={{ fontSize: 10 }}>✗ Error</Tag></Tooltip>}
                          </td>
                        </tr>
                        {/* Sub-filas de líneas del DTE */}
                        {lines.map((line, idx) => (
                          <tr key={`${row.id}-line-${idx}`} style={{ borderBottom: idx === lines.length - 1 ? '1px solid rgba(10,10,10,0.08)' : '1px solid rgba(10,10,10,0.04)', background: '#f5f7fa' }}>
                            <td colSpan={3} style={{ padding: '3px 10px 3px 24px' }}>
                              <Text style={{ fontSize: 10, color: '#374151' }}>
                                {String(line.descripcion || line.description || '').trim() || `Línea ${idx + 1}`}
                              </Text>
                            </td>
                            <td style={{ padding: '3px 6px' }}>
                              {row.status === 'pending' && multiLine ? (
                                <Select size="small" style={{ width: '100%' }} showSearch allowClear
                                  placeholder="Cuenta línea…"
                                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                  value={line.accountId}
                                  onChange={val => {
                                    const acc = expenseAccounts.find(a => a.id === val)
                                    setBatchRows(prev => prev.map(r => {
                                      if (r.id !== row.id) return r
                                      const newItems = (r.dteItems ?? []).map((li, i) =>
                                        i === idx ? { ...li, accountId: val, accountLabel: acc ? `${acc.code} — ${acc.name}` : val } : li
                                      )
                                      return { ...r, dteItems: newItems, missing: undefined }
                                    }))
                                  }}
                                  options={expenseAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                                />
                              ) : (
                                <Text style={{ fontSize: 10, color: '#6b7280' }}>{line.accountLabel ?? '↳ cuenta DTE'}</Text>
                              )}
                            </td>
                            <td style={{ padding: '3px 6px' }}>
                              <Text style={{ fontSize: 10, color: '#6b7280' }}>{line.cantidad ? `× ${line.cantidad}` : ''}</Text>
                            </td>
                            <td />
                            <td style={{ padding: '3px 10px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                              {line.total_linea ? `Q ${Number(line.total_linea).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : ''}
                            </td>
                            <td />
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>

              {/* Resumen + botones */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {batchRows.filter(r => r.missing).length > 0 && (
                    <Text type="warning" style={{ fontSize: 12 }}>
                      {batchRows.filter(r => r.missing).length} sin cuenta — se omitirán
                    </Text>
                  )}
                  {allDone && (
                    <Text style={{ fontSize: 12, color: '#2ea172' }}>
                      ✓ {batchRows.filter(r => r.status === 'ok').length} registrado{batchRows.filter(r => r.status === 'ok').length !== 1 ? 's' : ''}
                      {batchRows.some(r => r.status === 'skipped') && <span style={{ color: '#ff7f00' }}> · {batchRows.filter(r => r.status === 'skipped').length} ya registrada{batchRows.filter(r => r.status === 'skipped').length !== 1 ? 's' : ''} (omitida{batchRows.filter(r => r.status === 'skipped').length !== 1 ? 's' : ''})</span>}
                      {batchRows.some(r => r.status === 'error') && <span style={{ color: '#e5484d' }}> · {batchRows.filter(r => r.status === 'error').length} con error</span>}
                    </Text>
                  )}
                </div>
                <Space>
                  {!allDone && <Button onClick={() => { if (!batchRunning) { setBatchOpen(false); setBatchRows([]) } }}>Cancelar</Button>}
                  {!allDone ? (
                    <Button type="primary" icon={<ThunderboltOutlined />} loading={batchRunning}
                      disabled={!canProcess}
                      style={{ background: canProcess ? '#2ea172' : undefined, borderColor: canProcess ? '#2ea172' : undefined }}
                      onClick={handleBatchPost}>
                      Registrar {batchRows.filter(r => !r.missing && r.accountId).length} DTE{batchRows.filter(r => !r.missing && r.accountId).length !== 1 ? 's' : ''}
                    </Button>
                  ) : (
                    <Button type="primary" style={{ background: '#1faec2' }}
                      onClick={() => { setBatchOpen(false); setBatchRows([]) }}>
                      Cerrar
                    </Button>
                  )}
                </Space>
              </div>
            </>
          )}
        </Modal>
        )
      })()}

      {/* Modal — Crear proveedor desde DTE SAT */}
      <Modal
        open={!!vendorModalDte}
        title={<Space><UserAddOutlined style={{ color: '#1faec2' }} /><span>Crear proveedor desde DTE SAT</span></Space>}
        okText="Crear proveedor"
        cancelText="Cancelar"
        confirmLoading={createVendorLoading}
        onOk={() => vendorForm.submit()}
        onCancel={() => { setVendorModalDte(null); vendorForm.resetFields() }}
        width={520}
        destroyOnClose
      >
        {vendorModalDte && (
          <>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
              <Text strong>{vendorModalDte.nombreEmisor ?? '—'}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>NIT: {vendorModalDte.nitEmisor ?? '—'} · {vendorModalDte.moneda ?? 'GTQ'}</Text>
            </div>
            <Form form={vendorForm} layout="vertical" size="small" onFinish={handleCreateVendorSubmit}>
              <Form.Item name="name" label="Nombre del proveedor">
                <Input placeholder={vendorModalDte.nombreEmisor ?? 'Nombre'} />
              </Form.Item>
              <Form.Item
                name="payableAccountId"
                label="Cuenta por pagar (CxP)"
                tooltip="Necesaria para generar la póliza contable automáticamente"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Busca por código o nombre (ej: 2101 Proveedores)"
                  options={accounts
                    .filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('21') || a.code?.startsWith('2')))
                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Modal — Contabilizar DTE SAT */}
      <Modal
        open={!!postingDte}
        title={<Space><BookOutlined style={{ color: '#1faec2' }} /><span>Contabilizar DTE SAT</span></Space>}
        okText="Contabilizar"
        cancelText="Cancelar"
        confirmLoading={postLoading}
        onOk={() => postForm.submit()}
        onCancel={() => { setPostingDte(null); postForm.resetFields() }}
        width={620}
        destroyOnClose
      >
        {postingDte && (
          <>
            <Descriptions
              size="small"
              column={2}
              style={{ marginBottom: 16, background: '#f8fafc', padding: '10px 12px', borderRadius: 6 }}
            >
              <Descriptions.Item label="Proveedor SAT" span={2}>
                <Text strong>{postingDte.nombreEmisor ?? '—'}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>NIT: {postingDte.nitEmisor ?? '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Fecha emisión">
                {postingDte.fechaEmision ? dayjs(postingDte.fechaEmision).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Serie / DTE">
                {postingDte.serie ?? '—'} / {postingDte.numeroDte ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Subtotal">{money(postingDte.subtotal, postingDte.moneda)}</Descriptions.Item>
              <Descriptions.Item label="IVA">{money(postingDte.totalIva, postingDte.moneda)}</Descriptions.Item>
              <Descriptions.Item label="Total" span={2}>
                <Text strong style={{ fontSize: 14, color: '#1faec2' }}>{money(postingDte.total, postingDte.moneda)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Factura PDF" span={2}>
                {postingDte.pdfKey
                  ? <DocumentLink documentKey={postingDte.pdfKey} docType="fel-pdf-proveedor" label="Ver PDF de la factura" />
                  : postingDte.pdfUrl
                    ? <a href={postingDte.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Ver PDF de la factura ↗</a>
                    : <a
                        href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${postingDte.uuid}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#ff7f00' }}
                      >
                        Ver en portal SAT (verificación FEL) ↗
                      </a>
                }
              </Descriptions.Item>
            </Descriptions>

            <Form form={postForm} layout="vertical" size="small" onFinish={handlePost}>
              <Form.Item
                name="concepto"
                label="Concepto de la compra"
                rules={[{ required: true, message: 'Describe brevemente qué se está comprando' }]}
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Ej: Servicios de publicidad digital — Abril 2026 / Compra de materiales de oficina"
                />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item
                  name="taxId"
                  label="Impuesto"
                  rules={[{ required: true, message: 'Selecciona el impuesto aplicable' }]}
                >
                  <Select
                    options={taxes.map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))}
                    placeholder="Selecciona el impuesto (IVA)"
                  />
                </Form.Item>
                <Form.Item
                  name="paymentTerms"
                  label="Términos de pago"
                  rules={[{ required: true, message: 'Selecciona términos' }]}
                >
                  <Select
                    options={Object.entries(PAYMENT_TERMS_CONFIG).map(([k, v]) => ({ value: k, label: v }))}
                    placeholder="Contado / crédito"
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="accountId"
                label="Cuenta de gasto"
                rules={[{ required: true, message: 'Selecciona la cuenta contable de gasto' }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Busca por código o nombre (ej: 6101 Publicidad)"
                  options={accounts
                    .filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('6') || a.type === 'expense'))
                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item name="accountingDate" label="Fecha contable">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </div>
            </Form>
          </>
        )}
      </Modal>

      {/* Header + Formulario de importación — bloque unificado */}
      <Card
        bordered={false}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                DTE SAT{hasRunningJobs && <Spin size="small" style={{ marginLeft: 8 }} />}
              </Title>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                Bandeja de facturas importadas desde SAT vía APIFY
                {hasRunningJobs && <Text type="warning" style={{ marginLeft: 6, fontSize: 12 }}>· Importación en progreso</Text>}
              </Text>
            </div>
            {!satCredentials.satNit ? (
              <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                ⚠ Configura credenciales SAT en <strong>Configuración → Configuración fiscal</strong>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#2ea172', background: '#e8f5ef', border: '1px solid #c3e5d8', borderRadius: 4, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                ✓ NIT {satCredentials.satNit} configurado
              </div>
            )}
          </div>
        }
        extra={<Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading} size="small">Actualizar</Button>}
        style={{ borderTop: '3px solid #1faec2' }}
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
      >
        <Form form={form} layout="inline" size="small" onFinish={handleImport}>
          <Form.Item name="range" label="Rango de emisión" style={{ marginBottom: 0 }}
            rules={[{ required: true, message: 'Selecciona el rango de fechas' }]}
          >
            <RangePicker
              style={{ width: 280 }}
              presets={[
                { label: 'Este mes',       value: [dayjs().startOf('month'), dayjs()] },
                { label: 'Mes anterior',   value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                { label: 'Este trimestre', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs()] },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" icon={<ApiOutlined />} loading={importing}
              disabled={!satCredentials.satNit}
              style={{ background: '#1faec2' }}>
              Importar Recibidos
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Tabs: Documentos + Jobs */}
      <Tabs
        type="card"
        items={[
          {
            key: 'documentos',
            label: (
              <Space size={4}>
                <FileTextOutlined />
                Documentos SAT
                {(totals.pending.count + totals.ready.count) > 0 && (
                  <Tag color="gold" style={{ fontSize: 10, marginInlineEnd: 0 }}>
                    {totals.pending.count + totals.ready.count} por procesar
                  </Tag>
                )}
              </Space>
            ),
            children: (
              <Card bordered={false}>
                {/* Barra de filtros */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="Buscar UUID, NIT, proveedor o DTE"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: 300 }}
                    />
                    <Button
                      size="small"
                      type={!statusFilter ? 'primary' : 'default'}
                      onClick={() => setStatusFilter(undefined)}
                    >
                      Todos
                    </Button>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <Button
                        key={key}
                        size="small"
                        type={statusFilter === key ? 'primary' : 'default'}
                        onClick={() => setStatusFilter(key)}
                      >
                        {cfg.label}
                        {stats[key]?.count ? ` (${stats[key].count})` : ''}
                      </Button>
                    ))}
                    {stats.pending?.count > 0 && !statusFilter && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#92400e', cursor: 'pointer' }}
                        onClick={openBulkVendorModal}>
                        <WarningOutlined style={{ color: '#f59e0b' }} />
                        <span><strong>{stats.pending.count}</strong> prov. pendientes — <strong>Registrar en lote</strong></span>
                      </div>
                    )}
                    {stats.ready?.count > 0 && !statusFilter && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e8f5ef', border: '1px solid #6ee7b7', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#065f46', cursor: 'pointer' }}
                        onClick={async () => {
                          const res = await getSatDteDocuments({ status: 'ready', limit: 500 })
                          const allReady = (res.data ?? []).filter(isBatchable)
                          openBatchModal(allReady)
                        }}>
                        <CheckCircleOutlined style={{ color: '#2ea172' }} />
                        <span><strong>{stats.ready.count} facturas listas</strong> — Registrar en lote</span>
                      </div>
                    )}
                  </Space>
                  {selectedIds.length > 0 && (
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      style={{ background: '#2ea172', flexShrink: 0 }}
                      onClick={() => openBatchModal()}
                    >
                      Registrar {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
                <Table
                  columns={columns}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    showTotal: t => `${t} documentos`,
                  }}
                  rowClassName={row =>
                    row.status === 'ready' ? 'ant-table-row-ready' :
                    row.status === 'error' ? 'ant-table-row-error' : ''
                  }
                  rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: keys => setSelectedIds(keys as string[]),
                    getCheckboxProps: row => ({ disabled: !isBatchable(row) }),
                    columnWidth: 36,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'jobs',
            label: (
              <Space size={4}>
                <CloudSyncOutlined />
                Importaciones
                {hasRunningJobs && <Badge status="processing" />}
              </Space>
            ),
            children: (
              <Card bordered={false}>
                {hasRunningJobs && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12, fontSize: 12 }}
                    message="Hay importaciones en curso — sincronizando automáticamente cada 20 segundos"
                    action={<Spin size="small" />}
                  />
                )}
                <Table
                  columns={jobColumns}
                  dataSource={jobs}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 950 }}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ── Modal Registro Masivo de Proveedores ─────────────────────────── */}
      <Modal
        open={bulkVendorOpen}
        title={<Space><TeamOutlined /><span>Registro masivo de proveedores — {bulkVendorRows.length} nuevo{bulkVendorRows.length !== 1 ? 's' : ''}</span></Space>}
        width="95vw"
        style={{ maxWidth: 1500 }}
        onCancel={() => !bulkVendorRunning && setBulkVendorOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {bulkVendorRows.filter(r => r.status === 'ok').length}/{bulkVendorRows.length} registrados
            </Text>
            <Space>
              <Button onClick={() => setBulkVendorOpen(false)} disabled={bulkVendorRunning}>Cancelar</Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={bulkVendorRunning}
                disabled={bulkVendorRunning || bulkVendorRows.every(r => r.status === 'ok')}
                onClick={handleBulkVendorPost}
                style={{ background: '#1B3A6B' }}
              >
                Registrar todos
              </Button>
            </Space>
          </div>
        }
      >
        {/* Config común */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Configuración común (se aplica a todos)</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 180px', gap: '8px 12px', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cuenta por pagar (CxP) <span style={{ color: '#ef4444' }}>*</span></div>
              <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="2101 — Proveedores"
                value={bulkCommonPayable} onChange={setBulkCommonPayable}
                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={accounts.filter(a => !a.isHeader && a.isActive && a.code?.startsWith('2'))
                  .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cuenta de gasto</div>
              <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="Busca por código o nombre"
                value={bulkCommonExpense} onChange={setBulkCommonExpense}
                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={accounts.filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('5') || a.code?.startsWith('6')))
                  .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Impuesto IVA</div>
              <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="12% — Tasa general 12%"
                value={bulkCommonTax} onChange={setBulkCommonTax}
                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={taxes.filter(t => t.code?.startsWith('RG-C')).map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Condiciones de pago</div>
              <Select size="small" style={{ width: '100%' }} value={bulkCommonTerms} onChange={setBulkCommonTerms}
                options={Object.entries(PAYMENT_TERMS_CONFIG).map(([k, v]) => ({ value: k, label: v }))} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Button size="small" type="default" onClick={() => setBulkVendorRows(prev => prev.map(r =>
              r.status !== 'ok' ? {
                ...r,
                payableAccountId:     bulkCommonPayable,
                expenseAccountId:     bulkCommonExpense,
                defaultPurchaseTaxId: bulkCommonTax,
                paymentTerms:         bulkCommonTerms,
              } : r
            ))}>
              Aplicar a todos
            </Button>
          </div>
        </div>

        {/* Tabla de proveedores */}
        <Table<BulkVendorRow>
          size="small"
          pagination={false}
          rowKey="dteId"
          dataSource={bulkVendorRows}
          scroll={{ x: 1020, y: 300 }}
          columns={[
            {
              title: 'NIT Emisor', dataIndex: 'nitEmisor', width: 110, fixed: 'left',
              render: (nit: string) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{nit}</Tag>,
            },
            {
              title: 'Nombre del proveedor', dataIndex: 'name', width: 300,
              render: (name: string, row: BulkVendorRow) => (
                <Input size="small" value={name} disabled={row.status === 'ok' || bulkVendorRunning}
                  onChange={e => setBulkVendorRows(prev => prev.map(r =>
                    r.dteId === row.dteId ? { ...r, name: e.target.value } : r
                  ))} />
              ),
            },
            {
              title: 'Cuenta CxP', dataIndex: 'payableAccountId', width: 240,
              render: (val: string | undefined, row: BulkVendorRow) => (
                <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="2101 — Prov."
                  value={val} disabled={row.status === 'ok' || bulkVendorRunning}
                  onChange={v => setBulkVendorRows(prev => prev.map(r =>
                    r.dteId === row.dteId ? { ...r, payableAccountId: v } : r
                  ))}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={accounts.filter(a => !a.isHeader && a.isActive && a.code?.startsWith('2'))
                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
              ),
            },
            {
              title: 'Cuenta gasto', dataIndex: 'expenseAccountId', width: 240,
              render: (val: string | undefined, row: BulkVendorRow) => (
                <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="Gasto..."
                  value={val} disabled={row.status === 'ok' || bulkVendorRunning}
                  onChange={v => setBulkVendorRows(prev => prev.map(r =>
                    r.dteId === row.dteId ? { ...r, expenseAccountId: v } : r
                  ))}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={accounts.filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('5') || a.code?.startsWith('6')))
                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
              ),
            },
            {
              title: 'Impuesto IVA', dataIndex: 'defaultPurchaseTaxId', width: 260,
              render: (val: string | undefined, row: BulkVendorRow) => (
                <Select showSearch allowClear size="small" style={{ width: '100%' }} placeholder="RG-C01..."
                  value={val} disabled={row.status === 'ok' || bulkVendorRunning}
                  onChange={v => setBulkVendorRows(prev => prev.map(r =>
                    r.dteId === row.dteId ? { ...r, defaultPurchaseTaxId: v } : r
                  ))}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={taxes.filter(t => t.code?.startsWith('RG-C')).map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))} />
              ),
            },
            {
              title: 'DTEs', dataIndex: 'dteCount', width: 50, align: 'center',
              render: (n: number) => <Badge count={n} color="#6b7280" />,
            },
            {
              title: 'Estado', dataIndex: 'status', width: 115, fixed: 'right',
              render: (status: BulkVendorRow['status'], row: BulkVendorRow) => {
                if (status === 'ok')         return <Tag color="green" icon={<CheckCircleOutlined />}>Registrado</Tag>
                if (status === 'processing') return <Tag color="blue" icon={<Spin size="small" />}>Procesando</Tag>
                if (status === 'error')      return <Tooltip title={row.errorMsg}><Tag color="red" icon={<WarningOutlined />}>Error</Tag></Tooltip>
                return <Tag color="gold" icon={<WarningOutlined />}>Pendiente</Tag>
              },
            },
          ]}
        />
      </Modal>
    </Space>
  )
}
