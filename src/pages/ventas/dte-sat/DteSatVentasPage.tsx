import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input,
  message, Modal, Row, Select, Space, Spin, Steps, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined, BookOutlined, CheckCircleOutlined, CloudSyncOutlined,
  DeleteOutlined, FileTextOutlined, ReloadOutlined,
  SearchOutlined, ThunderboltOutlined, UserAddOutlined, WarningOutlined, EyeOutlined,
} from '@ant-design/icons'
import DocumentLink from '../../../components/DocumentLink'
import dayjs, { Dayjs } from 'dayjs'
import {
  createSatEmitidosCustomer, deleteSatEmitidos,
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
  ready:     { label: 'Listo',             color: 'green',   icon: <CheckCircleOutlined /> },
  duplicate: { label: 'Duplicado',         color: 'volcano', icon: <FileTextOutlined /> },
  posted:    { label: 'Contabilizado',     color: 'blue',    icon: <BookOutlined /> },
  error:     { label: 'Error',             color: 'red',     icon: <WarningOutlined /> },
}

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  queued:    { label: 'En cola',    color: 'default' },
  running:   { label: 'Ejecutando', color: 'processing' },
  succeeded: { label: 'Finalizado', color: 'green' },
  failed:    { label: 'Error',      color: 'red' },
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
  const [satCredentials, setSatCredentials] = useState<{ satNit?: string }>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Stepper ────────────────────────────────────────────────────────────────
  const [stepperDte,     setStepperDte]     = useState<SatDteEmitidos | null>(null)
  const [stepperStep,    setStepperStep]    = useState(0)
  const [stepperLoading, setStepperLoading] = useState(false)
  const [stepperResult,  setStepperResult]  = useState<{ invoice: any; dte: SatDteEmitidos } | null>(null)
  const [stepperCustomer, setStepperCustomer] = useState<{ id: string; name: string; receivableAccountId?: string } | null>(null)
  const [stepperSuggestion, setStepperSuggestion] = useState<{ name?: string; taxId?: string } | null>(null)
  const [stepperForm]     = Form.useForm()
  const [customerForm]    = Form.useForm()
  const [originalInvoices, setOriginalInvoices] = useState<{ value: string; label: string }[]>([])

  // ── Batch (registro masivo) ────────────────────────────────────────────────
  type BatchRowStatus = 'pending' | 'processing' | 'ok' | 'error'
  interface BatchRow {
    id: string; label: string; total: number; status: BatchRowStatus
    accountId?: string; accountLabel?: string
    taxId?: string; taxLabel?: string
    defaultUnit?: string
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
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, jobsRes, statsRes] = await Promise.all([
        getSatEmitidosDocuments({ page: 1, limit: 200, search: search || undefined, status: statusFilter }),
        getSatEmitidosJobs({ page: 1, limit: 20 }),
        getSatEmitidosStats(),
      ])
      setDocuments(Array.isArray(docsRes) ? docsRes : (docsRes?.data ?? []))
      setJobs(Array.isArray(jobsRes) ? jobsRes : (jobsRes?.data ?? []))
      setStats(statsRes ?? {})
    } catch {
      message.error('Error cargando bandeja DTE SAT Emitidos')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

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

  // ── Preferencias por cliente (localStorage) ───────────────────────────────
  const saveDtePrefs = (customerId: string, vals: Record<string, any>) => {
    try {
      localStorage.setItem(`dte_prefs_${customerId}`, JSON.stringify({
        accountId: vals.accountId, taxId: vals.taxId, defaultUnit: vals.defaultUnit,
      }))
    } catch { /* silent */ }
  }

  // Carga prefs cuando el usuario llega al paso "Registrar" (step 2) y el cliente está vinculado
  useEffect(() => {
    if (stepperStep !== 2 || !stepperCustomer?.id) return
    try {
      const raw = localStorage.getItem(`dte_prefs_${stepperCustomer.id}`)
      if (raw) stepperForm.setFieldsValue(JSON.parse(raw))
    } catch { /* silent */ }
  }, [stepperStep, stepperCustomer?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abrir stepper ──────────────────────────────────────────────────────────
  const openStepper = (dte: SatDteEmitidos) => {
    setStepperDte(dte)
    setStepperStep(0)
    setStepperResult(null)
    setStepperCustomer(dte.customerId ? { id: dte.customerId, name: dte.nombreReceptor ?? '' } : null)
    setStepperSuggestion(null)
    stepperForm.resetFields()
    customerForm.resetFields()
  }

  const closeStepper = () => {
    setStepperDte(null)
    setStepperStep(0)
    setStepperResult(null)
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
        setStepperCustomer({ id: res.customer.id, name: res.customer.name, receivableAccountId: res.customer.receivableAccountId })
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
      setStepperCustomer({ id: res.customer.id, name: res.customer.name, receivableAccountId: vals.receivableAccountId })
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
        accountId:         vals.accountId,
        taxId:             vals.taxId,
        accountingDate:    vals.accountingDate ? dayjs(vals.accountingDate).format('YYYY-MM-DD') : undefined,
        notes:             vals.notes,
        estimateId:        vals.estimateId,
        defaultUnit:       vals.defaultUnit,
        creditNoteReason:  isNC ? vals.creditNoteReason : undefined,
        originalInvoiceId: isNC ? vals.originalInvoiceId : undefined,
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
      // 1. Preferencias guardadas
      if (d.customerId) {
        try {
          const raw = localStorage.getItem(`dte_prefs_${d.customerId}`)
          if (raw) { const p = JSON.parse(raw); accountId = p.accountId; taxId = p.taxId }
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
      rows.push({
        id: d.id,
        label: `${d.nombreReceptor ?? d.nitReceptor ?? '—'} · ${d.serie}/${d.numeroDte}`,
        total: Number(d.total ?? 0),
        status: 'pending',
        accountId,
        accountLabel: accObj ? `${accObj.code} — ${accObj.name}` : accountId ? '(cuenta configurada)' : undefined,
        taxId,
        taxLabel: taxObj ? `${taxObj.code} (${taxObj.rate}%)` : undefined,
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
          accountId:   row.accountId,
          taxId:       row.taxId,
          defaultUnit: row.defaultUnit,
        })
        const invoiceNumber = (res as any)?.invoice?.invoiceNumber ?? ''
        const dte = documents.find(d => d.id === row.id)
        if (dte?.customerId) saveDtePrefs(dte.customerId, { accountId: row.accountId, taxId: row.taxId })
        setBatchRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, status: 'ok', result: invoiceNumber } : r))
      } catch (err) {
        const errMsg = getErrorMessage(err, 'Error al registrar')
        setBatchRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, status: 'error', error: errMsg } : r))
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
      sorter: (a, b) => String(a.fechaEmision ?? '').localeCompare(String(b.fechaEmision ?? '')),
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v ? String(v).substring(0, 10) : '—'}</Text>,
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
          <Text style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {r.serie ?? '—'} / {r.numeroDte ?? '—'}
          </Text>
        </span>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      width: 130,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', cursor: 'default' }}>
            {v?.slice(0, 12)}…
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
          <Tag color="red" icon={<WarningOutlined />} style={{ fontSize: 10 }}>Error</Tag>
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
                    color: step.done ? (step.last ? '#16a34a' : '#1B3A6B') : '#d1d5db' }}>
                    {step.done ? '●' : '○'}
                  </span>
                </Tooltip>
              ))}
            </div>
            <Text type={s4 ? undefined : 'secondary'} style={{ fontSize: 10, color: s4 ? '#16a34a' : undefined }}>
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
      width: 115,
      fixed: 'right' as const,
      render: (_: unknown, r: SatDteEmitidos) => (
        <Space size={4}>
          {r.status === 'posted'
            ? <Tooltip title="Ver factura y póliza contable">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => r.invoiceId && navigate(`/ventas/facturas/${r.invoiceId}`)}
                  style={{ fontSize: 11, borderColor: '#1B3A6B', color: '#1B3A6B' }}
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
                  style={{ fontSize: 11, background: '#1B3A6B' }}
                >
                  Procesar
                </Button>
          }
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
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'}</Text>,
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
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v ?? 0}</Text>,
    },
    {
      title: 'Duplicados',
      dataIndex: 'duplicateCount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v ?? 0}</Text>,
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
                <Text strong style={{ fontSize: 18, color: '#1B3A6B' }}>{money(stepperDte.total)}</Text>
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
                    <Text strong style={{ fontSize: 14, color: '#1B3A6B' }}>{money(stepperDte.total)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Archivos" span={2}>
                    <Space size={16}>
                      {stepperDte.xmlUrl
                        ? <a href={stepperDte.xmlUrl} target="_blank" rel="noreferrer">XML ↗</a>
                        : <Text type="secondary">XML</Text>}
                      {stepperDte.pdfUrl
                        ? <a href={stepperDte.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>PDF ↗</a>
                        : <a href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${stepperDte.uuid}`} target="_blank" rel="noreferrer" style={{ color: '#d97706' }}>Ver en SAT ↗</a>}
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
                      <CheckCircleOutlined style={{ fontSize: 44, color: '#16a34a', display: 'block', marginBottom: 10 }} />
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
                              options={taxes.map(t => ({ value: t.code, label: `${t.code} — ${t.name}` }))}
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
                          options={taxes.map(t => ({ value: t.id, label: t.name }))} />
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
                  <Form.Item label="Notas" name="notes">
                    <Input.TextArea rows={2} placeholder="Descripción del servicio o producto..." />
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
                  <CheckCircleOutlined style={{ fontSize: 52, color: '#16a34a', marginBottom: 14 }} />
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>DTE Procesado Correctamente</Text>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 32px', display: 'inline-block', textAlign: 'left', marginTop: 8 }}>
                    <div>
                      <Text type="secondary">{isNC3 ? 'Nota de Crédito:' : 'Factura:'}</Text>{' '}
                      <Text strong>{invoiceNumber}</Text>
                    </div>
                    {(stepperResult.invoice as any)?.journalEntryId && (
                      <div><Text type="secondary">Póliza:</Text> <Text strong style={{ color: '#16a34a' }}>Generada automáticamente</Text></div>
                    )}
                    <div><Text type="secondary">Total:</Text> <Text strong>{money(stepperDte?.total)}</Text></div>
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
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                onClick={() => { if (stepperStep > 0) setStepperStep(s => s - 1); else closeStepper() }}
                disabled={stepperStep === 3 || stepperLoading}
              >
                {stepperStep === 0 ? 'Cancelar' : '← Anterior'}
              </Button>
              <Space>
                {stepperStep === 0 && (
                  <Button type="primary" style={{ background: '#1B3A6B' }} onClick={() => setStepperStep(1)}>
                    Siguiente →
                  </Button>
                )}
                {stepperStep === 1 && (
                  <Tooltip title={stepperCustomer && !stepperCustomer.receivableAccountId
                    ? 'Configura la Cuenta CxC del cliente antes de continuar'
                    : undefined}>
                    <Button type="primary" style={{ background: '#1B3A6B' }}
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
                    style={{ background: '#1B3A6B' }} onClick={handlePost}>
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
                    <Button type="primary" style={{ background: '#1B3A6B' }} onClick={closeStepper}>
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
        const allDone = batchRows.length > 0 && batchRows.every(r => r.status === 'ok' || r.status === 'error' || !!r.missing)
        const canProcess = !batchRunning && batchRows.some(r => !r.missing && r.accountId && r.status === 'pending')
        return (
        <Modal
          open={batchOpen}
          width={820}
          title={<Space><ThunderboltOutlined style={{ color: '#16a34a' }} />Registro masivo — {batchRows.length} DTE{batchRows.length > 1 ? 's' : ''}</Space>}
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
              {/* Parámetros compartidos: IVA + Unidad */}
              {!allDone && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginBottom: 12,
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Impuesto IVA (aplica a todos)</div>
                    <Select size="small" style={{ width: '100%' }} allowClear placeholder="IVA 12%..."
                      onChange={val => setBatchRows(prev => prev.map(r => ({
                        ...r, taxId: val ?? undefined,
                        taxLabel: val ? taxes.find(t => t.id === val) ? `${taxes.find(t => t.id === val)!.code} (${taxes.find(t => t.id === val)!.rate}%)` : undefined : undefined,
                      })))}
                      options={taxes.map(t => ({ value: t.id, label: `${t.code} — ${t.name}` }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Unidad de medida (opcional)</div>
                    <Select size="small" style={{ width: '100%' }} allowClear placeholder="UND..."
                      onChange={val => setBatchRows(prev => prev.map(r => ({ ...r, defaultUnit: val ?? undefined })))}
                      options={unidades.map(u => ({ value: u.code, label: `${u.code} — ${u.name}` }))} />
                  </div>
                </div>
              )}

              {/* Tabla con cuenta editable por fila */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>Cliente / DTE</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, minWidth: 220 }}>Cuenta de ingreso</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, fontSize: 11, width: 100 }}>Total</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, width: 120 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0', background: row.missing ? '#fff7ed' : undefined }}>
                      <td style={{ padding: '6px 10px' }}><Text style={{ fontSize: 12 }}>{row.label}</Text></td>
                      <td style={{ padding: '4px 10px' }}>
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
                          <div style={{ color: '#d97706', fontSize: 10, marginTop: 2 }}>⚠ {row.missing}</div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{money(row.total)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {row.status === 'pending' && !row.missing && <Tag color="default" style={{ fontSize: 10 }}>Pendiente</Tag>}
                        {row.status === 'pending' && row.missing  && <Tag color="warning" style={{ fontSize: 10 }}>Sin cuenta</Tag>}
                        {row.status === 'processing'              && <Tag color="processing" style={{ fontSize: 10 }}>Procesando…</Tag>}
                        {row.status === 'ok'                      && <Tag color="success" style={{ fontSize: 10 }}>✓ {row.result}</Tag>}
                        {row.status === 'error'                   && <Tooltip title={row.error}><Tag color="error" style={{ fontSize: 10 }}>✗ Error</Tag></Tooltip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumen + botones */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12 }}>
                  {!allDone && batchRows.filter(r => r.missing).length > 0 && (
                    <Text type="warning" style={{ fontSize: 12 }}>
                      {batchRows.filter(r => r.missing).length} sin cuenta — se omitirán
                    </Text>
                  )}
                  {allDone && (
                    <Text style={{ fontSize: 12, color: '#16a34a' }}>
                      ✓ {batchRows.filter(r => r.status === 'ok').length} registrado{batchRows.filter(r => r.status === 'ok').length !== 1 ? 's' : ''}
                      {batchRows.some(r => r.status === 'error') && <span style={{ color: '#dc2626' }}> · {batchRows.filter(r => r.status === 'error').length} con error</span>}
                    </Text>
                  )}
                </div>
                <Space>
                  {!allDone && <Button onClick={() => { if (!batchRunning) { setBatchOpen(false); setBatchRows([]) } }}>Cancelar</Button>}
                  {!allDone ? (
                    <Button type="primary" icon={<ThunderboltOutlined />} loading={batchRunning}
                      disabled={!canProcess}
                      style={{ background: canProcess ? '#16a34a' : undefined, borderColor: canProcess ? '#16a34a' : undefined }}
                      onClick={handleBatchPost}>
                      Registrar {batchRows.filter(r => !r.missing && r.accountId).length} DTE{batchRows.filter(r => !r.missing && r.accountId).length !== 1 ? 's' : ''}
                    </Button>
                  ) : (
                    <Button type="primary" style={{ background: '#1B3A6B' }}
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
        style={{ borderTop: '3px solid #1B3A6B' }}
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
              <Title level={4} style={{ margin: 0, color: '#102a56' }}>
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
              <div style={{ fontSize: 11, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                ✓ NIT {satCredentials.satNit} configurado
              </div>
            )}
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading} size="small">Actualizar</Button>
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
        <Form form={importForm} layout="vertical" size="small" onFinish={handleImport}>
          <Row gutter={[16, 0]} align="bottom">
            <Col xs={24} md={14}>
              <Form.Item name="range" label="Rango de emisión" style={{ marginBottom: 0 }}
                rules={[{ required: true, message: 'Selecciona el rango de fechas' }]}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  presets={[
                    { label: 'Este mes',      value: [dayjs().startOf('month'), dayjs()] },
                    { label: 'Mes anterior',  value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                    { label: 'Este trimestre', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs()] },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Button type="primary" htmlType="submit" icon={<ApiOutlined />} loading={importing}
                disabled={!satCredentials.satNit}
                block style={{ background: '#1B3A6B' }}>
                Importar Emitidos
              </Button>
            </Col>
          </Row>
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
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: 300 }}
                      size="small"
                    />
                    <Button size="small" type={!statusFilter ? 'primary' : 'default'}
                      onClick={() => setStatusFilter(undefined)}>
                      Todos
                    </Button>
                    {(Object.entries(statusConfig) as [SatEmitidosStatus, typeof statusConfig[SatEmitidosStatus]][]).map(([key, cfg]) => (
                      <Button key={key} size="small"
                        type={statusFilter === key ? 'primary' : 'default'}
                        onClick={() => setStatusFilter(statusFilter === key ? undefined : key)}>
                        {cfg.label}{stats[key]?.count ? ` (${stats[key].count})` : ''}
                      </Button>
                    ))}
                  </Space>
                  {selectedIds.length > 0 && (
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                      onClick={openBatchModal}
                    >
                      Registrar {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
                <Table
                  columns={cols}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                  pagination={{ pageSize: 50, showTotal: t => `${t} documentos`, showSizeChanger: false }}
                  rowClassName={r => r.status === 'duplicate' ? 'ant-table-row-duplicate' : ''}
                  rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: keys => setSelectedIds(keys as string[]),
                    getCheckboxProps: r => ({ disabled: !isBatchable(r) }),
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
