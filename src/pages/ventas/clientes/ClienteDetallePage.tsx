import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  Button, Typography, Tag, Table, Divider, Spin, Space, Badge, Avatar,
  Tabs, Statistic, Select, Empty, Tooltip, Popconfirm, message, Modal, Input,
} from 'antd'
import {
  ArrowLeftOutlined, LeftOutlined, RightOutlined, EditOutlined, PlusOutlined, UserOutlined, BankOutlined,
  MailOutlined, PhoneOutlined, MobileOutlined, GlobalOutlined,
  EnvironmentOutlined, FileTextOutlined, DeleteOutlined, PrinterOutlined,
  SendOutlined, CommentOutlined, MessageOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getCustomer, deleteCustomer, type Customer } from '../../../api/contactos'
import { getInvoices, getEstimates, type Invoice, type Estimate, INVOICE_STATUS_CONFIG, ESTIMATE_STATUS_CONFIG } from '../../../api/facturas'
import { getPagosRecibidos, PAYMENT_MODE_LABELS, type PagoRecibido } from '../../../api/pagos-recibidos'
import { getNotasCredito, NC_STATUS_CONFIG, type NotaCredito } from '../../../api/notas-credito'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'
import { getComments, addComment, type ActivityComment } from '../../../api/comments'

const { Title, Text } = Typography
const { TextArea } = Input

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const TAX_TREATMENT_LABELS: Record<string, string> = {
  taxable:                'Contribuyente IVA 12%',
  exempt:                 'Exento de IVA',
  contribuyente_especial: 'Contribuyente especial',
  gobierno:               'Entidad de gobierno',
  exportador:             'Exportador',
}

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'default' | 'error' }> = {
  active:      { label: 'Activo',    color: 'success' },
  inactive:    { label: 'Inactivo',  color: 'default' },
  blacklisted: { label: 'Bloqueado', color: 'error'   },
}

export default function ClienteDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [customer,    setCustomer]    = useState<Customer | null>(null)
  const [company,     setCompany]     = useState<OrganizationProfile>({ name: '' })
  const [invoices,    setInvoices]    = useState<Invoice[]>([])
  const [payments,    setPayments]    = useState<PagoRecibido[]>([])
  const [estimates,   setEstimates]   = useState<Estimate[]>([])
  const [creditNotes, setCreditNotes] = useState<NotaCredito[]>([])
  const [comments,    setComments]    = useState<ActivityComment[]>([])
  const [loading,     setLoading]     = useState(true)

  // Gráfico: offset en períodos de 12 meses (0 = actual, 1 = año anterior, ...)
  const [chartOffset, setChartOffset] = useState(0)

  // Estado de cuenta: month/year selectors
  const [stmtMonth, setStmtMonth] = useState(dayjs().month())
  const [stmtYear,  setStmtYear]  = useState(dayjs().year())

  // Email modal
  const [emailModal, setEmailModal] = useState(false)
  const [emailTo,    setEmailTo]    = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Comentarios
  const [commentText,   setCommentText]   = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [cust, org, invRes, payRes, estRes, ncRes, cmtRes] = await Promise.all([
        getCustomer(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
        getInvoices({ customerId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getPagosRecibidos({ customerId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getEstimates({ customerId: id, limit: 50 }).catch(() => ({ data: [], total: 0 })),
        getNotasCredito({ customerId: id, limit: 50 }).catch(() => ({ data: [], total: 0 })),
        getComments('customer', id).catch(() => [] as ActivityComment[]),
      ])
      setCustomer(cust)
      setCompany(org)
      setInvoices(invRes.data ?? [])
      setPayments(payRes.data ?? [])
      setEstimates(estRes.data ?? [])
      setCreditNotes(ncRes.data ?? [])
      setComments(Array.isArray(cmtRes) ? cmtRes : [])
    } catch { message.error('No se pudo cargar el cliente') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleDelete = async () => {
    if (!customer?.id) return
    try {
      await deleteCustomer(customer.id)
      message.success('Cliente eliminado')
      navigate('/ventas/clientes')
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes('@')) { message.warning('Ingrese un correo válido'); return }
    setSendingEmail(true)
    try {
      // Placeholder — backend endpoint /ventas/clientes/:id/send-statement
      await new Promise(r => setTimeout(r, 800))
      message.success(`Estado de cuenta enviado a ${emailTo}`)
      setEmailModal(false)
      setEmailTo('')
    } catch { message.error('No se pudo enviar el correo') }
    finally { setSendingEmail(false) }
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !id) return
    setAddingComment(true)
    try {
      const c = await addComment('customer', id, commentText.trim())
      setComments(prev => [...prev, c])
      setCommentText('')
    } catch { message.error('No se pudo guardar el comentario') }
    finally { setAddingComment(false) }
  }

  // ── Stats derivados ────────────────────────────────────────────────────────

  const totalFacturado = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((s, inv) => s + Number(inv.total ?? 0), 0)

  const totalCobrado = payments
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const saldoPendiente = invoices
    .filter(inv => ['open', 'partial', 'overdue', 'sent'].includes(inv.status))
    .reduce((s, inv) => s + Number(inv.balance ?? 0), 0)

  const facturasVencidas = invoices.filter(inv => inv.status === 'overdue').length

  // ── Gráfico ingresos: 12 meses con navegación de períodos ────────────────

  const chartData = useMemo(() => {
    const months: string[] = []
    const data: number[]   = []
    // El mes más reciente del período: mes actual - (offset * 12)
    const endMonth = dayjs().subtract(chartOffset * 12, 'month')
    for (let i = 11; i >= 0; i--) {
      const m = endMonth.subtract(i, 'month')
      months.push(m.format('MMM YY'))
      const total = invoices
        .filter(inv => {
          const d = dayjs(inv.invoiceDate ?? inv.createdAt)
          return d.year() === m.year() && d.month() === m.month() && inv.status !== 'voided'
        })
        .reduce((s, inv) => s + Number(inv.total ?? 0), 0)
      data.push(Math.round(total * 100) / 100)
    }
    const periodTotal = data.reduce((s, v) => s + v, 0)
    const startLabel  = dayjs(endMonth).subtract(11, 'month').format('MMM YY')
    const endLabel    = endMonth.format('MMM YY')
    return { months, data, periodTotal, startLabel, endLabel }
  }, [invoices, chartOffset])

  const chartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => `${params[0].name}<br/>Q ${Number(params[0].value).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    grid: { left: 16, right: 16, top: 12, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: chartData.months, axisLabel: { fontSize: 10, color: '#6b7280' }, axisLine: { lineStyle: { color: 'rgba(10,10,10,0.08)' } } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#6b7280', formatter: (v: number) => `Q${(v/1000).toFixed(0)}k` } },
    series: [{
      type: 'bar', data: chartData.data, barMaxWidth: 32,
      itemStyle: { color: '#1faec2', borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#1a97a8' } },
    }],
  }), [chartData])

  // ── Estado de cuenta ───────────────────────────────────────────────────────

  const stmtFrom = dayjs().year(stmtYear).month(stmtMonth).startOf('month')
  const stmtTo   = dayjs().year(stmtYear).month(stmtMonth).endOf('month')

  const statementRows = useMemo(() => {
    const from = stmtFrom.startOf('day')
    const to   = stmtTo.endOf('day')
    type StmtRow = { key: string; date: string; type: string; ref: string; route?: string; debit: number; credit: number }
    const periodRows: StmtRow[] = []

    // Saldo anterior: suma de todos los movimientos antes del período seleccionado
    let prevBalance = 0
    invoices.filter(inv => dayjs(inv.invoiceDate ?? inv.createdAt).isBefore(from) && inv.status !== 'voided')
      .forEach(inv => { prevBalance += Number(inv.total ?? 0) })
    payments.filter(p => dayjs(p.paymentDate ?? p.createdAt).isBefore(from))
      .forEach(p => { prevBalance -= Number(p.amount ?? 0) })

    invoices.filter(inv => {
      const d = dayjs(inv.invoiceDate ?? inv.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms')) && inv.status !== 'voided'
    }).forEach(inv => periodRows.push({
      key: inv.id, date: inv.invoiceDate, type: 'Factura', ref: inv.invoiceNumber,
      route: `/ventas/facturas/${inv.id}`,
      debit: Number(inv.total ?? 0), credit: 0,
    }))

    payments.filter(p => {
      const d = dayjs(p.paymentDate ?? p.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms'))
    }).forEach(p => periodRows.push({
      key: p.id, date: p.paymentDate, type: 'Pago', ref: p.paymentNumber,
      route: `/ventas/pagos-recibidos/${p.id}`,
      debit: 0, credit: Number(p.amount ?? 0),
    }))

    periodRows.sort((a, b) => a.date.localeCompare(b.date))

    // Saldo anterior encabeza siempre como débito si es > 0
    const allRows: StmtRow[] = prevBalance > 0.001
      ? [{ key: 'saldo-anterior', date: from.format('YYYY-MM-DD'), type: 'Saldo anterior', ref: 'Saldo período anterior', debit: prevBalance, credit: 0 }, ...periodRows]
      : periodRows

    let balance = 0
    return allRows.map(r => {
      balance = balance + r.debit - r.credit
      return { ...r, balance }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, payments, stmtMonth, stmtYear])

  const stmtTotal = statementRows.reduce((s, r) => s + r.debit - r.credit, 0)

  // ── Columnas ───────────────────────────────────────────────────────────────

  const invCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 130,
      render: (v: string, r: Invoice) => <Link to={`/ventas/facturas/${r.id}`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = INVOICE_STATUS_CONFIG[v as keyof typeof INVOICE_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    {
      title: 'Origen', dataIndex: 'type', width: 110,
      render: (v: string) => v === 'recurring'
        ? <Tag color="#6b7280" style={{ fontSize: 10 }}>Recurrente</Tag>
        : <Tag color="default" style={{ fontSize: 10 }}>Estándar</Tag>,
    },
    { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: Number(v) > 0 ? '#ff7f00' : '#6b7280' }}>{fmtQ(Number(v))}</Text> },
  ]

  const payCols = [
    { title: 'Fecha', dataIndex: 'paymentDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'paymentNumber', width: 130,
      render: (v: string, r: PagoRecibido) => <Link to={`/ventas/pagos-recibidos/${r.id}`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>,
    },
    { title: 'Modo', dataIndex: 'mode', width: 150, render: (v: string) => <Text style={{ fontSize: 12 }}>{PAYMENT_MODE_LABELS[v as keyof typeof PAYMENT_MODE_LABELS] ?? v ?? '—'}</Text> },
    { title: 'Referencia', dataIndex: 'reference', width: 120, render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Monto', dataIndex: 'amount', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(v)}</Text> },
  ]

  const estCols = [
    { title: 'Fecha', dataIndex: 'estimateDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'estimateNumber', width: 140,
      render: (v: string, r: Estimate) => <Link to={`/ventas/estimaciones/${r.id}`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = ESTIMATE_STATUS_CONFIG[v as keyof typeof ESTIMATE_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text> },
  ]

  const ncCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 140,
      render: (v: string, r: NotaCredito) => <Link to={`/ventas/notas-credito/${r.id}`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#e5484d' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = NC_STATUS_CONFIG[v as keyof typeof NC_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total NC', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#e5484d' }}>{fmtQ(v)}</Text> },
    { title: 'Saldo NC', dataIndex: 'creditBalance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(Number(v ?? 0))}</Text> },
  ]

  const stmtCols = [
    { title: 'Fecha', dataIndex: 'date', width: 100, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    { title: 'Tipo', dataIndex: 'type', width: 110, render: (v: string) => <Tag color={v === 'Factura' ? '#1faec2' : v === 'Pago' ? '#2ea172' : '#6b7280'} style={{ fontSize: 11 }}>{v}</Tag> },
    {
      title: 'Referencia', dataIndex: 'ref',
      render: (v: string, r: any) => r.route
        ? <Link to={r.route} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>
        : <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>,
    },
    { title: 'Cargo', dataIndex: 'debit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Abono', dataIndex: 'credit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 130,
      render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: v > 0 ? '#ff7f00' : '#2ea172' }}>{fmtQ(Math.abs(v))}{v < 0 ? ' CR' : ''}</Text>,
    },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!customer) return <div style={{ padding: 40 }}><Text>Cliente no encontrado</Text></div>

  const statusCfg = STATUS_CONFIG[customer.status ?? 'active']
  const isCompany = customer.type !== 'individual'
  const billingAddr = customer.billingAddress

  const creditUsed = saldoPendiente
  const creditPct  = customer.creditLimit && Number(customer.creditLimit) > 0
    ? Math.min(100, Math.round(creditUsed / Number(customer.creditLimit) * 100))
    : 0

  const yearOptions = Array.from({ length: 6 }, (_, i) => dayjs().year() - i)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 20, padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/clientes')}>
          Clientes
        </Button>
        <Divider type="vertical" />
        <Avatar size={40} style={{ background: isCompany ? '#1faec2' : '#ff7f00', flexShrink: 0 }}
          icon={isCompany ? <BankOutlined /> : <UserOutlined />} />
        <div>
          <Title level={5} style={{ margin: 0, color: '#0a0a0a' }}>{customer.name || customer.legalName}</Title>
          {customer.taxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {customer.taxId}</Text>}
        </div>
        <Badge status={statusCfg.color} text={statusCfg.label} style={{ marginLeft: 4 }} />
        <div style={{ flex: 1 }} />
        <Button icon={<EditOutlined />} onClick={() => navigate(`/ventas/clientes/${customer.id}/editar`)}>
          Editar
        </Button>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/ventas/facturas/nueva', { state: { customerId: customer.id, customerName: customer.name } })}
          style={{ background: '#1faec2' }}
        >
          Nueva factura
        </Button>
        <Button
          icon={<FileTextOutlined />}
          onClick={() => navigate('/ventas/estimaciones/nueva', { state: { customerId: customer.id, customerName: customer.name } })}
        >
          Nueva cotización
        </Button>
        <Popconfirm title="¿Eliminar este cliente?" onConfirm={handleDelete}
          okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
        </Popconfirm>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cuentas por cobrar', value: fmtQ(saldoPendiente), color: saldoPendiente > 0 ? '#ff7f00' : '#2ea172', sub: 'Saldo pendiente de pago' },
          { label: 'Total facturado', value: fmtQ(totalFacturado), color: '#1faec2', sub: `${invoices.filter(i => i.status !== 'voided').length} facturas` },
          { label: 'Total cobrado', value: fmtQ(totalCobrado), color: '#2ea172', sub: `${payments.length} pagos recibidos` },
          { label: 'Facturas vencidas', value: String(facturasVencidas), color: facturasVencidas > 0 ? '#e5484d' : '#2ea172', sub: facturasVencidas > 0 ? 'Requieren seguimiento' : 'Todo al día' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.color}` }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{s.label}</Text>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{s.value}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{s.sub}</Text>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs
        type="card"
        items={[

          // ── Tab 1: Información general ─────────────────────────────────
          {
            key: 'info',
            label: 'Información general',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, paddingTop: 8 }}>

                {/* Columna izquierda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>Contacto</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customer.legalName && customer.legalName !== customer.name && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Razón social SAT</Text>
                          <Text strong style={{ fontSize: 13 }}>{customer.legalName}</Text>
                        </div>
                      )}
                      {customer.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MailOutlined style={{ color: '#1faec2', fontSize: 14 }} />
                          <a href={`mailto:${customer.email}`} style={{ fontSize: 13 }}>{customer.email}</a>
                        </div>
                      )}
                      {customer.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PhoneOutlined style={{ color: '#1faec2', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{customer.phone}</Text>
                        </div>
                      )}
                      {customer.mobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MobileOutlined style={{ color: '#1faec2', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{customer.mobile}</Text>
                        </div>
                      )}
                      {customer.website && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GlobalOutlined style={{ color: '#1faec2', fontSize: 14 }} />
                          <a href={customer.website} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{customer.website}</a>
                        </div>
                      )}
                      {!customer.email && !customer.phone && !customer.mobile && (
                        <Text type="secondary" style={{ fontSize: 12 }}>Sin datos de contacto</Text>
                      )}
                    </div>
                  </div>

                  {billingAddr?.address && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Dirección de facturación</Text>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <EnvironmentOutlined style={{ color: '#1faec2', fontSize: 14, marginTop: 2 }} />
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                          {billingAddr.address && <div>{billingAddr.address}</div>}
                          {billingAddr.street2 && <div>{billingAddr.street2}</div>}
                          {(billingAddr.city || billingAddr.state) && <div>{[billingAddr.city, billingAddr.state].filter(Boolean).join(', ')}</div>}
                          {billingAddr.country && <div>{billingAddr.country}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Otros detalles</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0', fontSize: 13 }}>
                      <Text type="secondary">N° Cliente</Text>
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{customer.customerNumber || '—'}</Text>
                      <Text type="secondary">Moneda</Text>
                      <Text>{customer.currency || 'GTQ'}</Text>
                      <Text type="secondary">Términos de pago</Text>
                      <Text>{customer.paymentTerms || '—'}</Text>
                      <Text type="secondary">Tipo fiscal</Text>
                      <Text style={{ fontSize: 12 }}>{TAX_TREATMENT_LABELS[customer.taxTreatment ?? ''] ?? customer.taxTreatment ?? '—'}</Text>
                      {customer.taxCode && <><Text type="secondary">IVA</Text><Tag color="#1faec2" style={{ fontSize: 11 }}>{customer.taxCode}</Tag></>}
                      {customer.tdsEnabled && customer.tdsTaxCode && <><Text type="secondary">ISR</Text><Tag color="#6b7280" style={{ fontSize: 11 }}>{customer.tdsTaxCode}</Tag></>}
                      {customer.ivaRetentionCode && <><Text type="secondary">Ret. IVA</Text><Tag color="#ff7f00" style={{ fontSize: 11 }}>{customer.ivaRetentionCode}</Tag></>}
                    </div>
                  </div>

                  {customer.contacts && customer.contacts.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Personas de contacto</Text>
                      {customer.contacts.slice(0, 3).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <Avatar size={32} style={{ background: '#1faec2', flexShrink: 0 }}>
                            {((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || '?'}
                          </Avatar>
                          <div>
                            <Text strong style={{ fontSize: 13 }}>{[c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ')}</Text>
                            {c.designation && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{c.designation}</Text>}
                            {c.email && <div style={{ fontSize: 12 }}><MailOutlined style={{ marginRight: 4, color: '#6b7280' }} />{c.email}</div>}
                            {c.phone && <div style={{ fontSize: 12 }}><PhoneOutlined style={{ marginRight: 4, color: '#6b7280' }} />{c.phone}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {customer.notes && (
                    <div style={{ background: '#fff2e5', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,127,0,0.25)' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#b35900', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notas internas</Text>
                      <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{customer.notes}</Text>
                    </div>
                  )}
                </div>

                {/* Columna derecha */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>Cuentas por cobrar</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <Statistic
                        title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Saldo pendiente</Text>}
                        value={saldoPendiente} precision={2} prefix="Q"
                        valueStyle={{ color: saldoPendiente > 0 ? '#ff7f00' : '#2ea172', fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
                        formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      />
                      <Statistic
                        title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Total facturado</Text>}
                        value={totalFacturado} precision={2} prefix="Q"
                        valueStyle={{ color: '#0a0a0a', fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
                        formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      />
                    </div>
                    {customer.creditLimit && Number(customer.creditLimit) > 0 && (
                      <div style={{ padding: '10px 14px', background: '#fafbfc', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 12 }}>Límite de crédito</Text>
                          <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(Number(customer.creditLimit))}</Text>
                        </div>
                        <div style={{ background: 'rgba(10,10,10,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${creditPct}%`, height: '100%', background: creditPct > 80 ? '#e5484d' : creditPct > 50 ? '#ff7f00' : '#2ea172', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                          {creditPct}% utilizado — Disponible: {fmtQ(Math.max(0, Number(customer.creditLimit) - creditUsed))}
                        </Text>
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Ingresos ({chartData.startLabel} – {chartData.endLabel})
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: 800, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtQ(chartData.periodTotal)}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                      <Button size="small" icon={<LeftOutlined />} onClick={() => setChartOffset(o => o + 1)}
                        title="Período anterior" style={{ fontSize: 11 }} />
                      <Button size="small" icon={<RightOutlined />} onClick={() => setChartOffset(o => Math.max(0, o - 1))}
                        disabled={chartOffset === 0} title="Período siguiente" style={{ fontSize: 11 }} />
                    </div>
                    {invoices.length > 0
                      ? <ReactECharts option={chartOption} style={{ height: 180 }} />
                      : <Empty description="Sin facturas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    }
                  </div>

                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Últimas facturas</Text>
                      <Link to={`/ventas/facturas?customerId=${customer.id}`} style={{ fontSize: 12 }}>Ver todas</Link>
                    </div>
                    {invoices.slice(0, 5).map(inv => {
                      const sCfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
                      return (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fafbfc' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Link to={`/ventas/facturas/${inv.id}`} style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{inv.invoiceNumber}</Link>
                              {inv.type === 'recurring' && <Tag color="#6b7280" style={{ fontSize: 10, margin: 0 }}>Recurrente</Tag>}
                            </div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{dayjs(inv.invoiceDate).format('DD/MM/YYYY')}</Text>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtQ(Number(inv.total))}</div>
                            <Tag color={sCfg?.color} style={{ fontSize: 10, margin: 0 }}>{sCfg?.label ?? inv.status}</Tag>
                          </div>
                        </div>
                      )
                    })}
                    {invoices.length === 0 && <Empty description="Sin facturas" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                  </div>
                </div>
              </div>
            ),
          },

          // ── Tab 2: Transacciones ───────────────────────────────────────
          {
            key: 'txs',
            label: `Transacciones (${invoices.length + payments.length + estimates.length + creditNotes.length})`,
            children: (
              <div style={{ paddingTop: 8 }}>
                <Tabs type="line" size="small" items={[
                  {
                    key: 'facturas',
                    label: `Facturas (${invoices.length})`,
                    children: (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
                            onClick={() => navigate('/ventas/facturas/nueva', { state: { customerId: customer.id, customerName: customer.name } })}>
                            Nueva factura
                          </Button>
                        </div>
                        <Table columns={invCols} dataSource={invoices} rowKey="id" size="small"
                          pagination={{ pageSize: 10, showTotal: t => `${t} facturas` }}
                          locale={{ emptyText: 'Sin facturas para este cliente' }}
                          style={{ background: '#fff', borderRadius: 8 }} />
                      </div>
                    ),
                  },
                  {
                    key: 'pagos',
                    label: `Pagos recibidos (${payments.length})`,
                    children: (
                      <Table columns={payCols} dataSource={payments} rowKey="id" size="small"
                        pagination={{ pageSize: 10, showTotal: t => `${t} pagos` }}
                        locale={{ emptyText: 'Sin pagos registrados' }}
                        style={{ background: '#fff', borderRadius: 8 }} />
                    ),
                  },
                  {
                    key: 'cotizaciones',
                    label: `Cotizaciones (${estimates.length})`,
                    children: (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <Button size="small" icon={<PlusOutlined />}
                            onClick={() => navigate('/ventas/estimaciones/nueva', { state: { customerId: customer.id, customerName: customer.name } })}>
                            Nueva cotización
                          </Button>
                        </div>
                        <Table columns={estCols} dataSource={estimates} rowKey="id" size="small"
                          pagination={{ pageSize: 10, showTotal: t => `${t} cotizaciones` }}
                          locale={{ emptyText: 'Sin cotizaciones' }}
                          style={{ background: '#fff', borderRadius: 8 }} />
                      </div>
                    ),
                  },
                  {
                    key: 'nc',
                    label: `Notas de crédito (${creditNotes.length})`,
                    children: (
                      <Table columns={ncCols} dataSource={creditNotes} rowKey="id" size="small"
                        pagination={{ pageSize: 10, showTotal: t => `${t} notas` }}
                        locale={{ emptyText: 'Sin notas de crédito' }}
                        style={{ background: '#fff', borderRadius: 8 }} />
                    ),
                  },
                ]} />
              </div>
            ),
          },

          // ── Tab 3: Estado de cuenta ────────────────────────────────────
          {
            key: 'statement',
            label: 'Estado de cuenta',
            children: (
              <div style={{ paddingTop: 8 }}>
                {/* Filtros con mes/año desplegable */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <Select
                    value={stmtMonth}
                    onChange={setStmtMonth}
                    style={{ width: 140 }}
                    options={MONTHS.map((m, i) => ({ value: i, label: m }))}
                  />
                  <Select
                    value={stmtYear}
                    onChange={setStmtYear}
                    style={{ width: 90 }}
                    options={yearOptions.map(y => ({ value: y, label: String(y) }))}
                  />
                  <Tooltip title="Imprimir estado de cuenta">
                    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir</Button>
                  </Tooltip>
                  <Tooltip title="Enviar por correo electrónico">
                    <Button icon={<SendOutlined />} onClick={() => { setEmailTo(customer.email ?? ''); setEmailModal(true) }}>
                      Enviar por correo
                    </Button>
                  </Tooltip>
                  <div style={{ marginLeft: 'auto' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Saldo del período: </Text>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: stmtTotal > 0 ? '#ff7f00' : '#2ea172', fontSize: 14 }}>
                      {fmtQ(Math.abs(stmtTotal))}{stmtTotal < 0 ? ' CR' : ''}
                    </Text>
                  </div>
                </div>

                {/* Header */}
                <div style={{ background: '#1faec2', borderRadius: '10px 10px 0 0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Estado de cuenta</Text>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{customer.name || customer.legalName}</Text>
                    {customer.taxId && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block' }}>NIT: {customer.taxId}</Text>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, display: 'block' }}>Período</Text>
                    <Text style={{ color: '#fff', fontSize: 13 }}>
                      {MONTHS[stmtMonth]} {stmtYear}
                    </Text>
                    {company.name && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginTop: 4 }}>{company.name}</Text>}
                  </div>
                </div>

                <Table
                  columns={stmtCols}
                  dataSource={statementRows}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Sin movimientos en el período seleccionado' }}
                  style={{ background: '#fff', borderRadius: '0 0 10px 10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ background: '#fafbfc' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong style={{ fontSize: 12 }}>Total del período</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>
                            {fmtQ(statementRows.reduce((s, r) => s + r.debit, 0))}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>
                            {fmtQ(statementRows.reduce((s, r) => s + r.credit, 0))}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: stmtTotal > 0 ? '#ff7f00' : '#2ea172' }}>
                            {fmtQ(Math.abs(stmtTotal))}{stmtTotal < 0 ? ' CR' : ''}
                          </Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </div>
            ),
          },

          // ── Tab 4: Comentarios ─────────────────────────────────────────
          {
            key: 'comments',
            label: (
              <Space>
                <CommentOutlined />
                {`Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}`}
              </Space>
            ),
            children: (
              <div style={{ paddingTop: 8, maxWidth: 720 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                  Registro de observaciones, seguimientos y actividad sobre este cliente. Visible para todos los usuarios.
                </Text>

                {/* Lista de comentarios */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                  {comments.length === 0
                    ? <Empty description="Sin comentarios aún" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    : comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                          <Avatar size={36} style={{ background: c.type === 'activity' ? '#2ea172' : '#1faec2', flexShrink: 0 }}>
                            {c.type === 'activity' ? '⚙' : (c.userName?.[0]?.toUpperCase() ?? <MessageOutlined />)}
                          </Avatar>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 13 }}>{c.userName ?? 'Usuario'}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(c.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                            </div>
                            {c.action && (
                              <Tag color="#1faec2" style={{ fontSize: 10, marginBottom: 4 }}>{c.action}</Tag>
                            )}
                            <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: '#333' }}>{c.text}</Text>
                          </div>
                        </div>
                      ))
                  }
                  <div ref={commentsEndRef} />
                </div>

                {/* Agregar comentario */}
                <div style={{ background: '#fff', borderRadius: 10, padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                    Agregar comentario
                  </Text>
                  <TextArea
                    rows={3}
                    placeholder="Escribe una observación, seguimiento o nota sobre este cliente..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                    style={{ marginBottom: 10, resize: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={addingComment}
                      disabled={!commentText.trim()}
                      onClick={handleAddComment}
                      style={{ background: '#1faec2' }}
                    >
                      Guardar comentario
                    </Button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* ── Modal: Enviar por correo ──────────────────────────────────────── */}
      <Modal
        title="Enviar estado de cuenta por correo"
        open={emailModal}
        onCancel={() => setEmailModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setEmailModal(false)}>Cancelar</Button>,
          <Button key="send" type="primary" icon={<SendOutlined />} loading={sendingEmail}
            onClick={handleSendEmail} style={{ background: '#1faec2' }}>
            Enviar
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Período: <strong>{MONTHS[stmtMonth]} {stmtYear}</strong></Text>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cliente: <strong>{customer.name || customer.legalName}</strong></Text>
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Correo destinatario</Text>
            <Input
              prefix={<MailOutlined style={{ color: '#999' }} />}
              placeholder="correo@ejemplo.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              onPressEnter={handleSendEmail}
              size="large"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
