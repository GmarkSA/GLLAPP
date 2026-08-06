export type EmailDocumentType = 'factura' | 'cotizacion' | 'pago' | 'factura_proveedor' | 'orden_compra'

export interface EmailTemplate {
  id:               string
  name:             string
  documentType:     EmailDocumentType
  subject:          string
  greeting:         string
  message:          string
  showBankAccounts: boolean
  footerText:       string
  isDefault:        boolean
}

export const EMAIL_VARS: { key: string; label: string; example: string }[] = [
  { key: 'nombreCliente',  label: 'Nombre del cliente',   example: 'Guatemala Country Club' },
  { key: 'numeroFactura',  label: 'Número de factura',    example: 'FV-00006'               },
  { key: 'total',          label: 'Total de la factura',  example: 'Q 8,500.00'             },
  { key: 'saldo',          label: 'Saldo adeudado',       example: 'Q 7,500.00'             },
  { key: 'fecha',          label: 'Fecha del documento',  example: '31/07/2026'             },
  { key: 'nombreEmpresa',  label: 'Nombre de la empresa', example: 'Empresa Ejemplo, S.A.'  },
  { key: 'moneda',         label: 'Moneda',               example: 'GTQ'                    },
]

export const PREVIEW_VARS: Record<string, string> = {
  nombreCliente: 'Guatemala Country Club',
  numeroFactura: 'FV-00006',
  total:         'Q 8,500.00',
  saldo:         'Q 7,500.00',
  fecha:         '31/07/2026',
  nombreEmpresa: 'Empresa Ejemplo, S.A.',
  moneda:        'GTQ',
}

export function replaceVars(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id:               'default-factura',
    name:             'Factura Estándar',
    documentType:     'factura',
    subject:          'Factura {{numeroFactura}} — {{nombreEmpresa}}',
    greeting:         'Estimado/a {{nombreCliente}}:',
    message:          'Adjuntamos la factura correspondiente a los servicios prestados. Agradecemos su puntual pago.',
    showBankAccounts: true,
    footerText:       '',
    isDefault:        true,
  },
  {
    id:               'default-cotizacion',
    name:             'Cotización Estándar',
    documentType:     'cotizacion',
    subject:          'Cotización — {{nombreEmpresa}}',
    greeting:         'Estimado/a {{nombreCliente}}:',
    message:          'Adjuntamos la cotización solicitada. Quedamos atentos a su confirmación.',
    showBankAccounts: false,
    footerText:       '',
    isDefault:        false,
  },
  {
    id:               'default-pago',
    name:             'Confirmación de Pago',
    documentType:     'pago',
    subject:          'Confirmación de pago recibido — {{nombreEmpresa}}',
    greeting:         'Estimado/a {{nombreCliente}}:',
    message:          'Confirmamos la recepción de su pago. Saldo pendiente: {{saldo}}. Muchas gracias.',
    showBankAccounts: false,
    footerText:       '',
    isDefault:        false,
  },
  {
    id:               'default-factura-proveedor',
    name:             'Factura Proveedor Estándar',
    documentType:     'factura_proveedor',
    subject:          'Consulta factura {{numeroFactura}} — {{nombreEmpresa}}',
    greeting:         'Estimado proveedor:',
    message:          'Nos comunicamos en referencia a la factura {{numeroFactura}} de fecha {{fecha}} por un monto de {{total}}. Quedamos atentos a cualquier aclaración.',
    showBankAccounts: false,
    footerText:       '',
    isDefault:        true,
  },
  {
    id:               'default-orden-compra',
    name:             'Orden de Compra Estándar',
    documentType:     'orden_compra',
    subject:          'Orden de Compra — {{nombreEmpresa}}',
    greeting:         'Estimado proveedor:',
    message:          'Adjuntamos la orden de compra correspondiente. Favor confirmar recepción e indicar fecha estimada de entrega.',
    showBankAccounts: false,
    footerText:       '',
    isDefault:        true,
  },
]

const LS_KEY = 'contaerp_email_templates'

export function getEmailTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */ }
  return DEFAULT_TEMPLATES.map(t => ({ ...t }))
}

export function saveEmailTemplates(templates: EmailTemplate[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(templates))
}

export function getDefaultEmailTemplate(type?: EmailDocumentType): EmailTemplate | undefined {
  const all = getEmailTemplates()
  return all.find(t => t.isDefault && (!type || t.documentType === type))
    ?? all.find(t => !type || t.documentType === type)
}
