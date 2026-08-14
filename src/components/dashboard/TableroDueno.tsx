import { useState, useEffect, useMemo, useCallback } from 'react'
import { Spin, Empty, Tooltip, Typography, Select } from 'antd'
import { ArrowRightOutlined, ThunderboltOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCompanyStore } from '../../store/companyStore'
import {
  getExecutiveDashboard,
  type ExecutiveDashboardData,
  type ExecutiveAgingSection,
  type ExecutiveAgingRow,
  type RatioItem,
} from '../../api/reportes'

const { Text } = Typography

// ── Tipos y período ───────────────────────────────────────────────────────────
type Periodo = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Año'
const PERIODOS: Periodo[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Año']

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Trimestre actual (1..4) según la fecha del sistema */
function trimestreActual(): Periodo {
  const m = dayjs().month() // 0..11
  return (['Q1', 'Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4'][m]) as Periodo
}

// El período representa el cierre acumulado: flujos del 01-ene al fin del trimestre
// (convención de Estado de Resultados en Guatemala) y balances al corte (fin del trimestre).
function rangoDePeriodo(periodo: Periodo, anio: number): { from: string; to: string; etiqueta: string } {
  const finMes: Record<Periodo, number> = { Q1: 2, Q2: 5, Q3: 8, Q4: 11, 'Año': 11 } // mes final (0-based)
  const mf   = finMes[periodo]
  const from = `${anio}-01-01`
  const to   = dayjs(`${anio}-${String(mf + 1).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')
  const etiqueta = periodo === 'Año'
    ? `Año completo ${anio} — ene a dic`
    : `Al cierre de ${periodo} ${anio} — ene a ${MESES_CORTOS[mf]}`
  return { from, to, etiqueta }
}

// ── Formato ───────────────────────────────────────────────────────────────────
function moneyC(n: number, cur = 'GTQ'): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const simbolo = cur === 'GTQ' ? 'Q' : '$'
  if (abs >= 1_000_000) return `${sign}${simbolo} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${simbolo} ${Math.round(abs / 1_000)}K`
  return `${sign}${simbolo} ${abs.toFixed(0)}`
}
function moneyFull(n: number, cur = 'GTQ'): string {
  return `${cur === 'GTQ' ? 'Q' : '$'} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}
const pct1 = (n: number): string => `${(Number(n) || 0).toFixed(1)}%`

// ── Semáforo ──────────────────────────────────────────────────────────────────
type Nivel = 'critico' | 'atencion' | 'saludable' | 'neutro'
const COLOR_TXT: Record<Nivel, string>  = { critico: '#d03b3b', atencion: '#c98500', saludable: '#0ca30c', neutro: '#9aa1ab' }
const COLOR_BAR: Record<Nivel, string>  = { critico: '#d03b3b', atencion: '#fab219', saludable: '#1baf7a', neutro: '#e5e7eb' }
const BADGE: Record<Nivel, { bg: string; fg: string }> = {
  critico:   { bg: '#fcebeb', fg: '#a32d2d' },
  atencion:  { bg: '#faeeda', fg: '#854f0b' },
  saludable: { bg: '#eaf3de', fg: '#3b6d11' },
  neutro:    { bg: '#f1f3f5', fg: '#6b7280' },
}
// Morosidad (CxC/CxP): <30 saludable, 30-60 atención, >60 crítico
const nivelMorosidad = (pct: number): Nivel => pct > 60 ? 'critico' : pct >= 30 ? 'atencion' : 'saludable'
// Liquidez: ≥1.5 saludable, 1-1.5 atención, <1 crítico
const nivelLiquidez  = (v: number): Nivel => v >= 1.5 ? 'saludable' : v >= 1 ? 'atencion' : 'critico'
// Margen: ≥5 saludable, 0-5 atención, <0 crítico
const nivelMargen    = (v: number): Nivel => v >= 5 ? 'saludable' : v >= 0 ? 'atencion' : 'critico'
// ROA: ≥5 saludable, 0-5 atención, <0 crítico
const nivelRoa       = (v: number): Nivel => v >= 5 ? 'saludable' : v >= 0 ? 'atencion' : 'critico'
// Apalancamiento CxP/CxC: <0.8 saludable, 0.8-1 atención, >1 crítico
const nivelApalanca  = (v: number): Nivel => v > 1 ? 'critico' : v >= 0.8 ? 'atencion' : 'saludable'

function nombreEntidad(row: ExecutiveAgingRow, kind: 'ar' | 'ap'): string {
  const n = kind === 'ar' ? (row.customer_name || 'Cliente') : (row.vendor_name || 'Proveedor')
  return n.length > 26 ? `${n.slice(0, 24)}…` : n
}

// ── Sub-componentes de presentación ───────────────────────────────────────────
function Barra({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5, margin: '0 0 5px', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

type Segmento = { valor: number; color: string; label: string }
function BarraSegmentada({ segmentos, alto = 12 }: { segmentos: Segmento[]; alto?: number }) {
  const total = segmentos.reduce((s, x) => s + Math.abs(x.valor), 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: alto, borderRadius: 3, overflow: 'hidden', margin: '6px 0' }}>
        {segmentos.map((s, i) => (
          <div key={i} title={`${s.label}: ${s.valor}`}
            style={{ width: `${(Math.abs(s.valor) / total) * 100}%`, minWidth: s.valor !== 0 ? 3 : 0, background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {segmentos.map((s, i) => (
          <span key={i} style={{ fontSize: 9, color: '#9aa1ab', display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: 1, background: s.color, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const cssMc: React.CSSProperties = { padding: '11px 12px', borderRight: '0.5px solid #e5e7eb', minWidth: 0 }
// Etiqueta de cada métrica: legible (slate oscuro, mayúsculas suaves) para que el usuario
// identifique claramente cada bloque — antes era gris claro y no se veía.
const lblStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: '#475569', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.03em',
}
const valStyle: React.CSSProperties = { fontSize: 17, fontWeight: 500, color: '#0a0a0a', marginBottom: 2 }

function Metrica({ label, valor, sub, subColor, children }: {
  label: string; valor: string; sub?: string; subColor?: string; children?: React.ReactNode
}) {
  return (
    <div style={cssMc}>
      <div style={lblStyle}>{label}</div>
      <div style={valStyle}>{valor}</div>
      {sub && <div style={{ fontSize: 11, marginBottom: 6, color: subColor || '#6b7280' }}>{sub}</div>}
      {children}
    </div>
  )
}

function RazonFinanciera({ nivel, valor, nombre, porque, accion }: {
  nivel: Nivel; valor: string; nombre: string; porque: string; accion?: string
}) {
  return (
    <div style={{ padding: '11px 12px', background: '#f8fafc', minWidth: 0 }}>
      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, marginBottom: 6, background: BADGE[nivel].bg, color: BADGE[nivel].fg }}>
        {nivel === 'neutro' ? 'Sin datos' : 'Razón financiera'}
      </span>
      <div style={{ fontSize: 20, fontWeight: 500, color: nivel === 'neutro' ? '#9aa1ab' : '#0a0a0a', marginBottom: 2 }}>{valor}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>{nombre}</div>
      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5, marginBottom: 6, borderLeft: '2px solid #cbd5e1', paddingLeft: 6 }}>{porque}</div>
      {accion && (
        <div style={{ fontSize: 10, color: '#1677ff', lineHeight: 1.5, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <ArrowRightOutlined style={{ fontSize: 11, flexShrink: 0, marginTop: 2 }} />
          <span>{accion}</span>
        </div>
      )}
    </div>
  )
}

function FilaOKR({ bg, icono, titulo, meta, children }: {
  bg: string; icono: string; titulo: string; meta: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, background: bg }}>
        <div style={{ fontSize: 20 }}>{icono}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.3 }}>{titulo}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{meta}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderLeft: '0.5px solid #e5e7eb' }}>
        {children}
      </div>
    </div>
  )
}

// ── Helpers de datos ──────────────────────────────────────────────────────────
const AGING_DEFS: Array<{ key: keyof Pick<ExecutiveAgingRow, 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'over_90'>; label: string; color: string }> = [
  { key: 'current',    label: 'Al día', color: '#1baf7a' },
  { key: 'days_1_30',  label: '1-30',   color: '#fab219' },
  { key: 'days_31_60', label: '31-60',  color: '#eb6834' },
  { key: 'days_61_90', label: '61-90',  color: '#e34948' },
  { key: 'over_90',    label: '+90',    color: '#a32d2d' },
]

function agingSegmentos(section: ExecutiveAgingSection): Segmento[] {
  return AGING_DEFS.map(d => ({ valor: Number(section.buckets?.[d.key] ?? 0), color: d.color, label: d.label }))
}
function valorRatio(items: RatioItem[] | undefined, needle: string): number | null {
  const it = (items ?? []).find(r => r.nombre.toLowerCase().includes(needle))
  return it && it.valor != null ? Number(it.valor) : null
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TableroDueno() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [periodo, setPeriodo] = useState<Periodo>(trimestreActual())
  const [anio, setAnio]       = useState<number>(dayjs().year())
  const [data, setData]       = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const { from, to, etiqueta } = useMemo(() => rangoDePeriodo(periodo, anio), [periodo, anio])
  // Corte = fin del período, pero nunca en el futuro (para el trimestre en curso usa hoy).
  const corte = useMemo(() => {
    const hoy = dayjs().format('YYYY-MM-DD')
    return to > hoy ? hoy : to
  }, [to])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getExecutiveDashboard({ fromDate: from, toDate: corte, asOf: corte }))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, corte])

  useEffect(() => { cargar() }, [cargar])

  const nombreEmpresa = activeCompany?.tradeName || activeCompany?.legalName || data?.company?.company_name || 'Empresa'
  const cur = data?.currency || 'GTQ'

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spin size="large" /></div>
  }
  if (!data) return <Empty description="Sin datos para el período seleccionado" style={{ padding: 48 }} />

  const s   = data.summary
  const cxc = data.receivables
  const cxp = data.payables
  const flujo = data.cashFlow

  // Valores derivados
  const arVencPct = Number(s.arOverduePct) || 0
  const apVencPct = Number(s.apOverduePct) || 0
  const critCxc   = Number(cxc.critical) || 0
  const critCxp   = Number(cxp.critical) || 0
  const topCxc    = cxc.topCritical ?? []
  const topCxp    = cxp.topCritical ?? []
  const apalanca  = s.commercialLeverage != null ? Number(s.commercialLeverage) : (Number(s.arTotal) > 0 ? Number(s.apTotal) / Number(s.arTotal) : 0)
  const liquidezRaw = valorRatio(data.ratios?.liquidez, 'corriente')
  const roaRaw      = valorRatio(data.ratios?.rentabilidad, 'roa') ?? valorRatio(data.ratios?.rentabilidad, 'activo')
  const liquidez  = liquidezRaw ?? 0
  const roa       = roaRaw ?? 0
  const margenBruto = Number(s.grossMargin) || 0
  const margenOper  = Number(s.operatingMargin) || 0
  const cajaRecomendada = Number(s.apTotal) || 0 // heurística: caja suficiente para cubrir lo que se debe
  const cajaPct = cajaRecomendada > 0 ? (Number(s.cashEnd) / cajaRecomendada) * 100 : 100

  // ¿Hay datos reales por dimensión? (para no mostrar indicadores/textos engañosos con período vacío)
  const flujoConMovs = !!flujo && (flujo.operating.total !== 0 || flujo.investing.total !== 0 || flujo.financing.total !== 0)
  const hayCxc      = Number(s.arTotal) > 0
  const hayCxp      = Number(s.apTotal) > 0
  const hayApalanca = Number(s.arTotal) > 0 || Number(s.apTotal) > 0
  const hayVentas   = Number(s.salesTotal) > 0
  const hayCaja     = liquidezRaw != null || Number(s.cashEnd) !== 0 || flujoConMovs
  const periodoVacio = !hayCxc && !hayCxp && !hayVentas && !hayCaja

  // Semáforo de nivel por fila — 'neutro' (gris) cuando no hay datos que evaluar
  const nCxc: Nivel = hayCxc ? nivelMorosidad(arVencPct) : 'neutro'
  const nCxp: Nivel = hayCxp ? nivelMorosidad(apVencPct) : 'neutro'
  const nApalanca: Nivel = hayApalanca ? nivelApalanca(apalanca) : 'neutro'
  const nLiq: Nivel = (hayCaja && liquidezRaw != null) ? nivelLiquidez(liquidez) : 'neutro'
  const nMargen: Nivel = hayVentas ? nivelMargen(margenOper) : 'neutro'
  const nBruto: Nivel = hayVentas ? nivelMargen(margenBruto) : 'neutro'
  const nRoa: Nivel = (hayVentas && roaRaw != null) ? nivelRoa(roa) : 'neutro'

  const cajaLiberable = Math.max(0, Number(cxc.overdue) - Number(s.arTotal) * 0.3)

  const listaClientes = (top: ExecutiveAgingRow[], kind: 'ar' | 'ap') => (
    <div>
      {top.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 10, color: '#6b7280', padding: '2px 0', borderBottom: i === 0 ? '0.5px solid #e5e7eb' : 'none', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreEntidad(r, kind)}</span>
          <span style={{ color: '#d03b3b', fontWeight: 500, flexShrink: 0 }}>{moneyC(Number(r.over_90 || r.total), cur)}</span>
        </div>
      ))}
      {top.length === 0 && <div style={{ fontSize: 10, color: '#9aa1ab' }}>Sin casos críticos</div>}
    </div>
  )

  return (
    <div>
      {/* Encabezado + selector de período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 500, color: '#0a0a0a' }}>Tablero del dueño</Text>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {PERIODOS.map(p => {
            const on = p === periodo
            return (
              <button key={p} onClick={() => setPeriodo(p)}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                  border: `0.5px solid ${on ? '#1677ff' : '#d0d5dd'}`,
                  background: on ? '#e6f0ff' : 'transparent',
                  color: on ? '#1677ff' : '#6b7280',
                }}>
                {p}
              </button>
            )
          })}
          <Select
            size="small"
            value={anio}
            onChange={setAnio}
            style={{ width: 88 }}
            options={Array.from({ length: 5 }, (_, i) => {
              const y = dayjs().year() - i
              return { value: y, label: String(y) }
            })}
          />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9aa1ab', marginBottom: 16 }}>
        {nombreEmpresa} &nbsp;·&nbsp; {etiqueta} &nbsp;·&nbsp; Datos al corte {dayjs(corte).format('DD/MM/YYYY')}
      </div>

      {/* FILA 1 — Cobrar lo que le deben */}
      <FilaOKR bg="#042C53" icono="💰" titulo="Cobrar lo que le deben" meta="Meta: CxC vencida < 30%">
        <Metrica label="Total por cobrar" valor={moneyC(Number(s.arTotal), cur)} sub={`${pct1(arVencPct)} vencida`} subColor={COLOR_TXT[nCxc]}>
          <Barra pct={arVencPct} color={COLOR_BAR[nCxc]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>Actual {pct1(arVencPct)} · Meta &lt;30%</div>
        </Metrica>
        <Metrica label="Críticos +90 días" valor={moneyC(critCxc, cur)} sub={`${topCxc.length} cliente(s) urgente(s)`} subColor="#d03b3b">
          {listaClientes(topCxc, 'ar')}
        </Metrica>
        <Metrica label="Antigüedad de la deuda" valor="Aging CxC" sub="Distribución por tramos">
          <BarraSegmentada segmentos={agingSegmentos(cxc)} />
        </Metrica>
        <RazonFinanciera
          nivel={nCxc}
          valor={hayCxc ? pct1(arVencPct) : '—'}
          nombre="Índice de morosidad CxC"
          porque={hayCxc
            ? `Su empresa tiene ${moneyFull(Number(s.arTotal), cur)} pendiente de cobrar y el ${pct1(arVencPct)} ya está vencido. Eso significa que parte de ese dinero no está entrando a tiempo y reduce su efectivo disponible.`
            : 'No hay cuentas por cobrar registradas en este período, así que no hay morosidad que analizar.'}
          accion={hayCxc
            ? `Contacte esta semana a sus clientes con mayor saldo vencido y acuerde una fecha de pago. Bajar la morosidad al 30% liberaría cerca de ${moneyFull(cajaLiberable, cur)} en caja.`
            : undefined}
        />
      </FilaOKR>

      {/* FILA 2 — Controlar lo que debe */}
      <FilaOKR bg="#26215C" icono="⚖️" titulo="Controlar lo que debe" meta="Meta: CxP vencida < 30%">
        <Metrica label="Total por pagar" valor={moneyC(Number(s.apTotal), cur)} sub={`${pct1(apVencPct)} vencida`} subColor={COLOR_TXT[nCxp]}>
          <Barra pct={apVencPct} color={COLOR_BAR[nCxp]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>Actual {pct1(apVencPct)} · Meta &lt;30%</div>
        </Metrica>
        <Metrica label="Proveedores críticos" valor={moneyC(critCxp, cur)} sub="+90 días sin pagar" subColor="#d03b3b">
          {listaClientes(topCxp, 'ap')}
        </Metrica>
        <Metrica label="CxP vs CxC" valor={hayApalanca ? `${apalanca.toFixed(2)}x` : '—'} sub={hayApalanca ? (apalanca > 1 ? 'Debe más de lo que le deben' : 'Le deben más de lo que debe') : 'Sin movimientos'} subColor={COLOR_TXT[nApalanca]}>
          <BarraSegmentada alto={16} segmentos={[
            { valor: Number(s.arTotal), color: '#2a78d6', label: `CxC ${moneyC(Number(s.arTotal), cur)}` },
            { valor: Number(s.apTotal), color: '#e34948', label: `CxP ${moneyC(Number(s.apTotal), cur)}` },
          ]} />
        </Metrica>
        <RazonFinanciera
          nivel={nApalanca}
          valor={hayApalanca ? `${apalanca.toFixed(2)}x` : '—'}
          nombre="Apalancamiento comercial CxP/CxC"
          porque={hayApalanca
            ? `Por cada Q1.00 que le deben a usted, usted debe Q${apalanca.toFixed(2)} a sus proveedores. ${apalanca > 1 ? 'Debe más de lo que le deben, lo que presiona su caja si los clientes se atrasan.' : 'Le deben más de lo que debe, una posición cómoda.'}`
            : 'No hay cuentas por pagar ni por cobrar en este período para calcular el apalancamiento.'}
          accion={hayApalanca
            ? (apalanca > 1 ? 'Priorice cobrar antes de pagar. Use lo que recupere para saldar primero a sus proveedores más grandes y evitar cortes de suministro.' : 'Mantenga el ritmo de cobro; su posición comercial es sana.')
            : undefined}
        />
      </FilaOKR>

      {/* FILA 3 — Mantener caja saludable */}
      <FilaOKR bg="#173404" icono="🏦" titulo="Mantener caja saludable" meta="Meta: liquidez ≥ 1.5x">
        <Metrica label="Caja disponible hoy" valor={moneyC(Number(s.cashEnd), cur)} sub={Number(s.cashNetChange) === 0 ? 'Sin cambio en el período' : `${Number(s.cashNetChange) > 0 ? 'Creció' : 'Bajó'} ${moneyC(Math.abs(Number(s.cashNetChange)), cur)} en el período`} subColor={Number(s.cashNetChange) === 0 ? '#9aa1ab' : Number(s.cashNetChange) > 0 ? '#0ca30c' : '#d03b3b'}>
          <Barra pct={cajaRecomendada > 0 ? cajaPct : 0} color={cajaRecomendada > 0 ? COLOR_BAR[cajaPct >= 100 ? 'saludable' : cajaPct >= 50 ? 'atencion' : 'critico'] : COLOR_BAR.neutro} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>{cajaRecomendada > 0 ? `${Math.round(cajaPct)}% de lo que debe a proveedores` : 'Sin cuentas por pagar de referencia'}</div>
        </Metrica>
        <Metrica label="De dónde vino el efectivo" valor="Flujo de caja" sub={flujoConMovs ? (flujo!.operating.total >= 0 ? 'Operación positiva' : 'Operación negativa') : 'Sin movimientos'} subColor={flujoConMovs ? (flujo!.operating.total >= 0 ? '#0ca30c' : '#d03b3b') : '#9aa1ab'}>
          {flujoConMovs ? (
            <BarraSegmentada alto={16} segmentos={[
              { valor: flujo!.operating.total,  color: '#1baf7a', label: `Operación ${moneyC(flujo!.operating.total, cur)}` },
              { valor: flujo!.financing.total,  color: '#2a78d6', label: `Financiación ${moneyC(flujo!.financing.total, cur)}` },
              { valor: flujo!.investing.total,  color: '#e34948', label: `Inversión ${moneyC(flujo!.investing.total, cur)}` },
            ]} />
          ) : <div style={{ fontSize: 10, color: '#9aa1ab' }}>Sin movimientos de efectivo en el período</div>}
        </Metrica>
        <Metrica label="Margen operativo" valor={hayVentas ? pct1(margenOper) : '—'} sub={hayVentas ? (margenOper < 0 ? 'Gasta más de lo que gana' : 'Gana después de gastos') : 'Sin ventas'} subColor={COLOR_TXT[nMargen]}>
          <Barra pct={!hayVentas ? 0 : margenOper < 0 ? 100 : Math.min(100, margenOper * 4)} color={COLOR_BAR[nMargen]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>{hayVentas ? `Margen bruto: ${pct1(margenBruto)}` : 'Sin ventas en el período'}</div>
        </Metrica>
        <RazonFinanciera
          nivel={nLiq}
          valor={nLiq !== 'neutro' ? `${liquidez.toFixed(2)}x` : '—'}
          nombre="Razón de liquidez corriente"
          porque={nLiq !== 'neutro'
            ? `Por cada Q1.00 que debe pagar a corto plazo tiene Q${liquidez.toFixed(2)} disponibles. ${liquidez >= 1.5 ? 'Está en un nivel cómodo.' : liquidez >= 1 ? 'Está por encima de 1 (puede pagar), pero por debajo del ideal de 1.5.' : 'Está por debajo de 1: hoy no alcanza para cubrir lo que debe a corto plazo.'}`
            : 'No hay datos de caja ni de balance en este período para calcular la liquidez.'}
          accion={nLiq === 'neutro' ? undefined : liquidez < 1.5 ? 'Cobrar a los clientes vencidos es la forma más rápida de subir su liquidez sin endeudarse.' : 'Mantenga el nivel de caja y evite comprometer efectivo en gastos no esenciales.'}
        />
      </FilaOKR>

      {/* FILA 4 — Mejorar la rentabilidad */}
      <FilaOKR bg="#4A1B0C" icono="📈" titulo="Mejorar la rentabilidad" meta="Meta: margen neto > 0%">
        <Metrica label="Margen bruto" valor={hayVentas ? pct1(margenBruto) : '—'} sub={hayVentas ? `Por cada Q100 vendido, quedan Q${Math.round(margenBruto)}` : 'Sin ventas en el período'} subColor={COLOR_TXT[nBruto]}>
          <Barra pct={hayVentas ? Math.min(100, Math.max(0, margenBruto * 2)) : 0} color={COLOR_BAR[nBruto]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>Meta &gt;35%</div>
        </Metrica>
        <Metrica label="Margen operativo" valor={hayVentas ? pct1(margenOper) : '—'} sub={hayVentas ? (margenOper < 0 ? 'Los gastos consumen el margen' : 'Positivo tras gastos') : 'Sin ventas'} subColor={COLOR_TXT[nMargen]}>
          <Barra pct={!hayVentas ? 0 : margenOper < 0 ? 100 : Math.min(100, margenOper * 4)} color={COLOR_BAR[nMargen]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>Meta: positivo</div>
        </Metrica>
        <Metrica label="Retorno sobre activos (ROA)" valor={nRoa !== 'neutro' ? pct1(roa) : '—'} sub={nRoa === 'neutro' ? 'Sin datos' : roa < 0 ? 'Los activos no generan ganancia' : 'Los activos generan retorno'} subColor={COLOR_TXT[nRoa]}>
          <Barra pct={nRoa === 'neutro' ? 0 : roa < 0 ? 100 : Math.min(100, roa * 5)} color={COLOR_BAR[nRoa]} />
          <div style={{ fontSize: 9, color: '#9aa1ab' }}>Meta: ≥5%</div>
        </Metrica>
        <RazonFinanciera
          nivel={nMargen}
          valor={hayVentas ? pct1(margenOper) : '—'}
          nombre="Margen operativo neto"
          porque={hayVentas
            ? `Su empresa ${margenBruto > 0 ? `vende con un margen bruto de ${pct1(margenBruto)} (${margenBruto >= 35 ? 'sano' : 'ajustado'})` : 'tiene margen bruto negativo'}, pero ${margenOper < 0 ? 'los gastos operativos consumen toda la ganancia y generan pérdida' : 'aún queda utilidad después de gastos'}. ${margenOper < 0 ? 'El problema es control de costos, no de ventas.' : ''}`
            : 'No hubo ventas registradas en este período, así que no hay rentabilidad que evaluar.'}
          accion={hayVentas
            ? (margenOper < 0 ? 'Identifique sus 3 gastos operativos más grandes y evalúe reducirlos para llevar el margen a positivo.' : 'Mantenga el control de gastos para proteger la utilidad.')
            : undefined}
        />
      </FilaOKR>

      {/* Diagnóstico de Lucía */}
      {/* TODO(backend): reemplazar por POST /reportes/informe-dueno/narrativa { periodo, anio }.
          Mientras el endpoint no exista, se muestra un diagnóstico preliminar basado en reglas. */}
      <div style={{ background: '#e6f0ff', border: '0.5px solid #b3d1ff', borderRadius: 12, padding: '12px 14px', marginTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 15, flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12, color: '#0a0a0a', lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: '#1677ff' }}>Diagnóstico de Lucía (preliminar) — </strong>
          {diagnosticoPreliminar({ periodoVacio, hayCxc, hayVentas, nCxc, nMargen, arVencPct, apalanca, hayApalanca, margenBruto, margenOper, cur, critCxc })}
        </p>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={cargar}
          style={{ flex: 1, padding: 9, borderRadius: 6, border: '0.5px solid #b3d1ff', background: '#e6f0ff', color: '#1677ff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ReloadOutlined style={{ fontSize: 13 }} /> Actualizar análisis
        </button>
        <Tooltip title="Próximamente">
          <button disabled
            style={{ flex: 1, padding: 9, borderRadius: 6, border: '0.5px solid #d0d5dd', background: 'transparent', color: '#b0b5bd', fontSize: 12, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <DownloadOutlined style={{ fontSize: 13 }} /> Descargar PDF
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

// Diagnóstico preliminar por reglas (placeholder hasta que exista el endpoint de narrativa).
// Construye el texto solo con las dimensiones que tienen datos — nada de frases pegadas
// cuando el período está vacío.
function diagnosticoPreliminar(p: {
  periodoVacio: boolean; hayCxc: boolean; hayVentas: boolean; hayApalanca: boolean
  nCxc: Nivel; nMargen: Nivel
  arVencPct: number; apalanca: number; margenBruto: number; margenOper: number
  cur: string; critCxc: number
}): string {
  if (p.periodoVacio) {
    return 'En este período no hay movimientos registrados para analizar. Seleccione un trimestre con actividad (ventas, cobros, pagos o movimientos de banco) para ver el diagnóstico.'
  }
  const partes: string[] = []
  if (p.hayCxc) {
    if (p.nCxc === 'critico') partes.push(`el mayor riesgo está en la cobranza: el ${pct1(p.arVencPct)} de lo que le deben ya está vencido${p.critCxc > 0 ? ` y hay ${moneyFull(p.critCxc, p.cur)} en casos críticos` : ''}`)
    else if (p.nCxc === 'atencion') partes.push('la cobranza necesita atención: parte de lo que le deben empieza a vencerse')
    else partes.push('la cobranza está bajo control')
  }
  if (p.hayApalanca && p.apalanca > 1) partes.push(`debe más de lo que le deben (${p.apalanca.toFixed(2)}x), así que cobrar rápido es clave para pagar sin financiamiento`)
  if (p.hayVentas) {
    if (p.nMargen === 'critico') partes.push(`el margen bruto de ${pct1(p.margenBruto)} es ${p.margenBruto >= 35 ? 'sano' : 'ajustado'}, pero los gastos operativos lo consumen y generan pérdida: el problema es control de costos, no ventas`)
    else if (p.nMargen === 'saludable') partes.push('la rentabilidad operativa es positiva')
    else partes.push('la rentabilidad operativa está en el límite: los gastos casi consumen el margen')
  }
  if (partes.length === 0) return 'Hay actividad en el período, pero aún no es suficiente para un diagnóstico completo de cobranza y rentabilidad.'
  const foco = (p.hayCxc && p.nCxc === 'critico')
    ? 'Prioridad de la semana: llamar a los clientes vencidos más grandes y acordar fechas de pago concretas.'
    : (p.hayVentas && p.nMargen === 'critico')
      ? 'Prioridad de la semana: revisar los 3 gastos operativos más grandes.'
      : 'Mantenga el ritmo actual y vigile los indicadores en amarillo.'
  return `En resumen, ${partes.join('; ')}. ${foco}`
}
