import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, DatePicker, Space, Typography, Select,
  Button, Row, Col, Statistic, Alert,
} from 'antd'
import { BookOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getLibroMayor, getCuentasConMovimientos, exportReporte,
  type LibroMayorMovement, type CuentaConMovimiento, type LibroMayorData,
} from '../../api/reportes'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const balanceColor = (n: number) => n >= 0 ? '#1B3A6B' : '#cf1322'

export default function LibroMayorPage() {
  const today = dayjs()
  const [fromDate,   setFromDate]   = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [toDate,     setToDate]     = useState(today.format('YYYY-MM-DD'))
  const [accountId,  setAccountId]  = useState<string>('')
  const [cuentas,    setCuentas]    = useState<CuentaConMovimiento[]>([])
  const [data,       setData]       = useState<LibroMayorData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [loadingCuentas, setLoadingCuentas] = useState(false)

  // Cargar cuentas con movimientos
  const loadCuentas = useCallback(async () => {
    setLoadingCuentas(true)
    try {
      const res = await getCuentasConMovimientos({ fromDate, toDate })
      setCuentas(res ?? [])
    } catch { setCuentas([]) }
    finally { setLoadingCuentas(false) }
  }, [fromDate, toDate])

  useEffect(() => { loadCuentas() }, [loadCuentas])

  // Cargar movimientos de la cuenta seleccionada
  const loadMayor = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const res = await getLibroMayor(accountId, { fromDate, toDate })
      setData(res)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [accountId, fromDate, toDate])

  useEffect(() => { loadMayor() }, [loadMayor])

  const columns: ColumnsType<LibroMayorMovement> = [
    {
      title: 'Fecha', dataIndex: 'date', width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Póliza', dataIndex: 'entryNumber', width: 140,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Debe', dataIndex: 'debit', width: 130, align: 'right',
      render: (v) => (
        <Text style={{ fontFamily: 'monospace', color: v > 0 ? '#1B3A6B' : '#ccc' }}>
          {v > 0 ? fmtQ(v) : '—'}
        </Text>
      ),
    },
    {
      title: 'Haber', dataIndex: 'credit', width: 130, align: 'right',
      render: (v) => (
        <Text style={{ fontFamily: 'monospace', color: v > 0 ? '#52c41a' : '#ccc' }}>
          {v > 0 ? fmtQ(v) : '—'}
        </Text>
      ),
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 140, align: 'right',
      render: (v) => (
        <Text strong style={{ fontFamily: 'monospace', color: balanceColor(v) }}>{fmtQ(v)}</Text>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Libro Mayor</Title>
            <Text type="secondary">Movimientos por cuenta contable en el período</Text>
          </div>
        </div>
        {data && accountId && (
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportReporte('libro-mayor', 'excel', { accountId, fromDate, toDate })}
          >
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <RangePicker
            format="YYYY-MM-DD"
            value={[dayjs(fromDate), dayjs(toDate)]}
            onChange={(_, strs) => {
              if (strs[0] && strs[1]) { setFromDate(strs[0]); setToDate(strs[1]); setAccountId('') }
            }}
          />
          <Select
            showSearch
            style={{ width: 380 }}
            placeholder="Selecciona una cuenta..."
            loading={loadingCuentas}
            value={accountId || undefined}
            onChange={setAccountId}
            optionFilterProp="label"
            options={cuentas.map(c => ({
              value: c.id,
              label: `${c.code} — ${c.name}`,
            }))}
            notFoundContent="No hay cuentas con movimientos en el período"
          />
        </Space>
      </Card>

      {!accountId && (
        <Alert
          type="info" showIcon
          message="Selecciona un período y una cuenta para ver sus movimientos"
          style={{ borderRadius: 8 }}
        />
      )}

      {data && accountId && (
        <>
          {/* Resumen de cuenta */}
          <Row gutter={12} style={{ marginBottom: 12 }}>
            {[
              { title: 'Saldo Inicial',  value: data.openingBalance, color: balanceColor(data.openingBalance) },
              { title: 'Total Debe',     value: data.totalDebit,     color: '#1B3A6B' },
              { title: 'Total Haber',    value: data.totalCredit,    color: '#52c41a' },
              { title: 'Saldo Final',    value: data.closingBalance, color: balanceColor(data.closingBalance) },
            ].map(s => (
              <Col span={6} key={s.title}>
                <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={s.title}
                    value={Math.abs(s.value)}
                    formatter={v => fmtQ(Number(v))}
                    valueStyle={{ fontSize: 15, color: s.color }}
                    suffix={s.value < 0 ? <Text type="secondary" style={{ fontSize: 12 }}>(CR)</Text> : undefined}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Cuenta info */}
          <Card bordered={false} size="small" style={{ borderRadius: 10, marginBottom: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <Space>
              <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{data.account.code}</Text>
              <Text strong>{data.account.name}</Text>
              <Text type="secondary">·</Text>
              <Text type="secondary">{data.account.balanceType}</Text>
              <Text type="secondary">·</Text>
              <Text type="secondary">{dayjs(fromDate).format('DD/MM/YYYY')} al {dayjs(toDate).format('DD/MM/YYYY')}</Text>
            </Space>
          </Card>

          {/* Tabla de movimientos */}
          <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
            <Table
              columns={columns}
              dataSource={data.movements}
              rowKey={(_, i) => String(i)}
              loading={loading}
              size="middle"
              pagination={false}
              summary={() => (
                <Table.Summary.Row style={{ background: '#f0f5ff', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <Text strong>Saldo Final del Período</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(data.totalDebit)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>{fmtQ(data.totalCredit)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong style={{ fontFamily: 'monospace', color: balanceColor(data.closingBalance) }}>
                      {fmtQ(data.closingBalance)}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
              locale={{ emptyText: 'Sin movimientos en el período' }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
