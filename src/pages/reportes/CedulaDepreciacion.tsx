import { useMemo, useState } from 'react'
import { Empty, Spin, Typography, Tooltip } from 'antd'
import dayjs from 'dayjs'
import type { ActivoFijo, HistorialDepreciacion } from '../../api/activos-fijos'

const { Text } = Typography

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const Q = (n: number) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const Q0 = (n: number) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

type CellType = 'none' | 'real' | 'proj'
interface Cell { v: number; type: CellType; start?: boolean; today?: boolean }

interface AssetCedula {
  id:            string
  assetNumber:   string
  name:          string
  inicioLabel:   string | null      // "MM/AAAA" del primer período depreciado
  cells:         Map<number, Cell[]> // año -> 12 celdas
  yearTotals:    Map<number, number>
  depAcum:       number
  valorLibros:   number
}

const COLORS = {
  navy:   '#1B3A6B',
  green:  '#2ea172',
  purple: '#8b5cf6',
  teal:   '#1faec2',
}

/**
 * Cédula de depreciación por período fiscal.
 * - Reales: tomados del historial (`historial_depreciacion_activos`).
 * - Proyección: recalculada en cliente desde la cuota mensual hasta que el
 *   valor en libros alcanza el valor de rescate (solo presentación).
 * - Acordeón: un año expandido a la vez → 12 meses.
 */
export default function CedulaDepreciacion({
  activos, historial, loading,
}: {
  activos: ActivoFijo[]
  historial: HistorialDepreciacion[]
  loading: boolean
}) {
  const hoyPeriodo = dayjs().format('YYYY-MM')
  const anioActual = dayjs().year()

  // ── Historial agrupado por activo ──────────────────────────────────────────
  const histByAsset = useMemo(() => {
    const m = new Map<string, HistorialDepreciacion[]>()
    for (const h of historial) {
      if (!m.has(h.activoFijoId)) m.set(h.activoFijoId, [])
      m.get(h.activoFijoId)!.push(h)
    }
    return m
  }, [historial])

  // ── Cédula por activo (reales + proyección) ────────────────────────────────
  const { filas, anios } = useMemo(() => {
    const aniosSet = new Set<number>()
    const filas: AssetCedula[] = []

    const activosOrden = [...activos]
      .filter(a => a.estado !== 'DADO_DE_BAJA' && a.estado !== 'VENDIDO')
      .sort((a, b) => a.assetNumber.localeCompare(b.assetNumber))

    for (const a of activosOrden) {
      const cells = new Map<number, Cell[]>()
      const ensure = (y: number) => {
        if (!cells.has(y)) cells.set(y, Array.from({ length: 12 }, () => ({ v: 0, type: 'none' as CellType })))
        aniosSet.add(y)
        return cells.get(y)!
      }

      // Reales
      const hist = (histByAsset.get(a.id) ?? []).slice().sort((x, y) => x.periodo.localeCompare(y.periodo))
      let minPeriodo: string | null = null
      let maxPeriodo: string | null = null
      for (const h of hist) {
        const [ys, ms] = h.periodo.split('-')
        const y = Number(ys); const mi = Number(ms) - 1
        if (mi < 0 || mi > 11) continue
        ensure(y)[mi] = { v: Number(h.cuota), type: 'real' }
        if (!minPeriodo) minPeriodo = h.periodo
        maxPeriodo = h.periodo
      }

      // Marcar inicio (primer período depreciado)
      if (minPeriodo) {
        const [ys, ms] = minPeriodo.split('-')
        ensure(Number(ys))[Number(ms) - 1].start = true
      }

      // Proyección: desde el mes siguiente al último real (o desde hoy si no hay)
      const monthly = Number(a.depreciacionMensual ?? 0)
      let remaining = Number(a.currentBookValue) - Number(a.salvageValue)
      if (monthly > 0.005 && remaining > 0.005) {
        let cursor = maxPeriodo ? dayjs(maxPeriodo + '-01').add(1, 'month') : dayjs(hoyPeriodo + '-01')
        for (let i = 0; i < 720 && remaining > 0.005; i++) {
          const cuota = Math.min(monthly, remaining)
          const y = cursor.year(); const mi = cursor.month()
          ensure(y)[mi] = { v: cuota, type: 'proj' }
          remaining -= cuota
          cursor = cursor.add(1, 'month')
        }
      }

      // Marcar HOY
      const [hy, hm] = hoyPeriodo.split('-')
      const cy = cells.get(Number(hy))
      if (cy && cy[Number(hm) - 1].type !== 'none') cy[Number(hm) - 1].today = true

      // Totales por año
      const yearTotals = new Map<number, number>()
      for (const [y, arr] of cells) yearTotals.set(y, arr.reduce((s, c) => s + c.v, 0))

      filas.push({
        id: a.id,
        assetNumber: a.assetNumber,
        name: a.name,
        inicioLabel: minPeriodo ? dayjs(minPeriodo + '-01').format('MM/YYYY') : null,
        cells,
        yearTotals,
        depAcum: Number(a.accumulatedDepreciation),
        valorLibros: Number(a.currentBookValue),
      })
    }

    const anios = [...aniosSet].sort((x, y) => x - y)
    return { filas, anios }
  }, [activos, histByAsset, hoyPeriodo])

  // ── Acordeón: un año expandido a la vez ────────────────────────────────────
  const [expandedYear, setExpandedYear] = useState<number | null>(
    anios.includes(anioActual) ? anioActual : (anios.length ? anios[anios.length - 1] : null),
  )
  const toggleYear = (y: number) => setExpandedYear(prev => (prev === y ? null : y))

  // ── Totales generales por año ──────────────────────────────────────────────
  const totalesAnio = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of filas) for (const [y, t] of f.yearTotals) m.set(y, (m.get(y) ?? 0) + t)
    return m
  }, [filas])
  const totalDepAcum = useMemo(() => filas.reduce((s, f) => s + f.depAcum, 0), [filas])
  const totalValLib  = useMemo(() => filas.reduce((s, f) => s + f.valorLibros, 0), [filas])

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  if (!filas.length || !anios.length) {
    return <Empty description="No hay historial de depreciación para mostrar la cédula" style={{ padding: 48 }} />
  }

  const zonaAnio = (y: number): CellType | 'actual' =>
    y < anioActual ? 'real' : y === anioActual ? 'actual' : 'proj'

  // ── Estilos de celda ───────────────────────────────────────────────────────
  const cellStyle = (c: Cell): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
      fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0',
    }
    if (c.type === 'none') return { ...base, color: '#d0d5dd' }
    if (c.type === 'proj') return { ...base, color: COLORS.purple, fontStyle: 'italic', background: 'rgba(139,92,246,0.05)' }
    // real
    const s: React.CSSProperties = { ...base, color: COLORS.navy }
    if (c.start) { s.background = 'rgba(46,161,114,0.14)'; s.color = COLORS.green; s.fontWeight = 700 }
    if (c.today) { s.outline = `2px solid ${COLORS.navy}`; s.outlineOffset = '-2px'; s.fontWeight = 700 }
    return s
  }

  const yearHeaderStyle = (y: number): React.CSSProperties => {
    const z = zonaAnio(y)
    const bg = z === 'actual' ? 'rgba(31,174,194,0.12)' : z === 'proj' ? 'rgba(139,92,246,0.08)' : '#f5f7fa'
    const col = z === 'actual' ? COLORS.teal : z === 'proj' ? COLORS.purple : COLORS.navy
    return {
      padding: '6px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700,
      color: col, background: bg, cursor: 'pointer', userSelect: 'none',
      borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
    }
  }

  const stickyLeft: React.CSSProperties = {
    position: 'sticky', left: 0, zIndex: 2, background: '#fff',
    borderRight: '2px solid #e5e7eb', minWidth: 240, maxWidth: 240,
  }

  return (
    <div>
      {/* Leyenda de zonas */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(46,161,114,0.5)', border: `1px solid ${COLORS.green}` }} />
          <Text type="secondary">Inicio de depreciación</Text>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(31,174,194,0.25)', border: `1px solid ${COLORS.teal}` }} />
          <Text type="secondary">Período actual ({anioActual})</Text>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(139,92,246,0.2)', border: `1px solid ${COLORS.purple}` }} />
          <Text type="secondary">Proyección</Text>
        </span>
        <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 11 }}>
          Clic en un año para desplegar sus 12 meses
        </Text>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            {/* Fila años */}
            <tr>
              <th rowSpan={2} style={{ ...stickyLeft, textAlign: 'left', padding: '6px 10px', background: '#f5f7fa', fontSize: 12, color: COLORS.navy }}>
                Activo
              </th>
              {anios.map(y => (
                <th key={y} colSpan={expandedYear === y ? 12 : 1} style={yearHeaderStyle(y)} onClick={() => toggleYear(y)}>
                  {expandedYear === y ? '－' : '＋'} {y}
                </th>
              ))}
              <th rowSpan={2} style={{ padding: '6px 10px', textAlign: 'right', background: '#f5f7fa', color: '#ff7f00', fontSize: 12, minWidth: 110 }}>
                Dep. acum.
              </th>
              <th rowSpan={2} style={{ padding: '6px 10px', textAlign: 'right', background: '#f5f7fa', color: COLORS.green, fontSize: 12, minWidth: 110 }}>
                Valor libros
              </th>
            </tr>
            {/* Fila meses / total */}
            <tr>
              {anios.map(y =>
                expandedYear === y
                  ? MESES.map(m => (
                      <th key={y + m} style={{ padding: '3px 6px', textAlign: 'right', fontSize: 10, color: '#6b7280', background: '#fafbfc', borderBottom: '1px solid #e5e7eb', minWidth: 58 }}>
                        {m}
                      </th>
                    ))
                  : (
                      <th key={y + '-t'} style={{ padding: '3px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1ab', background: '#fafbfc', borderBottom: '1px solid #e5e7eb', minWidth: 88 }}>
                        Total
                      </th>
                    ),
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td style={{ ...stickyLeft, padding: '5px 10px' }}>
                  <div style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#9aa1ab', fontVariantNumeric: 'tabular-nums' }}>
                    {f.assetNumber}
                    {f.inicioLabel && (
                      <span style={{ marginLeft: 6, color: COLORS.green }}>· inició {f.inicioLabel}</span>
                    )}
                  </div>
                </td>
                {anios.map(y => {
                  const arr = f.cells.get(y)
                  if (expandedYear === y) {
                    return MESES.map((_, mi) => {
                      const c = arr?.[mi] ?? { v: 0, type: 'none' as CellType }
                      return (
                        <td key={f.id + y + mi} style={cellStyle(c)}>
                          {c.type === 'none' ? '' : (
                            <Tooltip title={c.today ? 'Mes actual (HOY)' : c.start ? 'Inicio de depreciación' : c.type === 'proj' ? 'Proyectado' : 'Depreciado'}>
                              <span>{c.today ? '• ' : ''}{Q0(c.v)}</span>
                            </Tooltip>
                          )}
                        </td>
                      )
                    })
                  }
                  const total = f.yearTotals.get(y) ?? 0
                  const z = zonaAnio(y)
                  return (
                    <td key={f.id + y} style={{
                      padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0',
                      color: total === 0 ? '#d0d5dd' : z === 'proj' ? COLORS.purple : z === 'actual' ? COLORS.teal : COLORS.navy,
                      fontStyle: z === 'proj' ? 'italic' : 'normal',
                      background: z === 'actual' ? 'rgba(31,174,194,0.05)' : undefined,
                    }}>
                      {total === 0 ? '—' : Q(total)}
                    </td>
                  )
                })}
                <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#ff7f00', borderBottom: '1px solid #f0f0f0' }}>
                  {Q(f.depAcum)}
                </td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: COLORS.green, fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>
                  {Q(f.valorLibros)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#fafbfc' }}>
              <td style={{ ...stickyLeft, background: '#fafbfc', padding: '7px 10px', fontWeight: 700, fontSize: 12, color: COLORS.navy }}>
                TOTAL — {filas.length} activos
              </td>
              {anios.map(y => {
                const z = zonaAnio(y)
                const col = z === 'proj' ? COLORS.purple : z === 'actual' ? COLORS.teal : COLORS.navy
                if (expandedYear === y) {
                  return MESES.map((_, mi) => {
                    const sum = filas.reduce((s, f) => s + (f.cells.get(y)?.[mi]?.v ?? 0), 0)
                    return (
                      <td key={'tot' + y + mi} style={{ padding: '7px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, fontWeight: 700, color: sum === 0 ? '#d0d5dd' : col }}>
                        {sum === 0 ? '' : Q0(sum)}
                      </td>
                    )
                  })
                }
                const t = totalesAnio.get(y) ?? 0
                return (
                  <td key={'tot' + y} style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 700, color: t === 0 ? '#d0d5dd' : col }}>
                    {t === 0 ? '—' : Q(t)}
                  </td>
                )
              })}
              <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: '#ff7f00' }}>
                {Q(totalDepAcum)}
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: COLORS.green }}>
                {Q(totalValLib)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
        Los valores en <span style={{ color: COLORS.navy }}>azul</span> son depreciación registrada;
        los valores en <span style={{ color: COLORS.purple, fontStyle: 'italic' }}>morado</span> son proyección
        (cuota mensual hasta agotar el valor depreciable). La proyección no genera asientos contables.
      </Text>
    </div>
  )
}
