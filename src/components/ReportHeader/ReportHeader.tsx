import type { EmpresaInfo } from '../../api/reportes'

interface Props {
  empresa:     EmpresaInfo | null
  reportName:  string
  period:      string          // ej. "Del 01/05/2026 al 31/05/2026"
  folioInicio: number
  folioFin:    number
}

export default function ReportHeader({ empresa, reportName, period, folioInicio, folioFin }: Props) {
  const tradeName = empresa?.company_name ?? 'ContaERP'
  const legalName = empresa?.legal_name   ?? ''
  const nit       = empresa?.tax_id       ?? ''
  const currency  = empresa?.currency     ?? 'GTQ'

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      borderBottom: '2px solid #1B3A6B', paddingBottom: 10, marginBottom: 12,
    }}>
      {/* Datos empresa */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', lineHeight: 1.3 }}>{tradeName}</div>
        {legalName && legalName !== tradeName && (
          <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>{legalName}</div>
        )}
        {nit && (
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>N.I.T.:</span> {nit}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, fontWeight: 500 }}>{reportName}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{period}</div>
      </div>

      {/* Moneda + Folio */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{
          background: '#f3f4f6', borderRadius: 6, padding: '3px 10px',
          fontSize: 11, color: '#6b7280', fontWeight: 500,
        }}>
          Moneda: <strong>{currency}</strong>
        </div>
        <div style={{
          border: '1.5px solid #1B3A6B', borderRadius: 6, padding: '4px 14px',
          textAlign: 'center', minWidth: 70,
        }}>
          <div style={{ fontSize: 9, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1 }}>Folio</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1B3A6B', lineHeight: 1.3, fontFamily: 'monospace' }}>
            {folioInicio === folioFin ? folioInicio : `${folioInicio}–${folioFin}`}
          </div>
        </div>
      </div>
    </div>
  )
}
