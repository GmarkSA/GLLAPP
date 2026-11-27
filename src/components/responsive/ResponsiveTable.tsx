import type { ReactNode, Key } from 'react'
import { Table, Spin, Empty, Pagination } from 'antd'
import type { TableProps, TablePaginationConfig } from 'antd'
import { useDispositivo } from '../../hooks/useMediaQuery'

/**
 * La tabla, en los tres tamaños de pantalla.
 *
 *  - Escritorio: la tabla de AntD tal cual.
 *  - Tablet: la misma tabla, pero que se pueda correr de lado en vez de
 *    apretar las columnas hasta que no se lea nada. Una tabla de 810px se
 *    lee mejor desplazándose que convertida en una pila de tarjetas.
 *  - Teléfono: cada fila es una tarjeta (patrón Zoho Books).
 *
 * Sin `renderMobileCard` se usa siempre la tabla: una pantalla que todavía
 * no tiene su tarjeta sigue funcionando, solo que apretada.
 */
export interface ResponsiveTableProps<T> extends TableProps<T> {
  renderMobileCard?: (record: T, index: number) => ReactNode
  mobileEmptyText?: ReactNode
}

export default function ResponsiveTable<T extends object = any>(props: ResponsiveTableProps<T>) {
  const dispositivo = useDispositivo()
  const { renderMobileCard, mobileEmptyText, dataSource, loading, rowKey, pagination, ...rest } = props

  if (dispositivo !== 'telefono' || !renderMobileCard) {
    /**
     * Mientras no sea escritorio, la tabla se corre de lado en lugar de
     * apretarse. En tablet eso aplica siempre; en teléfono, solo cuando la
     * pantalla no tiene tarjeta —un reporte financiero, por ejemplo, que se
     * lee comparando columnas y no se puede apilar—. Apretar un balance en
     * 375px no lo hace legible: lo hace inservible.
     *
     * Si quien la usa ya definió su propio `scroll`, manda el suyo.
     */
    const scroll = dispositivo === 'escritorio'
      ? props.scroll
      : { x: 'max-content' as const, ...(props.scroll ?? {}) }
    return <Table<T> {...props} scroll={scroll} />
  }
  void rest

  const rows = (dataSource ?? []) as T[]
  const keyOf = (r: T, i: number): Key =>
    typeof rowKey === 'function'
      ? (rowKey(r, i) as Key)
      : rowKey
        ? ((r as any)[rowKey as string] as Key)
        : i

  const pg = (pagination && typeof pagination === 'object' ? pagination : null) as TablePaginationConfig | null

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : rows.length === 0 ? (
        <Empty description={mobileEmptyText ?? 'Sin registros'} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
          {rows.map((r, i) => (
            <div key={keyOf(r, i)}>{renderMobileCard(r, i)}</div>
          ))}
        </div>
      )}

      {pg && pg.total ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 8px' }}>
          <Pagination
            size="small"
            simple
            current={pg.current}
            pageSize={pg.pageSize}
            total={pg.total}
            onChange={(p, ps) => pg.onChange?.(p, ps ?? (pg.pageSize as number))}
          />
        </div>
      ) : null}
    </div>
  )
}
