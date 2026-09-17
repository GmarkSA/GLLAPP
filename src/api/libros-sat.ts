import { companiesApi } from './companies'

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
  { key: 'activosFijos',         label: 'Activos Fijos',        sortOrder: 7, isActive: true },
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

/**
 * Completa lo guardado con las columnas de serie que todavía no tenga.
 *
 * Lo que la empresa guardó manda: su orden, su nombre y las que haya desactivado
 * se respetan tal cual. Solo se añaden al final las columnas de serie que no
 * estuvieran. Sin esto, una empresa que guardó su configuración antes de que
 * existiera una columna se quedaba sin ella para siempre, y los impuestos que
 * apuntan ahí no aparecían en el libro.
 */
const completarConLasDeSerie = (guardadas: LibroColumn[] | undefined, deSerie: LibroColumn[]): LibroColumn[] => {
  if (!guardadas?.length) return [...deSerie]
  const presentes = new Set(guardadas.map(c => c.key))
  const faltantes = deSerie
    .filter(c => !presentes.has(c.key))
    .map((c, i) => ({ ...c, sortOrder: Math.max(...guardadas.map(g => g.sortOrder), 0) + i + 1 }))
  return [...guardadas, ...faltantes]
}

export async function getLibroSATConfig(): Promise<LibroSATConfig> {
  try {
    const companyId = sessionStorage.getItem('activeCompanyId')
    if (!companyId) return { compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] }
    const settings = await companiesApi.getSettings(companyId)
    const stored = settings?.settingsJson?.libroSATConfig as LibroSATConfig | undefined
    if (!stored) return { compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] }
    return {
      compras: completarConLasDeSerie(stored.compras, DEFAULT_COMPRAS),
      ventas:  completarConLasDeSerie(stored.ventas,  DEFAULT_VENTAS),
    }
  } catch {
    return { compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] }
  }
}

export async function saveLibroSATConfig(config: LibroSATConfig): Promise<void> {
  const companyId = sessionStorage.getItem('activeCompanyId')
  if (!companyId) return
  const current = await companiesApi.getSettings(companyId).catch(() => null)
  const existingJson = current?.settingsJson ?? {}
  await companiesApi.updateSettings(companyId, { settingsJson: { ...existingJson, libroSATConfig: config } } as any)
}
