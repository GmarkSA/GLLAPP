/** Formatos de impresión admitidos por el sistema */
export type PrintFormatId = 'carta' | 'media-carta' | 'ticket-80' | 'ticket-58'

export interface PrintFormat {
  id:          PrintFormatId
  label:       string
  description: string
  /** CSS @page size value */
  pageSize:    string
  /** CSS @page margin */
  margin:      string
  /** Base font size en px */
  fontSize:    number
  /** true = layout de rollo estrecho */
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

/** Formato guardado en localStorage */
const LS_KEY = 'contaerp_print_format'

export function getSavedFormat(): PrintFormatId {
  return (localStorage.getItem(LS_KEY) as PrintFormatId) ?? 'carta'
}

export function saveFormat(id: PrintFormatId) {
  localStorage.setItem(LS_KEY, id)
}

// La impresión real se hace en PrintInvoiceButton via renderToStaticMarkup + ventana nueva
