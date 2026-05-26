import { useState, useCallback, useEffect, useRef, memo } from 'react'
import {
  Table, Button, Input, InputNumber, Select, Tooltip, Tag, Typography, message,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, WarningOutlined, SwapOutlined,
} from '@ant-design/icons'
import { getProducts, getProduct, type Product } from '../../api/inventario'
import { getAccounts, type Account } from '../../api/catalogo'
import type { Tax } from '../../api/impuestos'

export interface LineItem {
  _key:          string
  productId?:    string
  description:   string
  unit?:         string
  quantity:      number
  unitPrice:     number
  discountPercent: number
  taxPercent:    number
  taxId?:        string
  taxName?:      string    // nombre para agrupar en el desglose de totales
  taxInclusive?: boolean   // true = precio ya incluye el impuesto
  accountId?:    string
  projectId?:    string
  // stock info (UI only)
  stockOnHand?:    number
  isInventoriable?: boolean
  // computed
  lineNet:       number
  lineTax:       number
  lineTotal:     number
}

let _keySeq = 0
export const newLineItem = (overrides?: Partial<LineItem>): LineItem => {
  const item: LineItem = {
    _key:            String(++_keySeq),
    description:     '',
    quantity:        1,
    unitPrice:       0,
    discountPercent: 0,
    taxPercent:      12,
    taxInclusive:    true,   // Guatemala: por defecto IVA incluido
    lineNet:         0,
    lineTax:         0,
    lineTotal:       0,
    ...overrides,
  }
  return recalc(item)
}

export function recalc(item: LineItem): LineItem {
  const rate        = item.taxPercent ?? 0
  const grossAmount = item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100)

  let lineNet: number, lineTax: number, lineTotal: number

  if (item.taxInclusive && rate > 0) {
    // Precio YA incluye el impuesto → extraer base e impuesto
    lineNet   = Math.round(grossAmount / (1 + rate / 100) * 100) / 100
    lineTax   = Math.round((grossAmount - lineNet) * 100) / 100
    lineTotal = Math.round(grossAmount * 100) / 100
  } else {
    // Precio excluye el impuesto → agregar impuesto sobre la base
    lineNet   = Math.round(grossAmount * 100) / 100
    lineTax   = Math.round(lineNet * (rate / 100) * 100) / 100
    lineTotal = Math.round((lineNet + lineTax) * 100) / 100
  }

  return { ...item, lineNet, lineTax, lineTotal }
}

export interface TaxBreakdownItem {
  key:    string
  name:   string
  rate:   number
  amount: number
}

export function calcTotals(items: LineItem[]) {
  const subtotal  = Math.round(items.reduce((s, i) => s + i.lineNet,   0) * 100) / 100
  const taxAmount = Math.round(items.reduce((s, i) => s + i.lineTax,   0) * 100) / 100
  const total     = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
  const hasInclusive = items.some(i => (i.taxInclusive ?? true) && i.taxPercent > 0)

  // Agrupar impuesto por tipo
  const taxMap = new Map<string, TaxBreakdownItem>()
  for (const item of items) {
    if (item.lineTax === 0 && item.taxPercent === 0) continue
    const key  = item.taxId ?? `flat:${item.taxPercent}`
    const name = item.taxName ?? `IVA ${item.taxPercent}%`
    if (!taxMap.has(key)) taxMap.set(key, { key, name, rate: item.taxPercent, amount: 0 })
    taxMap.get(key)!.amount += item.lineTax
  }
  const taxBreakdown: TaxBreakdownItem[] = Array.from(taxMap.values()).map(t => ({
    ...t,
    amount: Math.round(t.amount * 100) / 100,
  }))

  return { subtotal, taxAmount, total, hasInclusive, taxBreakdown }
}

type ProdOption = { value: string; label: string; product: Product }

interface Props {
  items:    LineItem[]
  taxes:    Tax[]
  onChange: (items: LineItem[]) => void
  readOnly?: boolean
  docType?: 'invoice' | 'estimate' | 'bill' | 'po'
  /** ID del impuesto por defecto configurado en el proveedor (solo po/bill) */
  vendorDefaultTaxId?: string
}

/** Input de celda con estado local + debounce — evita pérdida de foco Y mantiene padre sincronizado */
const CellInput = memo(({ value, onCommit, placeholder, style }: {
  value: string; onCommit: (v: string) => void
  placeholder?: string; style?: React.CSSProperties
}) => {
  const [local, setLocal]   = useState(value)
  const committed           = useRef(value)
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (value !== committed.current) { setLocal(value); committed.current = value }
  }, [value])

  const commitNow = (v: string) => {
    clearTimeout(debounceRef.current)
    if (v !== committed.current) { committed.current = v; onCommit(v) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocal(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (v !== committed.current) { committed.current = v; onCommit(v) }
    }, 500)
  }

  return (
    <Input size="small" value={local}
      onChange={handleChange}
      onBlur={() => commitNow(local)}
      onPressEnter={() => commitNow(local)}
      placeholder={placeholder} style={style} />
  )
})

/** TextArea de celda con estado local + debounce — descripción multi-línea siempre sincronizada */
const CellTextArea = memo(({ value, onCommit, placeholder, style }: {
  value: string; onCommit: (v: string) => void
  placeholder?: string; style?: React.CSSProperties
}) => {
  const [local, setLocal]   = useState(value)
  const committed           = useRef(value)
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (value !== committed.current) { setLocal(value); committed.current = value }
  }, [value])

  const commitNow = (v: string) => {
    clearTimeout(debounceRef.current)
    if (v !== committed.current) { committed.current = v; onCommit(v) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setLocal(v)
    clearTimeout(debounceRef.current)
    // Sincroniza con el padre cada 500ms mientras escribe — evita pérdida al cambiar unidad/cantidad
    debounceRef.current = setTimeout(() => {
      if (v !== committed.current) { committed.current = v; onCommit(v) }
    }, 500)
  }

  return (
    <Input.TextArea
      size="small" value={local} autoSize={{ minRows: 1, maxRows: 4 }}
      onChange={handleChange}
      onBlur={() => commitNow(local)}
      placeholder={placeholder}
      style={{ fontSize: 13, resize: 'none', ...style }}
    />
  )
})

/** InputNumber de celda con estado local — evita pérdida de foco al teclear */
const CellInputNumber = memo(({ value, onCommit, min, max, step, prefix, suffix, style }: {
  value: number; onCommit: (v: number) => void
  min?: number; max?: number; step?: number
  prefix?: string; suffix?: string; style?: React.CSSProperties
}) => {
  const [local, setLocal] = useState<number | null>(value)
  const committed = useRef(value)
  useEffect(() => {
    if (value !== committed.current) { setLocal(value); committed.current = value }
  }, [value])
  const commit = (v: number | null) => {
    const val = v ?? committed.current
    if (val !== committed.current) { committed.current = val; onCommit(val) }
  }
  return (
    <InputNumber
      size="small" style={{ width: '100%', ...style }}
      min={min} max={max} step={step}
      prefix={prefix} suffix={suffix}
      value={local}
      onChange={v => setLocal(v)}
      onBlur={() => commit(local)}
      onKeyDown={e => { if (e.key === 'Enter') commit(local) }}
    />
  )
})

export default function LineItemsEditor({ items, taxes, onChange, readOnly, docType = 'invoice', vendorDefaultTaxId }: Props) {
  const [prodOptions, setProdOptions]     = useState<ProdOption[]>([])
  const [searching,   setSearching]       = useState(false)
  const [initialized, setInitialized]     = useState(false)
  const [allAccounts,  setAllAccounts]  = useState<Account[]>([])
  const [accountMap,   setAccountMap]   = useState<Record<string, Account>>({})

  // Carga TODAS las cuentas activas (no solo ingresos — el usuario puede asignar cualquier cuenta)
  useEffect(() => {
    getAccounts()
      .then((res: any) => {
        const list: Account[] = Array.isArray(res) ? res : (res?.data ?? [])
        // Mostrar todas las cuentas de detalle (no encabezados), activas
        const detail = list.filter(a => !a.isHeader && a.isActive)
        setAllAccounts(detail)
        // Mapa completo para mostrar nombres en líneas existentes
        const map: Record<string, Account> = {}
        list.forEach(a => { map[a.id] = a })
        setAccountMap(map)
      })
      .catch(() => {})
  }, [])

  // Al montar, si hay ítems con productId pre-cargados (edición de documento existente),
  // cargamos esos productos para que el Select muestre el nombre en lugar del UUID.
  useEffect(() => {
    const idsToLoad = items
      .map(i => i.productId)
      .filter((id): id is string => !!id)

    if (idsToLoad.length === 0) return

    Promise.all(idsToLoad.map(id => getProduct(id).catch(() => null)))
      .then(products => {
        const valid = products.filter(Boolean) as Product[]
        if (valid.length === 0) return
        setProdOptions(prev => {
          const existingIds = new Set(prev.map(o => o.value))
          const newOpts: ProdOption[] = valid
            .filter(p => !existingIds.has(p.id!))
            .map(p => ({
              value:   p.id!,
              label:   `${p.sku ? `[${p.sku}] ` : ''}${p.name}`,
              product: p,
            }))
          return [...prev, ...newOpts]
        })
      })
  // Solo al montar (items iniciales) — eslint-disable-next-line
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carga inicial de productos al abrir el dropdown (top 30)
  const loadInitial = useCallback(async () => {
    if (initialized) return
    setSearching(true)
    try {
      const res: any = await getProducts({ limit: 30 })
      const list: Product[] = Array.isArray(res) ? res : (res?.data ?? [])
      setProdOptions(prev => {
        const existingIds = new Set(prev.map(o => o.value))
        const newOpts = list
          .filter(p => !existingIds.has(p.id!))
          .map(p => ({
            value:   p.id!,
            label:   `${p.sku ? `[${p.sku}] ` : ''}${p.name}`,
            product: p,
          }))
        return [...prev, ...newOpts]
      })
      setInitialized(true)
    } finally { setSearching(false) }
  }, [initialized])

  const searchProducts = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const params: any = { limit: 30 }
      if (q && q.trim().length >= 1) params.search = q.trim()
      const res: any = await getProducts(params)
      const list: Product[] = Array.isArray(res) ? res : (res?.data ?? [])
      setProdOptions(prev => {
        // Conservar siempre los artículos que ya están seleccionados en alguna línea
        const selectedIds = new Set(items.map(i => i.productId).filter(Boolean))
        const keepOpts    = prev.filter(o => selectedIds.has(o.value))
        const newIds      = new Set(keepOpts.map(o => o.value))
        const newOpts     = list
          .filter(p => !newIds.has(p.id!))
          .map(p => ({
            value:   p.id!,
            label:   `${p.sku ? `[${p.sku}] ` : ''}${p.name}`,
            product: p,
          }))
        return [...keepOpts, ...newOpts]
      })
    } finally { setSearching(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Aplica el impuesto preferido a las líneas sin artículo seleccionado.
  // Para compras (po/bill): filtra solo impuestos de compra; proveedor tiene prioridad.
  // Se re-ejecuta cuando cargan los taxes O cuando cambia el proveedor.
  useEffect(() => {
    if (!taxes.length) return
    const isPurchase = docType === 'po' || docType === 'bill'
    const eligible = isPurchase
      ? taxes.filter(t => t.isActive && (t.applicability === 'purchases' || t.applicability === 'both'))
      : taxes.filter(t => t.isActive && (t.applicability === 'sales'     || t.applicability === 'both'))

    const preferredTax =
      (vendorDefaultTaxId ? eligible.find(t => t.id === vendorDefaultTaxId) : undefined) ??
      eligible.find(t => t.isDefault) ??
      eligible.find(t => Number(t.rate) > 0) ??
      eligible[0]
    if (!preferredTax) return

    const needsUpdate = items.some(i => !i.productId && i.taxId !== preferredTax.id)
    if (!needsUpdate) return

    onChange(items.map(item => {
      if (item.productId) return item
      if (item.taxId === preferredTax.id) return item
      return recalc({
        ...item,
        taxId:        preferredTax.id,
        taxName:      preferredTax.name,
        taxPercent:   Number(preferredTax.rate),
        taxInclusive: preferredTax.isInclusive ?? true,
      })
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxes, vendorDefaultTaxId, docType])

  const taxOptions = taxes
    .filter(t => t.isActive)
    .map(t => ({
      value:       t.id,
      label:       `${t.name} (${Number(t.rate)}%)`,
      rate:        t.rate,
      isInclusive: t.isInclusive,
    }))

  const update = (key: string, patch: Partial<LineItem>) =>
    onChange(items.map(item => item._key === key ? recalc({ ...item, ...patch }) : item))

  const addRow = () => {
    const isPurchase = docType === 'po' || docType === 'bill'
    const eligible = isPurchase
      ? taxes.filter(t => t.isActive && (t.applicability === 'purchases' || t.applicability === 'both'))
      : taxes.filter(t => t.isActive && (t.applicability === 'sales'     || t.applicability === 'both'))
    const preferredTax =
      (vendorDefaultTaxId ? eligible.find(t => t.id === vendorDefaultTaxId) : undefined) ??
      eligible.find(t => t.isDefault) ??
      eligible.find(t => Number(t.rate) > 0) ??
      eligible[0]
    onChange([...items, newLineItem(preferredTax ? {
      taxId:        preferredTax.id,
      taxName:      preferredTax.name,
      taxPercent:   Number(preferredTax.rate),
      taxInclusive: preferredTax.isInclusive ?? true,
    } : {})])
  }
  const removeRow = (key: string) => onChange(items.filter(i => i._key !== key))

  const selectProduct = (key: string, productId: string) => {
    const opt = prodOptions.find(o => o.value === productId)
    if (!opt) return
    const p = opt.product
    const isPurchase = docType === 'po' || docType === 'bill'

    // ── Tax resolution ─────────────────────────────────────────────────────
    let resolvedTax: Tax | undefined

    // Filtrar impuestos según tipo de documento
    const eligible = isPurchase
      ? taxes.filter(t => t.isActive && (t.applicability === 'purchases' || t.applicability === 'both'))
      : taxes.filter(t => t.isActive && (t.applicability === 'sales'     || t.applicability === 'both'))

    if (isPurchase) {
      // 1. Impuesto configurado en el proveedor
      if (vendorDefaultTaxId) {
        resolvedTax = eligible.find(t => t.id === vendorDefaultTaxId)
      }
      // 2. Impuesto configurado en el artículo (compras)
      if (!resolvedTax && p.purchaseTaxId) {
        resolvedTax = eligible.find(t => t.id === p.purchaseTaxId)
      }
      // 3. Impuesto de compra por defecto o primer activo (fallback)
      if (!resolvedTax) {
        resolvedTax = eligible.find(t => t.isDefault) ?? eligible.find(t => Number(t.rate) > 0) ?? eligible[0]
      }
      // Avisar si ni el proveedor ni el artículo tenían impuesto de compra definido
      if (!vendorDefaultTaxId && !p.purchaseTaxId) {
        message.warning(
          `"${p.name}" no tiene impuesto de compra configurado — se aplicó el impuesto por defecto. ` +
          `Configúralo en el artículo o en el proveedor para evitar este aviso.`,
          6,
        )
      }
    } else {
      // Ventas: impuesto del artículo → global por defecto
      if (p.salesTaxId) {
        resolvedTax = eligible.find(t => t.id === p.salesTaxId)
      }
      if (!resolvedTax) {
        resolvedTax = eligible.find(t => t.isDefault) ?? eligible.find(t => Number(t.rate) > 0) ?? eligible[0]
      }
    }

    update(key, {
      productId,
      description:     p.description || p.name,
      unit:            p.unit,
      unitPrice:       Number(isPurchase ? (p.purchasePrice ?? p.salesPrice ?? 0) : (p.salesPrice ?? 0)),
      taxPercent:      resolvedTax ? Number(resolvedTax.rate) : 12,
      taxId:           resolvedTax?.id,
      taxName:         resolvedTax?.name,
      taxInclusive:    resolvedTax?.isInclusive ?? true,
      accountId:       isPurchase ? (p.purchaseAccountId ?? undefined) : (p.salesAccountId ?? undefined),
      stockOnHand:     Number(p.stockOnHand ?? 0),
      isInventoriable: p.isInventoriable ?? false,
    })
  }

  const columns = [
    /* ── # ──────────────────────────────────────────────────────────── */
    /* ══ COLUMNA #  ═══════════════════════════════════════════════════ */
    {
      title: '#', width: 36,
      render: (_: any, __: any, idx: number) => (
        <span style={{ fontSize: 12, color: '#999' }}>{idx + 1}</span>
      ),
    },

    /* ══ COLUMNA: ARTÍCULO (SKU / referencia interna) ══════════════════
       Estrecha — muestra código del producto o buscador compacto.        */
    {
      title: 'Artículo', width: 160,
      render: (_: any, row: LineItem) => {
        const selectedOpt = prodOptions.find(o => o.value === row.productId)
        const stock       = row.isInventoriable ? Number(row.stockOnHand ?? 0) : null
        const stockOk     = stock !== null && stock >= Number(row.quantity)

        if (readOnly) {
          return (
            <div>
              {row.productId && selectedOpt ? (
                <Tag style={{ fontFamily: 'monospace', fontSize: 10, margin: 0 }}>
                  {selectedOpt.product.sku ?? selectedOpt.product.name}
                </Tag>
              ) : <span style={{ color: '#ccc', fontSize: 11 }}>—</span>}
              {stock !== null && (
                <div style={{ marginTop: 4 }}>
                  <Tag color={stock === 0 ? 'red' : stockOk ? 'green' : 'orange'} style={{ fontSize: 10, margin: 0 }}>
                    Exist: {stock.toFixed(0)}
                  </Tag>
                </div>
              )}
            </div>
          )
        }

        /* Edición: si ya hay producto → tag con ×; si no → buscador compacto */
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {row.productId && selectedOpt ? (
              <>
                <Tag
                  closable
                  onClose={() => update(row._key, { productId: undefined, stockOnHand: undefined, isInventoriable: false })}
                  style={{
                    margin: 0, fontFamily: 'monospace', fontSize: 11,
                    background: '#e6f4ff', borderColor: '#91caff', color: '#0958d9',
                    lineHeight: '20px',
                  }}
                >
                  {selectedOpt.product.sku ?? selectedOpt.product.name}
                </Tag>
                {stock !== null && (
                  <Tooltip title={stockOk ? `Disponible: ${stock}` : `Insuficiente: ${stock} disponibles`}>
                    <Tag
                      color={stock === 0 ? 'red' : stockOk ? 'green' : 'orange'}
                      style={{ fontSize: 10, margin: 0, cursor: 'default' }}
                    >
                      {!stockOk && <WarningOutlined style={{ marginRight: 2 }} />}
                      Exist: {stock.toFixed(0)}
                    </Tag>
                  </Tooltip>
                )}
              </>
            ) : (
              <Select
                showSearch size="small" style={{ width: '100%' }}
                placeholder={<span style={{ fontSize: 11, color: '#bbb' }}><SearchOutlined /> SKU…</span>}
                filterOption={false} loading={searching}
                onSearch={searchProducts}
                onDropdownVisibleChange={open => { if (open) loadInitial() }}
                onSelect={(v: string | undefined) => v && selectProduct(row._key, v)}
                options={prodOptions.map(o => ({
                  value: o.value,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {o.product.sku && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888', marginRight: 4 }}>[{o.product.sku}]</span>}
                        {o.product.name}
                      </span>
                      {o.product.isInventoriable && (
                        <span style={{ fontSize: 10, color: Number(o.product.stockOnHand) > 0 ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                          {Number(o.product.stockOnHand ?? 0).toFixed(0)}
                        </span>
                      )}
                    </div>
                  ),
                }))}
                value={undefined}
                notFoundContent={searching ? 'Buscando…' : 'Sin resultados'}
                popupMatchSelectWidth={false} listHeight={280}
              />
            )}
          </div>
        )
      },
    },

    /* ══ COLUMNA: DESCRIPCIÓN (concepto principal — lo que ve el cliente) ══
       Ancha y prominente — texto que aparece en la factura impresa.         */
    {
      title: 'Descripción',
      render: (_: any, row: LineItem) => {
        const acc = accountMap[row.accountId ?? '']

        if (readOnly) {
          return (
            <div>
              <Typography.Text style={{ fontSize: 13, color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {row.description}
              </Typography.Text>
              {acc && (
                <div style={{ marginTop: 4 }}>
                  <Tag style={{ fontSize: 10, margin: 0, background: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d' }}>
                    {acc.code}
                  </Tag>
                </div>
              )}
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Descripción multi-línea — el texto principal de la factura */}
            <CellTextArea
              value={row.description}
              onCommit={v => update(row._key, { description: v })}
              placeholder="Descripción del artículo o servicio que aparecerá en la factura…"
              style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}
            />
            {/* Cuenta contable — pequeña, debajo */}
            {row.productId && acc ? (
              <Tooltip title={acc.name}>
                <Tag style={{ fontSize: 10, margin: 0, width: 'fit-content', background: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d' }}>
                  ▪ {acc.code} — {acc.name.length > 22 ? acc.name.slice(0, 22) + '…' : acc.name}
                </Tag>
              </Tooltip>
            ) : !row.productId ? (
              <Select
                size="small" placeholder="Cuenta contable…"
                showSearch optionFilterProp="label"
                style={{ width: '100%' }}
                value={row.accountId || undefined}
                allowClear onClear={() => update(row._key, { accountId: undefined })}
                onChange={(v: string) => update(row._key, { accountId: v })}
                listHeight={320}
                popupMatchSelectWidth={false}
                notFoundContent={allAccounts.length === 0 ? 'Cargando cuentas…' : 'Sin resultados'}
                options={(() => {
                  // Agrupar cuentas: Ingresos primero, luego Costos, Gastos, otros
                  const isIncome = (a: Account) =>
                    a.code.startsWith('4') ||
                    a.type?.toLowerCase().includes('ingreso') ||
                    a.type?.toLowerCase().includes('income') ||
                    a.type?.toLowerCase().includes('revenue') ||
                    a.balanceType?.toLowerCase().includes('acreedor')
                  const income  = allAccounts.filter(isIncome)
                  const others  = allAccounts.filter(a => !isIncome(a))
                  const toOpt   = (a: Account) => ({ value: a.id, label: `${a.code} — ${a.name}` })
                  return [
                    ...(income.length  ? [{ label: '— Ingresos —',        options: income.map(toOpt)  }] : []),
                    ...(others.length  ? [{ label: '— Otras cuentas —',   options: others.map(toOpt)  }] : []),
                  ]
                })()}
              />
            ) : null}
          </div>
        )
      },
    },

    /* ══ Unidad ═══════════════════════════════════════════════════════ */
    {
      title: 'Unidad', dataIndex: 'unit', width: 110,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 12 }}>{row.unit || '—'}</span>
        : (
          <Select
            size="small" style={{ width: '100%' }}
            value={row.unit || undefined}
            onChange={(v: string) => update(row._key, { unit: v })}
            placeholder="Tipo…"
            allowClear
            options={[
              { value: 'UND',  label: 'Unidad' },
              { value: 'SER',  label: 'Servicio' },
              { value: 'EXP',  label: 'Exportación' },
              { value: 'EXE',  label: 'Exento' },
              { value: 'KG',   label: 'Kilogramo' },
              { value: 'MT',   label: 'Metro' },
              { value: 'LT',   label: 'Litro' },
              { value: 'HRS',  label: 'Horas' },
              { value: 'MT2',  label: 'Metro²' },
            ]}
          />
        ),
    },

    /* ══ Cantidad ══════════════════════════════════════════════════════ */
    {
      title: 'Qty', dataIndex: 'quantity', width: 85, align: 'right' as const,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 13 }}>{Number(row.quantity).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
        : <CellInputNumber
            value={row.quantity}
            onCommit={v => update(row._key, { quantity: v })}
            min={0.001} step={1}
          />,
    },

    /* ══ Tarifa ════════════════════════════════════════════════════════ */
    {
      title: 'Tarifa', dataIndex: 'unitPrice', width: 110, align: 'right' as const,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 13 }}>{Number(row.unitPrice).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
        : <CellInputNumber
            value={row.unitPrice}
            onCommit={v => update(row._key, { unitPrice: v })}
            min={0} step={0.01} prefix="Q"
          />,
    },

    /* ══ Desc.% ════════════════════════════════════════════════════════ */
    {
      title: 'Desc.%', dataIndex: 'discountPercent', width: 78, align: 'center' as const,
      render: (_: any, row: LineItem) => readOnly
        ? (row.discountPercent > 0
            ? <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>{row.discountPercent}%</Tag>
            : <span style={{ color: '#d9d9d9' }}>—</span>)
        : <CellInputNumber
            value={row.discountPercent}
            onCommit={v => update(row._key, { discountPercent: v })}
            min={0} max={100} step={1} suffix="%"
          />,
    },

    /* ══ Impuesto ══════════════════════════════════════════════════════ */
    {
      title: 'Impuesto', dataIndex: 'taxPercent', width: 160,
      render: (_: any, row: LineItem) => {
        if (readOnly) {
          return (
            <span style={{ fontSize: 12 }}>
              {row.taxName ?? `IVA ${row.taxPercent}%`}{' '}
              <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>{row.taxPercent}%</Tag>
            </span>
          )
        }
        return (
          <Select size="small" style={{ width: '100%' }}
            value={row.taxId || `flat:${row.taxPercent}`}
            options={[
              { value: 'flat:0', label: 'Exento (0%)' },
              ...(taxOptions.length === 0 ? [{ value: 'flat:12', label: 'IVA 12%', rate: 12, isInclusive: true }] : []),
              ...taxOptions,
            ]}
            onChange={(v: string) => {
              if (v.startsWith('flat:')) {
                const pct = Number(v.split(':')[1])
                const matched = taxOptions.find(o => Number(o.rate) === pct)
                update(row._key, { taxPercent: pct, taxId: matched?.value, taxName: matched?.label?.split(' (')[0], taxInclusive: matched?.isInclusive ?? false })
              } else {
                const t = taxOptions.find(o => o.value === v)
                if (t) update(row._key, { taxId: v, taxPercent: Number(t.rate), taxName: t.label.split(' (')[0], taxInclusive: t.isInclusive ?? false })
              }
            }}
          />
        )
      },
    },

    /* ══ Importe (Amount) ══════════════════════════════════════════════ */
    {
      title: 'Amount', dataIndex: 'lineTotal', width: 120, align: 'right' as const,
      render: (_: any, row: LineItem) => (
        <div style={{ textAlign: 'right', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 15 }}>
            {Number(row.lineTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
          {row.lineTax > 0 && (
            <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 500 }}>
              IVA: {Number(row.lineTax).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      ),
    },

    /* ══ Eliminar ══════════════════════════════════════════════════════ */
    ...(readOnly ? [] : [{
      title: '', width: 36,
      render: (_: any, row: LineItem) => (
        <Tooltip title="Eliminar línea">
          <Button size="small" type="text" danger icon={<DeleteOutlined />}
            onClick={() => removeRow(row._key)} />
        </Tooltip>
      ),
    }]),
  ]

  const totals = calcTotals(items)

  return (
    <div style={{ border: '1px solid #e8edf5', borderRadius: 8, overflow: 'hidden' }}>
      <Table
        dataSource={items}
        rowKey="_key"
        columns={columns}
        pagination={false}
        size="small"
        style={{ marginBottom: 0 }}
        scroll={{ x: 900 }}
        components={{
          header: {
            cell: (props: any) => (
              <th
                {...props}
                style={{
                  ...props.style,
                  background:     '#e8f0fe',
                  color:          '#1B3A6B',
                  fontWeight:     700,
                  fontSize:       11,
                  textTransform:  'uppercase',
                  letterSpacing:  '0.05em',
                  padding:        '10px 12px',
                  borderBottom:   '2px solid #adc6ff',
                  whiteSpace:     'nowrap',
                }}
              />
            ),
          },
          body: {
            row: (props: any) => (
              <tr
                {...props}
                style={{
                  ...props.style,
                  verticalAlign: 'top',
                }}
              />
            ),
          },
        }}
      />

      {/* ── Agregar fila ───────────────────────────────────────────────── */}
      {!readOnly && (
        <div style={{
          borderTop: '1px dashed #d6e4ff',
          padding: '10px 16px',
          background: '#fafcff',
        }}>
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={addRow}
            style={{ color: '#1B3A6B', fontWeight: 500, padding: 0 }}
          >
            + Agregar nueva fila
          </Button>
        </div>
      )}

      {/* ── Barra de totales ───────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        justifyContent: 'flex-end',
        alignItems:     'stretch',
        borderTop:      '2px solid #adc6ff',
        background:     '#f0f5ff',
      }}>
        {/* Subtotal */}
        <div style={{
          padding:      '10px 20px',
          borderRight:  '1px solid #d6e4ff',
          textAlign:    'right',
          minWidth:     160,
        }}>
          <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Subtotal (base)
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#595959' }}>
            Q {totals.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* IVA total */}
        <div style={{
          padding:      '10px 20px',
          borderRight:  '1px solid #d6e4ff',
          textAlign:    'right',
          minWidth:     160,
          background:   '#e6f0ff',
        }}>
          <div style={{ fontSize: 11, color: '#1677ff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, fontWeight: 600 }}>
            IVA (impuesto)
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1677ff' }}>
            Q {totals.taxAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Total */}
        <div style={{
          padding:      '10px 24px',
          textAlign:    'right',
          minWidth:     180,
          background:   '#1B3A6B',
        }}>
          <div style={{ fontSize: 11, color: '#adc6ff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Total a pagar
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>
            Q {totals.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}
