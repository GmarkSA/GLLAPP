import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, DatePicker, Space,
  Tag, Divider, message,
} from 'antd'
import {
  HomeOutlined, SearchOutlined, PrinterOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

import {
  getLibroCompras, type LibroComprasRow, type LibroComprasReport,
  BILL_TYPE_CONFIG,
} from '../../../api/compras'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmt  = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2 })
const fmtQ = (n: number) => `Q ${fmt(n)}`

const columns = [
  {
    title: 'Fecha',
    dataIndex: 'fecha',
    width: 90,
    render: (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—',
  },
  {
    title: 'NIT Proveedor',
    dataIndex: 'nitProveedor',
    width: 110,
  },
  {
    title: 'Proveedor',
    dataIndex: 'nombreProveedor',
    ellipsis: true,
    width: 180,
  },
  {
    title: 'Tipo',
    dataIndex: 'tipoDocumento',
    width: 120,
    render: (v: string) => (
      <Tag style={{ fontSize: 10 }}>
        {BILL_TYPE_CONFIG[v as keyof typeof BILL_TYPE_CONFIG]?.label ?? v}
      </Tag>
    ),
  },
  {
    title: 'Serie',
    dataIndex: 'felSerie',
    width: 60,
  },
  {
    title: 'No. SAT',
    dataIndex: 'felNumero',
    width: 80,
  },
  {
    title: 'UUID',
    dataIndex: 'uuid',
    width: 90,
    ellipsis: true,
    render: (v: string) => v ? <Text style={{ fontSize: 10, fontFamily: 'monospace' }}>{v.substring(0, 8)}…</Text> : '—',
  },
  {
    title: 'Base',
    dataIndex: 'base',
    width: 100,
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontSize: 12 }}>Q {fmt(v)}</Text>,
  },
  {
    title: 'IVA',
    dataIndex: 'iva',
    width: 85,
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontSize: 12, color: '#6b7280' }}>Q {fmt(v)}</Text>,
  },
  {
    title: 'Ret. ISR',
    dataIndex: 'retencionIsr',
    width: 85,
    align: 'right' as const,
    render: (v: number) => v > 0 ? <Text style={{ fontSize: 12, color: '#dc2626' }}>Q {fmt(v)}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
  },
  {
    title: 'Ret. IVA FE',
    dataIndex: 'retencionIva',
    width: 90,
    align: 'right' as const,
    render: (v: number) => v > 0 ? <Text style={{ fontSize: 12, color: '#dc2626' }}>Q {fmt(v)}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
  },
  {
    title: 'IDP',
    dataIndex: 'idp',
    width: 80,
    align: 'right' as const,
    render: (v: number) => v > 0 ? <Text style={{ fontSize: 12, color: '#d97706' }}>Q {fmt(v)}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
  },
  {
    title: 'Total',
    dataIndex: 'total',
    width: 100,
    align: 'right' as const,
    render: (v: number) => <Text style={{ fontWeight: 600, fontSize: 12 }}>Q {fmt(v)}</Text>,
  },
  {
    title: 'No. Interno',
    dataIndex: 'numeroInterno',
    width: 120,
    render: (v: string, row: LibroComprasRow) => (
      <Text style={{ fontSize: 11, color: '#6b7280' }}>{v}</Text>
    ),
  },
]

export default function LibroComprasPage() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data, setData]       = useState<LibroComprasReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!dateRange) return
    setLoading(true)
    getLibroCompras(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'))
      .then(setData)
      .catch(() => message.error('No se pudo cargar el Libro de Compras'))
      .finally(() => setLoading(false))
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Compras' },
          { title: 'Libro de Compras' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          Libro de Compras — SAT Guatemala
        </Title>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(v) => { if (v && v[0] && v[1]) setDateRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>
            Generar
          </Button>
          {data && (
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Imprimir
            </Button>
          )}
        </Space>
      </div>

      {data && (
        <div id="report-print-area">
          {/* Header for print */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>
                Período: {dayjs(data.from).format('DD/MM/YYYY')} — {dayjs(data.to).format('DD/MM/YYYY')}
              </Text>
            </div>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{data.count} registros</Text>
          </div>

          {/* Table */}
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={data.items}
              columns={columns}
              rowKey={(r) => r.uuid || r.numeroInterno}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              size="small"
              scroll={{ x: 1300 }}
              loading={loading}
              summary={() => data.items.length > 0 ? (
                <Table.Summary.Row style={{ background: '#f8f9fc', fontWeight: 700 }}>
                  <Table.Summary.Cell index={0} colSpan={7}>
                    <Text strong style={{ fontSize: 12, color: '#1B3A6B' }}>
                      TOTALES ({data.count} documentos)
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong style={{ color: '#1B3A6B' }}>Q {fmt(data.totals.base)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <Text strong style={{ color: '#6b7280' }}>Q {fmt(data.totals.iva)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <Text strong style={{ color: '#dc2626' }}>Q {fmt(data.totals.retencionIsr)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="right">
                    <Text strong style={{ color: '#dc2626' }}>Q {fmt(data.totals.retencionIva)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={11} align="right">
                    <Text strong style={{ color: '#d97706' }}>Q {fmt(data.totals.idp)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={12} align="right">
                    <Text strong style={{ color: '#1B3A6B', fontSize: 13 }}>Q {fmt(data.totals.total)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={13} />
                </Table.Summary.Row>
              ) : null}
            />
          </Card>

          {/* Resumen fiscal */}
          <Divider />
          <Card title="Resumen Fiscal del Período" style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: '#f8f9fc', borderRadius: 8, borderLeft: '3px solid #1B3A6B' }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Base Imponible Total</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1B3A6B' }}>{fmtQ(data.totals.base)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>IVA Crédito Fiscal</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{fmtQ(data.totals.iva)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Total Retenciones (ISR + IVA FE)</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
                  {fmtQ(data.totals.retencionIsr + data.totals.retencionIva)}
                </div>
              </div>
              {data.totals.idp > 0 && (
                <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, borderLeft: '3px solid #d97706' }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>IDP Combustibles</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{fmtQ(data.totals.idp)}</div>
                </div>
              )}
              <div style={{ padding: '12px 16px', background: '#1B3A6B', borderRadius: 8, gridColumn: data.totals.idp > 0 ? 'auto' : 'span 2' }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Total Compras del Período</Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{fmtQ(data.totals.total)}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!data && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            Seleccione un período y presione <strong>Generar</strong> para ver el Libro de Compras.
          </div>
        </Card>
      )}
    </div>
  )
}
