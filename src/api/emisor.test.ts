import { describe, it, expect } from 'vitest'
import { emisorDesdeEmpresa } from './emisor'
import type { OrganizationProfile } from './configuracion'

/**
 * Quién aparece emitiendo el documento.
 *
 * Un cliente de Lucía puede llevar varias empresas. Las pantallas tomaban la
 * cabecera del perfil del cliente, que es un único registro: con dos empresas,
 * las facturas de las dos salían a nombre y NIT de la primera. El dueño lo vio
 * estando en una empresa y leyendo una factura encabezada con la otra.
 *
 * El NIT no se hereda nunca: es lo que distingue a una empresa de otra ante la
 * SAT. La razón social encabeza el documento, no el nombre comercial. La
 * dirección y el contacto sí heredan mientras la empresa no tenga los suyos,
 * porque el encabezado tiene que salir completo.
 */
const CLIENTE: OrganizationProfile = {
  name:      'Mario de Paz',
  legalName: 'Mario Alberto de Paz',
  taxId:     '9604707',
  address:   '28-21 23 Avenida Residencial Portal de San Isidro 3 Zona 16',
  city:      'Guatemala',
  state:     'Guatemala',
  country:   'Guatemala',
  zipCode:   '01016',
  email:     'contacto@mariodepaz.gt',
  phone:     '2200-0000',
  website:   'https://mariodepaz.gt',
  logoUrl:   'https://cdn/logo-cliente.png',
  currency:  'GTQ',
  timezone:  'America/Guatemala',
}

const KAIZEN = {
  id: 'empresa-kaizen',
  legalName: 'KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA',
  tradeName: 'KAIZEN BUSINESS SOLUTIONS',
  taxId: '11745762-0',
  currencyCode: 'GTQ',
  timezone: 'America/Guatemala',
  fiscalAddress: { line1: '5a Avenida 10-50', line2: 'Zona 14', city: 'Guatemala', state: 'Guatemala', zip: '01014', country: 'Guatemala' },
}

describe('Emisor del documento', () => {
  describe('con una empresa activa', () => {
    const emisor = emisorDesdeEmpresa(KAIZEN, CLIENTE)

    // El fallo que reportó el dueño: la factura de Kaizen decía Mario de Paz
    it('sale la empresa, no el cliente', () => {
      expect(emisor.legalName).toBe('KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA')
      expect(emisor.name).not.toContain('Mario')
    })

    // En la factura va la razón social, no el nombre comercial
    it('encabeza con la razón social', () => {
      expect(emisor.name).toBe('KAIZEN BUSINESS SOLUTIONS, SOCIEDAD ANÓNIMA')
    })

    it('sin razón social se usa el nombre comercial', () => {
      const soloComercial = emisorDesdeEmpresa({ ...KAIZEN, legalName: undefined }, CLIENTE)
      expect(soloComercial.name).toBe('KAIZEN BUSINESS SOLUTIONS')
    })

    it('el encabezado nunca sale vacío: sin ninguno de los dos, queda el del cliente', () => {
      const anonima = emisorDesdeEmpresa({ id: 'x', taxId: '111' }, CLIENTE)
      expect(anonima.name).toBe(CLIENTE.name)
    })

    it('el NIT es el de la empresa', () => {
      expect(emisor.taxId).toBe('11745762-0')
      expect(emisor.taxId).not.toBe(CLIENTE.taxId)
    })

    it('la dirección fiscal es la de la empresa', () => {
      expect(emisor.address).toBe('5a Avenida 10-50, Zona 14')
      expect(emisor.city).toBe('Guatemala')
      expect(emisor.zipCode).toBe('01014')
      expect(emisor.address).not.toBe(CLIENTE.address)
    })

  })

  describe('lo que sí se hereda del cliente', () => {
    const emisor = emisorDesdeEmpresa(KAIZEN, CLIENTE)

    // Dejar el encabezado en blanco empeora el documento y no protege nada
    it('la dirección, mientras la empresa no tenga la suya', () => {
      const sinDireccion = emisorDesdeEmpresa({ ...KAIZEN, fiscalAddress: null }, CLIENTE)
      expect(sinDireccion.address).toBe(CLIENTE.address)
      expect(sinDireccion.city).toBe(CLIENTE.city)
    })

    it('el logotipo, el correo y el teléfono, que suelen compartirse', () => {
      expect(emisor.logoUrl).toBe(CLIENTE.logoUrl)
      expect(emisor.email).toBe(CLIENTE.email)
      expect(emisor.phone).toBe(CLIENTE.phone)
    })

    it('pero la empresa manda si los tiene propios', () => {
      const propio = emisorDesdeEmpresa(
        { ...KAIZEN, email: 'facturacion@kaizen.gt', phone: '2300-1111', logoUrl: 'https://cdn/logo-kaizen.png' },
        CLIENTE,
      )
      expect(propio.email).toBe('facturacion@kaizen.gt')
      expect(propio.phone).toBe('2300-1111')
      expect(propio.logoUrl).toBe('https://cdn/logo-kaizen.png')
    })
  })

  describe('cuando a la empresa le falta un dato fiscal', () => {
    const incompleta = emisorDesdeEmpresa({ id: 'x', legalName: 'EMPRESA NUEVA, S.A.' }, CLIENTE)

    // Heredarlo imprimiría el NIT de la otra empresa: el error que se corrige
    it('el NIT sale vacío, nunca el del cliente', () => {
      expect(incompleta.taxId).toBe('')
      expect(incompleta.taxId).not.toBe(CLIENTE.taxId)
    })

    it('el nombre sí es el suyo', () => {
      expect(incompleta.name).toBe('EMPRESA NUEVA, S.A.')
    })
  })

  describe('sin empresa activa', () => {
    it('se queda el perfil del cliente, como antes', () => {
      expect(emisorDesdeEmpresa(null, CLIENTE)).toEqual(CLIENTE)
      expect(emisorDesdeEmpresa(undefined, CLIENTE)).toEqual(CLIENTE)
    })
  })
})
