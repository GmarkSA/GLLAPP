import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import {
  getCierreIntegraciones, getDetalleIntegracion,
} from '../../api/integraciones'
import type {
  DetalleResult, IntegrationType,
  BancoEspecifico, CxcEspecifico, CxpEspecifico,
  InventarioEspecifico, ActivoFijoEspecifico,
} from '../../api/integraciones'

const Q = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const TYPE_LABEL: Record<IntegrationType, string> = {
  banco:       'Banco',
  cxc:         'Cuentas por Cobrar',
  cxp:         'Cuentas por Pagar',
  inventario:  'Inventarios',
  activo_fijo: 'Activos Fijos',
  resultado:   'Resultados',
  generico:    'General',
}

// Only banco is landscape; cxc/cxp use portrait (carta) with pagination
const LANDSCAPE_TYPES: IntegrationType[] = ['banco']
const LINES_PER_PAGE = 20

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  body { background: #fff; color: #0a0a0a; font-size: 11px; }

  .sheet {
    padding: 28px 32px 40px;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: avoid; break-after: avoid; }

  .sheet-header { margin-bottom: 14px; }
  .sheet-header h2 { font-size: 14px; font-weight: 700; color: #1B3A6B; margin-bottom: 2px; }
  .sheet-header .sub { font-size: 11px; color: #6b7280; }

  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: #9aa1ab;
    border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 12px 0 6px;
  }

  .kv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
  .kv { }
  .kv .label { font-size: 9px; color: #9aa1ab; text-transform: uppercase; letter-spacing: 0.04em; }
  .kv .value { font-size: 12px; font-weight: 700; color: #1B3A6B; margin-top: 1px; }

  .hist-row { display: flex; gap: 4px; overflow: hidden; margin-bottom: 10px; }
  .hist-cell { min-width: 52px; padding: 4px 6px; border: 1px solid #e2e8f0;
               border-radius: 4px; text-align: center; }
  .hist-cell .m { font-size: 8px; color: #9aa1ab; font-weight: 700; }
  .hist-cell .v { font-size: 9px; font-weight: 700; color: #1B3A6B; }

  table { width: 100%; border-collapse: collapse; }
  th { background: #1B3A6B; color: #fff; font-size: 9px; font-weight: 700;
       text-align: left; padding: 4px 6px; }
  td { font-size: 10px; padding: 3px 6px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #f8fafc; }
  .right { text-align: right; }
  .total-row td { font-weight: 700; background: #eff6ff; border-top: 1px solid #1B3A6B; }

  .recon-box {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;
    padding: 8px 12px; margin-bottom: 8px;
  }
  .recon-box .rb-title { font-size: 10px; font-weight: 700; color: #1B3A6B; margin-bottom: 6px; }
  .recon-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

  .signature-block {
    margin-top: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
  }
  .sig-line {
    border-top: 1px solid #0a0a0a;
    padding-top: 4px;
    font-size: 9px;
    color: #6b7280;
    text-align: center;
  }

  @media print {
    @page { margin: 12mm; }
    .no-print { display: none !important; }
    .sheet { padding: 0; }
  }
`

// ─── Componentes de impresión ─────────────────────────────────────────────────

function LineasTable({ lineas }: { lineas: DetalleResult['lineas'] }) {
  if (!lineas.length) return <p style={{ fontSize: 10, color: '#9aa1ab' }}>Sin movimientos en el mes.</p>
  const totDebe  = lineas.reduce((s, l) => s + l.debe,  0)
  const totHaber = lineas.reduce((s, l) => s + l.haber, 0)
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 75 }}>Fecha</th>
          <th style={{ width: 100 }}>Póliza</th>
          <th>Glosa / Descripción</th>
          <th className="right" style={{ width: 100 }}>Debe</th>
          <th className="right" style={{ width: 100 }}>Haber</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((l, i) => (
          <tr key={i}>
            <td>{dayjs(l.fecha).format('DD/MM/YYYY')}</td>
            <td>{l.codigoPoliza}</td>
            <td>{l.glosa || l.descripcion}</td>
            <td className="right">{l.debe > 0 ? Q(l.debe) : ''}</td>
            <td className="right">{l.haber > 0 ? Q(l.haber) : ''}</td>
          </tr>
        ))}
        <tr className="total-row">
          <td colSpan={3}>Total</td>
          <td className="right">{Q(totDebe)}</td>
          <td className="right">{Q(totHaber)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function PartidaTable({ partidas, titulo }: { partidas: CxcEspecifico['partidas']; titulo: string }) {
  if (!partidas.length) return <p style={{ fontSize: 10, color: '#9aa1ab' }}>Sin partidas abiertas.</p>
  const totSaldo = partidas.reduce((s, p) => s + p.saldo, 0)
  return (
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th style={{ width: 110 }}>{titulo}</th>
          <th style={{ width: 80 }}>Fecha</th>
          <th style={{ width: 80 }}>Vencimiento</th>
          <th className="right" style={{ width: 100 }}>Total</th>
          <th className="right" style={{ width: 100 }}>Saldo</th>
        </tr>
      </thead>
      <tbody>
        {partidas.map((p, i) => (
          <tr key={i}>
            <td>{p.nombre}</td>
            <td>{p.numero}</td>
            <td>{p.fecha ? dayjs(p.fecha).format('DD/MM/YYYY') : '—'}</td>
            <td>{p.vencimiento ? dayjs(p.vencimiento).format('DD/MM/YYYY') : '—'}</td>
            <td className="right">{Q(p.total)}</td>
            <td className="right" style={{ fontWeight: 700 }}>{Q(p.saldo)}</td>
          </tr>
        ))}
        <tr className="total-row">
          <td colSpan={5}>Total</td>
          <td className="right">{Q(totSaldo)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function PartidaPages({
  partidas, titulo, tipoLabel, total,
  empresa, mesLabel, cuenta, integrationType,
}: {
  partidas: CxcEspecifico['partidas']
  titulo: string
  tipoLabel: string
  total: number
  empresa: string
  mesLabel: string
  cuenta: DetalleResult['cuenta']
  integrationType: IntegrationType
}) {
  const pages = chunk(partidas, LINES_PER_PAGE)
  if (!pages.length) pages.push([])

  return (
    <>
      {pages.map((rows, ci) => (
        <div className="sheet" key={ci}>
          <div className="sheet-header">
            <h2>{empresa}</h2>
            <div className="sub">Integración Contable — {mesLabel}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#1B3A6B', fontWeight: 700 }}>
              {cuenta.code} &nbsp;·&nbsp; {cuenta.name}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>
              {cuenta.balanceType} &nbsp;·&nbsp; {tipoLabel}
              {pages.length > 1 ? ` — Pág. ${ci + 1}/${pages.length}` : ''}
            </div>
          </div>

          {ci === 0 && (
            <div className="kv-grid">
              <div className="kv"><div className="label">Saldo al cierre</div><div className="value">{Q(total)}</div></div>
              <div className="kv"><div className="label">Período</div><div className="value">{mesLabel}</div></div>
              <div className="kv"><div className="label">Tipo</div><div className="value">{tipoLabel}</div></div>
              <div className="kv"><div className="label">Cuenta</div><div className="value">{cuenta.code}</div></div>
            </div>
          )}

          <div className="section-title">
            Partidas abiertas {tipoLabel}{ci > 0 ? ' (cont.)' : ''} — Saldo: {Q(total)}
          </div>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th style={{ width: 110 }}>{titulo}</th>
                <th style={{ width: 80 }}>Fecha</th>
                <th style={{ width: 80 }}>Vencimiento</th>
                <th className="right" style={{ width: 100 }}>Total</th>
                <th className="right" style={{ width: 100 }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i}>
                  <td>{p.nombre}</td>
                  <td>{p.numero}</td>
                  <td>{p.fecha ? dayjs(p.fecha).format('DD/MM/YYYY') : '—'}</td>
                  <td>{p.vencimiento ? dayjs(p.vencimiento).format('DD/MM/YYYY') : '—'}</td>
                  <td className="right">{Q(p.total)}</td>
                  <td className="right" style={{ fontWeight: 700 }}>{Q(p.saldo)}</td>
                </tr>
              ))}
              {ci === pages.length - 1 && (
                <tr className="total-row">
                  <td colSpan={5}>Total</td>
                  <td className="right">{Q(total)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {ci === pages.length - 1 && (
            <div className="signature-block">
              <div className="sig-line">Preparado por</div>
              <div className="sig-line">Revisado por</div>
              <div className="sig-line">Autorizado por</div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function Sheet({ detalle, empresa, mesLabel }: { detalle: DetalleResult; empresa: string; mesLabel: string }) {
  const { cuenta, integrationType, saldoFinal, monthlyHistory, lineas, especifico } = detalle

  return (
    <div className="sheet">
      {/* Encabezado */}
      <div className="sheet-header">
        <h2>{empresa}</h2>
        <div className="sub">Integración Contable — {mesLabel}</div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#1B3A6B', fontWeight: 700 }}>
          {cuenta.code} &nbsp;·&nbsp; {cuenta.name}
        </div>
        <div style={{ fontSize: 10, color: '#6b7280' }}>{cuenta.balanceType} &nbsp;·&nbsp; {TYPE_LABEL[integrationType]}</div>
      </div>

      {/* KPIs */}
      <div className="kv-grid">
        <div className="kv"><div className="label">Saldo al cierre</div><div className="value">{Q(saldoFinal)}</div></div>
        <div className="kv"><div className="label">Período</div><div className="value">{mesLabel}</div></div>
        <div className="kv"><div className="label">Tipo integración</div><div className="value">{TYPE_LABEL[integrationType]}</div></div>
        <div className="kv"><div className="label">Cuenta</div><div className="value">{cuenta.code}</div></div>
      </div>

      {/* Historial mensual */}
      {monthlyHistory.length > 0 && (
        <>
          <div className="section-title">Historial mensual</div>
          <div className="hist-row">
            {monthlyHistory.map(h => (
              <div className="hist-cell" key={h.mes}>
                <div className="m">{dayjs(h.mes).format('MMM YY').toUpperCase()}</div>
                <div className="v">{Q(h.totalDebe - h.totalHaber)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Movimientos del mes */}
      <div className="section-title">Movimientos del período</div>
      <LineasTable lineas={lineas} />

      {/* Sección específica por tipo */}
      {especifico && (
        <>
          {integrationType === 'banco' && (() => {
            const b = especifico as BancoEspecifico
            return (
              <>
                <div className="section-title">Banco — {b.bankAccount.bankName} · {b.bankAccount.accountNumber}</div>
                {b.reconciliation && (
                  <div className="recon-box">
                    <div className="rb-title">
                      Conciliación — {MESES[(b.reconciliation.month ?? 1) - 1]} {b.reconciliation.year}
                      &nbsp;·&nbsp; Estado: {b.reconciliation.status}
                    </div>
                    <div className="recon-grid">
                      <div className="kv"><div className="label">Saldo Banco</div><div className="value">{Q(b.reconciliation.saldoBanco)}</div></div>
                      <div className="kv"><div className="label">Saldo Sistema</div><div className="value">{Q(b.reconciliation.saldoSistema)}</div></div>
                      <div className="kv">
                        <div className="label">Diferencia</div>
                        <div className="value" style={{ color: Math.abs(b.reconciliation.diferencia) < 0.01 ? '#2ea172' : '#e5484d' }}>
                          {Q(b.reconciliation.diferencia)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 75 }}>Fecha</th>
                      <th>Descripción</th>
                      <th style={{ width: 90 }}>Ref</th>
                      <th style={{ width: 70 }}>Tipo</th>
                      <th className="right" style={{ width: 100 }}>Monto</th>
                      <th className="right" style={{ width: 100 }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.transactions.map((t, i) => (
                      <tr key={i}>
                        <td>{dayjs(t.date).format('DD/MM/YYYY')}</td>
                        <td>{t.description}</td>
                        <td>{t.reference}</td>
                        <td>{t.type}</td>
                        <td className="right" style={{ color: t.amount >= 0 ? '#2ea172' : '#e5484d' }}>{Q(t.amount)}</td>
                        <td className="right">{Q(t.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          })()}

          {integrationType === 'cxc' && (() => {
            const c = especifico as CxcEspecifico
            return (
              <>
                <div className="section-title">Partidas abiertas CxC — Saldo: {Q(c.total)}</div>
                <PartidaTable partidas={c.partidas} titulo="No. Factura" />
              </>
            )
          })()}

          {integrationType === 'cxp' && (() => {
            const c = especifico as CxpEspecifico
            return (
              <>
                <div className="section-title">Partidas abiertas CxP — Saldo: {Q(c.total)}</div>
                <PartidaTable partidas={c.partidas} titulo="No. Factura" />
              </>
            )
          })()}

          {integrationType === 'inventario' && (() => {
            const inv = especifico as InventarioEspecifico
            return (
              <>
                <div className="section-title">Valorización de Inventario — Total: {Q(inv.totalValor)}</div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>SKU</th>
                      <th>Artículo</th>
                      <th className="right" style={{ width: 70 }}>Stock</th>
                      <th className="right" style={{ width: 100 }}>Costo Prom.</th>
                      <th className="right" style={{ width: 110 }}>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.articulos.map((a, i) => (
                      <tr key={i}>
                        <td>{a.sku}</td>
                        <td>{a.name}</td>
                        <td className="right">{a.stock}</td>
                        <td className="right">{Q(a.costoPromedio)}</td>
                        <td className="right" style={{ fontWeight: 700 }}>{Q(a.valorTotal)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={4}>Total</td>
                      <td className="right">{Q(inv.totalValor)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )
          })()}

          {integrationType === 'activo_fijo' && (() => {
            const af = especifico as ActivoFijoEspecifico
            return (
              <>
                <div className="section-title">Activos Fijos — Valor en Libros: {Q(af.totalValorLibros)}</div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Código</th>
                      <th>Activo</th>
                      <th style={{ width: 85 }}>Adquisición</th>
                      <th className="right" style={{ width: 100 }}>Costo Orig.</th>
                      <th className="right" style={{ width: 100 }}>Dep. Acum.</th>
                      <th className="right" style={{ width: 100 }}>Valor Libros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {af.activos.map((a, i) => (
                      <tr key={i}>
                        <td>{a.codigo}</td>
                        <td>{a.name}</td>
                        <td>{a.fechaAdquisicion ? dayjs(a.fechaAdquisicion).format('DD/MM/YYYY') : '—'}</td>
                        <td className="right">{Q(a.costoOriginal)}</td>
                        <td className="right" style={{ color: '#e5484d' }}>{Q(a.depAcumulada)}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#1B3A6B' }}>{Q(a.valorLibros)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={5}>Total</td>
                      <td className="right">{Q(af.totalValorLibros)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )
          })()}
        </>
      )}

      {/* Firma al pie */}
      <div className="signature-block">
        <div className="sig-line">Preparado por</div>
        <div className="sig-line">Revisado por</div>
        <div className="sig-line">Autorizado por</div>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function IntegracionesImprimirPage() {
  const { anio, mes } = useParams<{ anio: string; mes: string }>()
  const [searchParams]  = useSearchParams()
  const accountId = searchParams.get('accountId')
  const todosMode = searchParams.get('todos') === '1'
  const idsParam  = searchParams.get('ids') ?? ''

  const [detalles, setDetalles] = useState<DetalleResult[]>([])
  const [loading, setLoading]   = useState(true)
  const [empresa, setEmpresa]   = useState('GLL Consulting')

  const mesNum  = Number(mes)
  const anioNum = Number(anio)
  const mesLabel = `${MESES[mesNum - 1]} ${anioNum}`

  useEffect(() => {
    const load = async () => {
      try {
        if (accountId && !todosMode) {
          const d = await getDetalleIntegracion(accountId, mesNum, anioNum)
          setDetalles([d])
        } else if (todosMode) {
          let ids: string[] = idsParam ? idsParam.split(',') : []
          if (!ids.length) {
            const cierre = await getCierreIntegraciones(mesNum, anioNum)
            ids = cierre.accounts.map(a => a.id)
          }
          const results = await Promise.all(ids.map(id => getDetalleIntegracion(id, mesNum, anioNum)))
          setDetalles(results)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accountId, todosMode, idsParam, mesNum, anioNum])

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && detalles.length > 0) {
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [loading, detalles])

  // Detect empresa from first sheet
  useEffect(() => {
    const stored = localStorage.getItem('tenantName')
    if (stored) setEmpresa(stored)
  }, [])

  // CSS @page orientation per sheet type
  const landscapeSheets = detalles.filter(d => LANDSCAPE_TYPES.includes(d.integrationType))
  const hasLandscape = landscapeSheets.length > 0
  const hasPortrait  = detalles.some(d => !LANDSCAPE_TYPES.includes(d.integrationType))

  const pageStyles = hasLandscape && hasPortrait
    ? `@page { margin: 10mm; }`
    : hasLandscape
      ? `@page { margin: 10mm; size: landscape; }`
      : `@page { margin: 12mm; size: portrait; }`

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Spin size="large" tip="Preparando integración..." />
      </div>
    )
  }

  return (
    <>
      <style>{styles + pageStyles}</style>
      {detalles.map((d, i) => {
        if ((d.integrationType === 'cxp' || d.integrationType === 'cxc') && d.especifico) {
          const esp = d.especifico as CxpEspecifico | CxcEspecifico
          return (
            <PartidaPages
              key={i}
              partidas={esp.partidas}
              titulo="No. Factura"
              tipoLabel={TYPE_LABEL[d.integrationType]}
              total={esp.total}
              empresa={empresa}
              mesLabel={mesLabel}
              cuenta={d.cuenta}
              integrationType={d.integrationType}
            />
          )
        }
        return <Sheet key={i} detalle={d} empresa={empresa} mesLabel={mesLabel} />
      })}
    </>
  )
}
