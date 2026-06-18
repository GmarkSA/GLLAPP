import React from 'react'
import { Tag } from 'antd'

interface StatusConfig {
  label: string
  color: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Facturas / documentos
  draft:     { label: 'Borrador',   color: 'default' },
  sent:      { label: 'Enviada',    color: 'blue'    },
  paid:      { label: 'Pagada',     color: 'success' },
  partial:   { label: 'Parcial',    color: 'warning' },
  overdue:   { label: 'Vencida',    color: 'error'   },
  void:      { label: 'Anulada',    color: 'default' },
  cancelled: { label: 'Cancelada',  color: 'default' },
  // Estados genéricos
  active:    { label: 'Activo',     color: 'success' },
  inactive:  { label: 'Inactivo',   color: 'default' },
  pending:   { label: 'Pendiente',  color: 'warning' },
  approved:  { label: 'Aprobado',   color: 'success' },
  rejected:  { label: 'Rechazado',  color: 'error'   },
}

interface StatusBadgeProps {
  status: string
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status?.toLowerCase()]
  return (
    <Tag color={cfg?.color ?? 'default'}>
      {label ?? cfg?.label ?? status}
    </Tag>
  )
}
