import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
// Los dos archivos se leen tal cual se publican. Si alguno dejara de existir,
// esto no compila — que es exactamente lo que se quiere fijar.
import indexHtmlCrudo from '../../../index.html?raw'
import robotsCrudo from '../../../public/robots.txt?raw'

/**
 * Cómo ve un buscador la pantalla de acceso de Lucía.
 *
 * El dominio pasó a lucia.gllconsulting.com y, al revisarlo, la app no decía
 * nada de sí misma: el título era «Lucía» a secas, la descripción era «Lucía —
 * una app de GLL», no había canónica, y /robots.txt devolvía el HTML de la app
 * —porque no existe el archivo y la regla de reescritura manda todo a
 * index.html—. Un robot que pide robots.txt y recibe una página web no puede
 * leer nada: no es texto.
 *
 * Esto vive en el HTML estático, no en React, porque es lo que el buscador lee
 * sin ejecutar nada.
 */
const indexHtml = () => indexHtmlCrudo

describe('lo que el buscador lee del HTML', () => {
  it('el título dice qué es y de quién, no solo «Lucía»', () => {
    expect(indexHtml()).toContain('<title>Lucía by GLL · Ingresar</title>')
  })

  it('la descripción explica la app a quien la busca', () => {
    const descripcion = indexHtml().match(/<meta name="description" content="([^"]+)"/)?.[1] ?? ''
    expect(descripcion).toContain('Lucía')
    expect(descripcion).toContain('GLL Consulting')
    expect(descripcion).toContain('Guatemala')
    // La de antes —«Lucía — una app de GLL»— no decía nada de lo que hace.
    expect(descripcion.length).toBeGreaterThan(60)
  })

  it('la canónica apunta a la raíz del dominio nuevo', () => {
    expect(indexHtml()).toMatch(
      /<link rel="canonical" href="https:\/\/lucia\.gllconsulting\.com\/"/)
  })

  it('la página sigue declarándose en español', () => {
    expect(indexHtml()).toContain('<html lang="es">')
  })
})

describe('robots.txt', () => {
  it('existe como archivo: se publica desde public/, no lo inventa la app', () => {
    expect(robotsCrudo.length).toBeGreaterThan(0)
  })

  it('es texto de verdad, no el HTML de la app', () => {
    expect(robotsCrudo).not.toContain('<!doctype')
    expect(robotsCrudo).toMatch(/User-agent:/)
  })

  it('deja entrar al robot: la pantalla de acceso tiene que poder indexarse', () => {
    expect(robotsCrudo).toMatch(/^Allow: \/$/m)
  })
})

// ── La pantalla ──────────────────────────────────────────────────────────────

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ login: vi.fn(), isLoading: false }),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter><LoginPage /></MemoryRouter>)
  })
}

const enlaceQueEsLucia = () =>
  Array.from(host.querySelectorAll('a')).find(a => a.textContent?.includes('¿Qué es Lucía?'))

describe('el enlace «¿Qué es Lucía?»', () => {
  beforeEach(() => { host = document.createElement('div') })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  /**
   * Quien llega buscando «Lucía» cae en una pantalla de ingreso y no tiene
   * cómo saber qué es, ni dónde leer más. El enlace a la página del producto
   * le da salida —y le dice al buscador que las dos páginas son de lo mismo—.
   */
  it('está a la vista en la pantalla de acceso', async () => {
    await render()
    expect(enlaceQueEsLucia()).toBeTruthy()
  })

  it('lleva a la página del producto en el sitio de GLL', async () => {
    await render()
    expect(enlaceQueEsLucia()?.getAttribute('href'))
      .toBe('https://gllconsulting.com/lucia/')
  })

  it('abre en otra pestaña, para no sacar a nadie del ingreso a medias', async () => {
    await render()
    expect(enlaceQueEsLucia()?.getAttribute('target')).toBe('_blank')
  })

  it('con rel seguro: una pestaña nueva no debe poder tocar la del ingreso', async () => {
    await render()
    expect(enlaceQueEsLucia()?.getAttribute('rel')).toContain('noopener')
  })
})
