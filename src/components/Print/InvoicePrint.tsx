/**
 * InvoicePrint — Componente de impresión de factura.
 *
 * Se oculta en pantalla y aparece solo en @media print.
 * Se adapta automáticamente al formato seleccionado (carta, media carta, ticket).
 */
import type { Invoice } from '../../api/facturas'
import type { OrganizationProfile } from '../../api/configuracion'
import type { PrintFormatId } from './printFormats'
import { PRINT_FORMATS } from './printFormats'

const fmt = (n: any) =>
  Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

interface Props {
  invoice:    Invoice
  company:    OrganizationProfile
  formatId:   PrintFormatId
}

export default function InvoicePrint({ invoice, company, formatId }: Props) {
  const format = PRINT_FORMATS.find(f => f.id === formatId) ?? PRINT_FORMATS[0]
  const fs     = format.fontSize
  const isTicket = format.isTicket

  const subtotal = Number(invoice.subtotal ?? 0)
  const tax      = Number(invoice.taxAmount ?? 0)
  const discount = Number(invoice.discountAmount ?? 0)
  const total    = Number(invoice.total ?? 0)

  /* ── Estilos base ────────────────────────────────────────────────────────── */
  const root: React.CSSProperties = {
    fontFamily:  "'Arial', sans-serif",
    fontSize:    fs,
    color:       '#000',
    lineHeight:  1.4,
    width:       '100%',
  }

  const divider: React.CSSProperties = {
    borderTop:  '1px solid #999',
    margin:     `${fs * 0.5}px 0`,
  }

  const doubleDivider: React.CSSProperties = {
    borderTop:  '2px solid #000',
    margin:     `${fs * 0.5}px 0`,
  }

  /* ── Ticket layout ───────────────────────────────────────────────────────── */
  if (isTicket) {
    return (
      <div id="invoice-print-area" style={root}>
        {/* Encabezado empresa */}
        <div style={{ textAlign: 'center', marginBottom: fs * 0.6 }}>
          {company.logoUrl && (
            <img src={company.logoUrl} alt="Logo"
              style={{ maxWidth: '60%', maxHeight: 40, marginBottom: 4, objectFit: 'contain' }} />
          )}
          <div style={{ fontWeight: 700, fontSize: fs + 1 }}>{company.name}</div>
          {company.taxId && <div>NIT: {company.taxId}</div>}
          {company.address && <div style={{ fontSize: fs - 1 }}>{company.address}</div>}
          {company.phone && <div style={{ fontSize: fs - 1 }}>Tel: {company.phone}</div>}
        </div>

        <div style={doubleDivider} />

        {/* Tipo de documento */}
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: fs + 2, marginBottom: 2 }}>
          {invoice.facturaExenta ? 'FACTURA EXENTA' : 'FACTURA CAMBIARIA'}
          {invoice.felTipoDocumento && invoice.felTipoDocumento !== 'FACT' && ` — ${invoice.felTipoDocumento}`}
        </div>
        {invoice.felSerie && invoice.felNumero && (
          <div style={{ textAlign: 'center', fontSize: fs - 1 }}>
            Serie: {invoice.felSerie} &nbsp; No.: {invoice.felNumero}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: fs - 1 }}>
          {invoice.invoiceNumber}
        </div>
        <div style={{ textAlign: 'center', fontSize: fs - 1 }}>
          Fecha: {fmtDate(invoice.invoiceDate)}
          {invoice.dueDate && ` — Vence: ${fmtDate(invoice.dueDate)}`}
        </div>

        <div style={divider} />

        {/* Cliente */}
        <div style={{ marginBottom: fs * 0.4 }}>
          <div><strong>Cliente:</strong> {invoice.customerName}</div>
          {invoice.customerTaxId && <div><strong>NIT:</strong> {invoice.customerTaxId}</div>}
        </div>

        <div style={divider} />

        {/* Líneas */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
          <tbody>
            {(invoice.items ?? []).map((item, i) => (
              <tr key={i}>
                <td style={{ paddingBottom: fs * 0.4, verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 500 }}>{item.description}</div>
                  <div style={{ fontSize: fs - 1, color: '#444' }}>
                    {item.quantity} × Q {fmt(item.unitPrice)}
                    {item.discountPercent > 0 && ` (−${item.discountPercent}%)`}
                  </div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', fontWeight: 600, paddingBottom: fs * 0.4 }}>
                  Q {fmt(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={doubleDivider} />

        {/* Totales */}
        <table style={{ width: '100%', fontSize: fs }}>
          <tbody>
            {discount > 0 && (
              <tr>
                <td>Descuento</td>
                <td style={{ textAlign: 'right' }}>−Q {fmt(discount)}</td>
              </tr>
            )}
            <tr>
              <td>Subtotal (base)</td>
              <td style={{ textAlign: 'right' }}>Q {fmt(subtotal)}</td>
            </tr>
            {!invoice.facturaExenta && tax > 0 && (
              <tr>
                <td>IVA (12%)</td>
                <td style={{ textAlign: 'right' }}>Q {fmt(tax)}</td>
              </tr>
            )}
            <tr style={{ fontWeight: 700, fontSize: fs + 3 }}>
              <td style={{ paddingTop: 4 }}>TOTAL</td>
              <td style={{ textAlign: 'right', paddingTop: 4 }}>Q {fmt(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* FEL */}
        {invoice.felUuid && (
          <>
            <div style={divider} />
            <div style={{ fontSize: fs - 2, wordBreak: 'break-all' }}>
              <div><strong>UUID:</strong> {invoice.felUuid}</div>
              {invoice.felAutorizacion && <div><strong>Aut:</strong> {invoice.felAutorizacion}</div>}
              {invoice.felUrl && <div style={{ marginTop: 2 }}>{invoice.felUrl}</div>}
            </div>
          </>
        )}

        {/* Notas */}
        {invoice.notes && (
          <>
            <div style={divider} />
            <div style={{ fontSize: fs - 1 }}>{invoice.notes}</div>
          </>
        )}

        <div style={divider} />
        <div style={{ textAlign: 'center', fontSize: fs - 1, color: '#555' }}>
          ¡Gracias por su compra!
        </div>
        <div style={{ textAlign: 'center', fontSize: fs - 2, color: '#aaa', marginTop: 2 }}>
          Lucía — Sistema de Contabilidad
        </div>
      </div>
    )
  }

  /* ── Carta / Media Carta layout ──────────────────────────────────────────── */
  return (
    <div id="invoice-print-area" style={root}>
      {/* ── ENCABEZADO ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fs * 1.2 }}>
        {/* Logo + empresa */}
        <div style={{ flex: 1 }}>
          {company.logoUrl && (
            <img src={company.logoUrl} alt="Logo"
              style={{ maxHeight: 50, maxWidth: 160, marginBottom: 6, objectFit: 'contain' }} />
          )}
          <div style={{ fontWeight: 700, fontSize: fs + 2 }}>{company.name}</div>
          {company.taxId && <div style={{ fontSize: fs - 1 }}>NIT: {company.taxId}</div>}
          {company.address && <div style={{ fontSize: fs - 1 }}>{company.address}</div>}
          {company.phone && <div style={{ fontSize: fs - 1 }}>Tel: {company.phone}</div>}
          {company.email && <div style={{ fontSize: fs - 1 }}>{company.email}</div>}
          {invoice.lugarExpedicion && (
            <div style={{ fontSize: fs - 1 }}>Lugar: {invoice.lugarExpedicion}</div>
          )}
        </div>

        {/* Tipo + número documento */}
        <div style={{ textAlign: 'right', minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: fs + 5, textTransform: 'uppercase', letterSpacing: 1 }}>
            {invoice.facturaExenta ? 'Factura Exenta' : 'Factura Cambiaria'}
          </div>
          {invoice.felTipoDocumento && invoice.felTipoDocumento !== 'FACT' && (
            <div style={{ fontSize: fs - 1, color: '#555' }}>Tipo: {invoice.felTipoDocumento}</div>
          )}
          <div style={{ fontSize: fs, marginTop: 4 }}>
            <strong>No. </strong>{invoice.invoiceNumber}
          </div>
          {invoice.felSerie && invoice.felNumero && (
            <div style={{ fontSize: fs - 1 }}>
              Serie: {invoice.felSerie} &nbsp;|&nbsp; Núm. SAT: {invoice.felNumero}
            </div>
          )}
          <div style={{ fontSize: fs - 1, marginTop: 4 }}>
            Fecha: <strong>{fmtDate(invoice.invoiceDate)}</strong>
          </div>
          {invoice.dueDate && (
            <div style={{ fontSize: fs - 1 }}>
              Vencimiento: <strong>{fmtDate(invoice.dueDate)}</strong>
            </div>
          )}
          {invoice.currency && invoice.currency !== 'GTQ' && (
            <div style={{ fontSize: fs - 1 }}>Moneda: {invoice.currency}</div>
          )}
        </div>
      </div>

      <div style={doubleDivider} />

      {/* ── DATOS CLIENTE + FEL ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, marginBottom: fs * 1 }}>
        {/* Cliente */}
        <div style={{ flex: 1, background: '#f9f9f9', padding: `${fs * 0.5}px ${fs * 0.8}px`, borderRadius: 4 }}>
          <div style={{ fontWeight: 700, fontSize: fs - 1, textTransform: 'uppercase', marginBottom: 4, color: '#555' }}>
            Facturar a:
          </div>
          <div style={{ fontWeight: 600, fontSize: fs + 1 }}>{invoice.customerName}</div>
          {invoice.customerTaxId && <div style={{ fontSize: fs - 1 }}>NIT: {invoice.customerTaxId}</div>}
          {invoice.purchaseOrderRef && (
            <div style={{ fontSize: fs - 1 }}>Ref. PO: {invoice.purchaseOrderRef}</div>
          )}
        </div>

        {/* FEL data */}
        {(invoice.felUuid || invoice.felAutorizacion) && (
          <div style={{ flex: 1, background: '#fafbfc', padding: `${fs * 0.5}px ${fs * 0.8}px`, borderRadius: 4, border: '1px solid #d6e4ff' }}>
            <div style={{ fontWeight: 700, fontSize: fs - 1, textTransform: 'uppercase', marginBottom: 4, color: '#1faec2' }}>
              Certificación FEL — SAT Guatemala
            </div>
            {invoice.felSerie && (
              <div style={{ fontSize: fs - 1 }}>
                <strong>Serie:</strong> {invoice.felSerie} &nbsp; <strong>Número:</strong> {invoice.felNumero}
              </div>
            )}
            {invoice.felAutorizacion && (
              <div style={{ fontSize: fs - 1 }}><strong>Autorización:</strong> {invoice.felAutorizacion}</div>
            )}
            {invoice.felUuid && (
              <div style={{ fontSize: fs - 2, wordBreak: 'break-all', marginTop: 2 }}>
                <strong>UUID:</strong> {invoice.felUuid}
              </div>
            )}
            {invoice.felCertificadaAt && (
              <div style={{ fontSize: fs - 2 }}>
                <strong>Certificada:</strong> {fmtDate(invoice.felCertificadaAt)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TABLA DE LÍNEAS ────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs, marginBottom: fs }}>
        <thead>
          <tr style={{ background: '#1faec2', color: '#fff' }}>
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'left',  width: 28  }}>#</th>
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'left'           }}>Descripción</th>
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'center', width: 50 }}>Unidad</th>
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right',  width: 50 }}>Cant.</th>
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right',  width: 80 }}>Precio</th>
            {(invoice.items ?? []).some(i => i.discountPercent > 0) && (
              <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right', width: 50 }}>Desc.%</th>
            )}
            <th style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right',  width: 90 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items ?? []).map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', pageBreakInside: 'avoid' }}>
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, color: '#6b7280', textAlign: 'right' }}>
                {i + 1}
              </td>
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px` }}>
                <div style={{ fontWeight: 500 }}>{item.description}</div>
              </td>
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'center', color: '#555' }}>
                {item.unit || '—'}
              </td>
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right' }}>
                {fmt(item.quantity)}
              </td>
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right' }}>
                Q {fmt(item.unitPrice)}
              </td>
              {(invoice.items ?? []).some(it => it.discountPercent > 0) && (
                <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right', color: '#d48806' }}>
                  {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                </td>
              )}
              <td style={{ padding: `${fs * 0.4}px ${fs * 0.6}px`, textAlign: 'right', fontWeight: 600 }}>
                Q {fmt(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTALES ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: fs * 1.2 }}>
        <table style={{ fontSize: fs, minWidth: 240 }}>
          <tbody>
            {discount > 0 && (
              <tr>
                <td style={{ padding: `2px ${fs * 0.5}px`, color: '#555' }}>Descuento ({invoice.discountPercent}%)</td>
                <td style={{ padding: `2px ${fs * 0.5}px`, textAlign: 'right', color: '#d48806' }}>−Q {fmt(discount)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: `2px ${fs * 0.5}px`, color: '#555' }}>
                Subtotal {invoice.facturaExenta ? '(exento)' : '(base sin IVA)'}
              </td>
              <td style={{ padding: `2px ${fs * 0.5}px`, textAlign: 'right' }}>Q {fmt(subtotal)}</td>
            </tr>
            {!invoice.facturaExenta && tax > 0 && (
              <tr>
                <td style={{ padding: `2px ${fs * 0.5}px`, color: '#1faec2', fontWeight: 500 }}>IVA (12%)</td>
                <td style={{ padding: `2px ${fs * 0.5}px`, textAlign: 'right', color: '#1faec2', fontWeight: 500 }}>
                  Q {fmt(tax)}
                </td>
              </tr>
            )}
            <tr style={{ background: '#1faec2', color: '#fff' }}>
              <td style={{ padding: `${fs * 0.5}px ${fs * 0.8}px`, fontWeight: 700, fontSize: fs + 2 }}>
                TOTAL A PAGAR ({invoice.currency ?? 'GTQ'})
              </td>
              <td style={{ padding: `${fs * 0.5}px ${fs * 0.8}px`, textAlign: 'right', fontWeight: 700, fontSize: fs + 3 }}>
                Q {fmt(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── NOTAS / TÉRMINOS ───────────────────────────────────────────────── */}
      {(invoice.notes || invoice.termsAndConditions) && (
        <div style={{ display: 'flex', gap: 24, fontSize: fs - 1, marginBottom: fs }}>
          {invoice.notes && (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Notas:</div>
              <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.termsAndConditions && (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Términos y Condiciones:</div>
              <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{invoice.termsAndConditions}</div>
            </div>
          )}
        </div>
      )}

      {/* ── FEL URL verificación ───────────────────────────────────────────── */}
      {invoice.felUrl && (
        <>
          <div style={divider} />
          <div style={{ fontSize: fs - 2, color: '#666', textAlign: 'center' }}>
            Verificar en: {invoice.felUrl}
          </div>
        </>
      )}

      {/* ── PIE ────────────────────────────────────────────────────────────── */}
      <div style={{ ...divider }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fs - 2, color: '#6b7280' }}>
        <span>Documento generado con Lucía</span>
        <span>Impreso: {new Date().toLocaleDateString('es-GT')}</span>
      </div>
    </div>
  )
}
