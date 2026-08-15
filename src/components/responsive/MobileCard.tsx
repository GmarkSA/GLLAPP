import type { ReactNode } from 'react'
import { RightOutlined } from '@ant-design/icons'

// Tarjeta de fila para móvil, estilo Zoho Books:
//   izquierda: título (nombre) + subtítulo (número · fecha)
//   derecha:   monto (negrita) + estado (badge) + monto secundario (saldo)
// Reutilizable en cualquier listado (facturas, DTE, catálogo, etc.).
export interface MobileCardProps {
  title: ReactNode
  subtitle?: ReactNode
  amount?: ReactNode
  amountSub?: ReactNode
  status?: ReactNode
  onClick?: () => void
  chevron?: boolean
  extra?: ReactNode
}

export default function MobileCard({
  title, subtitle, amount, amountSub, status, onClick, chevron = true, extra,
}: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #eceef2',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 1px 3px rgba(10,10,10,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: extra ? 8 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#8493a8', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          {amount !== undefined && (
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>
              {amount}
            </div>
          )}
          {status}
          {amountSub !== undefined && (
            <div style={{ fontSize: 11, color: '#8493a8', fontVariantNumeric: 'tabular-nums' }}>{amountSub}</div>
          )}
        </div>

        {chevron && onClick && (
          <RightOutlined style={{ color: '#c3cad6', fontSize: 12, alignSelf: 'center' }} />
        )}
      </div>

      {extra && <div style={{ borderTop: '1px solid #f2f4f7', paddingTop: 8 }}>{extra}</div>}
    </div>
  )
}
