/**
 * Página de impresión de cheque físico Guatemala.
 * Ruta: /compras/pagos-realizados/:id/cheque  (sin MainLayout)
 *
 * Formatos soportados por banco:
 *   - generic: formato universal (para bancos no configurados)
 *   - bi:      Banco Industrial
 *   - bac:     BAC Credomatic
 *   - gt:      G&T Continental
 *   - banrural: Banrural
 *
 * El cheque preimpreso guatemalteco mide aprox 21 cm × 9 cm.
 * CSS @page garantiza que el browser no añada headers/footers.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPagoRealizado, type VendorPayment } from '../../../api/pagosRealizados'

// ── Conversión de número a letras (quetzales guatemaltecos) ─────────────────────

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve',
]
const DECENAS = [
  '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa',
]
const CENTENAS = [
  '', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

function numToWords(n: number): string {
  const entero = Math.floor(n)
  const cents  = Math.round((n - entero) * 100)

  function grupo(num: number): string {
    if (num === 0) return ''
    if (num < 20)  return UNIDADES[num]
    if (num < 100) {
      const d = Math.floor(num / 10)
      const u = num % 10
      return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
    }
    if (num === 100) return 'cien'
    const c = Math.floor(num / 100)
    const r = num % 100
    return r === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${grupo(r)}`
  }

  function convert(num: number): string {
    if (num === 0) return 'cero'
    if (num === 1000000) return 'un millón'
    if (num > 1000000) {
      const m = Math.floor(num / 1000000)
      const r = num % 1000000
      return `${m === 1 ? 'un' : grupo(m)} millón${m > 1 ? 'es' : ''}${r ? ` ${convert(r)}` : ''}`
    }
    if (num >= 1000) {
      const k = Math.floor(num / 1000)
      const r = num % 1000
      return `${k === 1 ? 'mil' : `${grupo(k)} mil`}${r ? ` ${grupo(r)}` : ''}`
    }
    return grupo(num)
  }

  const centsStr = cents > 0 ? ` con ${String(cents).padStart(2, '0')}/100` : ''
  return `${convert(entero)} quetzales${centsStr}`.toUpperCase()
}

// ── Formatos de cheque por banco ────────────────────────────────────────────────

type CheckFormat = {
  label:      string
  width:      string  // CSS width de la página
  height:     string  // CSS height de la página
  paddingTop: string  // Espacio antes del primer campo
  fields: {
    beneficiario: { top: string; left: string; width: string }
    fecha:        { top: string; left: string }
    monto:        { top: string; left: string }
    letras:       { top: string; left: string; width: string }
  }
}

const CHECK_FORMATS: Record<string, CheckFormat> = {
  generic: {
    label: 'Genérico',
    width: '21cm', height: '9cm', paddingTop: '1.2cm',
    fields: {
      beneficiario: { top: '1.6cm', left: '2cm',   width: '14cm' },
      fecha:        { top: '1.6cm', left: '17cm' },
      monto:        { top: '1.6cm', left: '17.5cm' },
      letras:       { top: '3.0cm', left: '0.8cm', width: '18cm' },
    },
  },
  bi: {
    label: 'Banco Industrial (BI)',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.8cm', left: '2.2cm',  width: '13cm' },
      fecha:        { top: '1.8cm', left: '16.5cm' },
      monto:        { top: '1.8cm', left: '18.0cm' },
      letras:       { top: '3.2cm', left: '1.0cm',  width: '17.5cm' },
    },
  },
  bac: {
    label: 'BAC Credomatic',
    width: '21cm', height: '9.5cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '2.0cm', left: '2.5cm',  width: '13cm' },
      fecha:        { top: '2.0cm', left: '16.8cm' },
      monto:        { top: '2.0cm', left: '18.2cm' },
      letras:       { top: '3.5cm', left: '1.2cm',  width: '17.5cm' },
    },
  },
  gt: {
    label: 'G&T Continental',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.9cm', left: '2.0cm',  width: '13.5cm' },
      fecha:        { top: '1.9cm', left: '16.8cm' },
      monto:        { top: '1.9cm', left: '18.0cm' },
      letras:       { top: '3.3cm', left: '1.0cm',  width: '18cm' },
    },
  },
  banrural: {
    label: 'Banrural',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.7cm', left: '2.0cm',  width: '13cm' },
      fecha:        { top: '1.7cm', left: '16.5cm' },
      monto:        { top: '1.7cm', left: '18.0cm' },
      letras:       { top: '3.1cm', left: '0.8cm',  width: '17.8cm' },
    },
  },
}

function detectFormat(bankName?: string): string {
  if (!bankName) return 'generic'
  const b = bankName.toLowerCase()
  if (b.includes('industrial') || b.includes(' bi ') || b === 'bi') return 'bi'
  if (b.includes('bac'))                                              return 'bac'
  if (b.includes('g&t') || b.includes('continental'))                return 'gt'
  if (b.includes('banrural') || b.includes('rural'))                 return 'banrural'
  return 'generic'
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function ChequePrintPage() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<VendorPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getPagoRealizado(id)
      .then(p => { setPayment(p); setLoading(false) })
      .catch(() => { setError('No se pudo cargar el pago'); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (payment && !loading) {
      setTimeout(() => window.print(), 600)
    }
  }, [payment, loading])

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>
  if (error || !payment) return <div style={{ padding: 40, color: 'red' }}>{error ?? 'Error'}</div>

  const formatKey  = detectFormat(payment.bankName)
  const fmt        = CHECK_FORMATS[formatKey]
  const amount     = Number(payment.amount)
  const amountStr  = `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
  const letras     = numToWords(amount)
  const date       = new Date(payment.paymentDate)
  const dateStr    = date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <>
      <style>{`
        @page {
          size: ${fmt.width} ${fmt.height};
          margin: 0;
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: white; }
        .check-wrap {
          position: relative;
          width: ${fmt.width};
          height: ${fmt.height};
          font-family: 'Arial', sans-serif;
          overflow: hidden;
        }
        .field {
          position: absolute;
          font-size: 11pt;
          font-weight: 600;
          color: #000;
          white-space: nowrap;
          letter-spacing: 0.03em;
        }
        .field-letras {
          font-size: 9.5pt;
          font-weight: 500;
          white-space: normal;
          line-height: 1.3;
        }
        .screen-controls {
          padding: 16px;
          background: #1B3A6B;
          color: white;
          display: flex;
          gap: 12px;
          align-items: center;
          font-family: Arial, sans-serif;
        }
        .screen-controls button {
          padding: 6px 16px;
          cursor: pointer;
          border: none;
          border-radius: 4px;
          background: white;
          color: #1B3A6B;
          font-weight: 600;
        }
        .check-preview {
          border: 2px dashed #ccc;
          margin: 16px;
          display: inline-block;
        }
        @media print {
          .screen-controls { display: none; }
          .check-preview { border: none; margin: 0; }
        }
      `}</style>

      <div className="screen-controls">
        <span>
          Cheque: <strong>{payment.checkNumber ?? payment.paymentNumber}</strong>
          &nbsp;| Banco: {payment.bankName ?? '(sin banco)'}
          &nbsp;| Formato: {fmt.label}
        </span>
        <button onClick={() => window.print()}>🖨 Imprimir</button>
        <button onClick={() => window.close()}>✕ Cerrar</button>
      </div>

      <div className="check-preview">
        <div className="check-wrap">
          {/* Beneficiario */}
          <div
            className="field"
            style={{
              top:   fmt.fields.beneficiario.top,
              left:  fmt.fields.beneficiario.left,
              width: fmt.fields.beneficiario.width,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {payment.vendorName ?? ''}
          </div>

          {/* Fecha */}
          <div className="field" style={{ top: fmt.fields.fecha.top, left: fmt.fields.fecha.left }}>
            {dateStr}
          </div>

          {/* Monto numérico */}
          <div className="field" style={{ top: fmt.fields.monto.top, left: fmt.fields.monto.left }}>
            {amountStr}
          </div>

          {/* Monto en letras */}
          <div
            className="field field-letras"
            style={{
              top:   fmt.fields.letras.top,
              left:  fmt.fields.letras.left,
              width: fmt.fields.letras.width,
            }}
          >
            {letras} ****
          </div>
        </div>
      </div>

      {/* Metadata de referencia — solo pantalla */}
      <div style={{ padding: '0 16px 16px', fontFamily: 'Arial', fontSize: 12, color: '#555', display: 'none' }}
           className="screen-only">
        <p>
          <strong>Pago:</strong> {payment.paymentNumber} &nbsp;|&nbsp;
          <strong>Facturas:</strong>{' '}
          {payment.appliedInvoices?.map(a => a.invoiceNumber).join(', ')
           ?? payment.purchaseInvoiceId ?? '—'}
        </p>
      </div>
    </>
  )
}
