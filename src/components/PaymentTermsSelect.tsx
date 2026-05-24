/**
 * PaymentTermsSelect — selector de términos de pago con opción de agregar entradas personalizadas.
 * Usado en Clientes y Proveedores.
 *
 * Valor estándar:  "net_30", "immediate", etc.
 * Valor libre:     cualquier texto, ej. "Neto 45 días hábiles"
 */
import { useState, useEffect } from 'react'
import { Select, Space, Tag, Typography, Input, Button, Tooltip } from 'antd'
import { PlusOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

// ── Opciones estándar ──────────────────────────────────────────────────────────
export const PAYMENT_TERM_OPTIONS: { value: string; label: string; days: number | null; description: string }[] = [
  { value: 'immediate', label: 'Pagadero a la recepción',  days: 0,   description: 'Pago al momento de recibir la factura' },
  { value: 'net_7',     label: 'Neto 7 días',              days: 7,   description: 'Vencimiento a 7 días de la fecha de factura' },
  { value: 'net_10',    label: 'Neto 10 días',             days: 10,  description: 'Vencimiento a 10 días' },
  { value: 'net_15',    label: 'Neto 15 días',             days: 15,  description: 'Vencimiento a 15 días de la fecha de factura' },
  { value: 'net_30',    label: 'Neto 30 días',             days: 30,  description: 'Vencimiento a 30 días de la fecha de factura' },
  { value: 'net_45',    label: 'Neto 45 días',             days: 45,  description: 'Vencimiento a 45 días' },
  { value: 'net_60',    label: 'Neto 60 días',             days: 60,  description: 'Vencimiento a 60 días de la fecha de factura' },
  { value: 'net_90',    label: 'Neto 90 días',             days: 90,  description: 'Vencimiento a 90 días' },
  { value: 'net_120',   label: 'Neto 120 días',            days: 120, description: 'Vencimiento a 120 días' },
]

const STORAGE_KEY = 'contaerp_custom_payment_terms'

function loadCustomTerms(): { value: string; label: string }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}
function saveCustomTerms(terms: { value: string; label: string }[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(terms))
}

/** Devuelve la etiqueta legible dado un valor (key o texto libre) */
export function getPaymentTermLabel(value: string): string {
  if (!value) return ''
  const standard = PAYMENT_TERM_OPTIONS.find(o => o.value === value)
  if (standard) return standard.label
  const custom = loadCustomTerms().find(o => o.value === value)
  if (custom) return custom.label
  return value // el valor mismo es el label (texto libre)
}

/** Calcula la fecha de vencimiento a partir de los días estándar */
export function getPaymentTermDays(value: string): number | null {
  const found = PAYMENT_TERM_OPTIONS.find(o => o.value === value)
  return found ? found.days : null
}

// ── Componente ─────────────────────────────────────────────────────────────────

interface PaymentTermsSelectProps {
  value?:      string
  onChange?:   (value: string | undefined) => void
  disabled?:   boolean
  size?:       'small' | 'middle' | 'large'
  placeholder?: string
}

export default function PaymentTermsSelect({
  value, onChange, disabled, size, placeholder = 'Selecciona términos de pago',
}: PaymentTermsSelectProps) {
  const [customTerms, setCustomTerms] = useState<{ value: string; label: string }[]>(loadCustomTerms)
  const [search,      setSearch]      = useState('')
  const [addMode,     setAddMode]     = useState(false)
  const [newLabel,    setNewLabel]    = useState('')
  const [open,        setOpen]        = useState(false)

  // Sync custom terms from localStorage
  useEffect(() => {
    setCustomTerms(loadCustomTerms())
  }, [])

  const allOptions = [
    ...PAYMENT_TERM_OPTIONS.map(o => ({
      value:   o.value,
      label:   o.label,
      days:    o.days,
      isCustom: false,
    })),
    ...customTerms.map(o => ({
      value:    o.value,
      label:    o.label,
      days:     null,
      isCustom: true,
    })),
  ]

  const filtered = allOptions.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase()) || o.value.includes(search.toLowerCase())
  )

  const handleAddCustom = () => {
    if (!newLabel.trim()) return
    const key   = newLabel.trim().toLowerCase().replace(/\s+/g, '_')
    const entry = { value: key, label: newLabel.trim() }
    const updated = [...customTerms.filter(t => t.value !== key), entry]
    saveCustomTerms(updated)
    setCustomTerms(updated)
    onChange?.(key)
    setNewLabel('')
    setAddMode(false)
    setOpen(false)
  }

  const handleRemoveCustom = (val: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customTerms.filter(t => t.value !== val)
    saveCustomTerms(updated)
    setCustomTerms(updated)
    if (value === val) onChange?.(undefined)
  }

  const dropdownRender = (menu: React.ReactNode) => (
    <div>
      {menu}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 10px' }}>
        {!addMode ? (
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            style={{ width: '100%', fontSize: 12 }}
            onClick={() => setAddMode(true)}
          >
            Agregar términos personalizados
          </Button>
        ) : (
          <Space.Compact style={{ width: '100%' }}>
            <Input
              size="small"
              placeholder="Ej: Neto 45 días hábiles"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onPressEnter={handleAddCustom}
              autoFocus
              style={{ fontSize: 12 }}
            />
            <Button size="small" type="primary" onClick={handleAddCustom} disabled={!newLabel.trim()}>
              Agregar
            </Button>
            <Button size="small" onClick={() => { setAddMode(false); setNewLabel('') }}>
              ✕
            </Button>
          </Space.Compact>
        )}
      </div>
    </div>
  )

  return (
    <Select
      showSearch
      allowClear
      open={open}
      onDropdownVisibleChange={setOpen}
      disabled={disabled}
      size={size}
      value={value || undefined}
      onChange={onChange}
      placeholder={
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#bbb' }} />
          {placeholder}
        </Space>
      }
      onSearch={setSearch}
      filterOption={false}
      style={{ width: '100%' }}
      dropdownRender={dropdownRender}
      notFoundContent={
        <div style={{ padding: '8px 12px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            No encontrado — usa el botón de abajo para agregar
          </Text>
        </div>
      }
      optionRender={opt => {
        const item = allOptions.find(o => o.value === opt.value)
        return (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={6}>
              {item?.days !== null && item?.days !== undefined ? (
                <Tag color="blue" style={{ fontSize: 10, fontFamily: 'monospace', minWidth: 28, textAlign: 'center' }}>
                  {item.days === 0 ? '0d' : `${item.days}d`}
                </Tag>
              ) : (
                <Tag color="purple" style={{ fontSize: 10 }}>custom</Tag>
              )}
              <Text style={{ fontSize: 13 }}>{opt.label?.toString()}</Text>
            </Space>
            {item?.isCustom && (
              <Button
                type="text" size="small" danger
                style={{ fontSize: 10, padding: '0 4px', height: 18 }}
                onClick={e => handleRemoveCustom(opt.value as string, e)}
              >
                ✕
              </Button>
            )}
          </Space>
        )
      }}
      labelRender={opt => {
        const item = allOptions.find(o => o.value === opt.value)
        if (!item && opt.value) return <span style={{ fontSize: 13 }}>{String(opt.value)}</span>
        return (
          <Space size={6}>
            <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 12 }} />
            <span style={{ fontSize: 13 }}>{item?.label || String(opt.value || '')}</span>
            {item?.days != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>({item.days} días)</Text>
            )}
          </Space>
        )
      }}
      options={filtered.map(o => ({ value: o.value, label: o.label }))}
    />
  )
}
