import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, DatePicker, Space, Typography, Tag, Input,
  Button, Row, Col, Statistic, Tooltip, InputNumber,
} from 'antd'
import {
  SearchOutlined, FileTextOutlined, DownloadOutlined,
  FilePdfOutlined, PlusSquareOutlined, MinusSquareOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getLibroDiario, exportReporte,
  type LibroDiarioEntry, type LibroDiarioLine,
} from '../../api/reportes'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  n === 0 ? '—' : `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  posted:  'green',
  draft:   'orange',
  voided:  'red',
}

const TYPE_LABEL: Record<string, string> = {
  auto:       'Automático',
  manual:     'Manual',
  opening:    'Apertura',
  closing:    'Cierre',
  adjustment: 'Ajuste',
}

export default function LibroDiarioPage() {
  const today = dayjs()
  const [fromDate, setFromDate] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [toDate,   setToDate]   = useState(today.format('YYYY-MM-DD'))
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<LibroDiarioEntry[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [allExpanded,  setAllExpanded]  = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [folio,     setFolio]     = useState<number>(1)

  const load = useCallback(async () => {
    setLoading(true)
    setData([])      // limpiar estado antes de cargar para evitar datos en caché
    setTotal(0)
    try {
      const res = await getLibroDiario({ fromDate, toDate, page, limit: 50, search: search || undefined })
      setData(res.entries ?? [])
      setTotal(res.total ?? 0)
      setExpandedKeys([])
      setAllExpanded(false)
    } catch {
      setData([]); setTotal(0)
    } finally { setLoading(false) }
  }, [fromDate, toDate, page, search])

  useEffect(() => { load() }, [load])

  // Toggle expand all / collapse all
  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedKeys([])
      setAllExpanded(false)
    } else {
      setExpandedKeys(data.map(e => e.id))
      setAllExpanded(true)
    }
  }

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
      title: 'Cuenta', width: 280,
      render: (_, l) => (
        <span>
          <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#888', marginRight: 6 }}>{l.accountCode}</Text>
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
        <Text style={{ fontFamily: 'monospace', color: v > 0 ? '#1B3A6B' : '#bbb' }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Haber', dataIndex: 'credit', width: 130, align: 'right',
      render: (v) => (
        <Text style={{ fontFamily: 'monospace', color: v > 0 ? '#52c41a' : '#bbb' }}>{fmtQ(v)}</Text>
      ),
    },
  ]

  const columns: ColumnsType<LibroDiarioEntry> = [
    {
      dataIndex: 'entryNumber',
      width: 155,
      title: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tooltip title={allExpanded ? 'Colapsar todos' : 'Expandir todos'}>
            <Button
              type="text"
              size="small"
              icon={allExpanded
                ? <MinusSquareOutlined style={{ color: '#1B3A6B', fontSize: 14 }} />
                : <PlusSquareOutlined  style={{ color: '#1B3A6B', fontSize: 14 }} />
              }
              onClick={toggleExpandAll}
              style={{ padding: '0 2px', height: 20 }}
            />
          </Tooltip>
          <span>Póliza</span>
        </div>
      ),
      render: (v) => (
        <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>
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
        <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v)}</Text>
      ),
    },
    {
      title: 'Haber', dataIndex: 'totalCredit', width: 130, align: 'right',
      render: (v) => (
        <Text strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>{fmtQ(v)}</Text>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Libro Diario</Title>
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
            style={{ color: '#cf1322', borderColor: '#cf1322' }}
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
          <RangePicker
            format="YYYY-MM-DD"
            value={[dayjs(fromDate), dayjs(toDate)]}
            onChange={(_, strs) => {
              if (strs[0] && strs[1]) { setFromDate(strs[0]); setToDate(strs[1]); setPage(1) }
            }}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar póliza, descripción..."
            style={{ width: 260 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => load()}
            loading={loading}
          >
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
                valueStyle={{ fontSize: 16, color: '#1B3A6B' }}
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
          scroll={{ x: 1000, y: 'calc(100vh - 280px)' }}
          pagination={{
            total,
            current: page,
            pageSize: 50,
            onChange: setPage,
            showTotal: t => `${t} asientos`,
            showSizeChanger: false,
          }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => {
              setExpandedKeys(keys as string[])
              setAllExpanded(keys.length === data.length && data.length > 0)
            },
            expandIcon: () => null,   // ocultamos el ícono nativo — el control está en el header
            expandedRowRender: (entry) => (
              <Table
                columns={lineColumns}
                dataSource={entry.lines}
                rowKey={(_, i) => String(i)}
                pagination={false}
                size="small"
                style={{ margin: '4px 0 8px 48px' }}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#f5f5f5' }}>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong style={{ fontSize: 11 }}>Totales</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>
                        {fmtQ(entry.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>
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
    </div>
  )
}
