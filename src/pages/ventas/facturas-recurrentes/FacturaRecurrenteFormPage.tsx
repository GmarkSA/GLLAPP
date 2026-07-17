import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Form, Input, Select, DatePicker, InputNumber, Switch,
  Typography, Divider, Spin, message, Radio, Space, Tag, Checkbox, Card,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, SafetyCertificateOutlined, GlobalOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { getCustomers, getCustomer } from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, { type LineItem, newLineItem, recalc, calcTotals } from '../../../components/DocumentForm/LineItemsEditor'
import {
  FEL_TIPOS_DOCUMENTO, FEL_TIPOS_FRASE, INCOTERMS, type FelFrase,
} from '../../../api/facturas'
import {
  createFacturaRecurrente, updateFacturaRecurrente, getFacturaRecurrente,
  FRECUENCIA_LABELS,
  type CrearFacturaRecurrenteDto, type FrecuenciaRecurrencia, type TipoVigencia,
} from '../../../api/facturas-recurrentes'

const { Text, Title } = Typography
const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const FRECUENCIAS = Object.entries(FRECUENCIA_LABELS) as [FrecuenciaRecurrencia, string][]

function calcularProximaFecha(fechaInicio: Dayjs, frecuencia: FrecuenciaRecurrencia): Dayjs {
  switch (frecuencia) {
    case 'diaria':      return fechaInicio.add(1, 'day')
    case 'semanal':     return fechaInicio.add(1, 'week')
    case 'quincenal':   return fechaInicio.add(15, 'day')
    case 'mensual':     return fechaInicio.add(1, 'month')
    case 'bimestral':   return fechaInicio.add(2, 'month')
    case 'trimestral':  return fechaInicio.add(3, 'month')
    case 'semestral':   return fechaInicio.add(6, 'month')
    case 'anual':       return fechaInicio.add(1, 'year')
  }
}

export default function FacturaRecurrenteFormPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form]   = Form.useForm()
  const isEdit   = Boolean(id)

  const [loading,          setLoading]          = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [customers,        setCustomers]        = useState<{ value: string; label: string }[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [taxes,            setTaxes]            = useState<Tax[]>([])
  const [items,            setItems]            = useState<LineItem[]>([newLineItem()])

  const [frecuencia,   setFrecuencia]   = useState<FrecuenciaRecurrencia>('mensual')
  const [tipoVigencia, setTipoVigencia] = useState<TipoVigencia>('indefinida')
  const [fechaInicio,  setFechaInicio]  = useState<Dayjs>(dayjs())
  const [moneda,       setMoneda]       = useState('GTQ')
  const [felFrases,       setFelFrases]       = useState<FelFrase[]>([])
  const [notificar,       setNotificar]       = useState(false)
  const [emailCliente,    setEmailCliente]    = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fetchCustomers = useCallback((search: string) => {
    setLoadingCustomers(true)
    getCustomers({ search, limit: 20 })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map((c: any) => ({ value: c.id, label: c.legalName ?? c.name ?? '' })))
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
  }, [])

  const handleCustomerSearch = (val: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(val), 300)
  }

  const handleCustomerSelect = async (clienteId: string) => {
    try {
      const cust: any = await getCustomer(clienteId)
      const email = cust?.email ?? ''
      setEmailCliente(email)
      if (notificar && email) form.setFieldValue('emailNotificacion', email)
    } catch { /* silenciar */ }
  }

  useEffect(() => {
    fetchCustomers('')
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [fetchCustomers])

  useEffect(() => {
    if (!isEdit || !id) return
    setLoading(true)
    getFacturaRecurrente(id).then(r => {
      setCustomers([{ value: r.clienteId, label: r.clienteNombre ?? r.clienteId }])
      form.setFieldsValue({
        clienteId:                  r.clienteId,
        frecuencia:                 r.frecuencia,
        tipoVigencia:               r.tipoVigencia,
        fechaInicio:                dayjs(r.fechaInicio),
        fechaFin:                   r.fechaFin ? dayjs(r.fechaFin) : undefined,
        numeroMaximoOcurrencias:    r.numeroMaximoOcurrencias,
        diasAnticipacionGeneracion: r.diasAnticipacionGeneracion,
        moneda:                     r.moneda,
        tipoCambioReferencia:       r.tipoCambioReferencia,
        condicionPago:              r.condicionPago,
        generarFEL:                 r.generarFEL,
        felTipoDocumento:           r.felTipoDocumento,
        facturaExenta:              r.facturaExenta,
        notificarClientePorEmail:   r.notificarClientePorEmail,
        emailNotificacion:          r.emailNotificacion,
        emailAdicionalNotificacion: r.emailAdicionalNotificacion,
        observaciones:              r.observaciones,
        incoterm:                   r.incoterm,
        lugarExpedicion:            r.lugarExpedicion,
        nombreConsignatario:        r.nombreConsignatario,
        direccionConsignatario:     r.direccionConsignatario,
      })
      setFrecuencia(r.frecuencia)
      setTipoVigencia(r.tipoVigencia)
      setFechaInicio(dayjs(r.fechaInicio))
      setMoneda(r.moneda)
      setFelFrases(r.felFrases ?? [])
      setNotificar(r.notificarClientePorEmail ?? false)
      if (r.detalles?.length) {
        setItems(r.detalles.map(d => recalc(newLineItem({
          productId:       d.itemId,
          description:     d.descripcion,
          unit:            d.unidad,
          quantity:        Number(d.cantidad),
          unitPrice:       Number(d.precioUnitario),
          discountPercent: Number(d.descuentoPorcentaje) || 0,
          taxPercent:      Number(d.impuestoPorcentaje) || 12,
          taxId:           d.impuestoId,
          accountId:       d.cuentaContableId,
          taxInclusive:    true,
        }))))
      }
    }).catch(() => message.error('Error al cargar plantilla'))
    .finally(() => setLoading(false))
  }, [id, isEdit, form])

  const proximaFecha = useMemo(() =>
    calcularProximaFecha(fechaInicio, frecuencia),
    [fechaInicio, frecuencia]
  )

  const totales = useMemo(() => calcTotals(items), [items])

  const toggleFrase = (tipoFrase: number, codigoEscenario: number) => {
    setFelFrases(prev => {
      const exists = prev.some(f => f.tipoFrase === tipoFrase && f.codigoEscenario === codigoEscenario)
      return exists
        ? prev.filter(f => !(f.tipoFrase === tipoFrase && f.codigoEscenario === codigoEscenario))
        : [...prev, { tipoFrase, codigoEscenario }]
    })
  }

  const onFinish = useCallback(async (vals: any) => {
    if (!items.length || items.every(i => !i.description)) {
      message.error('Agrega al menos una línea de detalle')
      return
    }
    setSaving(true)
    try {
      const dto: CrearFacturaRecurrenteDto = {
        clienteId:                  vals.clienteId,
        frecuencia:                 vals.frecuencia,
        tipoVigencia:               vals.tipoVigencia,
        fechaInicio:                vals.fechaInicio.format('YYYY-MM-DD'),
        fechaFin:                   vals.tipoVigencia === 'por_fecha_fin' && vals.fechaFin
                                      ? vals.fechaFin.format('YYYY-MM-DD') : undefined,
        diasAnticipacionGeneracion: 0,
        moneda:                     vals.moneda ?? 'GTQ',
        tipoCambioReferencia:       vals.moneda === 'USD' ? vals.tipoCambioReferencia : undefined,
        condicionPago:              vals.condicionPago,
        generarFEL:                 vals.generarFEL ?? true,
        felTipoDocumento:           vals.felTipoDocumento ?? 'FACT',
        facturaExenta:              vals.facturaExenta ?? false,
        felFrases,
        incoterm:                   vals.incoterm || undefined,
        lugarExpedicion:            vals.lugarExpedicion || undefined,
        nombreConsignatario:        vals.nombreConsignatario || undefined,
        direccionConsignatario:     vals.direccionConsignatario || undefined,
        notificarClientePorEmail:   vals.notificarClientePorEmail ?? false,
        emailNotificacion:          vals.notificarClientePorEmail ? (vals.emailNotificacion || undefined) : undefined,
        emailAdicionalNotificacion: vals.notificarClientePorEmail ? (vals.emailAdicionalNotificacion || undefined) : undefined,
        observaciones:              vals.observaciones,
        detalles: items.filter(i => i.description).map((i, idx) => ({
          itemId:              i.productId,
          descripcion:         i.description,
          unidad:              i.unit,
          cantidad:            i.quantity,
          precioUnitario:      i.unitPrice,
          descuentoPorcentaje: i.discountPercent,
          impuestoPorcentaje:  i.taxPercent,
          impuestoId:          i.taxId,
          cuentaContableId:    i.accountId,
          orden:               idx,
        })),
      }

      if (isEdit && id) {
        await updateFacturaRecurrente(id, dto)
        message.success('Plantilla actualizada')
      } else {
        await createFacturaRecurrente(dto)
        message.success('Plantilla creada')
      }
      navigate('/ventas/facturas-recurrentes')
    } catch (e: any) {
      const rawMsg = e?.response?.data?.error?.message ?? e?.response?.data?.message
      const msg = Array.isArray(rawMsg)
        ? rawMsg.join(' | ')
        : (rawMsg ?? e?.message ?? 'Error al guardar')
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }, [items, felFrases, isEdit, id, navigate])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/facturas-recurrentes')} />
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
          {isEdit ? 'Editar plantilla recurrente' : 'Nueva plantilla recurrente'}
        </Title>
      </div>

      <Form form={form} layout="vertical" size="small" onFinish={onFinish}
        initialValues={{ frecuencia: 'mensual', tipoVigencia: 'indefinida', fechaInicio: dayjs(), moneda: 'GTQ', generarFEL: true, felTipoDocumento: 'FACT' }}>

        {/* ── Información general ─────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Información general</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Form.Item name="clienteId" label="Cliente" rules={[{ required: true, message: 'Selecciona un cliente' }]} style={{ flex: '1 1 180px', maxWidth: 380, marginBottom: 0 }}>
              <Select
                showSearch
                placeholder="Buscar por nombre o razón social..."
                filterOption={false}
                options={customers}
                loading={loadingCustomers}
                onSearch={handleCustomerSearch}
                onSelect={handleCustomerSelect}
                notFoundContent={loadingCustomers ? 'Buscando…' : 'Sin resultados'}
              />
            </Form.Item>

            <Form.Item name="felTipoDocumento" label="Tipo de Documento" rules={[{ required: true }]} style={{ width: 260, marginBottom: 0 }}>
              <Select options={FEL_TIPOS_DOCUMENTO} placeholder="FACT" />
            </Form.Item>

            <Form.Item name="moneda" label="Moneda" style={{ width: 140, marginBottom: 0 }}>
              <Select onChange={setMoneda}>
                <Select.Option value="GTQ">GTQ — Quetzal</Select.Option>
                <Select.Option value="USD">USD — Dólar</Select.Option>
              </Select>
            </Form.Item>

            {moneda === 'USD' && (
              <Form.Item name="tipoCambioReferencia" label="T/C" rules={[{ required: true, message: 'Requerido' }]} style={{ width: 150, marginBottom: 0 }}>
                <InputNumber min={0.01} step={0.1} precision={6} style={{ width: '100%' }} placeholder="7.7500" controls={false} />
              </Form.Item>
            )}
          </div>
        </div>

        {/* ── Programación ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Programación</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="frecuencia" label="Frecuencia" rules={[{ required: true }]}>
              <Select onChange={(v) => setFrecuencia(v)}>
                {FRECUENCIAS.map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="fechaInicio" label="Fecha de inicio" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={(d) => d && setFechaInicio(d)} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={{ paddingBottom: 5 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Próx. generación: <strong style={{ color: '#1faec2' }}>{proximaFecha.format('DD/MM/YYYY')}</strong>
                <Tag color="#1faec2" style={{ marginLeft: 6, fontSize: 11 }}>{FRECUENCIA_LABELS[frecuencia]}</Tag>
              </Text>
            </div>

            <Form.Item name="tipoVigencia" label="Vigencia" style={{ marginBottom: 0 }}>
              <Radio.Group onChange={(e) => setTipoVigencia(e.target.value)}>
                <Radio value="indefinida">Indefinida</Radio>
                <Radio value="por_fecha_fin">Hasta una fecha</Radio>
              </Radio.Group>
            </Form.Item>

            {tipoVigencia === 'por_fecha_fin' && (
              <Form.Item name="fechaFin" label="Fecha de fin" rules={[{ required: true, message: 'Indica la fecha de fin' }]} style={{ marginBottom: 0, minWidth: 160 }}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(fechaInicio)} />
              </Form.Item>
            )}
          </div>
        </div>

        {/* ── Detalle de la factura ────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Detalle de la factura</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <LineItemsEditor
            items={items}
            taxes={taxes}
            onChange={setItems}
            docType="invoice"
            currency={moneda}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 260, background: '#f8f9fb', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Subtotal (base)</Text>
                <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(totales.subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>IVA (impuesto)</Text>
                <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(totales.taxAmount)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 14 }}>Total factura</Text>
                <Text strong style={{ fontSize: 16, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>{fmtQ(totales.total)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── FEL — Factura Electrónica ───────────────────────────────── */}
        <Card
          size="small"
          style={{ borderColor: '#d6e4ff', marginBottom: 16 }}
          styles={{ header: { background: '#fafbfc', borderBottom: '1px solid #d6e4ff', minHeight: 36 }, body: { padding: '10px 14px 4px' } }}
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: '#1faec2', fontSize: 13 }} />
              <span style={{ color: '#1faec2', fontWeight: 600, fontSize: 13 }}>
                Datos FEL — Factura Electrónica SAT Guatemala
              </span>
              <Tag color="#1faec2" style={{ fontSize: 10 }}>SAT</Tag>
            </Space>
          }
        >
          {/* Emitir FEL + Notificar + emails en la misma fila */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
            <Form.Item name="generarFEL" label="Emitir FEL automáticamente" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item name="notificarClientePorEmail" label="Notificar al cliente" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch
                checkedChildren="Sí" unCheckedChildren="No"
                onChange={(v) => {
                  setNotificar(v)
                  if (v && emailCliente && !form.getFieldValue('emailNotificacion')) {
                    form.setFieldValue('emailNotificacion', emailCliente)
                  }
                }}
              />
            </Form.Item>

            {notificar && (
              <>
                <Form.Item
                  name="emailNotificacion"
                  label="Para (correo cliente)"
                  rules={[{ type: 'email', message: 'Correo inválido' }]}
                  style={{ marginBottom: 0, minWidth: 220 }}
                >
                  <Input placeholder={emailCliente || 'correo@cliente.com'} size="small" />
                </Form.Item>
                <Form.Item
                  name="emailAdicionalNotificacion"
                  label="CC (adicional)"
                  rules={[{ type: 'email', message: 'Correo inválido' }]}
                  style={{ marginBottom: 0, minWidth: 200 }}
                >
                  <Input placeholder="otro@correo.com" size="small" />
                </Form.Item>
              </>
            )}
          </div>

          {/* Frases SAT */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, paddingBottom: 8 }}>
            <Form.Item name="facturaExenta" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Exenta de IVA</Checkbox>
            </Form.Item>
            <Divider type="vertical" style={{ height: 18, margin: '0 4px' }} />
            {FEL_TIPOS_FRASE.map((f) => {
              const active = felFrases.some(x => x.tipoFrase === f.tipoFrase && x.codigoEscenario === f.codigoEscenario)
              return (
                <Tag
                  key={`${f.tipoFrase}-${f.codigoEscenario}`}
                  color={active ? '#1faec2' : 'default'}
                  style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 11 }}
                  onClick={() => toggleFrase(f.tipoFrase, f.codigoEscenario)}
                >
                  {active ? '✓ ' : ''}{f.label}
                </Tag>
              )
            })}
          </div>

          {/* Exportación / Consignación */}
          <div style={{ borderTop: '1px dashed rgba(10,10,10,0.08)', paddingTop: 8, marginTop: 2 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500, letterSpacing: '.02em' }}>
              EXPORTACIÓN / CONSIGNACIÓN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '0 12px' }}>
              <Form.Item name="incoterm" label="INCOTERM" style={{ marginBottom: 8 }}>
                <Select allowClear placeholder="Comercio exterior" options={INCOTERMS} />
              </Form.Item>
              <Form.Item name="lugarExpedicion" label="Lugar de Expedición" style={{ marginBottom: 8 }}>
                <Input placeholder="Ciudad de Guatemala, Guatemala" />
              </Form.Item>
              <Form.Item name="nombreConsignatario" label="Consignatario" style={{ marginBottom: 8 }}>
                <Input placeholder="Nombre del consignatario" />
              </Form.Item>
              <Form.Item name="direccionConsignatario" label="Dirección Consignatario" style={{ marginBottom: 8 }}>
                <Input placeholder="Dirección destino" prefix={<GlobalOutlined style={{ color: '#6b7280' }} />} />
              </Form.Item>
            </div>
          </div>
        </Card>

        {/* ── Observaciones ────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Form.Item name="observaciones" label="Observaciones" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} placeholder="Notas internas de la plantilla..." />
          </Form.Item>
        </div>

        {/* ── Acciones ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/ventas/facturas-recurrentes')}>Cancelar</Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1faec2' }}>
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
