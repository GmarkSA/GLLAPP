import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Spin, Tag, Statistic,
  Select, Space, Progress, Tooltip,
} from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import {
  HomeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  SwapOutlined, SearchOutlined, AuditOutlined, ArrowLeftOutlined,
  FileExcelOutlined, FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

import { getApAging, type ApAgingRow } from '../../api/compras'

const { Title, Text } = Typography

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

const fmt = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const BUCKET_KEYS = ['current', 'days_30', 'days_60', 'days_90', 'over_90'] as const
type BucketKey = typeof BUCKET_KEYS[number]

const BUCKET_LABELS: Record<BucketKey, string> = {
  current: 'Vigente',
  days_30: '1-30 días',
  days_60: '31-60 días',
  days_90: '61-90 días',
  over_90: '+90 días',
}
const BUCKET_COLORS: Record<BucketKey, string> = {
  current: '#2ea172',
  days_30: '#1faec2',
  days_60: '#ff7f00',
  days_90: '#e5484d',
  over_90: '#991b1b',
}

interface VendorAgingRow {
  vendorId: string
  vendorName: string
  current: number
  days_30: number
  days_60: number
  days_90: number
  over_90: number
  anticipo: number
  total: number
  neto: number
  pctVencido: number
  nextDueDays: number | null
  nextDueDate: string | null
  priority: 'urgent' | 'warning' | 'ok'
  invoices: Array<ApAgingRow & { bucket: BucketKey }>
}

function buildVendorRows(data: any): VendorAgingRow[] {
  const map = new Map<string, VendorAgingRow>()

  const ensure = (vid: string, vname: string): VendorAgingRow => {
    if (!map.has(vid)) {
      map.set(vid, {
        vendorId: vid, vendorName: vname,
        current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0,
        anticipo: 0, total: 0, neto: 0, pctVencido: 0,
        nextDueDays: null, nextDueDate: null,
        priority: 'ok', invoices: [],
      })
    }
    return map.get(vid)!
  }

  for (const key of BUCKET_KEYS) {
    for (const item of (data.buckets[key]?.items ?? []) as ApAgingRow[]) {
      const row = ensure(item.vendorId || '__sin__', item.vendorName || '—')
      const bal = Number((item as any).balanceGTQ ?? item.balance ?? 0)
      row[key] += bal
      row.invoices.push({ ...(item as any), bucket: key })
      if (item.dueDate) {
        const d = dayjs(item.dueDate).diff(dayjs(), 'day')
        if (row.nextDueDays === null || d < row.nextDueDays) {
          row.nextDueDays = d
          row.nextDueDate = item.dueDate
        }
      }
    }
  }

  for (const adv of data.advances ?? []) {
    const row = ensure(adv.vendorId || '__sin__', adv.vendorName || '—')
    row.anticipo += Number(adv.balance ?? 0)
  }

  for (const row of map.values()) {
    row.total = row.current + row.days_30 + row.days_60 + row.days_90 + row.over_90
    row.neto = Math.max(0, row.total - row.anticipo)
    row.pctVencido = row.total > 0
      ? ((row.days_60 + row.days_90 + row.over_90) / row.total) * 100 : 0
    row.priority = (row.over_90 > 0 || row.days_90 > 0) ? 'urgent'
      : row.days_60 > 0 ? 'warning' : 'ok'
  }

  return [...map.values()].sort((a, b) => b.total - a.total)
}

export default function ApAgingPage() {
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(dayjs().year())
  const [data,          setData]          = useState<any>(null)
  const [loading,       setLoading]       = useState(false)
  const [showAdvances,  setShowAdvances]  = useState(true)
  const [highlightBucket, setHighlightBucket] = useState<BucketKey | null>(null)
  const [sortedInfo, setSortedInfo] = useState<{ columnKey: string; order: 'ascend' | 'descend' }>({
    columnKey: 'total', order: 'descend',
  })

  const asOf = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month').format('YYYY-MM-DD')
  const periodLabel = MESES.find(m => m.value === selectedMonth)?.label + ' ' + selectedYear

  const load = useCallback(() => {
    setLoading(true)
    getApAging(asOf)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [asOf])

  useEffect(() => { load() }, [load])

  const vendorRows = useMemo(() => data ? buildVendorRows(data) : [], [data])

  const top5 = useMemo(() =>
    [...vendorRows]
      .sort((a, b) => (b.over_90 + b.days_90) - (a.over_90 + a.days_90))
      .filter(r => r.over_90 + r.days_90 > 0)
      .slice(0, 5),
    [vendorRows]
  )

  const handleKpiClick = (key: BucketKey) => {
    setHighlightBucket(prev => prev === key ? null : key)
    setSortedInfo({ columnKey: key, order: 'descend' })
  }

  const handleTableChange: TableProps<VendorAgingRow>['onChange'] = (_, __, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    if (s && s.columnKey) {
      setSortedInfo({ columnKey: String(s.columnKey), order: (s.order ?? 'descend') as 'ascend' | 'descend' })
      const bk = BUCKET_KEYS.find(k => k === s.columnKey)
      setHighlightBucket(bk ?? null)
    }
  }

  const expandedRowRender = useCallback((row: VendorAgingRow) => {
    const invCols: ColumnsType<any> = [
      {
        title: 'Documento', width: 140,
        render: (_: any, inv: any) => (
          <Link to={`/compras/facturas/${inv.id}`} style={{ fontWeight: 600, fontSize: 12 }}>
            {inv.invoiceNumber}
          </Link>
        ),
      },
      {
        title: 'Fecha', width: 100,
        render: (_: any, inv: any) => (
          <Text style={{ fontSize: 12 }}>
            {inv.invoiceDate ? dayjs(inv.invoiceDate).format('DD/MM/YYYY') : '—'}
          </Text>
        ),
      },
      {
        title: 'Vencimiento', width: 120,
        render: (_: any, inv: any) => {
          if (!inv.dueDate) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
          const d = dayjs(inv.dueDate).diff(dayjs(), 'day')
          return (
            <Text style={{ fontSize: 12, color: d < 0 ? '#e5484d' : d <= 7 ? '#ff7f00' : '#374151' }}>
              {dayjs(inv.dueDate).format('DD/MM/YYYY')}
              {d < 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>({Math.abs(d)}d vencida)</span>}
            </Text>
          )
        },
      },
      {
        title: 'Antigüedad', width: 105, align: 'center' as const,
        render: (_: any, inv: any) => (
          <Tag color={BUCKET_COLORS[inv.bucket as BucketKey]} style={{ fontSize: 11 }}>
            {BUCKET_LABELS[inv.bucket as BucketKey]}
          </Tag>
        ),
      },
      {
        title: 'Total', width: 130, align: 'right' as const,
        render: (_: any, inv: any) => (
          <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(Number((inv as any).totalGTQ ?? inv.total))}
          </Text>
        ),
      },
      {
        title: 'Saldo', width: 130, align: 'right' as const,
        render: (_: any, inv: any) => (
          <Text strong style={{ fontSize: 12, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(Number((inv as any).balanceGTQ ?? inv.balance))}
          </Text>
        ),
      },
    ]
    return (
      <Table
        columns={invCols}
        dataSource={row.invoices}
        rowKey="id"
        size="small"
        pagination={false}
        style={{ background: '#fafbfc', margin: '0 32px' }}
      />
    )
  }, [])

  const columns: ColumnsType<VendorAgingRow> = useMemo((): ColumnsType<VendorAgingRow> => [
    {
      title: 'Proveedor',
      key: 'vendorName',
      width: 260,
      sorter: (a, b) => a.vendorName.localeCompare(b.vendorName, 'es'),
      sortOrder: sortedInfo.columnKey === 'vendorName' ? sortedInfo.order : null,
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: row.priority === 'urgent' ? '#e5484d'
              : row.priority === 'warning' ? '#ff7f00' : '#2ea172',
          }} />
          <Text strong style={{ fontSize: 13 }}>{row.vendorName}</Text>
          {showAdvances && row.anticipo > 0 && (
            <Tooltip title={`Anticipo disponible: ${fmt(row.anticipo)}`}>
              <Tag color="#2ea172" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>ANT</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    ...BUCKET_KEYS.map((key): ColumnsType<VendorAgingRow>[number] => ({
      title: BUCKET_LABELS[key],
      key,
      dataIndex: key,
      width: 120,
      align: 'right',
      sorter: (a: VendorAgingRow, b: VendorAgingRow) => a[key] - b[key],
      sortOrder: sortedInfo.columnKey === key ? sortedInfo.order : null,
      onHeaderCell: () => ({
        style: {
          background: highlightBucket === key ? `${BUCKET_COLORS[key]}22` : undefined,
          transition: 'background 0.2s',
        },
      }),
      onCell: (row: VendorAgingRow) => ({
        style: {
          background: highlightBucket === key && row[key] > 0
            ? `${BUCKET_COLORS[key]}0f` : undefined,
        },
      }),
      render: (v: number) => v > 0 ? (
        <Text style={{
          fontSize: 13,
          fontWeight: (key === 'days_90' || key === 'over_90') ? 600 : 400,
          color: BUCKET_COLORS[key],
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmt(v)}
        </Text>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    })),
    {
      title: 'Total CxP',
      key: 'total',
      dataIndex: 'total',
      width: 145,
      align: 'right',
      sorter: (a, b) => a.total - b.total,
      sortOrder: sortedInfo.columnKey === 'total' ? sortedInfo.order : null,
      render: (v: number, row) => (
        <div>
          <Text strong style={{ fontSize: 13, color: '#1B3A6B', fontVariantNumeric: 'tabular-nums', display: 'block' }}>
            {fmt(v)}
          </Text>
          {showAdvances && row.anticipo > 0 && (
            <Text style={{ fontSize: 10, color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>
              Neto: {fmt(row.neto)}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '% Vencido',
      key: 'pctVencido',
      dataIndex: 'pctVencido',
      width: 115,
      align: 'center',
      sorter: (a, b) => a.pctVencido - b.pctVencido,
      sortOrder: sortedInfo.columnKey === 'pctVencido' ? sortedInfo.order : null,
      render: (v: number) => (
        <div style={{ padding: '0 4px' }}>
          <Progress
            percent={Math.round(v)}
            size="small"
            strokeColor={v >= 60 ? '#e5484d' : v >= 30 ? '#ff7f00' : '#1faec2'}
            format={p => <span style={{ fontSize: 10 }}>{p}%</span>}
          />
        </div>
      ),
    },
    {
      title: 'Próx. Vcto',
      key: 'nextDueDays',
      dataIndex: 'nextDueDays',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.nextDueDays ?? 9999) - (b.nextDueDays ?? 9999),
      sortOrder: sortedInfo.columnKey === 'nextDueDays' ? sortedInfo.order : null,
      render: (days: number | null, row) => {
        if (!row.nextDueDate || days === null)
          return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        if (days < 0) return (
          <Tooltip title={dayjs(row.nextDueDate).format('DD/MM/YYYY')}>
            <Tag color="#e5484d" style={{ fontSize: 11 }}>{Math.abs(days)}d vencida</Tag>
          </Tooltip>
        )
        if (days <= 7) return (
          <Tooltip title={dayjs(row.nextDueDate).format('DD/MM/YYYY')}>
            <Tag color="#ff7f00" style={{ fontSize: 11 }}>En {days}d</Tag>
          </Tooltip>
        )
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(row.nextDueDate).format('DD/MM/YYYY')}
          </Text>
        )
      },
    },
  ], [highlightBucket, sortedInfo, showAdvances])

  const handleExcel = () => {
    if (!data) return
    const rows: any[][] = [
      ['AP Aging — Cuentas por Pagar por Proveedor'],
      [`Período: ${periodLabel}`, '', '', '', '', '', '', `Corte: ${data.asOf}`, `Generado: ${new Date(data.generatedAt).toLocaleString('es-GT')}`],
      [],
      ['Proveedor', 'Vigente', '1-30 días', '31-60 días', '61-90 días', '+90 días', 'Anticipo', 'Total CxP', 'Neto', '% Vencido'],
    ]
    for (const row of vendorRows) {
      rows.push([
        row.vendorName,
        row.current || 0, row.days_30 || 0, row.days_60 || 0, row.days_90 || 0, row.over_90 || 0,
        row.anticipo || 0, row.total || 0, row.neto || 0,
        `${Math.round(row.pctVencido)}%`,
      ])
      for (const inv of row.invoices) {
        rows.push([
          `  ${inv.invoiceNumber}`,
          inv.bucket === 'current' ? Number((inv as any).balanceGTQ ?? inv.balance) : '',
          inv.bucket === 'days_30' ? Number((inv as any).balanceGTQ ?? inv.balance) : '',
          inv.bucket === 'days_60' ? Number((inv as any).balanceGTQ ?? inv.balance) : '',
          inv.bucket === 'days_90' ? Number((inv as any).balanceGTQ ?? inv.balance) : '',
          inv.bucket === 'over_90' ? Number((inv as any).balanceGTQ ?? inv.balance) : '',
          '', Number((inv as any).balanceGTQ ?? inv.balance),
        ])
      }
      rows.push([])
    }
    rows.push([
      'TOTAL GENERAL',
      data.buckets.current.total, data.buckets.days_30.total,
      data.buckets.days_60.total, data.buckets.days_90.total, data.buckets.over_90.total,
      data.totalAdvances ?? 0, data.grandTotal,
    ])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'AP Aging')
    XLSX.writeFile(wb, `ap-aging-${data.asOf}.xlsx`)
  }

  const summaryRow = () => {
    if (!data) return null
    return (
      <Table.Summary fixed="bottom">
        <Table.Summary.Row style={{ background: '#e6fafd', fontWeight: 700 }}>
          {/* colSpan=2: cubre la columna del ícono expandir + columna Proveedor */}
          <Table.Summary.Cell index={0} colSpan={2}>
            <Text strong style={{ fontSize: 12, color: '#1B3A6B', whiteSpace: 'nowrap' }}>
              TOTAL GENERAL — {vendorRows.length} proveedores
            </Text>
          </Table.Summary.Cell>
          {BUCKET_KEYS.map((key, i) => (
            <Table.Summary.Cell key={key} index={i + 2} align="right">
              {(data.buckets[key]?.total ?? 0) > 0 ? (
                <Text strong style={{ fontSize: 12, color: BUCKET_COLORS[key], fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(data.buckets[key].total)}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
              )}
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={7} align="right">
            <Text strong style={{ fontSize: 12, color: '#1B3A6B', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(data.grandTotal ?? 0)}
            </Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={8} />
          <Table.Summary.Cell index={9} />
        </Table.Summary.Row>
      </Table.Summary>
    )
  }

  const totalOverdue = data ? (data.buckets.days_90.total + data.buckets.over_90.total) : 0
  const totalBalance = data
    ? BUCKET_KEYS.reduce((s, k) => s + (data.buckets[k]?.total ?? 0), 0) : 0

  const kpiGridCols = showAdvances ? 'repeat(8, 1fr)' : 'repeat(6, 1fr)'

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Compras' },
          { title: 'AP Aging — Antigüedad de Saldos' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} />
          <AuditOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>AP Aging — Cuentas por Pagar</Title>
        </div>
        <Space>
          <Select value={selectedMonth} onChange={setSelectedMonth} options={MESES} style={{ width: 130 }} />
          <Select value={selectedYear}  onChange={setSelectedYear}  options={ANIOS}  style={{ width: 90 }} />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>
            Generar
          </Button>
          <Button
            icon={<SwapOutlined />}
            type={showAdvances ? 'primary' : 'default'}
            style={showAdvances ? { background: '#2ea172', borderColor: '#2ea172' } : {}}
            onClick={() => setShowAdvances(v => !v)}
          >
            {showAdvances ? 'Ocultar anticipos' : 'Incluir anticipos'}
          </Button>
          {data && (
            <Button icon={<FileExcelOutlined />} onClick={handleExcel} style={{ color: '#2ea172', borderColor: '#2ea172' }}>
              Excel
            </Button>
          )}
          {data && (
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Actualizar
            </Button>
          )}
        </Space>
      </div>

      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {data && (
        <>
          <div style={{
            marginBottom: 10, padding: '6px 12px', background: '#e6fafd',
            borderRadius: 6, border: '1px solid rgba(31,174,194,0.3)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Text style={{ fontSize: 12, color: '#1faec2', fontWeight: 600 }}>
              Saldo CxP al cierre de {periodLabel}
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>(corte {data.asOf})</Text>
          </div>

          {/* KPI Cards — clickeables para ordenar y resaltar columna */}
          <div style={{ display: 'grid', gridTemplateColumns: kpiGridCols, gap: 8, marginBottom: 14, marginTop: 8 }}>
            {BUCKET_KEYS.map(key => (
              <Card
                key={key}
                size="small"
                style={{
                  textAlign: 'center', cursor: 'pointer',
                  borderColor: highlightBucket === key ? BUCKET_COLORS[key] : `${BUCKET_COLORS[key]}33`,
                  background: highlightBucket === key ? `${BUCKET_COLORS[key]}11` : '#fff',
                  boxShadow: highlightBucket === key ? `0 0 0 2px ${BUCKET_COLORS[key]}44` : 'none',
                  transition: 'all 0.2s',
                }}
                onClick={() => handleKpiClick(key)}
              >
                <Statistic
                  title={<span style={{ fontSize: 10, color: BUCKET_COLORS[key] }}>{BUCKET_LABELS[key]}</span>}
                  value={data.buckets[key].total}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: 13, color: BUCKET_COLORS[key], fontWeight: 600 }}
                />
                <Text style={{ fontSize: 10, color: '#9aa1ab' }}>{data.buckets[key].count} fact.</Text>
              </Card>
            ))}

            <Card size="small" style={{ textAlign: 'center', background: '#1B3A6B', borderColor: '#1B3A6B' }}>
              <Statistic
                title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>TOTAL CxP</span>}
                value={data.grandTotal}
                prefix="Q"
                precision={2}
                valueStyle={{ fontSize: 13, color: '#fff', fontWeight: 700 }}
              />
            </Card>

            {showAdvances && (
              <>
                <Card size="small" style={{ textAlign: 'center', background: '#e8f5ef', borderColor: '#2ea17244' }}>
                  <Statistic
                    title={<span style={{ fontSize: 10, color: '#2ea172' }}>Anticipos</span>}
                    value={data.totalAdvances ?? 0}
                    prefix="Q"
                    precision={2}
                    valueStyle={{ fontSize: 13, color: '#2ea172', fontWeight: 600 }}
                  />
                </Card>
                <Card
                  size="small"
                  style={{
                    textAlign: 'center',
                    background: (data.netTotal ?? data.grandTotal) <= 0 ? '#e8f5ef' : '#fef2f2',
                    borderColor: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea17244' : '#e5484d44',
                  }}
                >
                  <Statistic
                    title={<span style={{ fontSize: 10, color: '#6b7280' }}>Neto CxP</span>}
                    value={Math.abs(data.netTotal ?? data.grandTotal)}
                    prefix={(data.netTotal ?? data.grandTotal) < 0 ? '(A fav) Q' : 'Q'}
                    precision={2}
                    valueStyle={{
                      fontSize: 13, fontWeight: 700,
                      color: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea172' : '#e5484d',
                    }}
                  />
                </Card>
              </>
            )}
          </div>

          {/* Top 5 proveedores con mayor urgencia */}
          {top5.length > 0 && (
            <div style={{
              marginBottom: 14, padding: '10px 14px',
              background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FireOutlined style={{ color: '#e5484d' }} />
                <Text strong style={{ fontSize: 13, color: '#e5484d' }}>
                  Atención — {top5.length} proveedor{top5.length > 1 ? 'es' : ''} con saldos vencidos +60 días
                </Text>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${top5.length}, 1fr)`, gap: 8 }}>
                {top5.map(v => (
                  <div key={v.vendorId} style={{
                    background: '#fff', borderRadius: 6, padding: '8px 10px',
                    border: '1px solid #fca5a5',
                  }}>
                    <Text strong style={{ fontSize: 11, display: 'block', color: '#374151', marginBottom: 2 }}>
                      {v.vendorName.length > 24 ? v.vendorName.slice(0, 24) + '…' : v.vendorName}
                    </Text>
                    {v.over_90 > 0 && (
                      <Text style={{ fontSize: 12, color: '#991b1b', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                        +90d: <strong>{fmt(v.over_90)}</strong>
                      </Text>
                    )}
                    {v.days_90 > 0 && (
                      <Text style={{ fontSize: 12, color: '#e5484d', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                        61-90d: {fmt(v.days_90)}
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, color: '#6b7280' }}>Total: {fmt(v.total)}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalOverdue > 0 && top5.length === 0 && (
            <div style={{
              padding: '10px 16px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fca5a5', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <WarningOutlined style={{ color: '#e5484d' }} />
              <Text style={{ color: '#e5484d', fontWeight: 500, fontSize: 13 }}>
                Saldos vencidos +60 días: {fmt(totalOverdue)}
              </Text>
            </div>
          )}

          {totalBalance === 0 && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#2ea172', marginBottom: 12 }} />
              <div>
                <Text style={{ color: '#2ea172', fontSize: 15 }}>
                  No hay saldos pendientes de pago al cierre de {periodLabel}.
                </Text>
              </div>
            </div>
          )}

          {totalBalance > 0 && (
            <Table
              columns={columns}
              dataSource={vendorRows}
              rowKey="vendorId"
              size="small"
              expandable={{ expandedRowRender, rowExpandable: row => row.invoices.length > 0 }}
              pagination={{ pageSize: 30, showTotal: t => `${t} proveedores`, showSizeChanger: true, pageSizeOptions: ['15', '30', '50', '100'] }}
              onChange={handleTableChange}
              summary={summaryRow}
              scroll={{ x: 'max-content' }}
              loading={loading}
            />
          )}

          <div style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, color: '#9aa1ab' }}>
              Generado: {new Date(data.generatedAt).toLocaleString('es-GT')}
              {' · '}Corte: {data.asOf}
            </Text>
          </div>
        </>
      )}

      {!data && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa1ab' }}>
            Seleccione el mes de cierre y presione <strong>Generar</strong> para ver las Cuentas por Pagar.
          </div>
        </Card>
      )}
    </div>
  )
}
