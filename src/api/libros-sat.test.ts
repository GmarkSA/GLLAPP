import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_COMPRAS, DEFAULT_VENTAS } from './libros-sat'

/**
 * Las columnas del libro de compras y ventas de cada empresa.
 *
 * De estas columnas cuelga todo lo demás: un impuesto se asigna a una columna, y
 * esa columna decide en qué fila de la declaración de IVA cae el monto. Una
 * empresa puede renombrarlas, reordenarlas o apagar las que no usa, y lo suyo
 * manda.
 *
 * El problema era que lo suyo mandaba *del todo*: lo guardado sustituía a la
 * lista de serie en vez de completarla. Una empresa que guardó su configuración
 * antes de que existiera la columna «Activos Fijos» se quedaba sin ella para
 * siempre, y las compras de activo fijo no aparecían en su libro.
 */
const settings = vi.hoisted(() => ({ getSettings: vi.fn() }))
vi.mock('./companies', () => ({ companiesApi: settings }))

const { getLibroSATConfig } = await import('./libros-sat')

const conGuardado = (libroSATConfig: unknown) =>
  settings.getSettings.mockResolvedValue({ settingsJson: { libroSATConfig } })

describe('Columnas del libro de una empresa', () => {
  beforeEach(() => {
    sessionStorage.setItem('activeCompanyId', 'empresa-1')
    settings.getSettings.mockReset()
  })

  describe('sin nada guardado', () => {
    it('usa las columnas de serie', async () => {
      conGuardado(undefined)
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.map(c => c.key)).toEqual(DEFAULT_COMPRAS.map(c => c.key))
      expect(cfg.ventas.map(c => c.key)).toEqual(DEFAULT_VENTAS.map(c => c.key))
    })

    it('si no se puede consultar la empresa, tampoco se queda sin columnas', async () => {
      settings.getSettings.mockRejectedValue(new Error('sin red'))
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.length).toBe(DEFAULT_COMPRAS.length)
    })
  })

  describe('con una configuración guardada antigua', () => {
    // El caso real: se guardó antes de que existiera la columna de activos fijos
    const antigua = {
      compras: [
        { key: 'bienes',    label: 'Compra Bienes',    sortOrder: 1, isActive: true },
        { key: 'servicios', label: 'Compra Servicios', sortOrder: 2, isActive: true },
      ],
      ventas: [{ key: 'bienes', label: 'Venta Bienes', sortOrder: 1, isActive: true }],
    }

    it('recupera las columnas de serie que le faltaban', async () => {
      conGuardado(antigua)
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.map(c => c.key)).toContain('activosFijos')
      expect(cfg.compras.map(c => c.key)).toContain('combustibles')
      expect(cfg.ventas.map(c => c.key)).toContain('exportacion')
    })

    it('las añade al final, sin alterar el orden que la empresa eligió', async () => {
      conGuardado(antigua)
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.slice(0, 2).map(c => c.key)).toEqual(['bienes', 'servicios'])
      expect(cfg.compras.every((c, i, todas) => i === 0 || c.sortOrder > todas[i - 1].sortOrder)).toBe(true)
    })
  })

  describe('lo que la empresa decidió se respeta', () => {
    it('conserva el nombre que le puso a una columna', async () => {
      conGuardado({
        compras: [{ key: 'bienes', label: 'Mercadería', sortOrder: 1, isActive: true }],
        ventas: [],
      })
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.find(c => c.key === 'bienes')!.label).toBe('Mercadería')
    })

    it('no vuelve a encender una columna que apagó', async () => {
      conGuardado({
        compras: [{ key: 'combustibles', label: 'Combustibles', sortOrder: 1, isActive: false }],
        ventas: [],
      })
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.find(c => c.key === 'combustibles')!.isActive).toBe(false)
    })

    it('no duplica una columna que ya tenía', async () => {
      conGuardado({ compras: [...DEFAULT_COMPRAS], ventas: [...DEFAULT_VENTAS] })
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.length).toBe(DEFAULT_COMPRAS.length)
      expect(new Set(cfg.compras.map(c => c.key)).size).toBe(cfg.compras.length)
    })

    it('conserva las columnas propias que haya creado', async () => {
      conGuardado({
        compras: [{ key: 'miColumna', label: 'Mi columna', sortOrder: 1, isActive: true }],
        ventas: [],
      })
      const cfg = await getLibroSATConfig()
      expect(cfg.compras.map(c => c.key)).toContain('miColumna')
    })
  })
})
