import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, DatePicker, Space,
  Tag, InputNumber, message,
} from 'antd'
import { HomeOutlined, SearchOutlined, PrinterOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

import {
  getLibroVentas, downloadLibroVentasExcel,
  type LibroVentasReport,
  type LibroVentasResumenCategoria,
} from '../../../api/facturas'
import { printLibro } from '../../../components/ReportHeader/printLibro'
import {
  getEmpresaInfo, getCorrelativo, setCorrelativo,
  type EmpresaInfo,
} from '../../../api/reportes'
import ReportHeader from '../../../components/ReportHeader/ReportHeader'

const { Title, Text } = Typography
const { RangePicker }  = DatePicker

const fmt  = (n: number) => n === 0 ? '—' : n.toLocaleString('es-GT', { minimumFractionDigits: 2 })
const fmtQ = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtD = (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—'

const CATEGORIA_LABEL: Record<string, string> = {
  bienes:      'Ventas de Bienes',
  servicios:   'Ventas de Servicios',
  exportacion: 'Exportación',
  exento:      'Exento',
}

const CATEGORIA_COLOR: Record<string, string> = {
  bienes:      '#1B3A6B',
  servicios:   '#2563eb',
  exportacion: '#059669',
  exento:      '#6b7280',
}

const ROWS_PER_PAGE = 20

// ── Columnas tabla SAT ──────────────────────────────────────────────────────
const columns = [
  {
    title: 'No.',
    dataIndex: 'folio',
    width: 48,
    align: 'center' as const,
    render: (v: number) => <Text style={{ fontSize: 11, color: '#6b7280' }}>{v}</Text>,
  },
  {
    title: 'Tipo Doc.',
    dataIndex: 'tipoDocumento',
    width: 90,
    render: (v: string) => (
      <Tag style={{ fontSize: 10, padding: '0 4px' }}>
        {v || 'FACT'}
      </Tag>
    ),
  },
  {
    title: 'Fecha Factura',
    dataIndex: 'fecha',
    width: 95,
    render: (v: string) => <span style={{ fontSize: 11 }}>{fmtD(v)}</span>,
  },
  {
    title: 'Fecha Contabiliz.',
    dataIndex: 'fechaContabilizacion',
    width: 105,
    render: (v: string, r: any) => {
      const isDiff = v && r.fecha && new Date(v).toDateString() !== new Date(r.fecha).toDateString()
      return (
        <span style={{ fontSize: 11, color: isDiff ? '#d97706' : undefined, fontWeight: isDiff ? 600 : undefined }}>
          {fmtD(v)}
        </span>
      )
    },
  },
  {
    title: 'Serie',
    dataIndex: 'felSerie',
    width: 55,
    render: (v: string) => <span style={{ fontSize: 11 }}>{v || '—'}</span>,
  },
  {
    title: 'No. Documento',
    dataIndex: 'felNumero',
    width: 100,
    render: (v: string) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || '—'}</span>,
  },
  {
    title: 'Referencia',
    dataIndex: 'referencia',
    width: 90,
    ellipsis: true,
    render: (v: string) => <span style={{ fontSize: 11 }}>{v || '—'}</span>,
  },
  {
    title: 'NIT Cliente',
    dataIndex: 'nitCliente',
    width: 100,
    render: (v: string) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || 'CF'}</span>,
  },
  {
    title: 'Nombre del Cliente',
    dataIndex: 'nombreCliente',
    ellipsis: true,
    width: 180,
    render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span>,
  },
  // ── VALOR BASE (sin IVA) ────────────────────────────────────────────────
  {
    title: <span style={{ fontSize: 10 }}>Venta Bienes</span>,
    dataIndex: 'ventaBienes',
    width: 90,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 11, color: v > 0 ? '#1B3A6B' : undefined }}>{fmt(v)}</span>,
  },
  {
    title: <span style={{ fontSize: 10 }}>Venta Servicios</span>,
    dataIndex: 'ventaServicios',
    width: 95,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 11, color: v > 0 ? '#2563eb' : undefined }}>{fmt(v)}</span>,
  },
  {
    title: <span style={{ fontSize: 10 }}>Exportación</span>,
    dataIndex: 'exportacion',
    width: 85,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 11, color: v > 0 ? '#059669' : undefined }}>{fmt(v)}</span>,
  },
  {
    title: <span style={{ fontSize: 10 }}>Exento</span>,
    dataIndex: 'exento',
    width: 70,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 11 }}>{fmt(v)}</span>,
  },
  // ── IVA y Total ──────────────────────────────────────────────────────────
  {
    title: 'IVA',
    dataIndex: 'iva',
    width: 80,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 11 }}>{fmt(v)}</span>,
  },
  {
    title: 'Total Factura',
    dataIndex: 'total',
    width: 95,
    align: 'right' as const,
    render: (v: number) => <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(v)}</span>,
  },
]

// ── Fila de totales ─────────────────────────────────────────────────────────
function TotalsRow({ data }: { data: LibroVentasReport }) {
  const t = data.totals
  const vals = [t.ventaBienes, t.ventaServicios, t.exportacion, t.exento, t.iva, t.total]
  return (
    <Table.Summary.Row style={{ background: '#f0f4ff', fontWeight: 700 }}>
      <Table.Summary.Cell index={0} colSpan={9}>
        <Text strong style={{ fontSize: 11, color: '#1B3A6B' }}>
          TOTALES — {data.count} documentos
        </Text>
      </Table.Summary.Cell>
      {vals.map((v, i) => (
        <Table.Summary.Cell key={i} index={8 + i} align="right">
          <Text strong style={{ fontSize: 11, color: v > 0 ? '#1B3A6B' : '#d1d5db' }}>
            {v > 0 ? fmt(v) : '—'}
          </Text>
        </Table.Summary.Cell>
      ))}
    </Table.Summary.Row>
  )
}

// ── Resumen por categoría (insumo formulario IVA SAT) ──────────────────────
function ResumenIVA({ resumen, totals }: { resumen: LibroVentasResumenCategoria[]; totals: LibroVentasReport['totals'] }) {
  const ALL_CATS = ['bienes', 'servicios', 'exportacion', 'exento']
  const rows = ALL_CATS.map(cat => {
    const found = resumen.find(r => r.categoria === cat)
    return { cat, cantidad: found?.cantidad ?? 0, base: found?.base ?? 0, iva: found?.iva ?? 0, total: found?.total ?? 0 }
  })

  return (
    <Card
      title={
        <span style={{ color: '#1B3A6B', fontWeight: 700, fontSize: 13 }}>
          Resumen por Categoría — Insumo Formulario IVA (SAT)
        </span>
      }
      style={{ marginTop: 16 }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="resumen-categoria-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left',   padding: '8px 12px', fontWeight: 600 }}>Categoría</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, width: 80 }}>Docs.</th>
              <th style={{ textAlign: 'right',  padding: '8px 12px', fontWeight: 600, width: 130 }}>Base (sin IVA)</th>
              <th style={{ textAlign: 'right',  padding: '8px 12px', fontWeight: 600, width: 110 }}>IVA</th>
              <th style={{ textAlign: 'right',  padding: '8px 12px', fontWeight: 600, width: 130 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cat, cantidad, base, iva, total }) => (
              <tr key={cat} style={{ borderBottom: '1px solid #f0f0f0', opacity: cantidad === 0 ? 0.35 : 1 }}>
                <td style={{ padding: '7px 12px' }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                    background: CATEGORIA_COLOR[cat] ?? '#9ca3af', marginRight: 8,
                  }} />
                  <span style={{ fontWeight: cantidad > 0 ? 600 : 400, color: CATEGORIA_COLOR[cat] ?? '#6b7280' }}>
                    {CATEGORIA_LABEL[cat]}
                  </span>
                </td>
                <td style={{ textAlign: 'center', padding: '7px 12px', color: '#6b7280' }}>
                  {cantidad > 0 ? cantidad : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', fontFamily: 'monospace' }}>
                  {base > 0 ? fmtQ(base) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', fontFamily: 'monospace', color: '#2563eb' }}>
                  {iva > 0 ? fmtQ(iva) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {total > 0 ? fmtQ(total) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1B3A6B', color: '#fff' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700 }}>TOTAL PERÍODO</td>
              <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}>
                {rows.reduce((s, r) => s + r.cantidad, 0)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                {fmtQ(rows.reduce((s, r) => s + r.base, 0))}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                {fmtQ(totals.iva)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                {fmtQ(totals.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
export default function LibroVentasPage() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data,        setData]        = useState<LibroVentasReport | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [empresa,     setEmpresa]     = useState<EmpresaInfo | null>(null)
  const [folioInicio, setFolioInicio] = useState<number>(1)

  useEffect(() => {
    getEmpresaInfo().then(setEmpresa).catch(() => {})
    getCorrelativo('libro-ventas', dayjs().format('YYYY'))
      .then(r => setFolioInicio((r.current_correlativo ?? 0) + 1))
      .catch(() => {})
  }, [])

  const pages    = data ? Math.max(1, Math.ceil(data.count / ROWS_PER_PAGE)) : 0
  const folioFin = folioInicio + pages - 1

  const load = () => {
    setLoading(true)
    getLibroVentas(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'))
      .then(result => {
        setData(result)
        const pags = Math.max(1, Math.ceil(result.count / ROWS_PER_PAGE))
        setCorrelativo('libro-ventas', folioInicio + pags - 1, dateRange[0].format('YYYY'))
          .catch(() => {})
      })
      .catch(() => message.error('No se pudo cargar el Libro de Ventas'))
      .finally(() => setLoading(false))
  }

  const handleExcel = async () => {
    if (!data) return
    setDownloading(true)
    try {
      await downloadLibroVentasExcel(
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD'),
        `libro-ventas-${dateRange[0].format('YYYY-MM')}.xlsx`,
      )
    } catch { message.error('Error al descargar Excel') }
    finally { setDownloading(false) }
  }

  const handlePrint = () => {
    if (!data) return
    printLibro({
      empresa, reportName: 'Libro de Ventas y Servicios', period, folioInicio, folioFin,
      nitLabel: 'NIT Cliente', nombreLabel: 'Nombre del Cliente',
      hasIdp: false, hasCol5: false, hasCol6: false,
      rows: data.items.map(r => ({
        folio: r.folio, tipoDocumento: r.tipoDocumento, fecha: String(r.fecha),
        felSerie: r.felSerie, felNumero: r.felNumero, referencia: r.referencia,
        nitParty: r.nitCliente, nombreParty: r.nombreCliente,
        col1: r.ventaBienes,    label1: 'Venta Bienes',
        col2: r.ventaServicios, label2: 'Venta Servicios',
        col3: r.exportacion,    label3: 'Exportación',
        col4: r.exento,         label4: 'Exento',
        iva: r.iva, total: r.total,
      })),
      totals: {
        col1: data.totals.ventaBienes,    col2: data.totals.ventaServicios,
        col3: data.totals.exportacion,    col4: data.totals.exento,
        iva: data.totals.iva, total: data.totals.total,
      },
      resumen: data.resumenCategoria.map(r => ({
        label:    r.categoria === 'bienes'      ? 'Ventas de Bienes'
                : r.categoria === 'servicios'   ? 'Ventas de Servicios'
                : r.categoria === 'exportacion' ? 'Exportación'
                : 'Exento',
        cantidad: r.cantidad, base: r.base, iva: r.iva, total: r.total,
      })),
    })
  }

  const period = data
    ? `Del ${dayjs(data.from).format('DD/MM/YYYY')} al ${dayjs(data.to).format('DD/MM/YYYY')}`
    : ''

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Ventas' },
          { title: 'Libro de Ventas' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          Libro de Ventas y Servicios — SAT Guatemala
        </Title>
        <Space>
          <Space size={4}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Folio inicial:</Text>
            <InputNumber
              min={1} value={folioInicio} size="small" style={{ width: 72 }}
              onChange={v => setFolioInicio(v ?? 1)}
            />
          </Space>
          <RangePicker
            value={dateRange}
            onChange={(v) => { if (v?.[0] && v?.[1]) setDateRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>
            Generar
          </Button>
          {data && (
            <>
              <Button
                icon={<FileExcelOutlined />}
                loading={downloading}
                onClick={handleExcel}
                style={{ color: '#16a34a', borderColor: '#16a34a' }}
              >
                Excel
              </Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Imprimir / PDF
              </Button>
            </>
          )}
        </Space>
      </div>

      {data && (
        <div id="report-print-area">

          <ReportHeader
            empresa={empresa}
            reportName="Libro de Ventas y Servicios"
            period={period}
            folioInicio={folioInicio}
            folioFin={folioFin}
          />

          <div style={{ marginBottom: 8, fontSize: 11, color: '#6b7280' }}>
            {pages} hoja{pages !== 1 ? 's' : ''} carta estimada{pages !== 1 ? 's' : ''}
            &nbsp;·&nbsp; Folios asignados: <strong style={{ color: '#1B3A6B' }}>{folioInicio} al {folioFin}</strong>
            &nbsp;·&nbsp; Próximo reporte iniciará en folio <strong>{folioFin + 1}</strong>
          </div>

          <div style={{
            background: '#1B3A6B', color: '#fff', fontSize: 10, fontWeight: 600,
            padding: '4px 8px', borderRadius: '6px 6px 0 0',
          }}>
            VALOR BASE (sin IVA) — por categoría SAT
          </div>

          <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: '0 0 8px 8px', borderTop: 'none' }}>
            <Table
              dataSource={data.items}
              columns={columns}
              rowKey={(r) => r.uuid || r.numeroInterno}
              pagination={{ pageSize: 100, showSizeChanger: true, showTotal: (t) => `${t} registros` }}
              size="small"
              scroll={{ x: 'max-content' }}
              loading={loading}
              summary={() => data.items.length > 0 ? <TotalsRow data={data} /> : null}
            />
          </Card>

          <ResumenIVA resumen={data.resumenCategoria} totals={data.totals} />

        </div>
      )}

      {!data && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            Seleccione un período y presione <strong>Generar</strong> para ver el Libro de Ventas.
          </div>
        </Card>
      )}
    </div>
  )
}
