import React from 'react'
import { Table } from 'antd'
import type { TableProps } from 'antd'

// Thin wrapper que aplica las props por defecto del design system.
// Acepta cualquier prop de Table<T> y las pasa al componente.
export function DataTable<T extends object>(props: TableProps<T>) {
  return (
    <Table<T>
      size="small"
      scroll={{ x: 'max-content' }}
      pagination={{
        size: 'small',
        showSizeChanger: true,
        showTotal: (total) => `${total} registros`,
        pageSizeOptions: ['20', '50', '100'],
        defaultPageSize: 20,
      }}
      {...props}
    />
  )
}
