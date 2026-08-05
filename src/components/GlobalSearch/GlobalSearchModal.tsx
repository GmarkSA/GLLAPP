import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Modal, Input, Tag, Typography, Spin } from 'antd'
import {
  SearchOutlined, FileTextOutlined, UserOutlined,
  ShopOutlined, ThunderboltOutlined, DollarOutlined,
  PlusOutlined, FileAddOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getInvoices, INVOICE_STATUS_CONFIG } from '../../api/facturas'
import { getCustomers, getVendors } from '../../api/contactos'

const { Text } = Typography

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ResultType = 'action' | 'invoice' | 'customer' | 'vendor'

interface ResultItem {
  id:         string
  type:       ResultType
  icon:       React.ReactNode
  iconColor:  string
  primary:    string
  secondary?: string
  tag?:       string
  tagColor?:  string
  href:       string
}

// ── Acciones rápidas (estado vacío) ───────────────────────────────────────────
const QUICK_ACTIONS: ResultItem[] = [
  { id: 'qa-inv',  type: 'action', icon: <FileAddOutlined />,  iconColor: '#1faec2', primary: 'Nueva factura',    href: '/ventas/facturas/nueva'          },
  { id: 'qa-cli',  type: 'action', icon: <PlusOutlined />,     iconColor: '#7c5cfc', primary: 'Nuevo cliente',    href: '/ventas/clientes/nuevo'          },
  { id: 'qa-pro',  type: 'action', icon: <PlusOutlined />,     iconColor: '#059669', primary: 'Nuevo proveedor',  href: '/compras/proveedores/nuevo'      },
  { id: 'qa-pago', type: 'action', icon: <DollarOutlined />,   iconColor: '#ff7f00', primary: 'Registrar pago',   href: '/ventas/pagos-recibidos/nuevo'   },
  { id: 'qa-cot',  type: 'action', icon: <FileTextOutlined />, iconColor: '#1B3A6B', primary: 'Nueva cotización', href: '/ventas/estimaciones/nueva'      },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const toArray = (v: unknown): any[] =>
  Array.isArray(v) ? v : ((v as any)?.data ?? [])

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

// ── Componente ────────────────────────────────────────────────────────────────
export default function GlobalSearchModal({ open, onClose }: Props) {
  const navigate   = useNavigate()
  const inputRef   = useRef<any>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  const [query,     setQuery]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [invoices,  setInvoices]  = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [vendors,   setVendors]   = useState<any[]>([])
  const [focused,   setFocused]   = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Resetear al abrir
  useEffect(() => {
    if (!open) return
    setQuery(''); setInvoices([]); setCustomers([]); setVendors([]); setFocused(0)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  // Búsqueda con debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setInvoices([]); setCustomers([]); setVendors([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const [invRes, cusRes, venRes] = await Promise.allSettled([
        getInvoices({ search: q, limit: 5 }),
        getCustomers({ search: q, limit: 5 }),
        getVendors({ search: q, limit: 5 }),
      ])
      setInvoices(invRes.status === 'fulfilled' ? toArray((invRes.value as any)?.data ?? invRes.value) : [])
      setCustomers(cusRes.status === 'fulfilled' ? toArray(cusRes.value) : [])
      setVendors(venRes.status === 'fulfilled'   ? toArray(venRes.value) : [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Lista plana para navegación con teclado
  const allItems = useMemo((): ResultItem[] => {
    const q = query.trim()
    if (!q) return QUICK_ACTIONS

    const invItems: ResultItem[] = invoices.map(inv => {
      const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
      return {
        id: inv.id, type: 'invoice',
        icon: <FileTextOutlined />, iconColor: '#1faec2',
        primary: inv.invoiceNumber, secondary: inv.customerName,
        tag: cfg?.label, tagColor: cfg?.color,
        href: `/ventas/facturas/${inv.id}`,
      }
    })
    const cusItems: ResultItem[] = customers.map(c => ({
      id: c.id, type: 'customer',
      icon: <UserOutlined />, iconColor: '#7c5cfc',
      primary: c.name, secondary: c.taxId ? `NIT: ${c.taxId}` : undefined,
      href: `/ventas/clientes/${c.id}`,
    }))
    const venItems: ResultItem[] = vendors.map(v => ({
      id: v.id, type: 'vendor',
      icon: <ShopOutlined />, iconColor: '#059669',
      primary: v.name, secondary: v.taxId ? `NIT: ${v.taxId}` : undefined,
      href: `/compras/proveedores/${v.id}`,
    }))
    return [...invItems, ...cusItems, ...venItems]
  }, [query, invoices, customers, vendors])

  // Reset focused cuando cambian resultados
  useEffect(() => { setFocused(0) }, [allItems])

  // Scroll del item enfocado al view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${focused}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  const go = useCallback((href: string) => { navigate(href); onClose() }, [navigate, onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, allItems.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    else if (e.key === 'Enter' && allItems[focused]) { go(allItems[focused].href) }
  }

  // ── Renderizado de un item ─────────────────────────────────────────────────
  const renderItem = (item: ResultItem, idx: number) => (
    <div
      key={item.id}
      data-idx={idx}
      onClick={() => go(item.href)}
      onMouseEnter={() => setFocused(idx)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 16px', borderRadius: 6, cursor: 'pointer',
        background: focused === idx ? 'rgba(31,174,194,0.08)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
        background: `${item.iconColor}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: item.iconColor,
      }}>
        {item.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.primary}
        </div>
        {item.secondary && (
          <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.secondary}
          </div>
        )}
      </div>
      {item.tag && (
        <Tag color={item.tagColor} style={{ fontSize: 11, margin: 0, flexShrink: 0 }}>{item.tag}</Tag>
      )}
    </div>
  )

  const SectionLabel = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#9ca3af', fontSize: 12 }}>{icon}</span>
      <Text style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
    </div>
  )

  const isSearching  = query.trim().length > 0
  const hasInvoices  = invoices.length > 0
  const hasCustomers = customers.length > 0
  const hasVendors   = vendors.length > 0
  const hasResults   = hasInvoices || hasCustomers || hasVendors

  // Índice global por sección para keyboard nav
  const invStart = 0
  const cusStart = invoices.length
  const venStart = invoices.length + customers.length

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      closable={false}
      centered
      width={600}
      bodyStyle={{ padding: 0, borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
      style={{ top: 80 }}
    >
      {/* Input de búsqueda */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        {loading
          ? <Spin size="small" style={{ flexShrink: 0 }} />
          : <SearchOutlined style={{ fontSize: 18, color: '#9ca3af', flexShrink: 0 }} />
        }
        <Input
          ref={inputRef}
          variant="borderless"
          placeholder="Buscar facturas, clientes, proveedores..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ fontSize: 15, padding: 0, flex: 1, boxShadow: 'none' }}
          autoComplete="off"
        />
        <kbd
          onClick={onClose}
          style={{
            fontSize: 11, color: '#9ca3af',
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            borderRadius: 4, padding: '2px 6px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          ESC
        </kbd>
      </div>

      {/* Lista de resultados */}
      <div ref={listRef} style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 0' }}>

        {/* Acciones rápidas (sin búsqueda) */}
        {!isSearching && (
          <>
            <SectionLabel icon={<ThunderboltOutlined />} label="Acciones rápidas" />
            {QUICK_ACTIONS.map((item, i) => renderItem(item, i))}
          </>
        )}

        {/* Sin resultados */}
        {isSearching && !loading && !hasResults && (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Sin resultados para «{query}»
          </div>
        )}

        {/* Facturas de venta */}
        {isSearching && hasInvoices && (
          <>
            <SectionLabel icon={<FileTextOutlined />} label="Facturas de venta" />
            {invoices.map((inv, i) => renderItem(allItems[invStart + i], invStart + i))}
          </>
        )}

        {/* Clientes */}
        {isSearching && hasCustomers && (
          <>
            <SectionLabel icon={<UserOutlined />} label="Clientes" />
            {customers.map((_, i) => renderItem(allItems[cusStart + i], cusStart + i))}
          </>
        )}

        {/* Proveedores */}
        {isSearching && hasVendors && (
          <>
            <SectionLabel icon={<ShopOutlined />} label="Proveedores" />
            {vendors.map((_, i) => renderItem(allItems[venStart + i], venStart + i))}
          </>
        )}
      </div>

      {/* Footer con atajos de teclado */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', gap: 16, alignItems: 'center',
      }}>
        {[
          { key: '↑↓',  label: 'navegar' },
          { key: '↵',   label: 'abrir'   },
          { key: 'Esc', label: 'cerrar'  },
        ].map(h => (
          <span key={h.key} style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'inherit',
            }}>
              {h.key}
            </kbd>
            {h.label}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, color: '#d1d5db' }}>Cmd+K</Text>
      </div>
    </Modal>
  )
}
