/**
 * Catálogo de bancos sistema guateACH (Banguat Guatemala).
 * Fuente: Manual guateACH / BiBanking (Banco Industrial).
 * Verificar vigencia con cada banco antes de producción.
 */

export interface GuateAchBank {
  bankCodeGTQ:    string   // Código para transacciones en GTQ
  bankCodeUSD:    string   // Código para transacciones en USD
  name:           string   // Nombre oficial
  shortName:      string   // Nombre corto / alias
  participatesACH: boolean
}

export interface AccountFormatRule {
  bankName:       string
  productType:    string   // 'monetaria' | 'ahorro' | 'tarjeta_credito' | 'prestamo'
  length:         string   // '10' | '10 o 14' | 'Variable (9-11)' | etc.
  prefix:         string   // 'N/A' | 'Inicia con 93' | etc.
  padZeros:       boolean  // Rellenar con ceros a la izquierda
  notes?:         string
}

// ── Catálogo de bancos guateACH ─────────────────────────────────────────────

export const GUATE_ACH_BANKS: GuateAchBank[] = [
  { bankCodeGTQ: '101', bankCodeUSD: '201', name: 'Banco de Guatemala',                         shortName: 'Banguat',   participatesACH: true  },
  { bankCodeGTQ: '104', bankCodeUSD: '204', name: 'Crédito Hipotecario Nacional de Guatemala',  shortName: 'CHN',       participatesACH: true  },
  { bankCodeGTQ: '112', bankCodeUSD: '212', name: 'Banco de los Trabajadores',                  shortName: 'Bantrab',   participatesACH: true  },
  { bankCodeGTQ: '113', bankCodeUSD: '213', name: 'Banco Inmobiliario',                         shortName: 'Inmobili.', participatesACH: true  },
  { bankCodeGTQ: '115', bankCodeUSD: '215', name: 'Banco Industrial',                           shortName: 'BI',        participatesACH: true  },
  { bankCodeGTQ: '116', bankCodeUSD: '216', name: 'Banco de Desarrollo Rural',                  shortName: 'Banrural',  participatesACH: true  },
  { bankCodeGTQ: '119', bankCodeUSD: '219', name: 'Banco Internacional',                        shortName: 'Binter',    participatesACH: true  },
  { bankCodeGTQ: '128', bankCodeUSD: '228', name: 'Banco Reformador',                           shortName: 'Reform.',   participatesACH: true  },
  { bankCodeGTQ: '130', bankCodeUSD: '230', name: 'Citibank N.A. Guatemala',                    shortName: 'Citi',      participatesACH: true  },
  { bankCodeGTQ: '136', bankCodeUSD: '236', name: 'Vivibanco',                                  shortName: 'Vivibanco', participatesACH: true  },
  { bankCodeGTQ: '139', bankCodeUSD: '239', name: 'Banco Ficohsa Guatemala',                    shortName: 'Ficohsa',   participatesACH: true  },
  { bankCodeGTQ: '140', bankCodeUSD: '240', name: 'Banco Promerica',                            shortName: 'Promerica', participatesACH: true  },
  { bankCodeGTQ: '142', bankCodeUSD: '242', name: 'BAC (Banco de América Central)',              shortName: 'BAC',       participatesACH: true  },
  { bankCodeGTQ: '143', bankCodeUSD: '243', name: 'Citibank de Guatemala, S.A.',                shortName: 'CitiGT',    participatesACH: true  },
  { bankCodeGTQ: '144', bankCodeUSD: '244', name: 'Banco Agromercantil',                        shortName: 'BAM',       participatesACH: true  },
  { bankCodeGTQ: '145', bankCodeUSD: '245', name: 'Banco G&T Continental',                      shortName: 'GTC',       participatesACH: true  },
  { bankCodeGTQ: '146', bankCodeUSD: '246', name: 'Banco de Crédito (Bancred)',                  shortName: 'Bancred',   participatesACH: true  },
  { bankCodeGTQ: '147', bankCodeUSD: '247', name: 'Banco Azteca de Guatemala',                  shortName: 'Azteca',    participatesACH: true  },
  { bankCodeGTQ: '159', bankCodeUSD: '259', name: 'Financiera de Occidente',                    shortName: 'Finoccid.', participatesACH: true  },
]

/** Mapa rápido: bankCodeGTQ → GuateAchBank */
export const GUATE_ACH_MAP: Record<string, GuateAchBank> = Object.fromEntries(
  GUATE_ACH_BANKS.map(b => [b.bankCodeGTQ, b])
)

// ── Reglas de formato de número de cuenta por banco ──────────────────────────

export const ACCOUNT_FORMAT_RULES: AccountFormatRule[] = [
  { bankName: 'Banco Industrial',                  productType: 'monetaria',      length: '10',         prefix: 'N/A',           padZeros: true,  notes: 'No anteponer signos, solo números' },
  { bankName: 'Banco Industrial',                  productType: 'ahorro',         length: '7',          prefix: 'Últimos 7 dígitos de la libreta', padZeros: true },
  { bankName: 'Banco Industrial',                  productType: 'tarjeta_credito', length: '16',        prefix: 'N/A',           padZeros: false },
  { bankName: 'Banco Industrial',                  productType: 'prestamo',       length: 'hasta 15',   prefix: 'Alfanumérico',  padZeros: false, notes: 'Formato alfanumérico especial' },
  { bankName: 'Banco de Desarrollo Rural',         productType: 'monetaria',      length: '10 a 14',    prefix: 'Inicia en 3 (10 díg.) o 0 (14 díg.)', padZeros: true, notes: 'Prefijo determina longitud' },
  { bankName: 'Banco de Desarrollo Rural',         productType: 'ahorro',         length: '10 a 14',    prefix: 'Inicia en 4 (10 díg.) o 0 (14 díg.)', padZeros: true },
  { bankName: 'Banco G&T Continental',             productType: 'monetaria',      length: '11 (guiones)', prefix: 'AGENCIA-CUENTA-DÍGITO ej. 021-5005727-7', padZeros: false, notes: 'Mantener guiones al capturar' },
  { bankName: 'BAC (Banco de América Central)',     productType: 'monetaria',      length: '9 (local) o 22 (IBAN)', prefix: 'Prefijos 98, 93, 96 según producto', padZeros: false, notes: '9 dígitos cuentas locales; 22 alfanumérico IBAN' },
  { bankName: 'Banco Reformador',                  productType: 'monetaria',      length: 'Variable (9-11)', prefix: 'Prefijos 2, 3 según producto', padZeros: true },
  { bankName: 'Banco de Crédito (Bancred)',         productType: 'monetaria',      length: '9',          prefix: 'N/A',           padZeros: true },
  { bankName: 'Banco de Crédito (Bancred)',         productType: 'prestamo',       length: '11',         prefix: 'N/A',           padZeros: true },
  { bankName: 'Banco de Crédito (Bancred)',         productType: 'tarjeta_credito', length: '16',        prefix: 'Inicia con 5',  padZeros: false },
  { bankName: 'Citibank N.A. Guatemala',            productType: 'todas',          length: 'Variable',   prefix: 'Inicia con 98', padZeros: true },
  { bankName: 'Citibank de Guatemala S.A.',         productType: 'todas',          length: '15',         prefix: 'N/A',           padZeros: true, notes: 'Rellenar con ceros si no cumple longitud' },
  { bankName: 'Banco Agromercantil',                productType: 'monetaria',      length: '10',         prefix: 'N/A',           padZeros: true },
  { bankName: 'Banco Ficohsa Guatemala',            productType: 'monetaria',      length: '11',         prefix: 'Inicia con 5',  padZeros: true },
  { bankName: 'Banco Ficohsa Guatemala',            productType: 'prestamo',       length: '10',         prefix: 'N/A',           padZeros: true },
  { bankName: 'Vivibanco',                          productType: 'monetaria',      length: '12',         prefix: 'N/A',           padZeros: true, notes: 'Incluir ceros no representativos' },
  { bankName: 'Banco Azteca de Guatemala',          productType: 'monetaria',      length: '14',         prefix: 'Posición 6 identifica moneda (1=GTQ, 5/6=USD)', padZeros: true },
  { bankName: 'Crédito Hipotecario Nacional',       productType: 'monetaria',      length: '12',         prefix: 'Prefijo 01/02/03', padZeros: true },
  { bankName: 'Banco Promerica',                    productType: 'monetaria',      length: '14',         prefix: 'N/A',           padZeros: true },
  { bankName: 'Banco Internacional',                productType: 'monetaria',      length: 'Variable',   prefix: 'Inicia con 93', padZeros: true },
  { bankName: 'Banco Inmobiliario',                 productType: 'monetaria',      length: 'Variable',   prefix: 'Inicia con 96', padZeros: true },
  { bankName: 'Banco de los Trabajadores',          productType: 'monetaria',      length: 'Variable',   prefix: 'Según contrato', padZeros: true, notes: 'Validar con Bantrab al afiliarse' },
]

// ── Tipos de cuenta para el selector ─────────────────────────────────────────

export const ACCOUNT_TYPES = [
  { value: 'monetaria',      label: 'Monetaria (cheques)' },
  { value: 'ahorro',         label: 'Ahorro' },
  { value: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { value: 'prestamo',       label: 'Préstamo' },
]

/** Devuelve el código guateACH correcto según moneda */
export function getBankCodeForCurrency(bank: GuateAchBank, currency: 'GTQ' | 'USD'): string {
  return currency === 'USD' ? bank.bankCodeUSD : bank.bankCodeGTQ
}

/** Busca el banco por nombre (fuzzy) */
export function findBankByName(name: string): GuateAchBank | undefined {
  const q = name.toLowerCase()
  return GUATE_ACH_BANKS.find(b =>
    b.name.toLowerCase().includes(q) ||
    b.shortName.toLowerCase().includes(q)
  )
}
