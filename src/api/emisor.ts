import { companiesApi } from './companies'
import { getOrganizationProfile, type OrganizationProfile } from './configuracion'

/**
 * Quién emite el documento.
 *
 * Un cliente de Lucía puede llevar varias empresas, y cada factura, cotización,
 * boleta o reporte sale a nombre de la empresa en la que se está trabajando, no
 * del cliente. Las pantallas tomaban la cabecera de `/tenants/profile`, que es un
 * único registro por cliente: con dos empresas, las dos imprimían el nombre y el
 * NIT de la primera.
 *
 * Lo que identifica fiscalmente al emisor —nombre, NIT y dirección— sale de la
 * empresa y solo de la empresa. Si falta, se muestra vacío: es preferible un
 * hueco visible a imprimir el NIT de la empresa de al lado. Los datos de contacto
 * y la marca sí heredan del cliente, porque suelen compartirse y su ausencia no
 * equivoca a nadie.
 */
export function emisorDesdeEmpresa(
  empresa: Record<string, any> | null | undefined,
  cliente: OrganizationProfile,
): OrganizationProfile {
  if (!empresa) return cliente

  const dir = (empresa.fiscalAddress ?? {}) as Record<string, string | undefined>
  const calle = [dir.line1, dir.line2].filter(Boolean).join(', ')

  return {
    // Contacto, marca y ajustes del cliente: se heredan salvo que la empresa los tenga
    ...cliente,
    logoUrl: empresa.logoUrl || cliente.logoUrl,
    email:   empresa.email   || cliente.email,
    phone:   empresa.phone   || cliente.phone,

    // Identidad fiscal: de la empresa, sin heredar
    name:      empresa.tradeName || empresa.legalName || '',
    legalName: empresa.legalName || '',
    taxId:     empresa.taxId || '',
    address:   calle,
    city:      dir.city    ?? '',
    state:     dir.state   ?? '',
    country:   dir.country ?? '',
    zipCode:   dir.zip     ?? '',

    currency: empresa.currencyCode ?? cliente.currency,
    timezone: empresa.timezone     ?? cliente.timezone,
  }
}

/**
 * Cabecera del emisor para cualquier documento que represente a la empresa.
 * Úsese en lugar de `getOrganizationProfile()` siempre que se imprima o se
 * muestre «quiénes somos». El perfil del cliente sigue siendo el sitio correcto
 * para lo que es del cliente entero: sus ajustes y su configuración.
 */
export async function getEmisor(): Promise<OrganizationProfile> {
  const cliente = await getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile))
  const companyId = sessionStorage.getItem('activeCompanyId')
  if (!companyId) return cliente

  const empresa = await companiesApi.getOne(companyId).catch(() => null)
  return emisorDesdeEmpresa(empresa as Record<string, any> | null, cliente)
}
