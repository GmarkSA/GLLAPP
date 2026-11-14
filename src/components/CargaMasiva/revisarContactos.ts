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

export interface RevisionDeContactos {
  total: number
  sinNit: number
  /** Nombres que aparecen en más de una fila del archivo. */
  repetidos: FilaRevisada[]
  yaExisten: ContactoQueYaExiste[]
  /** Cuántas filas traen saldo inicial y cuánto suman. */
  conSaldo: number
  sumaDeSaldos: number
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

export function revisarContactos(
  filas: Array<Record<string, unknown>>,
  existentes: ContactoExistente[] = [],
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

  return {
    total: filas.length,
    sinNit,
    repetidos: [...cuenta.values()].filter(r => r.veces > 1).sort((a, b) => b.veces - a.veces),
    yaExisten: [...yaExisten.values()],
    conSaldo,
    sumaDeSaldos: centavos(sumaDeSaldos),
  }
}
