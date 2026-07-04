/**
 * Comprobante de pago electrónico (transferencia / ACH / tarjeta).
 * Ruta: /bancos/pagos-realizados/:id/comprobante  (sin MainLayout)
 * Diseñado para impresora láser, hoja carta (21.59 × 27.94 cm).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { getPagoRealizado, type VendorPayment } from '../../api/pagosRealizados'
import { getOrganizationProfile, type OrganizationProfile } from '../../api/configuracion'

const MODE_LABELS: Record<string, string> = {
  cash:          'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  check:         'Cheque',
  credit_card:   'Tarjeta de crédito',
  debit_card:    'Tarjeta de débito',
  other:         'Otro',
}

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function TransferenciaPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment]   = useState<VendorPayment | null>(null)
  const [company, setCompany]   = useState<OrganizationProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getPagoRealizado(id), getOrganizationProfile()])
      .then(([p, c]) => {
        setPayment(p)
        setCompany(c)
        setLoading(false)
      })
      .catch(() => { setError('No se pudo cargar el comprobante'); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (payment && !loading) setTimeout(() => window.print(), 600)
  }, [payment, loading])

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>
  if (error || !payment) return <div style={{ padding: 40, color: 'red' }}>{error ?? 'Error'}</div>

  const today    = dayjs(payment.paymentDate).format('DD/MM/YYYY')
  const invoices = payment.appliedInvoices ?? []
  const total    = Number(payment.amount)

  return (
    <>
      <style>{`
        @page { size: letter; margin: 1.5cm 2cm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Arial', sans-serif; font-size: 10pt; color: #000; background: #fff; }

        .screen-bar {
          background: #1B3A6B; color: #fff; padding: 10px 16px;
          display: flex; gap: 12px; align-items: center; font-size: 12px;
        }
        .screen-bar button {
          padding: 5px 14px; border: none; border-radius: 4px;
          background: #fff; color: #1B3A6B; font-weight: 600; cursor: pointer;
        }

        .page { max-width: 17.59cm; margin: 20px auto; padding: 0; }

        /* Header empresa */
        .co-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #1B3A6B; padding-bottom: 10px; margin-bottom: 16px;
        }
        .co-name { font-size: 14pt; font-weight: 700; color: #1B3A6B; margin: 0 0 2px; }
        .co-sub  { font-size: 8.5pt; color: #444; line-height: 1.5; }

        /* Título documento */
        .doc-title {
          text-align: center; font-size: 13pt; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          border: 2px solid #1B3A6B; padding: 6px 0; margin-bottom: 18px;
          color: #1B3A6B;
        }

        /* Datos del pago */
        .info-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 18px;
        }
        .info-row { display: flex; gap: 6px; }
        .info-label { font-weight: 600; min-width: 110px; color: #333; }
        .info-value { color: #000; }

        /* Tabla facturas */
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt; }
        th {
          background: #1B3A6B; color: #fff; padding: 5px 8px;
          text-align: left; font-weight: 600;
        }
        td { padding: 4px 8px; border-bottom: 1px solid #ddd; }
        tr:last-child td { border-bottom: none; }
        .td-right { text-align: right; font-family: 'Courier New', monospace; }

        /* Totals */
        .total-row {
          display: flex; justify-content: flex-end; gap: 20px;
          border-top: 2px solid #1B3A6B; padding-top: 8px; margin-bottom: 24px;
          font-size: 11pt;
        }
        .total-label { font-weight: 700; color: #1B3A6B; }
        .total-value { font-weight: 700; font-family: 'Courier New', monospace; min-width: 120px; text-align: right; }

        /* Firmas */
        .firma-row {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
          margin-top: 40px;
        }
        .firma-box { text-align: center; }
        .firma-line { border-top: 1px solid #000; margin-bottom: 4px; }
        .firma-label { font-size: 8pt; color: #555; }

        /* Footer */
        .doc-footer {
          margin-top: 24px; border-top: 1px dashed #aaa; padding-top: 6px;
          font-size: 7.5pt; color: #666; text-align: center;
        }

        @media print {
          .screen-bar { display: none; }
          .page { margin: 0; }
        }
      `}</style>

      {/* Barra de controles — solo pantalla */}
      <div className="screen-bar">
        <span>
          Comprobante: <strong>{payment.paymentNumber}</strong>
          &nbsp;| {MODE_LABELS[payment.mode] ?? payment.mode}
          &nbsp;| {payment.vendorName}
        </span>
        <button onClick={() => window.print()}>🖨 Imprimir</button>
        <button onClick={() => window.close()}>✕ Cerrar</button>
      </div>

      <div className="page">
        {/* Encabezado empresa */}
        <div className="co-header">
          <div>
            <p className="co-name">{company?.legalName ?? company?.name ?? '—'}</p>
            <div className="co-sub">
              {company?.taxId && <span>NIT: {company.taxId}&nbsp;&nbsp;</span>}
              {company?.address && <span>{company.address}</span>}
              {company?.city && <span>, {company.city}</span>}
              {company?.phone && <><br /><span>Tel: {company.phone}</span></>}
              {company?.email && <span>&nbsp;&nbsp;{company.email}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: '10pt', color: '#1B3A6B' }}>{payment.paymentNumber}</div>
            <div style={{ fontSize: '9pt', color: '#555' }}>{today}</div>
          </div>
        </div>

        {/* Título */}
        <div className="doc-title">Comprobante de Pago Electrónico</div>

        {/* Datos del pago */}
        <div className="info-grid">
          <div className="info-row">
            <span className="info-label">Proveedor:</span>
            <span className="info-value">{payment.vendorName ?? '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Fecha de pago:</span>
            <span className="info-value">{today}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Modo de pago:</span>
            <span className="info-value">{MODE_LABELS[payment.mode] ?? payment.mode}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Banco / Cuenta:</span>
            <span className="info-value">{payment.bankName ?? '—'}</span>
          </div>
          {payment.reference && (
            <div className="info-row" style={{ gridColumn: '1 / -1' }}>
              <span className="info-label">Referencia / No. transacción:</span>
              <span className="info-value" style={{ fontFamily: 'monospace' }}>{payment.reference}</span>
            </div>
          )}
          {payment.notes && (
            <div className="info-row" style={{ gridColumn: '1 / -1' }}>
              <span className="info-label">Notas:</span>
              <span className="info-value">{payment.notes}</span>
            </div>
          )}
        </div>

        {/* Tabla de facturas aplicadas */}
        {invoices.length > 0 && (
          <>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>No. Factura</th>
                  <th className="td-right" style={{ textAlign: 'right' }}>Monto aplicado</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.purchaseInvoiceId}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                    <td className="td-right">{fmtQ(inv.amount, payment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Total */}
        <div className="total-row">
          <span className="total-label">TOTAL PAGADO:</span>
          <span className="total-value">{fmtQ(total, payment.currency)}</span>
        </div>

        {/* Líneas de firma */}
        <div className="firma-row">
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-label">Elaborado por</div>
          </div>
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-label">Aprobado por</div>
          </div>
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-label">Recibido / Proveedor</div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="doc-footer">
          Este documento es un comprobante interno de pago. No constituye factura fiscal.
          Generado por ConTaERP — {dayjs().format('DD/MM/YYYY HH:mm')}
        </div>
      </div>
    </>
  )
}
