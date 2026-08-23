import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Avatar, Badge, Tooltip, Popconfirm, message,
  Select, Popover, Drawer, InputNumber, Divider,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, UserOutlined, BankOutlined, MailOutlined,
  PhoneOutlined, SettingOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getCustomers, deleteCustomer, type Customer } from '../../../api/contactos'
import { getPaymentTermLabel } from '../../../components/PaymentTermsSelect'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'
import ResponsiveTable from '../../../components/responsive/ResponsiveTable'
import MobileCard from '../../../components/responsive/MobileCard'

const { Title, Text } = Typography
const { Option } = Select

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:      { label: 'Activo',    color: 'success' },
  inactive:    { label: 'Inactivo',  color: 'default' },
  blacklisted: { label: 'Bloqueado', color: 'error'   },
}

const TAX_TREATMENT_CONFIG: Record<string, { label: string; color: string }> = {
  taxable:               { label: 'Contribuyente',  color: '#1faec2'    },
  exempt:                { label: 'Exento',         color: 'default' },
  contribuyente_especial:{ label: 'C. Especial',    color: '#ff7f00'  },
  gobierno:              { label: 'Gobierno',       color: '#6b7280'  },
  exportador:            { label: 'Exportador',     color: 'cyan'    },
}

const TYPE_LABELS: Record<string, string> = {
  individual: 'Persona individual',
  company:    'Empresa',
  employee:   'Empleado',
}

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_clientes'

const ALL_COL_META: ColMeta[] = [
  { key: 'nombre',       label: 'Cliente',          description: 'Avatar + nombre + razón social + NIT (vista compacta)' },
  { key: 'customerNumber',label: 'N° Cliente' },
  { key: 'type',         label: 'Tipo',             description: 'Individual, Empresa o Empleado' },
  { key: 'legalName',    label: 'Razón Social SAT',  description: 'Nombre fiscal registrado en SAT' },
  { key: 'taxId',        label: 'NIT',              description: 'Columna separada solo con el NIT' },
  { key: 'contacto',     label: 'Contacto',         description: 'Email y teléfono combinados' },
  { key: 'email',        label: 'Email',            description: 'Columna separada solo con email' },
  { key: 'phone',        label: 'Teléfono' },
  { key: 'mobile',       label: 'Celular' },
  { key: 'website',      label: 'Sitio web' },
  { key: 'currency',     label: 'Moneda' },
  { key: 'paymentTerms', label: 'Términos de pago' },
  { key: 'creditLimit',  label: 'Límite de crédito' },
  { key: 'taxTreatment', label: 'Tipo fiscal' },
  { key: 'impuesto',     label: 'Impuesto',         description: 'IVA, ISR y retenciones asignadas' },
  { key: 'taxCode',      label: 'Código IVA' },
  { key: 'balance',      label: 'Saldo' },
  { key: 'status',       label: 'Estado' },
  { key: 'ciudad',       label: 'Ciudad' },
  { key: 'notes',        label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['nombre', 'contacto', 'taxTreatment', 'impuesto', 'balance', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

const COL_WIDTHS: Record<string, number> = {
  nombre: 260, customerNumber: 110, type: 130, legalName: 200,
  taxId: 110, contacto: 200, email: 180, phone: 120,
  mobile: 120, website: 160, currency: 80, paymentTerms: 140,
  creditLimit: 120, taxTreatment: 145, impuesto: 120, taxCode: 110,
  balance: 110, status: 100, ciudad: 120, notes: 160,
}

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface CustomerFilters {
  filterName?: string
  filterCustomerNumber?: string
  filterLegalName?: string
  filterTaxId?: string
  filterEmail?: string
  filterPhone?: string
  filterType?: string[]
  filterTaxTreatment?: string[]
  filterStatus?: string[]
  filterCurrency?: string[]
  filterPaymentTerms?: string[]
  filterCreditLimitMin?: number | null
  filterCreditLimitMax?: number | null
  filterCiudad?: string
}

function toApiParams(f: CustomerFilters): Record<string, any> {
  const p: Record<string, any> = {}
  if (f.filterName)           p.filterName           = f.filterName
  if (f.filterCustomerNumber) p.filterCustomerNumber = f.filterCustomerNumber
  if (f.filterLegalName)      p.filterLegalName      = f.filterLegalName
  if (f.filterTaxId)          p.filterTaxId          = f.filterTaxId
  if (f.filterEmail)          p.filterEmail          = f.filterEmail
  if (f.filterPhone)          p.filterPhone          = f.filterPhone
  if (f.filterCiudad)         p.filterCiudad         = f.filterCiudad
  if (f.filterType?.length)          p.filterType          = f.filterType!.join(',')
  if (f.filterTaxTreatment?.length)  p.filterTaxTreatment  = f.filterTaxTreatment!.join(',')
  if (f.filterStatus?.length)        p.filterStatus        = f.filterStatus!.join(',')
  if (f.filterCurrency?.length)      p.filterCurrency      = f.filterCurrency!.join(',')
  if (f.filterPaymentTerms?.length)  p.filterPaymentTerms  = f.filterPaymentTerms!.join(',')
  if (f.filterCreditLimitMin != null) p.filterCreditLimitMin = f.filterCreditLimitMin
  if (f.filterCreditLimitMax != null) p.filterCreditLimitMax = f.filterCreditLimitMax
  return p
}

const PAYMENT_TERMS_OPTS = [
  { value: 'immediate', label: 'Pago inmediato' },
  { value: 'net_7',     label: '7 días neto' },
  { value: 'net_10',    label: '10 días neto' },
  { value: 'net_15',    label: '15 días neto' },
  { value: 'net_30',    label: '30 días neto' },
  { value: 'net_45',    label: '45 días neto' },
  { value: 'net_60',    label: '60 días neto' },
  { value: 'net_90',    label: '90 días neto' },
  { value: 'net_120',   label: '120 días neto' },
  { value: 'custom',    label: 'Personalizado' },
]

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(key: string, navigate: (p: string) => void, handleDelete: (id: string) => void): ColumnsType<Customer>[number] | null {
  const base = { key }
  switch (key) {
    case 'nombre':
      return { ...base, title: 'Cliente', dataIndex: 'name', width: 260, fixed: 'left' as const,
        sorter: (a: Customer, b: Customer) => String(a.name ?? '').localeCompare(String(b.name ?? '')),
        render: (_: any, r: Customer) => (
          <Space>
            <Avatar
              style={{ background: r.type === 'individual' ? '#ff7f00' : '#1faec2', flexShrink: 0 }}
              size={36}
              icon={r.type === 'individual' ? <UserOutlined /> : <BankOutlined />}
            >
              {!r.name ? 'C' : r.name[0]}
            </Avatar>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/ventas/clientes/${r.id}`)}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1faec2', lineHeight: 1.3 }}>{r.name}</div>
              {r.legalName && r.legalName !== r.name && (
                <Text type="secondary" style={{ fontSize: 11 }}>{r.legalName}</Text>
              )}
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {r.customerNumber}{r.taxId && ` · NIT: ${r.taxId}`}
              </div>
            </div>
          </Space>
        ) }
    case 'customerNumber':
      return { ...base, title: 'N° Cliente', dataIndex: 'customerNumber', width: 110,
        sorter: (a: Customer, b: Customer) => String(a.customerNumber ?? '').localeCompare(String(b.customerNumber ?? '')),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'type':
      return { ...base, title: 'Tipo', dataIndex: 'type', width: 130,
        sorter: (a: Customer, b: Customer) => String(a.type ?? '').localeCompare(String(b.type ?? '')),
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{TYPE_LABELS[v] ?? v}</Tag> }
    case 'legalName':
      return { ...base, title: 'Razón Social SAT', dataIndex: 'legalName', width: 200, ellipsis: true,
        sorter: (a: Customer, b: Customer) => String(a.legalName ?? '').localeCompare(String(b.legalName ?? '')),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'taxId':
      return { ...base, title: 'NIT', dataIndex: 'taxId', width: 110,
        sorter: (a: Customer, b: Customer) => String(a.taxId ?? '').localeCompare(String(b.taxId ?? '')),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'contacto':
      return { ...base, title: 'Contacto', width: 200,
        render: (_: any, r: Customer) => (
          <div style={{ fontSize: 12 }}>
            {r.email && <div><MailOutlined style={{ color: '#6b7280', marginRight: 4 }} />{r.email}</div>}
            {r.phone && <div style={{ marginTop: 2 }}><PhoneOutlined style={{ color: '#6b7280', marginRight: 4 }} />{r.phone}</div>}
          </div>
        ) }
    case 'email':
      return { ...base, title: 'Email', dataIndex: 'email', width: 180, ellipsis: true,
        sorter: (a: Customer, b: Customer) => String(a.email ?? '').localeCompare(String(b.email ?? '')),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'phone':
      return { ...base, title: 'Teléfono', dataIndex: 'phone', width: 120,
        render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> }
    case 'mobile':
      return { ...base, title: 'Celular', dataIndex: 'mobile', width: 120,
        render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> }
    case 'website':
      return { ...base, title: 'Sitio web', dataIndex: 'website', width: 160, ellipsis: true,
        render: (v: string) => v ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        render: (v: string) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text> }
    case 'paymentTerms':
      return { ...base, title: 'Términos pago', dataIndex: 'paymentTerms', width: 140,
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{getPaymentTermLabel(v)}</Text> : <Text type="secondary">—</Text> }
    case 'creditLimit':
      return { ...base, title: 'Límite crédito', dataIndex: 'creditLimit', width: 120, align: 'right' as const,
        sorter: (a: Customer, b: Customer) => Number(a.creditLimit ?? 0) - Number(b.creditLimit ?? 0),
        render: (v: number) => Number(v) > 0 ? <Text style={{ fontSize: 12 }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> }
    case 'taxTreatment':
      return { ...base, title: 'Tipo fiscal', dataIndex: 'taxTreatment', width: 145,
        sorter: (a: Customer, b: Customer) => String(a.taxTreatment ?? '').localeCompare(String(b.taxTreatment ?? '')),
        render: (v: string) => {
          const c = TAX_TREATMENT_CONFIG[v]
          return c ? <Tag color={c.color}>{c.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'impuesto':
      return { ...base, title: 'Impuesto', width: 120,
        render: (_: any, r: Customer) => (
          <Space size={4} direction="vertical" style={{ gap: 2 }}>
            {r.taxCode        && <Tag color="#1faec2"   style={{ fontSize: 11 }}>{r.taxCode}</Tag>}
            {r.tdsEnabled && r.tdsTaxCode && <Tag color="#6b7280" style={{ fontSize: 11 }}>ISR: {r.tdsTaxCode}</Tag>}
            {r.ivaRetentionCode && <Tag color="#ff7f00" style={{ fontSize: 11 }}>{r.ivaRetentionCode}</Tag>}
          </Space>
        ) }
    case 'taxCode':
      return { ...base, title: 'Código IVA', dataIndex: 'taxCode', width: 110,
        render: (v: string) => v ? <Tag color="#1faec2" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text> }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 110, align: 'right' as const,
        sorter: (a: Customer, b: Customer) => Number(a.balance ?? 0) - Number(b.balance ?? 0),
        render: (v: number) => (
          <Text strong style={{ color: Number(v) > 0 ? '#1faec2' : '#6b7280' }}>
            {Number(v) > 0 ? fmtQ(v) : '—'}
          </Text>
        ) }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 100,
        sorter: (a: Customer, b: Customer) => String(a.status ?? '').localeCompare(String(b.status ?? '')),
        render: (v: string) => {
          const c = STATUS_CONFIG[v ?? 'active']
          return <Badge status={c?.color as any} text={c?.label} />
        } }
    case 'ciudad':
      return { ...base, title: 'Ciudad', width: 120,
        render: (_: any, r: Customer) => {
          const city = r.billingAddress?.city
          return city ? <Text style={{ fontSize: 12 }}>{city}</Text> : <Text type="secondary">—</Text>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ClientesPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)

  // Column config
  const [colConfig,  setColConfig]  = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Filtros avanzados
  const [filters,    setFilters]    = useState<CustomerFilters>({})
  const [draft,      setDraft]      = useState<CustomerFilters>({})
  const [filterOpen, setFilterOpen] = useState(false)

  const activeCount = useMemo(() => [
    filters.filterName, filters.filterCustomerNumber, filters.filterLegalName,
    filters.filterTaxId, filters.filterEmail, filters.filterPhone, filters.filterCiudad,
    filters.filterType?.length       ? 1 : undefined,
    filters.filterTaxTreatment?.length ? 1 : undefined,
    filters.filterStatus?.length     ? 1 : undefined,
    filters.filterCurrency?.length   ? 1 : undefined,
    filters.filterPaymentTerms?.length ? 1 : undefined,
    filters.filterCreditLimitMin != null ? 1 : undefined,
    filters.filterCreditLimitMax != null ? 1 : undefined,
  ].filter(Boolean).length, [filters])

  const openFilters  = () => { setDraft({ ...filters }); setFilterOpen(true) }
  const applyFilters = () => { setFilters({ ...draft }); setPage(1); setFilterOpen(false) }
  const clearFilters = () => { setDraft({}); setFilters({}); setPage(1); setFilterOpen(false) }

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCustomers({ search, page, limit: 20, ...toApiParams(filters) })
      if (Array.isArray(res)) { setCustomers(res); setTotal(res.length) }
      else { setCustomers(res.data ?? res.items ?? []); setTotal(res.meta?.total ?? res.total ?? 0) }
    } catch { setCustomers([]); setTotal(0) }
    finally { setLoading(false) }
  }, [search, page, filters])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const handleDelete = async (id: string) => {
    try { await deleteCustomer(id); message.success('Cliente eliminado'); fetchCustomers() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 120 // +acciones
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<Customer> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key, navigate, handleDelete))
      .filter((c): c is ColumnsType<Customer>[number] => c !== null),
    {
      key: '_actions',
      title: 'Acciones',
      align: 'center' as const,
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: Customer) => (
        <Space size={6}>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/ventas/clientes/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => navigate(`/ventas/clientes/${r.id}/editar`)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Popconfirm
              title="¿Eliminar este cliente?"
              onConfirm={() => handleDelete(r.id!)}
              okText="Sí" cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Clientes</Title>
            <Text type="secondary">Datos maestros de clientes vinculados a impuestos y contabilidad</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ventas/clientes/nuevo')} style={{ background: '#1faec2' }}>
          <span data-tour="ventas-cliente-nuevo">Nuevo cliente</span>
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Input
            placeholder="Buscar por nombre, NIT, correo..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Badge count={activeCount} size="small" color="#1faec2" offset={[-4, 4]}>
            <Button
              icon={<FilterOutlined />}
              onClick={openFilters}
              style={activeCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
            >
              Filtros
            </Button>
          </Badge>
          <Popover
            open={colPopover}
            onOpenChange={setColPopover}
            trigger="click"
            placement="bottomRight"
            title={null}
            content={
              <ColumnConfigurator
                config={colConfig}
                allColMeta={ALL_COL_META}
                defaultConfig={DEFAULT_COL_CONFIG}
                storageKey={STORAGE_KEY}
                onChange={setColConfig}
              />
            }
          >
            <Tooltip title="Configurar columnas">
              <Button
                size="small"
                icon={<SettingOutlined />}
                style={{ border: colPopover ? '1px solid #1faec2' : undefined, color: colPopover ? '#1faec2' : undefined }}
              >
                Columnas
              </Button>
            </Tooltip>
          </Popover>
        </Space>
      </Card>

      {/* Tabla */}
      <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: 0 }}>
        <ResponsiveTable
          columns={activeColumns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          size="middle"
          showSorterTooltip={false}
          scroll={{ x: scrollX, y: 'calc(100vh - 312px)' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/ventas/clientes/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} clientes`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin clientes — crea el primero con "Nuevo cliente"' }}
          mobileEmptyText='Sin clientes — crea el primero con "Nuevo cliente"'
          renderMobileCard={(r: Customer) => {
            const st = STATUS_CONFIG[r.status ?? 'active']
            return (
              <MobileCard
                title={r.name}
                subtitle={
                  <span>
                    {r.taxId ? `NIT: ${r.taxId}` : (r.customerNumber || '—')}
                    {(r.email || r.phone) && <><br />{r.email || r.phone}</>}
                  </span>
                }
                amount={Number(r.balance) > 0 ? fmtQ(Number(r.balance)) : undefined}
                status={st ? <Tag color={st.color} style={{ margin: 0 }}>{st.label}</Tag> : undefined}
                onClick={() => navigate(`/ventas/clientes/${r.id}`)}
              />
            )
          }}
        />
      </Card>

      {/* ── Drawer filtros avanzados ─────────────────────────────────────────── */}
      <Drawer
        title={<Space><FilterOutlined style={{ color: '#1faec2' }} /><span>Filtros avanzados</span></Space>}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        width={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={clearFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyFilters}>
              Aplicar filtros{activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>

          {/* Identificación */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Identificación</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Nombre</div>
            <Input size="small" allowClear placeholder="Buscar nombre..."
              value={draft.filterName ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterName: e.target.value || undefined }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>N° Cliente</div>
            <Input size="small" allowClear placeholder="CLI-00001..."
              value={draft.filterCustomerNumber ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterCustomerNumber: e.target.value || undefined }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Razón Social SAT</div>
            <Input size="small" allowClear placeholder="Razón social registrada en SAT..."
              value={draft.filterLegalName ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterLegalName: e.target.value || undefined }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>NIT</div>
            <Input size="small" allowClear placeholder="12345678..."
              value={draft.filterTaxId ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterTaxId: e.target.value || undefined }))} />
          </div>

          {/* Contacto */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Contacto</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Email</div>
            <Input size="small" allowClear placeholder="correo@..."
              value={draft.filterEmail ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterEmail: e.target.value || undefined }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Teléfono</div>
            <Input size="small" allowClear placeholder="502..."
              value={draft.filterPhone ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterPhone: e.target.value || undefined }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Ciudad</div>
            <Input size="small" allowClear placeholder="Guatemala, Mixco, Quetzaltenango..."
              value={draft.filterCiudad ?? ''}
              onChange={e => setDraft(d => ({ ...d, filterCiudad: e.target.value || undefined }))} />
          </div>

          {/* Clasificación */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Clasificación</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Tipo</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todos"
              value={draft.filterType ?? []}
              onChange={v => setDraft(d => ({ ...d, filterType: v.length ? v : undefined }))}>
              <Option value="individual">Individual</Option>
              <Option value="company">Empresa</Option>
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Tipo fiscal</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todos"
              value={draft.filterTaxTreatment ?? []}
              onChange={v => setDraft(d => ({ ...d, filterTaxTreatment: v.length ? v : undefined }))}>
              {Object.entries(TAX_TREATMENT_CONFIG).map(([k, v]) => (
                <Option key={k} value={k}><Tag color={v.color} style={{ margin: 0 }}>{v.label}</Tag></Option>
              ))}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Estado</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todos"
              value={draft.filterStatus ?? []}
              onChange={v => setDraft(d => ({ ...d, filterStatus: v.length ? v : undefined }))}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <Option key={k} value={k}>{v.label}</Option>
              ))}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Moneda</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todas"
              value={draft.filterCurrency ?? []}
              onChange={v => setDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))}>
              <Option value="GTQ">GTQ — Quetzal</Option>
              <Option value="USD">USD — Dólar</Option>
            </Select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Términos de pago</div>
            <Select mode="multiple" size="small" style={{ width: '100%' }} allowClear placeholder="Todos"
              value={draft.filterPaymentTerms ?? []}
              onChange={v => setDraft(d => ({ ...d, filterPaymentTerms: v.length ? v : undefined }))}>
              {PAYMENT_TERMS_OPTS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </div>

          {/* Límite de crédito */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Límite de crédito</Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Desde</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} placeholder="0.00" addonBefore="Q"
              value={draft.filterCreditLimitMin ?? null}
              onChange={v => setDraft(d => ({ ...d, filterCreditLimitMin: v ?? null }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Hasta</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} placeholder="sin límite" addonBefore="Q"
              value={draft.filterCreditLimitMax ?? null}
              onChange={v => setDraft(d => ({ ...d, filterCreditLimitMax: v ?? null }))} />
          </div>

        </div>
      </Drawer>
    </div>
  )
}
