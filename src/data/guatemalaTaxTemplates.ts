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
  isr?:        TaxTemplateItem[]   // ISR en la fuente / retenciones ISR
  riva?:       TaxTemplateItem[]   // Retenciones de IVA (agentes retenedores)
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
    category: 'iva_pequeno_contribuyente', subtype: 'simple', applicability: 'purchases',
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
  {
    code: 'RG-C08', name: 'Compra de combustible gravada 12%',
    description: 'Decreto 27-92 Art. 16-17 — Crédito fiscal acreditable. Columna específica "Combustibles" del Libro de Compras SAT-2237.',
    category: 'iva', subtype: 'simple', applicability: 'purchases',
    rate: 12, isInclusive: true, isWithholding: false, isActive: true,
    libroComprasCol: 'combustibles', purchaseAccountCode: '1150',
  },
]

// ── Pequeño Contribuyente (PC) — SAT-2046 ─────────────────────────────────

const PC_VENTAS: TaxTemplateItem[] = [
  {
    code: 'PC-V01', name: 'Venta de bienes — registro PC 0%',
    description: 'Decreto 27-92 Art. 45-50 — PC cobra el precio total sin desglosar IVA. SAT-2046 col. Bienes.',
    category: 'iva_pequeno_contribuyente', subtype: 'simple', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroVentasCol: 'totalBienes',
  },
  {
    code: 'PC-V02', name: 'Venta de servicios — registro PC 0%',
    description: 'Decreto 27-92 Art. 45-50 — PC cobra el precio total sin desglosar IVA. SAT-2046 col. Servicios.',
    category: 'iva_pequeno_contribuyente', subtype: 'simple', applicability: 'sales',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true,
    libroVentasCol: 'totalServicios',
  },
]

const PC_COMPRAS: TaxTemplateItem[] = [
  {
    code: 'PC-C01', name: 'Compra de bienes (IVA no acreditable)',
    description: 'Decreto 27-92 Art. 50 — PC paga IVA 12% al proveedor pero no puede acreditarlo; se registra como costo.',
    category: 'iva_pequeno_contribuyente', subtype: 'simple', applicability: 'purchases',
    rate: 0, isInclusive: false, isWithholding: false, isActive: true, isDefault: true,
    libroComprasCol: 'bienes',
  },
  {
    code: 'PC-C02', name: 'Adquisición de servicios (IVA no acreditable)',
    description: 'Decreto 27-92 Art. 50 — Igual tratamiento que PC-C01, aplicado a servicios recibidos.',
    category: 'iva_pequeno_contribuyente', subtype: 'simple', applicability: 'purchases',
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

// ── ISR en la Fuente (retenciones ISR — aplica a todos los regímenes RG/PC) ─

const RG_ISR: TaxTemplateItem[] = [
  {
    code: 'ISR-01',
    name: 'Retención ISR honorarios/servicios — Tramo 1 (hasta Q30,000)',
    description: 'Decreto 26-92 Art. 72 — Retención 5% sobre pagos a proveedores de servicios en Régimen Opcional Simplificado. Aplica al tramo hasta Q30,000 acumulado en el año. Formulario SAT-1331 (Sistema Retenciones Web) + constancia SAT-1911.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 5, isInclusive: false, isWithholding: true, isActive: true, isDefault: true,
  },
  {
    code: 'ISR-02',
    name: 'Retención ISR honorarios/servicios — Tramo 2 (excedente sobre Q30,000)',
    description: 'Decreto 26-92 Art. 72 — Retención 7% sobre el excedente acumulado de Q30,000 en el año. Mismo proveedor y formulario que ISR-01. Formulario SAT-1331 + constancia SAT-1911.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 7, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-EXT-01',
    name: 'Retención ISR no residente — 3%',
    description: 'Decreto 10-2012 Art. 102-105 — Pago o acreditamiento a persona no residente sin establecimiento permanente en Guatemala. Tasa residual mínima; verificar tipo de renta. Formulario SAT-1351 / SAT-1352 (Anexos de Retenciones a No Residentes). Carácter definitivo.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 3, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-EXT-02',
    name: 'Retención ISR no residente — 5%',
    description: 'Decreto 10-2012 Art. 102-105 — Aplica a: transporte internacional de carga/pasajeros; primas de seguros/fianzas/reaseguros; telecomunicaciones; energía eléctrica suministrada desde el exterior; dividendos y reparto de utilidades/ganancias a matrices en el extranjero. Formulario SAT-1351 / SAT-1352. Carácter definitivo.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 5, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-EXT-03',
    name: 'Retención ISR no residente — 10%',
    description: 'Decreto 10-2012 Art. 102-105 — Aplica a intereses pagados o acreditados a no residentes por actividades lucrativas, del trabajo o de capital. Formulario SAT-1351 / SAT-1352. Carácter definitivo.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 10, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-EXT-04',
    name: 'Retención ISR no residente — 15%',
    description: 'Decreto 10-2012 Art. 102-105 — Aplica a: sueldos/salarios/dietas/comisiones/bonificaciones que no impliquen reintegro de gastos; pagos a deportistas y artistas; regalías; honorarios; asesoramiento científico/económico/técnico/financiero. Formulario SAT-1351 / SAT-1352. Carácter definitivo.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 15, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-EXT-05',
    name: 'Retención ISR no residente — 25%',
    description: 'Decreto 10-2012 Art. 102-105 — Categoría residual: cualquier otra renta gravada a no residentes no especificada en los tipos anteriores (3%/5%/10%/15%). Usar como código por defecto solo tras descartar los específicos. Formulario SAT-1351 / SAT-1352. Carácter definitivo.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 25, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-FE-01',
    name: 'Retención ISR Factura Especial — Tramo 1 (hasta Q30,000)',
    description: 'Decreto 26-92 Art. 72 — Retención 5% en Factura Especial emitida a productor agropecuario/artesanal/material reciclado no inscrito ante SAT. Aplica al tramo hasta Q30,000. La copia de la Factura Especial sirve como constancia de retención; se declara en SAT-1331 (opción Facturas Especiales).',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 5, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-FE-02',
    name: 'Retención ISR Factura Especial — Tramo 2 (excedente sobre Q30,000)',
    description: 'Decreto 26-92 Art. 72 — Retención 7% sobre el excedente de Q30,000 en Factura Especial. Mismo formulario que ISR-FE-01. El umbral acumula todos los pagos del año al mismo vendedor individual no inscrito.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 7, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-CAP-01',
    name: 'Retención ISR sobre dividendos y distribución de utilidades',
    description: 'Decreto 10-2012 Art. 84, 90 — Retención 5% sobre el monto bruto distribuido. La sociedad retiene en el momento del pago/acreditamiento/abono. Regla especial grupos financieros: retención solo cuando el dividendo se distribuye a los accionistas de la entidad controladora. Pago definitivo desde el momento de la retención. Formulario SAT-1331 (opción Rentas de Capital, vía Retenciones Web) o SAT-1321 si el beneficiario autoliquida.',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 5, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'ISR-CAP-02',
    name: 'Retención ISR sobre rentas de capital mobiliario e inmobiliario',
    description: 'Decreto 10-2012 Art. 92 — Retención 10% sobre la base imponible (renta neta o ganancia). Aplica a intereses, alquileres, regalías o ganancias de capital fuera del giro habitual de negocio. Pago definitivo. Formulario SAT-1331 (Rentas de Capital) si hay agente retenedor; SAT-1321 si el contribuyente autoliquida (ej. venta de inmueble, dentro de los 10 días del mes siguiente).',
    category: 'isr', subtype: 'simple', applicability: 'purchases',
    rate: 10, isInclusive: false, isWithholding: true, isActive: true,
  },
]

// ── Retenciones de IVA — Agentes retenedores (RIVA) ──────────────────────────

const RG_RIVA: TaxTemplateItem[] = [
  {
    code: 'RIVA-01',
    name: 'Retención IVA — Agropecuario exportador (65% del IVA)',
    description: 'Decreto 20-2006 Art. 1 — Agente retenedor exportador de productos agropecuarios/pecuarios (incluye café excepto tostado/soluble, azúcar sin refinar, banano, cardamomo, caña, algodón, leche y otros). Retiene el 65% del IVA incluido en la factura del proveedor (al vendedor solo se le paga el 35% del IVA). Umbral: a partir de Q2,500. Formulario SAT-2340. Declaración Jurada de Retenciones del IVA vía Sistema Retenciones Web.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 65, isInclusive: false, isWithholding: true, isActive: true, isDefault: true,
  },
  {
    code: 'RIVA-02',
    name: 'Retención IVA — Exportador bienes no agropecuarios (15% del IVA)',
    description: 'Decreto 20-2006 Art. 1 — Exportador habitual de bienes/productos NO agropecuarios. Retiene el 15% del IVA incluido en la factura. Umbral: a partir de Q2,500. Formulario SAT-2340. Ver nota de activación en código IVA-EXP-01.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 15, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'RIVA-03',
    name: 'Retención IVA — Exportador de servicios (15% del IVA)',
    description: 'Decreto 20-2006 Art. 1 — Exportador habitual de servicios. Retiene el 15% del IVA incluido en la factura de servicios recibidos. Umbral: a partir de Q2,500. Formulario SAT-2340. Ver nota de activación en código IVA-EXP-01.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 15, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'RIVA-04',
    name: 'Retención IVA — Decreto 29-89 Maquila (65% del IVA)',
    description: 'Decreto 20-2006 Art. 1 — Beneficiario del Decreto 29-89 (Fomento y Desarrollo de la Actividad Exportadora y de Maquila). Retiene el 65% del IVA incluido en facturas de bienes y servicios en general. Umbral: a partir de Q2,500. Régimen específico para empresas maquiladoras calificadas; requiere activación separada aunque el beneficiario también sea exportador. Formulario SAT-2340.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 65, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'RIVA-05',
    name: 'Retención IVA — Compra a Pequeño Contribuyente (5%)',
    description: 'Decreto 20-2006 y su Reglamento (Acuerdo Gubernativo 425-2006) — Modificador general: aplica a CUALQUIER agente retenedor de IVA (exportador, Estado, maquila) cuando compra a un Pequeño Contribuyente. La tasa 5% sustituye la tarifa que correspondería según la categoría del agente. El sistema de Retenciones Web de SAT determina automáticamente esta tarifa reducida al identificar que el NIT del vendedor corresponde a un Pequeño Contribuyente. Umbral: a partir de Q2,500.01. Formulario SAT-2340.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 5, isInclusive: false, isWithholding: true, isActive: true,
  },
  {
    code: 'IVA-FE-01',
    name: 'Retención IVA — Factura Especial (12% sobre valor de la factura)',
    description: 'Decreto 27-92 Art. 52 "A" (adicionado por Decreto 4-2012 Art. 19) — El comprador que emite Factura Especial por cuenta de un productor agropecuario/artesanal/reciclado no inscrito ante SAT calcula el IVA (12%) sobre el valor total de la factura especial; este IVA sustituye el débito fiscal que el vendedor no inscrito no puede generar. Constancia = copia de la Factura Especial; declaración en SAT-1331 (opción Facturas Especiales) para la porción de ISR asociada. NOTA: este código va acompañado de ISR-FE-01/ISR-FE-02 — en la misma factura especial se retienen ambos impuestos simultáneamente.',
    category: 'iva', subtype: 'retention_tax', applicability: 'purchases',
    rate: 12, isInclusive: false, isWithholding: true, isActive: true,
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
    { key: 'exento', label: 'Ventas / Transferencias Exentas',      sortOrder: 1, isActive: true },
    { key: 'bienes', label: 'Ventas gravadas (actividad mercantil)', sortOrder: 2, isActive: true },
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
    isr:         RG_ISR,
    riva:        RG_RIVA,
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
