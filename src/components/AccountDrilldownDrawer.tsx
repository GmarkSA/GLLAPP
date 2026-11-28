import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Table, Typography, Row, Col, Spin, Card, Statistic, Tag, Button } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { getLibroMayor, type LibroMayorData, type LibroMayorMovement } from '../api/reportes'
import { PRESENTACION, estiloEncabezado } from '../pages/reportes/presentacionDelReporte'

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
  purchase_invoice_payment: '#1faec2',
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
      title: <div style={estiloEncabezado('left')}>Fecha</div>, dataIndex: 'date', width: 95,
      sorter: (a, b) => String(a.date).localeCompare(String(b.date)),
      render: (v: string) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{String(v).substring(0, 10)}</Text>
      ),
    },
    {
      title: <div style={estiloEncabezado('left')}>Tipo</div>, key: 'tipo', width: 120,
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
      title: <div style={estiloEncabezado('left')}>No. Documento</div>, key: 'docNumber', width: 130,
      sorter: (a, b) => (a.docNumber || a.entryNumber || '').localeCompare(b.docNumber || b.entryNumber || ''),
      render: (_: unknown, row: LibroMayorMovement) => {
        const num = row.docNumber || row.entryNumber
        const url = getSourceUrl(row.sourceType, row.sourceId)
        if (url) {
          return (
            <span
              role="button"
              style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#1faec2', cursor: 'pointer', textDecoration: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
              onClick={() => { onClose(); navigate(url) }}
            >
              {num} →
            </span>
          )
        }
        return <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#1faec2' }}>{num}</Text>
      },
    },
    ...(hasRef ? [{
      title: <div style={estiloEncabezado('left')}>FEL / Ref.</div>,
      dataIndex: 'reference' as keyof LibroMayorMovement,
      width: 105,
      sorter: (a: LibroMayorMovement, b: LibroMayorMovement) =>
        (a.reference || '').localeCompare(b.reference || ''),
      render: (v: string | null | undefined) => v
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: PRESENTACION.grisEtiqueta }}>{v}</Text>
        : null,
    }] : []),
    ...(hasContact ? [{
      title: <div style={estiloEncabezado('left')}>Contacto</div>,
      dataIndex: 'contactName' as keyof LibroMayorMovement,
      width: 155, ellipsis: true,
      sorter: (a: LibroMayorMovement, b: LibroMayorMovement) =>
        (a.contactName || '').localeCompare(b.contactName || ''),
      render: (v: string | null | undefined) => v
        ? <Text style={{ fontSize: 13 }}>{v}</Text>
        : null,
    }] : []),
    {
      title: <div style={estiloEncabezado('left')}>Descripción</div>, dataIndex: 'description', ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
      render: (v: string) => <Text style={{ fontSize: 13, color: PRESENTACION.cifraNormal }}>{v || '—'}</Text>,
    },
    {
      title: <div style={estiloEncabezado('right')}>Débito</div>, dataIndex: 'debit', width: 110, align: 'right' as const,
      sorter: (a, b) => a.debit - b.debit,
      render: (v: number) => v > 0
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#1faec2' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#9aa1ab', fontSize: 13 }}>—</Text>,
    },
    {
      title: <div style={estiloEncabezado('right')}>Crédito</div>, dataIndex: 'credit', width: 110, align: 'right' as const,
      sorter: (a, b) => a.credit - b.credit,
      render: (v: number) => v > 0
        ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#e5484d' }}>{fmtQ(v)}</Text>
        : <Text style={{ color: '#9aa1ab', fontSize: 13 }}>—</Text>,
    },
    {
      title: <div style={estiloEncabezado('right')}>Saldo</div>, dataIndex: 'balance', width: 120, align: 'right' as const,
      sorter: (a, b) => a.balance - b.balance,
      render: (v: number) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: v >= 0 ? '#1faec2' : '#e5484d' }}>
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
                { label: 'Saldo Inicial',  value: data.openingBalance, color: '#6b7280' },
                { label: 'Total Débitos',  value: data.totalDebit,     color: '#1faec2' },
                { label: 'Total Créditos', value: data.totalCredit,    color: '#e5484d' },
                { label: 'Saldo Final',    value: data.closingBalance, color: data.closingBalance >= 0 ? '#2ea172' : '#e5484d' },
              ].map(k => (
                <Col span={6} key={k.label}>
                  <Card size="small" styles={{ body: { padding: '8px 10px' } }}>
                    <Statistic
                      title={<span style={estiloEncabezado('left')}>{k.label}</span>}
                      value={k.value}
                      precision={2}
                      valueStyle={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', color: k.color }}
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
                  <Table.Summary.Row style={{ background: '#fafbfc' }}>
                    <Table.Summary.Cell index={0} colSpan={columns.length - 3}>
                      <Text strong style={{ fontSize: 13 }}>Totales del período</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 3} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#1faec2' }}>
                        {fmtQ(data.totalDebit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 2} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#e5484d' }}>
                        {fmtQ(data.totalCredit)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={columns.length - 1} align="right">
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: data.closingBalance >= 0 ? '#2ea172' : '#e5484d' }}>
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
