import { getOrganizationProfile, updateOrganizationProfile } from './configuracion'

export interface LibroColumn {
  key:       string   // identificador interno estable (ej: 'bienes')
  label:     string   // etiqueta visible en el reporte (ej: 'Compra de Bienes')
  sortOrder: number
  isActive:  boolean
}

export interface LibroSATConfig {
  compras: LibroColumn[]
  ventas:  LibroColumn[]
}

export const DEFAULT_COMPRAS: LibroColumn[] = [
  { key: 'bienes',               label: 'Compra Bienes',        sortOrder: 1, isActive: true },
  { key: 'servicios',            label: 'Compra Servicios',     sortOrder: 2, isActive: true },
  { key: 'combustibles',         label: 'Combustibles',         sortOrder: 3, isActive: true },
  { key: 'importacion',          label: 'Importación',          sortOrder: 4, isActive: true },
  { key: 'pequenoContribuyente', label: 'Peq. Contribuyente',   sortOrder: 5, isActive: true },
  { key: 'exento',               label: 'Exento',               sortOrder: 6, isActive: true },
]

export const DEFAULT_VENTAS: LibroColumn[] = [
  { key: 'bienes',      label: 'Venta Bienes',    sortOrder: 1, isActive: true },
  { key: 'servicios',   label: 'Venta Servicios', sortOrder: 2, isActive: true },
  { key: 'exportacion', label: 'Exportación',     sortOrder: 3, isActive: true },
  { key: 'exento',      label: 'Exento',          sortOrder: 4, isActive: true },
]

export const DEFAULT_CONFIG: LibroSATConfig = {
  compras: DEFAULT_COMPRAS,
  ventas:  DEFAULT_VENTAS,
}

export async function getLibroSATConfig(): Promise<LibroSATConfig> {
  try {
    const profile = await getOrganizationProfile()
    const stored  = (profile as any)?.settings?.libroSATConfig as LibroSATConfig | undefined
    if (!stored) return { compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] }
    return {
      compras: stored.compras?.length ? stored.compras : [...DEFAULT_COMPRAS],
      ventas:  stored.ventas?.length  ? stored.ventas  : [...DEFAULT_VENTAS],
    }
  } catch {
    return { compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] }
  }
}

export async function saveLibroSATConfig(config: LibroSATConfig): Promise<void> {
  const profile  = await getOrganizationProfile().catch(() => ({} as any))
  const settings = (profile as any)?.settings ?? {}
  await updateOrganizationProfile({ settings: { ...settings, libroSATConfig: config } } as any)
}
