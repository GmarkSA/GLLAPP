import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Spin, Tag, Statistic,
  Row, Col, Divider, Select, Space,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  SwapOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

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
            render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B', fontWeight: 600 }}>{v || '—'}</Text>,
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
              <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
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
  current: '#16a34a',
  days_30: '#2563eb',
  days_60: '#d97706',
  days_90: '#dc2626',
  over_90: '#7c3aed',
}

const invoiceColumns = [
  {
    title: 'Factura',
    dataIndex: 'invoiceNumber',
    width: 160,
    render: (v: string, row: ArAgingRow) => (
      <Link to={`/ventas/facturas/${row.id}`} style={{ fontWeight: 600, fontSize: 13 }}>{v}</Link>
    ),
  },
  {
    title: 'Cliente',
    dataIndex: 'customerName',
    ellipsis: true,
  },
  {
    title: 'Fecha',
    dataIndex: 'invoiceDate',
    width: 100,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'Vencimiento',
    dataIndex: 'dueDate',
    width: 110,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'Días vencido',
    dataIndex: 'daysOverdue',
    width: 110,
    align: 'right' as const,
    render: (v: number) => v <= 0
      ? <Tag color="green">Vigente</Tag>
      : <Tag color={v > 90 ? 'purple' : v > 60 ? 'red' : v > 30 ? 'orange' : 'blue'}>{v} días</Tag>,
  },
  {
    title: 'Total factura',
    dataIndex: 'total',
    width: 130,
    align: 'right' as const,
    render: (v: number, row: ArAgingRow) => (
      <div style={{ textAlign: 'right' }}>
        {row.currency && row.currency !== 'GTQ' ? (
          <>
            <Text style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
              {row.currency} {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </Text>
            <br />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              Q {(row.totalGTQ ?? v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 13 }}>{fmt(v)}</Text>
        )}
      </div>
    ),
  },
  {
    title: 'Abonado',
    dataIndex: 'paidAmount',
    width: 120,
    align: 'right' as const,
    render: (v: number, row: ArAgingRow) => v > 0 ? (
      <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
        {row.currency !== 'GTQ' ? `${row.currency} ` : 'Q '}
        {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
      </Text>
    ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
  },
  {
    title: 'Saldo pendiente',
    dataIndex: 'balance',
    width: 150,
    align: 'right' as const,
    render: (v: number, row: ArAgingRow) => (
      <div style={{ textAlign: 'right' }}>
        {row.currency && row.currency !== 'GTQ' ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>
              {row.currency} {v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </Text>
            <br />
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#1B3A6B' }}>
              Q {(row.balanceGTQ ?? v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </Text>
          </>
        ) : (
          <Text style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 13 }}>{fmt(v)}</Text>
        )}
      </div>
    ),
  },
]

const advanceColumns = [
  {
    title: 'Anticipo',
    dataIndex: 'advanceNumber',
    width: 160,
    render: (v: string) => (
      <span style={{ fontWeight: 600, fontSize: 13, color: '#16a34a' }}>{v}</span>
    ),
  },
  {
    title: 'Cliente',
    dataIndex: 'customerName',
    ellipsis: true,
  },
  {
    title: 'Fecha',
    dataIndex: 'advanceDate',
    width: 100,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'Vencimiento',
    width: 110,
    render: () => '—',
  },
  {
    title: 'Estado',
    width: 110,
    align: 'right' as const,
    render: () => <Tag color="green" style={{ fontWeight: 600 }}>Anticipo</Tag>,
  },
  {
    title: 'Recibido',
    dataIndex: 'amount',
    width: 140,
    align: 'right' as const,
    render: (v: number) => (
      <Text style={{ fontSize: 13, color: '#16a34a' }}>({fmt(Number(v))})</Text>
    ),
  },
  {
    title: 'Disponible',
    dataIndex: 'balance',
    width: 150,
    align: 'right' as const,
    render: (v: number) => (
      <Text style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>({fmt(Number(v))})</Text>
    ),
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
  const visibleAdvances = showAdvances && advances && advances.length > 0 ? advances : []
  const totalAdv = visibleAdvances.reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0)

  return (
    <Card
      size="small"
      style={{ marginBottom: 12, border: `1px solid ${color}22` }}
      styles={{ header: { background: `${color}11`, borderBottom: `2px solid ${color}` } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color, fontWeight: 700 }}>{label}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{bucket.count} facturas</Text>
            {visibleAdvances.length > 0 && (
              <Text style={{ fontSize: 12, color: '#16a34a' }}>
                + {visibleAdvances.length} anticipo{visibleAdvances.length > 1 ? 's' : ''}
              </Text>
            )}
            <Text style={{ fontWeight: 700, color, fontSize: 14 }}>{fmt(bucket.total)}</Text>
            <Button size="small" type="text" onClick={onToggle} style={{ color: '#9ca3af', fontSize: 12 }}>
              {expanded ? 'Ocultar' : 'Ver detalle'}
            </Button>
          </div>
        </div>
      }
    >
      {expanded && bucket.items.length > 0 && (
        <Table
          dataSource={bucket.items}
          columns={invoiceColumns}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginTop: 4 }}
          expandable={{
            expandedRowRender: (row: ArAgingRow) =>
              row.payments && row.payments.length > 0
                ? <PaymentsSubTable payments={row.payments} currency={row.currency} />
                : <div style={{ padding: '8px 48px', color: '#9ca3af', fontSize: 12 }}>Sin abonos registrados al corte.</div>,
            rowExpandable: (row: ArAgingRow) => (row.paidAmount ?? 0) > 0,
            expandRowByClick: false,
          }}
        />
      )}

      {expanded && visibleAdvances.length > 0 && (
        <>
          <Divider style={{ margin: '8px 0', borderColor: '#16a34a44' }}>
            <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              Anticipos de clientes — crédito disponible ({fmt(totalAdv)})
            </Text>
          </Divider>
          <Table
            dataSource={visibleAdvances}
            columns={advanceColumns}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 4 }}
            rowClassName={() => 'ant-table-row-advance'}
          />
        </>
      )}

      {expanded && bucket.items.length === 0 && visibleAdvances.length === 0 && (
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Sin facturas en este rango.</Text>
      )}
    </Card>
  )
}

interface NettingRow {
  key:            string
  customerName:   string
  cxc:            number
  anticipo:       number
  neto:           number
  advanceNumbers: string[]
}

function buildCustomerNetting(data: any): NettingRow[] {
  const byCustomer = new Map<string, { name: string; cxc: number; anticipo: number; advanceNumbers: string[] }>()

  const ensure = (key: string, name: string) => {
    if (!byCustomer.has(key)) byCustomer.set(key, { name, cxc: 0, anticipo: 0, advanceNumbers: [] })
    return byCustomer.get(key)!
  }

  for (const bucket of Object.values(data.buckets) as any[]) {
    for (const item of bucket.items ?? []) {
      const key = item.customerId || '__sin__'
      ensure(key, item.customerName || '—').cxc += Number(item.balanceGTQ ?? item.balance ?? 0)
    }
  }
  for (const adv of data.advances ?? []) {
    const key = adv.customerId || '__sin__'
    const entry = ensure(key, adv.customerName || '—')
    entry.anticipo += Number(adv.balance ?? 0)
    if (adv.advanceNumber) entry.advanceNumbers.push(adv.advanceNumber)
  }

  return [...byCustomer.entries()]
    .map(([key, v]) => ({
      key,
      customerName:   v.name,
      cxc:            Math.round(v.cxc * 100) / 100,
      anticipo:       Math.round(v.anticipo * 100) / 100,
      neto:           Math.round((v.cxc - v.anticipo) * 100) / 100,
      advanceNumbers: v.advanceNumbers,
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName, 'es'))
}

export default function ArAgingPage() {
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

  const load = () => {
    setLoading(true)
    getArAging(asOf)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Ventas' },
          { title: 'AR Aging — Antigüedad de Saldos' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          AR Aging — Cuentas por Cobrar
        </Title>
        <Space>
          <Select value={selectedMonth} onChange={setSelectedMonth} options={MESES} style={{ width: 130 }} />
          <Select value={selectedYear}  onChange={setSelectedYear}  options={ANIOS}  style={{ width: 90 }} />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>
            Generar
          </Button>
          <Button
            icon={<SwapOutlined />}
            type={showAdvances ? 'primary' : 'default'}
            style={showAdvances ? { background: '#16a34a', borderColor: '#16a34a' } : {}}
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
            marginBottom: 12, padding: '6px 12px', background: '#eff6ff',
            borderRadius: 6, border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Text style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
              Saldo CxC al cierre de {periodLabel}
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              (corte {data.asOf})
            </Text>
          </div>

          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Vigente',    value: data.buckets.current.total, color: '#16a34a' },
              { label: '1-30 días',  value: data.buckets.days_30.total, color: '#2563eb' },
              { label: '31-60 días', value: data.buckets.days_60.total, color: '#d97706' },
              { label: '61-90 días', value: data.buckets.days_90.total, color: '#dc2626' },
              { label: '+90 días',   value: data.buckets.over_90.total, color: '#7c3aed' },
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
              <Card size="small" style={{ textAlign: 'center', background: '#1B3A6B', borderColor: '#1B3A6B' }}>
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
                  <Card size="small" style={{ textAlign: 'center', borderColor: '#16a34a44', background: '#f0fdf4' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11, color: '#16a34a' }}>Anticipos</span>}
                      value={data.totalAdvances ?? 0}
                      prefix="Q"
                      precision={2}
                      valueStyle={{ fontSize: 14, color: '#16a34a', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col span={3}>
                  <Card size="small" style={{
                    textAlign: 'center',
                    background: (data.netTotal ?? data.grandTotal) <= 0 ? '#f0fdf4' : '#eff6ff',
                    borderColor: (data.netTotal ?? data.grandTotal) <= 0 ? '#16a34a44' : '#2563eb44',
                  }}>
                    <Statistic
                      title={<span style={{ fontSize: 11, color: '#6b7280' }}>Neto CxC</span>}
                      value={Math.abs(data.netTotal ?? data.grandTotal)}
                      prefix={(data.netTotal ?? data.grandTotal) < 0 ? '(A fav) Q' : 'Q'}
                      precision={2}
                      valueStyle={{
                        fontSize: 14, fontWeight: 700,
                        color: (data.netTotal ?? data.grandTotal) <= 0 ? '#16a34a' : '#2563eb',
                      }}
                    />
                  </Card>
                </Col>
              </>
            )}
          </Row>

          {showAdvances && (
            <>
              <Divider orientation={'left' as any} style={{ marginTop: 4, marginBottom: 10 }}>
                <Text style={{ color: '#1B3A6B', fontWeight: 600, fontSize: 13 }}>
                  Posición neta por cliente (CxC − Anticipos)
                </Text>
              </Divider>
              <Table
                size="small"
                pagination={false}
                dataSource={buildCustomerNetting(data)}
                rowKey="key"
                style={{ marginBottom: 20 }}
                summary={rows => {
                  const totCxc = rows.reduce((s, r) => s + r.cxc, 0)
                  const totAdv = rows.reduce((s, r) => s + r.anticipo, 0)
                  const totNet = rows.reduce((s, r) => s + r.neto, 0)
                  return (
                    <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <Table.Summary.Cell index={0}><Text strong>TOTAL</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong style={{ color: '#1B3A6B' }}>{fmt(totCxc)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ color: '#16a34a' }}>({fmt(totAdv)})</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ color: totNet <= 0 ? '#16a34a' : '#2563eb', fontSize: 14 }}>
                          {totNet < 0 ? `(A fav) ${fmt(Math.abs(totNet))}` : fmt(totNet)}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )
                }}
                columns={[
                  { title: 'Cliente', dataIndex: 'customerName', ellipsis: true },
                  {
                    title: 'Facturas CxC',
                    dataIndex: 'cxc',
                    width: 160,
                    align: 'right' as const,
                    render: (v: number) => v > 0
                      ? <Text style={{ color: '#1B3A6B', fontWeight: 600 }}>{fmt(v)}</Text>
                      : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Anticipos (crédito)',
                    dataIndex: 'anticipo',
                    width: 220,
                    align: 'right' as const,
                    render: (v: number, row: NettingRow) => v > 0 ? (
                      <div style={{ textAlign: 'right' }}>
                        {row.advanceNumbers.map(n => (
                          <div key={n} style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, lineHeight: '16px' }}>{n}</div>
                        ))}
                        <Text style={{ color: '#16a34a', fontWeight: 700 }}>({fmt(v)})</Text>
                      </div>
                    ) : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Saldo neto',
                    dataIndex: 'neto',
                    width: 180,
                    align: 'right' as const,
                    render: (v: number) => (
                      <Text style={{ fontWeight: 700, fontSize: 13, color: v < 0 ? '#16a34a' : v === 0 ? '#6b7280' : '#2563eb' }}>
                        {v < 0
                          ? <Tag color="success" style={{ fontWeight: 700 }}>A favor {fmt(Math.abs(v))}</Tag>
                          : v === 0 ? <Tag color="default">Saldado</Tag> : fmt(v)
                        }
                      </Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {(data.buckets.days_90.total + data.buckets.over_90.total) > 0 && (
            <div style={{
              padding: '10px 16px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fca5a5', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <WarningOutlined style={{ color: '#dc2626' }} />
              <Text style={{ color: '#dc2626', fontWeight: 500, fontSize: 13 }}>
                Tiene cuentas vencidas por más de 60 días: {fmt(data.buckets.days_90.total + data.buckets.over_90.total)}
              </Text>
            </div>
          )}

          {(data.buckets.current.total + data.buckets.days_30.total + data.buckets.days_60.total + data.buckets.days_90.total + data.buckets.over_90.total) === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#16a34a', marginBottom: 12 }} />
              <div><Text style={{ color: '#16a34a', fontSize: 15 }}>No hay saldos pendientes de cobro al cierre de {periodLabel}.</Text></div>
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

          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            Generado: {new Date(data.generatedAt).toLocaleString('es-GT')}
            {' · '}Corte: {data.asOf}
          </Text>
        </>
      )}

      {!data && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            Seleccione el mes de cierre y presione <strong>Generar</strong> para ver las Cuentas por Cobrar.
          </div>
        </Card>
      )}
    </div>
  )
}
