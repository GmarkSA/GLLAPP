import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Button, Form, Input, DatePicker, Select, Typography, Divider,
  Table, InputNumber, Space, Tag, message, Checkbox, Radio, Tooltip,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  createAsientoRecurrente, getAsientoRecurrente, updateAsientoRecurrente,
  type AsientoRecurrente, type LineaPlantilla,
} from '../../../api/asientos-recurrentes'
import { type AsientoDetalle } from '../../../api/asientos'
import { getAccounts, type Account } from '../../../api/catalogo'
import { getCustomers, getVendors, type Customer, type Vendor } from '../../../api/contactos'
import { getActivosFijos, type ActivoFijo } from '../../../api/activos-fijos'
import { getExchangeRateForDate } from '../../../api/monedas'
import SelectorDimensionesAnaliticas, { useCentrosOptions } from '../../../components/SelectorDimensionesAnaliticas'

const { Title } = Typography

const CURRENCIES = [
  { label: 'GTQ — Quetzal',         value: 'GTQ' },
  { label: 'USD — Dólar americano',  value: 'USD' },
  { label: 'EUR — Euro',             value: 'EUR' },
  { label: 'MXN — Peso mexicano',    value: 'MXN' },
]
const TAX_OPTIONS = [
  { label: 'Sin impuesto',            value: '' },
  { label: 'IVA 12%',               value: 'IVA12' },
  { label: 'IVA 5% (Peq. contrib.)',  value: 'IVA5' },
  { label: 'Exento',                 value: 'EXEMPT' },
]
const TAX_RATES: Record<string, number> = { IVA12: 0.12, IVA5: 0.05, EXEMPT: 0 }

interface AccountMeta { isCustomer: boolean; isVendor: boolean; isFixedAsset: boolean }

interface LineState {
  key:              string
  accountId:        string; accountCode: string; accountName: string
  accountMeta:      AccountMeta
  description:      string
  auxiliarId:       string
  taxCode:          string; taxAmount: number | null
  debit:            number | null; credit: number | null
  centroCostoId:    string | null
  centroBeneficioId: string | null
}

const emptyLine = (): LineState => ({
  key: Math.random().toString(36).slice(2),
  accountId: '', accountCode: '', accountName: '',
  accountMeta: { isCustomer: false, isVendor: false, isFixedAsset: false },
  description: '', auxiliarId: '', taxCode: '', taxAmount: null, debit: null, credit: null,
  centroCostoId: null, centroBeneficioId: null,
})

const fromPlantilla = (l: LineaPlantilla): LineState => ({
  key: Math.random().toString(36).slice(2),
  accountId: l.accountId ?? '', accountCode: l.accountCode, accountName: l.accountName,
  accountMeta: { isCustomer: false, isVendor: false, isFixedAsset: false },
  description: l.description ?? '', auxiliarId: '',
  taxCode: '', taxAmount: null,
  debit: Number(l.debit) || null, credit: Number(l.credit) || null,
  centroCostoId: null, centroBeneficioId: null,
})

const fromAsiento = (l: AsientoDetalle['lines'][0]): LineState => ({
  key: Math.random().toString(36).slice(2),
  accountId: l.accountId ?? '', accountCode: l.accountCode, accountName: l.accountName,
  accountMeta: { isCustomer: false, isVendor: false, isFixedAsset: false },
  description: l.description ?? '',
  auxiliarId: l.customerId ?? l.vendorId ?? l.fixedAssetId ?? '',
  taxCode: l.taxCode ?? '', taxAmount: l.taxAmount ? Number(l.taxAmount) : null,
  debit: Number(l.debit) || null, credit: Number(l.credit) || null,
  centroCostoId:    l.centroCostoId    ?? null,
  centroBeneficioId: l.centroBeneficioId ?? null,
})

export default function DiarioRecurrenteFormPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const location    = useLocation()
  const desdeDiario = (location.state as any)?.desdeDiario as AsientoDetalle | undefined
  const isNew       = !id || id === 'nueva'

  const [form]      = Form.useForm()
  const [plantilla, setPlantilla]  = useState<AsientoRecurrente | null>(null)
  const [lines,     setLines]      = useState<LineState[]>([emptyLine(), emptyLine()])
  const [accounts,  setAccounts]   = useState<Account[]>([])
  const [customers, setCustomers]  = useState<Customer[]>([])
  const [vendors,   setVendors]    = useState<Vendor[]>([])
  const [assets,    setAssets]     = useState<ActivoFijo[]>([])
  const [saving,    setSaving]     = useState(false)
  const [nuncaVence, setNuncaVence] = useState(true)
  const [currency,  setCurrency]   = useState('GTQ')
  const [centrosCosto, centrosBeneficio] = useCentrosOptions()
  const [loadingRate, setLoadingRate] = useState(false)
  const [rateMeta,    setRateMeta]    = useState<{ effectiveDate: string; source: string } | null>(null)

  const watchCurrency   = Form.useWatch('currency',    form)
  const watchFechaInicio = Form.useWatch('fechaInicio', form)

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  const diferencia  = totalDebit - totalCredit

  const loadMeta = useCallback(async () => {
    const [all, custs, vends, af] = await Promise.allSettled([
      getAccounts({ activas: true }),
      getCustomers({ limit: 500 }),
      getVendors({ limit: 500 }),
      getActivosFijos({ limit: 500 }),
    ])
    if (all.status === 'fulfilled') setAccounts(Array.isArray(all.value) ? all.value : [])
    if (custs.status === 'fulfilled') { const v = custs.value as any; setCustomers(Array.isArray(v) ? v : v?.data ?? []) }
    if (vends.status === 'fulfilled') { const v = vends.value as any; setVendors(Array.isArray(v) ? v : v?.data ?? []) }
    if (af.status   === 'fulfilled') { const v = af.value   as any; setAssets(Array.isArray(v) ? v : v?.data ?? []) }
  }, [])

  const loadPlantilla = useCallback(async () => {
    if (isNew || !id) return
    try {
      const p = await getAsientoRecurrente(id)
      setPlantilla(p)
      const nv = p.nuncaVence !== false
      setNuncaVence(nv)
      form.setFieldsValue({
        nombre: p.nombre, descripcion: p.descripcion, referencia: p.referencia,
        frecuencia: p.frecuencia, diaEjecucion: p.diaEjecucion,
        fechaInicio: p.fechaInicio ? dayjs(p.fechaInicio) : null,
        fechaFin:    p.fechaFin    ? dayjs(p.fechaFin)    : null,
        nuncaVence: nv, autoPublicar: p.autoPublicar, currency: 'GTQ',
      })
      setLines(p.lineas.map(fromPlantilla))
    } catch { message.error('Error al cargar la plantilla') }
  }, [id, isNew, form])

  useEffect(() => { loadMeta() }, [loadMeta])

  useEffect(() => {
    if (!watchCurrency || watchCurrency === 'GTQ') {
      form.setFieldValue('exchangeRate', 1)
      setRateMeta(null)
      return
    }
    const date = watchFechaInicio ? dayjs(watchFechaInicio).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    setLoadingRate(true)
    getExchangeRateForDate(watchCurrency, date)
      .then(r => {
        const rate = r.officialRate ?? (r.rate > 0 ? 1 / r.rate : 1)
        form.setFieldValue('exchangeRate', Number(rate.toFixed(6)))
        setRateMeta({ effectiveDate: r.effectiveDate, source: r.source })
      })
      .catch(() => message.warning('No se pudo cargar el tipo de cambio para la fecha seleccionada'))
      .finally(() => setLoadingRate(false))
  }, [watchCurrency, watchFechaInicio, form])

  useEffect(() => {
    if (desdeDiario) {
      form.setFieldsValue({
        nombre: `Recurrente: ${desdeDiario.description}`,
        descripcion: desdeDiario.description, referencia: desdeDiario.reference,
        frecuencia: 'MENSUAL', diaEjecucion: 1, fechaInicio: dayjs(),
        nuncaVence: true, autoPublicar: false, currency: desdeDiario.currency ?? 'GTQ',
      })
      setNuncaVence(true)
      setCurrency(desdeDiario.currency ?? 'GTQ')
      setLines(desdeDiario.lines.map(fromAsiento))
    } else { loadPlantilla() }
  }, [desdeDiario, loadPlantilla, form])

  const fetchRate = (currencyCode: string) => {
    if (!currencyCode || currencyCode === 'GTQ') return
    const d = form.getFieldValue('fechaInicio') ? dayjs(form.getFieldValue('fechaInicio')).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
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

  const updateLine = (key: string, patch: Partial<LineState>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))

  const setAccount = (key: string, acct: Account) =>
    updateLine(key, {
      accountId: acct.id, accountCode: acct.code, accountName: acct.name,
      accountMeta: { isCustomer: acct.isCustomerAccount, isVendor: acct.isVendorAccount, isFixedAsset: acct.isFixedAsset },
      auxiliarId: '',
    })

  const recalcTax = (key: string, taxCode: string, debit: number | null, credit: number | null) => {
    const base = (debit ?? 0) || (credit ?? 0)
    const rate = TAX_RATES[taxCode] ?? 0
    updateLine(key, { taxCode, taxAmount: rate > 0 ? Math.round(base * rate * 100) / 100 : null })
  }

  const addLine    = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key: string) => { if (lines.length > 2) setLines(prev => prev.filter(l => l.key !== key)) }

  const handleSave = async () => {
    try { await form.validateFields() } catch { return }
    const valid = lines.filter(l => l.accountCode || l.accountId)
    if (valid.length < 1) { message.warning('Al menos una línea con cuenta'); return }
    if (Math.abs(diferencia) > 0.01) { message.warning(`No cuadra — diferencia: Q ${Math.abs(diferencia).toFixed(2)}`); return }

    const vals = form.getFieldsValue()
    const dto = {
      nombre: vals.nombre, descripcion: vals.descripcion || undefined,
      referencia: vals.referencia || undefined, frecuencia: vals.frecuencia,
      diaEjecucion: vals.diaEjecucion ?? 1,
      fechaInicio: vals.fechaInicio?.format('YYYY-MM-DD'),
      fechaFin: nuncaVence ? undefined : vals.fechaFin?.format('YYYY-MM-DD'),
      nuncaVence, autoPublicar: vals.autoPublicar === true,
      lineas: valid.map((l, i) => {
        const base: LineaPlantilla = {
          accountId: l.accountId || undefined, accountCode: l.accountCode,
          accountName: l.accountName, description: l.description || undefined,
          debit: l.debit ?? 0, credit: l.credit ?? 0,
          ...(l.centroCostoId    ? { centroCostoId:    l.centroCostoId }    : {}),
          ...(l.centroBeneficioId ? { centroBeneficioId: l.centroBeneficioId } : {}),
        } as any
        if (l.accountMeta.isCustomer)   (base as any).customerId   = l.auxiliarId || undefined
        if (l.accountMeta.isVendor)     (base as any).vendorId     = l.auxiliarId || undefined
        if (l.accountMeta.isFixedAsset) (base as any).fixedAssetId = l.auxiliarId || undefined
        return base
      }),
    }

    setSaving(true)
    try {
      if (isNew || desdeDiario) {
        await createAsientoRecurrente(dto)
        message.success('Plantilla recurrente creada')
        navigate('/contabilidad/diarios-recurrentes', { replace: true, state: null })
      } else {
        await updateAsientoRecurrente(id!, dto)
        message.success('Plantilla actualizada')
        loadPlantilla()
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const fmtCur = (n: number) =>
    `${currency === 'GTQ' ? 'Q' : currency} ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

  const lineColumns = [
    {
      title: 'Cuenta', width: 210,
      render: (_: any, r: LineState) => (
        <Select size="small" showSearch value={r.accountId || undefined}
          placeholder="Seleccione una cuenta" optionFilterProp="label" style={{ width: '100%' }}
          options={accounts.filter(a => !a.isHeader && a.isActive)
            .map(a => ({ label: `${a.code} - ${a.name}`, value: a.id }))}
          onChange={(v: string) => { const a = accounts.find(x => x.id === v); if (a) setAccount(r.key, a) }}
        />
      ),
    },
    {
      title: 'Descripción', width: 700,
      render: (_: any, r: LineState) => (
        <Input size="small" value={r.description} placeholder="Descripción"
          onChange={e => updateLine(r.key, { description: e.target.value })} />
      ),
    },
    {
      title: 'Auxiliar', width: 200,
      render: (_: any, r: LineState) => {
        const acct       = accounts.find(a => a.id === r.accountId)
        const isCustomer   = r.accountMeta.isCustomer   || !!acct?.isCustomerAccount
        const isVendor     = r.accountMeta.isVendor     || !!acct?.isVendorAccount
        const isFixedAsset = r.accountMeta.isFixedAsset || !!acct?.isFixedAsset
        if (isCustomer) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            placeholder="Cliente" optionFilterProp="label" style={{ width: '100%' }} allowClear
            options={customers.map((c: any) => ({ label: c.displayName ?? c.companyName, value: c.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        if (isVendor) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            placeholder="Proveedor" optionFilterProp="label" style={{ width: '100%' }} allowClear
            options={vendors.map((v: any) => ({ label: v.displayName ?? v.companyName, value: v.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        if (isFixedAsset) return (
          <Select size="small" showSearch value={r.auxiliarId || undefined}
            placeholder="Activo fijo" optionFilterProp="label" style={{ width: '100%' }} allowClear
            options={assets.map(a => ({ label: `${a.assetNumber} - ${a.name}`, value: a.id }))}
            onChange={v => updateLine(r.key, { auxiliarId: v ?? '' })} />
        )
        return <span style={{ color: '#ccc', fontSize: 11, paddingLeft: 8 }}>—</span>
      },
    },
    {
      title: 'Impuesto', width: 145,
      render: (_: any, r: LineState) => (
        <Select size="small" value={r.taxCode || ''} style={{ width: '100%' }} options={TAX_OPTIONS}
          onChange={v => recalcTax(r.key, v, r.debit, r.credit)} />
      ),
    },
    {
      title: 'Dimensiones', width: 300,
      render: (_: any, r: LineState) => (
        <SelectorDimensionesAnaliticas
          layout="compact"
          size="small"
          centrosCosto={centrosCosto}
          centrosBeneficio={centrosBeneficio}
          value={{ centroCostoId: r.centroCostoId, centroBeneficioId: r.centroBeneficioId }}
          onChange={v => updateLine(r.key, { centroCostoId: v.centroCostoId ?? null, centroBeneficioId: v.centroBeneficioId ?? null })}
        />
      ),
    },
    {
      title: 'Débitos', width: 170, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber size="small" style={{ width: '100%' }} min={0} max={99999999.99} precision={2}
          controls={false} value={r.debit} placeholder="0.00"
          formatter={v => v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
          parser={v => v ? (v.replace(/,/g, '') as any) : ''}
          onChange={v => {
            updateLine(r.key, { debit: v, ...(v && v > 0 ? { credit: null } : {}) })
            if (r.taxCode) recalcTax(r.key, r.taxCode, v, null)
          }} />
      ),
    },
    {
      title: 'Créditos', width: 170, align: 'right' as const,
      render: (_: any, r: LineState) => (
        <InputNumber size="small" style={{ width: '100%' }} min={0} max={99999999.99} precision={2}
          controls={false} value={r.credit} placeholder="0.00"
          formatter={v => v != null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
          parser={v => v ? (v.replace(/,/g, '') as any) : ''}
          onChange={v => {
            updateLine(r.key, { credit: v, ...(v && v > 0 ? { debit: null } : {}) })
            if (r.taxCode) recalcTax(r.key, r.taxCode, null, v)
          }} />
      ),
    },
    {
      title: '', width: 36,
      render: (_: any, r: LineState) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          disabled={lines.length <= 2} onClick={() => removeLine(r.key)} />
      ),
    },
  ]

  const pageTitle = desdeDiario
    ? `Nuevo diario recurrente (desde ${desdeDiario.entryNumber})`
    : isNew ? 'Nuevo diario recurrente'
    : plantilla ? `Editar plantilla: ${plantilla.nombre}`
    : 'Cargando...'

  return (
    <div style={{ padding: 24, maxWidth: 1300 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contabilidad/diarios-recurrentes')}>
          Volver
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{pageTitle}</Title>
        {plantilla && <Tag color={plantilla.activo ? 'success' : 'default'}>{plantilla.activo ? 'Activa' : 'Inactiva'}</Tag>}
      </div>

      <Form form={form} layout="vertical" size="small"
        initialValues={{ frecuencia: 'MENSUAL', diaEjecucion: 1, nuncaVence: true, autoPublicar: false, fechaInicio: dayjs(), currency: 'GTQ' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {/* Izquierda */}
          <div>
            <Form.Item label="Nombre del perfil" name="nombre" rules={[{ required: true }]}>
              <Input placeholder="Ej. Honorarios mensuales, Depreciación..." />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Repetir todo (frecuencia)" name="frecuencia" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Semanal', value: 'SEMANAL' }, { label: 'Mensual', value: 'MENSUAL' },
                  { label: 'Bimestral', value: 'BIMESTRAL' }, { label: 'Trimestral', value: 'TRIMESTRAL' },
                  { label: 'Semestral', value: 'SEMESTRAL' }, { label: 'Anual', value: 'ANUAL' },
                ]} />
              </Form.Item>
              <Form.Item label="Día de ejecución" name="diaEjecucion">
                <InputNumber style={{ width: '100%' }} min={1} max={28} />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Comenzar el" name="fechaInicio">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item label="Finaliza el" name="fechaFin">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabled={nuncaVence} />
              </Form.Item>
            </div>
            <Form.Item name="nuncaVence" valuePropName="checked" style={{ marginTop: -8 }}>
              <Checkbox onChange={e => setNuncaVence(e.target.checked)}>Nunca vence</Checkbox>
            </Form.Item>
          </div>

          {/* Derecha */}
          <div>
            <Form.Item label="N.º de referencia" name="referencia">
              <Input placeholder="Referencia para los asientos generados" />
            </Form.Item>
            <Form.Item name="descripcion" hidden><Input /></Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Moneda" name="currency">
                <Select options={CURRENCIES} onChange={v => setCurrency(v)} />
              </Form.Item>
              {currency !== 'GTQ' ? (
                <Form.Item label="Tipo de cambio" name="exchangeRate"
                  extra={rateMeta ? `Tasa del ${dayjs(rateMeta.effectiveDate).format('DD/MM/YYYY')} · ${rateMeta.source}` : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={6}
                    placeholder="0.000000"
                    addonAfter={
                      <Tooltip title="Recargar tasa desde configuración">
                        <ReloadOutlined spin={loadingRate} onClick={() => fetchRate(currency)}
                          style={{ cursor: 'pointer', color: '#1B3A6B' }} />
                      </Tooltip>
                    } />
                </Form.Item>
              ) : (
                <Form.Item label="Método informes" name="reportingMethod">
                  <Select options={[
                    { label: 'Acumulación y efectivo', value: 'ACCRUAL_CASH' },
                    { label: 'Solo devengo', value: 'ACCRUAL' },
                    { label: 'Sólo efectivo', value: 'CASH' },
                  ]} defaultValue="ACCRUAL_CASH" />
                </Form.Item>
              )}
            </div>
            {currency !== 'GTQ' && (
              <Form.Item label="Método informes" name="reportingMethod">
                <Select options={[
                  { label: 'Acumulación y efectivo', value: 'ACCRUAL_CASH' },
                  { label: 'Solo devengo', value: 'ACCRUAL' },
                  { label: 'Sólo efectivo', value: 'CASH' },
                ]} defaultValue="ACCRUAL_CASH" />
              </Form.Item>
            )}
            <Form.Item name="autoPublicar" valuePropName="checked">
              <Checkbox>Publicar automáticamente (sin revisión manual)</Checkbox>
            </Form.Item>
          </div>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        <Table dataSource={lines} columns={lineColumns} rowKey="key"
          size="small" pagination={false} locale={{ emptyText: 'Sin líneas' }} />
        <Button type="dashed" icon={<PlusOutlined />}
          style={{ marginTop: 8, width: '100%' }} onClick={addLine}>
          Añadir nueva fila
        </Button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 20px', color: '#666' }}>Subtotal</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{fmtCur(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right' }}>{fmtCur(totalCredit)}</td>
              </tr>
              <tr style={{ fontWeight: 700, fontSize: 14 }}>
                <td style={{ padding: '4px 20px', borderTop: '1px solid #f0f0f0' }}>Total ({currency})</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{fmtCur(totalDebit)}</td>
                <td style={{ padding: '4px 20px', textAlign: 'right', borderTop: '1px solid #f0f0f0' }}>{fmtCur(totalCredit)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 20px', color: diferencia !== 0 ? '#f5222d' : '#52c41a' }}>Diferencia</td>
                <td colSpan={2} style={{ padding: '4px 20px', textAlign: 'right', color: diferencia !== 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>{fmtCur(Math.abs(diferencia))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Divider style={{ margin: '16px 0' }} />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} style={{ background: '#1B3A6B' }}
            loading={saving} disabled={Math.abs(diferencia) > 0.01} onClick={handleSave}>
            {isNew || desdeDiario ? 'Crear plantilla' : 'Guardar cambios'}
          </Button>
          <Button onClick={() => navigate('/contabilidad/diarios-recurrentes')}>Cancelar</Button>
        </Space>
      </Form>
    </div>
  )
}
