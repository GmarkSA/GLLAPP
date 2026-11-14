import dayjs from 'dayjs'
import { deLaPlantilla, type ColumnaDePlantilla } from './plantillaCarga'

/**
 * Los contactos que YA existen, escritos en las columnas de la plantilla.
 *
 * Una plantilla en blanco sirve para empezar de cero. Para corregir en masa lo
 * que ya está cargado —ponerle la cuenta por pagar a sesenta proveedores,
 * arreglar NIT, cambiar términos de pago— hace falta la lista actual EN EL
 * MISMO formato que la carga acepta: se baja, se edita en Excel y se vuelve a
 * subir.
 *
 * Por eso esto es el inverso exacto de la lectura: cada columna devuelve lo
 * que la carga espera leer de vuelta, incluidas las palabras del vocabulario
 * («empresa», «30_dias») y no los códigos internos. Lo que se baja se puede
 * volver a subir sin tocar nada.
 */

export interface CatalogoParaExportar {
  cuentas:   Array<{ id?: string; code: string; name: string }>
  impuestos: Array<{ id?: string; code: string; name: string }>
}

export interface OpcionesDeExportacion {
  /** Campo del contacto con su cuenta: `payableAccountId` o `receivableAccountId`. */
  campoCuenta: string
  /** Su contrapartida: `expenseAccountId` o `incomeAccountId`. */
  campoContrapartida: string
  catalogo: CatalogoParaExportar
}

type Contacto = Record<string, any>

/**
 * De dónde sale cada columna.
 *
 * Las dos cuentas no están aquí porque su campo cambia entre clientes y
 * proveedores; se resuelven con las opciones.
 */
const DESDE_EL_CONTACTO: Record<string, (c: Contacto) => unknown> = {
  nombre:              c => c.name,
  tipo:                c => c.type,
  razon_social:        c => c.legalName,
  nit:                 c => c.taxId,
  nombres:             c => c.firstName,
  apellidos:           c => c.lastName,
  email:               c => c.email,
  telefono:            c => c.phone,
  celular:             c => c.mobile,
  sitio_web:           c => c.website,
  moneda:              c => c.currency,
  terminos_pago:       c => c.paymentTerms,
  limite_credito:      c => c.creditLimit,
  estado:              c => c.status,
  tratamiento_fiscal:  c => c.taxTreatment,
  retencion_iva:       c => c.ivaRetentionCode,
  retiene_isr:         c => c.tdsEnabled,
  direccion:           c => c.billingAddress?.address,
  ciudad:              c => c.billingAddress?.city,
  departamento:        c => c.billingAddress?.state,
  codigo_postal:       c => c.billingAddress?.zipCode,
  pais:                c => c.billingAddress?.country,
  saldo_inicial:       c => c.openingBalance,
  fecha_saldo_inicial: c => c.openingBalanceDate,
  portal_habilitado:   c => c.portalEnabled,
  notas:               c => c.notes,
}

/** El código de una cuenta o de un impuesto a partir de lo que guarda la ficha. */
const codigoDe = (
  lista: Array<{ id?: string; code: string }>,
  valor: unknown,
): string => {
  const v = String(valor ?? '').trim()
  if (!v) return ''
  // La ficha guarda unas veces el id y otras el código: se admite cualquiera.
  return lista.find(x => x.id === v)?.code
      ?? lista.find(x => x.code === v)?.code
      ?? v
}

/** Lo que va escrito en la celda, según el tipo de la columna. */
const celda = (col: ColumnaDePlantilla, valor: unknown): unknown => {
  if (valor === null || valor === undefined || valor === '') return ''

  if (col.vocabulario) return deLaPlantilla(col.vocabulario, valor)

  switch (col.tipo) {
    case 'si_no':  return valor ? 'Sí' : 'No'
    case 'fecha': {
      const d = dayjs(String(valor).slice(0, 10))
      return d.isValid() ? d.format('DD/MM/YYYY') : ''
    }
    case 'moneda':
    case 'numero': {
      const n = Number(valor)
      return Number.isFinite(n) && n !== 0 ? n : ''
    }
    default: return String(valor)
  }
}

export function filasDeContactos(
  columnas: ColumnaDePlantilla[],
  contactos: Contacto[],
  opciones: OpcionesDeExportacion,
): Array<Record<string, unknown>> {
  const { cuentas, impuestos } = opciones.catalogo

  return (contactos ?? []).map(contacto => {
    const fila: Record<string, unknown> = {}

    for (const col of columnas) {
      let crudo: unknown

      switch (col.clave) {
        // Las cuentas y los impuestos se guardan por id; la plantilla habla
        // por código, que es lo único que una persona puede escribir.
        case 'cuenta_contacto':
        case 'cuenta_por_cobrar':
          crudo = codigoDe(cuentas, contacto[opciones.campoCuenta]); break
        case 'cuenta_contrapartida':
        case 'cuenta_ingresos':
          crudo = codigoDe(cuentas, contacto[opciones.campoContrapartida]); break
        case 'impuesto_iva':
          crudo = codigoDe(impuestos, contacto.taxCode); break
        case 'impuesto_isr':
          crudo = codigoDe(impuestos, contacto.tdsTaxCode); break
        default:
          crudo = DESDE_EL_CONTACTO[col.clave]?.(contacto)
      }

      fila[col.titulo] = celda(col, crudo)
    }

    return fila
  })
}
