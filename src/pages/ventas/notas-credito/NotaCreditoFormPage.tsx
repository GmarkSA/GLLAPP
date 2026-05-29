import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Form, Select, DatePicker, Input, Button, Checkbox,
  Card, Breadcrumb, Typography, Divider, Space, message, Alert, Tag, Tooltip,
} from 'antd'
import {
  SaveOutlined, SendOutlined, HomeOutlined,
  SafetyCertificateOutlined, RollbackOutlined,
  WarningOutlined, CheckCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  createNotaCredito, updateNotaCredito, getNotaCredito, emitirNotaCredito,
  type CreateNotaCreditoDto,
} from '../../../api/notas-credito'
import { getCustomers } from '../../../api/contactos'
import { FEL_TIPOS_FRASE } from '../../../api/facturas'
import { getTaxes, type Tax } from '../../../api/impuestos'
import api from '../../../api/axios'
import LineItemsEditor, {
  type LineItem, newLineItem, calcTotals,
} from '../../../components/DocumentForm/LineItemsEditor'

const { Title, Text } = Typography

const fmt = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const LIMITE_DIAS_NCRE = 60   // SAT Guatemala: max 60 días para NC
const statusLabel: Record<string, string> = {
  draft: 'Borrador', pending: 'Pendiente', sent: 'Emitida',
  partial: 'Pago parcial', paid: 'Pagada', overdue: 'Vencida',
}
const statusColor: Record<string, string> = {
  draft: 'default', pending: 'orange', sent: 'blue',
  partial: 'geekblue', paid: 'green', overdue: 'red',
}

interface CustomerOption { value: string; label: string; commercialName?: string; taxId?: string }
interface InvoiceOption  {
  value: string; label: string
  invoiceDate: string; status: string; total: number; invoiceNumber: string
}

export default function NotaCreditoFormPage() {
  const navigate        = useNavigate()
  const { id: editId }  = useParams<{ id?: string }>()   // presente cuando es edición
  const isEditMode      = !!editId
  const [form]          = Form.useForm()

  const [items,              setItems]              = useState<LineItem[]>([newLineItem()])
  const [taxes,              setTaxes]              = useState<Tax[]>([])
  const [customers,          setCustomers]          = useState<CustomerOption[]>([])
  const [invoiceOptions,     setInvoiceOptions]     = useState<InvoiceOption[]>([])
  const [loadingCustomers,   setLoadingCustomers]   = useState(false)
  const [loadingInvoices,    setLoadingInvoices]    = useState(false)
  const [loadingEdit,        setLoadingEdit]        = useState(isEditMode)
  const [saving,             setSaving]             = useState(false)
  const [emitting,           setEmitting]           = useState(false)
  const [isExenta,           setIsExenta]           = useState(false)
  const [felFrases,          setFelFrases]          = useState<{ tipoFrase: number; codigoEscenario: number }[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedInvoice,    setSelectedInvoice]    = useState<InvoiceOption | null>(null)
  const [docType,            setDocType]            = useState<'NCRE' | 'NABN'>('NCRE')
  const [diasTranscurridos,  setDiasTranscurridos]  = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    getTaxes()
      .then((res: any) => setTaxes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchCustomers('') }, [])

  // ── Cargar datos cuando es modo edición ──────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !editId) return
    setLoadingEdit(true)
    getNotaCredito(editId)
      .then(async (nc) => {
        // Pre-poblar cliente y facturas relacionadas
        setSelectedCustomerId(nc.customerId)
        await fetchInvoices(nc.customerId)

        form.setFieldsValue({
          customerId:       nc.customerId,
          originalInvoiceId: nc.originalInvoiceId,
          invoiceDate:      nc.invoiceDate ? dayjs(nc.invoiceDate) : dayjs(),
          reason:           nc.creditNoteReason ?? '',
          notes:            nc.notes ?? '',
          lugarExpedicion:  nc.lugarExpedicion ?? '',
          facturaExenta:    nc.facturaExenta ?? false,
        })
        setIsExenta(nc.facturaExenta ?? false)
        setDocType((nc.felTipoDocumento as 'NCRE' | 'NABN') ?? 'NCRE')

        if (nc.items?.length) {
          setItems(nc.items.map((it: any) => newLineItem({
            productId:       it.productId,
            description:     it.description,
            unit:            it.unit,
            quantity:        Number(it.quantity),
            unitPrice:       Number(it.unitPrice),
            discountPercent: Number(it.discountPercent ?? 0),
            taxPercent:      Number(it.taxPercent ?? 12),
            taxId:           it.taxId,
            accountId:       it.accountId,
          })))
        }
      })
      .catch(() => message.error('No se pudo cargar la nota de crédito'))
      .finally(() => setLoadingEdit(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const fetchCustomers = (q: string) => {
    setLoadingCustomers(true)
    getCustomers({ search: q || undefined, limit: 50 } as any)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map((c: any) => ({
          value: c.id,
          label: c.legalName ?? c.name,
          commercialName: c.name,
          taxId: c.taxId,
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
  }

  // Carga TODAS las facturas del cliente directamente vía axios (parsing robusto)
  const fetchInvoices = (customerId: string) => {
    setLoadingInvoices(true)
    // Sin filtro de type en el servidor (evita problema con columna ENUM de PostgreSQL)
    api.get('/ventas/facturas', { params: { customerId, limit: 100, page: 1 } })
      .then((r: any) => {
        // TransformInterceptor envuelve: { data: PaginatedResult }
        // PaginatedResult es: { data: [...], meta: {} }
        // → respuesta final: { data: { data: [...], meta: {} } }
        const body = r.data
        let list: any[] = []
        if (Array.isArray(body))                  list = body           // array directo (raro)
        else if (Array.isArray(body?.data?.data)) list = body.data.data // { data: { data:[...] } } ← formato real
        else if (Array.isArray(body?.data))       list = body.data      // { data: [...] }

        console.log('[NC-Form] total rows before filter:', list.length, 'customerId:', customerId)

        // Excluir solo credit_notes y anuladas
        const activas = list.filter(
          (inv: any) => inv.type !== 'credit_note' && inv.status !== 'voided'
        )

        console.log('[NC-Form] rows after filter:', activas.length, activas.map((i: any) => i.invoiceNumber))

        setInvoiceOptions(
          activas.map((inv: any) => ({
            value:         inv.id,
            invoiceDate:   inv.invoiceDate ?? inv.invoice_date ?? '',
            status:        inv.status ?? '',
            total:         Number(inv.total ?? 0),
            invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? '—',
            label:         inv.invoiceNumber ?? inv.invoice_number ?? '—',
          }))
        )
      })
      .catch((err: any) => {
        console.error('[NC-Form] fetchInvoices error:', err?.response?.data ?? err?.message)
      })
      .finally(() => setLoadingInvoices(false))
  }

  const handleCustomerChange = (val: string) => {
    setSelectedCustomerId(val)
    setSelectedInvoice(null)
    setDiasTranscurridos(null)
    setDocType('NCRE')
    setItems([newLineItem()])       // limpiar líneas al cambiar de cliente
    form.setFieldValue('originalInvoiceId', undefined)
    fetchInvoices(val)
  }

  const handleCustomerSearch = (q: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(q), 350)
  }

  // Cuando el usuario selecciona la factura original:
  // 1. Calcula días transcurridos → NCRE o NABN
  // 2. Carga las líneas de la factura y pre-llena el editor de ítems
  const handleInvoiceSelect = async (invId: string) => {
    const inv = invoiceOptions.find(i => i.value === invId) ?? null
    setSelectedInvoice(inv)

    if (!inv) {
      setDiasTranscurridos(null)
      setDocType('NCRE')
      setItems([newLineItem()])
      return
    }

    // Regla 60 días
    const dias = dayjs().diff(dayjs(inv.invoiceDate), 'day')
    setDiasTranscurridos(dias)
    setDocType(dias <= LIMITE_DIAS_NCRE ? 'NCRE' : 'NABN')

    // Cargar líneas de la factura original
    try {
      const r = await api.get(`/ventas/facturas/${invId}`)
      const body = r.data
      // TransformInterceptor: { data: InvoiceEntity }
      const invoice: any = body?.data ?? body

      const originalItems: any[] = Array.isArray(invoice?.items) ? invoice.items : []

      if (originalItems.length > 0) {
        const loaded = originalItems.map((it: any) =>
          newLineItem({
            productId:       it.productId || undefined,
            description:     it.description || '',
            unit:            it.unit || undefined,
            quantity:        Number(it.quantity ?? 1),
            unitPrice:       Number(it.unitPrice ?? 0),
            discountPercent: Number(it.discountPercent ?? 0),
            taxPercent:      Number(it.taxPercent ?? 12),
            taxId:           it.taxId || undefined,
            accountId:       it.accountId || undefined,
          })
        )
        setItems(loaded)
      }
    } catch {
      // Si falla, dejar el editor limpio
      setItems([newLineItem()])
    }
  }

  const buildDto = (): CreateNotaCreditoDto => {
    const vals = form.getFieldsValue()
    return {
      customerId:        vals.customerId,
      originalInvoiceId: vals.originalInvoiceId || undefined,
      invoiceDate:       vals.invoiceDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
      reason:            vals.reason,
      currency:          vals.currency || 'GTQ',
      notes:             vals.notes,
      lugarExpedicion:   vals.lugarExpedicion,
      facturaExenta:     isExenta,
      felTipoDocumento:  docType,
      felFrases,
      items: items.map(it => ({
        productId:       it.productId || undefined,
        description:     it.description,
        unit:            it.unit || undefined,
        quantity:        it.quantity,
        unitPrice:       it.unitPrice,
        discountPercent: it.discountPercent || 0,
        taxPercent:      it.taxPercent || 0,
        taxInclusive:    it.taxInclusive ?? true,
        taxId:           it.taxId || undefined,
        accountId:       it.accountId || undefined,
      })),
    }
  }

  const handleSave = async () => {
    try { await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (isEditMode && editId) {
        const dto = buildDto()
        await updateNotaCredito(editId, { ...dto, items: dto.items })
        message.success('Nota de crédito actualizada')
        navigate(`/ventas/notas-credito/${editId}`)
      } else {
        const nc = await createNotaCredito(buildDto())
        message.success(`${docType} ${nc.invoiceNumber} creada como borrador`)
        navigate(`/ventas/notas-credito/${nc.id}`)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleSaveAndEmit = async () => {
    try { await form.validateFields() } catch { return }
    setSaving(true)
    setEmitting(true)
    try {
      let ncId: string
      if (isEditMode && editId) {
        const dto = buildDto()
        await updateNotaCredito(editId, { ...dto, items: dto.items })
        ncId = editId
      } else {
        const nc = await createNotaCredito(buildDto())
        ncId = nc.id
      }
      const emitted = await emitirNotaCredito(ncId)
      message.success(`${docType} ${emitted.invoiceNumber} emitida exitosamente`)
      navigate(`/ventas/notas-credito/${emitted.id}`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al emitir')
    } finally { setSaving(false); setEmitting(false) }
  }

  const { subtotal, taxAmount, total } = calcTotals(items)

  // ── Alerta regla 60 días ─────────────────────────────────────────────────────
  const renderDiasAlert = () => {
    if (!selectedInvoice || diasTranscurridos === null) return null
    const diasRestantes = LIMITE_DIAS_NCRE - diasTranscurridos

    if (docType === 'NCRE') {
      return (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginTop: 12 }}
          message={
            <span>
              Documento: <Tag color="blue"><b>NCRE — Nota de Crédito</b></Tag>
              Factura emitida hace <b>{diasTranscurridos} días</b>.{' '}
              Te quedan <b style={{ color: '#52c41a' }}>{diasRestantes} días</b> dentro del plazo legal de 60 días.
            </span>
          }
        />
      )
    }

    return (
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginTop: 12 }}
        message={
          <span>
            Documento cambiado a: <Tag color="orange"><b>NABN — Nota de Abono</b></Tag>
          </span>
        }
        description={
          <span>
            La factura <b>{selectedInvoice.invoiceNumber}</b> fue emitida hace{' '}
            <b>{diasTranscurridos} días</b>, superando el límite de{' '}
            <b>60 días</b> establecido por SAT Guatemala para emitir una Nota de Crédito (NCRE).{' '}
            El documento se emitirá como <b>Nota de Abono (NABN)</b> automáticamente.
          </span>
        }
      />
    )
  }

  const isNabn = docType === 'NABN'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/"><HomeOutlined /></Link> },
        { title: <Link to="/ventas/notas-credito">Notas de Crédito</Link> },
        { title: isEditMode ? 'Editar' : 'Nueva' },
      ]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {isEditMode
                ? `Editar ${isNabn ? 'Nota de Abono' : 'Nota de Crédito'}`
                : isNabn ? 'Nueva Nota de Abono' : 'Nueva Nota de Crédito'}
            </Title>
            <Tag color={isNabn ? 'orange' : 'blue'} style={{ fontSize: 12 }}>
              FEL: {docType}
            </Tag>
            {isEditMode && <Tag color="gold">Modo edición</Tag>}
          </div>
          <Text type="secondary">
            {isNabn
              ? 'Nota de abono (NABN) — factura original supera 60 días'
              : 'Nota de crédito (NCRE) — dentro del plazo fiscal de 60 días'}
          </Text>
        </div>
        <Space>
          <Button icon={<RollbackOutlined />} onClick={() => navigate('/ventas/notas-credito')}>
            Cancelar
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving && !emitting}>
            Guardar borrador
          </Button>
          <Button
            type="primary" icon={<SendOutlined />}
            onClick={handleSaveAndEmit}
            loading={saving && emitting}
            style={{ background: isNabn ? '#d46b08' : '#1B3A6B' }}
          >
            Guardar y Emitir FEL ({docType})
          </Button>
        </Space>
      </div>

      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        message="El tipo de documento FEL se determina automáticamente según la fecha de la factura original: NCRE dentro de 60 días, NABN después de 60 días (norma SAT Guatemala)."
      />

      <Form form={form} layout="vertical" initialValues={{ currency: 'GTQ', invoiceDate: dayjs() }}>

        {/* ── Datos principales ────────────────────────────────────────────── */}
        <Card
          title="Datos del documento"
          bordered={false}
          style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="customerId" label="Cliente" rules={[{ required: true, message: 'Selecciona un cliente' }]}>
              <Select
                showSearch filterOption={false}
                placeholder="Buscar por Razón Social o nombre comercial..."
                loading={loadingCustomers}
                onSearch={handleCustomerSearch}
                onChange={handleCustomerChange}
                optionRender={(opt) => {
                  const c = customers.find(x => x.value === opt.value)
                  return (
                    <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                      {c?.commercialName && c.commercialName !== opt.label?.toString() && (
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {c.commercialName}{c.taxId ? ` — ${c.taxId}` : ''}
                        </div>
                      )}
                    </div>
                  )
                }}
                options={customers.map(c => ({ value: c.value, label: c.label }))}
              />
            </Form.Item>

            <Form.Item name="invoiceDate" label="Fecha del documento" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="currency" label="Moneda">
              <Select options={[
                { value: 'GTQ', label: 'GTQ — Quetzal' },
                { value: 'USD', label: 'USD — Dólar' },
              ]} />
            </Form.Item>
          </div>

          {/* ── Selector de factura original ─────────────────────────────── */}
          <Form.Item
            name="originalInvoiceId"
            label={
              <Space>
                <span>Factura original que se acredita</span>
                <Tooltip title="Seleccionar la factura determina automáticamente si el documento será NCRE (≤60 días) o NABN (>60 días)">
                  <InfoCircleOutlined style={{ color: '#888' }} />
                </Tooltip>
              </Space>
            }
          >
            <Select
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder={
                selectedCustomerId
                  ? loadingInvoices
                    ? 'Cargando facturas...'
                    : invoiceOptions.length === 0
                      ? 'No hay facturas emitidas para este cliente'
                      : 'Seleccionar factura...'
                  : 'Selecciona primero un cliente'
              }
              disabled={!selectedCustomerId || loadingInvoices}
              loading={loadingInvoices}
              allowClear
              onChange={handleInvoiceSelect}
              onClear={() => {
                setSelectedInvoice(null)
                setDiasTranscurridos(null)
                setDocType('NCRE')
                setItems([newLineItem()])
              }}
              optionLabelProp="label"
              options={invoiceOptions.map(inv => {
                const dias = dayjs().diff(dayjs(inv.invoiceDate), 'day')
                const enPlazo = dias <= LIMITE_DIAS_NCRE
                return {
                  value: inv.value,
                  label: inv.invoiceNumber,
                  // el dropdown muestra info completa
                  'data-date': inv.invoiceDate,
                  children: undefined,
                }
              })}
              // Render personalizado del dropdown
              optionRender={(opt) => {
                const inv = invoiceOptions.find(i => i.value === opt.value)
                if (!inv) return opt.label
                const dias = dayjs().diff(dayjs(inv.invoiceDate), 'day')
                const enPlazo = dias <= LIMITE_DIAS_NCRE
                const diasRestantes = LIMITE_DIAS_NCRE - dias
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                    <div>
                      <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{inv.invoiceNumber}</Text>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                        {dayjs(inv.invoiceDate).format('DD/MM/YYYY')}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Tag color={statusColor[inv.status] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {statusLabel[inv.status] ?? inv.status}
                      </Tag>
                      <Tag color={enPlazo ? 'green' : 'orange'} style={{ fontSize: 10, margin: 0 }}>
                        {enPlazo
                          ? `${diasRestantes}d para NCRE`
                          : `NABN (${dias}d)`}
                      </Tag>
                      <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmt(inv.total)}</Text>
                    </div>
                  </div>
                )
              }}
            />
          </Form.Item>

          {/* Alerta 60 días */}
          {renderDiasAlert()}

          <div style={{ marginTop: 16 }}>
            <Form.Item
              name="reason"
              label="Motivo del documento"
              rules={[{ required: true, message: 'El motivo es requerido' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder={isNabn
                  ? 'Ej: Ajuste de precio acordado con el cliente'
                  : 'Ej: Devolución de mercadería por defecto de fabricación'}
              />
            </Form.Item>

            <Form.Item name="notes" label="Notas internas">
              <Input.TextArea rows={2} placeholder="Observaciones adicionales..." />
            </Form.Item>
          </div>
        </Card>

        {/* ── Líneas ──────────────────────────────────────────────────────── */}
        <Card
          title={`Líneas del documento (${docType})`}
          bordered={false}
          style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <LineItemsEditor items={items} onChange={setItems} taxes={taxes} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ width: 320 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text type="secondary">Subtotal</Text>
                <Text strong style={{ fontFamily: 'monospace' }}>{fmt(subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text type="secondary">IVA (12%)</Text>
                <Text strong style={{ fontFamily: 'monospace' }}>{fmt(taxAmount)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 15 }}>Total {docType}</Text>
                <Text strong style={{ fontFamily: 'monospace', fontSize: 15, color: isNabn ? '#d46b08' : '#cf1322' }}>
                  {fmt(total)}
                </Text>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Configuración FEL ────────────────────────────────────────────── */}
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: '#1B3A6B' }} />
              <span>Configuración FEL</span>
              <Tag color={isNabn ? 'orange' : 'blue'}>{docType}</Tag>
            </Space>
          }
          bordered={false}
          style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="lugarExpedicion" label="Lugar de Expedición">
              <Input placeholder="Ciudad de Guatemala, Guatemala" />
            </Form.Item>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 30 }}>
              <Checkbox checked={isExenta} onChange={e => setIsExenta(e.target.checked)}>
                Documento exento de IVA
              </Checkbox>
            </div>
          </div>

          <Form.Item label="Frases FEL (opcional)">
            <Select
              mode="multiple"
              placeholder="Seleccionar frases fiscales..."
              style={{ width: '100%' }}
              options={FEL_TIPOS_FRASE.map(f => ({
                value: `${f.tipoFrase}-${f.codigoEscenario}`,
                label: f.label,
              }))}
              onChange={(vals: string[]) =>
                setFelFrases(vals.map(v => {
                  const [t, c] = v.split('-')
                  return { tipoFrase: Number(t), codigoEscenario: Number(c) }
                }))
              }
            />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}
