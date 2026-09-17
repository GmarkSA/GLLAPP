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
