import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Select, Space, Typography, Tag, Input,
  Button, Row, Col, Statistic, InputNumber, message, Popconfirm,
} from 'antd'
import {
  SearchOutlined, FileTextOutlined, DownloadOutlined, ArrowLeftOutlined,
  FilePdfOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getLibroDiario, exportReporte,
  type LibroDiarioEntry, type LibroDiarioLine,
} from '../../api/reportes'
import { postAsiento, deleteAsiento } from '../../api/asientos'

const { Text, Title } = Typography

const MESES = [
  { value: 1,  label: 'Enero' },   { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },   { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },    { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },   { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },  { value: 12, label: 'Diciembre' },
]
const CUR_YEAR = dayjs().year()
const ANIOS = Array.from({ length: 6 }, (_, i) => ({ value: CUR_YEAR - i, label: String(CUR_YEAR - i) }))

const fmtQ = (n: number) =>
  n === 0 ? '—' : `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  posted: '#2ea172',
  draft:  'orange',
  void:   'red',
}

const TYPE_LABEL: Record<string, string> = {
  auto:       'Automático',
  manual:     'Manual',
  opening:    'Apertura',
  closing:    'Cierre',
  adjustment: 'Ajuste',
}

export default function LibroDiarioPage() {
  const navigate = useNavigate()
  const today = dayjs()
  const [selectedMonth, setSelectedMonth] = useState(today.month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(today.year())
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<LibroDiarioEntry[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [folio,     setFolio]     = useState<number>(1)
  const [posting,   setPosting]   = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const fromDate = dayjs().year(selectedYear).month(selectedMonth - 1).startOf('month').format('YYYY-MM-DD')
  const toDate   = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month').format('YYYY-MM-DD')

  const handlePost = async (id: string) => {
    setPosting(id)
    try {
      await postAsiento(id)
      message.success('Póliza publicada — ahora aparece en todos los reportes')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'No se pudo publicar la póliza')
    } finally {
      setPosting(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await deleteAsiento(id)
      message.success('Póliza eliminada permanentemente')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'No se pudo eliminar la póliza')
    } finally {
      setDeleting(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setData([])
    setTotal(0)
    try {
      const res = await getLibroDiario({ fromDate, toDate, page, limit: 50, search: search || undefined })
      setData(res.entries ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setData([]); setTotal(0)
    } finally { setLoading(false) }
  }, [fromDate, toDate, page, search])

  useEffect(() => { load() }, [load])

  const handleExport = async (fmt: 'excel' | 'pdf') => {
    setExporting(fmt)
    try {
      await exportReporte('libro-diario', fmt, { fromDate, toDate, folio: String(folio) })
    } finally {
      setExporting(null)
    }
  }

  const totalDebit  = data.reduce((s, e) => s + e.totalDebit,  0)
  const totalCredit = data.reduce((s, e) => s + e.totalCredit, 0)

  const lineColumns: ColumnsType<LibroDiarioLine> = [
    {
      title: 'Cuenta', width: 300,
      render: (_, l) => (
        <span>
          <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280', marginRight: 6 }}>{l.accountCode}</Text>
          <Text style={{ fontSize: 12 }}>{l.accountName}</Text>
        </span>
      ),
    },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Debe', dataIndex: 'debit', width: 130, align: 'right',
      render: (v) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#1faec2' : '#bbb' }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Haber', dataIndex: 'credit', width: 130, align: 'right',
      render: (v) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#2ea172' : '#bbb' }}>{fmtQ(v)}</Text>
      ),
    },
  ]

  const columns: ColumnsType<LibroDiarioEntry> = [
    {
      title: 'Póliza',
      dataIndex: 'entryNumber',
      width: 145,
      render: (v) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{v}</Text>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'entryDate', width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {r.reference && (
            <Text type="secondary" style={{ fontSize: 11 }}>Ref: {r.reference}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Tipo', dataIndex: 'type', width: 110,
      render: (v) => <Tag>{TYPE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 100,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Debe', dataIndex: 'totalDebit', width: 130, align: 'right',
      render: (v) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Haber', dataIndex: 'totalCredit', width: 130, align: 'right',
      render: (v) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{fmtQ(v)}</Text>
      ),
    },
    {
      key: 'actions', width: 120, align: 'center',
      render: (_, row) => {
        if (row.status === 'draft') {
          return (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CheckCircleOutlined />}
              loading={posting === row.id}
              onClick={() => handlePost(row.id)}
            >
              Publicar
            </Button>
          )
        }
        if (row.status === 'void') {
          return (
            <Popconfirm
              title="¿Eliminar póliza anulada?"
              description="Esta acción es permanente y no se puede deshacer."
              okText="Eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(row.id)}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleting === row.id}
              >
                Eliminar
              </Button>
            </Popconfirm>
          )
        }
        return null
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <FileTextOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Libro Diario</Title>
            <Text type="secondary">Registro cronológico de asientos contables</Text>
          </div>
        </div>
        <Space align="center">
          <Text style={{ fontSize: 12, color: '#555' }}>Folio:</Text>
          <InputNumber
            min={1}
            value={folio}
            onChange={v => setFolio(v ?? 1)}
            style={{ width: 70 }}
            size="small"
          />
          <Button
            icon={<DownloadOutlined />}
            loading={exporting === 'excel'}
            onClick={() => handleExport('excel')}
          >
            Exportar Excel
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            loading={exporting === 'pdf'}
            onClick={() => handleExport('pdf')}
            style={{ color: '#e5484d', borderColor: '#e5484d' }}
          >
            Exportar PDF
          </Button>
        </Space>
      </div>

      {/* Filtros */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space wrap>
          <Select
            value={selectedMonth}
            onChange={v => { setSelectedMonth(v); setPage(1) }}
            options={MESES}
            style={{ width: 130 }}
            size="middle"
          />
          <Select
            value={selectedYear}
            onChange={v => { setSelectedYear(v); setPage(1) }}
            options={ANIOS}
            style={{ width: 90 }}
            size="middle"
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar póliza, descripción..."
            style={{ width: 260 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { title: 'Total asientos', value: total,       fmt: (v: number) => String(v) },
          { title: 'Total Debe',     value: totalDebit,  fmt: (v: number) => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}` },
          { title: 'Total Haber',    value: totalCredit, fmt: (v: number) => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}` },
        ].map(s => (
          <Col span={8} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={s.title}
                value={s.value}
                formatter={v => s.fmt(Number(v))}
                valueStyle={{ fontSize: 16, color: '#1faec2' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          rowClassName={(row) => row.status === 'void' ? 'row-void' : ''}
          scroll={{ x: 1000 }}
          pagination={{
            total,
            current: page,
            pageSize: 50,
            onChange: setPage,
            showTotal: t => `${t} asientos`,
            showSizeChanger: false,
          }}
          expandable={{
            expandedRowKeys: data.map(e => e.id),
            onExpandedRowsChange: () => {},
            showExpandColumn: false,
            expandedRowRender: (entry) => (
              <Table
                columns={lineColumns}
                dataSource={entry.lines}
                rowKey={(_, i) => String(i)}
                pagination={false}
                size="small"
                style={{ margin: '4px 0 8px 48px' }}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#fafbfc' }}>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong style={{ fontSize: 11 }}>Totales</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>
                        {fmtQ(entry.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>
                        {fmtQ(entry.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ),
          }}
          locale={{ emptyText: 'Sin asientos en el período' }}
        />
      </Card>
      <style>{`.row-void td { opacity: 0.5; text-decoration: line-through; }`}</style>
    </div>
  )
}
