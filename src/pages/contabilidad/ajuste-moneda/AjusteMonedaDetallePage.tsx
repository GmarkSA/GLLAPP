import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Tag, Spin, Table } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAjusteMoneda, type AjusteMoneda, type AjusteMonedaLinea } from '../../../api/ajuste-moneda'

const { Title, Text } = Typography

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2 })
}
function fmtQ(n: number) {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}

export default function AjusteMonedaDetallePage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [data,    setData]    = useState<AjusteMoneda | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getAjusteMoneda(id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  if (!data)   return <div style={{ padding: 24 }}>No encontrado</div>

  const lines   = data.lines ?? []
  const netGP   = Number(data.gananciasPerdidas)
  const moneda  = data.moneda

  const columns = [
    {
      title: 'Cuenta',
      dataIndex: 'accountName',
      key: 'name',
      render: (v: string, r: AjusteMonedaLinea) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.accountCode}</div>
        </div>
      ),
    },
    {
      title: `Saldo (${moneda})`,
      dataIndex: 'saldoUSD',
      key: 'usd',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace' }}>
          {Number(v) < 0 ? '-' : ''}{fmtUSD(Math.abs(Number(v)))}
        </span>
      ),
    },
    {
      title: 'Saldo (GTQ)',
      dataIndex: 'saldoGTQ',
      key: 'gtq',
      align: 'right' as const,
      render: (v: number) => fmtQ(Number(v)),
    },
    {
      title: 'Saldo Revaluado (GTQ)',
      dataIndex: 'saldoRevaluado',
      key: 'rev',
      align: 'right' as const,
      render: (v: number) => <strong>{fmtQ(Number(v))}</strong>,
    },
    {
      title: 'Ganancias o Pérdidas (GTQ)',
      dataIndex: 'gananciasPerdidas',
      key: 'gp',
      align: 'right' as const,
      render: (v: number) => {
        const n = Number(v)
        return (
          <span style={{ color: n >= 0 ? '#389e0d' : '#cf1322', fontWeight: 700 }}>
            {n >= 0 ? '+' : ''}{fmtQ(n)}
          </span>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Cabecera */}
      <div style={{ marginBottom: 20 }}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 8 }}
          onClick={() => navigate('/contabilidad/ajuste-moneda')}>
          Ajustes de la moneda base
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          {moneda} – Ajuste de la moneda
          {data.status === 'void' && <Tag color="default" style={{ marginLeft: 12 }}>ANULADO</Tag>}
        </Title>
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', gap: 48, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Fecha de ajuste</Text>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{dayjs(data.fechaAjuste).format('DD MMMM YYYY')}</div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Tipo de cambio</Text>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{Number(data.tipoCambio).toFixed(5)}</div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Notas</Text>
          <div style={{ fontSize: 14 }}>{data.notas || '—'}</div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Ganancia / Pérdida neta</Text>
          <div style={{ fontWeight: 700, fontSize: 15, color: netGP >= 0 ? '#389e0d' : '#cf1322' }}>
            {netGP >= 0 ? '+' : ''}{fmtQ(netGP)}
          </div>
        </div>
      </div>

      {/* Tabla de cuentas revaluadas */}
      <Table
        dataSource={lines}
        columns={columns}
        rowKey="accountId"
        size="small"
        pagination={false}
        bordered
        summary={() => (
          <Table.Summary.Row style={{ background: '#f0f2f5', fontWeight: 700 }}>
            <Table.Summary.Cell index={0}>TOTAL</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">—</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              {fmtQ(lines.reduce((s, l) => s + Number(l.saldoGTQ), 0))}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              {fmtQ(lines.reduce((s, l) => s + Number(l.saldoRevaluado), 0))}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <span style={{ color: netGP >= 0 ? '#389e0d' : '#cf1322' }}>
                {netGP >= 0 ? '+' : ''}{fmtQ(netGP)}
              </span>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </div>
  )
}
