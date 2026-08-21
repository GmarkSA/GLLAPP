import { useEffect, useState } from 'react'
import { Card, Table, Typography, Tag, Statistic, Row, Col, Space, Input } from 'antd'
import { SearchOutlined, CheckCircleOutlined, WarningOutlined, AccountBookOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import AccountDrilldownDrawer, { type DrilldownTarget } from '../../components/AccountDrilldownDrawer'
import { getBalanza, type BalanzaData, type AccountRow } from '../../api/reportes'

const { Text } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const BALANCE_COLOR: Record<string, string> = {
  'Activo':          'blue',
  'Activo Fijo':     'geekblue',
  'Pasivo':          'red',
  'Capital':         'purple',
  'Ingresos':        'green',
  'Costos':          'orange',
  'Gastos':          'volcano',
  'Otros Ingresos':  'cyan',
  'Otros Gastos':    'magenta',
  'Cuentas de Orden':'default',
}

export default function BalanzaPage() {
  const [from,    setFrom]    = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [to,      setTo]      = useState(dayjs().format('YYYY-MM-DD'))
  const [data,    setData]    = useState<BalanzaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  const fetchData = async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getBalanza({ fromDate: f, toDate: t })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando Balanza de Comprobación')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(from, to) }, [from, to])

  const filtered = data?.accounts.filter(a =>
    !search || a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()) || (a.balance_type || '').toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <ReportLayout
      icon={<AccountBookOutlined />}
      title="Balanza de Comprobación"
      subtitle="Verificación de Partida Doble · Libro Mayor"
      tipoExport="balanza"
      loading={loading}
      error={error}
      fromDate={from}
      toDate={to}
      onRangeChange={(f, t) => { setFrom(f); setTo(t) }}
      exportParams={{ fromDate: from, toDate: to }}
    >
      {data && (
        <>
          {/* Balance check */}
          <div style={{ marginBottom: 16 }}>
            {data.balanced ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Partida doble cuadrada · Débitos = Créditos
              </Tag>
            ) : (
              <Tag icon={<WarningOutlined />} color="error">
                Desequilibrio: Q {fmtQ(Math.abs(data.totalDebit - data.totalCredit))}
              </Tag>
            )}
            <Tag style={{ marginLeft: 8 }}>Del {data.period.from} al {data.period.to}</Tag>
          </div>

          {/* KPI */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Débitos',  value: data.totalDebit,  color: '#1faec2' },
              { label: 'Total Créditos', value: data.totalCredit, color: '#6b7280' },
              { label: 'Cuentas activas', value: data.accounts.length, color: '#ff7f00', prefix: '#', precision: 0 },
              { label: 'Con movimientos', value: data.accounts.filter(a => a.total_debit > 0 || a.total_credit > 0).length, color: '#2ea172', prefix: '#', precision: 0 },
            ].map(k => (
              <Col xs={12} sm={6} key={k.label}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                    value={k.value}
                    precision={k.precision ?? 2}
                    prefix={k.prefix ?? 'Q'}
                    valueStyle={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: k.color }}
                    formatter={v => typeof v === 'number' && (k.precision ?? 2) > 0
                      ? v.toLocaleString('es-GT', { minimumFractionDigits: 2 })
                      : String(v)
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <Input
              placeholder="Buscar por código, nombre o tipo..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              style={{ width: 320 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </div>

          {/* Table */}
          <Card
            style={{ borderRadius: 8 }}
            bodyStyle={{ padding: 0 }}
            size="small"
          >
            <Table
              size="small"
              dataSource={filtered}
              rowKey="id"
              scroll={{ x: "max-content", y: "calc(100vh - 300px)", y: 'calc(100vh - 440px)' }}
              pagination={{ pageSize: 50, showTotal: t => `${t} cuentas`, showSizeChanger: false }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fafbfc', fontWeight: 700 }}>
                    <Table.Summary.Cell index={0} />
                    <Table.Summary.Cell index={1}><Text strong>TOTALES</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>
                        {fmtQ(data.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>
                        {fmtQ(data.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: data.balanced ? '#2ea172' : '#e5484d' }}>
                        {fmtQ(Math.abs(data.totalDebit - data.totalCredit))}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
              columns={[
                {
                  title: 'Código',
                  dataIndex: 'code',
                  width: 90,
                  sorter: (a, b) => a.code.localeCompare(b.code),
                  render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{v}</Text>,
                },
                {
                  title: 'Cuenta',
                  dataIndex: 'name',
                  render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: 'Tipo',
                  dataIndex: 'balance_type',
                  width: 130,
                  filters: Object.keys(BALANCE_COLOR).map(k => ({ text: k, value: k })),
                  onFilter: (v, r) => r.balance_type === v,
                  render: (v: string) => <Tag color={BALANCE_COLOR[v] || 'default'} style={{ fontSize: 10 }}>{v}</Tag>,
                },
                {
                  title: 'Débito',
                  dataIndex: 'total_debit',
                  width: 130,
                  align: 'right' as const,
                  sorter: (a, b) => a.total_debit - b.total_debit,
                  render: (v: number) => (
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: v > 0 ? '#1faec2' : 'rgba(10,10,10,0.08)' }}>
                      {fmtQ(v)}
                    </Text>
                  ),
                },
                {
                  title: 'Crédito',
                  dataIndex: 'total_credit',
                  width: 130,
                  align: 'right' as const,
                  sorter: (a, b) => a.total_credit - b.total_credit,
                  render: (v: number) => (
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: v > 0 ? '#6b7280' : 'rgba(10,10,10,0.08)' }}>
                      {fmtQ(v)}
                    </Text>
                  ),
                },
                {
                  title: 'Saldo',
                  dataIndex: 'balance',
                  width: 130,
                  align: 'right' as const,
                  sorter: (a, b) => a.balance - b.balance,
                  render: (v: number, row: AccountRow) => (
                    <span
                      style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                      onClick={() => setDrilldown({ accountId: row.id, accountName: row.name, fromDate: from, toDate: to })}
                    >
                      <Text strong style={{
                        fontVariantNumeric: 'tabular-nums', fontSize: 11,
                        color: Math.abs(v) > 0.001 ? (v > 0 ? '#2ea172' : '#e5484d') : 'rgba(10,10,10,0.08)',
                      }}>
                        {v < 0 ? `(${fmtQ(Math.abs(v))})` : fmtQ(v)}
                      </Text>
                    </span>
                  ),
                },
              ]}
            />
          </Card>
          <AccountDrilldownDrawer target={drilldown} onClose={() => setDrilldown(null)} />
        </>
      )}
    </ReportLayout>
  )
}
