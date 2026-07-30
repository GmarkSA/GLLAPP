/**
 * FacturaImprimirPage — Página de impresión de factura.
 *
 * Ruta: /ventas/facturas/:id/imprimir?format=carta|media-carta|ticket-80|ticket-58
 *
 * - Carga la factura y el perfil de la empresa
 * - Auto-dispara window.print() al terminar de cargar
 * - URL real (no about:blank) → Chrome respeta el CSS @page
 * - Botón manual de impresión visible en pantalla
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { getInvoice, type Invoice } from '../../../api/facturas'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

type Format = 'carta' | 'media-carta' | 'ticket-80' | 'ticket-58'

const FORMAT_CONFIG: Record<Format, { pageSize: string; fontSize: number; isTicket: boolean }> = {
  'carta':      { pageSize: '8.5in 11in',  fontSize: 11, isTicket: false },
  'media-carta':{ pageSize: '5.5in 8.5in', fontSize: 10, isTicket: false },
  'ticket-80':  { pageSize: '80mm auto',   fontSize: 9,  isTicket: true  },
  'ticket-58':  { pageSize: '58mm auto',   fontSize: 8,  isTicket: true  },
}

const fmtQ  = (n: any) => `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtD  = (d?: string) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

export default function FacturaImprimirPage() {
  const { id }              = useParams<{ id: string }>()
  const [searchParams]      = useSearchParams()
  const format              = (searchParams.get('format') ?? 'carta') as Format
  const cfg                 = FORMAT_CONFIG[format] ?? FORMAT_CONFIG['carta']

  const [invoice,  setInvoice]  = useState<Invoice | null>(null)
  const [org,      setOrg]      = useState<OrganizationProfile | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getInvoice(id), getOrganizationProfile()])
      .then(([inv, o]) => { setInvoice(inv); setOrg(o) })
      .finally(() => setLoading(false))
  }, [id])

  // Auto-imprimir al cargar
  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, invoice])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Preparando factura para imprimir…" />
      </div>
    )
  }

  if (!invoice) {
    return <div style={{ padding: 40 }}>No se encontró la factura.</div>
  }

  const subtotal = Number(invoice.subtotal  ?? 0)
  const discount = Number(invoice.discountAmount ?? 0)
  const tax      = Number(invoice.taxAmount  ?? 0)
  const total    = Number(invoice.total     ?? 0)
  const hasDiscount = (invoice.items ?? []).some(i => Number(i.discountPercent) > 0)

  const companyName = org?.legalName || org?.name || 'Mi Empresa'

  return (
    <>
      {/* ── Estilos ──────────────────────────────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        @media print {
          @page {
            size: ${cfg.pageSize};
            margin: 0;   /* elimina header/footer automático del browser (URL, fecha, página) */
          }
          body  { margin: 0; background: #fff !important; }
          .no-print { display: none !important; }
          .print-wrap {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: 100% !important;
            /* El padding aquí reemplaza el margin del @page */
            padding: ${cfg.isTicket ? '4mm 5mm' : '12mm 15mm'} !important;
          }
        }

        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: ${cfg.fontSize}px;
          background: ${cfg.isTicket ? '#fff' : 'rgba(10,10,10,0.08)'};
          margin: 0; padding: 0;
          color: #000;
        }

        .print-wrap {
          background: #fff;
          max-width: ${cfg.isTicket ? '90mm' : '860px'};
          margin: ${cfg.isTicket ? '0 auto' : '20px auto'};
          padding: ${cfg.isTicket ? '6mm 5mm' : '32px 36px'};
          ${cfg.isTicket ? '' : 'box-shadow: 0 2px 16px rgba(0,0,0,.15);'}
        }

        /* ── Header ── */
        .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${cfg.isTicket ? '8px' : '24px'}; }
        .hdr-left .co-name { font-size: ${cfg.fontSize + (cfg.isTicket ? 2 : 5)}px; font-weight: 700; color: #1faec2; }
        .hdr-left .co-sub  { font-size: ${cfg.fontSize - 1}px; color: #555; margin-top: 2px; }
        .hdr-right { text-align: ${cfg.isTicket ? 'center' : 'right'}; ${cfg.isTicket ? 'width:100%;' : ''} }
        .doc-type  { font-size: ${cfg.fontSize - 1}px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
        .doc-num   { font-size: ${cfg.fontSize + (cfg.isTicket ? 1 : 4)}px; font-weight: 700; color: #1faec2; margin-top: 2px; }
        .doc-dates { font-size: ${cfg.fontSize - 1}px; color: #555; margin-top: 4px; line-height: 1.6; }

        /* ── Dividers ── */
        .divider       { border: none; border-top: 1px solid #ccc; margin: ${cfg.isTicket ? '6px 0' : '16px 0'}; }
        .divider-thick { border: none; border-top: 2px solid #1faec2; margin: ${cfg.isTicket ? '6px 0' : '16px 0'}; }

        /* ── Info grid ── */
        .info-grid {
          display: ${cfg.isTicket ? 'block' : 'grid'};
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .info-box { border: 1px solid rgba(10,10,10,0.08); border-radius: 5px; padding: 10px 12px; margin-bottom: ${cfg.isTicket ? '6px' : '0'}; }
        .info-box.fel { border-color: rgba(31,174,194,0.35); background: #e6fafd; }
        .info-lbl { font-size: ${cfg.fontSize - 2}px; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; margin-bottom: 4px; font-weight: 600; }
        .info-val { font-size: ${cfg.fontSize}px; font-weight: 500; }
        .info-sub { font-size: ${cfg.fontSize - 2}px; color: #666; margin-top: 2px; word-break: break-all; }

        /* ── Tabla ── */
        table  { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        thead tr { background: #1faec2; }
        thead th {
          color: #fff; font-size: ${cfg.fontSize - 1}px;
          padding: ${cfg.isTicket ? '4px 4px' : '7px 10px'};
          text-align: left; font-weight: 600; white-space: nowrap;
        }
        thead th.r { text-align: right; }
        tbody tr { border-bottom: 1px solid rgba(10,10,10,0.08); }
        tbody tr:nth-child(even) { background: #fafbfc; }
        tbody td {
          font-size: ${cfg.isTicket ? cfg.fontSize - 1 : cfg.fontSize}px;
          padding: ${cfg.isTicket ? '4px 4px' : '7px 10px'};
          color: #222; vertical-align: top;
        }
        tbody td.r { text-align: right; }
        tbody td.c { text-align: center; }
        .td-desc   { font-weight: 500; }
        .td-subdesc { font-size: ${cfg.fontSize - 2}px; color: #777; margin-top: 2px; }

        /* ── Totales ── */
        .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-box  { width: ${cfg.isTicket ? '100%' : '260px'}; }
        .tot-row     { display: flex; justify-content: space-between; padding: 3px 0; font-size: ${cfg.fontSize}px; }
        .tot-row.iva { color: #1faec2; font-weight: 500; }
        .tot-row.grand {
          font-weight: 700; font-size: ${cfg.fontSize + (cfg.isTicket ? 4 : 3)}px;
          color: #fff; background: #1faec2;
          border-radius: 5px; padding: 8px 12px; margin-top: 6px;
        }

        /* ── Notas / FEL / Footer ── */
        .section { border-top: 1px solid rgba(10,10,10,0.08); padding-top: 14px; margin-top: 6px; }
        .section-title { font-size: ${cfg.fontSize - 2}px; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; margin-bottom: 5px; font-weight: 600; }
        .section-body  { font-size: ${cfg.fontSize - 1}px; color: #444; white-space: pre-wrap; line-height: 1.5; }

        .footer {
          margin-top: 20px; border-top: 1px solid rgba(10,10,10,0.08); padding-top: 10px;
          font-size: ${cfg.fontSize - 2}px; color: #aaa;
          display: flex; justify-content: space-between;
          ${cfg.isTicket ? 'text-align:center; display:block;' : ''}
        }

        /* ── Botón manual (solo pantalla) ── */
        .print-btn {
          position: fixed; bottom: 24px; right: 24px; z-index: 999;
          padding: 10px 22px; background: #1faec2; color: #fff;
          border: none; border-radius: 6px; font-size: 14px; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,.3); display: flex; align-items: center; gap: 8px;
        }
        .print-btn:hover { background: #2550a0; }
      `}</style>

      {/* Botón manual para re-imprimir */}
      <button className="print-btn no-print" onClick={() => window.print()}>
        🖨️ Imprimir / PDF
      </button>

      <div className="print-wrap">

        {/* ── ENCABEZADO ─────────────────────────────────────────────────── */}
        {cfg.isTicket ? (
          // Ticket: todo centrado
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {org?.logoUrl && <img src={org.logoUrl} alt="logo" style={{ maxHeight: 40, maxWidth: '70%', marginBottom: 4, display: 'block', margin: '0 auto 4px' }} />}
            <div className="hdr-left"><div className="co-name">{companyName}</div></div>
            {org?.taxId    && <div className="co-sub">NIT: {org.taxId}</div>}
            {org?.address  && <div className="co-sub">{org.address}</div>}
            {org?.phone    && <div className="co-sub">Tel: {org.phone}</div>}
          </div>
        ) : (
          <div className="hdr">
            <div className="hdr-left">
              {org?.logoUrl && <img src={org.logoUrl} alt="logo" style={{ maxHeight: 56, maxWidth: 180, marginBottom: 6, display: 'block' }} />}
              <div className="co-name">{companyName}</div>
              {org?.taxId    && <div className="co-sub">NIT: {org.taxId}</div>}
              {org?.address  && <div className="co-sub">{org.address}{org.city ? `, ${org.city}` : ''}</div>}
              {org?.phone    && <div className="co-sub">Tel: {org.phone}</div>}
              {org?.email    && <div className="co-sub">{org.email}</div>}
            </div>
            <div className="hdr-right">
              <div className="doc-type">{invoice.facturaExenta ? 'Factura Exenta' : 'Factura Cambiaria'}</div>
              <div className="doc-num">{invoice.invoiceNumber}</div>
              <div className="doc-dates">
                {invoice.felSerie && <div>Serie: {invoice.felSerie} &nbsp;|&nbsp; Núm: {invoice.felNumero}</div>}
                <div>Fecha: <strong>{fmtD(invoice.invoiceDate)}</strong></div>
                {invoice.dueDate && <div>Vence: <strong>{fmtD(invoice.dueDate)}</strong></div>}
              </div>
            </div>
          </div>
        )}

        <hr className="divider-thick" />

        {/* ── CLIENTE + FEL ──────────────────────────────────────────────── */}
        <div className="info-grid">
          <div className="info-box">
            <div className="info-lbl">Facturar a</div>
            <div className="info-val">{invoice.customerName}</div>
            {invoice.customerTaxId && <div className="info-sub">NIT: {invoice.customerTaxId}</div>}
            {invoice.purchaseOrderRef && <div className="info-sub">Ref. PO: {invoice.purchaseOrderRef}</div>}
          </div>

          {(invoice.felUuid || invoice.felAutorizacion || invoice.felSerie) && !cfg.isTicket && (
            <div className="info-box fel">
              <div className="info-lbl" style={{ color: '#1faec2' }}>Certificación FEL — SAT Guatemala</div>
              {invoice.felSerie && <div className="info-sub"><strong>Serie:</strong> {invoice.felSerie} &nbsp; <strong>Núm:</strong> {invoice.felNumero}</div>}
              {invoice.felAutorizacion && <div className="info-sub"><strong>Aut:</strong> {invoice.felAutorizacion}</div>}
              {invoice.felUuid && <div className="info-sub"><strong>UUID:</strong> {invoice.felUuid}</div>}
            </div>
          )}
        </div>

        {/* ── TABLA DE LÍNEAS ────────────────────────────────────────────── */}
        {cfg.isTicket ? (
          // Ticket: layout vertical por ítem
          <table>
            <thead><tr>
              <th>Descripción</th>
              <th className="r">Total</th>
            </tr></thead>
            <tbody>
              {(invoice.items ?? []).map((item, i) => (
                <tr key={i}>
                  <td>
                    <div className="td-desc">{item.description}</div>
                    <div className="td-subdesc">{Number(item.quantity).toFixed(2)} × Q {Number(item.unitPrice).toFixed(2)}{item.discountPercent > 0 ? ` (−${item.discountPercent}%)` : ''}</div>
                  </td>
                  <td className="r" style={{ fontWeight: 600 }}>{fmtQ(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Carta/Media carta: tabla completa
          <table>
            <thead><tr>
              <th style={{ width: 28 }}>#</th>
              <th>Descripción</th>
              <th className="c" style={{ width: 60 }}>Unidad</th>
              <th className="r" style={{ width: 60 }}>Cant.</th>
              <th className="r" style={{ width: 90 }}>Precio</th>
              {hasDiscount && <th className="r" style={{ width: 55 }}>Desc.%</th>}
              <th className="r" style={{ width: 55 }}>IVA%</th>
              <th className="r" style={{ width: 100 }}>Total</th>
            </tr></thead>
            <tbody>
              {(invoice.items ?? []).map((item, i) => (
                <tr key={i}>
                  <td style={{ color: '#aaa', fontSize: cfg.fontSize - 1 }}>{i + 1}</td>
                  <td><div className="td-desc">{item.description}</div></td>
                  <td className="c">{item.unit || '—'}</td>
                  <td className="r">{Number(item.quantity).toFixed(2)}</td>
                  <td className="r">{fmtQ(item.unitPrice)}</td>
                  {hasDiscount && <td className="r">{Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : '—'}</td>}
                  <td className="r">{item.taxPercent}%</td>
                  <td className="r" style={{ fontWeight: 600 }}>{fmtQ(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── TOTALES ────────────────────────────────────────────────────── */}
        <div className="totals-wrap">
          <div className="totals-box">
            {discount > 0 && (
              <div className="tot-row">
                <span style={{ color: '#666' }}>Descuento ({invoice.discountPercent}%)</span>
                <span style={{ color: '#e5484d' }}>− {fmtQ(discount)}</span>
              </div>
            )}
            <div className="tot-row">
              <span style={{ color: '#666' }}>Subtotal {invoice.facturaExenta ? '(exento)' : '(base sin IVA)'}</span>
              <span>{fmtQ(subtotal)}</span>
            </div>
            {!invoice.facturaExenta && tax > 0 && (
              <div className="tot-row iva">
                <span>IVA (12%)</span>
                <span>{fmtQ(tax)}</span>
              </div>
            )}
            <div className="tot-row grand">
              <span>TOTAL A PAGAR ({invoice.currency ?? 'GTQ'})</span>
              <span>{fmtQ(total)}</span>
            </div>
          </div>
        </div>

        {/* ── NOTAS / TÉRMINOS ───────────────────────────────────────────── */}
        {(invoice.notes || invoice.termsAndConditions) && (
          <div className="section">
            {invoice.notes && (
              <>
                <div className="section-title">Notas</div>
                <div className="section-body">{invoice.notes}</div>
              </>
            )}
            {invoice.termsAndConditions && (
              <div style={{ marginTop: invoice.notes ? 10 : 0 }}>
                <div className="section-title">Términos y condiciones</div>
                <div className="section-body">{invoice.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        {/* ── FEL ticket ─────────────────────────────────────────────────── */}
        {cfg.isTicket && invoice.felUuid && (
          <div className="section" style={{ fontSize: cfg.fontSize - 2 }}>
            {invoice.felAutorizacion && <div><strong>Aut:</strong> {invoice.felAutorizacion}</div>}
            <div style={{ wordBreak: 'break-all' }}><strong>UUID:</strong> {invoice.felUuid}</div>
            {invoice.felUrl && <div style={{ marginTop: 3, wordBreak: 'break-all' }}>{invoice.felUrl}</div>}
          </div>
        )}

        {/* ── PIE ────────────────────────────────────────────────────────── */}
        <div className="footer">
          <span>Lucía — Sistema de Contabilidad</span>
          <span>Impreso: {new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </>
  )
}
