import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Card, Button, Table, Typography, Breadcrumb, Select, Space,
  Tag, InputNumber, message,
} from 'antd'
import { HomeOutlined, SearchOutlined, PrinterOutlined, FileExcelOutlined, ShopOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

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

const MESES = [
  { value: 1,  label: 'Enero' },   { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },   { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },    { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },   { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },  { value: 12, label: 'Diciembre' },
]
const CUR_YEAR = dayjs().year()
const ANIOS = Array.from({ length: 6 }, (_, i) => ({ value: CUR_YEAR - i, label: String(CUR_YEAR - i) }))

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
  bienes:               '#1faec2',
  servicios:            '#1faec2',
  combustibles:         '#ff7f00',
  importacion:          '#ff7f00',
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
    sorter: (a: any, b: any) => (a.folio ?? 0) - (b.folio ?? 0),
    render: (v: number) => <Text style={{ fontSize: 11, color: '#6b7280' }}>{v}</Text>,
  },
  {
    title: 'Tipo Doc.',
    dataIndex: 'tipoDocumento',
    width: 90,
    sorter: (a: any, b: any) => (a.tipoDocumento || '').localeCompare(b.tipoDocumento || ''),
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
    sorter: (a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    render: (v: string) => <span style={{ fontSize: 11 }}>{fmtD(v)}</span>,
  },
  {
    title: 'Fecha Contabiliz.',
    dataIndex: 'fechaContabilizacion',
    width: 105,
    sorter: (a: any, b: any) => new Date(a.fechaContabilizacion || a.fecha).getTime() - new Date(b.fechaContabilizacion || b.fecha).getTime(),
    render: (v: string, r: any) => {
      const isDiff = v && r.fecha && new Date(v).toDateString() !== new Date(r.fecha).toDateString()
      return (
        <span style={{ fontSize: 11, color: isDiff ? '#ff7f00' : undefined, fontWeight: isDiff ? 600 : undefined }}>
          {fmtD(v)}
        </span>
      )
    },
  },
  { title: 'Serie',         dataIndex: 'felSerie',   width: 55,  sorter: (a: any, b: any) => (a.felSerie || '').localeCompare(b.felSerie || ''),   render: (v: string) => <span style={{ fontSize: 11 }}>{v || '—'}</span> },
  { title: 'No. Documento', dataIndex: 'felNumero',  width: 100, sorter: (a: any, b: any) => (a.felNumero || '').localeCompare(b.felNumero || ''), render: (v: string) => <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> },
  { title: 'NIT Contribuyente',    dataIndex: 'nitProveedor',    width: 110, sorter: (a: any, b: any) => (a.nitProveedor || '').localeCompare(b.nitProveedor || ''),    render: (v: string) => <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span> },
  { title: 'Nombre del Contribuyente', dataIndex: 'nombreProveedor', ellipsis: true, width: 180, sorter: (a: any, b: any) => (a.nombreProveedor || '').localeCompare(b.nombreProveedor || ''), render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span> },
]

// ── Columnas fijas de cola (después de las categorías) ───────────────────────
const FIXED_TAIL_COLS = [
  {
    title: 'IDP',
    dataIndex: 'idp',
    width: 72,
    align: 'right' as const,
    sorter: (a: any, b: any) => (a.idp ?? 0) - (b.idp ?? 0),
    render: (v: number) => v > 0
      ? <span style={{ fontSize: 11, color: '#ff7f00' }}>{fmt(v)}</span>
      : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>,
  },
  {
    title: 'IVA',
    dataIndex: 'iva',
    width: 80,
    align: 'right' as const,
    sorter: (a: any, b: any) => (a.iva ?? 0) - (b.iva ?? 0),
    render: (v: number) => <span style={{ fontSize: 11 }}>{fmt(v)}</span>,
  },
  {
    title: 'Total Factura',
    dataIndex: 'total',
    width: 95,
    align: 'right' as const,
    sorter: (a: any, b: any) => (a.total ?? 0) - (b.total ?? 0),
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
      sorter: (a: any, b: any) => ((a[FIELD_MAP[col.key] ?? col.key] ?? 0) - (b[FIELD_MAP[col.key] ?? col.key] ?? 0)),
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
      <Table.Summary.Cell index={0} colSpan={8}>
        <Text strong style={{ fontSize: 11, color: '#1faec2' }}>
          TOTALES — {data.count} documentos
        </Text>
      </Table.Summary.Cell>
      {vals.map((v, i) => (
        <Table.Summary.Cell key={i} index={8 + i} align="right">
          <Text strong style={{ fontSize: 11, color: v > 0 ? '#1faec2' : '#d1d5db' }}>
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
      title={<span style={{ color: '#374151', fontWeight: 700, fontSize: 13 }}>Resumen por Categoría — Insumo Formulario IVA (SAT)</span>}
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
                <tr key={col.key} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)', opacity: cantidad === 0 ? 0.35 : 1 }}>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                      background: CATEGORIA_COLOR[col.key] ?? '#9aa1ab', marginRight: 8,
                    }} />
                    <span style={{ fontWeight: cantidad > 0 ? 600 : 400, color: CATEGORIA_COLOR[col.key] ?? '#6b7280' }}>
                      {col.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '7px 12px', color: '#6b7280' }}>{cantidad > 0 ? cantidad : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{base  > 0 ? fmtQ(base)  : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{iva > 0 ? fmtQ(iva) : '—'}</td>
                  <td style={{ textAlign: 'right',  padding: '7px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{total > 0 ? fmtQ(total) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1faec2', color: '#fff' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700 }}>TOTAL PERÍODO</td>
              <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}>
                {resumen.reduce((s, r) => s + (r.cantidad ?? 0), 0)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {fmtQ(resumen.reduce((s, r) => s + (r.base ?? 0), 0))}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {fmtQ(totals.iva)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
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
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(dayjs().year())
  const [data,        setData]        = useState<LibroComprasReport | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [empresa,     setEmpresa]     = useState<EmpresaInfo | null>(null)
  const [folioInicio, setFolioInicio] = useState<number>(1)
  const [libroConfig, setLibroConfig] = useState<LibroSATConfig>(DEFAULT_CONFIG)
  const dragCol    = useRef(-1)
  const [overCol,  setOverCol]  = useState(-1)
  const [colOrder, setColOrder] = useState<number[] | null>(null)

  useEffect(() => {
    getEmpresaInfo().then(setEmpresa).catch(() => {})
    getLibroSATConfig().then(setLibroConfig).catch(() => {})
    getCorrelativo('libro-compras', String(dayjs().year()))
      .then(r => setFolioInicio((r.current_correlativo ?? 0) + 1))
      .catch(() => {})
  }, [])

  const pages    = data ? Math.max(1, Math.ceil(data.count / ROWS_PER_PAGE)) : 0
  const folioFin = folioInicio + pages - 1
  const activeCols = libroConfig.compras.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  const fromDate = dayjs().year(selectedYear).month(selectedMonth - 1).startOf('month')
  const toDate   = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month')

  const load = () => {
    setLoading(true)
    getLibroCompras(fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'))
      .then(result => {
        setData(result)
        const pags = Math.max(1, Math.ceil(result.count / ROWS_PER_PAGE))
        setCorrelativo('libro-compras', folioInicio + pags - 1, String(selectedYear)).catch(() => {})
      })
      .catch(() => message.error('No se pudo cargar el Libro de Compras'))
      .finally(() => setLoading(false))
  }

  const handleExcel = async () => {
    if (!data) return
    setDownloading(true)
    try {
      await downloadLibroComprasExcel(
        fromDate.format('YYYY-MM-DD'),
        toDate.format('YYYY-MM-DD'),
        `libro-compras-${fromDate.format('YYYY-MM')}.xlsx`,
      )
    } catch { message.error('Error al descargar Excel') }
    finally { setDownloading(false) }
  }

  const handlePrint = () => {
    if (!data) return
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

  const rawCols        = buildColumns(libroConfig.compras)
  const effectiveOrder = (colOrder && colOrder.length === rawCols.length)
    ? colOrder
    : rawCols.map((_, i) => i)
  const tableColumns   = effectiveOrder.map((origIdx, displayIdx) => ({
    ...rawCols[origIdx],
    onHeaderCell: () => ({
      draggable: true,
      style: {
        background:  overCol === displayIdx ? '#dbeafe' : undefined,
        cursor:      'grab',
        transition:  'background 0.15s',
        userSelect:  'none' as const,
      },
      onDragStart: (e: any) => {
        dragCol.current = displayIdx
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(displayIdx))
      },
      onDragOver:  (e: any) => { e.preventDefault(); setOverCol(displayIdx) },
      onDragLeave: () => setOverCol(-1),
      onDrop: (e: any) => {
        e.preventDefault()
        setOverCol(-1)
        const from = dragCol.current
        if (from < 0 || from === displayIdx) return
        setColOrder(prev => {
          const base = (prev && prev.length === rawCols.length)
            ? [...prev]
            : rawCols.map((_, i) => i)
          base.splice(displayIdx, 0, base.splice(from, 1)[0])
          return base
        })
      },
      onDragEnd: () => { dragCol.current = -1; setOverCol(-1) },
    }),
  }))

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: 'Compras' },
          { title: 'Libro de Compras' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <ShopOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            Libro de Compras y Servicios — SAT Guatemala
          </Title>
        </div>
        <Space>
          <Space size={4}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Folio inicial:</Text>
            <InputNumber min={1} value={folioInicio} size="small" style={{ width: 72 }} onChange={v => setFolioInicio(v ?? 1)} />
          </Space>
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={MESES}
            style={{ width: 130 }}
            size="middle"
          />
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={ANIOS}
            style={{ width: 90 }}
            size="middle"
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>Generar</Button>
          {data && (
            <>
              <Button icon={<FileExcelOutlined />} loading={downloading} onClick={handleExcel} style={{ color: '#2ea172', borderColor: '#2ea172' }}>Excel</Button>
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
            &nbsp;·&nbsp; Folios asignados: <strong style={{ color: '#1faec2' }}>{folioInicio} al {folioFin}</strong>
            &nbsp;·&nbsp; Próximo reporte iniciará en folio <strong>{folioFin + 1}</strong>
          </div>

          <div style={{ background: '#1faec2', color: '#fff', fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: '6px 6px 0 0' }}>
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
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa1ab' }}>
            Seleccione un período y presione <strong>Generar</strong> para ver el Libro de Compras.
          </div>
        </Card>
      )}
    </div>
  )
}
