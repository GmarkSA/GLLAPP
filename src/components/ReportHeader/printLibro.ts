import type { EmpresaInfo } from '../../api/reportes'

const fmt = (n: number) =>
  n === 0 ? '—' : n.toLocaleString('es-GT', { minimumFractionDigits: 2 })

const fmtD = (v: string) =>
  v ? new Date(v).toLocaleDateString('es-GT') : '—'

// ── CSS para impresión carta ────────────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter landscape; margin: 1cm 1.2cm; }
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; background: #fff; }

  .header { border-bottom: 2px solid #1faec2; padding-bottom: 8px; margin-bottom: 10px;
            display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left .company   { font-size: 11pt; font-weight: 700; color: #1faec2; }
  .header-left .legal     { font-size: 9pt; color: #374151; margin-top: 1px; }
  .header-left .nit       { font-size: 9pt; color: #4b5563; margin-top: 2px; }
  .header-left .rptname   { font-size: 9pt; font-weight: 600; color: #4b5563; margin-top: 4px; }
  .header-left .period    { font-size: 8pt; color: #6b7280; margin-top: 1px; }
  .header-right .moneda   { font-size: 9pt; color: #6b7280; text-align: right; }
  .folio-box { border: 1.5px solid #1faec2; border-radius: 6px; padding: 3px 10px;
               text-align: center; margin-top: 4px; }
  .folio-box .label { font-size: 7pt; color: #9aa1ab; text-transform: uppercase; letter-spacing: 1px; }
  .folio-box .value { font-size: 14pt; font-weight: 800; color: #1faec2; font-family: monospace; }

  .base-header { background: #1faec2; color: #fff; font-size: 7pt; font-weight: 700;
                 padding: 3px 6px; border-radius: 4px 4px 0 0; margin-top: 8px; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead tr th { background: #1faec2; color: #fff; font-size: 7pt; font-weight: 600;
                padding: 3px 4px; text-align: left; border: 1px solid #1faec2;
                word-break: break-word; white-space: normal; }
  thead tr th.r { text-align: right; }
  tbody tr td { font-size: 7.5pt; padding: 2px 4px; border-bottom: 1px solid #e5e7eb;
                word-break: break-word; white-space: normal; }
  tbody tr td.r { text-align: right; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  tfoot tr td { font-size: 8pt; font-weight: 700; padding: 4px 4px; background: #e8ecf5;
                border-top: 2px solid #1faec2; }
  tfoot tr td.r { text-align: right; color: #1faec2; }

  .resumen { margin-top: 14px; }
  .resumen h3 { font-size: 9pt; font-weight: 700; color: #1faec2; margin-bottom: 6px; }
  .resumen table { table-layout: auto; }
  .resumen thead tr th { font-size: 8pt; padding: 4px 8px; }
  .resumen tbody tr td { font-size: 8pt; padding: 4px 8px; }
  .resumen tfoot tr td { font-size: 8pt; padding: 5px 8px; background: #1faec2; color: #fff; }
`

// ── Tipo genérico para filas de libro ────────────────────────────────────────
export interface LibroRow {
  folio:         number
  tipoDocumento: string
  fecha:         string
  felSerie:      string
  felNumero:     string
  referencia:    string
  nitParty:      string   // NIT proveedor o cliente
  nombreParty:   string   // Nombre proveedor o cliente
  col1: number; label1: string
  col2: number; label2: string
  col3: number; label3: string
  col4: number; label4: string
  col5?: number; label5?: string
  col6?: number; label6?: string
  idp?: number
  iva:   number
  total: number
}

export interface LibroTotals {
  col1: number; col2: number; col3: number; col4: number
  col5?: number; col6?: number; idp?: number; iva: number; total: number
}

export interface LibroResumenRow {
  label:    string
  cantidad: number
  base:     number
  iva:      number
  total:    number
}

interface PrintLibroOptions {
  empresa:       EmpresaInfo | null
  reportName:    string
  period:        string
  folioInicio:   number
  folioFin:      number
  nitLabel:      string   // "NIT Contribuyente" o "NIT Cliente"
  nombreLabel:   string   // "Nombre del Contribuyente" o "Nombre del Cliente"
  rows:          LibroRow[]
  totals:        LibroTotals
  resumen:       LibroResumenRow[]
  hasIdp?:       boolean
  hasCol5?:      boolean
  hasCol6?:      boolean
}

export function printLibro(opts: PrintLibroOptions) {
  const {
    empresa, reportName, period, folioInicio, folioFin,
    nitLabel, nombreLabel, rows, totals, resumen,
    hasIdp = false, hasCol5 = false, hasCol6 = false,
  } = opts

  const company  = empresa?.company_name ?? 'Lucía'
  const legal    = empresa?.legal_name   ?? ''
  const nit      = empresa?.tax_id       ?? ''
  const currency = empresa?.currency     ?? 'GTQ'

  const folioStr = folioInicio === folioFin ? String(folioInicio) : `${folioInicio}–${folioFin}`

  // Columnas base
  const baseCols = [
    rows[0]?.label1 ?? '',
    rows[0]?.label2 ?? '',
    rows[0]?.label3 ?? '',
    rows[0]?.label4 ?? '',
    ...(hasCol5 ? [rows[0]?.label5 ?? ''] : []),
    ...(hasCol6 ? [rows[0]?.label6 ?? ''] : []),
  ]

  // Anchos de columnas fijos para carta landscape (258mm usable ≈ 975px)
  const colW = {
    no:     '3%',  tipo:   '5%',  fecha:  '6%', serie: '4%',
    ndoc:   '7%',  ref:    '6%',  nit:    '7%', nombre: '13%',
    base:   `${Math.floor(38 / baseCols.length)}%`,
    idp:    hasIdp ? '4%' : '0',
    iva:    '5%',  total:  '7%',
  }

  const headerCells = [
    `<th style="width:${colW.no}">No.</th>`,
    `<th style="width:${colW.tipo}">Tipo Doc.</th>`,
    `<th style="width:${colW.fecha}">Fecha</th>`,
    `<th style="width:${colW.serie}">Serie</th>`,
    `<th style="width:${colW.ndoc}">No. Documento</th>`,
    `<th style="width:${colW.ref}">Referencia</th>`,
    `<th style="width:${colW.nit}">${nitLabel}</th>`,
    `<th style="width:${colW.nombre}">${nombreLabel}</th>`,
    ...baseCols.map(l => `<th class="r" style="width:${colW.base}">${l}</th>`),
    ...(hasIdp ? [`<th class="r" style="width:${colW.idp}">IDP</th>`] : []),
    `<th class="r" style="width:${colW.iva}">IVA</th>`,
    `<th class="r" style="width:${colW.total}">Total</th>`,
  ].join('')

  const dataRows = rows.map(r => {
    const baseCells = [
      `<td class="r">${fmt(r.col1)}</td>`,
      `<td class="r">${fmt(r.col2)}</td>`,
      `<td class="r">${fmt(r.col3)}</td>`,
      `<td class="r">${fmt(r.col4)}</td>`,
      ...(hasCol5 ? [`<td class="r">${fmt(r.col5 ?? 0)}</td>`] : []),
      ...(hasCol6 ? [`<td class="r">${fmt(r.col6 ?? 0)}</td>`] : []),
    ].join('')
    return `<tr>
      <td>${r.folio}</td>
      <td>${r.tipoDocumento || 'FACT'}</td>
      <td>${fmtD(r.fecha)}</td>
      <td>${r.felSerie || '—'}</td>
      <td>${r.felNumero || '—'}</td>
      <td>${r.referencia || '—'}</td>
      <td>${r.nitParty || '—'}</td>
      <td>${r.nombreParty}</td>
      ${baseCells}
      ${hasIdp ? `<td class="r" style="color:#ff7f00">${fmt(r.idp ?? 0)}</td>` : ''}
      <td class="r">${fmt(r.iva)}</td>
      <td class="r"><strong>${fmt(r.total)}</strong></td>
    </tr>`
  }).join('')

  const totalCells = [
    fmt(totals.col1), fmt(totals.col2), fmt(totals.col3), fmt(totals.col4),
    ...(hasCol5 ? [fmt(totals.col5 ?? 0)] : []),
    ...(hasCol6 ? [fmt(totals.col6 ?? 0)] : []),
  ].map(v => `<td class="r">${v}</td>`).join('')

  const resumenRows = resumen.map(r => `<tr>
    <td>${r.label}</td>
    <td style="text-align:center">${r.cantidad > 0 ? r.cantidad : '—'}</td>
    <td style="text-align:right">${r.base > 0 ? `Q ${r.base.toFixed(2)}` : '—'}</td>
    <td style="text-align:right;color:#1faec2">${r.iva > 0 ? `Q ${r.iva.toFixed(2)}` : '—'}</td>
    <td style="text-align:right;font-weight:700">${r.total > 0 ? `Q ${r.total.toFixed(2)}` : '—'}</td>
  </tr>`).join('')

  const totalResumen = resumen.reduce((a, r) => ({
    cantidad: a.cantidad + r.cantidad, base: a.base + r.base,
    iva: a.iva + r.iva, total: a.total + r.total,
  }), { cantidad: 0, base: 0, iva: 0, total: 0 })

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>${reportName} — ${period}</title>
    <style>${PRINT_CSS}</style>
  </head><body>
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
          <div class="label">Folio</div>
          <div class="value">${folioStr}</div>
        </div>
      </div>
    </div>

    <div class="base-header">VALOR BASE (sin IVA) — por categoría SAT</div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${dataRows}</tbody>
      <tfoot><tr>
        <td colspan="8"><strong>TOTALES — ${rows.length} documentos</strong></td>
        ${totalCells}
        ${hasIdp ? `<td class="r">${fmt(totals.idp ?? 0)}</td>` : ''}
        <td class="r">${fmt(totals.iva)}</td>
        <td class="r">${fmt(totals.total)}</td>
      </tr></tfoot>
    </table>

    <div class="resumen">
      <h3>Resumen por Categoría — Insumo Formulario IVA (SAT)</h3>
      <table>
        <thead><tr>
          <th>Categoría</th>
          <th style="text-align:center;width:60px">Docs.</th>
          <th style="text-align:right;width:120px">Base (sin IVA)</th>
          <th style="text-align:right;width:100px">IVA</th>
          <th style="text-align:right;width:120px">Total</th>
        </tr></thead>
        <tbody>${resumenRows}</tbody>
        <tfoot><tr>
          <td><strong>TOTAL PERÍODO</strong></td>
          <td style="text-align:center"><strong>${totalResumen.cantidad}</strong></td>
          <td style="text-align:right"><strong>Q ${totalResumen.base.toFixed(2)}</strong></td>
          <td style="text-align:right"><strong>Q ${totalResumen.iva.toFixed(2)}</strong></td>
          <td style="text-align:right"><strong>Q ${totalResumen.total.toFixed(2)}</strong></td>
        </tr></tfoot>
      </table>
    </div>

    <script>
      window.onload = function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      };
    </script>
  </body></html>`

  const win = window.open('', '_blank', 'width=1200,height=800')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
