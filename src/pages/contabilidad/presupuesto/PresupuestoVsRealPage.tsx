import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Spin, message, Tag, Space, Tooltip,
  Card, Statistic, Dropdown, Switch,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  ArrowLeftOutlined, WarningOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ReloadOutlined, RiseOutlined, FallOutlined,
  DashboardOutlined, FileExcelOutlined, FilePdfOutlined, PrinterOutlined,
  MailOutlined, DownloadOutlined, CloudUploadOutlined, BarChartOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import {
  getPresupuestoVsReal,
  type BudgetVsReal, type BudgetVsRealRow,
  PERIODO_LABELS, STATUS_COLOR, STATUS_LABEL,
} from '../../../api/presupuesto'
import { getCentrosCosto, type CentroCosto } from '../../../api/centros-costo'
import { getCentrosBeneficio, type CentroBeneficio } from '../../../api/centros-beneficio'

const { Title, Text } = Typography

function fmtQ(n: number) {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}

function pctColor(pct: number | null, isExpense: boolean): string {
  if (pct === null) return '#6b7280'
  if (isExpense) {
    if (pct > 110) return '#e5484d'
    if (pct > 90)  return '#d4640a'
    return '#2ea172'
  }
  if (pct >= 90) return '#2ea172'
  if (pct >= 50) return '#d4640a'
  return '#e5484d'
}


// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, suffix, color, icon, sub }: {
  title: string; value: number | null; suffix?: string; color: string;
  icon: React.ReactNode; sub?: string
}) {
  return (
    <Card size="small" style={{ borderTop: `3px solid ${color}`, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 22, color, marginTop: 2 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>{title}</div>
          {value !== null ? (
            <Statistic
              value={value}
              suffix={suffix}
              precision={suffix === '%' ? 1 : 2}
              valueStyle={{ fontSize: 20, color, lineHeight: '28px' }}
            />
          ) : (
            <div style={{ fontSize: 18, color: '#9aa1ab', lineHeight: '28px' }}>—</div>
          )}
          {sub && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </Card>
  )
}

// ── Top Variaciones — Gráfico de barras horizontal divergente ────────────────

function TopVariacionesPanel({ items }: { items: BudgetVsReal['topVariaciones'] }) {
  if (!items.length) return null

  const maxAbs    = Math.max(...items.map(i => Math.abs(i.varianza)), 1)
  const posItems  = items.filter(r => r.varianza >= 0).length
  const negItems  = items.filter(r => r.varianza <  0).length

  return (
    <Card
      size="small"
      style={{ marginBottom: 0 }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      {/* Leyenda */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, fontSize: 11,
      }}>
        <span style={{ color: '#e5484d', fontWeight: 600 }}>
          ← Desfavorable ({negItems})
        </span>
        <span style={{ color: '#6b7280', fontSize: 10, letterSpacing: 0.5 }}>
          VARIACIÓN TOTAL POR CUENTA (ordenado por magnitud absoluta)
        </span>
        <span style={{ color: '#2ea172', fontWeight: 600 }}>
          Favorable ({posItems}) →
        </span>
      </div>

      {/* Gráfico */}
      <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
        {items.map((r, i) => {
          const isPos  = r.varianza >= 0
          const pct    = Math.abs(r.varianza) / maxAbs * 100   // 0–100 relativo al máximo
          const halfW  = pct / 2                               // cada mitad ocupa hasta 50% del contenedor

          return (
            <div key={r.accountId} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              borderBottom: i < items.length - 1 ? '1px solid #fafbfc' : undefined,
            }}>
              {/* Rank + cuenta */}
              <div style={{ width: 200, minWidth: 200, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: i === 0 ? 'var(--rank-gold)' : i === 1 ? 'var(--rank-silver)' : i === 2 ? 'var(--rank-bronze)' : '#9aa1ab',
                  borderRadius: 10, minWidth: 22, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 11, lineHeight: '14px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={r.accountName}>
                    {r.accountName}
                  </div>
                  <div style={{ fontSize: 10, color: '#9aa1ab' }}>{r.accountCode}</div>
                </div>
              </div>

              {/* Barras divergentes — eje central */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 24, minWidth: 0 }}>
                {/* Mitad izquierda (negativo) */}
                <div style={{
                  flex: 1, height: '100%',
                  display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                }}>
                  {!isPos && (
                    <Tooltip title={`${fmtQ(r.varianza)}`}>
                      <div style={{
                        width: `${halfW * 2}%`, height: 14,
                        background: 'linear-gradient(to left, #e5484d, #e5484d)',
                        borderRadius: '4px 0 0 4px',
                        transition: 'width 0.5s ease',
                        cursor: 'default',
                      }} />
                    </Tooltip>
                  )}
                </div>

                {/* Línea central */}
                <div style={{ width: 2, height: 24, background: 'rgba(10,10,10,0.08)', flexShrink: 0 }} />

                {/* Mitad derecha (positivo) */}
                <div style={{
                  flex: 1, height: '100%',
                  display: 'flex', alignItems: 'center',
                }}>
                  {isPos && (
                    <Tooltip title={`+${fmtQ(r.varianza)}`}>
                      <div style={{
                        width: `${halfW * 2}%`, height: 14,
                        background: 'linear-gradient(to right, #2ea172, #2ea172)',
                        borderRadius: '0 4px 4px 0',
                        transition: 'width 0.5s ease',
                        cursor: 'default',
                      }} />
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Monto + % */}
              <div style={{ width: 140, minWidth: 140, textAlign: 'right' }}>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: isPos ? '#2ea172' : '#e5484d',
                }}>
                  {r.varianza >= 0 ? '+' : ''}{fmtQ(r.varianza)}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {r.porcentaje !== null
                    ? `${r.porcentaje >= 0 ? '+' : ''}${r.porcentaje.toFixed(1)}% vs pres.`
                    : 'Sin pres. base'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#9aa1ab' }}>
        {items.length} cuenta{items.length !== 1 ? 's' : ''} · La barra más larga = mayor desvío absoluto
      </div>
    </Card>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function PresupuestoVsRealPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data,             setData]             = useState<BudgetVsReal | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [centrosCosto,     setCentrosCosto]     = useState<CentroCosto[]>([])
  const [centrosBeneficio, setCentrosBeneficio] = useState<CentroBeneficio[]>([])
  const [showTop5,            setShowTop5]            = useState(false)
  const [soloConMovimiento,   setSoloConMovimiento]   = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try { setData(await getPresupuestoVsReal(id)) }
    catch { message.error('Error al cargar el reporte') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getCentrosCosto().then(r => setCentrosCosto(Array.isArray(r) ? r : [])).catch(() => {})
    getCentrosBeneficio().then(r => setCentrosBeneficio(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  if (loading || !data) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>

  const { budget, rows, kpis, topVariaciones, currentPeriod } = data
  const labels       = PERIODO_LABELS[budget.periodo]
  const periodoCount = labels.length
  const alertCount   = rows.filter(r => r.alertaGlobal).length

  // ── Exportación ──────────────────────────────────────────────────────────────

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()

    const buildSheet = (sectionRows: BudgetVsRealRow[], sheetName: string) => {
      const header = [
        'Cuenta', 'Código', 'Tipo',
        ...labels.map(l => `${l} Pres.`),
        ...labels.map(l => `${l} Real`),
        ...labels.map(l => `${l} Var.`),
        'YTD Pres.', 'YTD Real', 'YTD Var.', 'Ejec. YTD %',
        'Forecast', 'Total Pres.', 'Total Real', 'Total Var.',
      ]
      const dataRows = sectionRows.map(r => [
        r.accountName, r.accountCode, r.accountType ?? '',
        ...r.periodos.map(p => p.presupuestado),
        ...r.periodos.map(p => p.real),
        ...r.periodos.map(p => p.varianza),
        r.ytdPresupuestado, r.ytdReal, r.ytdVarianza,
        r.ytdPorcentaje !== null ? r.ytdPorcentaje / 100 : '',
        r.forecast ?? '', r.totalPresupuestado, r.totalReal, r.totalVarianza,
      ])
      const ws = XLSX.utils.aoa_to_sheet([
        [`Presupuesto vs Real — ${budget.nombre}`],
        [`Período: ${dayjs(budget.fechaInicio).format('DD/MM/YYYY')} al ${dayjs(budget.fechaFin).format('DD/MM/YYYY')}`],
        [`Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`],
        [],
        header,
        ...dataRows,
      ])
      // Ancho columnas
      ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, ...Array(header.length - 3).fill({ wch: 14 })]
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    const incomeRows  = rows.filter(r => r.accountType?.toLowerCase() === 'income')
    const expenseRows = rows.filter(r => ['expense', 'contra'].includes(r.accountType?.toLowerCase() ?? ''))
    const otherRows   = rows.filter(r => !['income', 'expense', 'contra'].includes(r.accountType?.toLowerCase() ?? ''))

    if (incomeRows.length)  buildSheet(incomeRows,  'Ingresos')
    if (expenseRows.length) buildSheet(expenseRows, 'Gastos')
    if (otherRows.length)   buildSheet(otherRows,   'Activo-Pasivo-Capital')

    // Hoja KPIs
    const kpiWs = XLSX.utils.aoa_to_sheet([
      ['KPI', 'Valor'],
      ['Ejecución Global (%)',   kpis.ejecucionGlobal !== null ? kpis.ejecucionGlobal / 100 : ''],
      ['Ejecución YTD (%)',      kpis.ytdEjecucion    !== null ? kpis.ytdEjecucion    / 100 : ''],
      ['Margen Bruto (%)',       kpis.margenBruto     !== null ? kpis.margenBruto     / 100 : ''],
      ['Total Presupuestado',    kpis.totalPresupuestado],
      ['Total Real',             kpis.totalReal],
      ['YTD Presupuestado',      kpis.ytdPresupuestado],
      ['YTD Real',               kpis.ytdReal],
    ])
    XLSX.utils.book_append_sheet(wb, kpiWs, 'KPIs')

    XLSX.writeFile(wb, `PresupuestoVsReal_${budget.nombre.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.xlsx`)
  }

  const handlePrint = () => window.print()

  const handleEmail = () => {
    const subject = encodeURIComponent(`Reporte Presupuesto vs Real — ${budget.nombre}`)
    const body = encodeURIComponent(
      `Adjunto el reporte Presupuesto vs Real:\n\n` +
      `Presupuesto: ${budget.nombre}\n` +
      `Período: ${dayjs(budget.fechaInicio).format('DD/MM/YYYY')} al ${dayjs(budget.fechaFin).format('DD/MM/YYYY')}\n\n` +
      `KPIs:\n` +
      `• Ejecución global: ${kpis.ejecucionGlobal !== null ? kpis.ejecucionGlobal.toFixed(1) + '%' : 'N/A'}\n` +
      `• Ejecución YTD: ${kpis.ytdEjecucion !== null ? kpis.ytdEjecucion.toFixed(1) + '%' : 'N/A'}\n` +
      `• Margen bruto: ${kpis.margenBruto !== null ? kpis.margenBruto.toFixed(1) + '%' : 'N/A'}\n` +
      `• Alertas activas: ${alertCount}\n\n` +
      `Generado desde Lucía el ${dayjs().format('DD/MM/YYYY HH:mm')}`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
  }

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      icon: <FileExcelOutlined style={{ color: '#217346' }} />,
      label: 'Exportar Excel (.xlsx)',
      onClick: exportExcel,
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined style={{ color: '#e53935' }} />,
      label: 'Exportar PDF / Imprimir',
      onClick: handlePrint,
    },
    { type: 'divider' },
    {
      key: 'zoho',
      icon: <CloudUploadOutlined style={{ color: '#cc6600' }} />,
      label: (
        <Tooltip title="Requiere configuración de API Zoho — próximamente">
          <span style={{ color: '#9aa1ab' }}>Exportar a Zoho Sheet</span>
        </Tooltip>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'email',
      icon: <MailOutlined />,
      label: 'Enviar por correo',
      onClick: handleEmail,
    },
  ]

  const isExpenseType = (type: string | null) =>
    ['expense', 'EXPENSE', 'contra', 'CONTRA'].includes(type ?? '')

  // ── Anchos fijos; período sin ancho → el browser distribuye el espacio restante ─
  const W = { cuenta: 190, sub: 44, ytd: 118, forecast: 126, total: 128 }
  const W_MIN_PERIODO = 82   // mínimo por si la pantalla es muy estrecha
  const stickyR = { total: 0, forecast: W.total, ytd: W.total + W.forecast }

  // ── Estilos base ─────────────────────────────────────────────────────────────
  const thBase: React.CSSProperties = {
    padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280',
    textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '2px solid rgba(10,10,10,0.08)',
    background: '#fafbfc',
  }
  const tdNum: React.CSSProperties = { padding: '3px 5px', textAlign: 'right', fontSize: 11 }
  const stickyLeft0: React.CSSProperties   = { position: 'sticky', left: 0,         zIndex: 1, background: '#fff' }
  const stickyLeftSub: React.CSSProperties = { position: 'sticky', left: W.cuenta,  zIndex: 1, background: '#fff' }

  const incomeRows  = rows.filter(r => r.accountType?.toLowerCase() === 'income')
  const expenseRows = rows.filter(r => ['expense', 'contra'].includes(r.accountType?.toLowerCase() ?? ''))
  const otherRows   = rows.filter(r => !['income', 'expense', 'contra'].includes(r.accountType?.toLowerCase() ?? ''))

  const renderSection = (title: string, sectionRows: BudgetVsRealRow[], accentColor: string, isExp: boolean) => {
    if (soloConMovimiento) {
      sectionRows = sectionRows.filter(r => r.totalReal !== 0 || r.totalPresupuestado !== 0)
    }
    if (!sectionRows.length) return null

    const totPres    = sectionRows.reduce((s, r) => s + r.totalPresupuestado, 0)
    const totReal    = sectionRows.reduce((s, r) => s + r.totalReal, 0)
    const totVar     = sectionRows.reduce((s, r) => s + r.totalVarianza, 0)
    const totYtdPres = sectionRows.reduce((s, r) => s + r.ytdPresupuestado, 0)
    const totYtdReal = sectionRows.reduce((s, r) => s + r.ytdReal, 0)
    const totYtdVar  = sectionRows.reduce((s, r) => s + r.ytdVarianza, 0)
    const execPct    = totPres > 0 ? (totReal / totPres * 100).toFixed(1) : null
    const favSection = isExp ? totVar <= 0 : totVar >= 0

    const periodTotals = labels.map((_, i) => {
      const p = i + 1
      return {
        pres: sectionRows.reduce((s, r) => s + (r.periodos.find(pe => pe.periodo === p)?.presupuestado ?? 0), 0),
        real: sectionRows.reduce((s, r) => s + (r.periodos.find(pe => pe.periodo === p)?.real ?? 0), 0),
        var:  sectionRows.reduce((s, r) => s + (r.periodos.find(pe => pe.periodo === p)?.varianza ?? 0), 0),
      }
    })

    const green = '#2ea172', red = '#e5484d', gray = '#6b7280'
    const minTableW = W.cuenta + W.sub + labels.length * W_MIN_PERIODO + W.ytd + W.forecast + W.total

    return (
      <div style={{ marginBottom: 32 }}>
        {/* Cabecera de sección */}
        <div style={{
          padding: '7px 14px', background: accentColor, color: '#fff',
          borderRadius: '4px 4px 0 0', fontWeight: 700, fontSize: 13,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        }}>
          <span>{title}</span>
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.9 }}>
            Pres: {fmtQ(totPres)} &nbsp;·&nbsp; Real: {fmtQ(totReal)} &nbsp;·&nbsp;
            <span style={{ color: favSection ? '#d9f7be' : '#ffccc7' }}>
              Var: {totVar >= 0 ? '+' : ''}{fmtQ(totVar)}
            </span>
            {execPct && <> &nbsp;·&nbsp; {execPct}% ejec.</>}
            <span style={{ opacity: 0.65, fontSize: 10 }}> &nbsp;| YTD Real: {fmtQ(totYtdReal)}</span>
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid rgba(10,10,10,0.08)', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed',
            width: '100%', minWidth: minTableW }}>
            <colgroup>
              <col style={{ width: W.cuenta }} />
              <col style={{ width: W.sub }} />
              {labels.map((_, i) => <col key={i} />)}{/* sin ancho → auto-distribuido */}
              <col style={{ width: W.ytd }} />
              <col style={{ width: W.forecast }} />
              <col style={{ width: W.total }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left', paddingLeft: 12, ...stickyLeft0, zIndex: 3 }}>CUENTA</th>
                <th style={{ ...thBase, ...stickyLeftSub, zIndex: 3 }}></th>
                {labels.map((label, i) => (
                  <th key={i} style={{ ...thBase }}>
                    {label}
                    {(i + 1) === currentPeriod && (
                      <span style={{ display: 'block', fontSize: 8, color: '#1faec2', fontWeight: 800 }}>● HOY</span>
                    )}
                  </th>
                ))}
                <th style={{ ...thBase, background: '#fafbfc', position: 'sticky', right: stickyR.ytd, zIndex: 3 }}>
                  YTD<br /><span style={{ fontSize: 9, fontWeight: 400 }}>acumulado</span>
                </th>
                <th style={{ ...thBase, position: 'sticky', right: stickyR.forecast, zIndex: 3 }}>
                  Forecast<br /><span style={{ fontSize: 9, fontWeight: 400 }}>proyección</span>
                </th>
                <th style={{ ...thBase, position: 'sticky', right: stickyR.total, zIndex: 3 }}>
                  Total año
                </th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((row, ri) => {
                const fav    = isExp ? row.totalVarianza <= 0 : row.totalVarianza >= 0
                const ytdFav = isExp ? row.ytdVarianza  <= 0 : row.ytdVarianza  >= 0
                const rowBg  = row.alertaGlobal === 'OVER_BUDGET' ? '#fdecec' : row.alertaGlobal === 'WARNING' ? '#fff2e5' : '#fff'
                const colR   = (c: string) => ({ color: c })

                return (
                  <>
                    {/* ── Fila Pres. ── */}
                    <tr key={`${row.accountId}-p`} style={{ borderTop: ri > 0 ? '2px solid rgba(10,10,10,0.08)' : undefined }}>
                      <td rowSpan={3} style={{
                        ...stickyLeft0, padding: '8px 8px 8px 12px',
                        verticalAlign: 'middle', background: rowBg,
                        borderRight: '1px solid rgba(10,10,10,0.08)',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 12, lineHeight: '15px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={row.accountName}>{row.accountName}</div>
                        <div style={{ fontSize: 10, color: gray }}>{row.accountCode}</div>
                        {row.alertaGlobal && (
                          <Tag
                            color={row.alertaGlobal === 'OVER_BUDGET' ? '#e5484d' : '#ff7f00'}
                            style={{ fontSize: 9, padding: '0 4px', marginTop: 3, lineHeight: '16px' }}>
                            {row.alertaGlobal === 'OVER_BUDGET' ? 'EXCEDIDO' : 'ADVERTENCIA'}
                          </Tag>
                        )}
                      </td>
                      <td style={{ ...stickyLeftSub, textAlign: 'center', color: gray, fontWeight: 600,
                        fontSize: 9, padding: '3px 2px', background: rowBg, borderRight: '1px solid rgba(10,10,10,0.08)' }}>
                        Pres.
                      </td>
                      {row.periodos.map(p => (
                        <td key={p.periodo} style={{ ...tdNum, ...colR(gray), background: (p.periodo === currentPeriod) ? '#fafcff' : rowBg }}>
                          {p.presupuestado !== 0 ? fmtQ(p.presupuestado) : <span style={{ color: '#e0e0e0' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ ...tdNum, background: '#fafbfc', position: 'sticky', right: stickyR.ytd, ...colR(gray) }}>
                        {fmtQ(row.ytdPresupuestado)}
                      </td>
                      <td style={{ ...tdNum, position: 'sticky', right: stickyR.forecast, background: rowBg }} />
                      <td style={{ ...tdNum, position: 'sticky', right: stickyR.total, background: rowBg, ...colR(gray), borderLeft: '1px solid rgba(10,10,10,0.08)' }}>
                        {fmtQ(row.totalPresupuestado)}
                      </td>
                    </tr>

                    {/* ── Fila Real ── */}
                    <tr key={`${row.accountId}-r`}>
                      <td style={{ ...stickyLeftSub, textAlign: 'center', color: '#333', fontWeight: 700,
                        fontSize: 9, padding: '3px 2px', background: rowBg, borderRight: '1px solid rgba(10,10,10,0.08)' }}>
                        Real
                      </td>
                      {row.periodos.map(p => (
                        <td key={p.periodo} style={{ ...tdNum, fontWeight: p.real !== 0 ? 600 : 400,
                          background: (p.periodo === currentPeriod) ? '#fafcff' : rowBg }}>
                          {p.real !== 0 ? fmtQ(p.real) : <span style={{ color: '#e0e0e0' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ ...tdNum, fontWeight: 600, background: '#fafbfc', position: 'sticky', right: stickyR.ytd }}>
                        {fmtQ(row.ytdReal)}
                      </td>
                      <td style={{ ...tdNum, position: 'sticky', right: stickyR.forecast, background: rowBg }}>
                        {row.forecast !== null
                          ? <span style={{ color: '#6b7280', fontWeight: 700 }}>{fmtQ(row.forecast)}</span>
                          : <span style={{ color: '#9aa1ab' }}>—</span>}
                      </td>
                      <td style={{ ...tdNum, fontWeight: 700, position: 'sticky', right: stickyR.total, background: rowBg, borderLeft: '1px solid rgba(10,10,10,0.08)' }}>
                        {fmtQ(row.totalReal)}
                      </td>
                    </tr>

                    {/* ── Fila Var. ── */}
                    <tr key={`${row.accountId}-v`}>
                      <td style={{ ...stickyLeftSub, textAlign: 'center', fontWeight: 700,
                        fontSize: 9, padding: '3px 2px',
                        color: fav ? green : red,
                        background: rowBg, borderRight: '1px solid rgba(10,10,10,0.08)' }}>
                        Var.
                      </td>
                      {row.periodos.map(p => {
                        const pfav = isExp ? p.varianza <= 0 : p.varianza >= 0
                        const hasAlert = p.alerta != null
                        return (
                          <td key={p.periodo} style={{ ...tdNum, fontWeight: 600,
                            color: p.varianza === 0 ? 'rgba(10,10,10,0.08)' : pfav ? green : red,
                            background: hasAlert
                              ? (p.alerta === 'OVER_BUDGET' ? '#fff0f0' : '#fffbe0')
                              : (p.periodo === currentPeriod) ? '#fafcff' : rowBg }}>
                            {p.varianza !== 0
                              ? `${p.varianza > 0 ? '+' : ''}${fmtQ(p.varianza)}`
                              : <span style={{ color: 'rgba(10,10,10,0.08)' }}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{ ...tdNum, fontWeight: 700,
                        color: ytdFav ? green : red,
                        background: '#fafbfc', position: 'sticky', right: stickyR.ytd }}>
                        {row.ytdVarianza !== 0 ? `${row.ytdVarianza > 0 ? '+' : ''}${fmtQ(row.ytdVarianza)}` : '—'}
                        {row.ytdPorcentaje !== null && row.ytdPresupuestado > 0 && (
                          <div style={{ fontSize: 9, opacity: 0.8 }}>{row.ytdPorcentaje.toFixed(0)}% ejec.</div>
                        )}
                      </td>
                      <td style={{ ...tdNum, position: 'sticky', right: stickyR.forecast, background: rowBg }}>
                        {row.forecast !== null && (
                          <Tooltip title="Forecast vs total presupuestado">
                            <span style={{ fontSize: 10, color: (isExp ? row.forecast <= row.totalPresupuestado : row.forecast >= row.totalPresupuestado) ? green : red }}>
                              {(row.forecast - row.totalPresupuestado) >= 0 ? '+' : ''}{fmtQ(row.forecast - row.totalPresupuestado)}
                            </span>
                          </Tooltip>
                        )}
                      </td>
                      <td style={{ ...tdNum, fontWeight: 700,
                        color: fav ? green : red,
                        position: 'sticky', right: stickyR.total, background: rowBg, borderLeft: '1px solid rgba(10,10,10,0.08)' }}>
                        {row.totalVarianza !== 0 ? `${row.totalVarianza > 0 ? '+' : ''}${fmtQ(row.totalVarianza)}` : '—'}
                        {row.totalPresupuestado > 0 && row.totalVarianza !== 0 && (
                          <div style={{ fontSize: 9, opacity: 0.8 }}>
                            {(row.totalVarianza / row.totalPresupuestado * 100).toFixed(1)}%
                          </div>
                        )}
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>

            {/* ── Totales ── */}
            <tfoot>
              {(['pres', 'real', 'var'] as const).map(sub => {
                const isVar  = sub === 'var'
                const isReal = sub === 'real'
                const bg     = '#f0f2f5'
                const favTotal = isExp ? totVar <= 0 : totVar >= 0
                return (
                  <tr key={sub} style={{ borderTop: sub === 'pres' ? '2px solid rgba(10,10,10,0.08)' : undefined }}>
                    {sub === 'pres' && (
                      <td rowSpan={3} style={{ ...stickyLeft0, padding: '6px 12px', fontWeight: 800,
                        fontSize: 11, background: bg, color: '#1faec2', borderRight: '1px solid rgba(10,10,10,0.08)',
                        verticalAlign: 'middle' }}>
                        TOTAL {title.toUpperCase()}
                      </td>
                    )}
                    <td style={{ ...stickyLeftSub, textAlign: 'center', fontSize: 9, fontWeight: 700,
                      color: isVar ? (favTotal ? green : red) : isReal ? '#333' : gray,
                      background: bg, borderRight: '1px solid #e0e0e0', padding: '3px 2px' }}>
                      {sub === 'pres' ? 'Pres.' : sub === 'real' ? 'Real' : 'Var.'}
                    </td>
                    {periodTotals.map((pt, i) => {
                      const val  = pt[sub]
                      const pfav = isExp ? pt.var <= 0 : pt.var >= 0
                      return (
                        <td key={i} style={{ ...tdNum, background: bg,
                          fontWeight: isVar ? 700 : isReal ? 600 : 400,
                          color: isVar ? (pfav ? green : red) : isReal ? '#222' : gray }}>
                          {val !== 0
                            ? `${isVar && val > 0 ? '+' : ''}${fmtQ(val)}`
                            : <span style={{ color: '#d0d0d0' }}>—</span>}
                        </td>
                      )
                    })}
                    <td style={{ ...tdNum, background: '#e8eeff', fontWeight: isVar ? 700 : isReal ? 600 : 400,
                      color: isVar ? (isExp ? totYtdVar <= 0 : totYtdVar >= 0) ? green : red : isReal ? '#222' : gray,
                      position: 'sticky', right: stickyR.ytd }}>
                      {sub === 'pres' ? fmtQ(totYtdPres)
                        : sub === 'real' ? fmtQ(totYtdReal)
                        : `${totYtdVar >= 0 ? '+' : ''}${fmtQ(totYtdVar)}`}
                    </td>
                    <td style={{ ...tdNum, background: bg, position: 'sticky', right: stickyR.forecast }} />
                    <td style={{ ...tdNum, background: bg, fontWeight: isVar ? 700 : isReal ? 600 : 400,
                      color: isVar ? (favTotal ? green : red) : isReal ? '#222' : gray,
                      position: 'sticky', right: stickyR.total, borderLeft: '1px solid rgba(10,10,10,0.08)' }}>
                      {sub === 'pres' ? fmtQ(totPres)
                        : sub === 'real' ? fmtQ(totReal)
                        : `${totVar >= 0 ? '+' : ''}${fmtQ(totVar)}`}
                    </td>
                  </tr>
                )
              })}
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  const ejecGlobalColor = kpis.ejecucionGlobal !== null
    ? kpis.ejecucionGlobal >= 90 ? '#2ea172' : kpis.ejecucionGlobal >= 50 ? '#d4640a' : '#e5484d'
    : '#6b7280'

  const ccObj = centrosCosto.find(c => c.id === budget.centroCostoId)
  const cbObj = centrosBeneficio.find(c => c.id === budget.centroBeneficioId)
  const centroCosto     = budget.centroCostoId     ? `CC: ${ccObj ? `${ccObj.codigo} — ${ccObj.nombre}` : budget.centroCostoId}`     : null
  const centroBeneficio = budget.centroBeneficioId ? `CB: ${cbObj ? `${cbObj.codigo} — ${cbObj.nombre}` : budget.centroBeneficioId}` : null

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .row-over-budget { background: #fdecec !important; }
        .row-over-budget:hover > td { background: #ffe7e4 !important; }
        .row-warning { background: #fff2e5 !important; }
        .row-warning:hover > td { background: #ffe8cc !important; }
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px !important; }
          .ant-table { font-size: 9px !important; }
          .ant-table-cell { padding: 2px 4px !important; }
          .presupuesto-vsreal-page { padding: 8px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button className="no-print" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/contabilidad/presupuesto/${id}`)}>
          Volver al presupuesto
        </Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
              {budget.nombre} — Presupuesto vs Real
            </Title>
            <Tag color={STATUS_COLOR[budget.status]}>{STATUS_LABEL[budget.status]}</Tag>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(budget.fechaInicio).format('DD MMM YYYY')} – {dayjs(budget.fechaFin).format('DD MMM YYYY')}
            </Text>
            {centroCosto     && <Tag color="#1faec2"  style={{ fontSize: 11 }}>{centroCosto}</Tag>}
            {centroBeneficio && <Tag color="#2ea172" style={{ fontSize: 11 }}>{centroBeneficio}</Tag>}
          </div>
        </div>
        <Space className="no-print">
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>Actualizar</Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>Imprimir</Button>
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight" trigger={['click']}>
            <Button type="primary" size="small" style={{ background: '#1faec2' }} icon={<DownloadOutlined />}>
              Exportar ▾
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: showTop5 ? 12 : 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <KpiCard
            title="EJECUCIÓN GLOBAL"
            value={kpis.ejecucionGlobal}
            suffix="%"
            color={ejecGlobalColor}
            icon={<DashboardOutlined />}
            sub={`${fmtQ(kpis.totalReal)} de ${fmtQ(kpis.totalPresupuestado)}`}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <KpiCard
            title="EJECUCIÓN YTD"
            value={kpis.ytdEjecucion}
            suffix="%"
            color={kpis.ytdEjecucion !== null ? (kpis.ytdEjecucion >= 90 ? '#2ea172' : '#d4640a') : '#6b7280'}
            icon={<RiseOutlined />}
            sub={`Hasta período ${currentPeriod} de ${periodoCount}`}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <KpiCard
            title="MARGEN BRUTO"
            value={kpis.margenBruto}
            suffix="%"
            color={kpis.margenBruto !== null ? (kpis.margenBruto >= 0 ? '#1faec2' : '#e5484d') : '#6b7280'}
            icon={kpis.margenBruto !== null && kpis.margenBruto >= 0 ? <RiseOutlined /> : <FallOutlined />}
            sub="Ingresos - Gastos / Ingresos"
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <KpiCard
            title="ALERTAS ACTIVAS"
            value={alertCount}
            color={alertCount > 0 ? '#e5484d' : '#2ea172'}
            icon={alertCount > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
            sub={alertCount > 0 ? 'Cuentas fuera del presupuesto' : 'Todo dentro del presupuesto'}
          />
        </div>

        {/* 5ª tarjeta: Top Variaciones — interactiva */}
        <div style={{ flex: '1 1 180px' }}>
          <Card
            size="small"
            onClick={() => setShowTop5(v => !v)}
            style={{
              borderTop: `3px solid #6b5b95`,
              height: '100%',
              cursor: 'pointer',
              background: showTop5 ? '#f5f0ff' : '#fff',
              boxShadow: showTop5 ? '0 0 0 2px #6b5b9540' : undefined,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: 22, color: '#6b5b95', marginTop: 2 }}>
                <BarChartOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>
                  TOP VARIACIONES
                </div>
                <div style={{ fontSize: 20, color: '#6b5b95', lineHeight: '28px', fontWeight: 700 }}>
                  {topVariaciones.length}
                </div>
                <div style={{ fontSize: 10, color: showTop5 ? '#6b5b95' : '#6b7280', marginTop: 2, fontWeight: showTop5 ? 600 : 400 }}>
                  {showTop5 ? '▲ Ocultar detalle' : '▼ Ver cuentas más desviadas'}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Panel Top 5 — desplegable ────────────────────────────────────────── */}
      {showTop5 && (
        <div style={{ marginBottom: 20, animation: 'fadeIn 0.2s ease' }}>
          <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <TopVariacionesPanel items={topVariaciones} />
        </div>
      )}


      {/* ── Filtro ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Switch size="small" checked={soloConMovimiento} onChange={setSoloConMovimiento} />
        <Text style={{ fontSize: 11, color: '#6b7280' }}>Solo con movimiento</Text>
      </div>

      {/* ── Tablas por sección ────────────────────────────────────────────────── */}
      {renderSection('Ingresos',  incomeRows,  '#1faec2', false)}
      {renderSection('Gastos',    expenseRows, '#5c5c8a', true)}
      {otherRows.length > 0 && renderSection('Activo, Pasivo y Capital', otherRows, '#6b7280', false)}
    </div>
  )
}
