import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Table, Typography, Row, Col, Spin, Card, Statistic, Tag, Button } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { getLibroMayor, type LibroMayorData, type LibroMayorMovement } from '../api/reportes'

const { Text } = Typography

const fmtQ = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Source type labels & colors ───────────────────────────────────────────────

const SRC_LABEL: Record<string, string> = {
  invoice:                  'Factura',
  invoice_cost:             'Costo Venta',
  invoice_payment:          'Pago Cliente',
  invoice_writeoff:         'Castigo',
  credit_note:              'Nota Crédito',
  credit_note_refund:       'Reemb. NC',
  purchase_invoice:         'Fac. Proveedor',
  purchase_invoice_payment: 'Pago Proveedor',
  manual:                   'Asiento Manual',
  auto:                     'Automático',
  recurring:                'Recurrente',
  opening:                  'Apertura',
  closing:                  'Cierre',
  adjustment:               'Ajuste',
}

const SRC_COLOR: Record<string, string> = {
  invoice:                  'blue',
  invoice_cost:             'orange',
  invoice_payment:          'green',
  invoice_writeoff:         'red',
  credit_note:              'purple',
  credit_note_refund:       'purple',
  purchase_invoice:         'volcano',
  purchase_invoice_payment: 'geekblue',
}

function TipoTag({ sourceType, entryType }: { sourceType?: string | null; entryType?: string | null }) {
  const key   = sourceType || entryType || 'manual'
  const label = SRC_LABEL[key] ?? key
  const color = SRC_COLOR[key] ?? 'default'
  return <Tag color={color} style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>{label}</Tag>
}

// ─── Excel export ───────────────────────────────────────────────────────────────

function exportToExcel(data: LibroMayorData, accountName: string, fromDate: string, toDate: string) {
  const rows = data.movements.map(m => ({
    'Fecha':         String(m.date).substring(0, 10),
    'Tipo':          SRC_LABEL[m.sourceType ?? m.entryType ?? 'manual'] ?? (m.sourceType || m.entryType || 'Manual'),
    'No. Documento': m.docNumber || m.entryNumber || '',
    'Referencia':    m.reference || '',
    'Contacto':      m.contactName || '',
    'Descripción':   m.description || '',
    'Débito':        m.debit,
    'Crédito':       m.credit,
    'Saldo':         m.balance,
    'Dr/Cr':         '',
  }))

  // Totals row
  rows.push({
    'Fecha': 'TOTALES',
    'Tipo': '', 'No. Documento': '', 'Referencia': '', 'Contacto': '', 'Descripción': '',
    'Débito':  data.totalDebit,
    'Crédito': data.totalCredit,
    'Saldo':   data.closingBalance,
    'Dr/Cr':   '',
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 24 },
    { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 6 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

  const fileName = `${data.account.code}-${accountName.replace(/[^a-zA-Z0-9]/g, '_')}-${fromDate}_${toDate}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// ─── Navigation to source document ──────────────────────────────────────────────

function getSourceUrl(sourceType?: string | null, sourceId?: string | null): string | null {
  if (!sourceType || !sourceId) return null
  switch (sourceType) {
    case 'invoice':
    case 'invoice_cost':
    case 'invoice_writeoff':
      return `/ventas/facturas/${sourceId}`
    case 'invoice_payment':
      return `/ventas/pagos-recibidos/${sourceId}`
    case 'credit_note':
    case 'credit_note_refund':
      return `/ventas/notas-credito/${sourceId}`
    case 'purchase_invoice':
      return `/compras/facturas/${sourceId}`
    default:
      return null
  }
}

// ─── Exported types ─────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AccountDrilldownDrawer({ target, onClose }: Props) {
  const navigate = useNavigate()
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

  const hasContact = data?.movements.some(m => m.contactName)
  const hasRef     = data?.movements.some(m => m.reference)

  const columns: ColumnsType<LibroMayorMovement> = [
    {
      title: 'Fecha', dataIndex: 'date', width: 95,
      sorter: (a, b) => String(a.date).localeCompare(String(b.date)),
      render: (v: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v).substring(0, 10)}</Text>
      ),
    },
    {
      title: 'Tipo', key: 'tipo', width: 120,
      sorter: (a, b) => {
        const la = SRC_LABEL[a.sourceType ?? a.entryType ?? ''] ?? ''
        const lb = SRC_LABEL[b.sourceType ?? b.entryType ?? ''] ?? ''
        return la.localeCompare(lb)
      },
      render: (_: unknown, row: LibroMayorMovement) => (
        <TipoTag sourceType={row.sourceType} entryType={row.entryType} />
      ),
    },
    {
      title: 'No. Documento', key: 'docNumber', width: 130,
      sorter: (a, b) => (a.docNumber || a.entryNumber || '').localeCompare(b.docNumber || b.entryNumber || ''),
      render: (_: unknown, row: LibroMayorMovement) => {
        const num = row.docNumber || row.entryNumber
        const url = getSourceUrl(row.sourceType, row.sourceId)
        if (url) {
          return (
            <span
              role="button"
              style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff', cursor: 'pointer', textDecoration: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
              onClick={() => { onClose(); navigate(url) }}
            >
              {num} →
            </span>
          )
        }
        return <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{num}</Text>
      },
    },
    ...(hasRef ? [{
      title: 'FEL / Ref.',
      dataIndex: 'reference' as keyof LibroMayorMovement,
      width: 105,
      sorter: (a: LibroMayorMovement, b: LibroMayorMovement) =>
        (a.reference || '').localeCompare(b.reference || ''),
      render: (v: string | null | undefined) => v
        ? <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{v}</Text>
        : null,
    }] : []),
    ...(hasContact ? [{
      title: 'Contacto',
      dataIndex: 'contactName' as keyof LibroMayorMovement,
      width: 155, ellipsis: true,
      sorter: (a: LibroMayorMovement, b: LibroMayorMovement) =>
        (a.contactName || '').localeCompare(b.contactName || ''),
      render: (v: string | null | undefined) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : null,
    }] : []),
    {
      title: 'Descripción', dataIndex: 'description', ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
      render: (v: string) => <Text style={{ fontSize: 12, color: '#595959' }}>{v || '—'}</Text>,
    },
    {
      title: 'Débito', dataIndex: 'debit', width: 110, align: 'right' as const,
      sorter: (a, b) => a.debit - b.debit,
      render: (v: number) => v > 0
        ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Crédito', dataIndex: 'credit', width: 110, align: 'right' as const,
      sorter: (a, b) => a.credit - b.credit,
      render: (v: number) => v > 0
        ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 120, align: 'right' as const,
      sorter: (a, b) => a.balance - b.balance,
      render: (v: number) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: v >= 0 ? '#1B3A6B' : '#cf1322' }}>
          {fmtQ(Math.abs(v))}
        </Text>
      ),
    },
  ]

  // Dynamic drawer width: wider when more columns are visible
  const drawerW = Math.min(
    (hasRef ? 105 : 0) + (hasContact ? 155 : 0) + 95 + 120 + 125 + 200 + 110 + 110 + 120 + 64,
    Math.round(typeof window !== 'undefined' ? window.innerWidth * 0.95 : 1200),
  )

  return (
    <Drawer
      open={!!target}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
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
          {data && data.movements.length > 0 && (
            <Button
              icon={<FileExcelOutlined />}
              size="small"
              onClick={() => exportToExcel(data, target!.accountName, target!.fromDate, target!.toDate)}
              style={{ background: '#217346', borderColor: '#217346', color: '#fff' }}
            >
              Exportar Excel
            </Button>
          )}
        </div>
      }
      width={drawerW}
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
                pagination={data.movements.length > 50 ? { pageSize: 50, showTotal: t => `${t} movimientos` } : false}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                    <Table.Summary.Cell index={0} colSpan={columns.length - 3}>
                      <Text strong style={{ fontSize: 12 }}>Totales del período</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 3} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>
                        {fmtQ(data.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 2} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>
                        {fmtQ(data.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 1} align="right">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: data.closingBalance >= 0 ? '#389e0d' : '#cf1322' }}>
                        {fmtQ(Math.abs(data.closingBalance))}
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
