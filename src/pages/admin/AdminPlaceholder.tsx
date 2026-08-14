import { Empty } from 'antd'

/** Sección del Platform Admin aún no construida (MRR, Errores, Soporte, Sistema…). */
export default function AdminPlaceholder({ titulo }: { titulo: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
      <Empty description={<span style={{ color: '#8b8d97' }}>{titulo} — en construcción</span>} />
    </div>
  )
}
