import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Form, Input, message, Row, Space,
  Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined, CloudSyncOutlined, FileTextOutlined, ReloadOutlined,
  SafetyCertificateOutlined, SearchOutlined,
} from '@ant-design/icons'
import { Dayjs } from 'dayjs'
import {
  getSatDteDocuments, getSatDteJobs, getSatDteStats,
  startSatDteImport, syncSatDteJob,
  type SatDte, type SatDteStatus, type SatImportJob,
} from '../../../api/compras'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const statusConfig: Record<SatDteStatus, { label: string; color: string }> = {
  pending: { label: 'Proveedor pendiente', color: 'gold' },
  ready: { label: 'Listo', color: 'green' },
  duplicate: { label: 'Duplicado', color: 'volcano' },
  posted: { label: 'Contabilizado', color: 'blue' },
  error: { label: 'Error', color: 'red' },
}

const jobStatusConfig: Record<string, { label: string; color: string }> = {
  queued: { label: 'En cola', color: 'default' },
  running: { label: 'Ejecutando', color: 'processing' },
  succeeded: { label: 'Finalizado', color: 'green' },
  failed: { label: 'Error', color: 'red' },
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
  const responseMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  const messageText = (err as { message?: string })?.message
  return responseMessage ?? messageText ?? fallback
}

export default function DteSatPage() {
  const [form] = Form.useForm()
  const [documents, setDocuments] = useState<SatDte[]>([])
  const [jobs, setJobs] = useState<SatImportJob[]>([])
  const [stats, setStats] = useState<Record<string, { count: number; total: number }>>({})
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [syncingJob, setSyncingJob] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, jobsRes, statsRes] = await Promise.all([
        getSatDteDocuments({ limit: 50, search: search || undefined, status }),
        getSatDteJobs({ limit: 10 }),
        getSatDteStats(),
      ])
      setDocuments(docsRes.data ?? [])
      setJobs(jobsRes.data ?? [])
      setStats(statsRes ?? {})
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const handleImport = async (values: { satNit: string; satPass: string; range: [Dayjs, Dayjs] }) => {
    setImporting(true)
    try {
      const job = await startSatDteImport({
        satNit: values.satNit,
        satPass: values.satPass,
        fechaInicio: values.range[0].format('YYYY-MM-DD'),
        fechaFin: values.range[1].format('YYYY-MM-DD'),
      })
      message.success(`Importacion SAT iniciada. Run APIFY: ${job.apifyRunId ?? job.id}`)
      form.setFieldValue('satPass', '')
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo iniciar la importacion'))
    } finally {
      setImporting(false)
    }
  }

  const handleSync = async (job: SatImportJob) => {
    setSyncingJob(job.id)
    try {
      const updated = await syncSatDteJob(job.id)
      if (updated.status === 'succeeded') {
        message.success(`Sincronizacion completa: ${updated.importedCount} nuevos, ${updated.duplicateCount} duplicados`)
      } else if (updated.status === 'failed') {
        message.error(updated.errorMessage ?? 'El run APIFY fallo')
      } else {
        message.info('APIFY sigue ejecutando. Vuelve a sincronizar en unos minutos.')
      }
      await load()
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'No se pudo sincronizar APIFY'))
    } finally {
      setSyncingJob(null)
    }
  }

  const totals = useMemo(() => ({
    pending: stats.pending?.count ?? 0,
    ready: stats.ready?.count ?? 0,
    duplicate: stats.duplicate?.count ?? 0,
    posted: stats.posted?.count ?? 0,
    amount: Object.values(stats).reduce((sum, item) => sum + Number(item.total ?? 0), 0),
  }), [stats])

  const columns: ColumnsType<SatDte> = [
    {
      title: 'Fecha',
      dataIndex: 'fechaEmision',
      width: 110,
      render: (value: string) => value ? value.slice(0, 10) : '-',
    },
    {
      title: 'Proveedor SAT',
      render: (_, row) => (
        <div>
          <Text strong>{row.nombreEmisor ?? 'Proveedor sin nombre'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{row.nitEmisor ?? 'Sin NIT'}</Text>
        </div>
      ),
    },
    {
      title: 'Serie / DTE',
      width: 150,
      render: (_, row) => (
        <div>
          <Text>{row.serie ?? '-'}</Text>
          <br />
          <Text code style={{ fontSize: 11 }}>{row.numeroDte ?? '-'}</Text>
        </div>
      ),
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      width: 220,
      render: (value: string) => <Text code style={{ fontSize: 11 }}>{value}</Text>,
    },
    {
      title: 'IVA',
      dataIndex: 'totalIva',
      align: 'right',
      width: 110,
      render: (value: number, row) => money(value, row.moneda),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      width: 130,
      render: (value: number, row) => <Text strong>{money(value, row.moneda)}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 150,
      render: (value: SatDteStatus) => <Tag color={statusConfig[value]?.color}>{statusConfig[value]?.label ?? value}</Tag>,
    },
    {
      title: 'Archivos',
      width: 120,
      render: (_, row) => (
        <Space>
          {row.xmlUrl ? <a href={row.xmlUrl} target="_blank" rel="noreferrer">XML</a> : <Text type="secondary">XML</Text>}
          {row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer">PDF</a> : <Text type="secondary">PDF</Text>}
        </Space>
      ),
    },
  ]

  const jobColumns: ColumnsType<SatImportJob> = [
    { title: 'Fecha', dataIndex: 'createdAt', width: 120, render: (v: string) => v?.slice(0, 10) },
    { title: 'Rango', render: (_, row) => `${String(row.fechaInicio).slice(0, 10)} - ${String(row.fechaFin).slice(0, 10)}` },
    { title: 'NIT SAT', dataIndex: 'satNit', width: 120 },
    { title: 'Run APIFY', dataIndex: 'apifyRunId', render: (v: string) => <Text code style={{ fontSize: 11 }}>{v ?? '-'}</Text> },
    { title: 'Estado', dataIndex: 'status', width: 120, render: (v: string) => <Tag color={jobStatusConfig[v]?.color}>{jobStatusConfig[v]?.label ?? v}</Tag> },
    { title: 'Nuevos', dataIndex: 'importedCount', align: 'right', width: 90 },
    { title: 'Duplicados', dataIndex: 'duplicateCount', align: 'right', width: 100 },
    {
      title: 'Acciones',
      width: 130,
      render: (_, row) => (
        <Button size="small" icon={<CloudSyncOutlined />} loading={syncingJob === row.id} onClick={() => handleSync(row)}>
          Sincronizar
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#102a56' }}>DTE SAT</Title>
          <Text type="secondary">Bandeja de facturas de compras importadas desde SAT via APIFY</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualizar</Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Fase 1 activa"
        description="Esta pantalla inicia el actor APIFY, sincroniza resultados y guarda los DTE en una bandeja. La contabilizacion asistida se habilita en la siguiente fase."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card bordered={false}><Statistic title="Pendientes" value={totals.pending} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card bordered={false}><Statistic title="Listos" value={totals.ready} prefix={<SafetyCertificateOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card bordered={false}><Statistic title="Duplicados" value={totals.duplicate} prefix={<ApiOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card bordered={false}><Statistic title="Total importado" value={money(totals.amount)} /></Card></Col>
      </Row>

      <Card bordered={false} title="Importar desde SAT">
        <Form form={form} layout="vertical" onFinish={handleImport}>
          <Row gutter={[16, 8]}>
            <Col xs={24} md={6}>
              <Form.Item name="satNit" label="NIT SAT" rules={[{ required: true, message: 'Ingresa el NIT SAT' }]}>
                <Input placeholder="108285685" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="satPass" label="Password SAT" rules={[{ required: true, message: 'Ingresa el password SAT' }]}>
                <Input.Password placeholder="Password Agencia Virtual" />
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item name="range" label="Rango de emision" rules={[{ required: true, message: 'Selecciona el rango' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label=" ">
                <Button type="primary" htmlType="submit" icon={<ApiOutlined />} loading={importing} block>
                  Importar SAT
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Tabs
        items={[
          {
            key: 'documentos',
            label: 'Documentos SAT',
            children: (
              <Card bordered={false}>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Buscar UUID, NIT, proveedor o DTE"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 320 }}
                  />
                  <Button onClick={() => setStatus(undefined)} type={!status ? 'primary' : 'default'}>Todos</Button>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <Button key={key} onClick={() => setStatus(key)} type={status === key ? 'primary' : 'default'}>
                      {cfg.label}
                    </Button>
                  ))}
                </Space>
                <Table
                  columns={columns}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 1100 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `${total} DTE` }}
                />
              </Card>
            ),
          },
          {
            key: 'jobs',
            label: 'Importaciones',
            children: (
              <Card bordered={false}>
                <Table
                  columns={jobColumns}
                  dataSource={jobs}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 900 }}
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
