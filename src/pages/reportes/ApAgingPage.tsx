import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Spin, Tag, Statistic,
  Row, Col, Divider, Select, Space,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  SwapOutlined, SearchOutlined, AuditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import { getApAging, type ApAgingRow, type ApAgingBucket } from '../../api/compras'

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

const ageBucketColor: Record<string, string> = {
  current: '#2ea172',
  days_30: '#1faec2',
  days_60: '#ff7f00',
  days_90: '#e5484d',
  over_90:  '#e5484d',
}

type UnifiedRow = (ApAgingRow & { _isAdvance?: false }) | (any & { _isAdvance: true; _rowKey: string })

const unifiedColumns = [
  {
    title: 'Documento',
    width: 160,
    render: (_: any, row: UnifiedRow) => row._isAdvance
      ? <span style={{ fontWeight: 600, fontSize: 13, color: '#2ea172' }}>{(row as any).advanceNumber}</span>
      : <Link to={`/compras/facturas/${row.id}`} style={{ fontWeight: 600, fontSize: 13 }}>{(row as any).invoiceNumber}</Link>,
  },
  {
    title: 'Acreedor',
    dataIndex: 'vendorName',
    ellipsis: true,
    render: (v: string, row: UnifiedRow) => (
      <span>
        {v}
        {!row._isAdvance && (row as any).isExpenseReimbursement && (
          <Tag color="#6b7280" style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
            Reembolso
          </Tag>
        )}
      </span>
    ),
  },
  {
    title: 'Fecha',
    width: 100,
    render: (_: any, row: UnifiedRow) => {
      const d = row._isAdvance ? (row as any).advanceDate : (row as any).invoiceDate
      return d ? new Date(d).toLocaleDateString('es-GT') : '—'
    },
  },
  {
    title: 'Vencimiento',
    width: 110,
    render: (_: any, row: UnifiedRow) => {
      if (row._isAdvance) return '—'
      const d = (row as any).dueDate
      return d ? new Date(d).toLocaleDateString('es-GT') : '—'
    },
  },
  {
    title: 'Estado',
    width: 110,
    align: 'right' as const,
    render: (_: any, row: UnifiedRow) => {
      if (row._isAdvance) return <Tag color="#2ea172" style={{ fontWeight: 600 }}>Anticipo</Tag>
      const v = (row as any).daysOverdue as number
      return v <= 0
        ? <Tag color="#2ea172">Vigente</Tag>
        : <Tag color={v > 90 ? '#6b7280' : v > 60 ? '#e5484d' : v > 30 ? '#ff7f00' : '#1faec2'}>{v} días</Tag>
    },
  },
  {
    title: 'Total',
    width: 140,
    align: 'right' as const,
    render: (_: any, row: UnifiedRow) => {
      if (row._isAdvance) {
        return <Text style={{ fontSize: 13, color: '#2ea172' }}>({fmt(Number((row as any).amount))})</Text>
      }
      const v = (row as any).total as number
      const cur = (row as any).currency
      return (
        <div style={{ textAlign: 'right' }}>
          {cur && cur !== 'GTQ' ? (
            <>
              <Text style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                {cur} {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                Q {((row as any).totalGTQ ?? v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 13 }}>{fmt(v)}</Text>
          )}
        </div>
      )
    },
  },
  {
    title: 'Saldo',
    width: 150,
    align: 'right' as const,
    render: (_: any, row: UnifiedRow) => {
      const v = Number((row as any).balance)
      if (row._isAdvance) {
        return <Text style={{ fontWeight: 700, color: '#2ea172', fontSize: 13 }}>({fmt(v)})</Text>
      }
      const cur = (row as any).currency
      return (
        <div style={{ textAlign: 'right' }}>
          {cur && cur !== 'GTQ' ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                {cur} {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <br />
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#1faec2' }}>
                Q {((row as any).balanceGTQ ?? v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </>
          ) : (
            <Text style={{ fontWeight: 700, color: '#1faec2', fontSize: 13 }}>{fmt(v)}</Text>
          )}
        </div>
      )
    },
  },
]

interface BucketCardProps {
  label: string
  bucket: ApAgingBucket
  color: string
  expanded: boolean
  onToggle: () => void
  advances?: any[]
  showAdvances?: boolean
}

function BucketCard({ label, bucket, color, expanded, onToggle, advances, showAdvances }: BucketCardProps) {
  const visibleAdvances = showAdvances && advances && advances.length > 0
    ? advances.map((a: any) => ({ ...a, _isAdvance: true as const, _rowKey: `adv-${a.id}` }))
    : []

  const rows: UnifiedRow[] = [
    ...bucket.items,
    ...visibleAdvances,
  ]

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
          rowKey={(r: any) => r._isAdvance ? r._rowKey : r.id}
          pagination={false}
          size="small"
          style={{ marginTop: 4 }}
          rowClassName={(r: any) => r._isAdvance ? 'aging-row-advance' : ''}
        />
      )}

      {expanded && rows.length === 0 && (
        <Text style={{ color: '#9aa1ab', fontSize: 12 }}>Sin facturas en este rango.</Text>
      )}
    </Card>
  )
}

interface NettingRow {
  key: string
  vendorName: string
  cxp: number
  anticipo: number
  neto: number
  advanceNumbers: string[]
}

function buildVendorNetting(data: any): NettingRow[] {
  const byVendor = new Map<string, { name: string; cxp: number; anticipo: number; advanceNumbers: string[] }>()

  const ensure = (key: string, name: string) => {
    if (!byVendor.has(key)) byVendor.set(key, { name, cxp: 0, anticipo: 0, advanceNumbers: [] })
    return byVendor.get(key)!
  }

  for (const bucket of Object.values(data.buckets) as any[]) {
    for (const item of bucket.items ?? []) {
      const key = item.vendorId || '__sin__'
      ensure(key, item.vendorName || '—').cxp += Number(item.balanceGTQ ?? item.balance ?? 0)
    }
  }
  for (const adv of data.advances ?? []) {
    const key = adv.vendorId || '__sin__'
    const entry = ensure(key, adv.vendorName || '—')
    entry.anticipo += Number(adv.balance ?? 0)
    if (adv.advanceNumber) entry.advanceNumbers.push(adv.advanceNumber)
  }

  return [...byVendor.entries()]
    .map(([key, v]) => ({
      key,
      vendorName:     v.name,
      cxp:            Math.round(v.cxp * 100) / 100,
      anticipo:       Math.round(v.anticipo * 100) / 100,
      neto:           Math.round((v.cxp - v.anticipo) * 100) / 100,
      advanceNumbers: v.advanceNumbers,
    }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'es'))
}

export default function ApAgingPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(dayjs().year())
  const [data,          setData]          = useState<any>(null)
  const [loading,       setLoading]       = useState(false)
  const [showAdvances,  setShowAdvances]  = useState(true)
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({
    current: false, days_30: false, days_60: false, days_90: false, over_90: false,
  })

  // Último día del mes seleccionado → snapshot de cierre
  const asOf = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month').format('YYYY-MM-DD')
  const periodLabel = MESES.find(m => m.value === selectedMonth)?.label + ' ' + selectedYear

  const load = useCallback(() => {
    setLoading(true)
    getApAging(asOf)
      .then(d => {
        setData(d)
        // Auto-expandir buckets con saldo
        setExpanded(prev => ({
          current:  prev.current  || (d.buckets?.current?.count  ?? 0) > 0,
          days_30:  prev.days_30  || (d.buckets?.days_30?.count  ?? 0) > 0,
          days_60:  prev.days_60  || (d.buckets?.days_60?.count  ?? 0) > 0,
          days_90:  prev.days_90  || (d.buckets?.days_90?.count  ?? 0) > 0,
          over_90:  prev.over_90  || (d.buckets?.over_90?.count  ?? 0) > 0,
        }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [asOf])

  // Auto-cargar al abrir la página y al cambiar mes/año
  useEffect(() => { load() }, [load])

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

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
          <AuditOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            AP Aging — Cuentas por Pagar
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
          {/* Etiqueta de período */}
          <div style={{
            marginBottom: 12, padding: '6px 12px', background: '#e6fafd',
            borderRadius: 6, border: '1px solid rgba(31,174,194,0.3)', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Text style={{ fontSize: 12, color: '#1faec2', fontWeight: 600 }}>
              Saldo CxP al cierre de {periodLabel}
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              (corte {data.asOf})
            </Text>
          </div>

          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Vigente',    value: data.buckets.current.total,  color: '#2ea172' },
              { label: '1-30 días',  value: data.buckets.days_30.total,  color: '#1faec2' },
              { label: '31-60 días', value: data.buckets.days_60.total,  color: '#ff7f00' },
              { label: '61-90 días', value: data.buckets.days_90.total,  color: '#e5484d' },
              { label: '+90 días',   value: data.buckets.over_90.total,  color: '#e5484d' },
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
                  title={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>TOTAL CxP</span>}
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
                    background: (data.netTotal ?? data.grandTotal) <= 0 ? '#e8f5ef' : '#fef2f2',
                    borderColor: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea17244' : '#e5484d44',
                  }}>
                    <Statistic
                      title={<span style={{ fontSize: 11, color: '#6b7280' }}>Neto CxP</span>}
                      value={Math.abs(data.netTotal ?? data.grandTotal)}
                      prefix={(data.netTotal ?? data.grandTotal) < 0 ? '(A fav) Q' : 'Q'}
                      precision={2}
                      valueStyle={{
                        fontSize: 14, fontWeight: 700,
                        color: (data.netTotal ?? data.grandTotal) <= 0 ? '#2ea172' : '#e5484d',
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
                Tiene saldos vencidos por más de 60 días: {fmt(data.buckets.days_90.total + data.buckets.over_90.total)}
              </Text>
            </div>
          )}

          {(data.buckets.current.total + data.buckets.days_30.total + data.buckets.days_60.total + data.buckets.days_90.total + data.buckets.over_90.total) === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#2ea172', marginBottom: 12 }} />
              <div><Text style={{ color: '#2ea172', fontSize: 15 }}>No hay saldos pendientes de pago al cierre de {periodLabel}.</Text></div>
            </div>
          )}

          {(Object.entries(data.buckets) as [string, ApAgingBucket][]).map(([key, bucket]) => (
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
            Seleccione el mes de cierre y presione <strong>Generar</strong> para ver las Cuentas por Pagar.
          </div>
        </Card>
      )}
    </div>
  )
}
