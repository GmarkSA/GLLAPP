import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { getEstimate, type Estimate, ESTIMATE_STATUS_CONFIG } from '../../../api/facturas'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const fmtQ = (n: number, currency = 'GTQ') =>
  `${currency === 'USD' ? '$' : 'Q'} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function EstimacionPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [estimate, setEstimate]   = useState<Estimate | null>(null)
  const [org,      setOrg]        = useState<OrganizationProfile | null>(null)
  const [loading,  setLoading]    = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getEstimate(id), getOrganizationProfile()])
      .then(([est, o]) => { setEstimate(est); setOrg(o) })
      .finally(() => setLoading(false))
  }, [id])

  // Auto-print after data loads
  useEffect(() => {
    if (!loading && estimate) {
      setTimeout(() => window.print(), 400)
    }
  }, [loading, estimate])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Preparando documento…" />
      </div>
    )
  }

  if (!estimate) {
    return <div style={{ padding: 40 }}>No se encontró la cotización.</div>
  }

  const statusCfg = ESTIMATE_STATUS_CONFIG[estimate.status] ?? { label: estimate.status, color: 'default' }

  const subtotal = estimate.subtotal ?? 0
  const discount = estimate.discountAmount ?? 0
  const tax      = estimate.taxAmount ?? 0
  const total    = estimate.total ?? 0

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: letter; }
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
        body { font-family: Arial, sans-serif; background: #f0f0f0; }
        .print-page {
          background: #fff;
          max-width: 850px;
          margin: 24px auto;
          padding: 36px 40px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.15);
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .org-name { font-size: 22px; font-weight: 700; color: #1B3A6B; }
        .org-sub { font-size: 12px; color: #666; margin-top: 4px; }
        .doc-title { text-align: right; }
        .doc-number { font-size: 20px; font-weight: 700; color: #1B3A6B; font-family: monospace; }
        .status-badge {
          display: inline-block; padding: 2px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600; margin-top: 6px;
          background: #e6f4ff; color: #0958d9; border: 1px solid #91caff;
        }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .info-box { border: 1px solid #e8e8e8; border-radius: 6px; padding: 12px 14px; }
        .info-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 6px; }
        .info-value { font-size: 13px; color: #222; font-weight: 500; }
        .info-sub   { font-size: 11px; color: #666; margin-top: 2px; }
        .dates-row  { display: flex; gap: 32px; margin-bottom: 28px; }
        .date-item  { }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead tr { background: #1B3A6B; }
        thead th { color: #fff; font-size: 11px; padding: 8px 10px; text-align: left; font-weight: 600; }
        thead th.right { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td { font-size: 12px; padding: 8px 10px; color: #333; }
        tbody td.right { text-align: right; font-family: monospace; }
        tbody td.center { text-align: center; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 28px; }
        .totals-box { width: 260px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals-row.total { font-weight: 700; font-size: 15px; color: #1B3A6B;
          border-top: 2px solid #1B3A6B; padding-top: 8px; margin-top: 4px; }
        .notes-section { border-top: 1px solid #e8e8e8; padding-top: 16px; margin-top: 8px; }
        .notes-title { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 6px; }
        .notes-text  { font-size: 12px; color: #444; white-space: pre-wrap; }
        .footer { margin-top: 32px; border-top: 1px solid #e8e8e8; padding-top: 12px;
          font-size: 10px; color: #aaa; text-align: center; }
        .print-btn {
          position: fixed; bottom: 24px; right: 24px; z-index: 999;
          padding: 10px 22px; background: #1B3A6B; color: #fff;
          border: none; border-radius: 6px; font-size: 14px; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .print-btn:hover { background: #2550a0; }
      `}</style>

      {/* Manual print button (visible on screen, hidden when printing) */}
      <button className="print-btn no-print" onClick={() => window.print()}>
        🖨️ Imprimir / PDF
      </button>

      <div className="print-page">
        {/* HEADER */}
        <div className="header">
          <div>
            {org?.logoUrl && (
              <img src={org.logoUrl} alt="logo" style={{ maxHeight: 60, maxWidth: 200, marginBottom: 8, display: 'block' }} />
            )}
            <div className="org-name">{org?.legalName || org?.name || 'Mi Empresa'}</div>
            <div className="org-sub">NIT: {org?.taxId || '—'}</div>
            {org?.address && <div className="org-sub">{org.address}{org.city ? `, ${org.city}` : ''}</div>}
            {org?.phone && <div className="org-sub">Tel: {org.phone}</div>}
            {org?.email && <div className="org-sub">{org.email}</div>}
          </div>
          <div className="doc-title">
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>COTIZACIÓN</div>
            <div className="doc-number">{estimate.estimateNumber}</div>
            <div className={`status-badge`} style={{
              background: statusCfg.color === 'blue' ? '#e6f4ff' : statusCfg.color === 'green' ? '#f6ffed' : '#fafafa',
              color:      statusCfg.color === 'blue' ? '#0958d9' : statusCfg.color === 'green' ? '#389e0d' : '#666',
              borderColor:statusCfg.color === 'blue' ? '#91caff' : statusCfg.color === 'green' ? '#b7eb8f' : '#d9d9d9',
            }}>
              {statusCfg.label}
            </div>
          </div>
        </div>

        {/* CLIENT & DATES */}
        <div className="info-grid">
          <div className="info-box">
            <div className="info-label">Cliente</div>
            <div className="info-value">{estimate.customerName}</div>
            {estimate.customerTaxId && <div className="info-sub">NIT: {estimate.customerTaxId}</div>}
          </div>
          <div className="info-box">
            <div className="info-label">Información del documento</div>
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div className="info-sub" style={{ marginTop: 0 }}>Fecha emisión</div>
                <div className="info-value">{dayjs(estimate.estimateDate).format('DD/MM/YYYY')}</div>
              </div>
              {estimate.expiryDate && (
                <div>
                  <div className="info-sub" style={{ marginTop: 0 }}>Vence</div>
                  <div className="info-value">{dayjs(estimate.expiryDate).format('DD/MM/YYYY')}</div>
                </div>
              )}
              <div>
                <div className="info-sub" style={{ marginTop: 0 }}>Moneda</div>
                <div className="info-value">{estimate.currency}</div>
              </div>
            </div>
          </div>
        </div>

        {/* LINE ITEMS */}
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Descripción</th>
              <th className="center" style={{ width: 55 }}>Unidad</th>
              <th className="right" style={{ width: 65 }}>Cant.</th>
              <th className="right" style={{ width: 90 }}>P. Unit.</th>
              <th className="right" style={{ width: 65 }}>Desc.%</th>
              <th className="right" style={{ width: 65 }}>IVA%</th>
              <th className="right" style={{ width: 100 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(estimate.items ?? []).map((item, idx) => (
              <tr key={idx}>
                <td style={{ color: '#aaa', fontSize: 11 }}>{idx + 1}</td>
                <td>{item.description}</td>
                <td className="center">{item.unit || '—'}</td>
                <td className="right">{Number(item.quantity).toFixed(2)}</td>
                <td className="right">{fmtQ(Number(item.unitPrice), estimate.currency)}</td>
                <td className="right">{Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : '—'}</td>
                <td className="right">{item.taxPercent}%</td>
                <td className="right" style={{ fontWeight: 600 }}>
                  {fmtQ(Number(item.lineTotal ?? 0), estimate.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS */}
        <div className="totals">
          <div className="totals-box">
            <div className="totals-row">
              <span style={{ color: '#666' }}>Subtotal</span>
              <span>{fmtQ(subtotal, estimate.currency)}</span>
            </div>
            {discount > 0 && (
              <div className="totals-row">
                <span style={{ color: '#666' }}>Descuento</span>
                <span style={{ color: '#cf1322' }}>− {fmtQ(discount, estimate.currency)}</span>
              </div>
            )}
            <div className="totals-row">
              <span style={{ color: '#666' }}>IVA</span>
              <span>{fmtQ(tax, estimate.currency)}</span>
            </div>
            <div className="totals-row total">
              <span>TOTAL</span>
              <span>{fmtQ(total, estimate.currency)}</span>
            </div>
          </div>
        </div>

        {/* NOTES */}
        {(estimate.notes || estimate.termsAndConditions) && (
          <div className="notes-section">
            {estimate.notes && (
              <>
                <div className="notes-title">Notas</div>
                <div className="notes-text">{estimate.notes}</div>
              </>
            )}
            {estimate.termsAndConditions && (
              <div style={{ marginTop: estimate.notes ? 12 : 0 }}>
                <div className="notes-title">Términos y condiciones</div>
                <div className="notes-text">{estimate.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        <div className="footer">
          Documento generado el {dayjs().format('DD/MM/YYYY HH:mm')} · {org?.name}
        </div>
      </div>
    </>
  )
}
