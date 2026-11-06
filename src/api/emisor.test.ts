import { describe, it, expect } from 'vitest'
import { emisorDesdeEmpresa } from './emisor'
import type { OrganizationProfile } from './configuracion'

/**
 * Quién aparece emitiendo el documento.
 *
 * El encabezado muestra lo mismo que Perfil de organización muestra para la
 * empresa activa, con la misma prioridad campo por campo. El título es la razón
 * social.
 *
 * Caso real reportado: estando en Kaizen, la factura salía encabezada con Mario
 * de Paz. Y en la primera corrección (#669) el encabezado quedó sin dirección y
 * con el nombre comercial.
 */

/** Lo que devuelve el perfil (`/tenants/profile`): la dirección y el contacto del perfil. */
const PERFIL: OrganizationProfile = {
  name:      'Mario de Paz',
  legalName: 'Mario Alberto de Paz',
  taxId:     '9604707',
  address:   '28-21 23 AVENIDA RESIDENCIAL PORTAL DE SAN ISIDRO 3 ZONA 16',
  city:      'GUATEMALA',
  state:     'GUATEMALA',
  country:   'Guatemala',
  zipCode:   '01016',
  email:     'l_chajon@hotmail.com',
  phone:     '30199497',
  website:   '',
  logoUrl:   'https://cdn/logo.png',
  currency:  'GTQ',
  timezone:  'America/Guatemala',
}

const KAIZEN = {
  id:        'empresa-kaizen',
  legalName: 'KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA',
  tradeName: 'KAIZEN BUSINESS SOLUTIONS',
  taxId:     '117457620',
}

const MARIO = {
  id:        'empresa-mario',
  legalName: 'Mario Alberto de Paz',
  tradeName: 'Mario de Paz',
  taxId:     '9604707',
}

describe('Encabezado del documento', () => {
  describe('estando en Kaizen', () => {
    const emisor = emisorDesdeEmpresa(KAIZEN, PERFIL)

    // El fallo reportado: la factura de Kaizen decía Mario de Paz
    it('encabeza con la razón social de Kaizen', () => {
      expect(emisor.name).toBe('KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA')
      expect(emisor.legalName).toBe('KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA')
    })

    it('lleva el NIT de Kaizen', () => {
      expect(emisor.taxId).toBe('117457620')
    })

    // Lo que rompió el #669: el encabezado quedó sin dirección
    it('lleva la dirección que muestra su perfil', () => {
      expect(emisor.address).toBe(PERFIL.address)
      expect(emisor.city).toBe(PERFIL.city)
      expect(emisor.state).toBe(PERFIL.state)
      expect(emisor.zipCode).toBe(PERFIL.zipCode)
      expect(emisor.country).toBe(PERFIL.country)
    })

    it('lleva el correo, el teléfono y el logotipo que muestra su perfil', () => {
      expect(emisor.email).toBe(PERFIL.email)
      expect(emisor.phone).toBe(PERFIL.phone)
      expect(emisor.logoUrl).toBe(PERFIL.logoUrl)
    })
  })

  describe('estando en Mario de Paz', () => {
    const emisor = emisorDesdeEmpresa(MARIO, PERFIL)

    it('encabeza con la razón social y el NIT de Mario', () => {
      expect(emisor.name).toBe('Mario Alberto de Paz')
      expect(emisor.taxId).toBe('9604707')
    })

    it('las dos empresas no se confunden', () => {
      expect(emisor.taxId).not.toBe(emisorDesdeEmpresa(KAIZEN, PERFIL).taxId)
    })
  })

  describe('misma prioridad que Perfil de organización', () => {
    it('razón social: la de la empresa; si no tiene, la del perfil', () => {
      expect(emisorDesdeEmpresa({ ...KAIZEN, legalName: '' }, PERFIL).legalName).toBe(PERFIL.legalName)
    })

    it('NIT: el de la empresa; si no tiene, el del perfil', () => {
      expect(emisorDesdeEmpresa({ ...KAIZEN, taxId: '' }, PERFIL).taxId).toBe(PERFIL.taxId)
    })

    it('correo y teléfono: los del perfil; si no tiene, los de la empresa', () => {
      const sinContacto = { ...PERFIL, email: '', phone: '' }
      const e = emisorDesdeEmpresa({ ...KAIZEN, email: 'kaizen@kbs.gt', phone: '2300-0000' }, sinContacto)
      expect(e.email).toBe('kaizen@kbs.gt')
      expect(e.phone).toBe('2300-0000')
    })

    it('sin razón social en ningún lado, encabeza con el nombre comercial', () => {
      const e = emisorDesdeEmpresa({ ...KAIZEN, legalName: '' }, { ...PERFIL, legalName: '' })
      expect(e.name).toBe('KAIZEN BUSINESS SOLUTIONS')
    })
  })

  describe('sin empresa activa', () => {
    it('muestra el perfil tal cual', () => {
      expect(emisorDesdeEmpresa(null, PERFIL)).toEqual(PERFIL)
    })
  })
})

/**
 * El logo que encabeza lo que se imprime.
 *
 * Es de la EMPRESA que emite, no de la cuenta: dos empresas de la misma
 * cuenta no encabezan igual sus documentos. El de la cuenta queda de respaldo
 * para quien todavía no subió el suyo — es la misma confusión que ya hizo
 * salir los libros de Kaizen con el NIT del dueño de la cuenta.
 */
describe('el logo del emisor', () => {
  const CUENTA = { name: 'GLL Consulting', logoUrl: 'logo-de-la-cuenta.png' } as any

  it('es el de la empresa activa', () => {
    const e = emisorDesdeEmpresa({ legalName: 'Paper Plus', logoUrl: 'logo-paper-plus.png' }, CUENTA)

    expect(e.logoUrl).toBe('logo-paper-plus.png')
  })

  it('cada empresa trae el suyo', () => {
    const otra = emisorDesdeEmpresa({ legalName: 'LUUM', logoUrl: 'logo-luum.png' }, CUENTA)

    expect(otra.logoUrl).toBe('logo-luum.png')
  })

  /** Quien aún no subió el suyo imprime con el de la cuenta, no sin logo. */
  it('sin logo propio, usa el de la cuenta', () => {
    const e = emisorDesdeEmpresa({ legalName: 'Nueva, S.A.' }, CUENTA)

    expect(e.logoUrl).toBe('logo-de-la-cuenta.png')
  })

  it('sin ninguno de los dos, no hay logo', () => {
    const e = emisorDesdeEmpresa({ legalName: 'Nueva, S.A.' }, { name: 'GLL' } as any)

    expect(e.logoUrl).toBeFalsy()
  })

  /** Sin empresa activa se imprime con la cuenta, como siempre. */
  it('sin empresa, queda el de la cuenta', () => {
    expect(emisorDesdeEmpresa(null, CUENTA).logoUrl).toBe('logo-de-la-cuenta.png')
  })
})

/**
 * Con qué empresa se arma el emisor.
 *
 * La impresión abre una ventana nueva con `window.open`, y ahí la empresa
 * activa de la pestaña puede no estar. Cuando faltaba, `getEmisor` devolvía
 * el perfil de la CUENTA: el logo y el NIT salían igual —están en los dos
 * lados— pero el régimen fiscal no, porque solo vive en la empresa. Resultado:
 * el detalle en pantalla ocultaba el IVA y el PDF lo mostraba, para la misma
 * cotización. Por eso quien imprime pasa la empresa DEL DOCUMENTO.
 */
describe('la empresa con la que se imprime', () => {
  it('el documento manda sobre la empresa activa de la pestaña', () => {
    const delDocumento = emisorDesdeEmpresa(
      { legalName: 'Paper Plus', fiscalRegimeCode: 'gt_pequeno_contribuyente' },
      { name: 'GLL Consulting' } as any,
    )

    expect(delDocumento.fiscalRegimeCode).toBe('gt_pequeno_contribuyente')
  })

  /**
   * El caso que rompía: sin empresa, el emisor es la cuenta y la cuenta no
   * tiene régimen, así que el documento imprimía con IVA.
   */
  it('sin empresa, no hay régimen y el documento sale con IVA', () => {
    const soloCuenta = emisorDesdeEmpresa(null, {
      name: 'GLL Consulting', logoUrl: 'logo.png', taxId: '69407452',
    } as any)

    expect(soloCuenta.fiscalRegimeCode).toBeUndefined()
    // Y el logo y el NIT sí salían, que es lo que lo hacía difícil de ver.
    expect(soloCuenta.logoUrl).toBe('logo.png')
    expect(soloCuenta.taxId).toBe('69407452')
  })
})
