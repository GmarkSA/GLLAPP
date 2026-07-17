/**
 * BoletasPagoImprimirPage — Impresión en lote de boletas de pago del mes.
 *
 * Ruta: /planillas/mensual/:anio/:mes/imprimir-boletas?format=media-carta
 *
 * La boleta se entrega mensual (1ra + 2da quincena consolidadas), por eso
 * usa el mismo dato ya validado del reporte "Detalle de planilla mensual"
 * en vez de los montos de una quincena individual.
 *
 * - Una boleta por empleado, cada una en su propia página (salto de página)
 * - Auto-dispara window.print() al terminar de cargar — un solo trabajo de
 *   impresión para todos los empleados, pensado para impresora matriz
 * - URL real (no about:blank) → Chrome respeta el CSS @page
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { getDetalleMensualPlanilla, type DetalleMensualPlanilla, type EmpleadoDetalleMensual } from '../../../api/planillas-corrida'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

type Format = 'carta' | 'media-carta' | 'ticket-80' | 'ticket-58'

const FORMAT_CONFIG: Record<Format, { pageSize: string; fontSize: number }> = {
  'carta':       { pageSize: '8.5in 11in',  fontSize: 11 },
  'media-carta': { pageSize: '5.5in 8.5in', fontSize: 10 },
  'ticket-80':   { pageSize: '80mm auto',   fontSize: 9 },
  'ticket-58':   { pageSize: '58mm auto',   fontSize: 8 },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const fmtQ = (n: any) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function Boleta({ e, anio, mes, org, cfg, esUltima }: {
  e: EmpleadoDetalleMensual
  anio: number
  mes: number
  org: OrganizationProfile | null
  cfg: { pageSize: string; fontSize: number }
  esUltima: boolean
}) {
  const companyName = org?.legalName || org?.name || 'Mi Empresa'

  return (
    <div className="boleta" style={{ pageBreakAfter: esUltima ? 'auto' : 'always' }}>
      <div className="hdr">
        <div className="co-name">{companyName}</div>
        {org?.taxId && <div className="co-sub">NIT: {org.taxId}</div>}
      </div>
      <div className="doc-title">RECIBO DE PAGO DE SALARIO</div>
      <div className="empleado-line">
        <strong>{e.empleadoNombre}</strong> — Código {e.empleadoCodigo}
      </div>
      <div className="periodo-line">
        {MESES[mes - 1]} {anio} — mes completo (1ra y 2da quincena)
      </div>

      <table>
        <thead><tr><th>PERCEPCIONES</th><th className="r">MONTO</th></tr></thead>
        <tbody>
          <tr><td>Salario devengado (mes completo)</td><td className="r">{fmtQ(e.sueldoBase)}</td></tr>
          {Number(e.montoHorasExtra) > 0 && <tr><td>Horas extra</td><td className="r">{fmtQ(e.montoHorasExtra)}</td></tr>}
          {Number(e.bonificacion) > 0 && <tr><td>Bonificación incentivo (Dto. 78-89)</td><td className="r">{fmtQ(e.bonificacion)}</td></tr>}
          {Number(e.comisiones) > 0 && <tr><td>Otros ingresos</td><td className="r">{fmtQ(e.comisiones)}</td></tr>}
          <tr className="tot"><td>TOTAL DEVENGADO</td><td className="r">{fmtQ(e.totalDevengado)}</td></tr>
        </tbody>
      </table>

      <table>
        <thead><tr><th>DEDUCCIONES</th><th className="r">MONTO</th></tr></thead>
        <tbody>
          {Number(e.igssLaboral) > 0 && <tr><td>Cuota laboral IGSS</td><td className="r">{fmtQ(e.igssLaboral)}</td></tr>}
          {Number(e.isrEmpleados) > 0 && <tr><td>Retención ISR</td><td className="r">{fmtQ(e.isrEmpleados)}</td></tr>}
          {Number(e.otrasDeducciones) > 0 && <tr><td>Otras deducciones</td><td className="r">{fmtQ(e.otrasDeducciones)}</td></tr>}
          <tr className="tot"><td>TOTAL DEDUCCIONES</td><td className="r">{fmtQ(e.totalDeducciones)}</td></tr>
        </tbody>
      </table>

      <div className="neto">LÍQUIDO A PAGAR: {fmtQ(e.netoAPagar)}</div>

      <div className="firma">
        <div className="firma-linea" />
        <div className="firma-lbl">Firma del trabajador — Fecha: ______________</div>
      </div>
    </div>
  )
}

export default function BoletasPagoImprimirPage() {
  const { anio, mes } = useParams<{ anio: string; mes: string }>()
  const [searchParams] = useSearchParams()
  const format = (searchParams.get('format') ?? 'media-carta') as Format
  const cfg = FORMAT_CONFIG[format] ?? FORMAT_CONFIG['media-carta']

  const [data, setData] = useState<DetalleMensualPlanilla | null>(null)
  const [org, setOrg] = useState<OrganizationProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!anio || !mes) return
    Promise.all([getDetalleMensualPlanilla(Number(anio), Number(mes)), getOrganizationProfile()])
      .then(([d, o]) => { setData(d); setOrg(o) })
      .finally(() => setLoading(false))
  }, [anio, mes])

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, data])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Preparando boletas de pago para imprimir…" />
      </div>
    )
  }

  if (!data || data.empleados.length === 0) {
    return <div style={{ padding: 40 }}>No hay empleados en esta planilla.</div>
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        @media print {
          @page { size: ${cfg.pageSize}; margin: 0; }
          body { margin: 0; background: #fff !important; }
          .no-print { display: none !important; }
          .boleta { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 8mm 12mm !important; }
        }

        body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: ${cfg.fontSize}px; background: #e8e8e8; margin: 0; padding: 0; color: #000; }

        .boleta { background: #fff; max-width: 480px; margin: 20px auto; padding: 16px 20px; box-shadow: 0 2px 16px rgba(0,0,0,.15); }

        .hdr { text-align: center; margin-bottom: 4px; }
        .co-name { font-size: ${cfg.fontSize + 4}px; font-weight: 700; color: #1B3A6B; }
        .co-sub { font-size: ${cfg.fontSize - 1}px; color: #555; }
        .doc-title { text-align: center; font-weight: 700; font-size: ${cfg.fontSize + 1}px; margin: 8px 0; border-top: 2px solid #1B3A6B; border-bottom: 2px solid #1B3A6B; padding: 4px 0; }
        .empleado-line { font-size: ${cfg.fontSize}px; margin-top: 8px; }
        .periodo-line { font-size: ${cfg.fontSize - 1}px; color: #555; margin-bottom: 10px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead th { text-align: left; font-size: ${cfg.fontSize - 1}px; color: #555; border-bottom: 1px solid #ccc; padding: 3px 0; }
        thead th.r { text-align: right; }
        tbody td { font-size: ${cfg.fontSize}px; padding: 2px 0; }
        tbody td.r { text-align: right; }
        tr.tot td { font-weight: 700; border-top: 1px solid #ccc; padding-top: 4px; }

        .neto { text-align: right; font-weight: 700; font-size: ${cfg.fontSize + 3}px; color: #1B3A6B; margin: 10px 0; }

        .firma { margin-top: 24px; text-align: center; }
        .firma-linea { border-top: 1px solid #000; width: 80%; margin: 0 auto 4px; }
        .firma-lbl { font-size: ${cfg.fontSize - 2}px; color: #555; }

        .print-btn {
          position: fixed; bottom: 24px; right: 24px; z-index: 999;
          padding: 10px 22px; background: #1B3A6B; color: #fff;
          border: none; border-radius: 6px; font-size: 14px; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,.3);
        }
        .print-btn:hover { background: #2550a0; }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>
        🖨️ Imprimir todas ({data.empleados.length})
      </button>

      {data.empleados.map((e, i) => (
        <Boleta key={e.empleadoId} e={e} anio={Number(anio)} mes={Number(mes)} org={org} cfg={cfg} esUltima={i === data.empleados.length - 1} />
      ))}
    </>
  )
}
