/** Formatos de impresión admitidos por el sistema */
export type PrintFormatId = 'carta' | 'media-carta' | 'ticket-80' | 'ticket-58'

export interface PrintFormat {
  id:          PrintFormatId
  label:       string
  description: string
  pageSize:    string
  margin:      string
  fontSize:    number
  isTicket:    boolean
}

export const PRINT_FORMATS: PrintFormat[] = [
  {
    id:          'carta',
    label:       'Carta',
    description: '8.5 × 11 pulgadas — Hoja estándar',
    pageSize:    '8.5in 11in',
    margin:      '12mm 18mm',
    fontSize:    11,
    isTicket:    false,
  },
  {
    id:          'media-carta',
    label:       'Media Carta',
    description: '5.5 × 8.5 pulgadas — Hoja pequeña',
    pageSize:    '5.5in 8.5in',
    margin:      '8mm 12mm',
    fontSize:    10,
    isTicket:    false,
  },
  {
    id:          'ticket-80',
    label:       'Ticket 80 mm',
    description: 'Impresora térmica ancha',
    pageSize:    '80mm auto',
    margin:      '4mm 5mm',
    fontSize:    9,
    isTicket:    true,
  },
  {
    id:          'ticket-58',
    label:       'Ticket 58 mm',
    description: 'Impresora térmica compacta',
    pageSize:    '58mm auto',
    margin:      '3mm 4mm',
    fontSize:    8,
    isTicket:    true,
  },
]

// ── Diseño personalizable por plantilla ───────────────────────────────────────

export interface PrintTemplate {
  fontFamily:    'Arial' | 'Times New Roman' | 'Helvetica'
  primaryColor:  string
  headerLayout:  'logo-left' | 'logo-right'
  showLogo:      boolean
  showUnit:      boolean
  showDiscount:  boolean
  showTaxCol:    boolean
  showFelBox:    boolean
  footerText:    string
  showPrintDate: boolean
}

export const DEFAULT_TEMPLATE: PrintTemplate = {
  fontFamily:    'Arial',
  primaryColor:  '#1faec2',
  headerLayout:  'logo-left',
  showLogo:      true,
  showUnit:      true,
  showDiscount:  true,
  showTaxCol:    true,
  showFelBox:    true,
  footerText:    'Lucía — Sistema de Contabilidad',
  showPrintDate: true,
}

// ── FormatTemplate: un formato + su diseño + si es predeterminado ─────────────

export interface FormatTemplate {
  formatId:   PrintFormatId
  template:   PrintTemplate
  isDefault:  boolean
}

const FORMAT_TEMPLATES_KEY = 'contaerp_format_templates'

function buildDefaults(): FormatTemplate[] {
  return PRINT_FORMATS.map(f => ({
    formatId:  f.id,
    template:  { ...DEFAULT_TEMPLATE },
    isDefault: f.id === 'carta',
  }))
}

export function getFormatTemplates(): FormatTemplate[] {
  try {
    const raw = localStorage.getItem(FORMAT_TEMPLATES_KEY)
    if (raw) {
      const parsed: FormatTemplate[] = JSON.parse(raw)
      // Asegurar que existan los 4 formatos (migración segura)
      return PRINT_FORMATS.map(f => {
        const saved = parsed.find(t => t.formatId === f.id)
        return saved
          ? { ...saved, template: { ...DEFAULT_TEMPLATE, ...saved.template } }
          : { formatId: f.id, template: { ...DEFAULT_TEMPLATE }, isDefault: f.id === 'carta' }
      })
    }
  } catch { /* fall through */ }
  return buildDefaults()
}

export function saveFormatTemplates(templates: FormatTemplate[]): void {
  localStorage.setItem(FORMAT_TEMPLATES_KEY, JSON.stringify(templates))
}

/** Devuelve el FormatTemplate marcado como predeterminado */
export function getDefaultFormatTemplate(): FormatTemplate {
  const templates = getFormatTemplates()
  return templates.find(t => t.isDefault) ?? templates[0]
}

/** Devuelve el PrintTemplate del formato especificado (o del predeterminado) */
export function getTemplateForFormat(formatId?: PrintFormatId): PrintTemplate {
  const templates = getFormatTemplates()
  const entry = formatId
    ? templates.find(t => t.formatId === formatId)
    : templates.find(t => t.isDefault)
  return entry?.template ?? DEFAULT_TEMPLATE
}

/** @deprecated Usar getTemplateForFormat() */
export function getSavedTemplate(): PrintTemplate {
  return getDefaultFormatTemplate().template
}
