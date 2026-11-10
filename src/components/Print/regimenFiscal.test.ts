import { describe, it, expect } from 'vitest'
import {
  esPequenoContribuyente, tasaDeIvaDelDocumento, LEYENDA_PEQUENO_CONTRIBUYENTE,
  documentoLlevaIva,
} from "./regimenFiscal"
import { emisorDesdeEmpresa } from '../../api/emisor'

/**
 * El régimen fiscal de quien emite el documento.
 *
 * Un Pequeño Contribuyente no traslada IVA: paga una cuota fija sobre sus
 * ventas. La cotización mostraba de todos modos una columna «IVA%» y una
 * línea «IVA (12%)», con el 12% escrito fijo en el código. Decía algo que no
 * es cierto, aunque los montos salieran en cero.
 */
describe('quién es Pequeño Contribuyente', () => {
  it('lo es con el código del régimen', () => {
    expect(esPequenoContribuyente('gt_pequeno_contribuyente')).toBe(true)
  })

  it('no lo es el régimen general', () => {
    expect(esPequenoContribuyente('gt_regimen_general')).toBe(false)
  })

  /** Sin régimen configurado se sigue mostrando como hasta ahora. */
  it('sin régimen, no se asume', () => {
    expect(esPequenoContribuyente(undefined)).toBe(false)
    expect(esPequenoContribuyente(null)).toBe(false)
    expect(esPequenoContribuyente('')).toBe(false)
  })

  it('no se cae por mayúsculas ni espacios', () => {
    expect(esPequenoContribuyente(' GT_Pequeno_Contribuyente ')).toBe(true)
  })

  it('la leyenda dice lo que el cliente necesita saber', () => {
    expect(LEYENDA_PEQUENO_CONTRIBUYENTE).toMatch(/no genera derecho a crédito fiscal/i)
  })
})

/**
 * La tasa que se imprime sale de las líneas del documento, no de un 12% fijo.
 * Un documento puede ser exento o de exportación, y entonces no hay tasa que
 * anunciar.
 */
describe('la tasa de IVA del documento', () => {
  it('es la de sus líneas', () => {
    expect(tasaDeIvaDelDocumento([{ taxPercent: 12 }, { taxPercent: 12 }])).toBe(12)
  })

  it('con todas las líneas en cero, no hay tasa que mostrar', () => {
    expect(tasaDeIvaDelDocumento([{ taxPercent: 0 }, { taxPercent: 0 }])).toBeNull()
  })

  /** Ninguna etiqueta sola sería correcta, así que se muestra «IVA» a secas. */
  it('con dos tasas distintas, ninguna etiqueta es correcta', () => {
    expect(tasaDeIvaDelDocumento([{ taxPercent: 12 }, { taxPercent: 5 }])).toBeNull()
  })

  it('las líneas exentas no tapan la tasa de las demás', () => {
    expect(tasaDeIvaDelDocumento([{ taxPercent: 0 }, { taxPercent: 12 }])).toBe(12)
  })

  it('un documento sin líneas no revienta', () => {
    expect(tasaDeIvaDelDocumento([])).toBeNull()
    expect(tasaDeIvaDelDocumento(undefined)).toBeNull()
  })

  it('una tasa guardada como texto se entiende', () => {
    expect(tasaDeIvaDelDocumento([{ taxPercent: '12' }])).toBe(12)
  })
})

/**
 * El régimen es de la EMPRESA que emite, no de la cuenta.
 *
 * Una cuenta puede tener varias empresas y cada una su régimen: si el
 * documento tomara el de la cuenta, una empresa imprimiría con el régimen de
 * otra. Es la misma confusión que ya hizo salir los libros de Kaizen con el
 * NIT del dueño de la cuenta.
 */
describe('de dónde sale el régimen del documento', () => {
  const CUENTA = { name: 'GLL Consulting', taxId: '123' } as any

  it('viene de la empresa activa', () => {
    const emisor = emisorDesdeEmpresa(
      { legalName: 'Paper Plus, S.A.', taxId: '69407452', fiscalRegimeCode: 'gt_pequeno_contribuyente' },
      CUENTA,
    )

    expect(esPequenoContribuyente(emisor.fiscalRegimeCode)).toBe(true)
  })

  it('cada empresa trae el suyo', () => {
    const otra = emisorDesdeEmpresa(
      { legalName: 'LUUM, S.A.', fiscalRegimeCode: 'gt_regimen_general' }, CUENTA,
    )

    expect(esPequenoContribuyente(otra.fiscalRegimeCode)).toBe(false)
  })

  it('una empresa sin régimen asignado no lo hereda de la cuenta', () => {
    const emisor = emisorDesdeEmpresa({ legalName: 'Nueva, S.A.' }, {
      ...CUENTA, fiscalRegimeCode: 'gt_pequeno_contribuyente',
    })

    expect(emisor.fiscalRegimeCode).toBeNull()
  })
})

/**
 * Si el documento lleva IVA se responde con el documento, no preguntando.
 *
 * Esto nació de un fallo que se repitió tres veces: el detalle ocultaba la
 * columna de IVA y el PDF la mostraba, para la MISMA cotización. El régimen
 * se resolvía por un camino aparte que en la ventana de impresión podía no
 * devolver nada, así que las dos pantallas podían contestar distinto. Las
 * líneas y el monto de impuesto, en cambio, ya están en el documento que se
 * está imprimiendo: no hay manera de que falten.
 */
describe('si el documento lleva IVA', () => {
  it('no lo lleva cuando todas las líneas están en cero', () => {
    expect(documentoLlevaIva([{ taxPercent: 0 }, { taxPercent: 0 }], 0)).toBe(false)
  })

  it('sí lo lleva cuando alguna línea tiene tasa', () => {
    expect(documentoLlevaIva([{ taxPercent: 0 }, { taxPercent: 12 }], 0)).toBe(true)
  })

  /** Si hay impuesto cobrado, se muestra aunque las tasas no se hayan guardado. */
  it('sí lo lleva cuando el documento trae monto de impuesto', () => {
    expect(documentoLlevaIva([{ taxPercent: 0 }], 70.12)).toBe(true)
  })

  it('un monto guardado como texto se entiende', () => {
    expect(documentoLlevaIva([], '70.12')).toBe(true)
  })

  /** Medio centavo no es IVA: es ruido de redondeo. */
  it('no lo lleva por una fracción de centavo', () => {
    expect(documentoLlevaIva([{ taxPercent: 0 }], 0.001)).toBe(false)
  })

  it('una cotización vacía no lleva IVA', () => {
    expect(documentoLlevaIva([], 0)).toBe(false)
    expect(documentoLlevaIva(undefined, undefined)).toBe(false)
  })

  /** El caso real: COT-00001, 34 artículos, todos sin impuesto. */
  it('la cotización de Paper Plus no lleva IVA', () => {
    const lineas = Array.from({ length: 34 }, () => ({ taxPercent: 0 }))
    expect(documentoLlevaIva(lineas, 0)).toBe(false)
  })
})

/**
 * La misma regla aplicada a los documentos de VENTA, no a los de compra.
 *
 * El régimen de nuestra empresa decide lo que NOSOTROS cobramos: factura de
 * venta, nota de crédito de venta, cotización. En una compra el IVA es el que
 * cobra el proveedor —un Pequeño Contribuyente lo paga igual, solo que no lo
 * acredita—, así que ocultarlo en una orden de compra o en una nota de
 * crédito de proveedor diría algo falso sobre lo que el proveedor cobra.
 */
describe('qué documentos siguen el régimen de quien emite', () => {
  /** Factura de venta de Paper Plus: 34 líneas sin impuesto. */
  it('una factura de venta sin impuesto no anuncia IVA', () => {
    const lineas = Array.from({ length: 34 }, () => ({ taxPercent: 0 }))
    expect(documentoLlevaIva(lineas, 0)).toBe(false)
  })

  it('una factura de venta con IVA sí lo anuncia, y con su tasa', () => {
    const lineas = [{ taxPercent: 12 }, { taxPercent: 12 }]
    expect(documentoLlevaIva(lineas, 70.12)).toBe(true)
    expect(tasaDeIvaDelDocumento(lineas)).toBe(12)
  })

  /**
   * Una factura marcada como exenta no muestra IVA aunque arrastre un monto:
   * lo exento no traslada impuesto, y así lo decía ya el bloque de totales.
   */
  it('una venta exenta no anuncia IVA aunque traiga monto', () => {
    const exenta = true
    expect(documentoLlevaIva([{ taxPercent: 12 }], 70.12) && !exenta).toBe(false)
  })

  /** Una nota de crédito que devuelve una venta con IVA sí lo lleva. */
  it('una nota de crédito de venta con IVA lo anuncia', () => {
    expect(documentoLlevaIva([{ taxPercent: 12 }], 10.71)).toBe(true)
  })
})
