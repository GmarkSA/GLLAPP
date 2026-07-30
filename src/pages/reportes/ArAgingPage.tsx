import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Spin, Tag, Statistic,
  Row, Col, Select, Space,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  SwapOutlined, SearchOutlined, AuditOutlined, ArrowLeftOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

import { getArAging, type ArAgingRow, type ArAgingBucket, type ArAgingPayment } from '../../api/facturas'

const { Title, Text } = Typography

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash:            'Efectivo',
  bank_transfer:   'Transferencia',
  check:           'Cheque',
  credit_card:     'Tarjeta crédito',
  debit_card:      'Tarjeta débito',
  online_payment:  'Pago en línea',
  other:           'Otro',
}

function PaymentsSubTable({ payments, currency }: { payments: ArAgingPayment[]; currency: string }) {
  return (
    <div style={{ padding: '8px 48px 8px 48px', background: '#f8fafc', borderTop: '1px dashed #e2e8f0' }}>
      <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 6 }}>
        ABONOS APLICADOS
      </Text>
      <Table<ArAgingPayment>
        size="small"
        pagination={false}
        dataSource={payments}
        rowKey={(_, i) => String(i)}
        style={{ maxWidth: 700 }}
        columns={[
          {
            title: 'N° Pago',
            dataIndex: 'paymentNumber',
            width: 160,
            render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2', fontWeight: 600 }}>{v || '—'}</Text>,
          },
          {
            title: 'Fecha de abono',
            dataIndex: 'paymentDate',
            width: 120,
            render: (v: string) => v
              ? <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString('es-GT')}</Text>
              : <Text type="secondary">—</Text>,
          },
          {
            title: 'Monto abonado',
            dataIndex: 'amount',
            width: 140,
            align: 'right' as const,
            render: (v: number) => (
              <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172', fontWeight: 700 }}>
                {currency !== 'GTQ' ? `${currency} ` : 'Q '}
                {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            ),
          },
          {
            title: 'Forma de pago',
            dataIndex: 'mode',
            width: 140,
            render: (v: string) => v
              ? <Tag style={{ fontSize: 11 }}>{PAYMENT_MODE_LABELS[v] ?? v}</Tag>
              : <Text type="secondary">—</Text>,
          },
          {
            title: 'Referencia',
            dataIndex: 'reference',
            ellipsis: true,
            render: (v: string) => v
              ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
              : <Text type="secondary">—</Text>,
          },
        ]}
      />
    </div>
  )
}

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

const ageBucketColor: Record<string, string> = {
  current: '#2ea172',
  days_30: '#1faec2',
  days_60: '#ff7f00',
  days_90: '#e5484d',
  over_90: '#e5484d',
}

type SubtotalRow = { _isSubtotal: true; _rowKey: string; _label: string; _totTotal: number; _totSaldo: number }
type UnifiedArRow = (ArAgingRow & { _isAdvance?: false }) | (any & { _isAdvance: true; _rowKey: string }) | SubtotalRow

const unifiedColumns = [
  {
    title: 'Documento',
    width: 160,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 5, style: { background: '#f8fafc' } } : {},
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal) return (
        <Text strong style={{ fontSize: 12, color: '#374151' }}>Subtotal — {(row as SubtotalRow)._label}</Text>
      )
      if (row._isAdvance) return <span style={{ fontWeight: 600, fontSize: 13, color: '#2ea172' }}>{row.advanceNumber}</span>
      return <Link to={`/ventas/facturas/${(row as ArAgingRow).id}`} style={{ fontWeight: 600, fontSize: 13 }}>{(row as ArAgingRow).invoiceNumber}</Link>
    },
  },
  {
    title: 'Cliente',
    dataIndex: 'customerName',
    ellipsis: true,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 0 } : {},
    render: (v: string, row: any) => (row as any)._isSubtotal ? null : v,
  },
  {
    title: 'Fecha',
    width: 100,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 0 } : {},
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal) return null
      const v = row._isAdvance ? row.advanceDate : (row as ArAgingRow).invoiceDate
      return v ? new Date(v).toLocaleDateString('es-GT') : '—'
    },
  },
  {
    title: 'Vencimiento',
    width: 110,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 0 } : {},
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal || row._isAdvance) return null
      const v = (row as ArAgingRow).dueDate
      return v ? new Date(v).toLocaleDateString('es-GT') : '—'
    },
  },
  {
    title: 'Estado',
    width: 120,
    align: 'right' as const,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 0 } : {},
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal) return null
      if (row._isAdvance) return <Tag color="#2ea172" style={{ fontWeight: 600 }}>Anticipo</Tag>
      const r = row as ArAgingRow
      return r.daysOverdue <= 0
        ? <Tag color="#2ea172">Vigente</Tag>
        : <Tag color={r.daysOverdue > 90 ? '#6b7280' : r.daysOverdue > 60 ? '#e5484d' : r.daysOverdue > 30 ? '#ff7f00' : '#1faec2'}>{r.daysOverdue} días</Tag>
    },
  },
  {
    title: 'Total factura',
    width: 130,
    align: 'right' as const,
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal) {
        const s = row as SubtotalRow
        return <Text strong style={{ fontSize: 12, color: s._totTotal >= 0 ? '#374151' : '#2ea172' }}>
          {s._totTotal >= 0 ? fmt(s._totTotal) : `(${fmt(Math.abs(s._totTotal))})`}
        </Text>
      }
      if (row._isAdvance) return <Text style={{ fontSize: 13, color: '#2ea172' }}>({fmt(Number(row.amount))})</Text>
      const r = row as ArAgingRow
      return r.currency && r.currency !== 'GTQ' ? (
        <div style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
            {r.currency} {r.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </Text>
          <br />
          <Text style={{ fontSize: 11, color: '#6b7280' }}>
            Q {(r.totalGTQ ?? r.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </Text>
        </div>
      ) : <Text style={{ fontSize: 13 }}>{fmt(r.total)}</Text>
    },
  },
  {
    title: 'Abonado',
    width: 120,
    align: 'right' as const,
    onCell: (row: any) => (row as any)._isSubtotal ? { colSpan: 0 } : {},
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal || row._isAdvance) return null
      const r = row as ArAgingRow
      return (r.paidAmount ?? 0) > 0 ? (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172', fontWeight: 600 }}>
          {r.currency !== 'GTQ' ? `${r.currency} ` : 'Q '}
          {r.paidAmount!.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </Text>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
    },
  },
  {
    title: 'Saldo pendiente',
    width: 150,
    align: 'right' as const,
    render: (_: any, row: any) => {
      if ((row as any)._isSubtotal) {
        const s = row as SubtotalRow
        return <Text strong style={{ fontSize: 12, color: s._totSaldo >= 0 ? '#1faec2' : '#2ea172' }}>
          {s._totSaldo >= 0 ? fmt(s._totSaldo) : `(${fmt(Math.abs(s._totSaldo))})`}
        </Text>
      }
      if (row._isAdvance) return <Text style={{ fontWeight: 700, color: '#2ea172', fontSize: 13 }}>({fmt(Number(row.balance))})</Text>
      const r = row as ArAgingRow
      return r.currency && r.currency !== 'GTQ' ? (
        <div style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            {r.currency} {r.balance.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </Text>
          <br />
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#1faec2' }}>
            Q {(r.balanceGTQ ?? r.balance).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </Text>
        </div>
      ) : <Text style={{ fontWeight: 700, color: '#1faec2', fontSize: 13 }}>{fmt(r.balance)}</Text>
    },
  },
]

interface BucketCardProps {
  label:       string
  bucket:      ArAgingBucket
  color:       string
  expanded:    boolean
  onToggle:    () => void
  advances?:   any[]
  showAdvances?: boolean
}

function BucketCard({ label, bucket, color, expanded, onToggle, advances, showAdvances }: BucketCardProps) {
  const visibleAdvances = showAdvances && advances && advances.length > 0
    ? advances.map((a: any) => ({ ...a, _isAdvance: true as const, _rowKey: `adv-${a.id}` }))
    : []

  // Agrupar por cliente e intercalar filas de subtotal
  const customerMap = new Map<string, { name: string; items: any[] }>()
  for (const item of bucket.items) {
    const key = (item as any).customerId || '__sin__'
    if (!customerMap.has(key)) customerMap.set(key, { name: (item as any).customerName || '—', items: [] })
    customerMap.get(key)!.items.push(item)
  }
  for (const adv of visibleAdvances) {
    const key = (adv as any).customerId || '__sin__'
    if (!customerMap.has(key)) customerMap.set(key, { name: (adv as any).customerName || '—', items: [] })
    customerMap.get(key)!.items.push(adv)
  }

  const rows: any[] = []
  let grandT = 0; let grandS = 0
  for (const [, customer] of customerMap) {
    rows.push(...customer.items)
    const subT = customer.items.reduce((s: number, r: any) =>
      s + (r._isAdvance ? -Number(r.amount ?? 0) : Number(r.totalGTQ ?? r.total ?? 0)), 0)
    const subS = customer.items.reduce((s: number, r: any) =>
      s + (r._isAdvance ? -Number(r.balance ?? 0) : Number(r.balanceGTQ ?? r.balance ?? 0)), 0)
    grandT += subT; grandS += subS
    rows.push({ _isSubtotal: true, _rowKey: `sub-${customer.name}`, _label: customer.name, _totTotal: subT, _totSaldo: subS })
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 12, border: '1px solid rgba(10,10,10,0.08)', borderLeft: `3px solid ${color}`, borderRadius: 8 }}
      styles={{ header: { background: 'transparent', borderBottom: '1px solid rgba(10,10,10,0.06)' } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color, fontWeight: 700 }}>{label}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{bucket.count} facturas</Text>
            {visibleAdvances.length > 0 && (
              <Text style={{ fontSize: 12, color: '#2ea172' }}>
                + {visibleAdvances.length} anticipo{visibleAdvances.length > 1 ? 's' : ''}
              </Text>
            )}
            <Text style={{ fontWeight: 700, color, fontSize: 14 }}>{fmt(bucket.total)}</Text>
            <Button size="small" type="text" onClick={onToggle} style={{ color: '#9aa1ab', fontSize: 12 }}>
              {expanded ? 'Ocultar' : 'Ver detalle'}
            </Button>
          </div>
        </div>
      }
    >
      {expanded && rows.length > 0 && (
        <Table
          dataSource={rows}
          columns={unifiedColumns}
          rowKey={(r: any) => r._isSubtotal ? r._rowKey : r._isAdvance ? r._rowKey : (r as ArAgingRow).id}
          pagination={false}
          size="small"
          style={{ marginTop: 4 }}
          rowClassName={(r: any) => r._isSubtotal ? 'aging-row-subtotal' : r._isAdvance ? 'aging-row-advance' : ''}
          expandable={{
            expandedRowRender: (row: any) => {
              if (row._isSubtotal || row._isAdvance) return null
              const r = row as ArAgingRow
              return r.payments && r.payments.length > 0
                ? <PaymentsSubTable payments={r.payments} currency={r.currency} />
                : <div style={{ padding: '8px 48px', color: '#9aa1ab', fontSize: 12 }}>Sin abonos registrados al corte.</div>
            },
            rowExpandable: (row: any) => !row._isSubtotal && !row._isAdvance && ((row as ArAgingRow).paidAmount ?? 0) > 0,
            expandRowByClick: false,
          }}
          summary={() => (
            <Table.Summary.Row style={{ background: '#e6fafd', fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Text strong style={{ fontSize: 12, color: '#1B3A6B' }}>TOTAL GENERAL</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ fontSize: 12, color: grandT >= 0 ? '#374151' : '#2ea172' }}>
                  {grandT >= 0 ? fmt(grandT) : `(${fmt(Math.abs(grandT))})`}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={0} />
              <Table.Summary.Cell index={7} align="right">
                <Text strong style={{ fontSize: 12, color: grandS >= 0 ? '#1faec2' : '#2ea172' }}>
                  {grandS >= 0 ? fmt(grandS) : `(${fmt(Math.abs(grandS))})`}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      )}

      {expanded && rows.length === 0 && (
        <Text style={{ color: '#9aa1ab', fontSize: 12 }}>Sin facturas en este rango.</Text>
      )}
    </Card>
  )
}

export default function ArAgingPage() {
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(dayjs().year())
  const [data,          setData]          = useState<any>(null)
  const [loading,       setLoading]       = useState(false)
  const [showAdvances,  setShowAdvances]  = useState(true)
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({
    current: false, days_30: false, days_60: false, days_90: false, over_90: false,
  })

  const asOf = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month').format('YYYY-MM-DD')
  const periodLabel = MESES.find(m => m.value === selectedMonth)?.label + ' ' + selectedYear

  const load = () => {
    setLoading(true)
    getArAging(asOf)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const handleExcel = () => {
    if (!data) return
    const customerMap = new Map<string, { name: string; invoices: any[]; advances: any[] }>()

    for (const [bucketKey, bucket] of Object.entries(data.buckets) as [string, ArAgingBucket][]) {
      for (const item of (bucket as ArAgingBucket).items) {
        const key = item.customerId || '__sin__'
        if (!customerMap.has(key)) customerMap.set(key, { name: item.customerName || '—', invoices: [], advances: [] })
        customerMap.get(key)!.invoices.push({ ...item, _bucketLabel: bucket.label })
      }
    }
    for (const adv of data.advances ?? []) {
      const key = adv.customerId || '__sin__'
      if (!customerMap.has(key)) customerMap.set(key, { name: adv.customerName || '—', invoices: [], advances: [] })
      customerMap.get(key)!.advances.push(adv)
    }

    const fmtXls = (n: number) => Math.round(n * 100) / 100
    const xlsRows: any[][] = []
    xlsRows.push([`AR Aging — Cuentas por Cobrar — Corte: ${data.asOf}`])
    xlsRows.push([])
    xlsRows.push(['Documento', 'Cliente', 'Fecha', 'Vencimiento', 'Bucket', 'Estado', 'Total (GTQ)', 'Saldo (GTQ)'])

    let grandTotal = 0
    let grandBalance = 0

    for (const [, customer] of customerMap) {
      let subtotalTotal = 0
      let subtotalBalance = 0

      for (const inv of customer.invoices) {
        const total   = Number(inv.totalGTQ   ?? inv.total   ?? 0)
        const balance = Number(inv.balanceGTQ ?? inv.balance ?? 0)
        subtotalTotal   += total
        subtotalBalance += balance
        xlsRows.push([
          inv.invoiceNumber,
          inv.customerName,
          inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('es-GT') : '',
          inv.dueDate     ? new Date(inv.dueDate).toLocaleDateString('es-GT')     : '',
          inv._bucketLabel,
          inv.daysOverdue <= 0 ? 'Vigente' : `${inv.daysOverdue} días`,
          fmtXls(total),
          fmtXls(balance),
        ])
      }

      for (const adv of customer.advances) {
        const amount  = -Number(adv.amount  ?? 0)
        const balance = -Number(adv.balance ?? 0)
        subtotalTotal   += amount
        subtotalBalance += balance
        xlsRows.push([
          adv.advanceNumber,
          adv.customerName,
          adv.advanceDate ? new Date(adv.advanceDate).toLocaleDateString('es-GT') : '',
          '',
          'Vigente',
          'Anticipo',
          fmtXls(amount),
          fmtXls(balance),
        ])
      }

      grandTotal   += subtotalTotal
      grandBalance += subtotalBalance
      xlsRows.push(['', `SUBTOTAL — ${customer.name}`, '', '', '', '', fmtXls(subtotalTotal), fmtXls(subtotalBalance)])
      xlsRows.push([])
    }

    xlsRows.push(['', 'TOTAL GENERAL', '', '', '', '', fmtXls(grandTotal), fmtXls(grandBalance)])

    const ws = XLSX.utils.aoa_to_sheet(xlsRows)
    ws['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'AR Aging')
    XLSX.writeFile(wb, `ar-aging-${data.asOf}.xlsx`)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Ventas' },
          { title: 'AR Aging — Antigüedad de Saldos' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <AuditOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            AR Aging — Cuentas por Cobrar
          </Title>
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
            <>
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                Actualizar
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                style={{ background: '#217346', borderColor: '#217346', color: '#fff' }}
                onClick={handleExcel}
              >
                Excel
              </Button>
            </>
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
            marginBottom: 12, padding: '6px 12px', background: '#e6fafd',
            borderRadius: 6, border: '1px solid rgba(31,174,194,0.3)', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Text style={{ fontSize: 12, color: '#1faec2', fontWeight: 600 }}>
              Saldo CxC al cierre de {periodLabel}
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              (corte {data.asOf})
            </Text>
          </div>

          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Vigente',    value: data.buckets.current.total, color: '#2ea172' },
              { label: '1-30 días',  value: data.buckets.days_30.total, color: '#1faec2' },
              { label: '31-60 días', value: data.buckets.days_60.total, color: '#ff7f00' },
              { label: '61-90 días', value: data.buckets.days_90.total, color: '#e5484d' },
              { label: '+90 días',   value: data.buckets.over_90.total, color: '#e5484d' },
            ].map(({ label, value, color }) => (
              <Col key={label} span={showAdvances ? 3 : 4}>
                <Card size="small" style={{ textAlign: 'center', borderColor: `${color}22` }}>
                  <Statistic
                    title={<span style={{ fontSize: 11, color }}>{label}</span>}
                    value={value}
                    prefix="Q"
                    precision={2}
                    valueStyle={{ fontSize: showAdvances ? 14 : 16, color }}
                  />
                </Card>
              </Col>
            ))}
            <Col span={showAdvances ? 3 : 4}>
              <Card size="small" style={{ textAlign: 'center', background: '#1faec2', borderColor: '#1faec2' }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>TOTAL CxC</span>}
                  value={data.grandTotal}
                  prefix="Q"
                  precision={2}
                  valueStyle={{ fontSize: showAdvances ? 14 : 16, color: '#fff', fontWeight: 700 }}
                />
              </Card>
            </Col>
            {showAdvances && (
              <>
                <Col span={3}>
                  <Card size="small" style={{ textAlign: 'center', borderColor: '#2ea17244', background: '#e8f5ef' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11, color: '#2ea172' }}>Anticipos</span>}
                      value={data.totalAdvances ?? 0}
                      prefix="Q"
                      precision={2}
                      valueStyle={{ fontSize: 14, color: '#2ea172', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col span={3}>
                  <Card size="small" style={{
                    textAlign: 'center',
                    background: (data.netTotal ?? data.grandTotal) <= 0 ? '#e8f5ef' : '#e6fafd',
                    borderColor: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea17244' : '#1faec244',
                  }}>
                    <Statistic
                      title={<span style={{ fontSize: 11, color: '#6b7280' }}>Neto CxC</span>}
                      value={Math.abs(data.netTotal ?? data.grandTotal)}
                      prefix={(data.netTotal ?? data.grandTotal) < 0 ? '(A fav) Q' : 'Q'}
                      precision={2}
                      valueStyle={{
                        fontSize: 14, fontWeight: 700,
                        color: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea172' : '#1faec2',
                      }}
                    />
                  </Card>
                </Col>
              </>
            )}
          </Row>

          {(data.buckets.days_90.total + data.buckets.over_90.total) > 0 && (
            <div style={{
              padding: '10px 16px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fca5a5', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <WarningOutlined style={{ color: '#e5484d' }} />
              <Text style={{ color: '#e5484d', fontWeight: 500, fontSize: 13 }}>
                Tiene cuentas vencidas por más de 60 días: {fmt(data.buckets.days_90.total + data.buckets.over_90.total)}
              </Text>
            </div>
          )}

          {(data.buckets.current.total + data.buckets.days_30.total + data.buckets.days_60.total + data.buckets.days_90.total + data.buckets.over_90.total) === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#2ea172', marginBottom: 12 }} />
              <div><Text style={{ color: '#2ea172', fontSize: 15 }}>No hay saldos pendientes de cobro al cierre de {periodLabel}.</Text></div>
            </div>
          )}

          {(Object.entries(data.buckets) as [string, ArAgingBucket][]).map(([key, bucket]) => (
            <BucketCard
              key={key}
              label={bucket.label}
              bucket={bucket}
              color={ageBucketColor[key] ?? '#6b7280'}
              expanded={expanded[key]}
              onToggle={() => toggle(key)}
              advances={key === 'current' ? (data.advances ?? []) : undefined}
              showAdvances={showAdvances}
            />
          ))}

          <Text style={{ fontSize: 11, color: '#9aa1ab' }}>
            Generado: {new Date(data.generatedAt).toLocaleString('es-GT')}
            {' · '}Corte: {data.asOf}
          </Text>
        </>
      )}

      {!data && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa1ab' }}>
            Seleccione el mes de cierre y presione <strong>Generar</strong> para ver las Cuentas por Cobrar.
          </div>
        </Card>
      )}
    </div>
  )
}
