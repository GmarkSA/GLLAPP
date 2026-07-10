import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Button, Form, Input, DatePicker, Select, Typography, Divider,
  Table, InputNumber, Space, Tooltip, Tag, message, Popconfirm, Radio,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, StopOutlined,
  RollbackOutlined, ArrowLeftOutlined, SaveOutlined, CopyOutlined,
  RetweetOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  createAsiento, getAsiento, updateAsiento, postAsiento,
  voidAsiento, reverseAsiento, type AsientoDetalle,
} from '../../../api/asientos'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getCustomers, getVendors, type Customer, type Vendor } from '../../../api/contactos'
import { getActivosFijos, type ActivoFijo } from '../../../api/activos-fijos'
import { getExchangeRateForDate } from '../../../api/monedas'

const { Title } = Typography

const STATUS_COLOR: Record<string, string> = { DRAFT: 'default', POSTED: 'success', VOID: 'error' }
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', POSTED: 'Publicado', VOID: 'Anulado' }

const CURRENCIES = [
  { label: 'GTQ — Quetzal',          value: 'GTQ' },
  { label: 'USD — Dólar americano',   value: 'USD' },
  { label: 'EUR — Euro',              value: 'EUR' },
  { label: 'MXN — Peso mexicano',     value: 'MXN' },
]

const TAX_OPTIONS = [
  { label: 'Sin impuesto',          value: '' },
  { label: 'IVA 12%',              value: 'IVA12' },
  { label: 'IVA 5% (Peq. contrib.)', value: 'IVA5' },
  { label: 'Exento',               value: 'EXEMPT' },
]
const TAX_RATES: Record<string, number> = { IVA12: 0.12, IVA5: 0.05, EXEMPT: 0 }

interface AccountMeta { isCustomer: boolean; isVendor: boolean; isFixedAsset: boolean }

interface LineState {
  key:         string
  accountId:   string
  accountCode: string
  accountName: string
  accountMeta: AccountMeta
  description: string
  auxiliarId:  string
  taxCode:     string
  taxAmount:   number | null
  debit:       number | null
  credit:      number | null
}

const emptyLine = (): LineState => ({
  key:         Math.random().toString(36).slice(2),
  accountId: '', accountCode: '', accountName: '',
  accountMeta: { isCustomer: false, isVendor: false, isFixedAsset: false },
  description: '', auxiliarId: '', taxCode: '', taxAmount: null, debit: null, credit: null,
})

const detailToLines = (lines: AsientoDetalle['lines']): LineState[] =>
  lines.map(l => ({
    key:         Math.random().toString(36).slice(2),
    accountId:   l.accountId ?? '',
    accountCode: l.accountCode,
    accountName: l.accountName,
    accountMeta: { isCustomer: false, isVendor: false, isFixedAsset: false },
    description: l.description ?? '',
    auxiliarId:  l.customerId ?? l.vendorId ?? l.fixedAssetId ?? '',
    taxCode:     l.taxCode ?? '',
    taxAmount:   l.taxAmount ? Number(l.taxAmount) : null,
    debit:       Number(l.debit)  || null,
    credit:      Number(l.credit) || null,
  }))

export default function DiarioManualFormPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const location  = useLocation()
  const clonarDe  = (location.state as any)?.clonarDe as AsientoDetalle | undefined
  const isNew     = !id || id === 'nuevo'

  const [form]     = Form.useForm()
  const [asiento,  setAsiento]   = useState<AsientoDetalle | null>(null)
  const [lines,    setLines]     = useState<LineState[]>([emptyLine(), emptyLine()])
  const [accounts, setAccounts]  = useState<Account[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vendors,  setVendors]   = useState<Vendor[]>([])
  const [assets,   setAssets]    = useState<ActivoFijo[]>([])
  const [saving,   setSaving]    = useState(false)
  const [acting,   setActing]    = useState(false)
  const [currency, setCurrency]  = useState('GTQ')
  const [loadingRate, setLoadingRate] = useState(false)
  const [rateMeta,    setRateMeta]    = useState<{ effectiveDate: string; source: string } | null>(null)

  const watchCurrency  = Form.useWatch('currency',   form)
  const watchEntryDate = Form.useWatch('entryDate',  form)

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  const diferencia  = totalDebit - totalCredit
  const isReadonly  = asiento?.status === 'POSTED' || asiento?.status === 'VOID'

  const loadMeta = useCallback(async () => {
    const [all, custs, vends, af] = await Promise.allSettled([
      getAccounts({ activas: true }),
      getCustomers({ limit: 500 }),
      getVendors({ limit: 500 }),
      getActivosFijos({ limit: 500 }),
    ])
    if (all.status === 'fulfilled') setAccounts(Array.isArray(all.value) ? all.value : [])
    if (custs.status === 'fulfilled') {
      const v = custs.value as any
      setCustomers(Array.isArray(v) ? v : v?.data ?? [])
    }
    if (vends.status === 'fulfilled') {
      const v = vends.value as any
      setVendors(Array.isArray(v) ? v : v?.data ?? [])
    }
    if (af.status === 'fulfilled') {
      const v = af.value as any
      setAssets(Array.isArray(v) ? v : v?.data ?? [])
    }
  }, [])

  const loadAsiento = useCallback(async () => {
    if (isNew || !id) return
    try {
      const a = await getAsiento(id)
      setAsiento(a)
      setCurrency(a.currency ?? 'GTQ')
      form.setFieldsValue({
        entryDate:      dayjs(a.entryDate),
        accountingDate: a.accountingDate ? dayjs(a.accountingDate) : null,
        description:    a.description,
        reference:      a.reference,
        type:           a.type,
        currency:       a.currency ?? 'GTQ',
        exchangeRate:   a.exchangeRate,
      })
      setLines(detailToLines(a.lines))
    } catch { message.error('Error al cargar el asiento') }
  }, [id, isNew, form])

  useEffect(() => { loadMeta() }, [loadMeta])

  useEffect(() => {
    if (!watchCurrency || watchCurrency === 'GTQ') {
      form.setFieldValue('exchangeRate', 1)
      setRateMeta(null)
      return
    }
    const date = watchEntryDate ? dayjs(watchEntryDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    setLoadingRate(true)
    getExchangeRateForDate(watchCurrency, date)
      .then(r => {
        const rate = r.officialRate ?? (r.rate > 0 ? 1 / r.rate : 1)
        form.setFieldValue('exchangeRate', Number(rate.toFixed(6)))
        setRateMeta({ effectiveDate: r.effectiveDate, source: r.source })
      })
      .catch(() => message.warning('No se pudo cargar el tipo de cambio para la fecha seleccionada'))
      .finally(() => setLoadingRate(false))
  }, [watchCurrency, watchEntryDate, form])

  useEffect(() => {
    if (clonarDe) {
      form.setFieldsValue({
        entryDate:   dayjs(),
        description: `Copia de ${clonarDe.entryNumber}: ${clonarDe.description}`,
        reference:   clonarDe.reference,
        type:        'MANUAL',
        currency:    clonarDe.currency ?? 'GTQ',
      })
      setCurrency(clonarDe.currency ?? 'GTQ')
      setLines(detailToLines(clonarDe.lines))
    } else {
      loadAsiento()
    }
  }, [clonarDe, loadAsiento, form])

  const updateLine = (key: string, patch: Partial<LineState>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))

  const setAccount = (key: string, acct: Account) => {
    updateLine(key, {
      accountId:   acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      accountMeta: {
        isCustomer:  acct.isCustomerAccount,
        isVendor:    acct.isVendorAccount,
        isFixedAsset: acct.isFixedAsset,
      },
      auxiliarId: '',
    })
  }

  const recalcTax = (key: string, taxCode: string, debit: number | null, credit: number | null) => {
    const base = (debit ?? 0) || (credit ?? 0)
    const rate = TAX_RATES[taxCode] ?? 0
    updateLine(key, { taxCode, taxAmount: rate > 0 ? Math.round(base * rate * 100) / 100 : null })
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key: string) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const buildLines = () =>
    lines.filter(l => l.accountCode || l.accountId).map((l, i) => {
      const base: any = {
        accountId:   l.accountId   || undefined,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description || undefined,
        debit:       l.debit  ?? 0,
        credit:      l.credit ?? 0,
        taxCode:     l.taxCode || undefined,
        taxAmount:   l.taxAmount ?? undefined,
        sortOrder:   i,
      }
      if (l.accountMeta.isCustomer)  base.customerId   = l.auxiliarId || undefined
      if (l.accountMeta.isVendor)    base.vendorId     = l.auxiliarId || undefined
      if (l.accountMeta.isFixedAsset) base.fixedAssetId = l.auxiliarId || undefined
      return base
    })

  const handleSave = async (autoPost: boolean) => {
    try { await form.validateFields() } catch { return }
    const validLines = lines.filter(l => l.accountCode || l.accountId)
    if (validLines.length < 2) { message.warning('Se necesitan al menos 2 líneas con cuenta'); return }
    if (Math.abs(diferencia) > 0.01) { message.warning(`El asiento no cuadra — diferencia: Q ${Math.abs(diferencia).toFixed(2)}`); return }

    setSaving(true)
    try {
      const vals = form.getFieldsValue()
      if (isNew || clonarDe) {
        const created = await createAsiento({
          entryDate:      vals.entryDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
          accountingDate: vals.accountingDate?.format('YYYY-MM-DD'),
          description:    vals.description,
          reference:      vals.reference || undefined,
          type:           vals.type ?? 'MANUAL',
          currency:       vals.currency ?? 'GTQ',
          exchangeRate:   vals.exchangeRate,
          autoPost,
          lines: buildLines(),
        })
        message.success(autoPost ? 'Asiento publicado y contabilizado' : 'Borrador guardado')
        navigate(`/contabilidad/diarios-manuales/${created.id}`, { replace: true, state: null })
      } else {
        await updateAsiento(id!, {
          entryDate:   vals.entryDate?.format('YYYY-MM-DD'),
          description: vals.description,
          reference:   vals.reference,
        })
        if (autoPost) { await postAsiento(id!); message.success('Asiento publicado y contabilizado') }
        else message.success('Borrador actualizado')
        loadAsiento()
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const fetchRate = (currencyCode: string, date?: string) => {
    if (!currencyCode || currencyCode === 'GTQ') return
    const d = date ?? (form.getFieldValue('entryDate') ? dayjs(form.getFieldValue('entryDate')).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))
    setLoadingRate(true)
    getExchangeRateForDate(currencyCode, d)
      .then(r => {
        const rate = r.officialRate ?? (r.rate > 0 ? 1 / r.rate : 1)
        form.setFieldValue('exchangeRate', Number(rate.toFixed(6)))
        setRateMeta({ effectiveDate: r.effectiveDate, source: r.source })
      })
      .catch(() => message.warning('No se pudo cargar el tipo de cambio'))
      .finally(() => setLoadingRate(false))
  }

  const actFn = async (fn: () => Promise<any>, ok: string) => {
    setActing(true)
    try {
      const result = await fn()
      message.success(ok)
      if (result?.id && result?.id !== id) navigate(`/contabilidad/diarios-manuales/${result.id}`)
      else loadAsiento()
    }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setActing(false) }
  }

  const Q = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

  const lineColumns = [
    {
      title: 'Cuenta', width: 220,
      render: (_: any, r: LineState) => (
        <Select size="small" showSearch value={r.accountId || undefined}
          disabled={isReadonly}
          placeholder="Seleccione una cuenta" optionFilterProp="label"
          style={{ width: '100%' }}
          options={accounts.filter(a => !a.isHeader && a.isActive)
            .map(a => ({ label: `${a.code} - ${a.name}`, value: a.id, acct: a }))}
          onChange={(_: any, opt: any) => setAccount(r.key, opt.acct)}
        />
      ),
    },
    {
      title: 'Descripción', width: 180,
      render: (_: any, r: LineState) => (
        <Input size="small" value={r.description} disabled={isReadonly}
          placeholder="Descripción" onChange={e => updateLine(r.key, { description: e.target.value })} />
      ),
    },
    {
      title: 'Auxiliar', width: 180,
      render: (_: any, r: LineState) => {
        const meta = r.accountMeta
        if (meta.isCustomer) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            disabled={isReadonly} placeholder="Cliente" optionFilterProp="label"
            style={{ width: '100%' }} allowClear
            options={customers.map((c: any) => ({ label: c.displayName ?? c.companyName, value: c.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        if (meta.isVendor) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            disabled={isReadonly} placeholder="Proveedor" optionFilterProp="label"
            style={{ width: '100%' }} allowClear
            options={vendors.map((v: any) => ({ label: v.displayName ?? v.companyName, value: v.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        if (meta.isFixedAsset) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            disabled={isReadonly} placeholder="Activo fijo" optionFilterProp="label"
            style={{ width: '100%' }} allowClear
            options={assets.map(a => ({ label: `${a.assetNumber} - ${a.name}`, value: a.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        return <span style={{ color: '#ccc', fontSize: 11, paddingLeft: 8 }}>—</span>
      },
    },
    {
      title: 'Impuesto', width: 150,
      render: (_: any, r: LineState) => (
        <Select size="small" value={r.taxCode || ''} disabled={isReadonly}
          style={{ width: '100%' }} options={TAX_OPTIONS}
          onChange={v => recalcTax(r.key, v, r.debit, r.credit)} />
      ),
    },
    {
      title: 'Débitos', width: 120, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber size="small" style={{ width: '100%' }} min={0} precision={2}
          value={r.debit} placeholder="0.00" disabled={isReadonly}
          onChange={v => {
            updateLine(r.key, { debit: v, ...(v && v > 0 ? { credit: null } : {}) })
            if (r.taxCode) recalcTax(r.key, r.taxCode, v, null)
          }} />
      ),
    },
    {
      title: 'Créditos', width: 120, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber size="small" style={{ width: '100%' }} min={0} precision={2}
          value={r.credit} placeholder="0.00" disabled={isReadonly}
          onChange={v => {
            updateLine(r.key, { credit: v, ...(v && v > 0 ? { debit: null } : {}) })
            if (r.taxCode) recalcTax(r.key, r.taxCode, null, v)
          }} />
      ),
    },
    ...(!isReadonly ? [{
      title: '', width: 36,
      render: (_: any, r: LineState) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          disabled={lines.length <= 2} onClick={() => removeLine(r.key)} />
      ),
    }] : []),
  ]

  const pageTitle = clonarDe
    ? `Nuevo diario (clon de ${clonarDe.entryNumber})`
    : isNew ? 'Nuevo diario'
    : asiento ? `Diario ${asiento.entryNumber}`
    : 'Cargando...'

  return (
    <div style={{ padding: 24, maxWidth: 1300 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contabilidad/diarios-manuales')}>
          Volver
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{pageTitle}</Title>
        {asiento?.status && (
          <Tag color={STATUS_COLOR[asiento.status]}>{STATUS_LABEL[asiento.status]}</Tag>
        )}
      </div>

      <Form form={form} layout="vertical" size="small"
        initialValues={{ type: 'MANUAL', currency: 'GTQ', exchangeRate: 1, entryDate: dayjs() }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {/* Col izquierda */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Fecha del documento" name="entryDate"
                rules={[{ required: true, message: 'Requerida' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabled={isReadonly} />
              </Form.Item>
              <Form.Item label="Fecha contable" name="accountingDate">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabled={isReadonly}
                  placeholder="Igual a fecha del documento" />
              </Form.Item>
            </div>
            <Form.Item label="N.º de referencia" name="reference">
              <Input placeholder="Número de referencia" disabled={isReadonly} />
            </Form.Item>
            <Form.Item label="Notas" name="description"
              rules={[{ required: true, message: 'Requerido' }]}>
              <Input.TextArea rows={3} maxLength={500} showCount
                placeholder="500 caracteres como máximo" disabled={isReadonly} />
            </Form.Item>
          </div>

          {/* Col derecha */}
          <div>
            {!isNew && asiento && (
              <Form.Item label="N.º del diario">
                <Input value={asiento.entryNumber} disabled style={{ fontWeight: 600 }} />
              </Form.Item>
            )}
            <Form.Item label="Tipo" name="type">
              <Select disabled={isReadonly || (!isNew && !clonarDe)}
                options={[
                  { label: 'Manual',   value: 'MANUAL' },
                  { label: 'Apertura', value: 'OPENING' },
                  { label: 'Cierre',   value: 'CLOSING' },
                  { label: 'Ajuste',   value: 'ADJUSTMENT' },
                ]}
              />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Moneda" name="currency">
                <Select disabled={isReadonly}
                  options={CURRENCIES}
                  onChange={v => setCurrency(v)} />
              </Form.Item>
              {currency !== 'GTQ' && (
                <Form.Item label="Tipo de cambio" name="exchangeRate"
                  extra={rateMeta ? `Tasa del ${dayjs(rateMeta.effectiveDate).format('DD/MM/YYYY')} · ${rateMeta.source}` : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={6}
                    disabled={isReadonly} placeholder="0.000000"
                    addonAfter={
                      <Tooltip title="Recargar tasa desde configuración">
                        <ReloadOutlined spin={loadingRate} onClick={() => fetchRate(currency)}
                          style={{ cursor: 'pointer', color: '#1B3A6B' }} />
                      </Tooltip>
                    } />
                </Form.Item>
              )}
            </div>
            <Form.Item label="Método de generación de informes" name="reportingMethod">
              <Radio.Group disabled={isReadonly} defaultValue="ACCRUAL_CASH">
                <Radio value="ACCRUAL_CASH">Acumulación y efectivo</Radio>
                <Radio value="ACCRUAL">Solo devengo</Radio>
                <Radio value="CASH">Sólo efectivo</Radio>
              </Radio.Group>
            </Form.Item>
          </div>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* ── Tabla de líneas ─────────────────────────────────── */}
        <Table dataSource={lines} columns={lineColumns} rowKey="key"
          size="small" pagination={false} locale={{ emptyText: 'Sin líneas' }} />

        {!isReadonly && (
          <Button type="dashed" icon={<PlusOutlined />}
            style={{ marginTop: 8, width: '100%' }} onClick={addLine}>
            Añadir nueva fila
          </Button>
        )}

        {/* ── Totales ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 340 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 20px', color: '#666' }}>Subtotal</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{Q(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{Q(totalCredit)}</td>
              </tr>
              <tr style={{ fontWeight: 700, fontSize: 14 }}>
                <td style={{ padding: '4px 20px', borderTop: '1px solid #f0f0f0' }}>Total ({currency})</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{Q(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{Q(totalCredit)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 20px', color: diferencia !== 0 ? '#f5222d' : '#52c41a' }}>Diferencia</td>
                <td colSpan={2} style={{
                  padding: '4px 20px', textAlign: 'right',
                  color: diferencia !== 0 ? '#f5222d' : '#52c41a', fontWeight: 600,
                }}>{Q(Math.abs(diferencia))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Acciones ─────────────────────────────────────────── */}
        <Divider style={{ margin: '16px 0' }} />
        <Space wrap>
          {!isReadonly && (
            <>
              <Button type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#1B3A6B' }} loading={saving}
                disabled={Math.abs(diferencia) > 0.01}
                onClick={() => handleSave(true)}>
                Guardar y publicar
              </Button>
              <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>
                Guardar como borrador
              </Button>
            </>
          )}
          {asiento && <Button icon={<CopyOutlined />}
            onClick={() => navigate('/contabilidad/diarios-manuales/nuevo', { state: { clonarDe: asiento } })}>
            Clonar
          </Button>}
          {asiento && <Tooltip title="Crear plantilla recurrente a partir de este asiento">
            <Button icon={<RetweetOutlined />}
              onClick={() => navigate('/contabilidad/diarios-recurrentes/nueva', { state: { desdeDiario: asiento } })}>
              Hacer recurrente
            </Button>
          </Tooltip>}
          {asiento?.status === 'POSTED' && (
            <Popconfirm title="¿Crear asiento de reversión? Se generará un borrador con débitos y créditos invertidos."
              okText="Revertir"
              onConfirm={() => actFn(() => reverseAsiento(id!), 'Reversión creada como borrador')}>
              <Button icon={<RollbackOutlined />} loading={acting}>Revertir</Button>
            </Popconfirm>
          )}
          {asiento?.status === 'POSTED' && (
            <Popconfirm title="¿Anular este asiento? Esta acción no puede deshacerse."
              okText="Anular" okButtonProps={{ danger: true }}
              onConfirm={() => actFn(() => voidAsiento(id!), 'Asiento anulado')}>
              <Button danger icon={<StopOutlined />} loading={acting}>Anular</Button>
            </Popconfirm>
          )}
          <Button onClick={() => navigate('/contabilidad/diarios-manuales')}>Cancelar</Button>
        </Space>
      </Form>
    </div>
  )
}
