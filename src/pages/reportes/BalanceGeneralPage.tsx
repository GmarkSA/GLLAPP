import { useEffect, useState } from 'react'
import { Card, Col, Row, Space, Table, Tag, Typography, Divider, Statistic, Switch } from 'antd'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ReportLayout from '../../components/ReportLayout'
import { getBalanceGeneral, type BalanceGeneralData, type AccountRow } from '../../api/reportes'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const accentColor = (n: number) => (n >= 0 ? '#1B3A6B' : '#cf1322')

function AccountTable({ accounts, total, label }: { accounts: AccountRow[]; total: number; label: string }) {
  if (accounts.length === 0) {
    return (
      <div style={{ padding: '8px 16px', color: '#8c8c8c', fontSize: 12 }}>
        Sin cuentas para {label}
      </div>
    )
  }
  return (
    <Table
      size="small"
      dataSource={accounts}
      rowKey="id"
      pagination={false}
      showHeader={false}
      style={{ marginBottom: 0 }}
      summary={() => (
        <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0}>
            <Text strong style={{ fontSize: 12 }}>Total {label}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text strong style={{ fontFamily: 'monospace', color: accentColor(total) }}>
              {fmtQ(total)}
            </Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
      columns={[
        {
          dataIndex: 'code',
          width: 110,
          render: (v: string) => (
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text>
          ),
        },
        {
          dataIndex: 'name',
          render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
        },
        {
          dataIndex: 'balance',
          width: 140,
          align: 'right' as const,
          render: (v: number) => (
            <Text style={{ fontFamily: 'monospace', fontSize: 12, color: accentColor(v) }}>
              {fmtQ(v)}
            </Text>
          ),
        },
      ]}
    />
  )
}

function SectionCard({
  title, color, children, total, totalLabel,
}: {
  title: string; color: string; children: React.ReactNode;
  total: number; totalLabel: string;
}) {
  return (
    <Card
      size="small"
      title={<Text strong style={{ color, fontSize: 13 }}>{title}</Text>}
      style={{ marginBottom: 12, borderRadius: 8 }}
      bodyStyle={{ padding: 0 }}
      extra={
        <Text strong style={{ fontFamily: 'monospace', color: accentColor(total) }}>
          {fmtQ(total)}
        </Text>
      }
    >
      {children}
    </Card>
  )
}

export default function BalanceGeneralPage() {
  const [date,       setDate]       = useState(dayjs().format('YYYY-MM-DD'))
  const [compare,   setCompare]    = useState(false)
  const [compDate,  setCompDate]   = useState(dayjs().subtract(1, 'year').format('YYYY-MM-DD'))
  const [data,      setData]       = useState<BalanceGeneralData | null>(null)
  const [loading,   setLoading]    = useState(false)
  const [error,     setError]      = useState<string | null>(null)

  const fetch = async (d: string, comp?: string) => {
    setLoading(true); setError(null)
    try {
      const res = await getBalanceGeneral({ date: d, compPeriod: comp })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando el Balance General')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(date, compare ? compDate : undefined) }, [date, compare, compDate])

  return (
    <ReportLayout
      title="Balance General"
      subtitle="Estado de Situación Financiera · NIC 1 · SAT Guatemala"
      tipoExport="balance-general"
      loading={loading}
      error={error}
      singleDate
      date={date}
      onDateChange={d => setDate(d)}
      exportParams={{ date }}
      extra={
        <Space size={4}>
          <Switch
            size="small"
            checked={compare}
            onChange={setCompare}
          />
          <Text style={{ fontSize: 12 }}>Comparar año anterior</Text>
        </Space>
      }
    >
      {data && (
        <>
          {/* Balance indicator */}
          <div style={{ marginBottom: 16 }}>
            {data.balanced ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Balance cuadrado · Activos = Pasivo + Capital
              </Tag>
            ) : (
              <Tag icon={<WarningOutlined />} color="error">
                Desequilibrio: diferencia Q {fmtQ(Math.abs(data.totalActivo - data.totalPasivoCapital))}
              </Tag>
            )}
            <Tag style={{ marginLeft: 8 }}>Al {data.asOf}</Tag>
          </div>

          {/* KPI strip */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Activos',          value: data.totalActivo,           color: '#1B3A6B' },
              { label: 'Total Pasivos',           value: data.pasivo.total,          color: '#cf1322' },
              { label: 'Capital Contable',        value: data.totalCapital,          color: '#389e0d' },
              { label: 'Utilidad del Período',   value: data.netIncome,             color: data.netIncome >= 0 ? '#389e0d' : '#cf1322' },
            ].map(k => (
              <Col xs={12} sm={6} key={k.label}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: '12px 8px' }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{k.label}</span>}
                    value={k.value}
                    precision={2}
                    prefix="Q"
                    valueStyle={{ fontSize: 14, fontFamily: 'monospace', color: k.color }}
                    formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={16}>
            {/* ACTIVOS */}
            <Col xs={24} lg={12}>
              <Title level={5} style={{ color: '#1B3A6B', marginBottom: 8 }}>ACTIVOS</Title>
              <SectionCard title="Activo Circulante" color="#1677ff" total={data.activo.total} totalLabel="Activo Circulante">
                <AccountTable accounts={data.activo.accounts} total={data.activo.total} label="Activo Circulante" />
              </SectionCard>
              <SectionCard title="Activo Fijo" color="#1677ff" total={data.activoFijo.total} totalLabel="Activo Fijo">
                <AccountTable accounts={data.activoFijo.accounts} total={data.activoFijo.total} label="Activo Fijo" />
              </SectionCard>
              <Divider dashed style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#e6f4ff', borderRadius: 6 }}>
                <Text strong style={{ color: '#1B3A6B' }}>TOTAL ACTIVOS</Text>
                <Text strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#1B3A6B' }}>
                  {fmtQ(data.totalActivo)}
                </Text>
              </div>
            </Col>

            {/* PASIVO + CAPITAL */}
            <Col xs={24} lg={12}>
              <Title level={5} style={{ color: '#1B3A6B', marginBottom: 8 }}>PASIVO Y CAPITAL</Title>
              <SectionCard title="Pasivo" color="#cf1322" total={data.pasivo.total} totalLabel="Pasivo">
                <AccountTable accounts={data.pasivo.accounts} total={data.pasivo.total} label="Pasivo" />
              </SectionCard>
              <SectionCard title="Capital Contable" color="#389e0d" total={data.totalCapital} totalLabel="Capital">
                <AccountTable accounts={data.capital.accounts} total={data.capital.total} label="Capital" />
                {/* Net income line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', borderTop: '1px solid #f0f0f0' }}>
                  <Text style={{ fontSize: 12 }}>Utilidad del Período</Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, color: accentColor(data.netIncome) }}>
                    {fmtQ(data.netIncome)}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', background: '#fafafa' }}>
                  <Text strong style={{ fontSize: 12 }}>Total Capital</Text>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#389e0d' }}>
                    {fmtQ(data.totalCapital)}
                  </Text>
                </div>
              </SectionCard>
              <Divider dashed style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#f6ffed', borderRadius: 6 }}>
                <Text strong style={{ color: '#389e0d' }}>TOTAL PASIVO + CAPITAL</Text>
                <Text strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#389e0d' }}>
                  {fmtQ(data.totalPasivoCapital)}
                </Text>
              </div>
            </Col>
          </Row>
        </>
      )}
    </ReportLayout>
  )
}
