import { useEffect, useState } from 'react'
import { Drawer, Table, Typography, Row, Col, Spin, Card, Statistic } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getLibroMayor, type LibroMayorData, type LibroMayorMovement } from '../api/reportes'

const { Text } = Typography

const fmtQ = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface DrilldownTarget {
  accountId:   string
  accountName: string
  fromDate:    string
  toDate:      string
}

interface Props {
  target:  DrilldownTarget | null
  onClose: () => void
}

export default function AccountDrilldownDrawer({ target, onClose }: Props) {
  const [data,    setData]    = useState<LibroMayorData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!target) { setData(null); return }
    setLoading(true)
    getLibroMayor(target.accountId, { fromDate: target.fromDate, toDate: target.toDate })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [target?.accountId, target?.fromDate, target?.toDate])

  const columns: ColumnsType<LibroMayorMovement> = [
    {
      title: 'Fecha', dataIndex: 'date', width: 95,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v).substring(0, 10)}</Text>,
    },
    {
      title: 'No.', dataIndex: 'entryNumber', width: 80, align: 'center' as const,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Descripción', dataIndex: 'description', ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Débito', dataIndex: 'debit', width: 115, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Crédito', dataIndex: 'credit', width: 115, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 125, align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#1B3A6B' : '#cf1322' }}>
          {fmtQ(v)}
        </Text>
      ),
    },
  ]

  return (
    <Drawer
      open={!!target}
      onClose={onClose}
      title={
        <div>
          <Text strong style={{ fontSize: 14 }}>{target?.accountName}</Text>
          {data && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {data.account.code} · Del {target?.fromDate} al {target?.toDate}
              </Text>
            </div>
          )}
        </div>
      }
      width={800}
      styles={{ body: { padding: '12px 16px' } }}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {data && (
          <>
            <Row gutter={10} style={{ marginBottom: 14 }}>
              {[
                { label: 'Saldo Inicial',  value: data.openingBalance, color: '#595959' },
                { label: 'Total Débitos',  value: data.totalDebit,     color: '#1677ff' },
                { label: 'Total Créditos', value: data.totalCredit,    color: '#cf1322' },
                { label: 'Saldo Final',    value: data.closingBalance, color: data.closingBalance >= 0 ? '#389e0d' : '#cf1322' },
              ].map(k => (
                <Col span={6} key={k.label}>
                  <Card size="small" styles={{ body: { padding: '8px 10px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 10 }}>{k.label}</span>}
                      value={k.value}
                      precision={2}
                      valueStyle={{ fontSize: 12, fontFamily: 'monospace', color: k.color }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            {data.movements.length === 0 ? (
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '32px 0' }}>
                Sin movimientos en este período
              </Text>
            ) : (
              <Table
                size="small"
                dataSource={data.movements}
                rowKey={(_, i) => String(i)}
                columns={columns}
                pagination={data.movements.length > 50 ? { pageSize: 50 } : false}
                scroll={{ x: 'max-content' }}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong style={{ fontSize: 12 }}>Totales del período</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>
                        {fmtQ(data.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>
                        {fmtQ(data.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: data.closingBalance >= 0 ? '#389e0d' : '#cf1322' }}>
                        {fmtQ(data.closingBalance)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            )}
          </>
        )}
      </Spin>
    </Drawer>
  )
}
