/**
 * Qué va a pasar si se importa este archivo.
 *
 * La carga reconoce a un contacto que ya existe POR SU NIT: si lo encuentra lo
 * actualiza, y si no, crea uno nuevo. Esa regla es invisible hasta que falla, y
 * cuando falla no se nota de inmediato: el archivo entra «sin errores» y la
 * cartera queda con el mismo proveedor repetido, cada copia con un pedazo del
 * saldo.
 *
 * Un archivo real lo muestra entero: 52 filas, ninguna con NIT, diez nombres
 * repetidos —uno de ellos once veces, una fila por factura— y dos que ya
 * estaban cargados. Importado tal cual: 52 proveedores nuevos, «Punto AG El
 * Campo» once veces y «La Paneria» duplicada.
 *
 * Por eso esto no decide nada ni cambia la carga: solo dice en voz alta lo que
 * está por ocurrir, antes de que ocurra.
 */

export interface ContactoExistente {
  name?: string
  taxId?: string
  vendorNumber?: string
  customerNumber?: string
  code?: string
}

export interface FilaRevisada {
  nombre: string
  veces: number
  suma: number
}

export interface ContactoQueYaExiste {
  nombre: string
  numero?: string
  /** Por NIT es seguro; por nombre es parecido y hay que mirarlo. */
  porNit: boolean
}

/**
 * El saldo que le entra a un contacto desde la hoja «Saldos pendientes».
 *
 * No es una cifra suelta: son documentos, cada uno en su moneda y con la tasa
 * del día en que se registró. La pantalla tiene que decir las tres cosas —lo
 * que debe en su moneda, a qué tasa y cuánto es en quetzales—, porque es lo
 * que el contador va a cuadrar contra su balance anterior. Mostrar solo «—»
 * daba a entender que la fila entraba sin saldo.
 */
export interface SaldoPorDocumentos {
  documentos: number
  /** 'GTQ', la moneda extranjera, o 'MIXTA' si el contacto trae de varias. */
  moneda: string
  /** La suma en esa moneda. En MIXTA no significa nada y va en cero. */
  monto: number
  enQuetzales: number
  tasaMin: number
  tasaMax: number
}

export interface RevisionDeContactos {
  total: number
  sinNit: number
  /** Nombres que aparecen en más de una fila del archivo. */
  repetidos: FilaRevisada[]
  yaExisten: ContactoQueYaExiste[]
  /** Cuántas filas traen saldo inicial y cuánto suman. */
  conSaldo: number
  sumaDeSaldos: number
  /** Lo que aporta la hoja «Saldos pendientes», por el NIT que los une. */
  porDocumentos: Record<string, SaldoPorDocumentos>
  documentos: number
  documentosEnQuetzales: number
  /**
   * Documentos en moneda extranjera SIN tipo de cambio.
   *
   * El servidor no los carga: anotarlos a 1 × 1 metería la cartera al balance
   * por una séptima parte de su valor. Se avisan antes, no después.
   */
  documentosSinTasa: number
  /**
   * Documentos cuyo NIT no aparece en ninguna fila de contactos.
   *
   * No se cargan y, peor, no se ven: al listarlos por contacto quedarían
   * fuera de la pantalla sin que nadie los nombre. Suele ser un NIT escrito
   * distinto en las dos hojas.
   */
  documentosSinContacto: number
  /**
   * Los anticipos: lo contrario de una factura.
   *
   * No se suman al saldo del contacto —van a su propia cuenta y al lado
   * contrario de la póliza—, así que se cuentan aparte. Mezclarlos daría un
   * saldo menor al real y haría desaparecer el anticipo del balance.
   */
  anticipos: number
  anticiposEnQuetzales: number
}

/** Sin tildes, sin mayúsculas y sin puntuación: «La Paneria, S.A.» = «LA PANERIA SA». */
export const llanoElNombre = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Solo los dígitos: «467700-3» y «4677003» son el mismo NIT. */
const soloDigitos = (v: unknown): string => String(v ?? '').replace(/[^0-9kK]/g, '').toLowerCase()

const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * Los documentos pendientes, agrupados por el NIT que los une a su contacto.
 *
 * La clave es el NIT TAL CUAL viene escrito —no solo sus dígitos—, porque es
 * así como los une el servidor: un proveedor del exterior anotado como «CF»
 * se une por «CF».
 */
export function saldosPorDocumentos(documentos: Array<Record<string, unknown>> = []) {
  const porNit: Record<string, SaldoPorDocumentos> = {}
  let sinTasa = 0

  let anticipos = 0, anticiposEnQuetzales = 0

  for (const d of documentos) {
    const nit   = String(d.nit ?? '').trim()
    const monto = Number(d.monto ?? 0) || 0
    if (!nit || !monto) continue

    const moneda = (String(d.moneda ?? '').trim() || 'GTQ').toUpperCase()
    const tasa   = Number(d.tipo_cambio ?? 0) || (moneda === 'GTQ' ? 1 : 0)
    if (!tasa) { sinTasa++; continue }

    /**
     * La nota de crédito RESTA del saldo del contacto.
     *
     * Entra con la misma cuenta que la factura pero al lado contrario: lo que
     * se debe es la factura menos su nota de crédito. Sumarla mostraría un
     * saldo mayor al que va a quedar en los libros.
     */
    const clase = String(d.tipo ?? '').trim().toLowerCase()
    const signo = clase === 'nota_credito' ? -1 : 1

    // El anticipo no es cartera: se cuenta aparte y no entra en el saldo.
    if (clase === 'anticipo') {
      anticipos++
      anticiposEnQuetzales = centavos(anticiposEnQuetzales + monto * tasa)
      continue
    }

    const previo   = porNit[nit]
    const mezclada = previo && previo.moneda !== moneda

    porNit[nit] = {
      documentos:  (previo?.documentos ?? 0) + 1,
      moneda:      mezclada ? 'MIXTA' : moneda,
      monto:       mezclada ? 0 : centavos((previo?.monto ?? 0) + signo * monto),
      enQuetzales: centavos((previo?.enQuetzales ?? 0) + signo * monto * tasa),
      tasaMin:     Math.min(previo?.tasaMin ?? tasa, tasa),
      tasaMax:     Math.max(previo?.tasaMax ?? tasa, tasa),
    }
  }

  const enQuetzales = centavos(
    Object.values(porNit).reduce((s, v) => s + v.enQuetzales, 0))

  return {
    porNit,
    documentos: Object.values(porNit).reduce((s, v) => s + v.documentos, 0),
    enQuetzales,
    sinTasa,
    anticipos,
    anticiposEnQuetzales,
  }
}

export function revisarContactos(
  filas: Array<Record<string, unknown>>,
  existentes: ContactoExistente[] = [],
  documentos: Array<Record<string, unknown>> = [],
): RevisionDeContactos {
  const porNit    = new Map<string, ContactoExistente>()
  const porNombre = new Map<string, ContactoExistente>()
  for (const c of existentes) {
    const nit = soloDigitos(c.taxId)
    if (nit) porNit.set(nit, c)
    const nombre = llanoElNombre(c.name)
    if (nombre) porNombre.set(nombre, c)
  }

  const cuenta = new Map<string, FilaRevisada>()
  const yaExisten = new Map<string, ContactoQueYaExiste>()
  let sinNit = 0, conSaldo = 0, sumaDeSaldos = 0

  for (const fila of filas) {
    const nombre = String(fila.nombre ?? '').trim()
    const nit    = soloDigitos(fila.nit)
    const saldo  = Number(fila.saldo_inicial ?? 0) || 0

    if (!nit) sinNit++
    if (saldo) { conSaldo++; sumaDeSaldos += saldo }

    const clave = llanoElNombre(nombre)
    const previo = cuenta.get(clave)
    cuenta.set(clave, {
      nombre,
      veces: (previo?.veces ?? 0) + 1,
      suma:  centavos((previo?.suma ?? 0) + saldo),
    })

    const encontrado = nit ? porNit.get(nit) : porNombre.get(clave)
    if (encontrado && !yaExisten.has(clave)) {
      yaExisten.set(clave, {
        nombre,
        numero: encontrado.vendorNumber ?? encontrado.customerNumber ?? encontrado.code,
        porNit: Boolean(nit && porNit.get(nit)),
      })
    }
  }

  const docs = saldosPorDocumentos(documentos)

  // El NIT tal como está escrito en la hoja de contactos: es lo que los une.
  const nitsDelArchivo = new Set(filas.map(f => String(f.nit ?? '').trim()).filter(Boolean))
  const documentosSinContacto = Object.entries(docs.porNit)
    .filter(([nit]) => !nitsDelArchivo.has(nit))
    .reduce((s, [, v]) => s + v.documentos, 0)

  return {
    total: filas.length,
    sinNit,
    repetidos: [...cuenta.values()].filter(r => r.veces > 1).sort((a, b) => b.veces - a.veces),
    yaExisten: [...yaExisten.values()],
    conSaldo,
    sumaDeSaldos: centavos(sumaDeSaldos),
    porDocumentos:         docs.porNit,
    documentos:            docs.documentos,
    documentosEnQuetzales: docs.enQuetzales,
    documentosSinTasa:     docs.sinTasa,
    documentosSinContacto,
    anticipos:             docs.anticipos,
    anticiposEnQuetzales:  docs.anticiposEnQuetzales,
  }
}
