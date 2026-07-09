import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Form, Input, Select, DatePicker, InputNumber, Switch,
  Typography, Divider, Spin, message, Radio, Space, Tag,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { getCustomers, type Customer } from '../../../api/contactos'
import { getTaxes, type Tax } from '../../../api/impuestos'
import LineItemsEditor, { type LineItem, newLineItem, recalc, calcTotals } from '../../../components/DocumentForm/LineItemsEditor'
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

  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [clientes,   setClientes]   = useState<Customer[]>([])
  const [taxes,      setTaxes]      = useState<Tax[]>([])
  const [items,      setItems]      = useState<LineItem[]>([newLineItem()])

  const [frecuencia,   setFrecuencia]   = useState<FrecuenciaRecurrencia>('mensual')
  const [tipoVigencia, setTipoVigencia] = useState<TipoVigencia>('indefinida')
  const [fechaInicio,  setFechaInicio]  = useState<Dayjs>(dayjs())
  const [moneda,       setMoneda]       = useState('GTQ')

  useEffect(() => {
    Promise.all([
      getCustomers({ limit: 200 }),
      getTaxes(),
    ]).then(([cRes, tRes]) => {
      setClientes(cRes?.data ?? cRes ?? [])
      setTaxes(tRes ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    setLoading(true)
    getFacturaRecurrente(id).then(r => {
      form.setFieldsValue({
        clienteId:                 r.clienteId,
        frecuencia:                r.frecuencia,
        tipoVigencia:              r.tipoVigencia,
        fechaInicio:               dayjs(r.fechaInicio),
        fechaFin:                  r.fechaFin ? dayjs(r.fechaFin) : undefined,
        numeroMaximoOcurrencias:   r.numeroMaximoOcurrencias,
        diasAnticipacionGeneracion: r.diasAnticipacionGeneracion,
        moneda:                    r.moneda,
        tipoCambioReferencia:      r.tipoCambioReferencia,
        condicionPago:             r.condicionPago,
        generarFEL:                r.generarFEL,
        felTipoDocumento:          r.felTipoDocumento,
        facturaExenta:             r.facturaExenta,
        notificarClientePorEmail:  r.notificarClientePorEmail,
        observaciones:             r.observaciones,
      })
      setFrecuencia(r.frecuencia)
      setTipoVigencia(r.tipoVigencia)
      setFechaInicio(dayjs(r.fechaInicio))
      setMoneda(r.moneda)
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

  const onFinish = useCallback(async (vals: any) => {
    if (!items.length || items.every(i => !i.description)) {
      message.error('Agrega al menos una línea de detalle')
      return
    }
    setSaving(true)
    try {
      const dto: CrearFacturaRecurrenteDto = {
        clienteId:                 vals.clienteId,
        frecuencia:                vals.frecuencia,
        tipoVigencia:              vals.tipoVigencia,
        fechaInicio:               vals.fechaInicio.format('YYYY-MM-DD'),
        fechaFin:                  vals.tipoVigencia === 'por_fecha_fin' && vals.fechaFin
                                     ? vals.fechaFin.format('YYYY-MM-DD') : undefined,
        numeroMaximoOcurrencias:   vals.tipoVigencia === 'por_numero_ocurrencias'
                                     ? vals.numeroMaximoOcurrencias : undefined,
        diasAnticipacionGeneracion: vals.diasAnticipacionGeneracion ?? 0,
        moneda:                    vals.moneda ?? 'GTQ',
        tipoCambioReferencia:      vals.moneda === 'USD' ? vals.tipoCambioReferencia : undefined,
        condicionPago:             vals.condicionPago,
        generarFEL:                vals.generarFEL ?? true,
        felTipoDocumento:          vals.felTipoDocumento ?? 'FACT',
        facturaExenta:             vals.facturaExenta ?? false,
        notificarClientePorEmail:  vals.notificarClientePorEmail ?? false,
        observaciones:             vals.observaciones,
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
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [items, isEdit, id, navigate])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/facturas-recurrentes')} />
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          {isEdit ? 'Editar plantilla recurrente' : 'Nueva plantilla recurrente'}
        </Title>
      </div>

      <Form form={form} layout="vertical" size="small" onFinish={onFinish}
        initialValues={{ frecuencia: 'mensual', tipoVigencia: 'indefinida', moneda: 'GTQ', generarFEL: true, felTipoDocumento: 'FACT', diasAnticipacionGeneracion: 0 }}>

        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Información general</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="clienteId" label="Cliente" rules={[{ required: true, message: 'Selecciona un cliente' }]}>
              <Select showSearch placeholder="Buscar cliente..." optionFilterProp="label"
                options={clientes.map(c => ({ value: c.id, label: c.name ?? c.legalName }))} />
            </Form.Item>

            <Form.Item name="condicionPago" label="Condición de pago">
              <Select allowClear placeholder="Seleccionar">
                {[['immediate','Pago inmediato'],['net_7','Net 7'],['net_15','Net 15'],['net_30','Net 30'],['net_45','Net 45'],['net_60','Net 60']].map(([v, l]) =>
                  <Select.Option key={v} value={v}>{l}</Select.Option>
                )}
              </Select>
            </Form.Item>

            <Form.Item name="moneda" label="Moneda">
              <Select onChange={setMoneda}>
                <Select.Option value="GTQ">GTQ — Quetzal</Select.Option>
                <Select.Option value="USD">USD — Dólar</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {moneda === 'USD' && (
            <Form.Item name="tipoCambioReferencia" label="Tipo de cambio referencia (Q por $)" rules={[{ required: true, message: 'Requerido para USD' }]} style={{ maxWidth: 280 }}>
              <InputNumber min={0.01} step={0.1} precision={6} style={{ width: '100%' }} placeholder="7.7500" />
            </Form.Item>
          )}

          <Form.Item name="observaciones" label="Observaciones" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} placeholder="Notas internas de la plantilla..." />
          </Form.Item>
        </div>

        {/* ── Recurrencia ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Programación</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="frecuencia" label="Frecuencia" rules={[{ required: true }]}>
              <Select onChange={(v) => setFrecuencia(v)}>
                {FRECUENCIAS.map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="fechaInicio" label="Fecha de inicio" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={(d) => d && setFechaInicio(d)} />
            </Form.Item>

            <Form.Item name="diasAnticipacionGeneracion" label="Días de anticipación">
              <InputNumber min={0} max={30} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Próxima generación estimada: <strong style={{ color: '#1B3A6B' }}>{proximaFecha.format('DD/MM/YYYY')}</strong>
              <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{FRECUENCIA_LABELS[frecuencia]}</Tag>
            </Text>
          </div>

          <Form.Item name="tipoVigencia" label="Vigencia">
            <Radio.Group onChange={(e) => setTipoVigencia(e.target.value)}>
              <Space direction="vertical">
                <Radio value="indefinida">Indefinida — sin límite de tiempo</Radio>
                <Radio value="por_fecha_fin">Hasta una fecha específica</Radio>
                <Radio value="por_numero_ocurrencias">Número máximo de facturas</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {tipoVigencia === 'por_fecha_fin' && (
            <Form.Item name="fechaFin" label="Fecha de fin" rules={[{ required: true, message: 'Indica la fecha de fin' }]} style={{ maxWidth: 220 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(fechaInicio)} />
            </Form.Item>
          )}

          {tipoVigencia === 'por_numero_ocurrencias' && (
            <Form.Item name="numeroMaximoOcurrencias" label="Número máximo de facturas" rules={[{ required: true, message: 'Indica el número máximo' }]} style={{ maxWidth: 220 }}>
              <InputNumber min={1} max={999} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </div>

        {/* ── Líneas de detalle ────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Detalle de la factura</Text>
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
                <Text type="secondary" style={{ fontSize: 12 }}>Subtotal</Text>
                <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(totales.subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>IVA</Text>
                <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(totales.taxAmount)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 16, color: '#1B3A6B', fontFamily: 'monospace' }}>{fmtQ(totales.total)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── FEL y configuración ──────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Facturación electrónica (FEL)</Text>
          <Divider style={{ margin: '10px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px', alignItems: 'center' }}>
            <Form.Item name="generarFEL" label="Emitir FEL automáticamente" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item name="felTipoDocumento" label="Tipo de documento FEL">
              <Select>
                <Select.Option value="FACT">FACT — Factura</Select.Option>
                <Select.Option value="FCAM">FCAM — Factura Cambiaria</Select.Option>
                <Select.Option value="FPEQ">FPEQ — Factura Pequeño Contribuyente</Select.Option>
                <Select.Option value="NABN">NABN — Nota de Abono</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="facturaExenta" label="Factura exenta de IVA" valuePropName="checked">
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
          </div>

          <Form.Item name="notificarClientePorEmail" label="Notificar al cliente por email al generar" valuePropName="checked">
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>
        </div>

        {/* ── Acciones ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/ventas/facturas-recurrentes')}>Cancelar</Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1B3A6B' }}>
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
