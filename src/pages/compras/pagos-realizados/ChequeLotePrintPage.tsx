/**
 * Impresión en lote de cheques.
 * Ruta: /bancos/cheques/imprimir-lote?ids=id1,id2,...  (sin MainLayout)
 *
 * Carga todos los pagos indicados, renderiza un cheque por "página CSS"
 * con page-break-after: always, y lanza window.print() una sola vez.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPagoRealizado, getBankPaymentConfigByAccount, type VendorPayment, type PrinterType } from '../../../api/pagosRealizados'
import type { CheckLayoutPositions } from '../../../components/CheckLayoutEditor'

const CPI_FONT: Record<number, string> = {
  10: '11pt', 12: '9pt', 15: '7.5pt', 17: '6.5pt', 20: '5.5pt',
}

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve',
]
const DECENAS  = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function numToWords(n: number): string {
  const entero = Math.floor(n)
  const cents  = Math.round((n - entero) * 100)
  function grupo(num: number): string {
    if (num === 0) return ''
    if (num < 20)  return UNIDADES[num]
    if (num < 100) { const d = Math.floor(num / 10); const u = num % 10; return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}` }
    if (num === 100) return 'cien'
    const c = Math.floor(num / 100); const r = num % 100
    return r === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${grupo(r)}`
  }
  function convert(num: number): string {
    if (num === 0) return 'cero'
    if (num === 1000000) return 'un millón'
    if (num > 1000000) { const m = Math.floor(num / 1000000); const r = num % 1000000; return `${m === 1 ? 'un' : grupo(m)} millón${m > 1 ? 'es' : ''}${r ? ` ${convert(r)}` : ''}` }
    if (num >= 1000) { const k = Math.floor(num / 1000); const r = num % 1000; return `${k === 1 ? 'mil' : `${grupo(k)} mil`}${r ? ` ${grupo(r)}` : ''}` }
    return grupo(num)
  }
  const centsStr = cents > 0 ? ` con ${String(cents).padStart(2, '0')}/100` : ''
  return `${convert(entero)} quetzales${centsStr}`.toUpperCase()
}

type CheckFormat = {
  label: string; width: string; height: string; paddingTop: string
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
  generic:  { label: 'Genérico',              width: '21cm', height: '9cm',   paddingTop: '1.2cm', fields: { beneficiario: { top: '1.6cm', left: '2cm',   width: '14cm'  }, fecha: { top: '0.8cm', left: '14.5cm' }, monto: { top: '1.6cm', left: '17.5cm' }, letras: { top: '3.0cm', left: '0.8cm', width: '18cm'   } } },
  bi:       { label: 'Banco Industrial (BI)', width: '21cm', height: '9cm',   paddingTop: '0',     fields: { beneficiario: { top: '1.8cm', left: '2.2cm', width: '13cm'  }, fecha: { top: '0.9cm', left: '14.5cm' }, monto: { top: '1.8cm', left: '17.5cm' }, letras: { top: '3.2cm', left: '1.0cm', width: '17.5cm' } } },
  bac:      { label: 'BAC Credomatic',        width: '21cm', height: '9.5cm', paddingTop: '0',     fields: { beneficiario: { top: '2.0cm', left: '2.5cm', width: '13cm'  }, fecha: { top: '1.0cm', left: '14.5cm' }, monto: { top: '2.0cm', left: '17.8cm' }, letras: { top: '3.5cm', left: '1.2cm', width: '17.5cm' } } },
  gt:       { label: 'G&T Continental',       width: '21cm', height: '9cm',   paddingTop: '0',     fields: { beneficiario: { top: '1.9cm', left: '2.0cm', width: '13.5cm' }, fecha: { top: '0.9cm', left: '14.5cm' }, monto: { top: '1.9cm', left: '17.5cm' }, letras: { top: '3.3cm', left: '1.0cm', width: '18cm'   } } },
  banrural: { label: 'Banrural',              width: '21cm', height: '9cm',   paddingTop: '0',     fields: { beneficiario: { top: '1.7cm', left: '2.0cm', width: '13cm'  }, fecha: { top: '0.8cm', left: '14.5cm' }, monto: { top: '1.7cm', left: '17.5cm' }, letras: { top: '3.1cm', left: '0.8cm', width: '17.8cm' } } },
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

interface CheckData {
  payment:     VendorPayment
  customPos:   CheckLayoutPositions | null
  printerType: PrinterType
  matrixCpi:   number
}

export default function ChequeLotePrintPage() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)

  const [checks,  setChecks]  = useState<CheckData[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (ids.length === 0) { setError('No se indicaron IDs de cheques'); setLoading(false); return }
    Promise.all(
      ids.map(async (id): Promise<CheckData> => {
        const payment = await getPagoRealizado(id)
        let customPos:   CheckLayoutPositions | null = null
        let printerType: PrinterType = 'matrix'
        let matrixCpi   = 10
        if (payment.bankAccountId) {
          try {
            const cfg = await getBankPaymentConfigByAccount(payment.bankAccountId)
            if (cfg?.checkFieldPositions) customPos   = cfg.checkFieldPositions
            if (cfg?.printerType)         printerType = cfg.printerType
            if (cfg?.matrixCpi)           matrixCpi   = cfg.matrixCpi
          } catch { /* sin config */ }
        }
        return { payment, customPos, printerType, matrixCpi }
      })
    )
      .then(results => { setChecks(results); setLoading(false) })
      .catch(() => { setError('Error al cargar los cheques'); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!loading && checks.length > 0) {
      setTimeout(() => window.print(), 800)
    }
  }, [loading, checks])

  if (loading) return <div style={{ padding: 40, fontFamily: 'Arial' }}>Cargando {ids.length} cheque{ids.length > 1 ? 's' : ''}…</div>
  if (error)   return <div style={{ padding: 40, color: '#e5484d', fontFamily: 'Arial' }}>{error}</div>

  // Determinar el formato del primer cheque para la regla @page
  const firstFmt = CHECK_FORMATS[detectFormat(checks[0]?.payment.bankName)] ?? CHECK_FORMATS.generic

  return (
    <>
      <style>{`
        @page {
          size: ${firstFmt.width} ${firstFmt.height};
          margin: 0;
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: white; }
        .check-page {
          position: relative;
          page-break-after: always;
          break-after: page;
        }
        .check-page:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
        .check-wrap {
          position: relative;
          overflow: hidden;
        }
        .field {
          position: absolute;
          color: #000;
          white-space: nowrap;
          letter-spacing: 0.05em;
        }
        .field-letras {
          white-space: normal;
          line-height: 1.2;
        }
        .screen-controls {
          padding: 16px;
          background: #1faec2;
          color: white;
          display: flex;
          gap: 12px;
          align-items: center;
          font-family: Arial, sans-serif;
          flex-wrap: wrap;
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
        @media print {
          .screen-controls { display: none; }
          .check-page { border: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="screen-controls">
        <span style={{ fontWeight: 600 }}>
          Impresión en lote — {checks.length} cheque{checks.length > 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          {checks.map(c => c.payment.checkNumber ?? c.payment.paymentNumber).join(' · ')}
        </span>
        <button onClick={() => window.print()}>🖨 Imprimir todos</button>
        <button onClick={() => window.close()}>✕ Cerrar</button>
      </div>

      {checks.map(({ payment, customPos, printerType, matrixCpi }, idx) => {
        const formatKey  = detectFormat(payment.bankName)
        const baseFmt    = CHECK_FORMATS[formatKey]
        const mp = (base: any, over: any) => over ? { ...base, ...over } : base
        const cp = customPos
        const fmtW = cp?.width  ?? baseFmt.width
        const fmtH = cp?.height ?? baseFmt.height
        const fields: CheckFormat['fields'] = {
          beneficiario: mp(baseFmt.fields.beneficiario, cp?.beneficiario),
          fecha:        mp(baseFmt.fields.fecha,        cp?.fecha),
          monto:        mp(baseFmt.fields.monto,        cp?.monto),
          letras:       mp(baseFmt.fields.letras,       cp?.letras),
          firma:        cp?.firma        ?? null,
          noNegociable: cp?.noNegociable ?? null,
        }
        const fmt: CheckFormat = { ...baseFmt, width: fmtW, height: fmtH, fields }

        const amount    = Number(payment.amount)
        const amountStr = `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
        const letras    = numToWords(amount)
        const date      = new Date(payment.paymentDate)
        const dateStr   = date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })

        const isMatrix   = printerType === 'matrix'
        const monoFont   = "'Courier New', Courier, monospace"
        const propFont   = "'Arial', sans-serif"
        const bodyFont   = isMatrix ? monoFont : propFont
        const fieldSize  = isMatrix ? (CPI_FONT[matrixCpi] ?? '11pt') : '11pt'
        const letrasSize = isMatrix ? (CPI_FONT[matrixCpi] ?? '11pt') : '9.5pt'

        return (
          <div
            key={payment.id}
            className="check-page"
            style={{ margin: '16px', border: '2px dashed #ccc' }}
          >
            <div
              className="check-wrap"
              style={{
                width:      fmt.width,
                height:     fmt.height,
                fontFamily: bodyFont,
              }}
            >
              {/* Nro de cheque en pantalla (no imprime) */}
              <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 9, color: '#aaa', fontFamily: 'Arial' }}
                   className="screen-only">
                #{idx + 1} — {payment.checkNumber ?? payment.paymentNumber}
              </div>

              <div className="field" style={{ top: fields.beneficiario.top, left: fields.beneficiario.left, width: fields.beneficiario.width, fontSize: fieldSize, fontWeight: isMatrix ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {payment.vendorName ?? ''}
              </div>

              <div className="field" style={{ top: fields.fecha.top, left: fields.fecha.left, fontSize: fieldSize, fontWeight: isMatrix ? 400 : 600 }}>
                {dateStr}
              </div>

              <div className="field" style={{ top: fields.monto.top, left: fields.monto.left, fontSize: fieldSize, fontWeight: isMatrix ? 400 : 600 }}>
                {amountStr}
              </div>

              <div className="field field-letras" style={{ top: fields.letras.top, left: fields.letras.left, width: fields.letras.width, fontSize: letrasSize, fontWeight: isMatrix ? 400 : 500 }}>
                {letras} ****
              </div>

              {fields.firma && fields.firma.show !== false && (
                <div className="field" style={{ top: fields.firma.top, left: fields.firma.left, width: fields.firma.width ?? '8cm', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: fieldSize }}>
                  <div style={{ borderBottom: '1px solid #000', width: '100%', marginTop: 10 }} />
                  <span style={{ fontSize: '7pt', fontWeight: 400, marginTop: 2 }}>FIRMA AUTORIZADA</span>
                </div>
              )}

              {fields.noNegociable && fields.noNegociable.show !== false && (
                <div className="field" style={{ top: fields.noNegociable.top, left: fields.noNegociable.left, fontSize: '7pt', fontWeight: isMatrix ? 400 : 800, letterSpacing: '0.1em', border: `${isMatrix ? 1 : 1.5}px solid #000`, padding: '2px 6px', borderRadius: isMatrix ? 0 : 3, whiteSpace: 'nowrap' }}>
                  NO NEGOCIABLE
                </div>
              )}
            </div>
          </div>
        )
      })}

      <style>{`
        @media print {
          .screen-only { display: none !important; }
        }
      `}</style>
    </>
  )
}
