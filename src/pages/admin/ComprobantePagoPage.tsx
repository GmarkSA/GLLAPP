import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { CheckCircleFilled, PrinterOutlined } from '@ant-design/icons'
import { getComprobantePago, getMiComprobantePago, type ComprobantePago } from '../../api/billing'

const NAVY = '#1B3A6B'

function fmtFecha(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function fmtMonto(n: number, cur: string): string {
  return `${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
}

export default function ComprobantePagoPage({ cliente = false }: { cliente?: boolean }) {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ComprobantePago | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    // El cliente consulta su propio voucher (endpoint scoped al tenant); el admin usa el endpoint SuperAdmin.
    const fetcher = cliente ? getMiComprobantePago : getComprobantePago
    fetcher(id)
      .then(setData)
      .catch(() => setError('No se pudo cargar el comprobante'))
      .finally(() => setLoading(false))
  }, [id, cliente])

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><Spin /></div>
  if (error || !data) return <div style={{ padding: 40, color: '#c0392b' }}>{error ?? 'Comprobante no encontrado'}</div>

  const rows: Array<[string, React.ReactNode]> = [
    ['No. de Transacción', data.qpayproTransactionId ?? '—'],
    ['Nombre', data.clienteNombre],
    ['NIT', data.clienteNit || 'CF'],
    ['Concepto', `Suscripción ${data.planNombre ?? data.plan}`],
    ['Forma de Pago', data.cardLast4 ? `${data.cardBrand ?? 'Tarjeta'} ****-${data.cardLast4}` : '—'],
    ['Fecha de Pago', fmtFecha(data.chargedAt)],
    ['Número de Autorización', data.qpayproAuditNumber || data.qpayproResponseCode || '—'],
    ['Monto total', <b key="m">{fmtMonto(data.amount, data.currency)}</b>],
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif', color: '#1f2937' }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => window.print()}
          style={{ cursor: 'pointer', border: `1px solid ${NAVY}`, color: NAVY, background: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <PrinterOutlined /> Imprimir / Descargar PDF
        </button>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: '0.02em', margin: '0 0 20px' }}>
        COMPROBANTE DE PAGO
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', marginBottom: 28, background: '#fff' }}>
        <CheckCircleFilled style={{ fontSize: 34, color: '#2ea172' }} />
        <span style={{ fontSize: 15 }}>El pago fue realizado exitosamente.</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, letterSpacing: '0.04em', borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 4 }}>
        DETALLE DE PAGO
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label} style={{ background: i % 2 === 0 ? '#f3f4f6' : '#fff' }}>
              <td style={{ padding: '12px 16px', color: '#6b7280', width: '45%', verticalAlign: 'top' }}>{label}:</td>
              <td style={{ padding: '12px 16px', color: '#5b4636' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24, fontSize: 11, color: '#9ca3af' }}>
        Este comprobante confirma el cobro procesado. La factura fiscal (FEL/DTE) se emite por separado.
      </div>
    </div>
  )
}
