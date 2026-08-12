import { useState, useCallback, useEffect, useRef, memo } from 'react'
import {
  Table, Button, Input, InputNumber, Select, Tooltip, Tag, Typography, message,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, WarningOutlined, SwapOutlined,
} from '@ant-design/icons'
import { getProducts, getProduct, type Product } from '../../api/inventario'
import { getAccounts, type Account } from '../../api/catalogo'
import { getUnidadesActivas, type UnidadMedida } from '../../api/unidades-medida'
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

  // El precio SAT ("P. Unitario con IVA") = base + IVA, sin IDP.
  // El IDP se calcula en el form padre y se SUMA al total. Aquí solo IVA.
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
  /** En modo readOnly, permite editar la cuenta contable por línea (para facturas ya emitidas) */
  accountEditable?: boolean
  docType?: 'invoice' | 'estimate' | 'bill' | 'po'
  /** ID del impuesto por defecto configurado en el proveedor (solo po/bill) */
  vendorDefaultTaxId?: string
  /** Moneda del documento — determina el símbolo en columnas de precio */
  currency?: string
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
      onKeyDown={(e) => e.stopPropagation()}
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
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      style={{ fontSize: 13, resize: 'none', ...style }}
    />
  )
})

/** InputNumber de celda con estado local — evita pérdida de foco al teclear */
const CellInputNumber = memo(({ value, onCommit, min, max, step, prefix, suffix, style, inputStyle, formatter, parser, precision }: {
  value: number; onCommit: (v: number) => void
  min?: number; max?: number; step?: number; precision?: number
  prefix?: string; suffix?: string; style?: React.CSSProperties; inputStyle?: React.CSSProperties
  formatter?: (v: number | string | undefined) => string
  parser?: (v: string | undefined) => number | string
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
      size="small" controls={false} style={{ width: '100%', ...style }}
      styles={inputStyle ? { input: inputStyle } : undefined}
      min={min} max={max} step={step} precision={precision}
      prefix={prefix} suffix={suffix}
      formatter={formatter as any}
      parser={parser as any}
      value={local}
      onChange={v => setLocal(v)}
      onBlur={() => commit(local)}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commit(local) }}
    />
  )
})

/** Resuelve el impuesto transaccional preferido según contexto de compra/venta.
 *  Excluye retenciones (isWithholding) — esas van en el dato maestro del proveedor/cliente.
 *  Prioridad: taxId explícito → específico default → both default → específico con tasa → both con tasa */
function resolvePreferredTax(taxes: Tax[], forPurchase: boolean, preferTaxId?: string): Tax | undefined {
  const transactional = taxes.filter(t => t.isActive && !t.isWithholding)
  if (preferTaxId) {
    const direct = transactional.find(t => t.id === preferTaxId)
    if (direct) return direct
  }
  const specific = transactional.filter(t => t.applicability === (forPurchase ? 'purchases' : 'sales'))
  const common   = transactional.filter(t => t.applicability === 'both')
  return (
    specific.find(t => t.isDefault && Number(t.rate) > 0) ??
    common.find(t => t.isDefault && Number(t.rate) > 0) ??
    specific.find(t => t.isDefault) ??
    common.find(t => t.isDefault) ??
    specific.find(t => Number(t.rate) > 0) ??
    common.find(t => Number(t.rate) > 0) ??
    specific[0] ?? common[0]
  )
}

// Definido fuera del componente para que sea una referencia estable.
// Si se define inline en el JSX, React lo trata como un nuevo tipo en cada render
// y desmonta/remonta las filas, causando pérdida de foco en los inputs.
const TABLE_COMPONENTS = {
  header: {
    cell: (props: any) => (
      <th
        {...props}
        style={{
          ...props.style,
          background:    '#e8f0fe',
          color:         '#1faec2',
          fontWeight:    700,
          fontSize:      11,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          padding:       '10px 12px',
          borderBottom:  '2px solid #adc6ff',
          whiteSpace:    'nowrap' as const,
        }}
      />
    ),
  },
  body: {
    row: (props: any) => (
      <tr {...props} style={{ ...props.style, verticalAlign: 'top' }} />
    ),
  },
}

export default function LineItemsEditor({ items, taxes, onChange, readOnly, accountEditable, docType = 'invoice', vendorDefaultTaxId, currency = 'GTQ' }: Props) {
  const [prodOptions, setProdOptions]     = useState<ProdOption[]>([])
  const [searching,   setSearching]       = useState(false)
  const [initialized, setInitialized]     = useState(false)
  const [allAccounts,  setAllAccounts]  = useState<Account[]>([])
  const [accountMap,   setAccountMap]   = useState<Record<string, Account>>({})
  const [unitOptions,  setUnitOptions]  = useState<{ value: string; label: string }[]>([])

  // Carga unidades de medida activas desde configuración (falla silenciosa con fallback)
  useEffect(() => {
    getUnidadesActivas()
      .then((list: UnidadMedida[]) => {
        if (list?.length) setUnitOptions(list.map(u => ({ value: u.code, label: u.name })))
      })
      .catch(() => {
        // Fallback silencioso — el usuario sigue viendo las unidades básicas
        setUnitOptions([
          { value: 'UND',     label: 'Unidad'           },
          { value: 'SER',     label: 'Servicio'         },
          { value: 'HRS',     label: 'Horas'            },
          { value: 'KG',      label: 'Kilogramo'        },
          { value: 'LT',      label: 'Litro'            },
          { value: 'MT',      label: 'Metro'            },
          { value: 'GAL',     label: 'Galón'            },
          { value: 'EXP',     label: 'Exportación'      },
          { value: 'EXE',     label: 'Exento'           },
          { value: 'super',    label: 'Super (gasolina)'            },
          { value: 'regular',  label: 'Regular (gasolina)'           },
          { value: 'aviacion', label: 'Aviación (gasolina)'          },
          { value: 'diesel',   label: 'Diésel / Gas oil'             },
          { value: 'propano',  label: 'Gas propano (vehicular)'      },
          { value: 'bunker',   label: 'Fuel oil / Bunker C'          },
          { value: 'kerosina', label: 'Kerosina (DPK)'               },
          { value: 'other',    label: 'Otros derivados'              },
        ])
      })
  }, [])

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
  // Prioridad: proveedor → específico de compra/venta → ambos → primer activo.
  // Se re-ejecuta cuando cargan los taxes O cuando cambia el proveedor / docType.
  useEffect(() => {
    if (!taxes.length) return
    // Ventas: solo aplicar si el cliente tiene un impuesto configurado en su dato maestro.
    // Sin cliente seleccionado → dejar vacío para que el usuario elija.
    const isDoc = docType === 'po' || docType === 'bill'
    if (!isDoc && !vendorDefaultTaxId) return
    const preferredTax = resolvePreferredTax(taxes, isDoc, vendorDefaultTaxId)
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

  const isPurchaseDoc = docType === 'po' || docType === 'bill'
  const taxOptions = taxes
    .filter(t => {
      if (!t.isActive || t.isWithholding) return false  // retenciones (ISR) van en dato maestro, no en líneas
      if (isPurchaseDoc) return t.applicability === 'purchases' || t.applicability === 'both'
      return t.applicability === 'sales' || t.applicability === 'both'
    })
    .map(t => ({
      value:       t.id,
      label:       t.subtype === 'exempt' ? `Exento — ${t.name}` : `${Number(t.rate)}% — ${t.name}`,
      rate:        t.rate,
      isInclusive: t.isInclusive,
      name:        t.name,
    }))

  const update = (key: string, patch: Partial<LineItem>) =>
    onChange(items.map(item => item._key === key ? recalc({ ...item, ...patch }) : item))

  const addRow = () => {
    const preferredTax = (isPurchaseDoc || vendorDefaultTaxId)
      ? resolvePreferredTax(taxes, isPurchaseDoc, vendorDefaultTaxId)
      : undefined
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
    // ── Tax resolution ─────────────────────────────────────────────────────
    let resolvedTax: Tax | undefined

    if (isPurchaseDoc) {
      // 1. Impuesto configurado en el proveedor
      if (vendorDefaultTaxId) resolvedTax = taxes.find(t => t.id === vendorDefaultTaxId && t.isActive)
      // 2. Impuesto configurado en el artículo (compras)
      if (!resolvedTax && p.purchaseTaxId) resolvedTax = taxes.find(t => t.id === p.purchaseTaxId && t.isActive)
      // 3. Fallback: impuesto de compra por defecto según contexto
      if (!resolvedTax) resolvedTax = resolvePreferredTax(taxes, true)
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
      if (p.salesTaxId) resolvedTax = taxes.find(t => t.id === p.salesTaxId && t.isActive)
      if (!resolvedTax) resolvedTax = resolvePreferredTax(taxes, false)
    }

    update(key, {
      productId,
      description:     p.description || p.name,
      unit:            p.unit,
      unitPrice:       Number(isPurchaseDoc ? (p.purchasePrice ?? p.salesPrice ?? 0) : (p.salesPrice ?? 0)),
      taxPercent:      resolvedTax ? Number(resolvedTax.rate) : 12,
      taxId:           resolvedTax?.id,
      taxName:         resolvedTax?.name,
      taxInclusive:    resolvedTax?.isInclusive ?? true,
      accountId:       isPurchaseDoc ? (p.purchaseAccountId ?? undefined) : (p.salesAccountId ?? undefined),
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
                <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 10, margin: 0 }}>
                  {selectedOpt.product.sku ?? selectedOpt.product.name}
                </Tag>
              ) : <span style={{ color: '#ccc', fontSize: 11 }}>—</span>}
              {stock !== null && (
                <div style={{ marginTop: 4 }}>
                  <Tag color={stock === 0 ? '#e5484d' : stockOk ? '#2ea172' : '#ff7f00'} style={{ fontSize: 10, margin: 0 }}>
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
                    margin: 0, fontVariantNumeric: 'tabular-nums', fontSize: 11,
                    background: '#e6f4ff', borderColor: '#91caff', color: '#0958d9',
                    lineHeight: '20px',
                  }}
                >
                  {selectedOpt.product.sku ?? selectedOpt.product.name}
                </Tag>
                {stock !== null && (
                  <Tooltip title={stockOk ? `Disponible: ${stock}` : `Insuficiente: ${stock} disponibles`}>
                    <Tag
                      color={stock === 0 ? '#e5484d' : stockOk ? '#2ea172' : '#ff7f00'}
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
                        {o.product.sku && <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#6b7280', marginRight: 4 }}>[{o.product.sku}]</span>}
                        {o.product.name}
                      </span>
                      {o.product.isInventoriable && (
                        <span style={{ fontSize: 10, color: Number(o.product.stockOnHand) > 0 ? '#2ea172' : '#e5484d', marginLeft: 8 }}>
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
              {accountEditable ? (
                <div style={{ marginTop: 4 }}>
                  <Select
                    size="small" placeholder="Cuenta contable…"
                    showSearch optionFilterProp="label"
                    style={{ width: '100%' }}
                    value={row.accountId || undefined}
                    allowClear onClear={() => update(row._key, { accountId: undefined })}
                    onChange={(v: string) => update(row._key, { accountId: v })}
                    popupMatchSelectWidth={false}
                    notFoundContent={allAccounts.length === 0 ? 'Cargando…' : 'Sin resultados'}
                    options={allAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  />
                </div>
              ) : acc && (
                <div style={{ marginTop: 4 }}>
                  <Tag style={{ fontSize: 10, margin: 0, background: '#e8f5ef', borderColor: '#c3e5d8', color: '#2ea172' }}>
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
                <Tag style={{ fontSize: 10, margin: 0, width: 'fit-content', background: '#e8f5ef', borderColor: '#c3e5d8', color: '#2ea172' }}>
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
      title: 'Unidad', dataIndex: 'unit', width: 125,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 12 }}>{row.unit || '—'}</span>
        : (
          <Select
            size="small" style={{ width: '100%' }}
            value={row.unit || undefined}
            onChange={(v: string) => update(row._key, { unit: v })}
            placeholder="Tipo…"
            allowClear
            options={unitOptions}
          />
        ),
    },

    /* ══ Cantidad ══════════════════════════════════════════════════════ */
    {
      title: 'Qty', dataIndex: 'quantity', width: 80, align: 'right' as const,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 13 }}>{Number(row.quantity).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
        : <CellInputNumber
            value={row.quantity}
            onCommit={v => update(row._key, { quantity: v })}
            min={0.001} step={1} precision={2}
            inputStyle={{ textAlign: 'right' }}
          />,
    },

    /* ══ Tarifa ════════════════════════════════════════════════════════ */
    {
      title: 'Tarifa', dataIndex: 'unitPrice', width: 145, align: 'right' as const,
      render: (_: any, row: LineItem) => readOnly
        ? <span style={{ fontSize: 13 }}>{Number(row.unitPrice).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
        : <CellInputNumber
            value={row.unitPrice}
            onCommit={v => update(row._key, { unitPrice: v })}
            min={0} step={0.01} precision={2}
            prefix={currency === 'USD' ? '$' : currency === 'GTQ' ? 'Q' : currency}
            inputStyle={{ textAlign: 'right' }}
            formatter={v => {
              if (v === undefined || v === '') return ''
              const parts = `${v}`.split('.')
              parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              return parts.join('.')
            }}
            parser={v => parseFloat((v ?? '').replace(/,/g, '')) || 0}
          />,
    },

    /* ══ Desc.% ════════════════════════════════════════════════════════ */
    {
      title: 'Desc.%', dataIndex: 'discountPercent', width: 95, align: 'center' as const,
      render: (_: any, row: LineItem) => readOnly
        ? (row.discountPercent > 0
            ? <Tag color="#ff7f00" style={{ fontSize: 11, margin: 0 }}>{row.discountPercent}%</Tag>
            : <span style={{ color: '#9aa1ab' }}>—</span>)
        : <CellInputNumber
            value={row.discountPercent}
            onCommit={v => update(row._key, { discountPercent: v })}
            min={0} max={100} step={1} precision={2} suffix="%"
          />,
    },

    /* ══ Impuesto ══════════════════════════════════════════════════════ */
    {
      title: 'Impuesto', dataIndex: 'taxPercent', width: 210,
      render: (_: any, row: LineItem) => {
        if (readOnly) {
          return (
            <span style={{ fontSize: 12 }}>
              {row.taxName ?? `IVA ${row.taxPercent}%`}{' '}
              <Tag color="#1faec2" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>{row.taxPercent}%</Tag>
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
                update(row._key, { taxPercent: pct, taxId: matched?.value, taxName: matched?.name, taxInclusive: matched?.isInclusive ?? false })
              } else {
                const t = taxOptions.find(o => o.value === v)
                if (t) update(row._key, { taxId: v, taxPercent: Number(t.rate), taxName: t.name, taxInclusive: t.isInclusive ?? false })
              }
            }}
          />
        )
      },
    },

    /* ══ Importe (Amount) ══════════════════════════════════════════════ */
    {
      title: 'Amount', dataIndex: 'lineTotal', width: 150, align: 'right' as const,
      render: (_: any, row: LineItem) => (
        <div style={{ textAlign: 'right', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: '#1faec2', fontSize: 15 }}>
            {Number(row.lineTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
          {row.lineTax > 0 && (
            <div style={{ fontSize: 12, color: '#1faec2', fontWeight: 500 }}>
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
        components={TABLE_COMPONENTS}
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
            style={{ color: '#1faec2', fontWeight: 500, padding: 0 }}
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
        background:     '#fafbfc',
      }}>
        {/* Subtotal */}
        <div style={{
          padding:      '10px 20px',
          borderRight:  '1px solid #d6e4ff',
          textAlign:    'right',
          minWidth:     160,
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Subtotal (base)
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
            {currency === 'USD' ? '$' : 'Q'} {totals.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
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
          <div style={{ fontSize: 11, color: '#1faec2', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, fontWeight: 600 }}>
            IVA (impuesto)
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1faec2' }}>
            {currency === 'USD' ? '$' : 'Q'} {totals.taxAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Total */}
        <div style={{
          padding:      '10px 24px',
          textAlign:    'right',
          minWidth:     180,
          background:   '#1faec2',
        }}>
          <div style={{ fontSize: 11, color: '#adc6ff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Total Factura
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>
            {currency === 'USD' ? '$' : 'Q'} {totals.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}
