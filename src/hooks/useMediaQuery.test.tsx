import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { act } from 'react'
import { useDispositivo, useTarjetas, useMenuColapsable, CORTES } from './useMediaQuery'

/** Monta el hook y devuelve lo que entrega, sin librerías de más. */
function valorDe<T>(hook: () => T): T {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  let valor!: T
  const Sonda = () => { valor = hook(); return null }
  act(() => { root.render(createElement(Sonda)) })
  act(() => { root.unmount() })
  div.remove()
  return valor
}

/**
 * Los tres tamaños de pantalla, con los anchos reales de los aparatos.
 *
 * El corte importa y antes estaba en un solo número (991px): una tablet en
 * vertical —810px— caía del lado del teléfono y le salían tarjetas donde
 * cabe una tabla; y una de 1024 caía del lado del escritorio, con el menú
 * fijo comiéndose el ancho.
 */

/** Finge una pantalla de ese ancho para `window.matchMedia`. */
function pantallaDe(ancho: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const cumpleMax = max ? ancho <= Number(max[1]) : true
    const cumpleMin = min ? ancho >= Number(min[1]) : true
    return {
      matches: cumpleMax && cumpleMin,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
  }) as any
}

const original = window.matchMedia

describe('en qué tamaño de pantalla estamos', () => {
  afterEach(() => { window.matchMedia = original })

  const casos: Array<[string, number, string]> = [
    ['iPhone SE',            375, 'telefono'],
    ['iPhone 15 Pro Max',    430, 'telefono'],
    ['el límite del teléfono', 767, 'telefono'],
    ['iPad mini vertical',   744, 'telefono'],
    ['iPad vertical',        810, 'tablet'],
    ['el límite de la tablet', 1024, 'tablet'],
    ['laptop',               1025, 'escritorio'],
    ['monitor',              1920, 'escritorio'],
  ]

  for (const [nombre, ancho, esperado] of casos) {
    it(`${nombre} (${ancho}px) → ${esperado}`, () => {
      pantallaDe(ancho)
      expect(valorDe(useDispositivo)).toBe(esperado)
    })
  }
})

describe('qué cambia en cada tamaño', () => {
  afterEach(() => { window.matchMedia = original })

  /** Las tarjetas son solo del teléfono: en tablet la tabla se lee mejor. */
  it('las tablas se vuelven tarjetas solo en teléfono', () => {
    pantallaDe(430)
    expect(valorDe(useTarjetas)).toBe(true)
    pantallaDe(810)
    expect(valorDe(useTarjetas)).toBe(false)
    pantallaDe(1440)
    expect(valorDe(useTarjetas)).toBe(false)
  })

  /** El menú se esconde en teléfono y en tablet: hasta 1024 el ancho es del contenido. */
  it('el menú deja de estar fijo hasta 1024', () => {
    pantallaDe(430)
    expect(valorDe(useMenuColapsable)).toBe(true)
    pantallaDe(1024)
    expect(valorDe(useMenuColapsable)).toBe(true)
    pantallaDe(1025)
    expect(valorDe(useMenuColapsable)).toBe(false)
  })
})

describe('los cortes', () => {
  it('son los de la especificación, y viven en un solo lugar', () => {
    expect(CORTES.telefono).toBe('(max-width: 767px)')
    expect(CORTES.tablet).toBe('(min-width: 768px) and (max-width: 1024px)')
  })
})
