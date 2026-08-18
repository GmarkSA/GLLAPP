import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { getBalanceGeneral, getEstadoResultados } from '../../api/reportes'
import { getOrganizationProfile, type OrganizationProfile } from '../../api/configuracion'

const Q = (n: number) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  body { background: #fff; color: #0a0a0a; font-size: 11px; }
  .sheet { padding: 28px 40px 40px; page-break-after: always; break-after: page; max-width: 820px; margin: 0 auto; }
  .sheet:last-child { page-break-after: avoid; break-after: avoid; }
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #1B3A6B; padding-bottom: 10px; margin-bottom: 6px; gap: 16px; }
  .co-name { font-size: 15px; font-weight: 700; color: #1B3A6B; }
  .co-sub { font-size: 10px; color: #555; }
  .logo { max-height: 46px; max-width: 150px; object-fit: contain; }
  .rep-title { text-align: center; font-size: 14px; font-weight: 700; color: #1B3A6B; margin: 10px 0 2px; }
  .rep-sub { text-align: center; font-size: 10px; color: #666; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; }
  .grp { font-size: 11px; font-weight: 700; color: #1B3A6B; text-transform: uppercase; letter-spacing: .03em; padding-top: 10px; border-bottom: 1px solid #dfe5ec; }
  .row td { border-bottom: 1px solid #f0f2f5; }
  .code { color: #8a97a5; width: 70px; font-variant-numeric: tabular-nums; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; width: 130px; }
  .subtot td { font-weight: 600; border-top: 1px solid #cdd5df; }
  .grand td { font-weight: 800; color: #1B3A6B; border-top: 2px solid #1B3A6B; border-bottom: 2px solid #1B3A6B; font-size: 12px; }
  @media print { @page { margin: 12mm; size: letter portrait; } .sheet { padding: 0; } }
`

type AccRow = { code: string; name: string; balance: number }
type Grupo  = { accounts: AccRow[]; total: number }

function DocHeader({ org }: { org: OrganizationProfile | null }) {
  const name = org?.legalName || org?.name || 'Mi Empresa'
  return (
    <div className="doc-header">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {org?.logoUrl && <img src={org.logoUrl} alt="logo" className="logo" />}
        <div>
          <div className="co-name">{name}</div>
          {org?.taxId   && <div className="co-sub">NIT: {org.taxId}</div>}
          {org?.address && <div className="co-sub">{org.address}{org.city ? `, ${org.city}` : ''}</div>}
        </div>
      </div>
    </div>
  )
}

function Grupo({ title, g }: { title: string; g?: Grupo }) {
  if (!g) return null
  return (
    <>
      <tr><td className="grp" colSpan={3}>{title}</td></tr>
      {g.accounts.filter(a => Number(a.balance) !== 0).map((a, i) => (
        <tr className="row" key={i}>
          <td className="code">{a.code}</td>
          <td>{a.name}</td>
          <td className="amt">{Q(a.balance)}</td>
        </tr>
      ))}
      <tr className="subtot"><td /><td>Total {title}</td><td className="amt">{Q(g.total)}</td></tr>
    </>
  )
}

function Grand({ label, value }: { label: string; value: number }) {
  return <tr className="grand"><td /><td>{label}</td><td className="amt">{Q(value)}</td></tr>
}

export default function EstadosFinancierosImprimirPage() {
  const { anio, mes } = useParams<{ anio: string; mes: string }>()
  const y = Number(anio); const m = Number(mes)
  const endOfMonth = dayjs(`${y}-${String(m).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD')
  const jan1 = `${y}-01-01`

  const [bg, setBg] = useState<any>(null)
  const [er, setEr] = useState<any>(null)
  const [org, setOrg] = useState<OrganizationProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getBalanceGeneral({ date: endOfMonth }),
      getEstadoResultados({ fromDate: jan1, toDate: endOfMonth }),
      getOrganizationProfile().catch(() => null),
    ]).then(([b, e, o]) => { setBg(b); setEr(e); setOrg(o as OrganizationProfile | null) })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes])

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [loading])

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><Spin size="large" /></div>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Balance General */}
      <div className="sheet">
        <DocHeader org={org} />
        <div className="rep-title">Balance General</div>
        <div className="rep-sub">Saldos acumulados al {dayjs(endOfMonth).format('DD/MM/YYYY')}</div>
        {bg && (
          <table>
            <tbody>
              <Grupo title="Activo Circulante" g={bg.activo} />
              <Grupo title="Activo Fijo" g={bg.activoFijo} />
              <Grand label="TOTAL ACTIVOS" value={bg.totalActivo} />
              <Grupo title="Pasivo" g={bg.pasivo} />
              <Grupo title="Capital" g={bg.capital} />
              <Grand label="TOTAL PASIVO + CAPITAL" value={bg.totalPasivoCapital} />
            </tbody>
          </table>
        )}
      </div>

      {/* Estado de Resultados */}
      <div className="sheet">
        <DocHeader org={org} />
        <div className="rep-title">Estado de Resultados</div>
        <div className="rep-sub">Del {dayjs(jan1).format('DD/MM/YYYY')} al {dayjs(endOfMonth).format('DD/MM/YYYY')} — {MESES[m - 1]} {y} (acumulado)</div>
        {er && (
          <table>
            <tbody>
              <Grupo title="Ingresos" g={er.ingresos} />
              <Grupo title="Otros Ingresos" g={er.otrosIngresos} />
              <Grupo title="Costos" g={er.costos} />
              <Grand label="UTILIDAD BRUTA" value={er.utilidadBruta} />
              <Grupo title="Gastos" g={er.gastos} />
              <Grupo title="Otros Gastos" g={er.otrosGastos} />
              <Grand label="UTILIDAD NETA" value={er.utilidadNeta} />
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
