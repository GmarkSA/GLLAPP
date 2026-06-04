import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Descriptions, Form, Input,
  message, Row, Modal, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined, BookOutlined, CheckCircleOutlined, CloudSyncOutlined,
  DeleteOutlined, FileTextOutlined, ReloadOutlined,
  SearchOutlined, UserAddOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  createSatDteVendor, deleteSatDte,
  getSatDteDocuments, getSatDteJobs, getSatDteStats,
  postSatDte,
  resolveSatDteVendor,
  startSatDteImport, syncSatDteJob,
  type SatDte, type SatDteStatus, type SatImportJob,
  BILL_TYPE_CONFIG, PAYMENT_TERMS_CONFIG,
} from '../../../api/compras'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const POLL_INTERVAL_MS = 20_000 // 20 segundos — polling para jobs en ejecución

const statusConfig: Record<SatDteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Proveedor pendiente', color: 'gold',    icon: <WarningOutlined /> },
  ready:      { label: 'Listo',               color: 'green',   icon: <CheckCircleOutlined /> },
  duplicate:  { label: 'Duplicado',           color: 'volcano', icon: <FileTextOutlined /> },
  posted:     { label: 'Contabilizado',        color: 'blue',    icon: <BookOutlined /> },
  error:      { label: 'Error',               color: 'red',     icon: <WarningOutlined /> },
}

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  queued:    { label: 'En cola',    color: 'default' },
  running:   { label: 'Ejecutando', color: 'processing' },
  succeeded: { label: 'Finalizado', color: 'green' },
  failed:    { label: 'Error',      color: 'red' },
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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [postForm] = Form.useForm()
  const [vendorForm] = Form.useForm()

  // ── Cuentas de gasto para el modal ────────────────────────────────────────
  useEffect(() => {
    getAccounts({ isActive: true, limit: 500 })
      .then((res: any) => setAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
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

  const handleImport = async (values: { satNit: string; satPass: string; range: [Dayjs, Dayjs] }) => {
    setImporting(true)
    try {
      const job = await startSatDteImport({
        satNit: values.satNit,
        satPass: values.satPass,
        fechaInicio: values.range[0].format('YYYY-MM-DD'),
        fechaFin: values.range[1].format('YYYY-MM-DD'),
      })
      message.success(`Importación SAT iniciada — Run APIFY: ${job.apifyRunId ?? job.id}`)
      form.setFieldValue('satPass', '')
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
    invoiceType: string
    accountId?: string
    paymentTerms: string
    accountingDate?: Dayjs
  }) => {
    if (!postingDte) return
    setPostLoading(true)
    try {
      const result = await postSatDte(postingDte.id, {
        invoiceType:    values.invoiceType,
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
      width: 100,
      sorter: (a, b) => (a.fechaEmision ?? '').localeCompare(b.fechaEmision ?? ''),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Proveedor SAT',
      render: (_, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{row.nombreEmisor ?? 'Sin nombre'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>NIT: {row.nitEmisor ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Tipo / Serie / DTE',
      width: 180,
      render: (_, row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
          <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '18px', flexShrink: 0 }}>
            {(row as any).tipoDocumento ?? 'FACT'}
          </Tag>
          <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            {row.serie ?? '—'} / {row.numeroDte ?? '—'}
          </Text>
        </span>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      width: 200,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text code style={{ fontSize: 10 }}>{v?.slice(0, 18)}…</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      align: 'right',
      width: 110,
      render: (v: number, row) => <Text style={{ fontSize: 12 }}>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'IVA',
      dataIndex: 'totalIva',
      align: 'right',
      width: 100,
      render: (v: number, row) => <Text style={{ fontSize: 12 }}>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      width: 120,
      sorter: (a, b) => Number(a.total) - Number(b.total),
      render: (v: number, row) => <Text strong>{money(v, row.moneda)}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 160,
      filters: Object.entries(statusConfig).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (val, row) => row.status === val,
      render: (v: SatDteStatus) => (
        <Tag color={statusConfig[v]?.color} icon={statusConfig[v]?.icon}>
          {statusConfig[v]?.label ?? v}
        </Tag>
      ),
    },
    {
      title: 'Proveedor ERP',
      width: 150,
      render: (_, row) => row.vendorId ? (
        <Tag color="green" icon={<CheckCircleOutlined />}>Vinculado</Tag>
      ) : (
        <Tag color="gold" icon={<WarningOutlined />}>Pendiente</Tag>
      ),
    },
    {
      title: 'Archivos',
      width: 100,
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {row.xmlUrl
            ? <a href={row.xmlUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>XML ↗</a>
            : <Text type="secondary" style={{ fontSize: 12 }}>XML</Text>}
          {row.pdfUrl
            ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>PDF ↗</a>
            : row.uuid
              ? <Tooltip title="Ver en portal SAT (verificación FEL)">
                  <a
                    href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${row.uuid}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: '#d97706' }}
                  >
                    SAT ↗
                  </a>
                </Tooltip>
              : <Text type="secondary" style={{ fontSize: 12 }}>PDF</Text>}
        </div>
      ),
    },
    {
      title: 'Accion',
      width: 240,
      fixed: 'right',
      render: (_, row) => {
        const vendorLoading = vendorActionId === row.id
        return (
          <Space size={4} wrap>
            {!row.vendorId && (
              <>
                <Button
                  size="small"
                  icon={<SearchOutlined />}
                  loading={vendorLoading}
                  onClick={() => void handleResolveVendor(row)}
                  style={{ fontSize: 11 }}
                >
                  Resolver
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<UserAddOutlined />}
                  loading={vendorLoading}
                  onClick={() => handleCreateVendor(row)}
                  style={{ fontSize: 11 }}
                >
                  Crear
                </Button>
              </>
            )}
            <Tooltip title={row.status === 'posted' ? 'Ya contabilizado' : !row.vendorId ? 'Requiere proveedor vinculado' : undefined}>
              <Button
                size="small"
                type={row.status === 'ready' ? 'primary' : 'default'}
                icon={<BookOutlined />}
                disabled={row.status !== 'ready'}
                onClick={() => {
                  const lineas: any[] = Array.isArray(row.items) ? row.items : []
                  const autoConcepto = lineas.length > 0
                    ? lineas.map(l => l.descripcion || l.description).filter(Boolean).join(' / ')
                    : ''
                  postForm.setFieldsValue({
                    invoiceType: 'goods',
                    paymentTerms: 'immediate',
                    accountingDate: dayjs(),
                    concepto: autoConcepto,
                  })
                  setPostingDte(row)
                }}
                style={{ fontSize: 11, ...(row.status === 'ready' ? { background: '#1B3A6B' } : {}) }}
              >
                Contabilizar
              </Button>
            </Tooltip>
            <Tooltip title="Eliminar de la bandeja (permite reimportar)">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteDte(row)}
                style={{ fontSize: 11 }}
              />
            </Tooltip>
          </Space>
        )
      },
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
          <Tag color="green" style={{ fontSize: 10 }}>{row.importedCount} nuevos</Tag>
          <Tag color="orange" style={{ fontSize: 10 }}>{row.duplicateCount} dup.</Tag>
          {(row as any).errorCount > 0 && (
            <Tag color="red" style={{ fontSize: 10 }}>{(row as any).errorCount} err.</Tag>
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* Modal — Crear proveedor desde DTE SAT */}
      <Modal
        open={!!vendorModalDte}
        title={<Space><UserAddOutlined style={{ color: '#1B3A6B' }} /><span>Crear proveedor desde DTE SAT</span></Space>}
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
        title={<Space><BookOutlined style={{ color: '#1B3A6B' }} /><span>Contabilizar DTE SAT</span></Space>}
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
                <Text strong style={{ fontSize: 14, color: '#1B3A6B' }}>{money(postingDte.total, postingDte.moneda)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Factura PDF" span={2}>
                {postingDte.pdfUrl
                  ? <a href={postingDte.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Ver PDF de la factura ↗</a>
                  : <a
                      href={`https://portal.sat.gob.gt/portal/verificar-fel?uuid=${postingDte.uuid}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#d97706' }}
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
                  name="invoiceType"
                  label="Tipo de factura"
                  rules={[{ required: true, message: 'Selecciona el tipo' }]}
                >
                  <Select
                    options={Object.entries(BILL_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                    placeholder="Selecciona tipo"
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
              <Title level={4} style={{ margin: 0, color: '#102a56' }}>
                DTE SAT{hasRunningJobs && <Spin size="small" style={{ marginLeft: 8 }} />}
              </Title>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                Bandeja de facturas importadas desde SAT vía APIFY
                {hasRunningJobs && <Text type="warning" style={{ marginLeft: 6, fontSize: 12 }}>· Importación en progreso</Text>}
              </Text>
            </div>
            <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 10px', whiteSpace: 'nowrap' }}>
              ⚠ Password SAT nunca se almacena — se envía directo a APIFY vía HTTPS
            </div>
          </div>
        }
        extra={<Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading} size="small">Actualizar</Button>}
        style={{ borderTop: '3px solid #1B3A6B' }}
        styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
      >
        <Form form={form} layout="vertical" size="small" onFinish={handleImport}>
          <Row gutter={[16, 0]} align="bottom">
            <Col xs={24} md={5}>
              <Form.Item name="satNit" label="NIT Agencia Virtual SAT" style={{ marginBottom: 0 }}
                rules={[{ required: true, message: 'Ingresa el NIT SAT' }]}
              >
                <Input placeholder="108285685" autoComplete="off" />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="satPass" label="Contraseña Agencia Virtual" style={{ marginBottom: 0 }}
                rules={[{ required: true, message: 'Ingresa la contraseña SAT' }]}
              >
                <Input.Password placeholder="••••••••" autoComplete="off" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="range" label="Rango de emisión" style={{ marginBottom: 0 }}
                rules={[{ required: true, message: 'Selecciona el rango' }]}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  presets={[
                    { label: 'Este mes', value: [dayjs().startOf('month'), dayjs()] },
                    { label: 'Mes anterior', value: [dayjs().subtract(1,'month').startOf('month'), dayjs().subtract(1,'month').endOf('month')] },
                    { label: 'Este trimestre', value: [dayjs().subtract(2,'month').startOf('month'), dayjs()] },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ApiOutlined />}
                loading={importing}
                block
                style={{ background: '#1B3A6B' }}
              >
                Iniciar importación SAT
              </Button>
            </Col>
          </Row>
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
                <Space wrap style={{ marginBottom: 12 }}>
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
                </Space>
                <Table
                  columns={columns}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 1300 }}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    showTotal: t => `${t} documentos`,
                  }}
                  rowClassName={row =>
                    row.status === 'ready' ? 'ant-table-row-ready' :
                    row.status === 'error' ? 'ant-table-row-error' : ''
                  }
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
    </Space>
  )
}
