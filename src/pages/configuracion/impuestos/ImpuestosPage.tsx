import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, Switch,
  InputNumber, Space, Tooltip, Popconfirm, Typography,
  Card, Row, Col, Divider, Alert, Spin, Badge, message, AutoComplete,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, InfoCircleOutlined,
  CalculatorOutlined, CheckCircleOutlined,
  FileTextOutlined, StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getTaxes, createTax, updateTax, deleteTax, calculateTax,
  type Tax, type TaxTier,
} from '../../../api/impuestos'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getLibroSATConfig, saveLibroSATConfig, DEFAULT_CONFIG, type LibroSATConfig } from '../../../api/libros-sat'
import { getOrganizationProfile } from '../../../api/configuracion'
import { GT_TEMPLATES, detectTemplate, type TaxRegimeTemplate } from '../../../data/guatemalaTaxTemplates'
import { useCompanyStore } from '../../../store/companyStore'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Helpers de presentación ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  iva:                       { label: 'IVA 12%',        color: '#1faec2'   },
  iva_exento:                { label: 'IVA Exento',     color: 'default'   },
  iva_retenida:              { label: 'IVA Retenida',   color: '#ff7f00'   },
  iva_pequeno_contribuyente: { label: 'IVA PC',          color: '#722ed1'   },
  isr:                       { label: 'ISR',            color: '#6b7280'   },
  other:                     { label: 'Otro',           color: 'cyan'      },
}

const SUBTYPE_LABELS: Record<string, string> = {
  simple:        'Tasa simple',
  exempt:        'Exento',
  progressive:   'Progresivo por tramos',
  retention_tax: 'Retención sobre impuesto',
}

const COUNTRY_TAX_LABELS: Record<string, { country: string; authority: string; taxName: string }> = {
  GT: { country: 'Guatemala', authority: 'SAT Guatemala', taxName: 'IVA 12%' },
  HN: { country: 'Honduras', authority: 'SAR Honduras', taxName: 'ISV 15%' },
  NI: { country: 'Nicaragua', authority: 'DGI Nicaragua', taxName: 'IVA 15%' },
  SV: { country: 'El Salvador', authority: 'MH El Salvador', taxName: 'IVA 13%' },
  CR: { country: 'Costa Rica', authority: 'Hacienda CR', taxName: 'IVA 13%' },
  PA: { country: 'Panama', authority: 'DGI Panama', taxName: 'ITBMS 7%' },
}

const countryFromCompany = (company: any): string => {
  const raw = String(company?.countryCode ?? company?.country ?? 'GT').toUpperCase()
  if (raw.includes('HONDURAS')) return 'HN'
  if (raw.includes('NICARAGUA')) return 'NI'
  if (raw.includes('SALVADOR')) return 'SV'
  if (raw.includes('COSTA')) return 'CR'
  if (raw.includes('PANAMA') || raw.includes('PANAM')) return 'PA'
  if (raw.length === 2) return raw
  return 'GT'
}
const APPLICABILITY_LABELS: Record<string, string> = {
  sales:     'Ventas',
  purchases: 'Compras',
  both:      'Ambas',
}

function rateDisplay(tax: Tax): string {
  if (tax.subtype === 'exempt')                    return '0% (Exento)'
  if (tax.subtype === 'pequeno_contribuyente')     return '0% (Pequeño Contribuyente)'
  if (tax.subtype === 'progressive' && tax.tiers) {
    const rates = tax.tiers.map(t => `${t.rate}%`).join(' / ')
    return rates
  }
  if (tax.subtype === 'retention_tax')
    return `${tax.rate}% del ${tax.baseTaxCode ?? 'impuesto base'}`
  return `${tax.rate}%`
}

// ── Calculadora en tiempo real ─────────────────────────────────────────────
// Recibe tiers por separado para evitar el bug de closure estale cuando
// el impuesto aún no está guardado (id = 'preview')

interface CalcResult {
  invoiceAmount: number   // valor factura (con IVA)
  baseAmount:    number   // base sin IVA (÷1.12 si ISR)
  breakdown:     { label: string; taxable: number; rate: number; amount: number }[]
  total:         number
  netPayment:    number   // base - retención (para retenciones)
}

function calcLocally(
  tax: Tax,
  effectiveTiers: TaxTier[],
  inputAmount: number,   // siempre es el valor que el usuario ingresa (con o sin IVA)
): CalcResult {
  let total = 0
  const breakdown: CalcResult['breakdown'] = []

  // Para IVA simple, si es inclusivo el inputAmount ya incluye el impuesto
  const baseAmount = (tax.subtype === 'simple' && tax.isInclusive && Number(tax.rate) > 0)
    ? inputAmount / (1 + Number(tax.rate) / 100)
    : inputAmount

  if (tax.subtype === 'simple') {
    let amt: number
    if (tax.isInclusive && Number(tax.rate) > 0) {
      amt = inputAmount - baseAmount   // impuesto extraído del precio
    } else {
      amt = (baseAmount * Number(tax.rate)) / 100   // impuesto agregado sobre la base
    }
    breakdown.push({ label: `Tasa ${tax.rate}%`, taxable: baseAmount, rate: Number(tax.rate), amount: amt })
    total = amt

  } else if (tax.subtype === 'exempt') {
    breakdown.push({ label: 'Exento', taxable: baseAmount, rate: 0, amount: 0 })
    total = 0

  } else if (tax.subtype === 'pequeno_contribuyente') {
    breakdown.push({ label: 'Pequeño Contribuyente (col. específica)', taxable: baseAmount, rate: 0, amount: 0 })
    total = 0

  } else if (tax.subtype === 'progressive') {
    let remaining = baseAmount
    let prevLimit = 0
    for (const tier of effectiveTiers) {
      if (remaining <= 0) break
      const limit   = tier.upTo !== null ? tier.upTo - prevLimit : remaining
      const taxable = Math.min(remaining, limit)
      const amt     = (taxable * tier.rate) / 100
      breakdown.push({ label: tier.label, taxable, rate: tier.rate, amount: amt })
      total    += amt
      remaining -= taxable
      prevLimit  = tier.upTo ?? 0
    }

  } else if (tax.subtype === 'retention_tax') {
    const ivaBase = (baseAmount * 12) / 100
    const ret     = (ivaBase * Number(tax.rate)) / 100
    breakdown.push({ label: `IVA 12% sobre Q${baseAmount.toFixed(2)}`, taxable: baseAmount, rate: 12, amount: ivaBase })
    breakdown.push({ label: `Retención ${tax.rate}% del IVA`, taxable: ivaBase, rate: Number(tax.rate), amount: ret })
    total = ret
  }

  return {
    invoiceAmount: tax.isInclusive ? inputAmount : inputAmount * (1 + Number(tax.rate) / 100),
    baseAmount,
    breakdown,
    total,
    netPayment: tax.isWithholding ? baseAmount - total : (tax.isInclusive ? inputAmount : baseAmount + total),
  }
}

function TaxCalculator({ tax, liveTiers }: { tax: Tax; liveTiers?: TaxTier[] }) {
  // Para ISR: el usuario puede ingresar el valor con IVA (factura) o la base directamente
  const isProgressive = tax.subtype === 'progressive'
  const [inputMode,  setInputMode]  = useState<'base' | 'invoice'>('invoice')
  const [inputValue, setInputValue] = useState<number>(50400)
  const [result,     setResult]     = useState<CalcResult | null>(null)

  const calculate = useCallback(() => {
    // effectiveTiers computed inside callback to avoid stale-array infinite loop
    const effective = liveTiers ?? tax.tiers ?? []
    const base = inputMode === 'invoice'
      ? inputValue / 1.12
      : inputValue
    setResult(calcLocally(tax, effective, base))
  }, [tax, liveTiers, inputValue, inputMode])

  useEffect(() => { calculate() }, [calculate])

  const fmt = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ background: '#e6fafd', borderRadius: 8, padding: 16, marginTop: 12, border: '1px solid rgba(31,174,194,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CalculatorOutlined style={{ color: '#1faec2' }} />
        <Text strong style={{ color: '#1faec2' }}>Vista previa del cálculo</Text>
      </div>

      {/* Controles de entrada */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {isProgressive && (
          <Select
            size="small"
            value={inputMode}
            onChange={setInputMode}
            style={{ width: 200 }}
          >
            <Option value="invoice">Valor factura (con IVA 12%)</Option>
            <Option value="base">Base sin IVA (ya dividida)</Option>
          </Select>
        )}
        <InputNumber
          value={inputValue}
          onChange={v => setInputValue(v ?? 0)}
          onPressEnter={calculate}
          formatter={v => `Q ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => Number(v?.replace(/Q\s?|(,*)/g, '') ?? 0)}
          min={0}
          style={{ width: 180 }}
          size="small"
        />
        <Button size="small" onClick={calculate} type="primary" ghost>
          Calcular
        </Button>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8edf5' }}>

          {/* Encabezado: precio → base (para IVA simple inclusivo o ISR en modo factura) */}
          {(tax.isInclusive && tax.subtype === 'simple') || (isProgressive && inputMode === 'invoice') ? (
            <div style={{ background: '#e6fafd', padding: '10px 14px', borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">
                  {tax.isInclusive ? '💰 Precio con IVA incluido' : 'Valor factura (con IVA)'}
                </Text>
                <Text strong>{fmt(inputValue)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                <Text type="secondary">
                  {tax.isInclusive ? `Base gravable (÷ ${1 + Number(tax.rate) / 100})` : 'Base sin IVA (÷ 1.12)'}
                </Text>
                <Text strong style={{ color: '#1faec2' }}>{fmt(result.baseAmount)}</Text>
              </div>
            </div>
          ) : null}

          {/* Desglose por tramos */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, letterSpacing: 0.5 }}>
              DESGLOSE
            </div>
            {/* Tabla de tramos */}
            {result.breakdown.map((row, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 50px 90px',
                gap: 4,
                fontSize: 13,
                padding: '4px 0',
                borderBottom: i < result.breakdown.length - 1 ? '1px dashed rgba(10,10,10,0.08)' : 'none',
                alignItems: 'center',
              }}>
                <Text type="secondary">{row.label}</Text>
                <Text type="secondary" style={{ textAlign: 'right', fontSize: 12 }}>
                  {fmt(row.taxable)}
                </Text>
                <Tag color="#1faec2" style={{ margin: 0, textAlign: 'center', fontSize: 11 }}>
                  {row.rate}%
                </Tag>
                <Text style={{ textAlign: 'right', fontWeight: 500 }}>
                  {fmt(row.amount)}
                </Text>
              </div>
            ))}
          </div>

          <Divider style={{ margin: 0 }} />

          {/* Totales */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#0a0a0a', fontSize: 14 }}>
                {tax.isWithholding ? '🔒 Total retención ISR' : 'Impuesto total'}
              </Text>
              <Text strong style={{ color: '#0a0a0a', fontSize: 16 }}>
                {fmt(result.total)}
              </Text>
            </div>

            {tax.isWithholding && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Base sin IVA</Text>
                  <Text style={{ fontSize: 12 }}>{fmt(result.baseAmount)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Menos retención</Text>
                  <Text style={{ fontSize: 12, color: '#e5484d' }}>- {fmt(result.total)}</Text>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13 }}>Pago neto al proveedor</Text>
                  <Text strong style={{ fontSize: 13, color: '#2ea172' }}>{fmt(result.netPayment)}</Text>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulario de tramos progresivos ──────────────────────────────────────

function TiersEditor({
  tiers, onChange,
}: {
  tiers: TaxTier[]
  onChange: (t: TaxTier[]) => void
}) {
  const addTier = () => {
    const last = tiers[tiers.length - 1]
    if (last?.upTo === null) return  // ya existe el último tramo abierto
    onChange([...tiers, { upTo: null, rate: 0, label: 'Sobre el excedente' }])
  }

  const updateTier = (i: number, field: keyof TaxTier, value: any) => {
    const copy = tiers.map((t, idx) => idx === i ? { ...t, [field]: value } : t)
    onChange(copy)
  }

  const removeTier = (i: number) => onChange(tiers.filter((_, idx) => idx !== i))

  return (
    <div>
      {tiers.map((tier, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: '#e6fafd', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#1faec2', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Descripción</Text>
            <Input
              size="small"
              value={tier.label}
              onChange={e => updateTier(i, 'label', e.target.value)}
              placeholder="Ej: Hasta Q 30,000"
            />
          </div>
          <div style={{ width: 120 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              Límite superior (Q)
            </Text>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={tier.upTo ?? undefined}
              onChange={v => updateTier(i, 'upTo', v ?? null)}
              placeholder="Sin límite"
              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
            />
          </div>
          <div style={{ width: 80 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Tasa %</Text>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={tier.rate}
              onChange={v => updateTier(i, 'rate', v ?? 0)}
              min={0} max={100}
              precision={2}
            />
          </div>
          {tiers.length > 1 && (
            <Button
              type="text" danger size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeTier(i)}
              style={{ marginTop: 14 }}
            />
          )}
        </div>
      ))}
      <Button
        type="dashed" size="small" onClick={addTier}
        icon={<PlusOutlined />}
        disabled={tiers[tiers.length - 1]?.upTo === null}
      >
        Agregar tramo
      </Button>
      {tiers[tiers.length - 1]?.upTo === null && (
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
          El último tramo no tiene límite — cubre el resto.
        </Text>
      )}
    </div>
  )
}

// ── Modal crear/editar impuesto ────────────────────────────────────────────

function TaxModal({
  open, tax, taxes, onClose, onSaved,
}: {
  open:    boolean
  tax:     Tax | null
  taxes:   Tax[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form]    = Form.useForm()
  const [loading,     setLoading]     = useState(false)
  const [subtype,     setSubtype]     = useState<string>('simple')
  const [category,    setCategory]    = useState<string>('iva')
  const [tiers,       setTiers]       = useState<TaxTier[]>([
    { upTo: 30000, rate: 5, label: 'Hasta Q 30,000.00' },
    { upTo: null,  rate: 7, label: 'Más de Q 30,000.00' },
  ])
  const [previewTax,  setPreviewTax]  = useState<Tax | null>(null)
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [libroConfig, setLibroConfig] = useState<LibroSATConfig>(DEFAULT_CONFIG)

  // Carga accounts y configuración de columnas SAT cuando el modal abre
  useEffect(() => {
    if (!open) return
    if (accounts.length === 0) {
      getAccounts({ isHeader: false, limit: 500 })
        .then((res: any) => setAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
        .catch(() => {})
    }
    getLibroSATConfig().then(setLibroConfig).catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      if (tax) {
        form.setFieldsValue({ ...tax })
        setSubtype(tax.subtype)
        setCategory(tax.category)
        if (tax.tiers) setTiers(tax.tiers)
        setPreviewTax(tax)
      } else {
        form.resetFields()
        setSubtype('simple')
        setCategory('iva')
        setTiers([
          { upTo: 30000, rate: 5, label: 'Hasta Q 30,000.00' },
          { upTo: null,  rate: 7, label: 'Más de Q 30,000.00' },
        ])
        setPreviewTax(null)
      }
    }
  }, [open, tax, form])

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const dto = {
        ...values,
        tiers:       subtype === 'progressive' ? tiers : null,
        isWithholding: ['isr', 'iva_retenida'].includes(values.category),
      }
      if (tax?.id) {
        await updateTax(tax.id, dto)
        message.success('Impuesto actualizado')
      } else {
        await createTax(dto)
        message.success('Impuesto creado')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // Actualizar preview en tiempo real — usamos el valor de changed.subtype
  // directamente para no depender del state estale
  const handleValuesChange = (changed: any, all: any) => {
    let newSubtype = changed.subtype ?? subtype
    if (changed.category === 'iva_pequeno_contribuyente') {
      newSubtype = 'pequeno_contribuyente'
      form.setFieldsValue({ subtype: 'pequeno_contribuyente', rate: 0 })
    }
    if (changed.category) {
      const ref = taxes.find(t => t.category === changed.category && (t.salesAccountId || t.purchaseAccountId))
      if (ref) form.setFieldsValue({ salesAccountId: ref.salesAccountId ?? undefined, purchaseAccountId: ref.purchaseAccountId ?? undefined })
    }
    if (changed.subtype || changed.category === 'iva_pequeno_contribuyente') setSubtype(newSubtype)
    if (changed.category) setCategory(changed.category)
    setPreviewTax({
      id: tax?.id ?? 'preview',
      ...all,
      subtype:       newSubtype,
      rate:          changed.category === 'iva_pequeno_contribuyente' ? 0 : (all.rate ?? 0),
      tiers:         newSubtype === 'progressive' ? tiers : null,
      isWithholding: ['isr', 'iva_retenida'].includes(all.category ?? 'iva'),
      isInclusive:   all.isInclusive ?? false,
    } as Tax)
  }

  const isEditing = !!tax?.id

  return (
    <Modal
      open={open}
      title={
        <Space>
          {isEditing ? <EditOutlined /> : <PlusOutlined />}
          {isEditing ? `Editar: ${tax?.name}` : 'Nuevo impuesto'}
        </Space>
      }
      onCancel={onClose}
      onOk={handleSave}
      okText={isEditing ? 'Guardar cambios' : 'Crear impuesto'}
      okButtonProps={{ loading, style: { background: '#1faec2' } }}
      width={1080}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={{ applicability: 'both', subtype: 'simple', category: 'iva', rate: 12, isActive: true }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* ── Panel izquierdo: campos principales ── */}
          <div style={{ flex: '0 0 55%' }}>
            <Row gutter={12}>
              <Col span={14}>
                <Form.Item name="name" label="Nombre del impuesto" rules={[{ required: true }]}>
                  <AutoComplete
                    placeholder="IVA 12%"
                    options={taxes.map(t => ({ value: t.name, label: t.name }))}
                    filterOption={(input, opt) => (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="code" label="Código" rules={[{ required: true }]}
                  tooltip="Código corto único, ej: IVA12, ISR, IVARET65">
                  <AutoComplete
                    placeholder="IVA12"
                    style={{ textTransform: 'uppercase' }}
                    options={taxes.map(t => ({ value: t.code, label: `${t.code} — ${t.name}` }))}
                    filterOption={(input, opt) => (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={14}>
                <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
                  <Select>
                    <Option value="iva">IVA 12% — Impuesto al Valor Agregado</Option>
                    <Option value="iva_exento">IVA Exento (0%)</Option>
                    <Option value="iva_retenida">Retención de IVA (65% / 15%)</Option>
                    <Option value="iva_pequeno_contribuyente">IVA Pequeño Contribuyente</Option>
                    <Option value="isr">ISR — Retención en la Fuente</Option>
                    <Option value="other">Otro impuesto</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="applicability" label="Aplica en">
                  <Select>
                    <Option value="both">Ventas y compras</Option>
                    <Option value="sales">Solo ventas</Option>
                    <Option value="purchases">Solo compras</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {category === 'iva_pequeno_contribuyente' && (
              <Alert
                type="warning" showIcon style={{ marginBottom: 12 }}
                message="IVA Pequeño Contribuyente — consideraciones clave"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
                    <li><strong>Emisor PC:</strong> Facturás el total sin desglosar IVA. Al cierre de cada mes pagás el 5% sobre el total de ventas directamente al SAT (formulario SAT-2046).</li>
                    <li><strong>Receptor (CG):</strong> Se registra al valor total en la columna "Pequeño Contribuyente" del libro de compras. No aplica crédito fiscal.</li>
                    <li><strong>GCE (Art. 55, Dto. 27-92):</strong> Gran Contribuyente Especial retiene el 5% del total y lo entera al SAT. Crear impuesto <code>IVARET_PC</code> como <em>Retención de IVA</em> 5%.</li>
                  </ul>
                }
              />
            )}

            <Form.Item name="subtype" label="Tipo de cálculo" rules={[{ required: true }]}>
              <Select onChange={v => setSubtype(v)}>
                <Option value="simple">📊 Tasa simple — porcentaje fijo sobre el monto base (IVA 12%)</Option>
                <Option value="exempt">✅ Exento — 0%, operaciones no gravadas</Option>
                <Option value="pequeno_contribuyente">🟣 Pequeño Contribuyente — 0%, columna específica libro de compras</Option>
                <Option value="progressive">📈 Progresivo por tramos — tasa diferente por rangos (ISR)</Option>
                <Option value="retention_tax">🔗 Retención sobre impuesto — % de otro impuesto (IVA Retenida)</Option>
              </Select>
            </Form.Item>

            {subtype === 'simple' && (
              <Form.Item name="rate" label="Tasa (%)" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} addonAfter="% sobre el monto base" />
              </Form.Item>
            )}

            {subtype === 'progressive' && (
              <Form.Item label="Tramos del impuesto">
                <Alert
                  message="Impuesto progresivo — ISR Guatemala"
                  description="Define tramos de monto con su tasa correspondiente. El impuesto se calcula acumulando cada tramo hasta agotar el monto total."
                  type="info" showIcon style={{ marginBottom: 12 }}
                />
                <TiersEditor
                  tiers={tiers}
                  onChange={(newTiers) => {
                    setTiers(newTiers)
                    setPreviewTax(prev => prev ? { ...prev, tiers: newTiers } : prev)
                  }}
                />
              </Form.Item>
            )}

            {subtype === 'retention_tax' && (
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="baseTaxCode" label="Impuesto base" rules={[{ required: true }]}
                    tooltip="El impuesto sobre el cual se calcula esta retención">
                    <Select placeholder="Selecciona el impuesto base">
                      {taxes.filter(t => t.subtype === 'simple').map(t => (
                        <Option key={t.code} value={t.code}>{t.name} ({t.code})</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="rate" label="Porcentaje de retención" rules={[{ required: true }]}>
                    <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} addonAfter="% del impuesto base" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Divider titlePlacement="left" style={{ fontSize: 12, color: '#6b7280', margin: '10px 0' }}>
              Cuentas contables (para partidas automáticas)
            </Divider>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 10, fontSize: 11 }}
              message={
                <span style={{ fontSize: 11 }}>
                  Si no encuentras la cuenta en la lista, créala primero en <strong>Contabilidad → Catálogo</strong>.
                  Ejemplos: <code>2210 IVA por Pagar</code>, <code>1150 Crédito Fiscal IVA</code>, <code>2215 Retención IVA por Enterar</code>.
                </span>
              }
            />
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="salesAccountId" label="Cuenta ventas (haber)"
                  tooltip="Cuenta que se acredita al registrar este impuesto en ventas (ej: IVA por Pagar 2210)">
                  <Select allowClear showSearch placeholder="Buscar cuenta..." optionFilterProp="label"
                    options={accounts.map(a => ({ value: a.id, label: `${a.code}  ${a.name}` }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="purchaseAccountId" label="Cuenta compras (débito)"
                  tooltip="Cuenta que se debita al registrar este impuesto en compras (ej: IVA Crédito Fiscal 1150)">
                  <Select allowClear showSearch placeholder="Buscar cuenta..." optionFilterProp="label"
                    options={accounts.map(a => ({ value: a.id, label: `${a.code}  ${a.name}` }))} />
                </Form.Item>
              </Col>
            </Row>
            {subtype === 'retention_tax' && (
              <Form.Item name="retentionAccountId" label="Cuenta retención"
                tooltip="Cuenta de pasivo donde se registra el importe retenido (ej: Retención IVA por Enterar 2215)">
                <Select allowClear showSearch placeholder="Buscar cuenta..." optionFilterProp="label"
                  options={accounts.map(a => ({ value: a.id, label: `${a.code}  ${a.name}` }))} />
              </Form.Item>
            )}

            <Form.Item name="description" label="Descripción / Fundamento legal">
              <TextArea rows={2} placeholder="Decreto 27-92, Art. 10 — Tasa general del IVA" />
            </Form.Item>
          </div>

          {/* ── Panel derecho: libros SAT + opciones + calculadora ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Divider titlePlacement="left" style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
              Vinculación a Libros SAT
            </Divider>
            <Form.Item
              name="libroComprasCol"
              label="Columna en Libro de Compras"
              tooltip="Columna del Libro de Compras y Servicios (SAT) a la que contribuye este impuesto."
            >
              <Select allowClear placeholder="Sin asignación"
                options={libroConfig.compras.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({ value: c.key, label: c.label }))} />
            </Form.Item>
            <Form.Item
              name="libroVentasCol"
              label="Columna en Libro de Ventas"
              tooltip="Columna del Libro de Ventas y Servicios (SAT) a la que contribuye este impuesto."
            >
              <Select allowClear placeholder="Sin asignación"
                options={libroConfig.ventas.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({ value: c.key, label: c.label }))} />
            </Form.Item>

            <Divider style={{ margin: '10px 0' }} />
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="isInclusive" label="Modo precio" valuePropName="checked"
                  tooltip="IVA incluido: precio ya contiene el impuesto. IVA excluido: se suma sobre el precio.">
                  <Switch checkedChildren="Incluido" unCheckedChildren="Excluido" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="isDefault" label="Por defecto" valuePropName="checked">
                  <Switch checkedChildren="Sí" unCheckedChildren="No" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="isActive" label="Activo" valuePropName="checked">
                  <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" defaultChecked />
                </Form.Item>
              </Col>
            </Row>

            {previewTax && previewTax.subtype !== 'exempt' && previewTax.subtype !== 'pequeno_contribuyente' && (
              <TaxCalculator
                tax={previewTax}
                liveTiers={subtype === 'progressive' ? tiers : undefined}
              />
            )}
          </div>
        </div>
      </Form>
    </Modal>
  )
}

// ── Panel de plantilla (empty state) ──────────────────────────────────────

function TemplatePanel({
  template, onLoad, loading,
}: {
  template: TaxRegimeTemplate
  onLoad:   () => void
  loading:  boolean
}) {
  const SAT_COLOR: Record<string, string> = {
    'SAT-2237': '#1faec2', 'SAT-2046': '#f59e0b', 'No obligatorio': '#9aa1ab',
  }
  const satColor = SAT_COLOR[template.satForm] ?? '#1faec2'

  const CodeRow = ({ item }: { item: (typeof template.ventas)[number] }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr 56px 100px',
      gap: 6, fontSize: 12, padding: '5px 10px',
      borderBottom: '1px solid rgba(10,10,10,0.04)',
      alignItems: 'center',
    }}>
      <Text code style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{item.code}</Text>
      <span style={{ color: '#374151', lineHeight: 1.35 }}>{item.name}</span>
      <Tag style={{ margin: 0, textAlign: 'center', fontSize: 11 }}
        color={item.rate > 0 ? '#1faec2' : 'default'}>
        {item.rate > 0 ? `${item.rate}%` : 'Exento'}
      </Tag>
      <Text type="secondary" style={{ fontSize: 10 }}>
        {item.libroVentasCol ?? item.libroComprasCol ?? '—'}
      </Text>
    </div>
  )

  return (
    <div style={{
      border: '1px solid rgba(10,10,10,0.08)', borderRadius: 10,
      background: '#fff', overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        background: '#f8fafc', padding: '16px 20px',
        borderBottom: '1px solid rgba(10,10,10,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FileTextOutlined style={{ color: satColor, fontSize: 16 }} />
            <Text strong style={{ fontSize: 14, color: '#0a0a0a' }}>
              Plantilla: {template.regimeName}
            </Text>
            <Tag color={satColor} style={{ margin: 0, fontSize: 11 }}>{template.satForm}</Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
        </div>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={onLoad}
          style={{ background: satColor, minWidth: 200 }}
        >
          Cargar plantilla {template.regimeName}
        </Button>
      </div>

      {/* Codes grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Ventas */}
        <div style={{ borderRight: '1px solid rgba(10,10,10,0.06)' }}>
          <div style={{
            padding: '8px 10px', background: '#f0fafe',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', color: '#1faec2',
            borderBottom: '1px solid rgba(31,174,194,0.15)',
          }}>
            Ventas — {template.ventas.length} códigos
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 56px 100px',
            gap: 6, fontSize: 10, padding: '4px 10px',
            color: '#9aa1ab', fontWeight: 600,
            borderBottom: '1px solid rgba(10,10,10,0.05)',
          }}>
            <span>Código</span><span>Nombre</span><span>Tasa</span><span>Casilla SAT</span>
          </div>
          {template.ventas.map(item => <CodeRow key={item.code} item={item} />)}
        </div>

        {/* Compras */}
        <div>
          <div style={{
            padding: '8px 10px', background: '#fff7ed',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', color: '#f59e0b',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
          }}>
            Compras — {template.compras.length} códigos
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 56px 100px',
            gap: 6, fontSize: 10, padding: '4px 10px',
            color: '#9aa1ab', fontWeight: 600,
            borderBottom: '1px solid rgba(10,10,10,0.05)',
          }}>
            <span>Código</span><span>Nombre</span><span>Tasa</span><span>Casilla SAT</span>
          </div>
          {template.compras.map(item => <CodeRow key={item.code} item={item} />)}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px', background: '#fafbfc',
        borderTop: '1px solid rgba(10,10,10,0.06)',
        fontSize: 11, color: '#9aa1ab',
      }}>
        Al cargar: se crean los códigos, se vinculan las cuentas contables (IVA por Pagar 2210 / Crédito Fiscal 1150) y se configura el Libro SAT según el régimen.
        Los códigos que ya existen se omiten automáticamente.
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ImpuestosPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const defaultCountry = countryFromCompany(activeCompany)
  const [countryCode,    setCountryCode]    = useState(defaultCountry)
  const [taxes,          setTaxes]          = useState<Tax[]>([])
  const [loading,        setLoading]        = useState(true)
  const [seeding,        setSeeding]        = useState(false)
  const [modal,          setModal]          = useState<{ open: boolean; tax: Tax | null }>({ open: false, tax: null })
  const [pageAccounts,   setPageAccounts]   = useState<Account[]>([])
  const [activeTemplate, setActiveTemplate] = useState<TaxRegimeTemplate>(GT_TEMPLATES[0])
  // IDs de impuestos que fallaron al eliminar (tienen historial de transacciones)
  const [hasHistoryIds,  setHasHistoryIds]  = useState<Set<string>>(new Set())

  const fetchTaxes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTaxes()
      setTaxes(Array.isArray(data) ? data : [])
    } catch {
      setTaxes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTaxes() }, [fetchTaxes])

  useEffect(() => {
    getAccounts({ isHeader: false, limit: 500 })
      .then((res: any) => setPageAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => { setCountryCode(defaultCountry) }, [defaultCountry])

  // Detectar régimen fiscal guardado en el onboarding
  useEffect(() => {
    getOrganizationProfile().then((profile: any) => {
      const code = profile?.settings?.fiscalRegimeCode
      setActiveTemplate(detectTemplate(code))
    }).catch(() => {})
  }, [])

  // Carga inteligente de plantilla por régimen: crea códigos + vincula cuentas + configura Libro SAT
  const handleLoadTemplate = async (template: TaxRegimeTemplate) => {
    setSeeding(true)
    try {
      const allItems = [...template.ventas, ...template.compras]
      let created = 0

      // Resolver cuentas por código exacto en el catálogo
      const resolveAccount = (code?: string): string | undefined => {
        if (!code) return undefined
        return pageAccounts.find(a => a.code === code)?.id
      }

      for (const item of allItems) {
        if (taxes.find(t => t.code === item.code)) continue  // ya existe

        const dto: any = {
          code:           item.code,
          name:           item.name,
          description:    item.description,
          category:       item.category,
          subtype:        item.subtype,
          applicability:  item.applicability,
          rate:           item.rate,
          isInclusive:    item.isInclusive,
          isWithholding:  item.isWithholding,
          isDefault:      item.isDefault ?? false,
          isActive:       true,
          libroVentasCol:  item.libroVentasCol,
          libroComprasCol: item.libroComprasCol,
        }

        // Vinculación automática de cuentas contables
        if (item.salesAccountCode)    dto.salesAccountId    = resolveAccount(item.salesAccountCode)
        if (item.purchaseAccountCode) dto.purchaseAccountId = resolveAccount(item.purchaseAccountCode)

        try {
          await createTax(dto)
          created++
        } catch (itemErr: any) {
          const msg = itemErr?.response?.data?.message || itemErr?.message
          console.warn(`[template] falló ${item.code}: ${msg}`)
        }
      }

      // Auto-configurar columnas del Libro SAT para este régimen
      await saveLibroSATConfig(template.libroConfig)

      const existing = allItems.length - created
      message.success(
        `${template.regimeName}: ${created} códigos creados` +
        (existing > 0 ? `, ${existing} ya existían` : '') +
        '. Libro SAT configurado.'
      )
      fetchTaxes()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al cargar plantilla')
    } finally {
      setSeeding(false)
    }
  }

  const handleBlock = async (id: string) => {
    try {
      await updateTax(id, { isActive: false } as any)
      message.success('Impuesto bloqueado — ya no aparece en documentos nuevos')
      fetchTaxes()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo bloquear')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTax(id)
      message.success('Impuesto eliminado')
      fetchTaxes()
    } catch (e: any) {
      // Si el backend rechaza la eliminación (tiene historial), pasar a modo "solo bloquear"
      setHasHistoryIds(prev => new Set(prev).add(id))
      const msg = e?.response?.data?.message || ''
      message.error(msg || 'No se puede eliminar — el impuesto tiene transacciones registradas. Usa Bloquear.')
    }
  }

  const columns: ColumnsType<Tax> = [
    {
      title: 'Código',
      dataIndex: 'code',
      width: 110,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (v, r) => (
        <Space>
          <Text code style={{ fontSize: 12 }}>{v}</Text>
          {r.isSystem && <Tooltip title="Impuesto del sistema"><InfoCircleOutlined style={{ color: '#6b7280', fontSize: 11 }} /></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.description && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.description.length > 60 ? r.description.slice(0, 60) + '…' : r.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      width: 130,
      sorter: (a, b) => (a.category ?? '').localeCompare(b.category ?? ''),
      render: (v: string) => {
        const c = CATEGORY_LABELS[v]
        return <Tag color={c?.color}>{c?.label ?? v}</Tag>
      },
    },
    {
      title: 'Tipo de cálculo',
      dataIndex: 'subtype',
      width: 180,
      sorter: (a, b) => (a.subtype ?? '').localeCompare(b.subtype ?? ''),
      render: (v: string, r) => (
        <div>
          <div style={{ fontSize: 12 }}>{SUBTYPE_LABELS[v] ?? v}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, color: '#0a0a0a' }}>
            {rateDisplay(r)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Aplica en',
      dataIndex: 'applicability',
      width: 100,
      sorter: (a, b) => (a.applicability ?? '').localeCompare(b.applicability ?? ''),
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {APPLICABILITY_LABELS[v] ?? v}
        </Text>
      ),
    },
    {
      title: 'Cuenta contable',
      width: 200,
      render: (_, r) => {
        const salesAcc  = pageAccounts.find(a => a.id === r.salesAccountId)
        const purchAcc  = pageAccounts.find(a => a.id === r.purchaseAccountId)
        if (!salesAcc && !purchAcc) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        const same = salesAcc?.id === purchAcc?.id
        return (
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            {salesAcc && (
              <div>
                <Text type="secondary">Vta: </Text>
                <Text code style={{ fontSize: 10 }}>{salesAcc.code}</Text>
                {' '}<span style={{ color: '#374151' }}>{salesAcc.name}</span>
              </div>
            )}
            {purchAcc && !same && (
              <div>
                <Text type="secondary">Cmp: </Text>
                <Text code style={{ fontSize: 10 }}>{purchAcc.code}</Text>
                {' '}<span style={{ color: '#374151' }}>{purchAcc.name}</span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: '',
      width: 40,
      render: (_, r) => r.isWithholding
        ? <Tooltip title="Retención — el comprador retiene este impuesto"><Badge color="#ff7f00" text="" /></Tooltip>
        : null,
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      width: 90,
      sorter: (a, b) => Number(b.isActive) - Number(a.isActive),
      render: (v) => v
        ? <Tag color="success" icon={<CheckCircleOutlined />}>Activo</Tag>
        : <Tag color="default">Inactivo</Tag>,
    },
    {
      title: 'Acciones',
      width: 120,
      render: (_, r) => {
        // hasHistory: solo se activa cuando el backend rechaza un delete real
        // isSystem no implica historial — un código nuevo puede ser "system"
        const hasHistory = hasHistoryIds.has(r.id)
        const isActive   = r.isActive !== false   // null/undefined → activo

        if (!isActive) {
          return <Tag style={{ margin: 0, fontSize: 10 }} color="default">Bloqueado</Tag>
        }

        return (
          <Space size={2}>
            {/* Editar — siempre disponible mientras esté activo */}
            <Tooltip title="Editar">
              <Button
                type="text" size="small"
                icon={<EditOutlined />}
                onClick={() => setModal({ open: true, tax: r })}
              />
            </Tooltip>

            {/* Bloquear — siempre disponible */}
            <Popconfirm
              title="¿Bloquear impuesto?"
              description="Queda inactivo y no aparece en documentos nuevos. El historial contable se conserva."
              onConfirm={() => handleBlock(r.id)}
              okText="Sí, bloquear"
              okButtonProps={{ style: { background: '#f59e0b', borderColor: '#f59e0b' } }}
            >
              <Tooltip title="Bloquear">
                <Button type="text" size="small" icon={<StopOutlined style={{ color: '#f59e0b' }} />} />
              </Tooltip>
            </Popconfirm>

            {/* Eliminar — solo si no tiene historial registrado */}
            {!hasHistory && (
              <Popconfirm
                title="¿Eliminar impuesto?"
                description="Se elimina si no tiene transacciones. Si falla, usa Bloquear."
                onConfirm={() => handleDelete(r.id)}
                okText="Sí, eliminar"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Eliminar">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const hasTaxes     = taxes.length > 0
  const taxesVentas  = taxes.filter(t => t.applicability === 'sales')
  const taxesCompras = taxes.filter(t => t.applicability === 'purchases')
  const taxesBoth    = taxes.filter(t => !t.applicability || t.applicability === 'both')
  // Columnas compactas para bloques lado a lado
  const columnsCompact = columns
    .filter(c => {
      const col = c as any
      return col.dataIndex !== 'applicability'
        && col.dataIndex !== 'category'
        && !(col.title === '' && col.width === 40)   // quita badge retención
    })
    .map(c => {
      const col = { ...c } as any
      const key = col.dataIndex ?? col.title
      switch (key) {
        case 'code':
          return { ...col, width: 68 }
        case 'name':
          return { ...col, render: (v: string, r: any) => (
            <div>
              <div style={{ fontWeight: 500, fontSize: 12 }}>{v}</div>
              {r.description && (
                <span style={{ fontSize: 10, color: '#9aa1ab' }}>
                  {r.description.length > 38 ? r.description.slice(0, 38) + '…' : r.description}
                </span>
              )}
            </div>
          )}
        case 'subtype':
          return { ...col, title: 'Tasa', width: 60, render: (_: any, r: any) => {
            if (r.subtype === 'exempt')      return <span style={{ fontSize: 12, color: '#9aa1ab' }}>Exento</span>
            if (r.subtype === 'progressive') return <span style={{ fontSize: 12, color: '#9aa1ab' }}>Prog.</span>
            const rate = Number(r.rate)
            return <span style={{ fontSize: 13, fontWeight: 600 }}>{rate % 1 === 0 ? rate : rate.toFixed(2)}%</span>
          }}
        case 'Cuenta contable':
          return { ...col, width: 74, render: (_: any, r: any) => {
            const acc = pageAccounts.find((a: any) => a.id === r.salesAccountId)
              ?? pageAccounts.find((a: any) => a.id === r.purchaseAccountId)
            return acc
              ? <Text code style={{ fontSize: 11 }}>{acc.code}</Text>
              : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          }}
        case 'isActive':
          return { ...col, width: 80 }
        case 'Acciones':
          return { ...col, width: 100 }
        default:
          return col
      }
    })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Impuestos</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Plantilla IVA por régimen · Vinculación a cuentas contables · Columnas Libro SAT
          </Text>
        </div>
        <Space>
          <Tag style={{ margin: 0, fontSize: 12, padding: '4px 10px' }}>
            {activeTemplate.regimeName}
          </Tag>
          <Button
            icon={<ThunderboltOutlined />}
            loading={seeding}
            onClick={() => handleLoadTemplate(activeTemplate)}
            style={{ borderColor: '#1faec2', color: '#1faec2' }}
          >
            {hasTaxes ? 'Recargar plantilla' : 'Cargar plantilla fiscal'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModal({ open: true, tax: null })}
            style={{ background: '#1faec2' }}
          >
            Nuevo impuesto
          </Button>
        </Space>
      </div>

      {/* Panel de plantilla cuando no hay impuestos */}
      {!loading && !hasTaxes && (
        <TemplatePanel
          template={activeTemplate}
          onLoad={() => handleLoadTemplate(activeTemplate)}
          loading={seeding}
        />
      )}

      {/* Bloques Ventas + Compras en horizontal */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: taxesBoth.length > 0 ? 16 : 0 }}>

        {/* Bloque Ventas */}
        <Card
          bordered={false}
          style={{ flex: 1, minWidth: 0, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 0 }}
          title={
            <Space>
              <Tag color="green" style={{ margin: 0 }}>Ventas</Tag>
              <Text style={{ fontSize: 13, color: '#374151' }}>Emisión de facturas</Text>
            </Space>
          }
          extra={hasTaxes && <Text type="secondary" style={{ fontSize: 11 }}>{taxesVentas.length} códigos</Text>}
        >
          <Table
            columns={columnsCompact}
            dataSource={taxesVentas}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            rowClassName={(r) => r.isSystem ? 'system-row' : ''}
            locale={{ emptyText: 'Sin códigos de ventas' }}
          />
        </Card>

        {/* Bloque Compras */}
        <Card
          bordered={false}
          style={{ flex: 1, minWidth: 0, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 0 }}
          title={
            <Space>
              <Tag color="blue" style={{ margin: 0 }}>Compras</Tag>
              <Text style={{ fontSize: 13, color: '#374151' }}>Facturas de proveedores</Text>
            </Space>
          }
          extra={hasTaxes && <Text type="secondary" style={{ fontSize: 11 }}>{taxesCompras.length} códigos</Text>}
        >
          <Table
            columns={columnsCompact}
            dataSource={taxesCompras}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            rowClassName={(r) => r.isSystem ? 'system-row' : ''}
            locale={{ emptyText: 'Sin códigos de compras' }}
          />
        </Card>
      </div>

      {/* Bloque General — solo si hay impuestos con applicability = both (ej. creados manualmente) */}
      {taxesBoth.length > 0 && (
        <Card
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 0 }}
          title={
            <Space>
              <Tag style={{ margin: 0 }}>General</Tag>
              <Text style={{ fontSize: 13, color: '#374151' }}>Aplica en ventas y compras</Text>
            </Space>
          }
          extra={<Text type="secondary" style={{ fontSize: 11 }}>{taxesBoth.length} códigos</Text>}
        >
          <Table
            columns={columns}
            dataSource={taxesBoth}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            rowClassName={(r) => r.isSystem ? 'system-row' : ''}
          />
        </Card>
      )}

      {/* Modal */}
      <TaxModal
        open={modal.open}
        tax={modal.tax}
        taxes={taxes}
        onClose={() => setModal({ open: false, tax: null })}
        onSaved={fetchTaxes}
      />
    </div>
  )
}




