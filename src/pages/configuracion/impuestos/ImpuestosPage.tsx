import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, Switch,
  InputNumber, Space, Tooltip, Popconfirm, Typography,
  Card, Row, Col, Divider, Alert, Spin, Badge, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, InfoCircleOutlined,
  CalculatorOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getTaxes, createTax, updateTax, deleteTax, seedCountryTaxes, calculateTax,
  type Tax, type TaxTier,
} from '../../../api/impuestos'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getLibroSATConfig, DEFAULT_CONFIG, type LibroSATConfig } from '../../../api/libros-sat'
import { useCompanyStore } from '../../../store/companyStore'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ── Helpers de presentación ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  iva:          { label: 'IVA',            color: 'blue'   },
  iva_exento:   { label: 'IVA Exento',     color: 'default'},
  iva_retenida: { label: 'IVA Retenida',   color: 'orange' },
  isr:          { label: 'ISR',            color: 'purple' },
  other:        { label: 'Otro',           color: 'cyan'   },
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
  if (tax.subtype === 'exempt')          return '0% (Exento)'
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
    <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 16, marginTop: 12, border: '1px solid #bae0ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CalculatorOutlined style={{ color: '#1B3A6B' }} />
        <Text strong style={{ color: '#1B3A6B' }}>Vista previa del cálculo</Text>
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
            <div style={{ background: '#f8faff', padding: '10px 14px', borderBottom: '1px solid #f0f0f0' }}>
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
                <Text strong style={{ color: '#1B3A6B' }}>{fmt(result.baseAmount)}</Text>
              </div>
            </div>
          ) : null}

          {/* Desglose por tramos */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', marginBottom: 8, letterSpacing: 0.5 }}>
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
                borderBottom: i < result.breakdown.length - 1 ? '1px dashed #f0f0f0' : 'none',
                alignItems: 'center',
              }}>
                <Text type="secondary">{row.label}</Text>
                <Text type="secondary" style={{ textAlign: 'right', fontSize: 12 }}>
                  {fmt(row.taxable)}
                </Text>
                <Tag color="blue" style={{ margin: 0, textAlign: 'center', fontSize: 11 }}>
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
              <Text strong style={{ color: '#1B3A6B', fontSize: 14 }}>
                {tax.isWithholding ? '🔒 Total retención ISR' : 'Impuesto total'}
              </Text>
              <Text strong style={{ color: '#1B3A6B', fontSize: 16 }}>
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
                  <Text style={{ fontSize: 12, color: '#ff4d4f' }}>- {fmt(result.total)}</Text>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13 }}>Pago neto al proveedor</Text>
                  <Text strong style={{ fontSize: 13, color: '#52c41a' }}>{fmt(result.netPayment)}</Text>
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
          background: '#f8faff', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#1B3A6B', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Descripción</Text>
            <Input
              size="small"
              value={tier.label}
              onChange={e => updateTier(i, 'label', e.target.value)}
              placeholder="Ej: Hasta Q 30,000"
            />
          </div>
          <div style={{ width: 120 }}>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
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
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Tasa %</Text>
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
        if (tax.tiers) setTiers(tax.tiers)
        setPreviewTax(tax)
      } else {
        form.resetFields()
        setSubtype('simple')
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
    const newSubtype = changed.subtype ?? subtype
    if (changed.subtype) setSubtype(changed.subtype)
    setPreviewTax({
      id: tax?.id ?? 'preview',
      ...all,
      subtype:       newSubtype,
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
      okButtonProps={{ loading, style: { background: '#1B3A6B' } }}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={{ applicability: 'both', subtype: 'simple', category: 'iva', rate: 12, isActive: true }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Nombre del impuesto" rules={[{ required: true }]}>
              <Input placeholder="IVA 12%" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="code" label="Código SAT" rules={[{ required: true }]}
              tooltip="Código corto único, ej: IVA12, ISR, IVARET65">
              <Input placeholder="IVA12" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
              <Select>
                <Option value="iva">IVA — Impuesto al Valor Agregado</Option>
                <Option value="iva_exento">IVA Exento</Option>
                <Option value="iva_retenida">Retención de IVA</Option>
                <Option value="isr">ISR — Retención en la Fuente</Option>
                <Option value="other">Otro impuesto</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="applicability" label="Aplica en">
              <Select>
                <Option value="both">Ventas y compras</Option>
                <Option value="sales">Solo ventas</Option>
                <Option value="purchases">Solo compras</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="subtype" label="Tipo de cálculo" rules={[{ required: true }]}>
          <Select onChange={v => setSubtype(v)}>
            <Option value="simple">
              📊 Tasa simple — porcentaje fijo sobre el monto base (IVA 12%)
            </Option>
            <Option value="exempt">
              ✅ Exento — 0%, operaciones no gravadas
            </Option>
            <Option value="progressive">
              📈 Progresivo por tramos — tasa diferente por rangos (ISR)
            </Option>
            <Option value="retention_tax">
              🔗 Retención sobre impuesto — % de otro impuesto (IVA Retenida)
            </Option>
          </Select>
        </Form.Item>

        {/* Tasa simple */}
        {subtype === 'simple' && (
          <Form.Item name="rate" label="Tasa (%)" rules={[{ required: true }]}>
            <InputNumber
              min={0} max={100} precision={2}
              style={{ width: '100%' }}
              addonAfter="% sobre el monto base"
            />
          </Form.Item>
        )}

        {/* Tramos progresivos */}
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
                // Refrescar previewTax con los nuevos tiers
                const all = form.getFieldsValue()
                setPreviewTax(prev => prev ? { ...prev, tiers: newTiers } : prev)
              }}
            />
          </Form.Item>
        )}

        {/* Retención sobre otro impuesto */}
        {subtype === 'retention_tax' && (
          <Row gutter={16}>
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
                <InputNumber
                  min={0} max={100} precision={2}
                  style={{ width: '100%' }}
                  addonAfter="% del impuesto base"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Cuentas contables */}
        <Divider titlePlacement="left" style={{ fontSize: 12, color: '#8c8c8c', margin: '12px 0' }}>
          Cuentas contables (para partidas automáticas)
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="salesAccountId" label="Cuenta ventas (haber)"
              tooltip="Cuenta que se acredita al registrar este impuesto en ventas (ej: IVA por Pagar 2210)">
              <Select
                allowClear
                showSearch
                placeholder="Buscar cuenta..."
                optionFilterProp="label"
                options={accounts.map(a => ({
                  value: a.id,
                  label: `${a.code}  ${a.name}`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="purchaseAccountId" label="Cuenta compras (débito)"
              tooltip="Cuenta que se debita al registrar este impuesto en compras (ej: IVA Crédito Fiscal 1150)">
              <Select
                allowClear
                showSearch
                placeholder="Buscar cuenta..."
                optionFilterProp="label"
                options={accounts.map(a => ({
                  value: a.id,
                  label: `${a.code}  ${a.name}`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
        {subtype === 'retention_tax' && (
          <Form.Item name="retentionAccountId" label="Cuenta retención"
            tooltip="Cuenta de pasivo donde se registra el importe retenido (ej: Retención IVA por Enterar 2215)">
            <Select
              allowClear
              showSearch
              placeholder="Buscar cuenta..."
              optionFilterProp="label"
              options={accounts.map(a => ({
                value: a.id,
                label: `${a.code}  ${a.name}`,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item name="description" label="Descripción / Fundamento legal">
          <TextArea rows={2} placeholder="Decreto 27-92, Art. 10 — Tasa general del IVA" />
        </Form.Item>

        {/* Vinculación a Libros SAT — opciones dinámicas desde Configuración → Columnas Libros SAT */}
        <Divider titlePlacement="left" style={{ fontSize: 12, color: '#8c8c8c', margin: '12px 0' }}>
          Vinculación a Libros SAT
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="libroComprasCol"
              label="Columna en Libro de Compras"
              tooltip="Columna del Libro de Compras y Servicios (SAT) a la que contribuye este impuesto. Las columnas se configuran en Configuración → Columnas Libros SAT."
            >
              <Select
                allowClear
                placeholder="Sin asignación"
                options={libroConfig.compras
                  .filter(c => c.isActive)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(c => ({ value: c.key, label: c.label }))
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="libroVentasCol"
              label="Columna en Libro de Ventas"
              tooltip="Columna del Libro de Ventas y Servicios (SAT) a la que contribuye este impuesto. Las columnas se configuran en Configuración → Columnas Libros SAT."
            >
              <Select
                allowClear
                placeholder="Sin asignación"
                options={libroConfig.ventas
                  .filter(c => c.isActive)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(c => ({ value: c.key, label: c.label }))
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="isInclusive"
              label="Modo de precio"
              valuePropName="checked"
              tooltip="IVA incluido: el precio ya contiene el impuesto (Q 1,000 → Base Q 892.86 + IVA Q 107.14 = Q 1,000). IVA excluido: el impuesto se suma sobre el precio (Q 1,000 + IVA Q 120 = Q 1,120)."
            >
              <Switch
                checkedChildren="IVA incluido"
                unCheckedChildren="IVA excluido"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="isDefault" label="Aplicar por defecto" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="isActive" label="Activo" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" defaultChecked />
            </Form.Item>
          </Col>
        </Row>

        {/* Calculadora en tiempo real */}
        {previewTax && previewTax.subtype !== 'exempt' && (
          <TaxCalculator
            tax={previewTax}
            liveTiers={subtype === 'progressive' ? tiers : undefined}
          />
        )}
      </Form>
    </Modal>
  )
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ImpuestosPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const defaultCountry = countryFromCompany(activeCompany)
  const [countryCode, setCountryCode] = useState(defaultCountry)
  const [taxes,   setTaxes]   = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [modal,   setModal]   = useState<{ open: boolean; tax: Tax | null }>({ open: false, tax: null })

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

  useEffect(() => { setCountryCode(defaultCountry) }, [defaultCountry])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const r = await seedCountryTaxes(countryCode)
      const meta = COUNTRY_TAX_LABELS[countryCode] ?? COUNTRY_TAX_LABELS.GT
      message.success(`${meta.country}: ${r.created} impuestos creados, ${r.skipped} ya existian`)
      fetchTaxes()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al inicializar catalogo fiscal')
    } finally {
      setSeeding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTax(id)
      message.success('Impuesto desactivado')
      fetchTaxes()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  const columns: ColumnsType<Tax> = [
    {
      title: 'Código',
      dataIndex: 'code',
      width: 110,
      render: (v, r) => (
        <Space>
          <Text code style={{ fontSize: 12 }}>{v}</Text>
          {r.isSystem && <Tooltip title="Impuesto del sistema"><InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 11 }} /></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
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
      render: (v: string) => {
        const c = CATEGORY_LABELS[v]
        return <Tag color={c?.color}>{c?.label ?? v}</Tag>
      },
    },
    {
      title: 'Tipo de cálculo',
      dataIndex: 'subtype',
      width: 180,
      render: (v: string, r) => (
        <div>
          <div style={{ fontSize: 12 }}>{SUBTYPE_LABELS[v] ?? v}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, color: '#1B3A6B' }}>
            {rateDisplay(r)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Aplica en',
      dataIndex: 'applicability',
      width: 100,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {APPLICABILITY_LABELS[v] ?? v}
        </Text>
      ),
    },
    {
      title: '',
      width: 40,
      render: (_, r) => r.isWithholding
        ? <Tooltip title="Retención — el comprador retiene este impuesto"><Badge color="orange" text="" /></Tooltip>
        : null,
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      width: 90,
      render: (v) => v
        ? <Tag color="success" icon={<CheckCircleOutlined />}>Activo</Tag>
        : <Tag color="default">Inactivo</Tag>,
    },
    {
      title: 'Acciones',
      width: 100,
      render: (_, r) => (
        <Space>
          <Tooltip title="Editar">
            <Button
              type="text" size="small"
              icon={<EditOutlined />}
              onClick={() => setModal({ open: true, tax: r })}
            />
          </Tooltip>
          {!r.isSystem && (
            <Popconfirm
              title="¿Desactivar impuesto?"
              description="El impuesto no se elimina, solo se desactiva."
              onConfirm={() => handleDelete(r.id)}
              okText="Sí, desactivar"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Desactivar">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const hasTaxes = taxes.length > 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Impuestos</Title>
          <Text type="secondary">
            Configura impuestos por pais para la empresa activa y vincula cada impuesto al libro fiscal
          </Text>
        </div>
        <Space>
          <Select
            value={countryCode}
            onChange={setCountryCode}
            style={{ width: 180 }}
            options={Object.entries(COUNTRY_TAX_LABELS).map(([value, meta]) => ({ value, label: `${value} - ${meta.country}` }))}
          />
          <Button
            icon={<ThunderboltOutlined />}
            loading={seeding}
            onClick={handleSeed}
            style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
          >
            Cargar plantilla fiscal
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModal({ open: true, tax: null })}
            style={{ background: '#1B3A6B' }}
          >
            Nuevo impuesto
          </Button>
        </Space>
      </div>

      {/* Banner cuando no hay impuestos */}
      {!loading && !hasTaxes && (
        <Alert
          message="Sin impuestos configurados"
          description={
            <div>
              Selecciona el pais fiscal y carga la plantilla base de impuestos para la empresa activa.
              <br />
              <Button
                type="link" style={{ padding: 0, marginTop: 4 }}
                icon={<ThunderboltOutlined />}
                loading={seeding}
                onClick={handleSeed}
              >
                Cargar plantilla ahora
              </Button>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Tabla */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={taxes}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          rowClassName={(r) => r.isSystem ? 'system-row' : ''}
          locale={{ emptyText: 'Sin impuestos - carga una plantilla fiscal o crea un impuesto manualmente' }}
        />
      </Card>

      {/* Leyenda */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <Space key={k} size={4}>
            <Tag color={v.color} style={{ margin: 0 }}>{v.label}</Tag>
          </Space>
        ))}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Naranja = retencion (el comprador retiene al fisco)
        </Text>
      </div>

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




