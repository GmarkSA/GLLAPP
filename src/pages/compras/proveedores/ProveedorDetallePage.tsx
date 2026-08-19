import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  Button, Typography, Tag, Table, Divider, Spin, Space, Badge, Avatar,
  Tabs, Statistic, Select, Empty, Tooltip, Popconfirm, message, Modal, Input, DatePicker,
} from 'antd'
import {
  ArrowLeftOutlined, LeftOutlined, RightOutlined, EditOutlined, PlusOutlined, UserOutlined, BankOutlined,
  MailOutlined, PhoneOutlined, MobileOutlined, GlobalOutlined,
  EnvironmentOutlined, FileTextOutlined, DeleteOutlined, PrinterOutlined,
  SendOutlined, CommentOutlined, MessageOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getVendor, deleteVendor, type Vendor } from '../../../api/contactos'
import {
  getBills, getCreditNotes, BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice,
} from '../../../api/compras'
import { getPagosRealizados, type VendorPayment } from '../../../api/pagosRealizados'
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
  pequeno_contribuyente:  'Pequeño Contribuyente',
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

export default function ProveedorDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [vendor,      setVendor]      = useState<Vendor | null>(null)
  const [company,     setCompany]     = useState<OrganizationProfile>({ name: '' })
  const [bills,       setBills]       = useState<PurchaseInvoice[]>([])
  const [payments,    setPayments]    = useState<VendorPayment[]>([])
  const [creditNotes, setCreditNotes] = useState<PurchaseInvoice[]>([])
  const [comments,    setComments]    = useState<ActivityComment[]>([])
  const [loading,     setLoading]     = useState(true)

  // Gráfico: offset en períodos de 12 meses (0 = actual, 1 = año anterior, ...)
  const [chartOffset, setChartOffset] = useState(0)

  const [stmtRange, setStmtRange] = useState<[ReturnType<typeof dayjs>, ReturnType<typeof dayjs>]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])

  const [emailModal,    setEmailModal]    = useState(false)
  const [emailTo,       setEmailTo]       = useState('')
  const [sendingEmail,  setSendingEmail]  = useState(false)
  const [commentText,   setCommentText]   = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [vend, org, billsRes, paysRes, ncRes, cmtRes] = await Promise.all([
        getVendor(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
        getBills({ vendorId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getPagosRealizados({ vendorId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getCreditNotes({ vendorId: id, limit: 50 }).catch(() => ({ data: [], total: 0 })),
        getComments('vendor', id).catch(() => [] as ActivityComment[]),
      ])
      setVendor(vend)
      setCompany(org)
      setBills(billsRes.data ?? [])
      setPayments(paysRes.data ?? [])
      setCreditNotes(ncRes.data ?? [])
      setComments(Array.isArray(cmtRes) ? cmtRes : [])
    } catch { message.error('No se pudo cargar el proveedor') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const handleDelete = async () => {
    if (!vendor?.id) return
    try {
      await deleteVendor(vendor.id)
      message.success('Proveedor eliminado')
      navigate('/compras/proveedores')
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes('@')) { message.warning('Ingrese un correo válido'); return }
    setSendingEmail(true)
    try {
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
      const c = await addComment('vendor', id, commentText.trim())
      setComments(prev => [...prev, c])
      setCommentText('')
    } catch { message.error('No se pudo guardar el comentario') }
    finally { setAddingComment(false) }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalComprado = bills
    .filter(b => b.status !== 'voided' && b.invoiceType !== 'credit_note')
    .reduce((s, b) => s + Number(b.total ?? 0), 0)

  const totalPagado = payments
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const saldoPendiente = bills
    .filter(b => ['open', 'partial', 'overdue', 'pending_approval'].includes(b.status))
    .reduce((s, b) => s + Number(b.balance ?? 0), 0)

  const facturasVencidas = bills.filter(b => b.status === 'overdue').length

  // ── Gráfico compras: 12 meses con navegación de períodos ─────────────────

  const chartData = useMemo(() => {
    const months: string[] = []
    const data: number[]   = []
    const endMonth = dayjs().subtract(chartOffset * 12, 'month')
    for (let i = 11; i >= 0; i--) {
      const m = endMonth.subtract(i, 'month')
      months.push(m.format('MMM YY'))
      const total = bills
        .filter(b => {
          const d = dayjs(b.invoiceDate ?? b.createdAt)
          return d.year() === m.year() && d.month() === m.month()
            && b.status !== 'voided' && b.invoiceType !== 'credit_note'
        })
        .reduce((s, b) => s + Number(b.total ?? 0), 0)
      data.push(Math.round(total * 100) / 100)
    }
    const periodTotal = data.reduce((s, v) => s + v, 0)
    const startLabel  = dayjs(endMonth).subtract(11, 'month').format('MMM YY')
    const endLabel    = endMonth.format('MMM YY')
    return { months, data, periodTotal, startLabel, endLabel }
  }, [bills, chartOffset])

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
      itemStyle: { color: '#ff7f00', borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#e06f00' } },
    }],
  }), [chartData])

  // ── Estado de cuenta ───────────────────────────────────────────────────────

  const stmtFrom = stmtRange[0].startOf('day')
  const stmtTo   = stmtRange[1].endOf('day')

  const statementRows = useMemo(() => {
    const from = stmtFrom.startOf('day')
    const to   = stmtTo.endOf('day')
    type StmtRow = { key: string; date: string; type: string; ref: string; route?: string; debit: number; credit: number }
    const periodRows: StmtRow[] = []

    // Saldo anterior: suma de todos los movimientos antes del período seleccionado
    let prevBalance = 0
    bills.filter(b => dayjs(b.invoiceDate ?? b.createdAt).isBefore(from) && b.status !== 'voided')
      .forEach(b => { prevBalance += Number(b.total ?? 0) })
    creditNotes.filter(nc => dayjs(nc.invoiceDate ?? nc.createdAt).isBefore(from) && nc.status !== 'voided')
      .forEach(nc => { prevBalance -= Number(nc.total ?? 0) })
    payments.filter(p => dayjs(p.paymentDate ?? p.createdAt).isBefore(from))
      .forEach(p => { prevBalance -= Number(p.amount ?? 0) })

    bills.filter(b => {
      const d = dayjs(b.invoiceDate ?? b.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms')) && b.status !== 'voided'
    }).forEach(b => periodRows.push({
      key: b.id, date: b.invoiceDate, type: 'Factura', ref: b.invoiceNumber,
      route: `/compras/facturas/${b.id}`,
      debit: Number(b.total ?? 0), credit: 0,
    }))

    creditNotes.filter(nc => {
      const d = dayjs(nc.invoiceDate ?? nc.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms')) && nc.status !== 'voided'
    }).forEach(nc => periodRows.push({
      key: nc.id, date: nc.invoiceDate, type: 'Nota de crédito', ref: nc.invoiceNumber,
      route: `/compras/notas-credito-proveedor/${nc.id}`,
      debit: 0, credit: Number(nc.total ?? 0),
    }))

    payments.filter(p => {
      const d = dayjs(p.paymentDate ?? p.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms'))
    }).forEach(p => periodRows.push({
      key: p.id, date: p.paymentDate, type: 'Pago', ref: p.paymentNumber,
      debit: 0, credit: Number(p.amount ?? 0),
    }))

    periodRows.sort((a, b) => a.date.localeCompare(b.date))

    const allRows: StmtRow[] = prevBalance > 0.001
      ? [{ key: 'saldo-anterior', date: from.format('YYYY-MM-DD'), type: 'Saldo anterior', ref: 'Saldo período anterior', debit: prevBalance, credit: 0 }, ...periodRows]
      : periodRows

    let balance = 0
    return allRows.map(r => { balance = balance + r.debit - r.credit; return { ...r, balance } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, payments, creditNotes, stmtRange])

  const stmtTotal = statementRows.reduce((s, r) => s + r.debit - r.credit, 0)

  // ── Columnas ───────────────────────────────────────────────────────────────

  const billCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 140,
      render: (v: string, r: PurchaseInvoice) => <Link to={`/compras/facturas/${r.id}`} state={{ fromVendorId: vendor?.id }} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{v}</Link>,
    },
    {
      title: 'Tipo', dataIndex: 'invoiceType', width: 110,
      render: (v: string) => { const c = BILL_TYPE_CONFIG[v as keyof typeof BILL_TYPE_CONFIG]; return <Tag style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = BILL_STATUS_CONFIG[v as keyof typeof BILL_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: Number(v) > 0 ? '#ff7f00' : '#6b7280' }}>{fmtQ(Number(v))}</Text> },
  ]

  const payCols = [
    { title: 'Fecha', dataIndex: 'paymentDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    { title: 'Número', dataIndex: 'paymentNumber', width: 140, render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text> },
    { title: 'Concepto', dataIndex: 'concept', render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Referencia', dataIndex: 'reference', width: 120, render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Monto', dataIndex: 'amount', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(v)}</Text> },
  ]

  const ncCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 140,
      render: (v: string, r: PurchaseInvoice) => <Link to={`/compras/notas-credito-proveedor/${r.id}`} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = BILL_STATUS_CONFIG[v as keyof typeof BILL_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total NC', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(v)}</Text> },
    { title: 'Saldo NC', dataIndex: 'balance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(Number(v ?? 0))}</Text> },
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
    { title: 'Cargo', dataIndex: 'debit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#ff7f00' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Abono', dataIndex: 'credit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 130,
      render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: v > 0 ? '#ff7f00' : '#2ea172' }}>{fmtQ(Math.abs(v))}{v < 0 ? ' CR' : ''}</Text>,
    },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!vendor) return <div style={{ padding: 40 }}><Text>Proveedor no encontrado</Text></div>

  const statusCfg = STATUS_CONFIG[vendor.status ?? 'active']
  const isCompany = vendor.type !== 'individual'
  const billingAddr = vendor.billingAddress
  const yearOptions = Array.from({ length: 6 }, (_, i) => dayjs().year() - i) // usado en el gráfico

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 20, padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/compras/proveedores')}>
          Proveedores
        </Button>
        <Divider type="vertical" />
        <Avatar size={40} style={{ background: isCompany ? '#ff7f00' : '#ff7f00', flexShrink: 0 }}
          icon={isCompany ? <BankOutlined /> : <UserOutlined />} />
        <div>
          <Title level={5} style={{ margin: 0, color: '#0a0a0a' }}>{vendor.name || vendor.legalName}</Title>
          {vendor.taxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {vendor.taxId}</Text>}
        </div>
        <Badge status={statusCfg.color} text={statusCfg.label} style={{ marginLeft: 4 }} />
        <div style={{ flex: 1 }} />
        <Button icon={<EditOutlined />} onClick={() => navigate(`/compras/proveedores/${vendor.id}/editar`)}>
          Editar
        </Button>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/compras/facturas/nueva', { state: { vendorId: vendor.id, vendorName: vendor.name } })}
          style={{ background: '#ff7f00', borderColor: '#ff7f00' }}
        >
          Nueva factura
        </Button>
        <Button
          icon={<FileTextOutlined />}
          onClick={() => navigate('/compras/ordenes/nueva', { state: { vendorId: vendor.id, vendorName: vendor.name } })}
        >
          Nueva OC
        </Button>
        <Popconfirm title="¿Eliminar este proveedor?" onConfirm={handleDelete}
          okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
        </Popconfirm>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cuentas por pagar', value: fmtQ(saldoPendiente), color: saldoPendiente > 0 ? '#ff7f00' : '#2ea172', sub: 'Saldo pendiente de pago' },
          { label: 'Total comprado', value: fmtQ(totalComprado), color: '#1faec2', sub: `${bills.filter(b => b.status !== 'voided').length} facturas` },
          { label: 'Total pagado', value: fmtQ(totalPagado), color: '#2ea172', sub: `${payments.length} pagos realizados` },
          { label: 'Facturas vencidas', value: String(facturasVencidas), color: facturasVencidas > 0 ? '#e5484d' : '#2ea172', sub: facturasVencidas > 0 ? 'Requieren pago urgente' : 'Todo al día' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.color}` }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{s.label}</Text>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{s.value}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{s.sub}</Text>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs type="card" items={[

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
                    {vendor.legalName && vendor.legalName !== vendor.name && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Razón social SAT</Text>
                        <Text strong style={{ fontSize: 13 }}>{vendor.legalName}</Text>
                      </div>
                    )}
                    {vendor.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MailOutlined style={{ color: '#ff7f00', fontSize: 14 }} />
                        <a href={`mailto:${vendor.email}`} style={{ fontSize: 13 }}>{vendor.email}</a>
                      </div>
                    )}
                    {vendor.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PhoneOutlined style={{ color: '#ff7f00', fontSize: 14 }} />
                        <Text style={{ fontSize: 13 }}>{vendor.phone}</Text>
                      </div>
                    )}
                    {vendor.mobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MobileOutlined style={{ color: '#ff7f00', fontSize: 14 }} />
                        <Text style={{ fontSize: 13 }}>{vendor.mobile}</Text>
                      </div>
                    )}
                    {vendor.website && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GlobalOutlined style={{ color: '#ff7f00', fontSize: 14 }} />
                        <a href={vendor.website} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{vendor.website}</a>
                      </div>
                    )}
                    {!vendor.email && !vendor.phone && !vendor.mobile && (
                      <Text type="secondary" style={{ fontSize: 12 }}>Sin datos de contacto</Text>
                    )}
                  </div>
                </div>

                {billingAddr?.address && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Dirección</Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <EnvironmentOutlined style={{ color: '#ff7f00', fontSize: 14, marginTop: 2 }} />
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
                    <Text type="secondary">N° Proveedor</Text>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{vendor.vendorNumber || '—'}</Text>
                    <Text type="secondary">Moneda</Text>
                    <Text>{vendor.currency || 'GTQ'}</Text>
                    <Text type="secondary">Términos de pago</Text>
                    <Text>{vendor.paymentTerms || '—'}</Text>
                    <Text type="secondary">Tipo fiscal</Text>
                    <Text style={{ fontSize: 12 }}>{TAX_TREATMENT_LABELS[vendor.taxTreatment ?? ''] ?? vendor.taxTreatment ?? '—'}</Text>
                    {vendor.tdsEnabled && vendor.tdsTaxCode && <><Text type="secondary">ISR</Text><Tag color="#6b7280" style={{ fontSize: 11 }}>{vendor.tdsTaxCode}</Tag></>}
                  </div>
                </div>

                {/* Cuenta bancaria del proveedor */}
                {vendor.bankAccount?.accountNumber && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Cuenta bancaria</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', fontSize: 13 }}>
                      {vendor.bankAccount.bankName && <><Text type="secondary">Banco</Text><Text>{vendor.bankAccount.bankName}</Text></>}
                      <Text type="secondary">N° de cuenta</Text>
                      <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{vendor.bankAccount.accountNumber}</Text>
                      {vendor.bankAccount.accountType && <><Text type="secondary">Tipo</Text><Text>{vendor.bankAccount.accountType}</Text></>}
                      {vendor.bankAccount.currency && <><Text type="secondary">Moneda</Text><Text>{vendor.bankAccount.currency}</Text></>}
                    </div>
                  </div>
                )}

                {vendor.contacts && vendor.contacts.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Personas de contacto</Text>
                    {vendor.contacts.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <Avatar size={32} style={{ background: '#ff7f00', flexShrink: 0 }}>
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

                {vendor.notes && (
                  <div style={{ background: '#fff2e5', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,127,0,0.25)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#b35900', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notas internas</Text>
                    <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{vendor.notes}</Text>
                  </div>
                )}
              </div>

              {/* Columna derecha */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>Cuentas por pagar</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Statistic
                      title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Saldo pendiente</Text>}
                      value={saldoPendiente} precision={2} prefix="Q"
                      valueStyle={{ color: saldoPendiente > 0 ? '#ff7f00' : '#2ea172', fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                    <Statistic
                      title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Total comprado</Text>}
                      value={totalComprado} precision={2} prefix="Q"
                      valueStyle={{ color: '#0a0a0a', fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
                      formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    />
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Compras ({chartData.startLabel} – {chartData.endLabel})
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: 800, color: '#ff7f00', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtQ(chartData.periodTotal)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                    <Button size="small" icon={<LeftOutlined />} onClick={() => setChartOffset(o => o + 1)}
                      title="Período anterior" style={{ fontSize: 11 }} />
                    <Button size="small" icon={<RightOutlined />} onClick={() => setChartOffset(o => Math.max(0, o - 1))}
                      disabled={chartOffset === 0} title="Período siguiente" style={{ fontSize: 11 }} />
                  </div>
                  {bills.length > 0
                    ? <ReactECharts option={chartOption} style={{ height: 180 }} />
                    : <Empty description="Sin facturas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  }
                </div>

                <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Últimas facturas</Text>
                  </div>
                  {bills.slice(0, 5).map(b => {
                    const sCfg = BILL_STATUS_CONFIG[b.status as keyof typeof BILL_STATUS_CONFIG]
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fafbfc' }}>
                        <div>
                          <Link to={`/compras/facturas/${b.id}`} state={{ fromVendorId: vendor?.id }} style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{b.invoiceNumber}</Link>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{dayjs(b.invoiceDate).format('DD/MM/YYYY')}</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtQ(Number(b.total))}</div>
                          <Tag color={sCfg?.color} style={{ fontSize: 10, margin: 0 }}>{sCfg?.label ?? b.status}</Tag>
                        </div>
                      </div>
                    )
                  })}
                  {bills.length === 0 && <Empty description="Sin facturas" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                </div>
              </div>
            </div>
          ),
        },

        // ── Tab 2: Transacciones ───────────────────────────────────────
        {
          key: 'txs',
          label: `Transacciones (${bills.length + payments.length + creditNotes.length})`,
          children: (
            <div style={{ paddingTop: 8 }}>
              <Tabs type="line" size="small" items={[
                {
                  key: 'facturas',
                  label: `Facturas (${bills.length})`,
                  children: (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                        <Button size="small" type="primary" icon={<PlusOutlined />}
                          style={{ background: '#ff7f00', borderColor: '#ff7f00' }}
                          onClick={() => navigate('/compras/facturas/nueva', { state: { vendorId: vendor.id, vendorName: vendor.name } })}>
                          Nueva factura
                        </Button>
                      </div>
                      <Table columns={billCols} dataSource={bills} rowKey="id" size="small"
                        pagination={{ pageSize: 10, showTotal: t => `${t} facturas` }}
                        locale={{ emptyText: 'Sin facturas de este proveedor' }}
                        style={{ background: '#fff', borderRadius: 8 }} />
                    </div>
                  ),
                },
                {
                  key: 'pagos',
                  label: `Pagos realizados (${payments.length})`,
                  children: (
                    <Table columns={payCols} dataSource={payments} rowKey="id" size="small"
                      pagination={{ pageSize: 10, showTotal: t => `${t} pagos` }}
                      locale={{ emptyText: 'Sin pagos registrados' }}
                      style={{ background: '#fff', borderRadius: 8 }} />
                  ),
                },
                {
                  key: 'nc',
                  label: `NC proveedor (${creditNotes.length})`,
                  children: (
                    <Table columns={ncCols} dataSource={creditNotes} rowKey="id" size="small"
                      pagination={{ pageSize: 10, showTotal: t => `${t} notas` }}
                      locale={{ emptyText: 'Sin notas de crédito del proveedor' }}
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                  value={stmtRange}
                  onChange={(dates) => { if (dates?.[0] && dates?.[1]) setStmtRange([dates[0], dates[1]]) }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                />
                <Tooltip title="Imprimir estado de cuenta">
                  <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir</Button>
                </Tooltip>
                <Tooltip title="Enviar por correo electrónico">
                  <Button icon={<SendOutlined />} onClick={() => { setEmailTo(vendor.email ?? ''); setEmailModal(true) }}>
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

              <div style={{ background: '#ff7f00', borderRadius: '10px 10px 0 0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Estado de cuenta — Proveedor</Text>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{vendor.name || vendor.legalName}</Text>
                  {vendor.taxId && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>NIT: {vendor.taxId}</Text>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, display: 'block' }}>Período</Text>
                  <Text style={{ color: '#fff', fontSize: 13 }}>
                    {stmtRange[0].format('DD/MM/YYYY')} — {stmtRange[1].format('DD/MM/YYYY')}
                  </Text>
                  {company.name && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block', marginTop: 4 }}>{company.name}</Text>}
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
                    <Table.Summary.Row style={{ background: '#fff2e5' }}>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <Text strong style={{ fontSize: 12 }}>Total del período</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#ff7f00' }}>
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
                Registro de observaciones, seguimientos y actividad sobre este proveedor. Visible para todos los usuarios.
              </Text>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {comments.length === 0
                  ? <Empty description="Sin comentarios aún" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  : comments.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <Avatar size={36} style={{ background: c.type === 'activity' ? '#2ea172' : '#ff7f00', flexShrink: 0 }}>
                          {c.type === 'activity' ? '⚙' : (c.userName?.[0]?.toUpperCase() ?? <MessageOutlined />)}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <Text strong style={{ fontSize: 13 }}>{c.userName ?? 'Usuario'}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(c.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                          </div>
                          {c.action && <Tag color="#ff7f00" style={{ fontSize: 10, marginBottom: 4 }}>{c.action}</Tag>}
                          <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: '#333' }}>{c.text}</Text>
                        </div>
                      </div>
                    ))
                }
                <div ref={commentsEndRef} />
              </div>

              <div style={{ background: '#fff', borderRadius: 10, padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                  Agregar comentario
                </Text>
                <TextArea
                  rows={3}
                  placeholder="Escribe una observación, seguimiento o nota sobre este proveedor..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                  style={{ marginBottom: 10, resize: 'none' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" icon={<SendOutlined />} loading={addingComment}
                    disabled={!commentText.trim()} onClick={handleAddComment}
                    style={{ background: '#ff7f00', borderColor: '#ff7f00' }}>
                    Guardar comentario
                  </Button>
                </div>
              </div>
            </div>
          ),
        },
      ]} />

      {/* ── Modal: Enviar por correo ──────────────────────────────────────── */}
      <Modal
        title="Enviar estado de cuenta por correo"
        open={emailModal}
        onCancel={() => setEmailModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setEmailModal(false)}>Cancelar</Button>,
          <Button key="send" type="primary" icon={<SendOutlined />} loading={sendingEmail}
            onClick={handleSendEmail} style={{ background: '#ff7f00', borderColor: '#ff7f00' }}>
            Enviar
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          <div>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Período: <strong>{stmtRange[0].format('DD/MM/YYYY')} — {stmtRange[1].format('DD/MM/YYYY')}</strong></Text>
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Proveedor: <strong>{vendor.name || vendor.legalName}</strong></Text>
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
