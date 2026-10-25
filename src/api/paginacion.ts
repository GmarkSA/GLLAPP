/**
 * Cuántos registros hay en total, según lo que respondió el servidor.
 *
 * El backend devuelve los listados paginados como
 * `{ data: [...], meta: { total, page, limit, totalPages } }`: el total vive en
 * `meta`, no al lado de `data`. Varias pantallas leían `res.total` —que no
 * existe— y se quedaban en cero; Ant Design, al ver un total vacío, usa el
 * largo de la página como si fuera el total, así que la tabla decía «200 de
 * 200 artículos» con 1,584 en la bodega y una sola página. El error no se veía:
 * parecía un inventario chico.
 *
 * Se aceptan las dos formas porque no todos los endpoints pasan por el mismo
 * envoltorio, y porque los listados viejos devuelven `total` suelto.
 */
export const totalDe = (res: unknown): number => {
  const r = res as { meta?: { total?: unknown }; total?: unknown } | null | undefined
  const bruto = r?.meta?.total ?? r?.total
  const n = Number(bruto)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
