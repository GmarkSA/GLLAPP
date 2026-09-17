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
 * El NIT no se hereda nunca: es lo que distingue a una empresa de otra ante la
 * SAT, y heredarlo es justo el error que se corrige. Si la empresa no lo tiene,
 * sale vacío.
 *
 * La razón social encabeza el documento, no el nombre comercial: es la que
 * aparece en la factura. Y la dirección, el contacto y la marca sí heredan del
 * cliente mientras la empresa no tenga los suyos, porque el encabezado tiene que
 * salir completo: dejarlo en blanco empeora el documento sin proteger nada.
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

    // Encabeza la razón social, que es la que va en la factura
    name:      empresa.legalName || empresa.tradeName || cliente.name,
    legalName: empresa.legalName || cliente.legalName,

    // El NIT nunca se hereda: es lo que distingue a una empresa de la otra ante
    // la SAT, y heredarlo es justo el error que se está corrigiendo.
    taxId:     empresa.taxId || '',

    // Todo lo demás, mientras la empresa no tenga lo suyo
    address:   calle       || cliente.address,
    city:      dir.city    || cliente.city,
    state:     dir.state   || cliente.state,
    country:   dir.country || cliente.country,
    zipCode:   dir.zip     || cliente.zipCode,
    currency:  empresa.currencyCode || cliente.currency,
    timezone:  empresa.timezone     || cliente.timezone,
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
