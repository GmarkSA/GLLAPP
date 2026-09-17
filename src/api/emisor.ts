import { companiesApi } from './companies'
import { getOrganizationProfile, type OrganizationProfile } from './configuracion'

/**
 * Quién emite el documento.
 *
 * El encabezado de cada documento muestra lo mismo que Perfil de organización
 * muestra para la empresa activa, con la misma prioridad campo por campo
 * (ConfiguracionPage.tsx, sección Organización). Así lo que ves en el perfil es
 * lo que sale impreso.
 *
 * La única diferencia es el título: el documento encabeza con la razón social.
 */
export function emisorDesdeEmpresa(
  empresa: Record<string, any> | null | undefined,
  cliente: OrganizationProfile,
): OrganizationProfile {
  if (!empresa) return cliente

  const razonSocial     = empresa.legalName || cliente.legalName
  const nombreComercial = empresa.tradeName || empresa.legalName || cliente.name

  return {
    // Dirección, ciudad, departamento, código postal, país y logotipo: igual que el perfil
    ...cliente,
    name:      razonSocial || nombreComercial,
    legalName: razonSocial,
    taxId:     empresa.taxId || cliente.taxId,
    email:     cliente.email || empresa.email,
    phone:     cliente.phone || empresa.phone,
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
