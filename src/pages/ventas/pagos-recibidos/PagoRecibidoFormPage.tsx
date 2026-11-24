import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Select, DatePicker, InputNumber, Input, Button, Typography,
  Space, Breadcrumb, message, Tag, Row, Col, Spin, Radio, Table, Alert, Checkbox,
} from 'antd'
import {
  DollarOutlined, SaveOutlined, ArrowLeftOutlined, ThunderboltOutlined,
  DeleteOutlined, InfoCircleOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { createPagoRecibido, type PaymentMode, PAYMENT_MODE_LABELS } from '../../../api/pagos-recibidos'
import { getInvoices, type Invoice } from '../../../api/facturas'
import { getCustomers } from '../../../api/contactos'
import { getBankAccounts, type BankAccount } from '../../../api/bancos'
import AccountSelect from '../../../components/AccountSelect'
import { getAccountDefaults } from '../../../api/compras'
import { getAccounts } from '../../../api/catalogo'
import { getExchangeRateForDate } from '../../../api/monedas'
import { esLocal, fmtQ, fmtMoneda, monedaDeLosDocumentos } from '../../../utils/moneda'

const { Title, Text } = Typography
const { Option } = Select

const r2 = (n: number) => Math.round(n * 100) / 100

/** La forma de pago en la que el procesador se queda una comisión. */
const MODO_TARJETA = 'credit_card'
interface Customer { id: string; name: string; legalName?: string; taxId?: string; currency?: string }

export default function PagoRecibidoFormPage() {
  const navigate   = useNavigate()
  const [form]     = Form.useForm()

  const [saving,       setSaving]       = useState(false)
  const [isAdvance,    setIsAdvance]    = useState(false)
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [loadingCust,  setLoadingCust]  = useState(false)
  const [selectedCust, setSelectedCust] = useState<string | null>(null)
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([])

  /**
   * La moneda del cobro sale de las facturas que se están pagando: cobrar una
   * factura en dólares es recibir dólares. Esta pantalla mandaba
   * `currency: 'GTQ'` fijo, así que ese cobro quedaba guardado como quetzales
   * con tasa 1 — la cifra correcta con la moneda equivocada.
   */
  const [tasaDelCobro, setTasaDelCobro] = useState<number>(1)
  const [tasaMeta,     setTasaMeta]     = useState<{ effectiveDate: string; source: string } | null>(null)
  const [cargandoTasa, setCargandoTasa] = useState(false)
  const [editandoTasa, setEditandoTasa] = useState(false)
  const [loadingInv,   setLoadingInv]   = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isrEnabled,   setIsrEnabled]   = useState(false)
  const [isrAmount,    setIsrAmount]    = useState<number>(0)
  /**
   * La comisión que se queda el procesador de la tarjeta. Solo aparece con
   * tarjeta de crédito: el banco deposita menos de lo facturado y esa
   * diferencia es un gasto, no un saldo que el cliente siga debiendo.
   */
  const [comision,       setComision]       = useState<number>(0)
  const [comisionCuenta, setComisionCuenta] = useState<string | undefined>()
  const [esTarjeta,      setEsTarjeta]      = useState(false)
  // allocations: invoiceId → amount to apply
  const [allocations,  setAllocations]  = useState<Record<string, number>>({})
  const [totalAmount,  setTotalAmount]  = useState<number | null>(null)
  const [autoAnticipo, setAutoAnticipo] = useState(true)   // auto-create advance for excess
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /**
   * El temporizador de la búsqueda se apaga al salir de la pantalla.
   *
   * Quedaba corriendo: si alguien escribía en el buscador y cerraba la
   * pantalla antes de los 300 ms, el temporizador disparaba la consulta y su
   * respuesta guardaba estado en un componente que ya no existe. En el
   * navegador es un desperdicio silencioso; en las pruebas tumbó el CI dos
   * veces —el trabajo que React agendaba llegaba cuando el entorno ya estaba
   * desmontado: «ReferenceError: window is not defined»—.
   */
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // ── Customers ─────────────────────────────────────────────────────────────
  const fetchCustomers = (search: string) => {
    setLoadingCust(true)
    getCustomers({ limit: 100, search: search || undefined })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
        setCustomers(list.map(c => ({ id: c.id, name: c.name, legalName: c.legalName, taxId: c.taxId })))
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCust(false))
  }

  useEffect(() => { fetchCustomers('') }, [])

  // ── Bank accounts ─────────────────────────────────────────────────────────
  useEffect(() => {
    getBankAccounts({ status: 'active' })
      .then((res: any) => setBankAccounts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setBankAccounts([]))
  }, [])

  // ── Open invoices when customer changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedCust) { setOpenInvoices([]); setAllocations({}); return }
    setLoadingInv(true)
    getInvoices({ customerId: selectedCust, limit: 200 })
      .then(res => {
        const open = (res.data ?? [])
          .filter(inv => ['sent', 'partial', 'overdue'].includes(inv.status) && Number(inv.balance) > 0)
          .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime())
        setOpenInvoices(open)
        setAllocations({})
      })
      .catch(() => setOpenInvoices([]))
      .finally(() => setLoadingInv(false))
  }, [selectedCust])

  // ── Auto-distribute oldest-first ─────────────────────────────────────────
  const autoDistribute = useCallback((amount: number, saldarCompletas = false) => {
    let remaining = r2(amount)
    const newAlloc: Record<string, number> = {}
    for (const inv of openInvoices) {
      if (remaining <= 0) { newAlloc[inv.id] = 0; continue }
      const bal   = r2(Number(inv.balance))
      /**
       * Con tarjeta la factura se salda COMPLETA aunque el banco haya
       * depositado menos: lo que falta es la comisión del procesador, no un
       * saldo que el cliente siga debiendo. Sin esto, escribir Q140 de una
       * factura de Q150 aplicaba Q140 y dejaba Q10 colgando.
       */
      const apply = saldarCompletas ? bal : r2(Math.min(remaining, bal))
      newAlloc[inv.id] = apply
      remaining = r2(remaining - apply)
    }
    setAllocations(newAlloc)
  }, [openInvoices])

  /** Las facturas con importe aplicado; de ellas sale la moneda del cobro. */
  const facturasAplicadas = openInvoices.filter(inv => (allocations[inv.id] ?? 0) > 0)
  const clienteElegido    = customers.find(c => c.id === selectedCust)
  const { moneda: monedaDelCobro, mezcla: monedasMezcladas } = monedaDeLosDocumentos(
    isAdvance ? [] : facturasAplicadas,
    clienteElegido?.currency ?? 'GTQ',
  )
  const cobroEnDivisa = !esLocal(monedaDelCobro)
  const simboloCobro  = cobroEnDivisa ? monedaDelCobro : 'Q'
  /** Todo monto de esta pantalla está en la moneda del cobro. */
  const m = (n: unknown) => fmtMoneda(n, monedaDelCobro)

  /**
   * La tasa del día del cobro, de Banguat.
   *
   * La cuenta por cobrar se descarga al tipo de cambio de la FACTURA —es su
   * valor en libros— y lo que entra al banco se registra a la tasa del día;
   * la diferencia es el diferencial cambiario. Esa lógica ya está en el
   * servidor, pero nunca se activaba porque esta pantalla no mandaba tasa.
   */
  const fechaDelPago = Form.useWatch('paymentDate', form)
  useEffect(() => {
    if (!cobroEnDivisa) { setTasaDelCobro(1); setTasaMeta(null); return }
    const fecha = fechaDelPago
      ? dayjs(fechaDelPago).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    setCargandoTasa(true)
    getExchangeRateForDate(monedaDelCobro, fecha)
      .then((r: any) => {
        const tasa = r.officialRate ?? (r.rate > 0 ? 1 / r.rate : 1)
        setTasaDelCobro(Number(Number(tasa).toFixed(6)))
        setTasaMeta({ effectiveDate: r.effectiveDate, source: r.source })
      })
      .catch(() => message.warning(`No se pudo cargar el tipo de cambio de ${monedaDelCobro} para esa fecha`))
      .finally(() => setCargandoTasa(false))
  }, [cobroEnDivisa, monedaDelCobro, fechaDelPago])

  const clearAllocations = () => {
    setAllocations(Object.fromEntries(openInvoices.map(inv => [inv.id, 0])))
  }

  // derived totals
  const totalApplied  = r2(Object.values(allocations).reduce((s, v) => s + (v || 0), 0))
  const totalReceived = totalAmount ?? 0
  /**
   * Con tarjeta, a la factura se le abona MÁS de lo que entró al banco: la
   * comisión que se quedó el procesador también la salda. Por eso el cuadre no
   * es «recibido − aplicado» sino «recibido + comisión − aplicado».
   */
  const difference    = r2(totalReceived + comision - totalApplied)

  /**
   * La comisión no se escribe a mano: es lo que falta entre lo aplicado a las
   * facturas y lo que de verdad entró al banco. Se recalcula sola y el usuario
   * puede corregirla si el procesador cobró otra cosa.
   */
  useEffect(() => {
    if (!esTarjeta) return
    const falta = r2(totalApplied - totalReceived - (isrEnabled ? isrAmount : 0))
    setComision(Math.max(0, falta))
  }, [esTarjeta, totalApplied, totalReceived, isrEnabled, isrAmount])

  /** La cuenta de gasto configurada en Cuentas por defecto, ya elegida. */
  useEffect(() => {
    if (!esTarjeta || comisionCuenta) return
    let vivo = true
    ;(async () => {
      const codigo = (await getAccountDefaults().catch(() => ({} as any))).cardCommissionAccountCode
      if (!codigo || !vivo) return
      const cuentas: any = await getAccounts({ activas: true }).catch(() => [])
      const lista = Array.isArray(cuentas) ? cuentas : (cuentas?.data ?? [])
      const cuenta = lista.find((c: any) => String(c.code) === String(codigo))
      if (cuenta && vivo) setComisionCuenta(cuenta.id)
    })()
    return () => { vivo = false }
  }, [esTarjeta, comisionCuenta])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await form.validateFields(['customerId', 'paymentDate'])
    } catch { return }

    if (isAdvance) {
      // Anticipo — flujo simple existente
      try { await form.validateFields(['amount']) } catch { return }
      setSaving(true)
      try {
        const vals        = form.getFieldsValue()
        const paymentDate = (vals.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD')
        const accountingDate = vals.accountingDate ? (vals.accountingDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined
        const pago = await createPagoRecibido({
          customerId:    selectedCust!,
          paymentDate, accountingDate,
          amount:        vals.amount,
          mode:          vals.mode as PaymentMode,
          reference:     vals.reference || undefined,
          bankAccountId: vals.bankAccountId || undefined,
          notes:         vals.notes || undefined,
          currency:      monedaDelCobro,
          exchangeRate:  cobroEnDivisa ? tasaDelCobro : 1,
          isAdvance:     true as const,
        })
        message.success(`Anticipo ${pago.paymentNumber} registrado`)
        navigate(`/ventas/pagos-recibidos/${pago.id}`)
      } catch (e: any) {
        const raw = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al registrar anticipo'
        message.error(Array.isArray(raw) ? raw.join(' | ') : raw, 8)
      } finally { setSaving(false) }
      return
    }

    // Multi-invoice payment
    const invoicesToPay = openInvoices.filter(inv => (allocations[inv.id] ?? 0) > 0)
    if (invoicesToPay.length === 0) {
      message.error('Aplica al menos un importe a una factura antes de guardar')
      return
    }
    if (!form.getFieldValue('bankAccountId')) {
      message.error('Selecciona una cuenta bancaria para registrar el efectivo recibido')
      return
    }
    /**
     * Un mismo depósito no puede ser en dos monedas a la vez: si las facturas
     * elegidas no coinciden, se dice en vez de elegir una por cuenta propia.
     */
    if (monedasMezcladas) {
      message.error('Las facturas elegidas están en monedas distintas. Haz un cobro por cada moneda.', 8)
      return
    }

    setSaving(true)
    try {
      const vals           = form.getFieldsValue()
      const paymentDate    = (vals.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD')
      const accountingDate = vals.accountingDate ? (vals.accountingDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined
      const baseDto = {
        customerId:    selectedCust!,
        paymentDate, accountingDate,
        mode:          vals.mode as PaymentMode,
        reference:     vals.reference || undefined,
        bankAccountId: vals.bankAccountId || undefined,
        notes:         vals.notes || undefined,
        currency:      monedaDelCobro,
        exchangeRate:  cobroEnDivisa ? tasaDelCobro : 1,
        ...(isrEnabled && isrAmount > 0 ? { isrRetentionAmount: isrAmount } : {}),
        ...(comision > 0 && comisionCuenta ? { commissionAccountId: comisionCuenta } : {}),
      }

      /**
       * La comisión es UNA sola del depósito, pero cada factura se cobra por
       * separado: se reparte en proporción a lo aplicado y la última absorbe
       * el centavo del redondeo, para que la suma dé exacto.
       */
      const repartoComision = (() => {
        if (comision <= 0) return {} as Record<string, number>
        const porFactura: Record<string, number> = {}
        let repartido = 0
        invoicesToPay.forEach((inv, i) => {
          const parte = i === invoicesToPay.length - 1
            ? r2(comision - repartido)
            : r2(comision * (allocations[inv.id] ?? 0) / (totalApplied || 1))
          porFactura[inv.id] = parte
          repartido = r2(repartido + parte)
        })
        return porFactura
      })()

      const results = []
      for (const inv of invoicesToPay) {
        const suComision = repartoComision[inv.id] ?? 0
        const pago = await createPagoRecibido({
          ...baseDto,
          invoiceId: inv.id,
          // Al banco entra lo aplicado MENOS su parte de comisión: esa parte
          // nunca llegó a la cuenta.
          amount: r2((allocations[inv.id] ?? 0) - suComision),
          ...(suComision > 0 ? { commissionAmount: suComision } : {}),
        })
        results.push(pago)
      }

      // Si hay excedente y el usuario optó por registrarlo como anticipo
      let advanceNumber: string | undefined
      if (autoAnticipo && difference > 0.009 && baseDto.bankAccountId) {
        try {
          const adv = await createPagoRecibido({ ...baseDto, amount: difference, isAdvance: true })
          advanceNumber = (adv as any).advanceNumber ?? (adv as any).paymentNumber
        } catch (advErr: any) {
          message.warning(`Pagos registrados, pero no se pudo crear el anticipo por el excedente: ${advErr?.response?.data?.message ?? 'Error'}`)
        }
      }

      if (advanceNumber) {
        message.success(`Pago registrado. Excedente de ${m(difference)} registrado como anticipo ${advanceNumber}`)
      } else if (results.length === 1) {
        message.success(`Pago ${results[0].paymentNumber} registrado correctamente`)
      } else {
        message.success(`${results.length} pagos registrados correctamente`)
      }

      if (results.length === 1 && !advanceNumber) {
        navigate(`/ventas/pagos-recibidos/${results[0].id}`)
      } else {
        navigate('/ventas/pagos-recibidos')
      }
    } catch (e: any) {
      const raw = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al registrar pago'
      message.error(Array.isArray(raw) ? raw.join(' | ') : raw, 8)
    } finally { setSaving(false) }
  }

  // ── Invoice table columns ─────────────────────────────────────────────────
  const paymentDate = form.getFieldValue('paymentDate') as dayjs.Dayjs | undefined

  const invColumns = [
    {
      title: 'FECHA',
      dataIndex: 'invoiceDate',
      width: 110,
      render: (v: string, r: Invoice) => (
        <div>
          <div style={{ fontSize: 12 }}>{dayjs(v).format('DD MMM YYYY')}</div>
          {r.dueDate && (
            <div style={{ fontSize: 10, color: '#9ca3af' }}>
              Fecha de vencimiento: {dayjs(r.dueDate).format('DD MMM YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'NÚMERO DE FACTURA',
      dataIndex: 'invoiceNumber',
      width: 150,
      render: (v: string, r: Invoice) => (
        <div>
          <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: '#1faec2' }}>{v}</Text>
          {r.status === 'overdue' && (
            <Tag color="error" style={{ fontSize: 10, marginLeft: 4 }}>Vencida</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'IMPORTE DE LA FACTURA',
      dataIndex: 'total',
      width: 150,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m(v)}</Text>,
    },
    {
      title: 'IMPORTE ADEUDADO',
      dataIndex: 'balance',
      width: 140,
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: Number(v) > 0 ? '#fa541c' : '#2ea172' }}>
          {m(v)}
        </Text>
      ),
    },
    {
      title: 'PAGO RECIBIDO EL',
      width: 140,
      align: 'center' as const,
      render: () => (
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {paymentDate ? paymentDate.format('DD MMM YYYY') : '—'}
        </Text>
      ),
    },
    {
      title: 'PAGO',
      width: 160,
      align: 'right' as const,
      render: (_: any, r: Invoice) => {
        const val = allocations[r.id] ?? 0
        return (
          <div style={{ textAlign: 'right' }}>
            <InputNumber
              value={val || undefined}
              min={0}
              max={Number(r.balance)}
              precision={2}
              prefix={simboloCobro}
              size="small"
              style={{ width: 130 }}
              placeholder="0.00"
              onChange={v => {
                const newVal = r2(Math.min(v ?? 0, Number(r.balance)))
                setAllocations(prev => ({ ...prev, [r.id]: newVal }))
              }}
            />
            <div style={{ marginTop: 2 }}>
              <Button
                type="link"
                size="small"
                style={{ fontSize: 11, padding: 0, color: '#1faec2' }}
                onClick={() => setAllocations(prev => ({ ...prev, [r.id]: r2(Number(r.balance)) }))}
              >
                Pagar el total
              </Button>
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: 'Ventas' },
          { title: <a onClick={() => navigate('/ventas/pagos-recibidos')}>Pagos recibidos</a> },
          { title: 'Nuevo pago' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Registrar Pago Recibido</Title>
            <Text type="secondary">
              {isAdvance ? 'Anticipo de cliente — sin factura asociada' : 'El importe se distribuye automáticamente en las facturas más antiguas'}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/pagos-recibidos')}>
            Volver
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} style={{ background: '#1faec2' }}>
            Registrar pago
          </Button>
        </Space>
      </div>

      {/* Form card */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ paymentDate: dayjs(), accountingDate: dayjs(), currency: 'GTQ' }}>

          {/* Tipo de pago */}
          <Form.Item label="Tipo de pago" style={{ marginBottom: 16 }}>
            <Radio.Group
              value={isAdvance ? 'advance' : 'invoice'}
              onChange={e => {
                const adv = e.target.value === 'advance'
                setIsAdvance(adv)
                setIsrEnabled(false); setIsrAmount(0)
                setAllocations({})
                form.setFieldsValue({ amount: undefined })
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="invoice">Pago a factura(s)</Radio.Button>
              <Radio.Button value="advance">Anticipo (sin factura)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16}>
            {/* Cliente */}
            <Col xs={24} md={8}>
              <Form.Item name="customerId" label="Cliente" rules={[{ required: true, message: 'Selecciona el cliente' }]}>
                <Select
                  showSearch
                  placeholder="Buscar cliente por nombre o NIT..."
                  loading={loadingCust}
                  filterOption={false}
                  onSearch={(val) => {
                    clearTimeout(debounceRef.current)
                    debounceRef.current = setTimeout(() => fetchCustomers(val), 300)
                  }}
                  onChange={(val) => {
                    setSelectedCust(val)
                    setAllocations({})
                    setTotalAmount(null)
                    form.setFieldsValue({ amount: undefined })
                  }}
                  notFoundContent={loadingCust ? <Spin size="small" /> : 'Sin resultados'}
                  options={customers.map(c => ({ value: c.id, label: c.legalName ?? c.name }))}
                  optionRender={(opt) => {
                    const c = customers.find(x => x.id === opt.value)
                    const displayName = c?.legalName ?? c?.name ?? ''
                    const commercial  = c?.name !== displayName ? c?.name : undefined
                    return (
                      <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
                        {(commercial || c?.taxId) && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {commercial}{commercial && c?.taxId ? ' — ' : ''}{c?.taxId}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
              </Form.Item>
            </Col>

            {/* Fecha de pago */}
            <Col xs={12} md={4}>
              <Form.Item name="paymentDate" label="Fecha de pago" rules={[{ required: true, message: 'Selecciona la fecha' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={() => form.validateFields(['paymentDate'])} />
              </Form.Item>
            </Col>

            {/* Fecha de contabilización */}
            <Col xs={12} md={4}>
              <Form.Item name="accountingDate" label="Fecha contabiliz." tooltip="Período contable en el que se registra la póliza.">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            {/* Importe recibido */}
            <Col xs={24} md={8}>
              <Form.Item
                name={isAdvance ? 'amount' : undefined}
                label={isAdvance ? 'Monto del anticipo' : 'Importe recibido'}
                rules={isAdvance ? [
                  { required: true, message: 'Ingresa el monto' },
                  { validator: (_, v) => v > 0 ? Promise.resolve() : Promise.reject('Debe ser mayor a 0') },
                ] : []}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  <InputNumber
                    value={isAdvance ? undefined : totalAmount ?? undefined}
                    style={{ flex: 1 }}
                    prefix={simboloCobro}
                    precision={2}
                    min={0}
                    placeholder="0.00"
                    onChange={v => {
                      if (isAdvance) {
                        form.setFieldValue('amount', v)
                      } else {
                        setTotalAmount(v)
                        if (v && v > 0) autoDistribute(v, esTarjeta)
                        else clearAllocations()
                      }
                    }}
                  />
                  {!isAdvance && (
                    <Button
                      icon={<ThunderboltOutlined />}
                      title="Distribuir automáticamente en facturas más antiguas"
                      onClick={() => { if (totalAmount && totalAmount > 0) autoDistribute(totalAmount, esTarjeta) }}
                      disabled={!totalAmount || totalAmount <= 0 || openInvoices.length === 0}
                    />
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* Forma de pago */}
            <Col xs={12} md={6}>
              <Form.Item name="mode" label="Forma de pago">
                <Select
                  placeholder="Seleccionar..."
                  onChange={(v: string) => {
                    const tarjeta = v === MODO_TARJETA
                    setEsTarjeta(tarjeta)
                    if (!tarjeta) { setComision(0); setComisionCuenta(undefined); return }
                    // Con lo ya escrito, rehacer el reparto saldando completas.
                    if (totalAmount && totalAmount > 0) autoDistribute(totalAmount, true)
                  }}
                >
                  {(Object.entries(PAYMENT_MODE_LABELS) as [PaymentMode, string][]).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Cuenta bancaria */}
            <Col xs={12} md={6}>
              <Form.Item name="bankAccountId" label="Cuenta bancaria destino">
                <Select allowClear placeholder="Seleccionar cuenta">
                  {bankAccounts.map((ba: any) => (
                    <Option key={ba.id} value={ba.id}>
                      {ba.name}{ba.bankName ? ` — ${ba.bankName}` : ''}{ba.accountNumber ? ` (${ba.accountNumber})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Referencia */}
            <Col xs={12} md={6}>
              <Form.Item name="reference" label="N.º de referencia">
                <Input placeholder="N° cheque, transferencia..." />
              </Form.Item>
            </Col>

            {/* Notas */}
            <Col xs={12} md={6}>
              <Form.Item name="notes" label="Notas internas">
                <Input placeholder="Observaciones..." />
              </Form.Item>
            </Col>
          </Row>

          {/*
            * Tarjeta de crédito: el procesador deposita menos de lo facturado.
            * Sin esto, aplicar lo depositado deja la factura con saldo que el
            * cliente ya pagó, y aplicar el total descuadra el banco.
            */}
          {!isAdvance && esTarjeta && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 10 }}>
                Escribe arriba <strong>lo que de verdad entró al banco</strong>: la factura se
                aplica completa y la diferencia se calcula sola como comisión. Corrígela solo si
                el procesador cobró otra cosa.
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Comisión retenida (calculada)</div>
                  <InputNumber
                    style={{ width: 160 }} prefix={simboloCobro} min={0} step={0.01} precision={2}
                    value={comision || undefined} placeholder="0.00"
                    onChange={v => setComision(v ?? 0)}
                  />
                </div>
                <div style={{ minWidth: 280, flex: 1 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Cuenta de gasto</div>
                  <AccountSelect
                    value={comisionCuenta}
                    onChange={setComisionCuenta}
                    placeholder="La de Cuentas por defecto"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ISR (solo en pago a facturas) */}
          {!isAdvance && (
            <Form.Item label="¿Se han deducido los impuestos?" style={{ marginBottom: 0 }}>
              <Radio.Group value={isrEnabled ? 'si' : 'no'} onChange={e => {
                const on = e.target.value === 'si'
                setIsrEnabled(on); setIsrAmount(0)
              }}>
                <Radio value="no">No se han retenido impuestos</Radio>
                <Radio value="si">Sí, retención fiscal en origen</Radio>
              </Radio.Group>
              {isrEnabled && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 12 }}>ISR retenido:</Text>
                  <InputNumber
                    style={{ width: 140 }} prefix={simboloCobro} min={0.01} step={0.01} precision={2}
                    value={isrAmount || undefined} placeholder="0.00"
                    onChange={v => setIsrAmount(v ?? 0)}
                  />
                </div>
              )}
            </Form.Item>
          )}
        </Form>
      </Card>

      {/* Invoice distribution table (solo en pago a facturas) */}
      {!isAdvance && (
        <Card
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Facturas no pagadas</Text>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearAllocations}
                disabled={openInvoices.length === 0}
              >
                Borrar importe aplicado
              </Button>
            </div>
          }
        >
          {!selectedCust ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb' }}>
              <InfoCircleOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
              <Text type="secondary">Selecciona un cliente para ver sus facturas pendientes</Text>
            </div>
          ) : loadingInv ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          ) : openInvoices.length === 0 ? (
            <Alert type="success" showIcon message="Este cliente no tiene facturas con saldo pendiente." />
          ) : (
            <>
              <Table
                dataSource={openInvoices}
                columns={invColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'Sin facturas pendientes' }}
              />

              {/*
                * El tipo de cambio del cobro, cuando las facturas no son en
                * quetzales. La cuenta por cobrar se descarga a la tasa de la
                * FACTURA —su valor en libros— y lo que entra al banco va a la
                * tasa de hoy: la diferencia es el diferencial cambiario, y por
                * eso la tasa se ve aquí antes de guardar.
                */}
              {cobroEnDivisa && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
                  padding: '6px 12px', background: '#f0f9ff',
                  borderRadius: 6, border: '1px solid #bae6fd',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    1 {monedaDelCobro} =
                  </span>
                  {editandoTasa ? (
                    <InputNumber
                      value={tasaDelCobro} precision={6} min={0.000001} step={0.01}
                      style={{ width: 130 }} autoFocus addonAfter="GTQ"
                      onChange={(v: number | null) => setTasaDelCobro(v ?? 1)}
                      onBlur={() => setEditandoTasa(false)}
                      onPressEnter={() => setEditandoTasa(false)}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                      {cargandoTasa ? '...' : tasaDelCobro.toFixed(6)} GTQ
                    </span>
                  )}
                  <Button
                    size="small" type="text" icon={<EditOutlined />}
                    onClick={() => setEditandoTasa(!editandoTasa)}
                    title="Editar tipo de cambio manualmente"
                    style={{ color: '#374151' }} disabled={cargandoTasa}
                  />
                  <span style={{ fontSize: 11, color: '#9aa1ab', marginLeft: 4 }}>
                    {cargandoTasa
                      ? 'Consultando Banguat...'
                      : tasaMeta
                        ? `Tasa del ${dayjs(tasaMeta.effectiveDate).format('DD/MM/YYYY')} (${tasaMeta.source})`
                        : 'Escríbela si Banguat no la tiene'}
                  </span>
                  <span style={{ fontSize: 12, color: '#374151', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtQ(totalApplied * tasaDelCobro)}
                  </span>
                </div>
              )}

              {/* Totales */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 320, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 14px', background: '#fafbfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <Text style={{ fontSize: 12 }}>Importe recibido</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m(totalReceived)}</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 14px', background: '#fafbfc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <Text style={{ fontSize: 12 }}>Total aplicado a facturas</Text>
                    <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2', fontWeight: 600 }}>{m(totalApplied)}</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 14px', background: difference < -0.009 ? '#fff5f5' : difference > 0.009 ? '#fffbeb' : '#f0fdf4' }}>
                    <Text style={{ fontSize: 13, fontWeight: 700 }}>Diferencia</Text>
                    <Text style={{
                      fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700,
                      color: Math.abs(difference) < 0.01 ? '#2ea172' : difference > 0 ? '#d97706' : '#dc2626',
                    }}>
                      {m(Math.abs(difference))} {difference > 0.009 ? '(excedente)' : difference < -0.009 ? '(excede importe)' : '✓'}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Opción anticipo automático cuando hay excedente */}
              {difference > 0.009 && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <Checkbox
                    checked={autoAnticipo}
                    onChange={e => setAutoAnticipo(e.target.checked)}
                  >
                    <Text style={{ fontSize: 13 }}>
                      Registrar excedente de <strong>{m(difference)}</strong> como anticipo (ANT) con la misma cuenta bancaria
                    </Text>
                  </Checkbox>
                  {autoAnticipo && !form.getFieldValue('bankAccountId') && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#d97706' }}>
                      ⚠ Selecciona una cuenta bancaria para que el anticipo se vincule correctamente al banco
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Anticipo info card */}
      {isAdvance && (
        <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <Alert
            type="info"
            showIcon
            message="Anticipo de cliente"
            description="Este pago se registrará como anticipo sin factura asociada. Podrá aplicarse a una factura futura desde el módulo de Anticipos."
          />
        </Card>
      )}
    </div>
  )
}
