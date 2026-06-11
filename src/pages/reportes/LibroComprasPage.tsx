import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, DatePicker, Space,
  Tag, InputNumber, message,
} from 'antd'
import { HomeOutlined, SearchOutlined, PrinterOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

import {
  getLibroCompras, downloadLibroComprasExcel,
  type LibroComprasReport,
} from '../../api/compras'
import { printLibro } from '../../components/ReportHeader/printLibro'
import {
  getEmpresaInfo, getCorrelativo, setCorrelativo,
  type EmpresaInfo,
} from '../../api/reportes'
import ReportHeader from '../../components/ReportHeader/ReportHeader'
import {
  getLibroSATConfig, DEFAULT_CONFIG,
  type LibroColumn, type LibroSATConfig,
} from '../../api/libros-sat'

const { Title, Text } = Typography
const { RangePicker }  = DatePicker

const fmt  = (n: number) => (n ?? 0) === 0 ? '—' : (n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })
const fmtQ = (n: number) => `Q ${(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtD = (v: string) => v ? new Date(v).toLocaleDateString('es-GT') : '—'

// Mapa estable: clave SAT → campo devuelto por el backend
const FIELD_MAP: Record<string, string> = {
  bienes:               'compraBienes',
  servicios:            'compraServicios',
  combustibles:         'compraCombustibles',
  importacion:          'importacion',
  pequenoContribuyente: 'pequenoContribuyente',
  exento:               'exento',
}

const CATEGORIA_COLOR: Record<string, string> = {
  bienes:               '#1B3A6B',
  servicios:            '#2563eb',
  combustibles:         '#d97706',
  importacion:          '#7c3aed',
  pequenoContribuyente: '#059669',
  exento:               '#6b7280',
}

const ROWS_PER_PAGE = 20

// ── Columnas fijas de cabecera (antes de las categorías SAT) ─────────────────
const FIXED_HEADER_COLS = [
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
        {v === 'goods' ? 'FACT' : v === 'services' ? 'SERV' : v === 'fuel' ? 'COMB' : v === 'special' ? 'FE' : v === 'reimbursement' ? 'REEM' : v.toUpperCase()}
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
  { title: 'Serie',         dataIndex: 'felSerie',   width: 55,  render: (v: string) => <span style={{ fontSize: 11 }}>{v || '—'}</span> },
  { title: 'No. Documento', dataIndex: 'felNumero',  width: 100, render: (v: string) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || '—'}</span> },
  { title: 'Referencia',    dataIndex: 'referencia', width: 90, ellipsis: true, render: (v: string) => <span style={{ fontSize: 11 }}>{v || '—'}</span> },
  { title: 'NIT Contribuyente',    dataIndex: 'nitProveedor',    width: 110, render: (v: string) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || '—'}</span> },
  { title: 'Nombre del Contribuyente', dataIndex: 'nombreProveedor', ellipsis: true, width: 180, render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span> },
]

// ── Columnas fijas de cola (después de las categorías) ───────────────────────
const FIXED_TAIL_COLS = [
  {
    title: 'IDP',
    dataIndex: 'idp',
    width: 72,
    align: 'right' as const,
    render: (v: number) => v > 0
      ? <span style={{ fontSize: 11, color: '#d97706' }}>{fmt(v)}</span>
      : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>,
  },
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

// ── Genera columnas dinámicas desde el config ────────────────────────────────
function buildColumns(colsConfig: LibroColumn[]) {
  const dynamicCols = colsConfig
    .filter(c => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(col => ({
      title: <span style={{ fontSize: 10 }}>{col.label}</span>,
      dataIndex: FIELD_MAP[col.key] ?? col.key,
      width: 90,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 11 }}>{fmt(v ?? 0)}</span>,
    }))
  return [...FIXED_HEADER_COLS, ...dynamicCols, ...FIXED_TAIL_COLS]
}

// ── Fila de totales (dinámica) ───────────────────────────────────────────────
function TotalsRow({ data, colsConfig }: { data: LibroComprasReport; colsConfig: LibroColumn[] }) {
  const t        = data.totals
  const activeCols = colsConfig.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const catVals  = activeCols.map(col => (t as any)[FIELD_MAP[col.key] ?? col.key] ?? 0)
  const vals     = [...catVals, t.idp, t.iva, t.total]

  return (
    <Table.Summary.Row style={{ background: '#f0f4ff', fontWeight: 700 }}>
      <Table.Summary.Cell index={0} colSpan={9}>
        <Text strong style={{ fontSize: 11, color: '#1B3A6B' }}>
          TOTALES — {data.count} documentos
        </Text>
      </Table.Summary.Cell>
      {vals.map((v, i) => (
        <Table.Summary.Cell key={i} index={9 + i} align="right">
          <Text strong style={{ fontSize: 11, color: v > 0 ? '#1B3A6B' : '#d1d5db' }}>
            {v > 0 ? fmt(v) : '—'}
          </Text>
        </Table.Summary.Cell>
      ))}
    </Table.Summary.Row>
  )
}

// ── Resumen por categoría (dinámica) ─────────────────────────────────────────
function ResumenIVA({
  resumen, totals, colsConfig,
}: {
  resumen: LibroComprasReport['resumenCategoria']
  totals:  LibroComprasReport['totals']
  colsConfig: LibroColumn[]
}) {
  const activeCols = colsConfig.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <Card
      title={<span style={{ color: '#1B3A6B', fontWeight: 700, fontSize: 13 }}>Resumen por Categoría — Insumo Formulario IVA (SAT)</span>}
      style={{ marginTop: 16 }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
            {activeCols.map(col => {
              const found = resumen.find(r => r.categoria === col.key)
              const { cantidad = 0, base = 0, iva = 0, total = 0 } = found ?? {}
              return (
                <tr key={col.key} style={{ borderBottom: '1px solid #f0f0f0', opacity: cantidad === 0 ? 0.35 : 1 }}>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                      background: CATEGORIA_COLOR[col.key] ?? '#9ca3af', marginRight: 8,
                    }} />
                    <span style={{ fontWeight: cantidad > 0 ? 600 : 400, color: CATEGORIA_COLOR[col.key] ?? '#6b7280' }}>
                      {col.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '7px 12px', color: '#6b7280' }}>{cantidad > 0 ? cantidad : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontFamily: 'monospace' }}>{base  > 0 ? fmtQ(base)  : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontFamily: 'monospace', color: '#2563eb' }}>{iva > 0 ? fmtQ(iva) : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{total > 0 ? fmtQ(total) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1B3A6B', color: '#fff' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700 }}>TOTAL PERÍODO</td>
              <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}>
                {resumen.reduce((s, r) => s + (r.cantidad ?? 0), 0)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                {fmtQ(resumen.reduce((s, r) => s + (r.base ?? 0), 0))}
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

      {totals.idp > 0 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a', fontSize: 12 }}>
          <Text style={{ color: '#92400e' }}>
            <strong>IDP Combustibles:</strong> {fmtQ(totals.idp)} — no forma parte de la base IVA
          </Text>
        </div>
      )}
      {(totals.retencionIsr + totals.retencionIva) > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 12 }}>
          <Text style={{ color: '#991b1b' }}>
            <strong>Retenciones del período:</strong>&nbsp;
            ISR: {fmtQ(totals.retencionIsr)} &nbsp;|&nbsp;
            IVA FE: {fmtQ(totals.retencionIva)}
          </Text>
        </div>
      )}
    </Card>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function LibroComprasPage() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data,        setData]        = useState<LibroComprasReport | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [empresa,     setEmpresa]     = useState<EmpresaInfo | null>(null)
  const [folioInicio, setFolioInicio] = useState<number>(1)
  const [libroConfig, setLibroConfig] = useState<LibroSATConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    getEmpresaInfo().then(setEmpresa).catch(() => {})
    getLibroSATConfig().then(setLibroConfig).catch(() => {})
    getCorrelativo('libro-compras', dayjs().format('YYYY'))
      .then(r => setFolioInicio((r.current_correlativo ?? 0) + 1))
      .catch(() => {})
  }, [])

  const pages    = data ? Math.max(1, Math.ceil(data.count / ROWS_PER_PAGE)) : 0
  const folioFin = folioInicio + pages - 1
  const activeCols = libroConfig.compras.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  const load = () => {
    setLoading(true)
    getLibroCompras(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'))
      .then(result => {
        setData(result)
        const pags = Math.max(1, Math.ceil(result.count / ROWS_PER_PAGE))
        setCorrelativo('libro-compras', folioInicio + pags - 1, dateRange[0].format('YYYY')).catch(() => {})
      })
      .catch(() => message.error('No se pudo cargar el Libro de Compras'))
      .finally(() => setLoading(false))
  }

  const handleExcel = async () => {
    if (!data) return
    setDownloading(true)
    try {
      await downloadLibroComprasExcel(
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD'),
        `libro-compras-${dateRange[0].format('YYYY-MM')}.xlsx`,
      )
    } catch { message.error('Error al descargar Excel') }
    finally { setDownloading(false) }
  }

  const handlePrint = () => {
    if (!data) return
    // Hasta 6 columnas dinámicas → col1-col6 del printLibro
    const printRows = data.items.map(r => {
      const base: any = {
        folio: r.folio, tipoDocumento: r.tipoDocumento, fecha: String(r.fecha),
        felSerie: r.felSerie, felNumero: r.felNumero, referencia: r.referencia,
        nitParty: r.nitProveedor, nombreParty: r.nombreProveedor,
        idp: r.idp, iva: r.iva, total: r.total,
      }
      activeCols.slice(0, 6).forEach((col, i) => {
        base[`col${i + 1}`]   = (r as any)[FIELD_MAP[col.key] ?? col.key] ?? 0
        base[`label${i + 1}`] = col.label
      })
      return base
    })
    const printTotals: any = { idp: data.totals.idp, iva: data.totals.iva, total: data.totals.total }
    activeCols.slice(0, 6).forEach((col, i) => {
      printTotals[`col${i + 1}`] = (data.totals as any)[FIELD_MAP[col.key] ?? col.key] ?? 0
    })

    printLibro({
      empresa,
      reportName: 'Libro de Compras y Servicios',
      period,
      folioInicio,
      folioFin,
      nitLabel:    'NIT Contribuyente',
      nombreLabel: 'Nombre del Contribuyente',
      hasIdp:  data.totals.idp > 0,
      hasCol5: activeCols.length > 4,
      hasCol6: activeCols.length > 5,
      rows:   printRows,
      totals: printTotals,
      resumen: data.resumenCategoria.map(r => ({
        label:    activeCols.find(c => c.key === r.categoria)?.label ?? r.categoria,
        cantidad: r.cantidad, base: r.base, iva: r.iva, total: r.total,
      })),
    })
  }

  const period = data
    ? `Del ${dayjs(data.from).format('DD/MM/YYYY')} al ${dayjs(data.to).format('DD/MM/YYYY')}`
    : ''

  const tableColumns = buildColumns(libroConfig.compras)

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
          Libro de Compras y Servicios — SAT Guatemala
        </Title>
        <Space>
          <Space size={4}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Folio inicial:</Text>
            <InputNumber min={1} value={folioInicio} size="small" style={{ width: 72 }} onChange={v => setFolioInicio(v ?? 1)} />
          </Space>
          <RangePicker
            value={dateRange}
            onChange={(v) => { if (v?.[0] && v?.[1]) setDateRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>Generar</Button>
          {data && (
            <>
              <Button icon={<FileExcelOutlined />} loading={downloading} onClick={handleExcel} style={{ color: '#16a34a', borderColor: '#16a34a' }}>Excel</Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>Imprimir / PDF</Button>
            </>
          )}
        </Space>
      </div>

      {data && (
        <div id="report-print-area">
          <ReportHeader empresa={empresa} reportName="Libro de Compras y Servicios" period={period} folioInicio={folioInicio} folioFin={folioFin} />

          <div style={{ marginBottom: 8, fontSize: 11, color: '#6b7280' }}>
            {pages} hoja{pages !== 1 ? 's' : ''} carta estimada{pages !== 1 ? 's' : ''}
            &nbsp;·&nbsp; Folios asignados: <strong style={{ color: '#1B3A6B' }}>{folioInicio} al {folioFin}</strong>
            &nbsp;·&nbsp; Próximo reporte iniciará en folio <strong>{folioFin + 1}</strong>
          </div>

          <div style={{ background: '#1B3A6B', color: '#fff', fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: '6px 6px 0 0' }}>
            VALOR BASE (sin IVA) — por categoría SAT
          </div>

          <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: '0 0 8px 8px', borderTop: 'none' }}>
            <Table
              dataSource={data.items}
              columns={tableColumns}
              rowKey={(r) => r.uuid || r.numeroInterno}
              pagination={{ pageSize: 100, showSizeChanger: true, showTotal: (t) => `${t} registros` }}
              size="small"
              scroll={{ x: 'max-content' }}
              loading={loading}
              summary={() => data.items.length > 0 ? <TotalsRow data={data} colsConfig={libroConfig.compras} /> : null}
            />
          </Card>

          <ResumenIVA resumen={data.resumenCategoria} totals={data.totals} colsConfig={libroConfig.compras} />
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
