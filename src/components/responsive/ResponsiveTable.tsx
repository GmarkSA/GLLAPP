import type { ReactNode, Key } from 'react'
import { Table, Spin, Empty, Pagination } from 'antd'
import type { TableProps, TablePaginationConfig } from 'antd'
import { useIsMobile } from '../../hooks/useMediaQuery'

// Tabla que en desktop/tablet se comporta como <Table> de AntD, y en móvil (<992px)
// renderiza cada fila como tarjeta (patrón Zoho Books). Si no se pasa `renderMobileCard`,
// siempre usa la tabla normal (con su scroll horizontal).
export interface ResponsiveTableProps<T> extends TableProps<T> {
  renderMobileCard?: (record: T, index: number) => ReactNode
  mobileEmptyText?: ReactNode
}

export default function ResponsiveTable<T extends object = any>(props: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()
  const { renderMobileCard, mobileEmptyText, dataSource, loading, rowKey, pagination, ...rest } = props

  if (!isMobile || !renderMobileCard) {
    return <Table<T> {...props} />
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
