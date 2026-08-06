import { useState, useEffect, useCallback } from 'react'
import { Drawer, List, Tag, Typography, Space, Button, Spin, Divider, Empty } from 'antd'
import {
  ExclamationCircleOutlined, ClockCircleOutlined,
  FileTextOutlined, SyncOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'
import { getInvoices }          from '../api/facturas'
import { getBills }             from '../api/compras'
import { getSatDteDocuments }   from '../api/compras'
import { getSatEmitidosDocuments } from '../api/facturas'

dayjs.extend(relativeTime)
dayjs.locale('es')

const { Text } = Typography

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export interface AlertItem {
  id:       string
  type:     'overdue' | 'due_soon' | 'dte_compras' | 'dte_ventas' | 'bill_overdue'
  title:    string
  subtitle: string
  amount?:  number
  date?:    string
  route:    string
}

interface Props {
  open:    boolean
  onClose: () => void
  onLoad?: (count: number) => void
}

const TYPE_CONFIG: Record<AlertItem['type'], { icon: React.ReactNode; color: string; bg: string }> = {
  overdue:    { icon: <ExclamationCircleOutlined />, color: '#dc2626', bg: '#fef2f2' },
  due_soon:   { icon: <ClockCircleOutlined />,       color: '#d97706', bg: '#fffbeb' },
  dte_compras:{ icon: <FileTextOutlined />,          color: '#1faec2', bg: '#f0fdfe' },
  dte_ventas: { icon: <FileTextOutlined />,          color: '#7c3aed', bg: '#f5f3ff' },
  bill_overdue:{ icon: <ExclamationCircleOutlined />, color: '#dc2626', bg: '#fef2f2' },
}

const SECTION_LABELS: Record<AlertItem['type'], string> = {
  overdue:     'Facturas de venta vencidas',
  due_soon:    'Por vencer en 7 días',
  dte_compras: 'DTE Compras listos para contabilizar',
  dte_ventas:  'DTE Ventas listos para contabilizar',
  bill_overdue:'Facturas de proveedor vencidas',
}

export default function NotificationsDrawer({ open, onClose, onLoad }: Props) {
  const navigate = useNavigate()
  const [alerts,  setAlerts]  = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today   = dayjs()
      const in7days = today.add(7, 'day').format('YYYY-MM-DD')

      const [overdueRes, sentRes, billsRes, dteComprasRes, dteVentasRes] = await Promise.allSettled([
        getInvoices({ status: 'overdue',  limit: 50 }),
        getInvoices({ status: 'sent',     limit: 200 }),
        getBills(   { status: 'overdue',  limit: 50 }),
        getSatDteDocuments(   { status: 'ready', limit: 50 }),
        getSatEmitidosDocuments({ status: 'ready', limit: 50 }),
      ])

      const items: AlertItem[] = []

      // Facturas de venta vencidas
      if (overdueRes.status === 'fulfilled') {
        for (const inv of overdueRes.value?.data ?? []) {
          const daysLate = today.diff(dayjs(inv.dueDate), 'day')
          items.push({
            id:       `ov-${inv.id}`,
            type:     'overdue',
            title:    inv.customerName ?? inv.invoiceNumber,
            subtitle: `${inv.invoiceNumber} · vencida hace ${daysLate} día${daysLate !== 1 ? 's' : ''}`,
            amount:   Number(inv.balance),
            date:     inv.dueDate,
            route:    `/ventas/facturas/${inv.id}`,
          })
        }
      }

      // Por vencer en 7 días (status=sent + dueDate ≤ hoy+7)
      if (sentRes.status === 'fulfilled') {
        for (const inv of sentRes.value?.data ?? []) {
          if (!inv.dueDate) continue
          const due = dayjs(inv.dueDate)
          if (due.isAfter(today) && due.isBefore(dayjs(in7days).add(1, 'day'))) {
            const daysLeft = due.diff(today, 'day')
            items.push({
              id:       `ds-${inv.id}`,
              type:     'due_soon',
              title:    inv.customerName ?? inv.invoiceNumber,
              subtitle: `${inv.invoiceNumber} · vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`,
              amount:   Number(inv.balance),
              date:     inv.dueDate,
              route:    `/ventas/facturas/${inv.id}`,
            })
          }
        }
      }

      // Facturas de proveedor vencidas
      if (billsRes.status === 'fulfilled') {
        for (const bill of (billsRes.value as any)?.data ?? []) {
          items.push({
            id:       `bo-${bill.id}`,
            type:     'bill_overdue',
            title:    bill.vendorName ?? bill.invoiceNumber,
            subtitle: `${bill.invoiceNumber} · proveedor vencida`,
            amount:   Number(bill.balance ?? bill.total),
            route:    `/compras/facturas/${bill.id}`,
          })
        }
      }

      // DTE Compras listos
      if (dteComprasRes.status === 'fulfilled') {
        const dtes: any[] = (dteComprasRes.value as any)?.data ?? []
        if (dtes.length > 0) {
          items.push({
            id:       'dte-compras-group',
            type:     'dte_compras',
            title:    `${dtes.length} DTE${dtes.length !== 1 ? 's' : ''} de compras listos`,
            subtitle: 'Ir a la bandeja para contabilizarlos',
            route:    '/compras/dte-sat',
          })
        }
      }

      // DTE Ventas listos
      if (dteVentasRes.status === 'fulfilled') {
        const dtes: any[] = (dteVentasRes.value as any)?.data ?? []
        if (dtes.length > 0) {
          items.push({
            id:       'dte-ventas-group',
            type:     'dte_ventas',
            title:    `${dtes.length} DTE${dtes.length !== 1 ? 's' : ''} de ventas listos`,
            subtitle: 'Ir a la bandeja para contabilizarlos',
            route:    '/ventas/dte-sat',
          })
        }
      }

      setAlerts(items)
      onLoad?.(items.length)
    } finally {
      setLoading(false)
    }
  }, [onLoad])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Cargar badge count al montar (sin abrir el drawer)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (route: string) => {
    navigate(route)
    onClose()
  }

  // Agrupar por tipo en orden de prioridad
  const order: AlertItem['type'][] = ['overdue', 'bill_overdue', 'due_soon', 'dte_compras', 'dte_ventas']
  const grouped = order
    .map(type => ({ type, items: alerts.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Alertas del negocio</span>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={load}
            type="text"
          >
            Actualizar
          </Button>
        </div>
      }
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0 } }}
    >
      {loading && alerts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: 32 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary">
                Sin alertas — todo al día
              </Text>
            }
          />
        </div>
      ) : (
        grouped.map((group, gi) => {
          const cfg = TYPE_CONFIG[group.type]
          return (
            <div key={group.type}>
              {gi > 0 && <Divider style={{ margin: 0 }} />}
              <div style={{ padding: '10px 16px 4px', background: '#fafbfc' }}>
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {SECTION_LABELS[group.type]}
                  <Tag style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px', padding: '0 5px', borderRadius: 10, background: cfg.bg, color: cfg.color, border: 'none' }}>
                    {group.items.length}
                  </Tag>
                </Text>
              </div>
              <List
                dataSource={group.items}
                renderItem={item => (
                  <List.Item
                    style={{ padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => handleClick(item.route)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Space align="start" style={{ width: '100%' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, fontSize: 15, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          {item.subtitle}
                        </div>
                      </div>
                      {item.amount !== undefined && (
                        <Text style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmtQ(item.amount)}
                        </Text>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          )
        })
      )}
    </Drawer>
  )
}

// Hook para obtener el conteo de alertas sin abrir el drawer
export function useAlertCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const run = async () => {
      try {
        const today   = dayjs()
        const in7days = today.add(7, 'day').format('YYYY-MM-DD')

        const [overdueRes, sentRes, billsRes, dteComprasRes, dteVentasRes] = await Promise.allSettled([
          getInvoices({ status: 'overdue', limit: 1 }),
          getInvoices({ status: 'sent',    limit: 200 }),
          getBills(   { status: 'overdue', limit: 1 }),
          getSatDteDocuments(   { status: 'ready', limit: 1 }),
          getSatEmitidosDocuments({ status: 'ready', limit: 1 }),
        ])

        let c = 0
        if (overdueRes.status    === 'fulfilled') c += overdueRes.value?.total    ?? 0
        if (billsRes.status      === 'fulfilled') c += (billsRes.value as any)?.total ?? 0
        if (dteComprasRes.status === 'fulfilled') c += ((dteComprasRes.value as any)?.total ?? 0) > 0 ? 1 : 0
        if (dteVentasRes.status  === 'fulfilled') c += ((dteVentasRes.value as any)?.total ?? 0) > 0 ? 1 : 0
        if (sentRes.status === 'fulfilled') {
          const soon = (sentRes.value?.data ?? []).filter(inv => {
            if (!inv.dueDate) return false
            const due = dayjs(inv.dueDate)
            return due.isAfter(today) && due.isBefore(dayjs(in7days).add(1, 'day'))
          })
          c += soon.length
        }
        setCount(Math.min(c, 99))
      } catch { /* silencioso */ }
    }
    run()
    const id = setInterval(run, 5 * 60 * 1000) // refresca cada 5 min
    return () => clearInterval(id)
  }, [])

  return count
}
