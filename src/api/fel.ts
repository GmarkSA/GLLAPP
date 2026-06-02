// ── Tabla de tipos de documento FEL por régimen ─────────────────────────────

export interface FelDocType {
  code:        string
  label:       string
  description: string
}

/** Tipos de documento permitidos por código de régimen fiscal */
export const FEL_DOC_TYPES_BY_REGIME: Record<string, FelDocType[]> = {
  gt_pequeno_contribuyente: [
    { code: 'FPEQ', label: 'FPEQ – Factura Pequeño Contribuyente',           description: 'Factura estándar para pequeño contribuyente' },
    { code: 'FCPA', label: 'FCPA – Factura Cambiaria Pequeño Contribuyente', description: 'Factura cambiaria para pequeño contribuyente' },
    { code: 'NCRE', label: 'NCRE – Nota de Crédito',                         description: 'Nota de crédito (aplica para ambos regímenes)' },
    { code: 'NABN', label: 'NABN – Nota de Abono',                           description: 'Casos específicos' },
    { code: 'RECI', label: 'RECI – Recibo',                                  description: 'Casos específicos' },
  ],
  gt_regimen_general: [
    { code: 'FACT', label: 'FACT – Factura',                    description: 'Factura estándar régimen general' },
    { code: 'FCAM', label: 'FCAM – Factura Cambiaria',          description: 'Factura cambiaria régimen general' },
    { code: 'NCRE', label: 'NCRE – Nota de Crédito',            description: 'Nota de crédito' },
    { code: 'NDEB', label: 'NDEB – Nota de Débito',             description: 'Nota de débito' },
    { code: 'FESP', label: 'FESP – Factura Especial',           description: 'Factura especial' },
    { code: 'NABN', label: 'NABN – Nota de Abono',              description: 'Casos específicos' },
    { code: 'RECI', label: 'RECI – Recibo',                     description: 'Casos específicos' },
  ],
  gt_regimen_primario: [
    { code: 'FPRI', label: 'FPRI – Factura Régimen Primario',           description: 'Factura régimen primario' },
    { code: 'FCAP', label: 'FCAP – Factura Cambiaria Régimen Primario', description: 'Factura cambiaria régimen primario' },
  ],
  gt_regimen_pecuario: [
    { code: 'FPEC', label: 'FPEC – Factura Régimen Pecuario',           description: 'Factura régimen pecuario' },
    { code: 'FCPC', label: 'FCPC – Factura Cambiaria Régimen Pecuario', description: 'Factura cambiaria régimen pecuario' },
  ],
}

/** Default doc type para cada régimen (el más común de su lista) */
export const FEL_DEFAULT_BY_REGIME: Record<string, string> = {
  gt_pequeno_contribuyente: 'FPEQ',
  gt_regimen_general:       'FACT',
  gt_regimen_primario:      'FPRI',
  gt_regimen_pecuario:      'FPEC',
}

/** Todos los tipos de documento (fallback cuando no hay régimen) */
export const FEL_ALL_DOC_TYPES: FelDocType[] = Object.values(FEL_DOC_TYPES_BY_REGIME)
  .flat()
  .filter((v, i, a) => a.findIndex(x => x.code === v.code) === i)

export const REGIME_LABELS: Record<string, string> = {
  gt_pequeno_contribuyente: 'Pequeño Contribuyente',
  gt_regimen_general:       'Régimen General',
  gt_regimen_primario:      'Régimen Primario',
  gt_regimen_pecuario:      'Régimen Pecuario',
}
