import type { TaxCategory, TaxSubtype, TaxApplicability } from '../api/impuestos'
import type { LibroSATConfig } from '../api/libros-sat'

export interface TaxTemplateItem {
  code:               string
  name:               string
  description:        string
  category:           TaxCategory
  subtype:            TaxSubtype
  applicability:      TaxApplicability
  rate:               number
  isInclusive:        boolean
  isWithholding:      boolean
  isDefault?:         boolean
  isActive:           boolean
  libroVentasCol?:    string
  libroComprasCol?:   string
  // Código de cuenta a vincular automáticamente (se busca por código exacto en el catálogo)
  salesAccountCode?:    string
  purchaseAccountCode?: string
}

export interface TaxRegimeTemplate {
  regimeCode:  string   // 'RG' | 'PC' | 'AC'
  regimeName:  string
  satForm:     string   // 'SAT-2237' | 'SAT-2046'
  description: string
  ventas:      TaxTemplateItem[]
  compras:     TaxTemplateItem[]
  libroConfig: LibroSATConfig
}

// ── Régimen General de IVA (RG) — SAT-2237 ────────────────────────────────

const RG_VENTAS: TaxTemplateItem[] = [
  {
    code: 'RG-V01', name: 'Venta de bienes gravada 12%',
    description: 'Decreto 27-92 Art. 3, 10 — Venta de bienes muebles gravada. Emite FEL.',
    category: 'iva', subtype: 'simple', applicability: 'sales',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroVentasCol: 'bienes', salesAccountCode: '2210',
  },
  {
    code: 'RG-V02', name: 'Prestación de servicios gravada 12%',
    description: 'Decreto 27-92 Art. 3, 10 — Servicios gravados: honorarios, arrendamientos, consultoría.',
    category: 'iva', subtype: 'simple', applicability: 'sales',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroVentasCol: 'servicios', salesAccountCode: '2210',
  },
  {
    code: 'RG-V03', name: 'Exportación de bienes (tasa 0%)',
    description: 'Decreto 27-92 Art. 2 num. 3, Art. 25 — Exportación 0%; genera derecho a crédito fiscal. SAT-2157.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'exportacion',
  },
  {
    code: 'RG-V04', name: 'Exportación de servicios (tasa 0%)',
    description: 'Decreto 27-92 Art. 2 num. 3, Art. 25 — Servicio prestado a beneficiario en el extranjero.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'exportacion',
  },
  {
    code: 'RG-V05', name: 'Venta exenta — bienes/servicios Art. 7',
    description: 'Decreto 27-92 Art. 7 — Bienes y servicios exentos (vivienda popular, medicamentos genéricos, etc.).',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'exento',
  },
  {
    code: 'RG-V06', name: 'Venta de activo fijo gravada 0%',
    description: 'Decreto 27-92 Art. 3 — Baja de activo fijo; columna bienes pero sin débito fiscal.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'bienes',
  },
  {
    code: 'RG-V07', name: 'Nota de crédito / devolución venta gravada',
    description: 'Decreto 27-92 Art. 20, 29 — Reduce el débito fiscal del período. Enlaza al NCRE original.',
    category: 'iva', subtype: 'simple', applicability: 'sales',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroVentasCol: 'bienes', salesAccountCode: '2210',
  },
]

const RG_COMPRAS: TaxTemplateItem[] = [
  {
    code: 'RG-C01', name: 'Compra de bienes gravada 12%',
    description: 'Decreto 27-92 Art. 16-17 — Crédito fiscal acreditable. Requiere FEL válida.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true, isDefault: true,
    libroComprasCol: 'bienes', purchaseAccountCode: '1150',
  },
  {
    code: 'RG-C02', name: 'Adquisición de servicios gravada 12%',
    description: 'Decreto 27-92 Art. 16-17 — Honorarios, arrendamientos, mantenimiento, servicios profesionales.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroComprasCol: 'servicios', purchaseAccountCode: '1150',
  },
  {
    code: 'RG-C03', name: 'Importación de bienes gravada 12%',
    description: 'Decreto 27-92 Art. 3 num. 2, Art. 27 — IVA pagado en Aduanas sobre valor CIF. Soporte: póliza importación.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: false, isWithholding: false, isActive: true,
    libroComprasCol: 'importacion', purchaseAccountCode: '1150',
  },
  {
    code: 'RG-C04', name: 'Compra a proveedor exento (Art. 7/8)',
    description: 'Decreto 27-92 Art. 7, 8 — Sin IVA acreditable. Costo/gasto al 100%. Útil: ONGs, universidades, Estado.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroComprasCol: 'exento',
  },
  {
    code: 'RG-C05', name: 'Compra de activo fijo gravada 12%',
    description: 'Decreto 27-92 Art. 16-17 — Crédito fiscal igual a compras de inventario. Separa para capitalizar en ERP.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroComprasCol: 'bienes', purchaseAccountCode: '1150',
  },
  {
    code: 'RG-C06', name: 'Compra a Pequeño Contribuyente',
    description: 'Decreto 27-92 Art. 47 — Sin crédito fiscal; columna "Pequeño Contribuyente" del libro de compras.',
    category: 'iva_pequeno_contribuyente', subtype: 'pequeno_contribuyente', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroComprasCol: 'pequenoContribuyente',
  },
  {
    code: 'RG-C07', name: 'Nota de crédito / devolución compra gravada',
    description: 'Decreto 27-92 Art. 20, 29 — Reduce el crédito fiscal del período. Enlaza al NCRE original.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroComprasCol: 'bienes', purchaseAccountCode: '1150',
  },
]

// ── Pequeño Contribuyente (PC) — SAT-2046 ─────────────────────────────────

const PC_VENTAS: TaxTemplateItem[] = [
  {
    code: 'PC-V01', name: 'Venta de bienes — registro PC 0%',
    description: 'Decreto 27-92 Art. 45-50 — PC cobra el precio total sin desglosar IVA. SAT-2046 col. Bienes.',
    category: 'iva_pequeno_contribuyente', subtype: 'pequeno_contribuyente', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroVentasCol: 'totalBienes',
  },
  {
    code: 'PC-V02', name: 'Venta de servicios — registro PC 0%',
    description: 'Decreto 27-92 Art. 45-50 — PC cobra el precio total sin desglosar IVA. SAT-2046 col. Servicios.',
    category: 'iva_pequeno_contribuyente', subtype: 'pequeno_contribuyente', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'totalServicios',
  },
]

const PC_COMPRAS: TaxTemplateItem[] = [
  {
    code: 'PC-C01', name: 'Compra de bienes (IVA no acreditable)',
    description: 'Decreto 27-92 Art. 50 — PC paga IVA 12% al proveedor pero no puede acreditarlo; se registra como costo.',
    category: 'iva_pequeno_contribuyente', subtype: 'pequeno_contribuyente', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroComprasCol: 'bienes',
  },
  {
    code: 'PC-C02', name: 'Adquisición de servicios (IVA no acreditable)',
    description: 'Decreto 27-92 Art. 50 — Igual tratamiento que PC-C01, aplicado a servicios recibidos.',
    category: 'iva_pequeno_contribuyente', subtype: 'pequeno_contribuyente', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroComprasCol: 'servicios',
  },
]

// ── Asociación Civil / ONG (AC) ────────────────────────────────────────────

const AC_VENTAS: TaxTemplateItem[] = [
  {
    code: 'AC-V01', name: 'Cuota de afiliación / cuota periódica',
    description: 'Decreto 27-92 Art. 7 num. 10 — Exenta. No se emite factura con IVA.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroVentasCol: 'exento',
  },
  {
    code: 'AC-V02', name: 'Donación / aporte recibido',
    description: 'Decreto 27-92 Art. 7 num. 9 — Exenta. No constituye venta; documentar con recibo de donación.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'exento',
  },
  {
    code: 'AC-V03', name: 'Servicio propio de su fin social',
    description: 'Decreto 27-92 Art. 7 num. 13 — Exenta solo si la ONG no distribuye utilidades y el servicio corresponde a su objeto autorizado.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'exento',
  },
  {
    code: 'AC-V04', name: 'Venta de bienes/servicios ajenos a su objeto (12%)',
    description: 'Decreto 27-92 Art. 3, 10 — Si la ONG realiza actividad mercantil fuera de su fin social, pierde la exención en esa operación.',
    category: 'iva', subtype: 'simple', applicability: 'sales',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroVentasCol: 'bienes', salesAccountCode: '2210',
  },
]

const AC_COMPRAS: TaxTemplateItem[] = [
  {
    code: 'AC-C01', name: 'Compra de bienes (consumidor final exento)',
    description: 'Decreto 27-92 Art. 3 — ONG como consumidor final; IVA es costo, sin crédito fiscal.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroComprasCol: 'exento',
  },
  {
    code: 'AC-C02', name: 'Adquisición de servicios (consumidor final exento)',
    description: 'Decreto 27-92 Art. 3 — Igual tratamiento que AC-C01, aplicado a servicios.',
    category: 'iva_exento', subtype: 'exempt', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroComprasCol: 'exento',
  },
]

// ── Configuraciones de Libro SAT por régimen ───────────────────────────────

const LIBRO_RG: LibroSATConfig = {
  ventas: [
    { key: 'bienes',      label: 'Ventas gravadas (bienes)',          sortOrder: 1, isActive: true },
    { key: 'servicios',   label: 'Servicios gravados',                sortOrder: 2, isActive: true },
    { key: 'exportacion', label: 'Exportaciones',                     sortOrder: 3, isActive: true },
    { key: 'exento',      label: 'Ventas/transferencias exentas',     sortOrder: 4, isActive: true },
  ],
  compras: [
    { key: 'bienes',               label: 'Compras adquiridas (bienes)',   sortOrder: 1, isActive: true },
    { key: 'servicios',            label: 'Servicios adquiridos',          sortOrder: 2, isActive: true },
    { key: 'combustibles',         label: 'Combustibles',                  sortOrder: 3, isActive: true },
    { key: 'importacion',          label: 'Importaciones',                 sortOrder: 4, isActive: true },
    { key: 'pequenoContribuyente', label: 'Peq. Contribuyente',            sortOrder: 5, isActive: true },
    { key: 'exento',               label: 'Adquisiciones exentas',         sortOrder: 6, isActive: true },
  ],
}

const LIBRO_PC: LibroSATConfig = {
  ventas: [
    { key: 'totalBienes',    label: 'Total Facturado (Bienes) — SAT-2046',    sortOrder: 1, isActive: true },
    { key: 'totalServicios', label: 'Total Facturado (Servicios) — SAT-2046', sortOrder: 2, isActive: true },
  ],
  compras: [
    { key: 'bienes',    label: 'Compras adquiridas (bienes)',  sortOrder: 1, isActive: true },
    { key: 'servicios', label: 'Servicios adquiridos',         sortOrder: 2, isActive: true },
  ],
}

const LIBRO_AC: LibroSATConfig = {
  ventas: [
    { key: 'exento', label: 'Ventas / Transferencias Exentas', sortOrder: 1, isActive: true },
  ],
  compras: [
    { key: 'exento', label: 'Adquisiciones Exentas', sortOrder: 1, isActive: true },
  ],
}

// ── Catálogo de plantillas ─────────────────────────────────────────────────

export const GT_TEMPLATES: TaxRegimeTemplate[] = [
  {
    regimeCode:  'RG',
    regimeName:  'Régimen General de IVA',
    satForm:     'SAT-2237',
    description: 'Contribuyente inscrito en IVA. Emite FEL, genera crédito y débito fiscal, libro mensual SAT-2237.',
    ventas:      RG_VENTAS,
    compras:     RG_COMPRAS,
    libroConfig: LIBRO_RG,
  },
  {
    regimeCode:  'PC',
    regimeName:  'Pequeño Contribuyente',
    satForm:     'SAT-2046',
    description: 'Ingresos ≤ Q500,285/año. Paga 5% sobre ventas. Sin crédito fiscal. Libro simplificado SAT-2046.',
    ventas:      PC_VENTAS,
    compras:     PC_COMPRAS,
    libroConfig: LIBRO_PC,
  },
  {
    regimeCode:  'AC',
    regimeName:  'Asociación Civil / ONG',
    satForm:     'No obligatorio',
    description: 'Entidad sin fines de lucro legalmente constituida. Exenta en su actividad propia; 12% si realiza actividad mercantil.',
    ventas:      AC_VENTAS,
    compras:     AC_COMPRAS,
    libroConfig: LIBRO_AC,
  },
]

// Detecta el template más cercano según el código de régimen guardado en onboarding
export function detectTemplate(regimeCode: string | undefined): TaxRegimeTemplate {
  if (!regimeCode) return GT_TEMPLATES[0]
  const code = regimeCode.toUpperCase()
  return (
    GT_TEMPLATES.find(t => t.regimeCode === code) ??
    (code.includes('PC') || code.includes('PEQUENO') ? GT_TEMPLATES[1] :
     code.includes('AC') || code.includes('ONG') ? GT_TEMPLATES[2] :
     GT_TEMPLATES[0])  // RG por defecto
  )
}
