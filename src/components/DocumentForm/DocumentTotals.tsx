/**
 * DocumentTotals — Panel de resumen de totales estilo Zoho Books.
 *
 * Muestra:
 *  • Subtotal  (con nota "Impuesto incluido" cuando aplica)
 *  • Descuento (si lo hay)
 *  • Desglose por tipo de impuesto
 *  • Total de impuestos
 *  • Total del documento
 *
 * Reutilizable en: Factura de venta, Cotización, Factura proveedor, Orden de compra.
 */
import { Divider, Tag, Typography, InputNumber, Form } from 'antd'
import type { TaxBreakdownItem } from './LineItemsEditor'

const { Text } = Typography

interface DocumentTotalsProps {
  /** Suma de lineNet (base sin impuesto) */
  subtotal:       number
  /** Suma de lineTax (impuesto total) */
  taxAmount:      number
  /** Suma de lineTotal (precio pagado por el cliente) */
  total:          number
  /** true cuando al menos un ítem tiene IVA incluido */
  hasInclusive:   boolean
  /** Detalle por tipo de impuesto */
  taxBreakdown:   TaxBreakdownItem[]
  /** % de descuento global del encabezado */
  discountPercent?: number
  /** true = todos los impuestos son 0 (factura exenta) */
  isExenta?:      boolean
  /** Moneda para mostrar en el Total */
  currency?:      string
  /** Permite editar el descuento directamente en el panel */
  onDiscountChange?: (v: number) => void
  /** Mostrar el campo de descuento editable */
  showDiscountInput?: boolean
}

const fmtNum = (n: number, currency = 'GTQ') =>
  `${currency} ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Row = ({ label, value, sub, danger, bold, large, muted }: {
  label: React.ReactNode
  value: React.ReactNode
  sub?:  React.ReactNode
  danger?: boolean
  bold?:   boolean
  large?:  boolean
  muted?:  boolean
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0' }}>
    <div>
      <Text
        style={{
          fontSize:   large ? 15 : 13,
          fontWeight: bold  ? 600  : 400,
          color:      muted ? '#6b7280' : undefined,
        }}
      >
        {label}
      </Text>
      {sub && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>{sub}</Text>
        </div>
      )}
    </div>
    <Text
      style={{
        fontSize:   large ? 15 : 13,
        fontWeight: bold  ? 600  : 400,
        color:      danger ? '#e5484d' : (bold ? '#1faec2' : undefined),
        textAlign:  'right',
        minWidth:   90,
      }}
    >
      {value}
    </Text>
  </div>
)

export default function DocumentTotals({
  subtotal,
  taxAmount,
  total,
  hasInclusive,
  taxBreakdown,
  discountPercent = 0,
  isExenta        = false,
  currency        = 'GTQ',
  onDiscountChange,
  showDiscountInput = false,
}: DocumentTotalsProps) {
  // ── Cálculos ──────────────────────────────────────────────────────────────
  // "Subtotal visible" = lo que el cliente ve como precio base
  //   • Inclusivo: total de líneas (precio ingresado, ya lleva IVA dentro)
  //   • Exclusivo: base sin impuesto
  const displaySubtotal = hasInclusive ? total : subtotal

  const discountAmt  = Math.round(displaySubtotal * (discountPercent / 100) * 100) / 100
  const netAfterDisc = displaySubtotal - discountAmt

  // Para el total final:
  //   • Inclusivo: ya está dentro → netAfterDisc
  //   • Exclusivo: netAfterDisc + impuestos
  const taxScaled  = hasInclusive
    ? (total > 0 ? Math.round((taxAmount / total) * netAfterDisc * 100) / 100 : 0)
    : (discountPercent > 0 ? Math.round(taxAmount * (1 - discountPercent / 100) * 100) / 100 : taxAmount)

  const grandTotal = hasInclusive ? netAfterDisc : netAfterDisc + taxScaled
  const displayTax  = isExenta ? 0 : taxScaled

  return (
    <div style={{ fontSize: 13 }}>

      {/* ── Subtotal ─────────────────────────────────────────────────────── */}
      <Row
        label="Subtotal"
        value={fmtNum(displaySubtotal, currency)}
        sub={hasInclusive ? '(Impuesto incluido)' : undefined}
        muted
      />

      {/* ── Descuento ────────────────────────────────────────────────────── */}
      {showDiscountInput && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Descuento (%)</Text>
          <InputNumber
            size="small"
            style={{ width: 100 }}
            min={0}
            max={100}
            step={1}
            precision={2}
            suffix="%"
            value={discountPercent}
            onChange={v => onDiscountChange?.(v ?? 0)}
          />
        </div>
      )}
      {!showDiscountInput && discountAmt > 0 && (
        <Row
          label={`Descuento (${discountPercent}%)`}
          value={`− ${fmtNum(discountAmt, currency)}`}
          danger
          muted
        />
      )}

      <Divider style={{ margin: '8px 0' }} />

      {/* ── Desglose por tipo de impuesto ────────────────────────────────── */}
      {!isExenta && taxBreakdown.length > 0 && (
        <>
          {taxBreakdown.map(t => {
            const scaledAmt = hasInclusive
              ? (total > 0 ? Math.round((t.amount / total) * netAfterDisc * 100) / 100 : 0)
              : (discountPercent > 0 ? Math.round(t.amount * (1 - discountPercent / 100) * 100) / 100 : t.amount)
            return (
              <div
                key={t.key}
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '4px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>
                    {t.name}
                  </Text>
                  <Tag
                    color="#1faec2"
                    style={{ fontSize: 10, padding: '0 5px', lineHeight: '18px', margin: 0 }}
                  >
                    {t.rate}%
                  </Tag>
                </div>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>
                  {fmtNum(scaledAmt, currency)}
                </Text>
              </div>
            )
          })}

          {/* Total de impuestos */}
          <div style={{
            display:         'flex',
            justifyContent:  'space-between',
            alignItems:      'center',
            background:      '#e6fafd',
            borderRadius:    6,
            padding:         '6px 10px',
            margin:          '6px 0',
            border:          '1px solid #e8edf5',
          }}>
            <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
              Importe total de impuestos
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#1faec2' }}>
                {displayTax.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
              <Tag style={{ margin: 0, fontSize: 11 }}>{currency}</Tag>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />
        </>
      )}

      {isExenta && (
        <>
          <Row label="Impuesto" value="Exento (0%)" muted />
          <Divider style={{ margin: '8px 0' }} />
        </>
      )}

      {/* ── Total ────────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        background:     '#1faec2',
        borderRadius:   8,
        padding:        '12px 14px',
        marginTop:      4,
      }}>
        <Text style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
          Total ({currency})
        </Text>
        <Text style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>
          {grandTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </Text>
      </div>
    </div>
  )
}
