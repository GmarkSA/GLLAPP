import type { EmpresaInfo } from '../../api/reportes'

const fmt = (n: number) =>
  (n ?? 0) === 0 ? '—' : (n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })

const fmtD = (v: string) =>
  v ? new Date(v + 'T12:00:00').toLocaleDateString('es-GT') : '—'

const ROWS_PER_PAGE = 20

// ── CSS carta ─────────────────────────────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter landscape; margin: 0.8cm 1cm; }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #000; background: #fff; }

  .page { page-break-after: always; width: 100%; }
  .page:last-child { page-break-after: avoid; }

  /* ── Encabezado ── */
  .header { border-bottom: 2px solid #1B3A6B; padding-bottom: 6px; margin-bottom: 7px;
            display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left .company  { font-size: 10pt; font-weight: 700; color: #1B3A6B; }
  .header-left .legal    { font-size: 8.5pt; color: #374151; margin-top: 1px; }
  .header-left .nit      { font-size: 8.5pt; color: #4b5563; margin-top: 1px; }
  .header-left .rptname  { font-size: 8.5pt; font-weight: 600; color: #374151; margin-top: 3px; }
  .header-left .period   { font-size: 7.5pt; color: #6b7280; margin-top: 1px; }
  .header-right          { text-align: right; }
  .header-right .moneda  { font-size: 8pt; color: #6b7280; margin-bottom: 4px; }
  .folio-box { border: 1.5px solid #1B3A6B; border-radius: 4px; padding: 3px 10px; display: inline-block; min-width: 70px; }
  .folio-box .flabel { font-size: 6.5pt; color: #9aa1ab; text-transform: uppercase; letter-spacing: 1px; }
  .folio-box .fvalue { font-size: 13pt; font-weight: 800; color: #1B3A6B; font-family: monospace; text-align: center; }

  /* ── Tabla ── */
  .base-header { background: #1B3A6B; color: #fff; font-size: 6.5pt; font-weight: 700;
                 padding: 2px 5px; border-radius: 3px 3px 0 0; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead tr th { background: #1B3A6B; color: #fff; font-size: 6.5pt; font-weight: 600;
                padding: 3px 3px; text-align: left; border: 1px solid #254a8a;
                word-break: break-word; white-space: normal; }
  thead tr th.r { text-align: right; }
  tbody tr td { font-size: 7pt; padding: 2px 3px; border-bottom: 1px solid #e5e7eb;
                word-break: break-word; white-space: normal; vertical-align: top; }
  tbody tr td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) td { background: #f5f7fa; }

  /* ── Fila de totales ── */
  .totals-row td { font-size: 7pt; font-weight: 700; padding: 3px 3px;
                   background: #e0e7f5; border-top: 2px solid #1B3A6B; }
  .totals-row td.r { text-align: right; color: #1B3A6B; font-variant-numeric: tabular-nums; }

  /* ── Resumen ── */
  .resumen { margin-top: 12px; }
  .resumen h3 { font-size: 8.5pt; font-weight: 700; color: #1B3A6B; margin-bottom: 5px; }
  .resumen table { table-layout: auto; width: auto; min-width: 400px; }
  .resumen thead tr th { font-size: 7.5pt; padding: 4px 8px; }
  .resumen tbody tr td { font-size: 7.5pt; padding: 3px 8px; }
  .resumen tfoot tr td { font-size: 7.5pt; padding: 4px 8px; background: #1B3A6B; color: #fff; font-weight: 700; }

  /* ── Pie de página ── */
  .page-footer { margin-top: 5px; font-size: 6.5pt; color: #9aa1ab;
                 text-align: right; border-top: 1px solid #e5e7eb; padding-top: 3px; }
`

// ── Tipos públicos ─────────────────────────────────────────────────────────────
export interface LibroColumn {
  key:   string
  label: string
}

export interface LibroRow {
  folio:         number
  tipoDocumento: string
  fecha:         string
  felSerie:      string
  felNumero:     string
  referencia:    string
  nitParty:      string
  nombreParty:   string
  values:        number[]   // un valor por cada columna activa (mismo orden)
  idp?:          number
  turismo?:      number
  iva:           number
  total:         number
}

export interface LibroTotals {
  values:   number[]
  idp?:     number
  turismo?: number
  iva:      number
  total:    number
}

export interface LibroResumenRow {
  label:    string
  cantidad: number
  base:     number
  iva:      number
  total:    number
}

interface PrintLibroOptions {
  empresa:     EmpresaInfo | null
  reportName:  string
  period:      string
  folioInicio: number
  folioFin:    number
  nitLabel:    string
  nombreLabel: string
  columns:     LibroColumn[]
  rows:        LibroRow[]
  totals:      LibroTotals
  resumen:     LibroResumenRow[]
  hasIdp?:     boolean
  hasTurismo?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildHeaderCells(cols: LibroColumn[], nitLabel: string, nombreLabel: string, hasIdp: boolean, hasTurismo: boolean, colW: Record<string, string>) {
  return [
    `<th style="width:${colW.no}">No.</th>`,
    `<th style="width:${colW.tipo}">Tipo Doc.</th>`,
    `<th style="width:${colW.fecha}">Fecha</th>`,
    `<th style="width:${colW.serie}">Serie</th>`,
    `<th style="width:${colW.ndoc}">No. Documento</th>`,
    `<th style="width:${colW.nit}">${nitLabel}</th>`,
    `<th style="width:${colW.nombre}">${nombreLabel}</th>`,
    ...cols.map(c => `<th class="r" style="width:${colW.base}">${c.label}</th>`),
    ...(hasIdp     ? [`<th class="r" style="width:${colW.idp}">IDP</th>`]         : []),
    ...(hasTurismo ? [`<th class="r" style="width:${colW.idp}">Turismo</th>`]     : []),
    `<th class="r" style="width:${colW.iva}">IVA</th>`,
    `<th class="r" style="width:${colW.total}">Total</th>`,
  ].join('')
}

function buildDataRow(r: LibroRow, hasIdp: boolean, hasTurismo: boolean) {
  const baseCells = r.values.map(v => `<td class="r">${fmt(v)}</td>`).join('')
  return `<tr>
    <td>${r.folio}</td>
    <td>${r.tipoDocumento || 'FACT'}</td>
    <td>${fmtD(r.fecha)}</td>
    <td>${r.felSerie || '—'}</td>
    <td>${r.felNumero || '—'}</td>
    <td>${r.nitParty || '—'}</td>
    <td>${r.nombreParty}</td>
    ${baseCells}
    ${hasIdp     ? `<td class="r" style="color:#ff7f00">${fmt(r.idp     ?? 0)}</td>` : ''}
    ${hasTurismo ? `<td class="r" style="color:#7c3aed">${fmt(r.turismo ?? 0)}</td>` : ''}
    <td class="r">${fmt(r.iva)}</td>
    <td class="r"><strong>${fmt(r.total)}</strong></td>
  </tr>`
}

function buildHeaderBlock(empresa: EmpresaInfo | null, reportName: string, period: string, currency: string, folioNum: number) {
  const company = empresa?.company_name ?? ''
  const legal   = empresa?.legal_name   ?? ''
  const nit     = empresa?.tax_id       ?? ''
  return `
    <div class="header">
      <div class="header-left">
        <div class="company">${company}</div>
        ${legal && legal !== company ? `<div class="legal">${legal}</div>` : ''}
        ${nit ? `<div class="nit">N.I.T.: ${nit}</div>` : ''}
        <div class="rptname">${reportName}</div>
        <div class="period">${period}</div>
      </div>
      <div class="header-right">
        <div class="moneda">Moneda: <strong>${currency}</strong></div>
        <div class="folio-box">
          <div class="flabel">FOLIO</div>
          <div class="fvalue">${folioNum}</div>
        </div>
      </div>
    </div>`
}

// ── Función principal ──────────────────────────────────────────────────────────
export function printLibro(opts: PrintLibroOptions) {
  const {
    empresa, reportName, period, folioInicio,
    nitLabel, nombreLabel, columns, rows, totals, resumen,
    hasIdp = false, hasTurismo = false,
  } = opts

  const currency = empresa?.currency ?? 'GTQ'

  // Anchos proporcionales (carta landscape ~258mm usable)
  const baseW = columns.length > 0 ? Math.max(4, Math.floor(36 / columns.length)) : 6
  const colW = {
    no:    '3%', tipo:  '5%', fecha: '5.5%', serie: '4%',
    ndoc:  '8%', nit:   '7%', nombre: '13%',
    base:  `${baseW}%`,
    idp:   (hasIdp || hasTurismo) ? '4%' : '0',
    iva:   '5%', total: '7%',
  }

  const headerCells = buildHeaderCells(columns, nitLabel, nombreLabel, hasIdp, hasTurismo, colW)
  const totalPages  = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))

  // ── Genera una página por bloque de 20 filas ─────────────────────────────
  const pageBlocks = Array.from({ length: totalPages }, (_, pi) => {
    const folioNum  = folioInicio + pi
    const slice     = rows.slice(pi * ROWS_PER_PAGE, (pi + 1) * ROWS_PER_PAGE)
    const isLast    = pi === totalPages - 1
    const dataRows  = slice.map(r => buildDataRow(r, hasIdp, hasTurismo)).join('')

    // Fila totales solo en última página
    const totalsRow = isLast ? `<tr class="totals-row">
      <td colspan="7"><strong>TOTALES — ${rows.length} documentos</strong></td>
      ${totals.values.map(v => `<td class="r">${fmt(v)}</td>`).join('')}
      ${hasIdp     ? `<td class="r">${fmt(totals.idp     ?? 0)}</td>` : ''}
      ${hasTurismo ? `<td class="r">${fmt(totals.turismo ?? 0)}</td>` : ''}
      <td class="r">${fmt(totals.iva)}</td>
      <td class="r">${fmt(totals.total)}</td>
    </tr>` : ''

    // Resumen solo en última página
    const resumenBlock = isLast ? buildResumenBlock(resumen, totals) : ''

    return `
      <div class="page">
        ${buildHeaderBlock(empresa, reportName, period, currency, folioNum)}
        <div class="base-header">VALOR BASE (sin IVA) — por categoría SAT</div>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${dataRows}</tbody>
          ${totalsRow ? `<tfoot>${totalsRow}</tfoot>` : ''}
        </table>
        ${resumenBlock}
        <div class="page-footer">Página ${pi + 1} de ${totalPages}</div>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>${reportName} — ${period}</title>
    <style>${PRINT_CSS}</style>
  </head><body>
    ${pageBlocks}
    <script>
      window.onload = function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      };
    </script>
  </body></html>`

  const win = window.open('', '_blank', 'width=1200,height=800')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Bloque resumen por categoría ───────────────────────────────────────────────
function buildResumenBlock(resumen: LibroResumenRow[], totals: LibroTotals) {
  const totalResumen = resumen.reduce((a, r) => ({
    cantidad: a.cantidad + r.cantidad,
    base: a.base + r.base,
    iva:  a.iva  + r.iva,
    total: a.total + r.total,
  }), { cantidad: 0, base: 0, iva: 0, total: 0 })

  const rows = resumen.map(r => `<tr>
    <td>${r.label}</td>
    <td style="text-align:center">${r.cantidad > 0 ? r.cantidad : '—'}</td>
    <td style="text-align:right">${r.base  > 0 ? `Q ${r.base.toFixed(2)}`  : '—'}</td>
    <td style="text-align:right;color:#1B3A6B">${r.iva > 0 ? `Q ${r.iva.toFixed(2)}` : '—'}</td>
    <td style="text-align:right;font-weight:700">${r.total > 0 ? `Q ${r.total.toFixed(2)}` : '—'}</td>
  </tr>`).join('')

  return `
    <div class="resumen">
      <h3>Resumen por Categoría — Insumo Formulario IVA (SAT)</h3>
      <table>
        <thead><tr>
          <th>Categoría</th>
          <th style="text-align:center;width:55px">Docs.</th>
          <th style="text-align:right;width:115px">Base (sin IVA)</th>
          <th style="text-align:right;width:95px">IVA</th>
          <th style="text-align:right;width:115px">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td>TOTAL PERÍODO</td>
          <td style="text-align:center">${totalResumen.cantidad}</td>
          <td style="text-align:right">Q ${totalResumen.base.toFixed(2)}</td>
          <td style="text-align:right">Q ${totalResumen.iva.toFixed(2)}</td>
          <td style="text-align:right">Q ${totalResumen.total.toFixed(2)}</td>
        </tr></tfoot>
      </table>
    </div>`
}
