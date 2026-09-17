import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useState, act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ModoEdicion, ERow } from './Declaracion2237'

/**
 * Las filas de la declaración de IVA.
 *
 * El formulario 2237 se captura a mano: son cuarenta casillas de importes que el
 * contador teclea antes de presentar. Las filas estaban declaradas dentro de la
 * página, así que React las tomaba por componentes distintos en cada repintado y
 * volvía a montar cada casilla: al escribir el primer dígito se perdía el foco y
 * había que volver a hacer clic para seguir. Es el mismo fallo que ya obligó a
 * poner retardo en las celdas de LineItemsEditor.
 *
 * Estas pruebas fallan si alguien vuelve a meter las filas dentro de la página.
 */

/**
 * Escribe en una casilla como lo haría una persona. Asignar `.value` a secas no
 * sirve: React lleva su propia cuenta del valor y no se entera del cambio, así
 * que la prueba pasaría sin que la pantalla se repintara nunca.
 */
function escribir(entrada: HTMLInputElement, texto: string) {
  const ponerValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    ponerValor.call(entrada, texto)
    entrada.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Filas de la declaración 2237', () => {
  let contenedor: HTMLDivElement
  let root: Root

  beforeEach(() => {
    contenedor = document.createElement('div')
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
  })

  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  /**
   * Una tabla con una fila editable cuyo importe vive en el estado de la página,
   * igual que en la declaración. El testigo deja ver si el valor llegó de verdad
   * al estado, que es lo que provoca el repintado.
   */
  function Formulario({ editando }: { editando: boolean }) {
    const [base, setBase] = useState(0)
    return (
      <ModoEdicion.Provider value={editando}>
        <p data-testigo>{base}</p>
        <table><tbody>
          <ERow label="Ventas gravadas (bienes)" taxCode="RG-V01"
            baseVal={base} onBase={setBase} />
        </tbody></table>
      </ModoEdicion.Provider>
    )
  }

  const dibujar = (editando: boolean) =>
    act(() => { root.render(<StrictMode><Formulario editando={editando} /></StrictMode>) })

  const casilla = () => contenedor.querySelector('input') as HTMLInputElement
  const testigo = () => contenedor.querySelector('[data-testigo]')!.textContent

  describe('en modo lectura', () => {
    it('muestra el texto de la fila y no deja capturar', () => {
      dibujar(false)
      expect(contenedor.textContent).toContain('Ventas gravadas (bienes)')
      expect(contenedor.textContent).toContain('RG-V01')
      expect(casilla()).toBeNull()
    })
  })

  describe('en modo edición', () => {
    beforeEach(() => dibujar(true))

    it('ofrece una casilla de captura y la marca de edición', () => {
      expect(casilla()).not.toBeNull()
      expect(contenedor.textContent).toContain('▼')
    })

    // El fallo original: cada tecla rehacía la casilla y el foco se iba
    it('al escribir un importe la casilla sigue siendo la misma y conserva el foco', () => {
      const antes = casilla()
      antes.focus()
      expect(document.activeElement).toBe(antes)

      escribir(antes, '1500')

      expect(testigo()).toBe('1500')                 // el importe llegó al estado
      const despues = casilla()
      expect(despues).toBe(antes)                    // y la casilla no se volvió a montar
      expect(document.activeElement).toBe(despues)   // así que el foco no se perdió
    })

    it('escribir varios dígitos seguidos no interrumpe la captura', () => {
      const entrada = casilla()
      entrada.focus()
      for (const texto of ['1', '15', '150', '1500']) {
        escribir(entrada, texto)
        expect(testigo()).toBe(texto)
        expect(casilla()).toBe(entrada)
        expect(document.activeElement).toBe(entrada)
      }
    })
  })

  describe('al pasar de lectura a edición y volver', () => {
    it('la fila se mantiene y cambia solo la forma de capturar', () => {
      dibujar(false)
      expect(casilla()).toBeNull()

      dibujar(true)
      expect(casilla()).not.toBeNull()

      dibujar(false)
      expect(casilla()).toBeNull()
      expect(contenedor.textContent).toContain('Ventas gravadas (bienes)')
    })
  })
})
