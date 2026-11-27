import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

/**
 * Lo que las reglas de teléfono NO deben tocar.
 *
 * Para que los formularios se lean en un teléfono, una regla de CSS pone en
 * una sola columna cualquier rejilla que viva dentro de un formulario, un
 * modal o un cajón. Esa regla es ciega: no distingue una fila de campos de
 * la maqueta de un documento. Dos cosas la necesitan esquivar, y las dos se
 * marcan en el código:
 *
 *  1. La vista previa de una plantilla de impresión es la foto de cómo
 *     saldrá el papel —el logo arriba, el número a la derecha, los cuadros
 *     de «Facturar a» y certificación FEL lado a lado—. Si se colapsa, la
 *     previsualización miente sobre la impresión. Se marca con
 *     `data-vista-previa`.
 *  2. El logo de la empresa vive en una fila flex junto al texto. Un
 *     elemento flex cede ANCHO, no alto: sin `flex-shrink: 0` el círculo del
 *     logo sale como un óvalo cuando el texto le pelea el espacio.
 *
 * El CSS no se puede medir aquí —jsdom no carga la hoja de estilos—, y se
 * verificó aparte en el navegador con la hoja ya compilada. Lo que esta
 * prueba vigila es que las dos marcas sigan en el código: son fáciles de
 * borrar sin darse cuenta, y al borrarlas no se rompe nada que se note.
 */

const EMPRESA = {
  id: 'emp-1', legalName: 'Kaizen Consulting, S.A.', tradeName: 'Kaizen',
  taxId: '117457620', countryCode: 'GT', currencyCode: 'GTQ',
  status: 'active', isDefault: true,
}

vi.mock('../../store/companyStore', () => ({
  useCompanyStore: (sel: any) => sel({ activeCompany: EMPRESA }),
}))

describe('la vista previa de la plantilla de impresión', () => {
  let div: HTMLDivElement
  let root: Root

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
  })

  const dibujarPrevia = async (isTicket: boolean) => {
    const { InvoicePreview } = await import('./PlantillasImpresionPage')
    const { DEFAULT_TEMPLATE } = await import('../../components/Print/printFormats')
    await act(async () => {
      root.render(<InvoicePreview tpl={DEFAULT_TEMPLATE} isTicket={isTicket} />)
    })
  }

  it('está marcada para que la regla de una columna no la toque', async () => {
    await dibujarPrevia(false)
    const marcada = div.querySelector('[data-vista-previa]')
    expect(marcada, 'la vista previa perdió su marca data-vista-previa').toBeTruthy()
    // Y la maqueta que protege: los dos cuadros del documento.
    expect(div.textContent).toContain('FACTURAR A')
  })

  it('y el ticket también', async () => {
    await dibujarPrevia(true)
    expect(div.querySelector('[data-vista-previa]')).toBeTruthy()
  })
})

describe('el logo de la empresa en su formulario', () => {
  it('su caja no cede ancho, así que el círculo no se vuelve óvalo', async () => {
    /** El código de la pantalla tal cual, sin montarla. */
    const fuentes = import.meta.glob('./ConfiguracionPage.tsx', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>
    const fuente = fuentes['./ConfiguracionPage.tsx']

    /**
     * Se lee del código y no del DOM porque la pantalla de Configuración
     * arrastra media aplicación para dibujarse; lo que importa aquí es una
     * línea que no se puede perder.
     */
    const filaDelLogo = fuente.slice(
      fuente.indexOf("{/* Logo row */}"),
      fuente.indexOf('</Avatar>'),
    )
    expect(filaDelLogo, 'no se encontró la fila del logo').not.toBe('')
    expect(filaDelLogo).toContain('flexShrink: 0')
    expect(filaDelLogo).toContain("flexWrap: 'wrap'")
  })
})
