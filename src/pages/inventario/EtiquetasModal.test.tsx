import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import EtiquetasModal from './EtiquetasModal'
import type { ArticuloParaEtiqueta } from './etiquetas'

/**
 * El aviso antes de imprimir.
 *
 * Un artículo que todavía trae el SKU como código de barras se imprime en
 * Code128, que ocupa 11 módulos por carácter: en el ancho de la etiqueta las
 * barras salen por debajo del mínimo que lee el lector. Eso no se arregla
 * imprimiendo —hay que regenerarle el código—, así que la pantalla tiene que
 * decirlo ANTES, no después de pegar las etiquetas en el producto.
 */
const CON_EAN: ArticuloParaEtiqueta = {
  id: 'a-1', sku: 'ABA-GRAN', name: 'ABACO BACO GRANDE',
  salesPrice: 23, barCodes: ['2000000000015'],
}
const CON_SKU: ArticuloParaEtiqueta = {
  id: 'a-2', sku: 'PAPEL-BOND-CARTA-75G', name: 'PAPEL BOND CARTA 75G',
  salesPrice: 45, barCodes: ['PAPEL-BOND-CARTA-75G'],
}

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = async (articulos: ArticuloParaEtiqueta[], seleccionados: string[] = []) => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <EtiquetasModal open seleccionados={seleccionados} articulos={articulos} onClose={() => {}} />,
    )
  })
  await act(async () => { await new Promise(r => setTimeout(r, 30)) })
}

/** El Modal de Ant Design se monta fuera del host, en el body. */
const texto = () => document.body.textContent ?? ''

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  document.body.innerHTML = ''
})

describe('aviso de códigos que no van a leer', () => {
  it('con el EAN-13 interno no avisa nada', async () => {
    await render([CON_EAN])
    expect(texto()).not.toContain('demasiado angosto')
  })

  it('con el SKU como código, avisa', async () => {
    await render([CON_SKU])
    expect(texto()).toContain('demasiado angosto')
  })

  it('nombra el artículo, para saber cuál regenerar', async () => {
    await render([CON_SKU])
    expect(texto()).toContain('PAPEL BOND CARTA 75G')
  })

  it('dice dónde se arregla', async () => {
    await render([CON_SKU])
    expect(texto()).toContain('Regenerar códigos de barras')
  })

  it('solo mira los artículos marcados, si hay marcados', async () => {
    await render([CON_EAN, CON_SKU], ['a-1'])
    expect(texto()).not.toContain('demasiado angosto')
  })
})
