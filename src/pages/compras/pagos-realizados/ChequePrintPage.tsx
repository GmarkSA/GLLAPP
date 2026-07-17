/**
 * Página de impresión de cheque físico Guatemala.
 * Ruta: /bancos/pagos-realizados/:id/cheque  (sin MainLayout)
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
import { useParams, useSearchParams } from 'react-router-dom'
import { getPagoRealizado, getBankPaymentConfigByAccount, type VendorPayment, type PrinterType } from '../../../api/pagosRealizados'
import type { CheckLayoutPositions } from '../../../components/CheckLayoutEditor'

// CPI → font-size pt mapping (monospace chars per inch)
const CPI_FONT: Record<number, string> = {
  10: '11pt',
  12: '9pt',
  15: '7.5pt',
  17: '6.5pt',
  20: '5.5pt',
}

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
  width:      string
  height:     string
  paddingTop: string
  fields: {
    beneficiario: { top: string; left: string; width: string }
    fecha:        { top: string; left: string }
    monto:        { top: string; left: string }
    letras:       { top: string; left: string; width: string }
    firma?:        { top: string; left: string; width?: string; show?: boolean } | null
    noNegociable?: { top: string; left: string; show?: boolean } | null
  }
}

const CHECK_FORMATS: Record<string, CheckFormat> = {
  generic: {
    label: 'Genérico',
    width: '21cm', height: '9cm', paddingTop: '1.2cm',
    fields: {
      beneficiario: { top: '1.6cm', left: '2cm',    width: '14cm' },
      fecha:        { top: '0.8cm', left: '14.5cm' },
      monto:        { top: '1.6cm', left: '17.5cm' },
      letras:       { top: '3.0cm', left: '0.8cm',  width: '18cm' },
    },
  },
  bi: {
    label: 'Banco Industrial (BI)',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.8cm', left: '2.2cm',  width: '13cm' },
      fecha:        { top: '0.9cm', left: '14.5cm' },
      monto:        { top: '1.8cm', left: '17.5cm' },
      letras:       { top: '3.2cm', left: '1.0cm',  width: '17.5cm' },
    },
  },
  bac: {
    label: 'BAC Credomatic',
    width: '21cm', height: '9.5cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '2.0cm', left: '2.5cm',  width: '13cm' },
      fecha:        { top: '1.0cm', left: '14.5cm' },
      monto:        { top: '2.0cm', left: '17.8cm' },
      letras:       { top: '3.5cm', left: '1.2cm',  width: '17.5cm' },
    },
  },
  gt: {
    label: 'G&T Continental',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.9cm', left: '2.0cm',  width: '13.5cm' },
      fecha:        { top: '0.9cm', left: '14.5cm' },
      monto:        { top: '1.9cm', left: '17.5cm' },
      letras:       { top: '3.3cm', left: '1.0cm',  width: '18cm' },
    },
  },
  banrural: {
    label: 'Banrural',
    width: '21cm', height: '9cm', paddingTop: '0',
    fields: {
      beneficiario: { top: '1.7cm', left: '2.0cm',  width: '13cm' },
      fecha:        { top: '0.8cm', left: '14.5cm' },
      monto:        { top: '1.7cm', left: '17.5cm' },
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
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === 'true'
  const [payment,     setPayment]     = useState<VendorPayment | null>(null)
  const [customPos,   setCustomPos]   = useState<CheckLayoutPositions | null>(null)
  const [printerType, setPrinterType] = useState<PrinterType>('matrix')
  const [matrixCpi,   setMatrixCpi]   = useState<number>(10)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getPagoRealizado(id)
      .then(async p => {
        setPayment(p)
        if (p.bankAccountId) {
          try {
            const cfg = await getBankPaymentConfigByAccount(p.bankAccountId)
            if (cfg?.checkFieldPositions) setCustomPos(cfg.checkFieldPositions)
            if (cfg?.printerType) setPrinterType(cfg.printerType)
            if (cfg?.matrixCpi)   setMatrixCpi(cfg.matrixCpi)
          } catch { /* no config = usar defaults */ }
        }
        setLoading(false)
      })
      .catch(() => { setError('No se pudo cargar el pago'); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (payment && !loading && !isPreview) {
      setTimeout(() => window.print(), 600)
    }
  }, [payment, loading, isPreview])

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>
  if (error || !payment) return <div style={{ padding: 40, color: '#e5484d' }}>{error ?? 'Error'}</div>

  const formatKey  = detectFormat(payment.bankName)
  const baseFmt    = CHECK_FORMATS[formatKey]

  // Fusionar posiciones base con overrides del usuario
  const mp = (base: any, over: any) => over ? { ...base, ...over } : base
  const cp     = customPos
  const fmtW   = cp?.width  ?? baseFmt.width
  const fmtH   = cp?.height ?? baseFmt.height
  const fields: CheckFormat['fields'] = {
    beneficiario: mp(baseFmt.fields.beneficiario, cp?.beneficiario),
    fecha:        mp(baseFmt.fields.fecha,        cp?.fecha),
    monto:        mp(baseFmt.fields.monto,        cp?.monto),
    letras:       mp(baseFmt.fields.letras,       cp?.letras),
    firma:        cp?.firma        ?? null,
    noNegociable: cp?.noNegociable ?? null,
  }

  const fmt: CheckFormat = { ...baseFmt, width: fmtW, height: fmtH, fields }
  const amount     = Number(payment.amount)
  const amountStr  = `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
  const letras     = numToWords(amount)
  const date       = new Date(payment.paymentDate)
  const dateStr    = date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const isMatrix   = printerType === 'matrix'
  const monoFont   = "'Courier New', Courier, monospace"
  const propFont   = "'Arial', sans-serif"
  const bodyFont   = isMatrix ? monoFont : propFont
  const fieldSize  = isMatrix ? (CPI_FONT[matrixCpi] ?? '11pt') : '11pt'
  const letrasSize = isMatrix ? (CPI_FONT[matrixCpi] ?? '11pt') : '9.5pt'

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
          font-family: ${bodyFont};
          overflow: hidden;
          ${isMatrix ? 'background: transparent !important;' : ''}
        }
        .field {
          position: absolute;
          font-size: ${fieldSize};
          font-weight: ${isMatrix ? '400' : '600'};
          color: #000;
          white-space: nowrap;
          letter-spacing: ${isMatrix ? '0.05em' : '0.03em'};
          ${isMatrix ? 'text-shadow: none; -webkit-print-color-adjust: exact;' : ''}
        }
        .field-letras {
          font-size: ${letrasSize};
          font-weight: ${isMatrix ? '400' : '500'};
          white-space: normal;
          line-height: ${isMatrix ? '1.2' : '1.3'};
        }
        .field-firma-line {
          border-bottom: 1px solid #000;
          width: 100%;
          margin-top: 10px;
        }
        .field-no-negociable {
          font-size: 7pt;
          font-weight: ${isMatrix ? '400' : '800'};
          letter-spacing: 0.1em;
          border: ${isMatrix ? '1px solid #000' : '1.5px solid #000'};
          padding: 2px 6px;
          border-radius: ${isMatrix ? '0' : '3px'};
          white-space: nowrap;
        }
        .screen-controls {
          padding: 16px;
          background: #1faec2;
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
          color: #1faec2;
          font-weight: 600;
        }
        .screen-controls .printer-badge {
          background: rgba(255,255,255,0.15);
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 12px;
        }
        .check-preview {
          border: 2px dashed #ccc;
          margin: 16px;
          display: inline-block;
        }
        @media print {
          .screen-controls { display: none; }
          .check-preview { border: none; margin: 0; }
          ${isMatrix ? `
            * { -webkit-print-color-adjust: exact; }
            body { background: transparent !important; }
          ` : ''}
        }
      `}</style>

      <div className="screen-controls">
        <span>
          Cheque: <strong>{payment.checkNumber ?? payment.paymentNumber}</strong>
          &nbsp;| Banco: {payment.bankName ?? '(sin banco)'}
          &nbsp;| Formato: {fmt.label}
        </span>
        <span className="printer-badge">
          {isMatrix ? `🖨 Matriz ${matrixCpi} cpi` : '🖨 Láser'}
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

          {/* Firma (opcional — se muestra si show !== false) */}
          {fmt.fields.firma && fmt.fields.firma.show !== false && (
            <div
              className="field"
              style={{
                top:   fmt.fields.firma.top,
                left:  fmt.fields.firma.left,
                width: fmt.fields.firma.width ?? '8cm',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div className="field-firma-line" />
              <span style={{ fontSize: '7pt', fontWeight: 400, marginTop: 2 }}>FIRMA AUTORIZADA</span>
            </div>
          )}

          {/* Sello NO NEGOCIABLE (opcional) */}
          {fmt.fields.noNegociable && fmt.fields.noNegociable.show !== false && (
            <div
              className="field field-no-negociable"
              style={{
                top:  fmt.fields.noNegociable.top,
                left: fmt.fields.noNegociable.left,
              }}
            >
              NO NEGOCIABLE
            </div>
          )}
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
