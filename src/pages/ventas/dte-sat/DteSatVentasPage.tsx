import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input,
  message, Modal, Row, Select, Space, Spin, Steps, Switch, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined, BookOutlined, CheckCircleOutlined, CloudSyncOutlined,
  DeleteOutlined, FileTextOutlined, ReloadOutlined, RollbackOutlined,
  SearchOutlined, StopOutlined, ThunderboltOutlined, UserAddOutlined, WarningOutlined, EyeOutlined,
} from '@ant-design/icons'
import DocumentLink from '../../../components/DocumentLink'
import dayjs, { Dayjs } from 'dayjs'
import {
  createSatEmitidosCustomer, deleteSatEmitidos, reactivateSatEmitidos,
  getSatEmitidosDocuments, getSatEmitidosJobs, getSatEmitidosStats,
  postSatEmitidos, resolveSatEmitidosCustomer,
  startSatEmitidosImport, syncSatEmitidosJob, clearAllSatEmitidos,
  type SatDteEmitidos, type SatEmitidosJob, type SatEmitidosStatus,
} from '../../../api/facturas'
import { PAYMENT_TERMS_CONFIG } from '../../../api/compras'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getOrganizationProfile } from '../../../api/configuracion'
import { getTaxes, type Tax } from '../../../api/impuestos'
import { getEstimates, getInvoices, type Estimate } from '../../../api/facturas'
import { getUnidadesActivas, type UnidadMedida } from '../../../api/unidades-medida'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const POLL_INTERVAL_MS = 20_000

const statusConfig: Record<SatEmitidosStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Cliente pendiente', color: 'gold',    icon: <WarningOutlined /> },
  ready:     { label: 'Listo',             color: '#2ea172',   icon: <CheckCircleOutlined /> },
  duplicate: { label: 'Duplicado',         color: 'volcano', icon: <FileTextOutlined /> },
  posted:    { label: 'Contabilizado',     color: '#1faec2',    icon: <BookOutlined /> },
  error:     { label: 'Error',             color: '#e5484d',     icon: <WarningOutlined /> },
}

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  queued:    { label: 'En cola',    color: 'default' },
  running:   { label: 'Ejecutando', color: 'processing' },
  succeeded: { label: 'Finalizado', color: '#2ea172' },
  failed:    { label: 'Error',      color: '#e5484d' },
}

function money(value: unknown) {
  const n = Number(value ?? 0) || 0
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}

function getErrorMessage(err: unknown, fallback: string) {
  const data = (err as any)?.response?.data
  const raw = data?.message ?? data?.error?.message ?? (err as any)?.message
  if (Array.isArray(raw)) return raw.join(' · ')
  return (typeof raw === 'string' && raw) ? raw : fallback
}

export default function DteSatVentasPage() {
  const navigate = useNavigate()
  const [documents,  setDocuments]  = useState<SatDteEmitidos[]>([])
  const [jobs,       setJobs]       = useState<SatEmitidosJob[]>([])
  const [stats,      setStats]      = useState<Record<string, { count: number; total: number }>>({})
  const [loading,    setLoading]    = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [syncingJob, setSyncingJob] = useState<string | null>(null)
  const [accounts,   setAccounts]   = useState<Account[]>([])
  const [taxes,      setTaxes]      = useState<Tax[]>([])
  const [estimates,  setEstimates]  = useState<Estimate[]>([])
  const [unidades,   setUnidades]   = useState<UnidadMedida[]>([])
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [page,         setPage]         = useState(1)
  const [total,        setTotal]        = useState(0)
  const PAGE_SIZE = 200
  const [satCredentials, setSatCredentials] = useState<{ satNit?: string }>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Stepper ────────────────────────────────────────────────────────────────
  const [stepperDte,     setStepperDte]     = useState<SatDteEmitidos | null>(null)
  const [stepperStep,    setStepperStep]    = useState(0)
  const [stepperLoading, setStepperLoading] = useState(false)
  const [stepperResult,  setStepperResult]  = useState<{ invoice: any; dte: SatDteEmitidos } | null>(null)
  const [stepperCustomer, setStepperCustomer] = useState<{ id: string; name: string; receivableAccountId?: string; incomeAccountId?: string; taxCode?: string; tdsEnabled?: boolean; tdsTaxCode?: string } | null>(null)
  const [stepperSuggestion, setStepperSuggestion] = useState<{ name?: string; taxId?: string } | null>(null)
  const [stepperIsAnulado,  setStepperIsAnulado]  = useState(false)
  const [stepperIsrTax,     setStepperIsrTax]     = useState<Tax | undefined>()
  const [stepperIsrAmount,  setStepperIsrAmount]  = useState(0)
  const [editingStepperIsr, setEditingStepperIsr] = useState(false)
  const [stepperForm]     = Form.useForm()
  const [customerForm]    = Form.useForm()
  const [originalInvoices, setOriginalInvoices] = useState<{ value: string; label: string }[]>([])

  // ── Batch (registro masivo) ────────────────────────────────────────────────
  type BatchRowStatus = 'pending' | 'processing' | 'ok' | 'skipped' | 'error'
  interface BatchRow {
    id: string; label: string; total: number; status: BatchRowStatus
    accountId?: string; accountLabel?: string
    taxId?: string; taxLabel?: string
    defaultUnit?: string
    accountingDate?: Dayjs
    result?: string; error?: string; missing?: string
  }
  const [batchOpen,    setBatchOpen]    = useState(false)
  const [batchRows,    setBatchRows]    = useState<BatchRow[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])

  const isBatchable = (dte: SatDteEmitidos) =>
    dte.status === 'ready' &&
    !['NCRE', 'NABN'].includes((dte.tipoDocumento ?? '').toUpperCase())

  // ── Carga inicial de catálogos ─────────────────────────────────────────────
  useEffect(() => {
    getAccounts({ isActive: true, limit: 500 })
      .then((res: any) => setAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
    getTaxes()
      .then((res: any) => {
        const list: Tax[] = Array.isArray(res) ? res : (res?.data ?? [])
        setTaxes(list.filter(t => t.applicability === 'sales' || t.applicability === 'both'))
      })
      .catch(() => {})
    getUnidadesActivas().then(setUnidades).catch(() => {})
    getOrganizationProfile()
      .then((p: any) => setSatCredentials({
        satNit: p?.settings?.satNit,
      }))
      .catch(() => {})
  }, [])

  // ── Cargar documentos / jobs / stats ──────────────────────────────────────
  const loadAll = useCallback(async (pageOverride?: number) => {
    setLoading(true)
    const currentPage = pageOverride ?? page
    try {
      const [docsRes, jobsRes, statsRes] = await Promise.all([
        getSatEmitidosDocuments({ page: currentPage, limit: PAGE_SIZE, search: search || undefined, status: statusFilter }),
        getSatEmitidosJobs({ page: 1, limit: 20 }),
        getSatEmitidosStats(),
      ])
      setDocuments(Array.isArray(docsRes) ? docsRes : (docsRes?.data ?? []))
      setTotal((docsRes as any)?.meta?.total ?? (docsRes as any)?.total ?? 0)
      setJobs(Array.isArray(jobsRes) ? jobsRes : (jobsRes?.data ?? []))
      setStats(statsRes ?? {})
    } catch {
      message.error('Error cargando bandeja DTE SAT Emitidos')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Polling para jobs en ejecución ────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued')
    if (runningJobs.length > 0) {
      pollRef.current = setInterval(async () => {
        for (const job of runningJobs) {
          try {
            await syncSatEmitidosJob(job.id)
          } catch {}
        }
        loadAll()
      }, POLL_INTERVAL_MS)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, loadAll])

  // ── Importar desde SAT ─────────────────────────────────────────────────────
  const [importForm] = Form.useForm()

  const handleImport = async (values: { range: [Dayjs, Dayjs] }) => {
    if (!satCredentials.satNit) {
      message.error('Configura el NIT SAT en Configuración → Configuración fiscal antes de importar')
      return
    }
    setImporting(true)
    try {
      const job = await startSatEmitidosImport({
        fechaInicio: values.range[0].format('YYYY-MM-DD'),
        fechaFin:    values.range[1].format('YYYY-MM-DD'),
      })
      message.success(`Importación SAT iniciada — Run APIFY: ${job.apifyRunId ?? job.id}`)
      loadAll()
    } catch (err) {
      message.error(getErrorMessage(err, 'No se pudo iniciar la importación'))
    } finally {
      setImporting(false)
    }
  }

  const handleSyncJob = async (jobId: string) => {
    setSyncingJob(jobId)
    try {
      await syncSatEmitidosJob(jobId)
      await loadAll()
    } catch (err) {
      message.error(getErrorMessage(err, 'Error sincronizando job'))
    } finally {
      setSyncingJob(null)
    }
  }

  const handleDeleteDte = (row: SatDteEmitidos) => {
    const hasInvoice = !!row.invoiceId
    Modal.confirm({
      title: 'Eliminar DTE de la bandeja',
      content: (
        <div>
          {hasInvoice && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 10, fontSize: 12 }}
              message="Este DTE ya fue contabilizado. La factura de venta NO se elimina — debes hacerlo manualmente desde Ventas → Facturas antes de reimportar."
            />
          )}
          <Text>¿Eliminar <Text strong>{row.nombreReceptor ?? row.nitReceptor}</Text> ({row.serie}/{row.numeroDte}) de la bandeja?</Text>
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
          await deleteSatEmitidos(row.id)
          message.success('DTE eliminado de la bandeja')
          await loadAll()
        } catch (err) {
          message.error(getErrorMessage(err, 'No se pudo eliminar el DTE'))
        }
      },
    })
  }

  const handleReactivate = (row: SatDteEmitidos) => {
    Modal.confirm({
      title: 'Reactivar DTE para re-procesarlo',
      content: (
        <div>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 10, fontSize: 12 }}
            message="Usa esta opción si eliminaste la factura vinculada y necesitas volver a contabilizarla."
          />
          <Text>¿Reactivar <Text strong>{row.nombreReceptor ?? row.nitReceptor}</Text> ({row.serie}/{row.numeroDte})?</Text>
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
          await reactivateSatEmitidos(row.id)
          message.success('DTE reactivado — ya puedes procesarlo nuevamente')
          await loadAll()
        } catch (err) {
          message.error(getErrorMessage(err, 'No se pudo reactivar el DTE'))
        }
      },
    })
  }

  // ── Preferencias por cliente (localStorage) ───────────────────────────────
  const saveDtePrefs = (customerId: string, vals: Record<string, any>) => {
    try {
      localStorage.setItem(`dte_prefs_${customerId}`, JSON.stringify({
        accountId: vals.accountId, taxId: vals.taxId, defaultUnit: vals.defaultUnit,
      }))
    } catch { /* silent */ }
  }

  // Carga prefs cuando el usuario llega al paso "Registrar" (step 2) y el cliente está vinculado.
  // Prioridad: fechaEmision siempre; localStorage para cuenta/impuesto/unidad → datos del cliente como fallback.
  useEffect(() => {
    if (stepperStep !== 2 || !stepperCustomer?.id) return
    const updates: Record<string, any> = {}

    // Siempre: fecha contable = fecha del documento DTE
    if (stepperDte?.fechaEmision) {
      updates.accountingDate = dayjs(stepperDte.fechaEmision)
    }

    try {
      const raw = localStorage.getItem(`dte_prefs_${stepperCustomer.id}`)
      if (raw) {
        Object.assign(updates, JSON.parse(raw))
      } else if (stepperCustomer.incomeAccountId || stepperCustomer.taxCode) {
        const matchedTax = stepperCustomer.taxCode
          ? taxes.find(t => t.code === stepperCustomer.taxCode)
          : undefined
        updates.accountId = stepperCustomer.incomeAccountId ?? undefined
        updates.taxId     = matchedTax?.id ?? undefined
      }
    } catch { /* silent */ }

    // Si aún no hay unidad: intentar detectarla del primer ítem del DTE
    if (!updates.defaultUnit && (stepperDte?.items as any[])?.length) {
      const firstItem = (stepperDte!.items as any[])[0]
      const rawUnit = firstItem?.unidad_medida ?? firstItem?.UnidadMedida ?? firstItem?.unidad ?? firstItem?.unit
      if (rawUnit) {
        const matched = unidades.find(u => u.code === String(rawUnit).toUpperCase())
        if (matched) updates.defaultUnit = matched.code
      }
    }

    // Concepto de la factura: prellenar notas con la descripción de los ítems del DTE
    // (así se confirma si es bien o servicio y queda como concepto del asiento).
    if (!updates.notes && (stepperDte?.items as any[])?.length) {
      const descs = (stepperDte!.items as any[])
        .map(it => it?.descripcion ?? it?.description ?? it?.desc ?? '')
        .map((s: any) => String(s).trim())
        .filter(Boolean)
      if (descs.length) updates.notes = descs.slice(0, 3).join(' · ').slice(0, 200)
    }

    if (Object.keys(updates).length > 0) stepperForm.setFieldsValue(updates)
  }, [stepperStep, stepperCustomer?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando el DTE ya tiene cliente vinculado (openStepper solo guarda id+name),
  // auto-resolve al llegar al step 1 para traer receivableAccountId, incomeAccountId y taxCode.
  useEffect(() => {
    if (stepperStep !== 1 || !stepperDte?.customerId) return
    if (stepperCustomer?.receivableAccountId !== undefined) return // ya resuelto
    setStepperLoading(true)
    resolveSatEmitidosCustomer(stepperDte.id)
      .then((res: any) => {
        if (res.found) {
          setStepperCustomer({
            id:                  res.customer.id,
            name:                res.customer.name,
            receivableAccountId: res.customer.receivableAccountId,
            incomeAccountId:     res.customer.incomeAccountId,
            taxCode:             res.customer.taxCode,
            tdsEnabled:          res.customer.tdsEnabled,
            tdsTaxCode:          res.customer.tdsTaxCode,
          })
        }
      })
      .catch(() => {})
      .finally(() => setStepperLoading(false))
  }, [stepperStep, stepperDte?.customerId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcular ISR cuando cambia el cliente del stepper o el DTE
  useEffect(() => {
    if (!stepperCustomer?.tdsEnabled || !stepperCustomer.tdsTaxCode || !stepperDte) {
      setStepperIsrTax(undefined)
      setStepperIsrAmount(0)
      return
    }
    const isrTax = taxes.find(t => t.code === stepperCustomer.tdsTaxCode && t.isWithholding)
    if (!isrTax) { setStepperIsrTax(undefined); setStepperIsrAmount(0); return }
    setStepperIsrTax(isrTax)
    const base = Math.round(Number(stepperDte.subtotal ?? 0) * 100) / 100
    if (base <= 0) { setStepperIsrAmount(0); return }
    let isrAmt = 0
    if (isrTax.tiers && Array.isArray(isrTax.tiers) && isrTax.tiers.length > 0) {
      let remaining = base
      for (const tier of isrTax.tiers) {
        const chunk = tier.upTo != null ? Math.min(remaining, Math.max(0, tier.upTo - (base - remaining))) : remaining
        isrAmt += Math.round(chunk * (tier.rate / 100) * 100) / 100
        remaining -= chunk
        if (remaining <= 0) break
      }
    } else {
      isrAmt = Math.round(base * ((isrTax.rate ?? 0) / 100) * 100) / 100
    }
    setStepperIsrAmount(isrAmt)
  }, [stepperCustomer?.tdsEnabled, stepperCustomer?.tdsTaxCode, stepperDte?.id, taxes])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abrir stepper ──────────────────────────────────────────────────────────
  const openStepper = (dte: SatDteEmitidos) => {
    setStepperDte(dte)
    setStepperStep(0)
    setStepperResult(null)
    setStepperIsAnulado(false)
    setStepperCustomer(dte.customerId ? { id: dte.customerId, name: dte.nombreReceptor ?? '' } : null)
    setStepperSuggestion(null)
    stepperForm.resetFields()
    customerForm.resetFields()
  }

  const closeStepper = () => {
    setStepperDte(null)
    setStepperStep(0)
    setStepperResult(null)
    setStepperIsAnulado(false)
    setStepperCustomer(null)
    setStepperSuggestion(null)
    stepperForm.resetFields()
    customerForm.resetFields()
  }

  // ── Step 1: Resolver cliente ───────────────────────────────────────────────
  const handleResolveCustomer = async () => {
    if (!stepperDte) return
    setStepperLoading(true)
    try {
      const res: any = await resolveSatEmitidosCustomer(stepperDte.id)
      if (res.found) {
        setStepperCustomer({
          id:                  res.customer.id,
          name:                res.customer.name,
          receivableAccountId: res.customer.receivableAccountId,
          incomeAccountId:     res.customer.incomeAccountId,
          taxCode:             res.customer.taxCode,
          tdsEnabled:          res.customer.tdsEnabled,
          tdsTaxCode:          res.customer.tdsTaxCode,
        })
        setDocuments(prev => prev.map(d => d.id === stepperDte.id ? { ...d, ...res.dte } : d))
        message.success(`Cliente vinculado: ${res.customer.name}`)
      } else {
        setStepperSuggestion(res.suggestion)
        customerForm.setFieldsValue({
          name:     res.suggestion?.name ?? '',
          legalName: res.suggestion?.name ?? '',
          taxId:    res.suggestion?.taxId ?? '',
        })
        message.warning('Cliente no encontrado. Puedes crearlo con los datos del DTE.')
      }
    } catch (err) {
      message.error(getErrorMessage(err, 'Error resolviendo cliente'))
    } finally {
      setStepperLoading(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!stepperDte) return
    const vals = customerForm.getFieldsValue()
    setStepperLoading(true)
    try {
      const res: any = await createSatEmitidosCustomer(stepperDte.id, {
        name:               vals.name,
        legalName:          vals.legalName ?? vals.name,
        currency:           'GTQ',
        paymentTerms:       vals.paymentTerms,
        receivableAccountId: vals.receivableAccountId,
        incomeAccountId:    vals.incomeAccountId,
        taxCode:            vals.taxCode,
      })
      setStepperCustomer({ id: res.customer.id, name: res.customer.name, receivableAccountId: vals.receivableAccountId, incomeAccountId: vals.incomeAccountId, taxCode: vals.taxCode })
      setDocuments(prev => prev.map(d => d.id === stepperDte.id ? { ...d, ...res.dte } : d))
      // Pre-llenar paso Registrar: cuenta de ingresos + taxId (UUID) que corresponde al código seleccionado
      if (res.customer.id) {
        const matchedTax = taxes.find(t => t.code === vals.taxCode)
        saveDtePrefs(res.customer.id, {
          accountId: vals.incomeAccountId,
          taxId:     matchedTax?.id,
        })
      }
      message.success(`Cliente ${res.created ? 'creado' : 'vinculado'}: ${res.customer.name}`)
    } catch (err) {
      message.error(getErrorMessage(err, 'Error creando cliente'))
    } finally {
      setStepperLoading(false)
    }
  }

  // ── Step 2: Contabilizar ───────────────────────────────────────────────────
  const handlePost = async () => {
    if (!stepperDte) return
    const vals = stepperForm.getFieldsValue()
    const isNC = ['NCRE', 'NABN'].includes((stepperDte.tipoDocumento ?? '').toUpperCase())
    if (!vals.accountId) { message.warning(isNC ? 'Selecciona la cuenta de NC' : 'Selecciona la cuenta de ingreso'); return }
    if (isNC && !vals.creditNoteReason) { message.warning('Ingresa el motivo de la nota de crédito'); return }

    setStepperLoading(true)
    try {
      const res = await postSatEmitidos(stepperDte.id, {
        accountId:              vals.accountId,
        taxId:                  stepperIsAnulado ? undefined : vals.taxId,
        accountingDate:         vals.accountingDate ? dayjs(vals.accountingDate).format('YYYY-MM-DD') : undefined,
        notes:                  vals.notes,
        estimateId:             vals.estimateId,
        defaultUnit:            vals.defaultUnit,
        creditNoteReason:       isNC ? vals.creditNoteReason : undefined,
        originalInvoiceId:      isNC ? vals.originalInvoiceId : undefined,
        isrRetentionAmount:     (!stepperIsAnulado && stepperIsrAmount > 0) ? stepperIsrAmount : undefined,
        isrRetentionAccountId:  (!stepperIsAnulado && stepperIsrAmount > 0) ? (stepperIsrTax?.salesAccountId ?? undefined) : undefined,
        forceZeroAmount:        stepperIsAnulado || undefined,
      })
      // Guardar preferencias para próximas facturas del mismo cliente
      if (stepperCustomer?.id) saveDtePrefs(stepperCustomer.id, vals)
      setStepperResult(res)
      setDocuments(prev => prev.map(d => d.id === stepperDte.id ? { ...d, ...res.dte } : d))
      setStepperStep(3)
    } catch (err) {
      message.error(getErrorMessage(err, 'Error contabilizando DTE'))
    } finally {
      setStepperLoading(false)
    }
  }

  // Cargar estimaciones cuando se selecciona un cliente en step 2
  const loadEstimates = (customerId: string) => {
    getEstimates({ search: customerId, limit: 50, status: 'accepted' })
      .then((res: any) => setEstimates(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }

  const loadOriginalInvoices = (customerId: string) => {
    getInvoices({ customerId, limit: 100 })
      .then(res => {
        const list = res?.data ?? []
        setOriginalInvoices(
          list
            .filter((inv: any) => inv.type !== 'credit_note' && inv.type !== 'advance')
            .map((inv: any) => ({
              value: inv.id,
              label: `${inv.invoiceNumber} — Q ${Number(inv.total ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${inv.status})`,
            }))
        )
      })
      .catch(() => {})
  }

  // ── Batch: abrir modal ────────────────────────────────────────────────────
  const openBatchModal = async () => {
    const selected = documents.filter(d => selectedIds.includes(d.id) && isBatchable(d))
    if (selected.length === 0) { message.warning('Selecciona al menos un DTE Listo para registrar en masa'); return }
    setBatchLoading(true)
    setBatchOpen(true)
    const rows: BatchRow[] = []
    for (const d of selected) {
      let accountId: string | undefined
      let taxId: string | undefined
      let savedDefaultUnit: string | undefined
      // 1. Preferencias guardadas
      if (d.customerId) {
        try {
          const raw = localStorage.getItem(`dte_prefs_${d.customerId}`)
          if (raw) { const p = JSON.parse(raw); accountId = p.accountId; taxId = p.taxId; savedDefaultUnit = p.defaultUnit }
        } catch {}
      }
      // 2. Datos maestros del cliente como fallback
      if (d.customerId && (!accountId || !taxId)) {
        try {
          const { getCustomer } = await import('../../../api/contactos')
          const c = await getCustomer(d.customerId) as any
          if (!accountId && c?.incomeAccountId) accountId = c.incomeAccountId
          if (!taxId && c?.taxCode) {
            const matched = taxes.find(t => t.code === c.taxCode)
            if (matched) taxId = matched.id
          }
        } catch {}
      }
      const accObj = incomeAccounts.find(a => a.id === accountId)
      const taxObj = taxes.find(t => t.id === taxId)
      // Unidad: detectar del primer ítem del DTE (SAT trae bien/servicio + unidad) para agilizar.
      const firstItem = (d.items as any[] | undefined)?.[0]
      const rawUnit = firstItem?.unidad_medida ?? firstItem?.UnidadMedida ?? firstItem?.unidad ?? firstItem?.unit
      const detectedUnit = savedDefaultUnit ?? (rawUnit ? unidades.find(u => u.code === String(rawUnit).toUpperCase())?.code : undefined)
      rows.push({
        id: d.id,
        label: `${d.nombreReceptor ?? d.nitReceptor ?? '—'} · ${d.serie}/${d.numeroDte}`,
        total: Number(d.total ?? 0),
        status: 'pending',
        accountId,
        accountLabel: accObj ? `${accObj.code} — ${accObj.name}` : accountId ? '(cuenta configurada)' : undefined,
        taxId,
        taxLabel: taxObj ? (taxObj.subtype === 'exempt' ? `Exento — ${taxObj.name}` : `${Number(taxObj.rate)}% — ${taxObj.name}`) : undefined,
        defaultUnit: detectedUnit,
        // Fecha contable = fecha de emisión de la factura (no la de hoy).
        accountingDate: d.fechaEmision ? dayjs(d.fechaEmision) : dayjs(),
        missing: !accountId ? 'Falta cuenta de ingreso — configúrala en el maestro del cliente' : undefined,
      })
    }
    setBatchRows(rows)
    setBatchLoading(false)
  }

  // ── Batch: procesar en masa ───────────────────────────────────────────────
  const handleBatchPost = async () => {
    const processable = batchRows.filter(r => !r.missing && r.accountId)
    if (!processable.length) { message.error('Ningún DTE tiene datos completos para procesar'); return }
    setBatchRunning(true)
    for (const row of batchRows) {
      if (row.missing || !row.accountId) continue
      setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'processing' } : r))
      try {
        const res = await postSatEmitidos(row.id, {
          accountId:      row.accountId,
          taxId:          row.taxId,
          defaultUnit:    row.defaultUnit,
          accountingDate: row.accountingDate?.format('YYYY-MM-DD'),
        })
        const invoiceNumber = (res as any)?.invoice?.invoiceNumber ?? ''
        const dte = documents.find(d => d.id === row.id)
        if (dte?.customerId) saveDtePrefs(dte.customerId, { accountId: row.accountId, taxId: row.taxId })
        setBatchRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, status: 'ok', result: invoiceNumber } : r))
      } catch (err) {
        const errMsg = getErrorMessage(err, 'Error al registrar')
        const alreadyExists = errMsg.includes('Ya existe')
        setBatchRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, status: alreadyExists ? 'skipped' : 'error', error: alreadyExists ? 'Esta factura ya estaba registrada' : errMsg } : r))
      }
    }
    setBatchRunning(false)
    setSelectedIds([])
    await loadAll()
  }

  const incomeAccounts = accounts.filter(a => {
    const code = a.code ?? ''
    return code.startsWith('4') || a.balanceType?.toLowerCase().includes('ingreso')
  })

  // ─── Tabla de documentos ───────────────────────────────────────────────────
  const cols: ColumnsType<SatDteEmitidos> = [
    {
      title: 'Fecha',
      dataIndex: 'fechaEmision',
      width: 95,
      defaultSortOrder: 'descend' as const,
      sorter: (a, b) => String(a.fechaEmision ?? '').localeCompare(String(b.fechaEmision ?? '')),
      render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v ? String(v).substring(0, 10) : '—'}</Text>,
    },
    {
      title: 'Tipo / Serie / No.',
      key: 'serie',
      width: 160,
      render: (_: unknown, r: SatDteEmitidos) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
          <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '18px', flexShrink: 0 }}>
            {r.tipoDocumento ?? 'FACT'}
          </Tag>
          <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {r.serie ?? '—'} / {r.numeroDte ?? '—'}
          </Text>
        </span>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      width: 320,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', cursor: 'default' }}>
            {v?.slice(0, 30)}…
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Receptor (Cliente)',
      key: 'receptor',
      ellipsis: true,
      render: (_: unknown, r: SatDteEmitidos) => (
        <div>
          <Text strong style={{ fontSize: 12, display: 'block' }}>{r.nombreReceptor ?? 'Sin nombre'}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>NIT: {r.nitReceptor ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 115,
      align: 'right' as const,
      sorter: (a, b) => Number(a.total) - Number(b.total),
      render: (v: number) => <Text strong style={{ fontSize: 12 }}>{money(v)}</Text>,
    },
    {
      title: 'Proceso',
      width: 150,
      render: (_: unknown, r: SatDteEmitidos) => {
        if (r.status === 'error') return (
          <Tag color="#e5484d" icon={<WarningOutlined />} style={{ fontSize: 10 }}>Error</Tag>
        )
        if (r.status === 'duplicate') return (
          <Tag color="volcano" icon={<FileTextOutlined />} style={{ fontSize: 10 }}>Duplicado</Tag>
        )
        const s1 = true
        const s2 = !!r.customerId
        const s3 = !!r.invoiceId
        const s4 = r.status === 'posted'
        const steps = [
          { done: s1, tip: 'Importado desde SAT' },
          { done: s2, tip: s2 ? 'Cliente vinculado' : 'Cliente pendiente' },
          { done: s3, tip: s3 ? 'Venta registrada' : 'Sin registrar' },
          { done: s4, tip: s4 ? 'Contabilizado ✓' : 'Sin contabilizar', last: true },
        ]
        const label = s4 ? 'Contabilizado ✓' : s3 ? 'Registrado' : s2 ? 'Listo' : 'Cliente pendiente'
        return (
          <div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}>
              {steps.map((step, i) => (
                <Tooltip key={i} title={step.tip}>
                  <span style={{ fontSize: 13, lineHeight: 1, cursor: 'default',
                    color: step.done ? (step.last ? '#2ea172' : '#1faec2') : '#d1d5db' }}>
                    {step.done ? '●' : '○'}
                  </span>
                </Tooltip>
              ))}
            </div>
            <Text type={s4 ? undefined : 'secondary'} style={{ fontSize: 10, color: s4 ? '#2ea172' : undefined }}>
              {label}
            </Text>
          </div>
        )
      },
    },
    {
      title: 'Archivos',
      width: 90,
      render: (_: unknown, r: SatDteEmitidos) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.xmlKey
            ? <DocumentLink documentKey={r.xmlKey} docType="fel-xml" label="XML" />
            : r.xmlUrl
              ? <Tooltip title="XML descargado del SAT (temporal)">
                  <a href={r.xmlUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>XML ↗</a>
                </Tooltip>
              : <Text type="secondary" style={{ fontSize: 12 }}>XML</Text>}
          {r.pdfKey
            ? <DocumentLink documentKey={r.pdfKey} docType="fel-pdf" label="PDF" />
            : r.pdfUrl
              ? <Tooltip title="PDF descargado del SAT (temporal)">
                  <a href={r.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>PDF ↗</a>
                </Tooltip>
              : <Text type="secondary" style={{ fontSize: 12 }}>PDF</Text>}
        </div>
      ),
    },
    {
      title: 'Acción',
      key: 'actions',
      width: 145,
      fixed: 'right' as const,
      render: (_: unknown, r: SatDteEmitidos) => (
        <Space size={4}>
          {r.status === 'posted'
            ? <Tooltip title="Ver factura y póliza contable">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => r.invoiceId && navigate(`/ventas/facturas/${r.invoiceId}`)}
                  style={{ fontSize: 11, borderColor: '#1faec2', color: '#1faec2' }}
                >
                  Ver factura
                </Button>
              </Tooltip>
            : r.status === 'duplicate'
              ? <Tag color="volcano" style={{ fontSize: 10 }}>Duplicado</Tag>
              : <Button
                  size="small"
                  type="primary"
                  icon={<BookOutlined />}
                  onClick={() => openStepper(r)}
                  style={{ fontSize: 11, background: '#1faec2' }}
                >
                  Procesar
                </Button>
          }
          {r.status === 'posted' && (
            <Tooltip title="Re-procesar — usar si la factura vinculada fue eliminada">
              <Button
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => handleReactivate(r)}
                style={{ fontSize: 11, color: '#7c3aed', borderColor: '#c4b5fd' }}
              />
            </Tooltip>
          )}
          <Tooltip title="Eliminar de la bandeja">
            <Button size="small" danger icon={<DeleteOutlined />}
              onClick={() => handleDeleteDte(r)} style={{ fontSize: 11 }} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // ─── Tabla de jobs ─────────────────────────────────────────────────────────
  const jobCols: ColumnsType<SatEmitidosJob> = [
    {
      title: 'Iniciado',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'}</Text>,
    },
    {
      title: 'Rango',
      key: 'range',
      render: (_: unknown, r: SatEmitidosJob) => (
        <Text style={{ fontSize: 11 }}>
          {r.fechaInicio ? String(r.fechaInicio).substring(0, 10) : ''} → {r.fechaFin ? String(r.fechaFin).substring(0, 10) : ''}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => {
        const cfg = jobStatusConfig[v] ?? { label: v, color: 'default' }
        return <Badge status={cfg.color as any} text={cfg.label} />
      },
    },
    {
      title: 'Importados',
      dataIndex: 'importedCount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v ?? 0}</Text>,
    },
    {
      title: 'Duplicados',
      dataIndex: 'duplicateCount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v ?? 0}</Text>,
    },
    {
      title: '',
      key: 'sync',
      width: 80,
      render: (_: unknown, r: SatEmitidosJob) =>
        r.status === 'running' || r.status === 'queued' ? (
          <Button
            size="small"
            icon={<CloudSyncOutlined />}
            loading={syncingJob === r.id}
            onClick={() => handleSyncJob(r.id)}
          >
            Sync
          </Button>
        ) : null,
    },
  ]

  const hasRunningJobs = jobs.some(j => j.status === 'running' || j.status === 'queued')
  const pendingToProcess = (stats.pending?.count ?? 0) + (stats.ready?.count ?? 0)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* ─── Stepper Modal ────────────────────────────────────────────────── */}
      <Modal
        open={!!stepperDte}
        width={660}
        title={null}
        footer={null}
        closable
        maskClosable={false}
        onCancel={closeStepper}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
      >
        {stepperDte && (
          <div>
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <Text strong style={{ fontSize: 14 }}>{stepperDte.nombreReceptor ?? '—'}</Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>NIT: {stepperDte.nitReceptor}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {stepperDte.tipoDocumento ?? 'FACT'} · {stepperDte.serie ?? '—'}/{stepperDte.numeroDte ?? '—'}
                  </Text>
                </div>
                {stepperIsAnulado
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StopOutlined style={{ color: '#dc2626', fontSize: 14 }} />
                      <Text strong style={{ fontSize: 16, color: '#dc2626' }}>Q0.00 ANULADA</Text>
                    </span>
                  : <Text strong style={{ fontSize: 18, color: '#1faec2' }}>{money(stepperDte.total)}</Text>
                }
              </div>
              <Steps current={stepperStep} size="small" style={{ marginBottom: 14 }} items={[
                { title: 'DTE' },
                { title: 'Cliente' },
                { title: 'Registrar' },
                { title: 'Listo' },
              ]} />
              <Divider style={{ margin: '0 0 16px' }} />
            </div>

            <div style={{ padding: '0 24px 8px', minHeight: 200 }}>
              {/* ── Step 0: Detalle del DTE ── */}
              {stepperStep === 0 && (() => {
                const isNC0 = ['NCRE', 'NABN'].includes((stepperDte.tipoDocumento ?? '').toUpperCase())
                return (
                <>
                {isNC0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
                    <strong>Nota de Crédito SAT</strong> — Este DTE ({stepperDte.tipoDocumento}) se registrará como Nota de Crédito (NC-XXXX).
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
                    description="Se creará el registro para cumplimiento legal/fiscal, pero no generará saldo en el cliente ni ingreso contable. No aplica ISR."
                  />
                )}
                <Descriptions size="small" column={2} style={{ background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                  <Descriptions.Item label="Tipo">{stepperDte.tipoDocumento ?? 'FACT'}</Descriptions.Item>
                  <Descriptions.Item label="Fecha">
                    {stepperDte.fechaEmision ? String(stepperDte.fechaEmision).substring(0, 10) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Serie">{stepperDte.serie ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="No. DTE">{stepperDte.numeroDte ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Receptor (Cliente)" span={2}>
                    <Text strong>{stepperDte.nombreReceptor ?? '—'}</Text>
                    {stepperDte.nitReceptor && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>NIT: {stepperDte.nitReceptor}</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Subtotal">{money(stepperDte.subtotal)}</Descriptions.Item>
                  <Descriptions.Item label="IVA">{money(stepperDte.totalIva)}</Descriptions.Item>
                  <Descriptions.Item label="Total" span={2}>
                    <Text strong style={{ fontSize: 14, color: '#1faec2' }}>{money(stepperDte.total)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Archivos" span={2}>
                    <Space size={16}>
                      {stepperDte.xmlKey
                        ? <DocumentLink documentKey={stepperDte.xmlKey} docType="fel-xml" label="XML" />
                        : stepperDte.xmlUrl
                          ? <a href={stepperDte.xmlUrl} target="_blank" rel="noreferrer">XML ↗</a>
                          : <Text type="secondary">XML</Text>}
                      {stepperDte.pdfKey
                        ? <DocumentLink documentKey={stepperDte.pdfKey} docType="fel-pdf" label="PDF" />
                        : stepperDte.pdfUrl
                          ? <a href={stepperDte.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>PDF ↗</a>
                          : <a href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${stepperDte.uuid}`} target="_blank" rel="noreferrer" style={{ color: '#ff7f00' }}>Ver en SAT ↗</a>}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
                </>
                )
              })()}

              {/* ── Step 1: Resolver cliente ── */}
              {stepperStep === 1 && (
                stepperCustomer ? (
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                      <CheckCircleOutlined style={{ fontSize: 44, color: '#2ea172', display: 'block', marginBottom: 10 }} />
                      <Text strong style={{ fontSize: 15 }}>Cliente vinculado</Text>
                      <br />
                      <Text type="secondary">{stepperCustomer.name} · NIT: {stepperDte.nitReceptor}</Text>
                    </div>
                    {!stepperCustomer.receivableAccountId && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ fontSize: 12 }}
                        message="Este cliente no tiene Cuenta CxC configurada"
                        description="La póliza contable no podrá generarse automáticamente. Configura la cuenta en el maestro de clientes antes de continuar, o crea el cliente desde DTE SAT para poder configurarla ahora."
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    <Alert type="warning" showIcon style={{ marginBottom: 14, fontSize: 12 }}
                      message={`NIT ${stepperDte.nitReceptor} no está registrado. Búscalo o créalo.`} />
                    <Button icon={<SearchOutlined />} loading={stepperLoading} style={{ marginBottom: 14 }}
                      onClick={handleResolveCustomer}>
                      Buscar cliente por NIT {stepperDte.nitReceptor}
                    </Button>
                    {stepperSuggestion && (
                      <>
                        <Divider plain style={{ fontSize: 12 }}>o crear nuevo cliente</Divider>
                        <Form form={customerForm} layout="vertical" size="small">
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item label="Nombre comercial" name="name" rules={[{ required: true }]}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Razón social" name="legalName">
                                <Input />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item label="NIT">
                                <Input value={stepperDte.nitReceptor ?? ''} disabled />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="paymentTerms" label="Términos de pago">
                                <Select placeholder="Neto 30 días"
                                  options={Object.entries(PAYMENT_TERMS_CONFIG).map(([k, v]) => ({ value: k, label: v }))} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Divider plain style={{ fontSize: 11, margin: '8px 0' }}>Cuentas contables (requeridas para póliza automática)</Divider>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                label="Cuenta por cobrar (CxC)"
                                name="receivableAccountId"
                                rules={[{ required: true, message: 'Requerida para generar póliza' }]}
                                tooltip="Se usará como débito en la póliza de venta">
                                <Select
                                  showSearch
                                  allowClear
                                  placeholder="Ej: 1130 — Clientes"
                                  optionFilterProp="label"
                                  options={accounts
                                    .filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('1')))
                                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                label="Cuenta de ingresos"
                                name="incomeAccountId"
                                tooltip="Crédito en póliza de venta. Si se omite, se selecciona en el paso siguiente.">
                                <Select
                                  showSearch
                                  allowClear
                                  placeholder="Ej: 4110 — Ingresos por Ventas"
                                  optionFilterProp="label"
                                  options={accounts
                                    .filter(a => !a.isHeader && a.isActive && (a.code?.startsWith('4') || a.balanceType?.toLowerCase().includes('ingreso')))
                                    .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item
                            label="Impuesto IVA"
                            name="taxCode"
                            tooltip="Se guardará en el maestro de cliente y se pre-llenará al registrar la factura">
                            <Select
                              allowClear
                              placeholder="Selecciona impuesto IVA"
                              options={taxes.map(t => ({ value: t.code, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))}
                            />
                          </Form.Item>
                          <Button type="primary" icon={<UserAddOutlined />} loading={stepperLoading}
                            onClick={handleCreateCustomer}>
                            Crear y vincular cliente
                          </Button>
                        </Form>
                      </>
                    )}
                  </div>
                )
              )}

              {/* ── Step 2: Registrar venta ── */}
              {stepperStep === 2 && (() => {
                const isNC2 = ['NCRE', 'NABN'].includes((stepperDte?.tipoDocumento ?? '').toUpperCase())
                return (
                <Form form={stepperForm} layout="vertical" size="small">
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
                  {isNC2 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                      <strong>Nota de Crédito</strong> — Se creará como NC-XXXX con saldo acreditado al cliente.
                    </div>
                  )}
                  {!stepperCustomer?.receivableAccountId && !isNC2 && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ fontSize: 12, marginBottom: 12 }}
                      message="Sin Cuenta CxC — la póliza no se generará"
                      description={<>Para generar la póliza contable, configura la cuenta CxC del cliente en <strong>Ventas → Clientes</strong> y luego usa <em>"Recalcular partida contable"</em> en la factura generada.</>}
                    />
                  )}
                  {isNC2 && (
                    <>
                    <Form.Item label="Factura original que se acredita (opcional)" name="originalInvoiceId">
                      <Select allowClear showSearch placeholder="Buscar factura del cliente..."
                        optionFilterProp="label"
                        options={originalInvoices}
                        notFoundContent={originalInvoices.length === 0 ? 'Sin facturas — se puede vincular después' : 'No encontrada'} />
                    </Form.Item>
                    <Form.Item label="Motivo de la Nota de Crédito" name="creditNoteReason"
                      rules={[{ required: true, message: 'Describe el motivo de la NC' }]}>
                      <Input.TextArea rows={2} placeholder="Ej: Devolución de mercadería defectuosa" />
                    </Form.Item>
                    </>
                  )}
                  <Row gutter={12}>
                    <Col span={14}>
                      <Form.Item label={isNC2 ? 'Cuenta contable NC' : 'Cuenta de Ingreso'} name="accountId"
                        rules={[{ required: true, message: isNC2 ? 'Selecciona cuenta de NC' : 'Selecciona cuenta de ingreso' }]}>
                        <Select
                          showSearch
                          placeholder="Buscar cuenta..."
                          options={incomeAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={10}>
                      <Form.Item label="Impuesto" name="taxId">
                        <Select allowClear placeholder="IVA 12%..."
                          options={taxes.map(t => ({ value: t.id, label: t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}` }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Fecha contable" name="accountingDate">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Unidad de medida" name="defaultUnit">
                        <Select allowClear placeholder="UND..."
                          options={unidades.map(u => ({ value: u.code, label: `${u.code} — ${u.name}` }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {!isNC2 && estimates.length > 0 && (
                    <Form.Item label="Vincular cotización (opcional)" name="estimateId">
                      <Select allowClear placeholder="Seleccionar cotización..."
                        options={estimates.map(e => ({
                          value: e.id,
                          label: `${(e as any).estimateNumber ?? e.id} — Q ${Number((e as any).total ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
                        }))} />
                    </Form.Item>
                  )}
                  {!isNC2 && !stepperIsAnulado && stepperIsrTax && stepperIsrAmount > 0 && (
                    <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#5b21b6', fontWeight: 600 }}>ISR Retención ({stepperIsrTax.name})</span>
                        {editingStepperIsr ? (
                          <Space size={4}>
                            <input
                              type="number"
                              defaultValue={stepperIsrAmount}
                              style={{ width: 90, padding: '2px 6px', border: '1px solid #c4b5fd', borderRadius: 4, fontSize: 12 }}
                              onBlur={e => { setStepperIsrAmount(Math.max(0, Number(e.target.value))); setEditingStepperIsr(false) }}
                              autoFocus
                            />
                            <Button size="small" type="link" style={{ padding: 0, color: '#7c3aed' }} onClick={() => setEditingStepperIsr(false)}>Aceptar</Button>
                          </Space>
                        ) : (
                          <Space size={4}>
                            <span style={{ fontSize: 12, color: '#5b21b6' }}>Q {stepperIsrAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                            <Button size="small" type="link" style={{ padding: 0, color: '#7c3aed', fontSize: 11 }} onClick={() => setEditingStepperIsr(true)}>Editar</Button>
                          </Space>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #c4b5fd' }}>
                        <span style={{ fontSize: 11, color: '#7c3aed' }}>Neto a Cobrar</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6' }}>Q {(Number(stepperDte?.total ?? 0) - stepperIsrAmount).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                  <Form.Item label="Concepto de la factura" name="notes"
                    tooltip="Se prellena con la descripción de los ítems del DTE — confirma si es bien o servicio. Se guarda como concepto del asiento.">
                    <Input.TextArea rows={2} placeholder="Concepto / descripción del bien o servicio..." />
                  </Form.Item>
                </Form>
                )
              })()}

              {/* ── Step 3: Éxito ── */}
              {stepperStep === 3 && stepperResult && (() => {
                const isNC3 = ['NCRE', 'NABN'].includes((stepperDte?.tipoDocumento ?? '').toUpperCase())
                const invoiceNumber = (stepperResult.invoice as any)?.invoiceNumber ?? ''
                const invoiceId = (stepperResult.invoice as any)?.id
                return (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  {stepperIsAnulado
                    ? <StopOutlined style={{ fontSize: 52, color: '#dc2626', marginBottom: 14 }} />
                    : <CheckCircleOutlined style={{ fontSize: 52, color: '#2ea172', marginBottom: 14 }} />
                  }
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>
                    {stepperIsAnulado ? 'DTE Registrado como ANULADO' : 'DTE Procesado Correctamente'}
                  </Text>
                  <div style={{
                    background: stepperIsAnulado ? '#fff1f0' : '#e8f5ef',
                    border: `1px solid ${stepperIsAnulado ? '#fca5a5' : '#c3e5d8'}`,
                    borderRadius: 8, padding: '12px 32px', display: 'inline-block', textAlign: 'left', marginTop: 8,
                  }}>
                    <div>
                      <Text type="secondary">{isNC3 ? 'Nota de Crédito:' : 'Factura:'}</Text>{' '}
                      <Text strong>{invoiceNumber}</Text>
                    </div>
                    {(stepperResult.invoice as any)?.journalEntryId && (
                      <div><Text type="secondary">Póliza:</Text> <Text strong style={{ color: '#2ea172' }}>Generada automáticamente</Text></div>
                    )}
                    <div>
                      <Text type="secondary">Total registrado:</Text>{' '}
                      <Text strong style={{ color: stepperIsAnulado ? '#dc2626' : undefined }}>
                        {stepperIsAnulado ? 'Q0.00 (ANULADA)' : money(stepperDte?.total)}
                      </Text>
                    </div>
                  </div>
                  {isNC3 && invoiceId && (
                    <div style={{ marginTop: 12 }}>
                      <Button type="link" onClick={() => { navigate(`/ventas/notas-credito/${invoiceId}`); closeStepper() }}>
                        Ver Nota de Crédito →
                      </Button>
                    </div>
                  )}
                </div>
                )
              })()}
            </div>

            {/* Footer navegación */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(10,10,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                onClick={() => { if (stepperStep > 0) setStepperStep(s => s - 1); else closeStepper() }}
                disabled={stepperStep === 3 || stepperLoading}
              >
                {stepperStep === 0 ? 'Cancelar' : '← Anterior'}
              </Button>
              <Space>
                {stepperStep === 0 && (
                  <Button type="primary" style={{ background: '#1faec2' }} onClick={() => setStepperStep(1)}>
                    Siguiente →
                  </Button>
                )}
                {stepperStep === 1 && (
                  <Tooltip title={stepperCustomer && !stepperCustomer.receivableAccountId
                    ? 'Configura la Cuenta CxC del cliente antes de continuar'
                    : undefined}>
                    <Button type="primary" style={{ background: '#1faec2' }}
                      disabled={!stepperCustomer || !stepperCustomer.receivableAccountId || stepperLoading}
                      onClick={() => {
                        if (stepperCustomer) {
                          const isNC = ['NCRE', 'NABN'].includes((stepperDte?.tipoDocumento ?? '').toUpperCase())
                          loadEstimates(stepperCustomer.id)
                          if (isNC) loadOriginalInvoices(stepperCustomer.id)
                          setStepperStep(2)
                        }
                      }}>
                      Siguiente →
                    </Button>
                  </Tooltip>
                )}
                {stepperStep === 2 && (
                  <Button type="primary" icon={<BookOutlined />} loading={stepperLoading}
                    style={{ background: '#1faec2' }} onClick={handlePost}>
                    Registrar y Contabilizar
                  </Button>
                )}
                {stepperStep === 3 && (
                  <Space>
                    <Button onClick={() => {
                      const next = documents.find(d => (d.status === 'pending' || d.status === 'ready') && d.id !== stepperDte?.id)
                      if (next) openStepper(next)
                      else closeStepper()
                    }}>
                      Procesar siguiente DTE
                    </Button>
                    <Button type="primary" style={{ background: '#1faec2' }} onClick={closeStepper}>
                      Cerrar
                    </Button>
                  </Space>
                )}
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Batch Modal ──────────────────────────────────────────────────── */}
      {(() => {
        const allDone = batchRows.length > 0 && batchRows.every(r => r.status === 'ok' || r.status === 'skipped' || r.status === 'error' || !!r.missing)
        const canProcess = !batchRunning && batchRows.some(r => !r.missing && r.accountId && r.status === 'pending')
        return (
        <Modal
          open={batchOpen}
          width={920}
          title={<Space><ThunderboltOutlined style={{ color: '#2ea172' }} />Registro masivo — {batchRows.length} DTE{batchRows.length > 1 ? 's' : ''}</Space>}
          footer={null}
          maskClosable={false}
          onCancel={() => { if (!batchRunning) { setBatchOpen(false); setBatchRows([]) } }}
          destroyOnClose
        >
          {batchLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin /><Text type="secondary" style={{ marginLeft: 8 }}>Cargando datos de clientes…</Text>
            </div>
          ) : (
            <>
              {/* Tabla con cuenta y unidad editables por fila */}
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 230 }}>Cliente / DTE</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 240 }}>Cuenta de ingreso</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 90 }}>Unidad</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, width: 120 }}>Fecha contable</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, fontSize: 11, width: 90 }}>Total</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, width: 110 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)', background: row.missing ? 'rgba(255,127,0,0.10)' : undefined }}>
                      <td style={{ padding: '6px 10px', wordBreak: 'break-word', whiteSpace: 'normal' }}><Text style={{ fontSize: 12 }}>{row.label}</Text></td>
                      <td style={{ padding: '4px 6px' }}>
                        {row.status === 'pending' ? (
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            showSearch
                            placeholder="Seleccionar cuenta…"
                            optionFilterProp="label"
                            value={row.accountId}
                            status={!row.accountId ? 'error' : undefined}
                            onChange={val => {
                              const acc = incomeAccounts.find(a => a.id === val)
                              setBatchRows(prev => prev.map(r => r.id === row.id
                                ? { ...r, accountId: val, accountLabel: acc ? `${acc.code} — ${acc.name}` : val, missing: undefined }
                                : r))
                            }}
                            options={incomeAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                          />
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
                          <DatePicker
                            size="small"
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            value={row.accountingDate}
                            onChange={val => setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, accountingDate: val ?? dayjs() } : r))}
                          />
                        ) : (
                          <Text style={{ fontSize: 11, color: '#6b7280' }}>{row.accountingDate?.format('DD/MM/YYYY') ?? '—'}</Text>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{money(row.total)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {row.status === 'pending' && !row.missing && <Tag color="default" style={{ fontSize: 10 }}>Pendiente</Tag>}
                        {row.status === 'pending' && row.missing  && <Tag color="warning" style={{ fontSize: 10 }}>Sin cuenta</Tag>}
                        {row.status === 'processing'              && <Tag color="processing" style={{ fontSize: 10 }}>Procesando…</Tag>}
                        {row.status === 'ok'                      && <Tag color="success" style={{ fontSize: 10 }}>✓ {row.result}</Tag>}
                        {row.status === 'skipped'                 && <Tooltip title={row.error}><Tag color="orange" style={{ fontSize: 10 }}>↓ Ya registrada</Tag></Tooltip>}
                        {row.status === 'error'                   && <Tooltip title={row.error}><Tag color="error" style={{ fontSize: 10 }}>✗ Error</Tag></Tooltip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Resumen + botones */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12 }}>
                  {!allDone && batchRows.filter(r => r.missing).length > 0 && (
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

      {/* ─── Import Card ──────────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{ borderTop: '3px solid #1faec2' }}
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
              <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
                DTE SAT — Emitidos{hasRunningJobs && <Spin size="small" style={{ marginLeft: 8 }} />}
              </Title>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                Bandeja de facturas emitidas vía APIFY
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
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadAll()} loading={loading} size="small">Actualizar</Button>
            <Button
              size="small" danger icon={<DeleteOutlined />}
              onClick={() => Modal.confirm({
                title: 'Limpiar todo',
                content: 'Se eliminarán todos los DTEs importados y el historial de importaciones. ¿Continuar?',
                okText: 'Sí, limpiar', okButtonProps: { danger: true }, cancelText: 'Cancelar',
                onOk: async () => {
                  const r = await clearAllSatEmitidos()
                  message.success(`Eliminados: ${r.deletedDtes} DTEs y ${r.deletedJobs} jobs`)
                  loadAll()
                },
              })}
            >
              Limpiar todo
            </Button>
          </Space>
        }
      >
        <Form form={importForm} layout="inline" size="small" onFinish={handleImport}>
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
              Importar Emitidos
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* ─── Tabs: Documentos / Historial ─────────────────────────────────── */}
      <Tabs
        type="card"
        items={[
          {
            key: 'bandeja',
            label: (
              <Space size={4}>
                <FileTextOutlined />
                Documentos SAT
                {pendingToProcess > 0 && (
                  <Tag color="gold" style={{ fontSize: 10, marginInlineEnd: 0 }}>
                    {pendingToProcess} por procesar
                  </Tag>
                )}
              </Space>
            ),
            children: (
              <Card bordered={false}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="Buscar UUID, NIT, nombre o No. DTE"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1) }}
                      style={{ width: 300 }}
                      size="small"
                    />
                    <Button size="small" type={!statusFilter ? 'primary' : 'default'}
                      onClick={() => { setStatusFilter(undefined); setPage(1) }}>
                      Todos
                    </Button>
                    {(Object.entries(statusConfig) as [SatEmitidosStatus, typeof statusConfig[SatEmitidosStatus]][]).map(([key, cfg]) => (
                      <Button key={key} size="small"
                        type={statusFilter === key ? 'primary' : 'default'}
                        onClick={() => { setStatusFilter(statusFilter === key ? undefined : key); setPage(1) }}>
                        {cfg.label}{stats[key]?.count ? ` (${stats[key].count})` : ''}
                      </Button>
                    ))}
                    {(stats.ready?.count ?? 0) > 0 && !statusFilter && (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e8f5ef', border: '1px solid #6ee7b7', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#065f46', cursor: 'pointer' }}
                        onClick={() => setStatusFilter('ready')}
                      >
                        <CheckCircleOutlined style={{ color: '#2ea172' }} />
                        <span><strong>{stats.ready.count} facturas listas</strong> — Registrar en lote</span>
                      </div>
                    )}
                  </Space>
                  <Space>
                    {(() => {
                      const batchable = documents.filter(isBatchable)
                      const allSelected = batchable.length > 0 && batchable.every(d => selectedIds.includes(d.id))
                      return batchable.length > 0 ? (
                        <Button
                          size="small"
                          icon={<CheckCircleOutlined />}
                          onClick={() => allSelected
                            ? setSelectedIds([])
                            : setSelectedIds(batchable.map(d => d.id))
                          }
                        >
                          {allSelected ? 'Quitar selección' : `Seleccionar todo Listo (${batchable.length})`}
                        </Button>
                      ) : null
                    })()}
                    {selectedIds.length > 0 && (
                      <Button
                        size="small"
                        icon={<ThunderboltOutlined />}
                        style={{ background: '#2ea172', borderColor: '#2ea172', color: '#fff' }}
                        onClick={openBatchModal}
                      >
                        Registrar {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
                      </Button>
                    )}
                  </Space>
                </div>
                <Table
                  columns={cols}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                  pagination={{
                    current: page,
                    pageSize: PAGE_SIZE,
                    total,
                    showSizeChanger: false,
                    showTotal: t => `${t} documentos`,
                    onChange: (p) => setPage(p),
                  }}
                  rowClassName={r => r.status === 'duplicate' ? 'ant-table-row-duplicate' : ''}
                  rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: keys => setSelectedIds(keys as string[]),
                    getCheckboxProps: r => ({
                      disabled: !isBatchable(r),
                      title: isBatchable(r) ? undefined
                        : r.status === 'posted' ? 'Ya fue contabilizado'
                        : r.status === 'duplicate' ? 'Documento duplicado — ya existe una factura con este UUID'
                        : ['NCRE', 'NABN'].includes((r.tipoDocumento ?? '').toUpperCase()) ? 'Las Notas de Crédito se procesan individualmente (clic en Procesar)'
                        : !r.customerId ? 'Vincula un cliente primero (clic en Procesar)'
                        : undefined,
                    }),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'historial',
            label: (
              <Space size={4}>
                <CloudSyncOutlined />
                Historial
                {hasRunningJobs && <Badge status="processing" />}
              </Space>
            ),
            children: (
              <Card bordered={false}>
                {hasRunningJobs && (
                  <Alert type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }}
                    message="Importación en curso — sincronizando automáticamente cada 20 segundos"
                    action={<Spin size="small" />}
                  />
                )}
                <Table
                  size="small"
                  dataSource={jobs}
                  rowKey="id"
                  columns={jobCols}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  )
}
