import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  Button, Typography, Tag, Table, Divider, Spin, Space, Badge, Avatar,
  Tabs, Statistic, DatePicker, Select, Empty, Tooltip, Popconfirm, message,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, PlusOutlined, UserOutlined, BankOutlined,
  MailOutlined, PhoneOutlined, MobileOutlined, GlobalOutlined,
  EnvironmentOutlined, FileTextOutlined, DollarOutlined, DeleteOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getCustomer, deleteCustomer, type Customer } from '../../../api/contactos'
import { getInvoices, getEstimates, type Invoice, type Estimate, INVOICE_STATUS_CONFIG, ESTIMATE_STATUS_CONFIG } from '../../../api/facturas'
import { getPagosRecibidos, PAYMENT_MODE_LABELS, type PagoRecibido } from '../../../api/pagos-recibidos'
import { getNotasCredito, NC_STATUS_CONFIG, type NotaCredito } from '../../../api/notas-credito'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

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
  const [loading,     setLoading]     = useState(true)
  const [stmtRange,   setStmtRange]   = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'), dayjs().endOf('month'),
  ])

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [cust, org, invRes, payRes, estRes, ncRes] = await Promise.all([
        getCustomer(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
        getInvoices({ customerId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getPagosRecibidos({ customerId: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
        getEstimates({ customerId: id, limit: 50 }).catch(() => ({ data: [], total: 0 })),
        getNotasCredito({ customerId: id, limit: 50 }).catch(() => ({ data: [], total: 0 })),
      ])
      setCustomer(cust)
      setCompany(org)
      setInvoices(invRes.data ?? [])
      setPayments(payRes.data ?? [])
      setEstimates(estRes.data ?? [])
      setCreditNotes(ncRes.data ?? [])
    } catch { message.error('No se pudo cargar el cliente') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const handleDelete = async () => {
    if (!customer?.id) return
    try {
      await deleteCustomer(customer.id)
      message.success('Cliente eliminado')
      navigate('/ventas/clientes')
    } catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
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

  // ── Gráfico ingresos últimos 6 meses ──────────────────────────────────────

  const chartOption = useMemo(() => {
    const months: string[] = []
    const data: number[]   = []
    for (let i = 5; i >= 0; i--) {
      const m  = dayjs().subtract(i, 'month')
      months.push(m.format('MMM YY'))
      const total = invoices
        .filter(inv => {
          const d = dayjs(inv.invoiceDate ?? inv.createdAt)
          return d.year() === m.year() && d.month() === m.month() && inv.status !== 'voided'
        })
        .reduce((s, inv) => s + Number(inv.total ?? 0), 0)
      data.push(Math.round(total * 100) / 100)
    }
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => `${params[0].name}<br/>Q ${Number(params[0].value).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
      },
      grid: { left: 16, right: 16, top: 12, bottom: 28, containLabel: true },
      xAxis: { type: 'category', data: months, axisLabel: { fontSize: 11, color: '#888' }, axisLine: { lineStyle: { color: '#e8e8e8' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#888', formatter: (v: number) => `Q${(v/1000).toFixed(0)}k` } },
      series: [{
        type: 'bar', data, barMaxWidth: 40,
        itemStyle: { color: '#1B3A6B', borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: '#2d5fa6' } },
      }],
    }
  }, [invoices])

  // ── Estado de cuenta ───────────────────────────────────────────────────────

  const statementRows = useMemo(() => {
    const from = stmtRange[0].startOf('day')
    const to   = stmtRange[1].endOf('day')
    const rows: { key: string; date: string; type: string; ref: string; id?: string; route?: string; debit: number; credit: number }[] = []

    invoices.filter(inv => {
      const d = dayjs(inv.invoiceDate ?? inv.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms')) && inv.status !== 'voided'
    }).forEach(inv => rows.push({
      key: inv.id, date: inv.invoiceDate, type: 'Factura', ref: inv.invoiceNumber,
      id: inv.id, route: `/ventas/facturas/${inv.id}`,
      debit: Number(inv.total ?? 0), credit: 0,
    }))

    payments.filter(p => {
      const d = dayjs(p.paymentDate ?? p.createdAt)
      return d.isAfter(from.subtract(1, 'ms')) && d.isBefore(to.add(1, 'ms'))
    }).forEach(p => rows.push({
      key: p.id, date: p.paymentDate, type: 'Pago', ref: p.paymentNumber,
      id: p.id, route: `/ventas/pagos-recibidos/${p.id}`,
      debit: 0, credit: Number(p.amount ?? 0),
    }))

    rows.sort((a, b) => a.date.localeCompare(b.date))

    let balance = 0
    return rows.map(r => {
      balance = balance + r.debit - r.credit
      return { ...r, balance }
    })
  }, [invoices, payments, stmtRange])

  const stmtTotal = statementRows.reduce((s, r) => s + r.debit - r.credit, 0)

  // ── Columnas de tablas ─────────────────────────────────────────────────────

  const invCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 130,
      render: (v: string, r: Invoice) => <Link to={`/ventas/facturas/${r.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = INVOICE_STATUS_CONFIG[v as keyof typeof INVOICE_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
    { title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: Number(v) > 0 ? '#fa8c16' : '#8c8c8c' }}>{fmtQ(Number(v))}</Text> },
  ]

  const payCols = [
    { title: 'Fecha', dataIndex: 'paymentDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'paymentNumber', width: 130,
      render: (v: string, r: PagoRecibido) => <Link to={`/ventas/pagos-recibidos/${r.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Link>,
    },
    { title: 'Modo', dataIndex: 'mode', width: 150, render: (v: string) => <Text style={{ fontSize: 12 }}>{PAYMENT_MODE_LABELS[v as keyof typeof PAYMENT_MODE_LABELS] ?? v ?? '—'}</Text> },
    { title: 'Referencia', dataIndex: 'reference', width: 120, render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Monto', dataIndex: 'amount', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#52c41a' }}>{fmtQ(v)}</Text> },
  ]

  const estCols = [
    { title: 'Fecha', dataIndex: 'estimateDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'estimateNumber', width: 140,
      render: (v: string, r: Estimate) => <Link to={`/ventas/estimaciones/${r.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = ESTIMATE_STATUS_CONFIG[v as keyof typeof ESTIMATE_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(v)}</Text> },
  ]

  const ncCols = [
    { title: 'Fecha', dataIndex: 'invoiceDate', width: 110, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    {
      title: 'Número', dataIndex: 'invoiceNumber', width: 140,
      render: (v: string, r: NotaCredito) => <Link to={`/ventas/notas-credito/${r.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{v}</Link>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => { const c = NC_STATUS_CONFIG[v as keyof typeof NC_STATUS_CONFIG]; return <Tag color={c?.color} style={{ fontSize: 11 }}>{c?.label ?? v}</Tag> },
    },
    { title: 'Total NC', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#cf1322' }}>{fmtQ(v)}</Text> },
    { title: 'Saldo NC', dataIndex: 'creditBalance', align: 'right' as const, width: 120, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#52c41a' }}>{fmtQ(Number(v ?? 0))}</Text> },
  ]

  const stmtCols = [
    { title: 'Fecha', dataIndex: 'date', width: 100, render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
    { title: 'Tipo', dataIndex: 'type', width: 90, render: (v: string) => <Tag color={v === 'Factura' ? 'blue' : 'green'} style={{ fontSize: 11 }}>{v}</Tag> },
    {
      title: 'Referencia', dataIndex: 'ref',
      render: (v: string, r: any) => r.route
        ? <Link to={r.route} style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{v}</Link>
        : <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    { title: 'Cargo', dataIndex: 'debit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Abono', dataIndex: 'credit', align: 'right' as const, width: 120, render: (v: number) => v > 0 ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#52c41a' }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Saldo', dataIndex: 'balance', align: 'right' as const, width: 130,
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: v > 0 ? '#fa8c16' : '#52c41a' }}>{fmtQ(Math.abs(v))}{v < 0 ? ' CR' : ''}</Text>,
    },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!customer) return <div style={{ padding: 40 }}><Text>Cliente no encontrado</Text></div>

  const statusCfg = STATUS_CONFIG[customer.status ?? 'active']
  const isCompany = customer.type !== 'individual'
  const primaryContact = customer.contacts?.find(c => c.isPrimary) ?? customer.contacts?.[0]
  const billingAddr    = customer.billingAddress

  const creditUsed    = saldoPendiente
  const creditPct     = customer.creditLimit && Number(customer.creditLimit) > 0
    ? Math.min(100, Math.round(creditUsed / Number(customer.creditLimit) * 100))
    : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 20, padding: '10px 0', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/clientes')}>
          Clientes
        </Button>
        <Divider type="vertical" />
        {/* Identidad del cliente */}
        <Avatar
          size={40}
          style={{ background: isCompany ? '#1B3A6B' : '#7c3aed', flexShrink: 0 }}
          icon={isCompany ? <BankOutlined /> : <UserOutlined />}
        />
        <div>
          <Title level={5} style={{ margin: 0, color: '#1B3A6B' }}>{customer.name || customer.legalName}</Title>
          {customer.taxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {customer.taxId}</Text>}
        </div>
        <Badge status={statusCfg.color} text={statusCfg.label} style={{ marginLeft: 4 }} />
        <div style={{ flex: 1 }} />
        {/* Acciones */}
        <Button icon={<EditOutlined />} onClick={() => navigate(`/ventas/clientes/${customer.id}/editar`)}>
          Editar
        </Button>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/ventas/facturas/nueva', { state: { customerId: customer.id, customerName: customer.name } })}
          style={{ background: '#1B3A6B' }}
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
          { label: 'Cuentas por cobrar', value: fmtQ(saldoPendiente), color: saldoPendiente > 0 ? '#fa8c16' : '#52c41a', sub: 'Saldo pendiente de pago' },
          { label: 'Total facturado', value: fmtQ(totalFacturado), color: '#1B3A6B', sub: `${invoices.filter(i => i.status !== 'voided').length} facturas` },
          { label: 'Total cobrado', value: fmtQ(totalCobrado), color: '#52c41a', sub: `${payments.length} pagos recibidos` },
          { label: 'Facturas vencidas', value: String(facturasVencidas), color: facturasVencidas > 0 ? '#ff4d4f' : '#52c41a', sub: facturasVencidas > 0 ? 'Requieren seguimiento' : 'Todo al día' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.color}` }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{s.label}</Text>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{s.value}</div>
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

                {/* Columna izquierda: datos de contacto */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Contacto */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                      Contacto
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customer.legalName && customer.legalName !== customer.name && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Razón social SAT</Text>
                          <Text strong style={{ fontSize: 13 }}>{customer.legalName}</Text>
                        </div>
                      )}
                      {customer.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MailOutlined style={{ color: '#1B3A6B', fontSize: 14 }} />
                          <a href={`mailto:${customer.email}`} style={{ fontSize: 13 }}>{customer.email}</a>
                        </div>
                      )}
                      {customer.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PhoneOutlined style={{ color: '#1B3A6B', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{customer.phone}</Text>
                        </div>
                      )}
                      {customer.mobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MobileOutlined style={{ color: '#1B3A6B', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{customer.mobile}</Text>
                        </div>
                      )}
                      {customer.website && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GlobalOutlined style={{ color: '#1B3A6B', fontSize: 14 }} />
                          <a href={customer.website} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{customer.website}</a>
                        </div>
                      )}
                      {!customer.email && !customer.phone && !customer.mobile && (
                        <Text type="secondary" style={{ fontSize: 12 }}>Sin datos de contacto</Text>
                      )}
                    </div>
                  </div>

                  {/* Dirección */}
                  {billingAddr?.address && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                        Dirección de facturación
                      </Text>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <EnvironmentOutlined style={{ color: '#1B3A6B', fontSize: 14, marginTop: 2 }} />
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                          {billingAddr.address && <div>{billingAddr.address}</div>}
                          {billingAddr.street2 && <div>{billingAddr.street2}</div>}
                          {(billingAddr.city || billingAddr.state) && <div>{[billingAddr.city, billingAddr.state].filter(Boolean).join(', ')}</div>}
                          {billingAddr.country && <div>{billingAddr.country}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detalles */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                      Otros detalles
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0', fontSize: 13 }}>
                      <Text type="secondary">N° Cliente</Text>
                      <Text strong style={{ fontFamily: 'monospace' }}>{customer.customerNumber || '—'}</Text>
                      <Text type="secondary">Moneda</Text>
                      <Text>{customer.currency || 'GTQ'}</Text>
                      <Text type="secondary">Términos de pago</Text>
                      <Text>{customer.paymentTerms || '—'}</Text>
                      <Text type="secondary">Tipo fiscal</Text>
                      <Text style={{ fontSize: 12 }}>{TAX_TREATMENT_LABELS[customer.taxTreatment ?? ''] ?? customer.taxTreatment ?? '—'}</Text>
                      {customer.taxCode && <><Text type="secondary">IVA</Text><Tag color="blue" style={{ fontSize: 11 }}>{customer.taxCode}</Tag></>}
                      {customer.tdsEnabled && customer.tdsTaxCode && <><Text type="secondary">ISR</Text><Tag color="purple" style={{ fontSize: 11 }}>{customer.tdsTaxCode}</Tag></>}
                      {customer.ivaRetentionCode && <><Text type="secondary">Ret. IVA</Text><Tag color="orange" style={{ fontSize: 11 }}>{customer.ivaRetentionCode}</Tag></>}
                    </div>
                  </div>

                  {/* Personas de contacto */}
                  {primaryContact && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                        Persona de contacto
                      </Text>
                      {(customer.contacts ?? []).slice(0, 3).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <Avatar size={32} style={{ background: '#1B3A6B', flexShrink: 0 }}>
                            {((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || '?'}
                          </Avatar>
                          <div>
                            <Text strong style={{ fontSize: 13 }}>{[c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ')}</Text>
                            {c.designation && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{c.designation}</Text>}
                            {c.email && <div style={{ fontSize: 12 }}><MailOutlined style={{ marginRight: 4, color: '#888' }} />{c.email}</div>}
                            {c.phone && <div style={{ fontSize: 12 }}><PhoneOutlined style={{ marginRight: 4, color: '#888' }} />{c.phone}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notas */}
                  {customer.notes && (
                    <div style={{ background: '#fffbe6', borderRadius: 10, padding: '14px 16px', border: '1px solid #ffe58f' }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#ad6800', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                        Notas internas
                      </Text>
                      <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{customer.notes}</Text>
                    </div>
                  )}
                </div>

                {/* Columna derecha: balance + gráfico */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* CxC balance box */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
                      Cuentas por cobrar
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <Statistic
                        title={<Text style={{ fontSize: 11, color: '#888' }}>Saldo pendiente</Text>}
                        value={saldoPendiente}
                        precision={2}
                        prefix="Q"
                        valueStyle={{ color: saldoPendiente > 0 ? '#fa8c16' : '#52c41a', fontSize: 20, fontFamily: 'monospace' }}
                        formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      />
                      <Statistic
                        title={<Text style={{ fontSize: 11, color: '#888' }}>Total facturado</Text>}
                        value={totalFacturado}
                        precision={2}
                        prefix="Q"
                        valueStyle={{ color: '#1B3A6B', fontSize: 20, fontFamily: 'monospace' }}
                        formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      />
                    </div>
                    {customer.creditLimit && Number(customer.creditLimit) > 0 && (
                      <div style={{ padding: '10px 14px', background: '#f5f5f5', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 12 }}>Límite de crédito</Text>
                          <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(Number(customer.creditLimit))}</Text>
                        </div>
                        <div style={{ background: '#e8e8e8', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${creditPct}%`, height: '100%', background: creditPct > 80 ? '#ff4d4f' : creditPct > 50 ? '#fa8c16' : '#52c41a', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                          {creditPct}% utilizado — Disponible: {fmtQ(Math.max(0, Number(customer.creditLimit) - creditUsed))}
                        </Text>
                      </div>
                    )}
                  </div>

                  {/* Gráfico ingresos */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Ingresos (últimos 6 meses)
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: 800, color: '#1B3A6B', fontFamily: 'monospace' }}>
                        {fmtQ(invoices.filter(i => {
                          const d = dayjs(i.invoiceDate ?? i.createdAt)
                          return d.isAfter(dayjs().subtract(6, 'month')) && i.status !== 'voided'
                        }).reduce((s, i) => s + Number(i.total ?? 0), 0))}
                      </Text>
                    </div>
                    {invoices.length > 0
                      ? <ReactECharts option={chartOption} style={{ height: 180 }} />
                      : <Empty description="Sin facturas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    }
                  </div>

                  {/* Últimas facturas */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Últimas facturas
                      </Text>
                      <Link to={`/ventas/facturas?customerId=${customer.id}`} style={{ fontSize: 12 }}>Ver todas</Link>
                    </div>
                    {invoices.slice(0, 5).map(inv => {
                      const sCfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
                      return (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <div>
                            <Link to={`/ventas/facturas/${inv.id}`} style={{ fontSize: 13, fontFamily: 'monospace', color: '#1B3A6B' }}>{inv.invoiceNumber}</Link>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{dayjs(inv.invoiceDate).format('DD/MM/YYYY')}</Text>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{fmtQ(Number(inv.total))}</div>
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
                <Tabs
                  type="line"
                  size="small"
                  items={[
                    {
                      key: 'facturas',
                      label: `Facturas (${invoices.length})`,
                      children: (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <Button size="small" type="primary" icon={<PlusOutlined />}
                              style={{ background: '#1B3A6B' }}
                              onClick={() => navigate('/ventas/facturas/nueva', { state: { customerId: customer.id, customerName: customer.name } })}>
                              Nueva factura
                            </Button>
                          </div>
                          <Table columns={invCols} dataSource={invoices} rowKey="id"
                            size="small" pagination={{ pageSize: 10, showTotal: t => `${t} facturas` }}
                            locale={{ emptyText: 'Sin facturas para este cliente' }}
                            style={{ background: '#fff', borderRadius: 8 }} />
                        </div>
                      ),
                    },
                    {
                      key: 'pagos',
                      label: `Pagos recibidos (${payments.length})`,
                      children: (
                        <Table columns={payCols} dataSource={payments} rowKey="id"
                          size="small" pagination={{ pageSize: 10, showTotal: t => `${t} pagos` }}
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
                          <Table columns={estCols} dataSource={estimates} rowKey="id"
                            size="small" pagination={{ pageSize: 10, showTotal: t => `${t} cotizaciones` }}
                            locale={{ emptyText: 'Sin cotizaciones' }}
                            style={{ background: '#fff', borderRadius: 8 }} />
                        </div>
                      ),
                    },
                    {
                      key: 'nc',
                      label: `Notas de crédito (${creditNotes.length})`,
                      children: (
                        <Table columns={ncCols} dataSource={creditNotes} rowKey="id"
                          size="small" pagination={{ pageSize: 10, showTotal: t => `${t} notas` }}
                          locale={{ emptyText: 'Sin notas de crédito' }}
                          style={{ background: '#fff', borderRadius: 8 }} />
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },

          // ── Tab 3: Estado de cuenta ────────────────────────────────────
          {
            key: 'statement',
            label: 'Estado de cuenta',
            children: (
              <div style={{ paddingTop: 8 }}>
                {/* Filtros */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <RangePicker
                    value={stmtRange}
                    onChange={(dates) => { if (dates?.[0] && dates?.[1]) setStmtRange([dates[0], dates[1]]) }}
                    format="DD/MM/YYYY"
                    presets={[
                      { label: 'Este mes', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                      { label: 'Mes anterior', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                      { label: 'Últimos 3 meses', value: [dayjs().subtract(3, 'month').startOf('day'), dayjs()] },
                      { label: 'Este año', value: [dayjs().startOf('year'), dayjs()] },
                    ]}
                  />
                  <Tooltip title="Imprimir estado de cuenta">
                    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir</Button>
                  </Tooltip>
                  <div style={{ marginLeft: 'auto' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Saldo del período: </Text>
                    <Text strong style={{ fontFamily: 'monospace', color: stmtTotal > 0 ? '#fa8c16' : '#52c41a', fontSize: 14 }}>
                      {fmtQ(Math.abs(stmtTotal))}{stmtTotal < 0 ? ' CR' : ''}
                    </Text>
                  </div>
                </div>

                {/* Header del estado */}
                <div style={{ background: '#1B3A6B', borderRadius: '10px 10px 0 0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Estado de cuenta</Text>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{customer.name || customer.legalName}</Text>
                    {customer.taxId && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block' }}>NIT: {customer.taxId}</Text>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, display: 'block' }}>Período</Text>
                    <Text style={{ color: '#fff', fontSize: 13 }}>
                      {stmtRange[0].format('DD/MM/YYYY')} — {stmtRange[1].format('DD/MM/YYYY')}
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
                  rowClassName={(r: any) => r.type === 'Pago' ? '' : ''}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong style={{ fontSize: 12 }}>Total del período</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>
                            {fmtQ(statementRows.reduce((s, r) => s + r.debit, 0))}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                          <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: '#52c41a' }}>
                            {fmtQ(statementRows.reduce((s, r) => s + r.credit, 0))}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                          <Text strong style={{ fontFamily: 'monospace', fontSize: 13, color: stmtTotal > 0 ? '#fa8c16' : '#52c41a' }}>
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
        ]}
      />
    </div>
  )
}
