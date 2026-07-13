import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Tag, Spin, Table } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAjusteMoneda, type AjusteMoneda, type AjusteMonedaLinea } from '../../../api/ajuste-moneda'
import { getAsiento, type AsientoDetalle } from '../../../api/asientos'

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
  const [je,      setJe]      = useState<AsientoDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getAjusteMoneda(id)
      .then(async (adj) => {
        setData(adj)
        if (adj.journalEntryId) {
          try { setJe(await getAsiento(adj.journalEntryId)) } catch { /* no JE */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  if (!data)   return <div style={{ padding: 24 }}>No encontrado</div>

  const lines  = data.lines ?? []
  const netGP  = Number(data.gananciasPerdidas)
  const moneda = data.moneda

  // Separate JE lines into FX lines and CXP lines
  // FX lines have "Dif. cambiario" in description; CXP lines have invoice/vendor info
  const jeLinesAll = je?.lines ?? []
  const jeFxLossLine = jeLinesAll.find(l =>
    l.description?.toLowerCase().includes('pérdida') ||
    l.description?.toLowerCase().includes('perdida')
  )
  const jeFxGainLine = jeLinesAll.find(l =>
    l.description?.toLowerCase().includes('ganancia')
  )
  // CXP JE lines (not FX differential lines)
  const jeCxpLines = jeLinesAll.filter(l => !l.description?.includes('Dif. cambiario'))

  // For old records (no vendorName/invoiceNumber in entity), extract from JE line description
  // Description format: "FPROV-2026-00026 | Zoho | Revaluación USD 2026-05-31"
  const resolveCxpInfo = (line: AjusteMonedaLinea) => {
    if (line.vendorName || line.invoiceNumber) {
      return { vendor: line.vendorName, invoice: line.invoiceNumber }
    }
    // Find matching JE CXP line by accountCode (or sole CXP line when only 1 invoice)
    let match = jeCxpLines.find(l => l.accountCode === line.accountCode)
    if (!match && jeCxpLines.length === 1) match = jeCxpLines[0]
    if (!match) return { vendor: null, invoice: null }
    const parts = (match.description ?? '').split(' | ')
    return {
      invoice: parts.length >= 2 ? (parts[0] ?? null) : null,
      vendor:  parts.length >= 2 ? (parts[1] ?? null) : null,
    }
  }

  const columns = [
    {
      title: 'Proveedor',
      key: 'vendor',
      width: 150,
      render: (_: any, r: AjusteMonedaLinea) => {
        const { vendor } = resolveCxpInfo(r)
        return vendor
          ? <span style={{ fontSize: 12, fontWeight: 500 }}>{vendor}</span>
          : <span style={{ color: '#bfbfbf' }}>—</span>
      },
    },
    {
      title: 'Factura',
      key: 'invoice',
      width: 130,
      render: (_: any, r: AjusteMonedaLinea) => {
        const { invoice } = resolveCxpInfo(r)
        return invoice
          ? <span style={{ fontSize: 11, color: '#1B3A6B', fontFamily: 'monospace' }}>{invoice}</span>
          : <span style={{ color: '#bfbfbf' }}>—</span>
      },
    },
    {
      title: `Saldo (${moneda})`,
      dataIndex: 'saldoUSD',
      key: 'usd',
      align: 'right' as const,
      width: 110,
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace' }}>
          {Number(v) < 0 ? '-' : ''}{fmtUSD(Math.abs(Number(v)))}
        </span>
      ),
    },
    {
      title: 'Saldo GTQ',
      dataIndex: 'saldoGTQ',
      key: 'gtq',
      align: 'right' as const,
      width: 110,
      render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{fmtQ(Number(v))}</span>,
    },
    {
      title: 'Revaluado GTQ',
      dataIndex: 'saldoRevaluado',
      key: 'rev',
      align: 'right' as const,
      width: 120,
      render: (v: number) => <strong style={{ fontFamily: 'monospace' }}>{fmtQ(Number(v))}</strong>,
    },
    {
      title: 'Gan./Pérd.',
      dataIndex: 'gananciasPerdidas',
      key: 'gp',
      align: 'right' as const,
      width: 100,
      render: (v: number) => {
        const n = Number(v)
        return (
          <span style={{ color: n >= 0 ? '#389e0d' : '#cf1322', fontWeight: 700, fontFamily: 'monospace' }}>
            {n >= 0 ? '+' : ''}{fmtQ(n)}
          </span>
        )
      },
    },
    // CXP account — Haber (credit) for losses / Debe for gains
    {
      title: 'Cta. Proveedor',
      key: 'ctaCxp',
      width: 175,
      render: (_: any, r: AjusteMonedaLinea) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>{r.accountName}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{r.accountCode}</div>
        </div>
      ),
    },
    {
      title: 'Haber',
      key: 'haber',
      align: 'right' as const,
      width: 95,
      render: (_: any, r: AjusteMonedaLinea) => {
        const gp  = Number(r.gananciasPerdidas)
        const abs = Math.abs(gp)
        if (abs < 0.004) return <span style={{ color: '#d9d9d9' }}>—</span>
        // Loss → CXP is Haber; Gain → CXP is Debe (show in muted)
        return (
          <span style={{ fontFamily: 'monospace', color: gp < 0 ? undefined : '#aaaaaa' }}>
            {fmtQ(abs)}
          </span>
        )
      },
    },
    // FX differential account — Debe (debit) for losses / Haber for gains
    {
      title: 'Cta. Diferencial',
      key: 'ctaFx',
      width: 175,
      render: (_: any, r: AjusteMonedaLinea) => {
        const gp    = Number(r.gananciasPerdidas)
        const fxLine = gp < 0 ? jeFxLossLine : jeFxGainLine
        if (!fxLine) return <span style={{ color: '#bfbfbf' }}>—</span>
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{fxLine.accountName}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{fxLine.accountCode}</div>
          </div>
        )
      },
    },
    {
      title: 'Debe',
      key: 'debe',
      align: 'right' as const,
      width: 95,
      render: (_: any, r: AjusteMonedaLinea) => {
        const gp  = Number(r.gananciasPerdidas)
        const abs = Math.abs(gp)
        if (abs < 0.004) return <span style={{ color: '#d9d9d9' }}>—</span>
        // Loss → FX is Debe; Gain → FX is Haber (show in muted)
        return (
          <span style={{ fontFamily: 'monospace', color: gp < 0 ? undefined : '#aaaaaa' }}>
            {fmtQ(abs)}
          </span>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
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
      <div style={{ display: 'flex', gap: 48, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Fecha de ajuste</Text>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{dayjs(data.fechaAjuste).format('DD MMMM YYYY')}</div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Tipo de cambio</Text>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{Number(data.tipoCambio).toFixed(5)}</div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Ganancia / Pérdida neta</Text>
          <div style={{ fontWeight: 700, fontSize: 15, color: netGP >= 0 ? '#389e0d' : '#cf1322' }}>
            {netGP >= 0 ? '+' : ''}{fmtQ(netGP)}
          </div>
        </div>
        {je && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Póliza</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace', color: '#1B3A6B' }}>
                {je.entryNumber}
              </span>
              <Button size="small" type="link" style={{ color: '#1B3A6B', padding: 0, fontSize: 12 }}
                onClick={() => navigate(`/contabilidad/diarios-manuales/${je.id}`)}>
                Ver →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabla principal */}
      <Table
        dataSource={lines}
        columns={columns}
        rowKey={(r: AjusteMonedaLinea) => `${r.accountId}-${r.invoiceId ?? r.vendorId ?? 'na'}`}
        size="small"
        pagination={false}
        bordered
        scroll={{ x: 'max-content' }}
        summary={() => {
          const totalGTQ  = lines.reduce((s, l) => s + Number(l.saldoGTQ), 0)
          const totalRev  = lines.reduce((s, l) => s + Number(l.saldoRevaluado), 0)
          // Total Haber = CXP credit (losses) + FX credit (gains) = sum of all |GP|
          const totalHaber = lines.reduce((s, l) => s + Math.abs(Number(l.gananciasPerdidas)), 0)
          // Total Debe  = FX debit (losses) + CXP debit (gains) = same sum
          const totalDebe  = totalHaber
          return (
            <Table.Summary.Row style={{ background: '#f0f2f5', fontWeight: 700 }}>
              {/* Proveedor + Factura (2 cols) */}
              <Table.Summary.Cell index={0} colSpan={2}><strong>TOTAL</strong></Table.Summary.Cell>
              {/* Saldo USD */}
              <Table.Summary.Cell index={1} align="right"><span style={{ color: '#d9d9d9' }}>—</span></Table.Summary.Cell>
              {/* Saldo GTQ */}
              <Table.Summary.Cell index={2} align="right">
                <strong style={{ fontFamily: 'monospace' }}>{fmtQ(totalGTQ)}</strong>
              </Table.Summary.Cell>
              {/* Revaluado GTQ */}
              <Table.Summary.Cell index={3} align="right">
                <strong style={{ fontFamily: 'monospace' }}>{fmtQ(totalRev)}</strong>
              </Table.Summary.Cell>
              {/* Gan./Pérd. — vacío en total, los montos van en Haber/Debe */}
              <Table.Summary.Cell index={4} align="right"><span style={{ color: '#d9d9d9' }}>—</span></Table.Summary.Cell>
              {/* Cta. Proveedor */}
              <Table.Summary.Cell index={5} align="right"><span style={{ color: '#d9d9d9' }}>—</span></Table.Summary.Cell>
              {/* Haber */}
              <Table.Summary.Cell index={6} align="right">
                {totalHaber > 0.004
                  ? <strong style={{ fontFamily: 'monospace' }}>{fmtQ(totalHaber)}</strong>
                  : <span style={{ color: '#d9d9d9' }}>—</span>}
              </Table.Summary.Cell>
              {/* Cta. Diferencial */}
              <Table.Summary.Cell index={7} align="right"><span style={{ color: '#d9d9d9' }}>—</span></Table.Summary.Cell>
              {/* Debe */}
              <Table.Summary.Cell index={8} align="right">
                {totalDebe > 0.004
                  ? <strong style={{ fontFamily: 'monospace' }}>{fmtQ(totalDebe)}</strong>
                  : <span style={{ color: '#d9d9d9' }}>—</span>}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )
        }}
      />
    </div>
  )
}
