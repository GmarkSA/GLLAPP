import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Avatar, Badge, Popconfirm, message,
  Tooltip, Popover, Drawer, InputNumber, Divider, Select,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, UserOutlined, BankOutlined, MailOutlined,
  PhoneOutlined, IdcardOutlined, SettingOutlined, FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getVendors, deleteVendor, type Vendor } from '../../../api/contactos'
import { getPaymentTermLabel } from '../../../components/PaymentTermsSelect'
import ColumnConfigurator, {
  loadColConfig, type ColConfig, type ColMeta,
} from '../../../components/ColumnConfigurator'

const { Title, Text } = Typography

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activo',   color: 'success' },
  inactive: { label: 'Inactivo', color: 'default' },
}

const TAX_TREATMENT_CONFIG: Record<string, { label: string; color: string }> = {
  taxable:                { label: 'Contribuyente',  color: '#1faec2'    },
  exempt:                 { label: 'Exento',         color: 'default' },
  contribuyente_especial: { label: 'C. Especial',    color: '#ff7f00'  },
  gobierno:               { label: 'Gobierno',       color: '#6b7280'  },
  exportador:             { label: 'Exportador',     color: 'cyan'    },
}

const TYPE_LABELS: Record<string, string> = {
  individual: 'Persona individual',
  company:    'Empresa',
  employee:   'Empleado',
}

const PAYMENT_TERMS_OPTS = [
  { value: 'immediate', label: 'Inmediato' },
  { value: 'net15',     label: 'Net 15' },
  { value: 'net30',     label: 'Net 30' },
  { value: 'net60',     label: 'Net 60' },
  { value: 'net90',     label: 'Net 90' },
]

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface VendorAdFilters {
  filterName?: string
  filterVendorNumber?: string
  filterLegalName?: string
  filterTaxId?: string
  filterEmail?: string
  filterPhone?: string
  filterCiudad?: string
  filterType?: string[]
  filterTaxTreatment?: string[]
  filterStatus?: string[]
  filterCurrency?: string[]
  filterPaymentTerms?: string[]
  filterBalanceMin?: number | null
  filterBalanceMax?: number | null
}

const EMPTY_FILTERS: VendorAdFilters = {}

function applyVendorFilters(data: Vendor[], f: VendorAdFilters): Vendor[] {
  return data.filter(r => {
    if (f.filterName && !r.name?.toLowerCase().includes(f.filterName.toLowerCase())) return false
    if (f.filterVendorNumber && !r.vendorNumber?.toLowerCase().includes(f.filterVendorNumber.toLowerCase())) return false
    if (f.filterLegalName && !r.legalName?.toLowerCase().includes(f.filterLegalName.toLowerCase())) return false
    if (f.filterTaxId && !r.taxId?.toLowerCase().includes(f.filterTaxId.toLowerCase())) return false
    if (f.filterEmail && !r.email?.toLowerCase().includes(f.filterEmail.toLowerCase())) return false
    if (f.filterPhone && !r.phone?.toLowerCase().includes(f.filterPhone.toLowerCase())) return false
    if (f.filterCiudad && !(r.billingAddress as any)?.city?.toLowerCase().includes(f.filterCiudad.toLowerCase())) return false
    if (f.filterType?.length && !f.filterType.includes(r.type ?? '')) return false
    if (f.filterTaxTreatment?.length && !f.filterTaxTreatment.includes(r.taxTreatment ?? '')) return false
    if (f.filterStatus?.length && !f.filterStatus.includes(r.status ?? '')) return false
    if (f.filterCurrency?.length && !f.filterCurrency.includes(r.currency ?? '')) return false
    if (f.filterPaymentTerms?.length && !f.filterPaymentTerms.includes(r.paymentTerms ?? '')) return false
    if (f.filterBalanceMin != null && Number(r.balance ?? 0) < f.filterBalanceMin) return false
    if (f.filterBalanceMax != null && Number(r.balance ?? 0) > f.filterBalanceMax) return false
    return true
  })
}

// ── Configurador de columnas ──────────────────────────────────────────────────
const STORAGE_KEY = 'contaerp_cols_proveedores'

const ALL_COL_META: ColMeta[] = [
  { key: 'nombre',        label: 'Proveedor',        description: 'Avatar + nombre + razón social + NIT (vista compacta)' },
  { key: 'vendorNumber',  label: 'N° Proveedor' },
  { key: 'type',          label: 'Tipo',             description: 'Individual, Empresa o Empleado' },
  { key: 'legalName',     label: 'Razón Social SAT',  description: 'Nombre fiscal registrado en SAT' },
  { key: 'taxId',         label: 'NIT',              description: 'Columna separada solo con el NIT' },
  { key: 'contacto',      label: 'Contacto',         description: 'Email y teléfono combinados' },
  { key: 'email',         label: 'Email' },
  { key: 'phone',         label: 'Teléfono' },
  { key: 'mobile',        label: 'Celular' },
  { key: 'currency',      label: 'Moneda' },
  { key: 'paymentTerms',  label: 'Términos de pago' },
  { key: 'taxTreatment',  label: 'Tipo fiscal' },
  { key: 'impuesto',      label: 'Impuesto',         description: 'IVA, ISR y retenciones asignadas' },
  { key: 'balance',       label: 'Saldo' },
  { key: 'status',        label: 'Estado' },
  { key: 'ciudad',        label: 'Ciudad' },
  { key: 'notes',         label: 'Notas' },
]

const DEFAULT_COL_CONFIG: ColConfig[] = ALL_COL_META.map((c, i) => ({
  key: c.key,
  visible: ['nombre', 'contacto', 'taxTreatment', 'impuesto', 'balance', 'status'].includes(c.key),
  sortOrder: i + 1,
}))

const COL_WIDTHS: Record<string, number> = {
  nombre: 260, vendorNumber: 120, type: 130, legalName: 200,
  taxId: 110, contacto: 200, email: 180, phone: 120,
  mobile: 120, currency: 80, paymentTerms: 140,
  taxTreatment: 145, impuesto: 120,
  balance: 110, status: 100, ciudad: 120, notes: 160,
}

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(key: string, navigate: (p: string) => void): ColumnsType<Vendor>[number] | null {
  const base = { key }
  switch (key) {
    case 'nombre':
      return { ...base, title: 'Proveedor', width: 260, fixed: 'left' as const,
        sorter: (a: Vendor, b: Vendor) => (a.name ?? '').localeCompare(b.name ?? ''),
        render: (_: any, r: Vendor) => (
          <Space>
            <Avatar
              style={{
                background: r.type === 'employee' ? '#ff7f00' : r.type === 'individual' ? '#ff7f00' : '#1faec2',
                flexShrink: 0,
              }}
              size={36}
              icon={r.type === 'employee' ? <IdcardOutlined /> : r.type === 'individual' ? <UserOutlined /> : <BankOutlined />}
            >
              {!r.name ? 'P' : r.name[0]}
            </Avatar>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/compras/proveedores/${r.id}`)}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1faec2', lineHeight: 1.3 }}>{r.name}</div>
              {r.legalName && r.legalName !== r.name && (
                <Text type="secondary" style={{ fontSize: 11 }}>{r.legalName}</Text>
              )}
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {r.vendorNumber}{r.taxId && ` · NIT: ${r.taxId}`}
              </div>
            </div>
          </Space>
        ) }
    case 'vendorNumber':
      return { ...base, title: 'N° Proveedor', dataIndex: 'vendorNumber', width: 120,
        sorter: (a: Vendor, b: Vendor) => (a.vendorNumber ?? '').localeCompare(b.vendorNumber ?? ''),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'type':
      return { ...base, title: 'Tipo', dataIndex: 'type', width: 130,
        sorter: (a: Vendor, b: Vendor) => (a.type ?? '').localeCompare(b.type ?? ''),
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{TYPE_LABELS[v] ?? v}</Tag> }
    case 'legalName':
      return { ...base, title: 'Razón Social SAT', dataIndex: 'legalName', width: 200, ellipsis: true,
        sorter: (a: Vendor, b: Vendor) => (a.legalName ?? '').localeCompare(b.legalName ?? ''),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'taxId':
      return { ...base, title: 'NIT', dataIndex: 'taxId', width: 110,
        sorter: (a: Vendor, b: Vendor) => (a.taxId ?? '').localeCompare(b.taxId ?? ''),
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'contacto':
      return { ...base, title: 'Contacto', width: 200,
        render: (_: any, r: Vendor) => (
          <div style={{ fontSize: 12 }}>
            {r.email && <div><MailOutlined style={{ color: '#6b7280', marginRight: 4 }} />{r.email}</div>}
            {r.phone && <div style={{ marginTop: 2 }}><PhoneOutlined style={{ color: '#6b7280', marginRight: 4 }} />{r.phone}</div>}
          </div>
        ) }
    case 'email':
      return { ...base, title: 'Email', dataIndex: 'email', width: 180, ellipsis: true,
        sorter: (a: Vendor, b: Vendor) => (a.email ?? '').localeCompare(b.email ?? ''),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'phone':
      return { ...base, title: 'Teléfono', dataIndex: 'phone', width: 120,
        sorter: (a: Vendor, b: Vendor) => (a.phone ?? '').localeCompare(b.phone ?? ''),
        render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> }
    case 'mobile':
      return { ...base, title: 'Celular', dataIndex: 'mobile', width: 120,
        sorter: (a: Vendor, b: Vendor) => (a.mobile ?? '').localeCompare(b.mobile ?? ''),
        render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> }
    case 'currency':
      return { ...base, title: 'Moneda', dataIndex: 'currency', width: 80,
        sorter: (a: Vendor, b: Vendor) => (a.currency ?? '').localeCompare(b.currency ?? ''),
        render: (v: string) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text> }
    case 'paymentTerms':
      return { ...base, title: 'Términos pago', dataIndex: 'paymentTerms', width: 140,
        sorter: (a: Vendor, b: Vendor) => (a.paymentTerms ?? '').localeCompare(b.paymentTerms ?? ''),
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{getPaymentTermLabel(v)}</Text> : <Text type="secondary">—</Text> }
    case 'taxTreatment':
      return { ...base, title: 'Tipo fiscal', dataIndex: 'taxTreatment', width: 145,
        sorter: (a: Vendor, b: Vendor) => (a.taxTreatment ?? '').localeCompare(b.taxTreatment ?? ''),
        render: (v: string) => {
          const c = TAX_TREATMENT_CONFIG[v]
          return c ? <Tag color={c.color}>{c.label}</Tag> : <Tag>{v}</Tag>
        } }
    case 'impuesto':
      return { ...base, title: 'Impuesto', width: 120,
        render: (_: any, r: Vendor) => (
          <Space size={4} direction="vertical" style={{ gap: 2 }}>
            {r.tdsEnabled && r.tdsTaxCode && <Tag color="#6b7280" style={{ fontSize: 11 }}>ISR: {r.tdsTaxCode}</Tag>}
            {r.ivaRetentionCode && <Tag color="#ff7f00" style={{ fontSize: 11 }}>{r.ivaRetentionCode}</Tag>}
          </Space>
        ) }
    case 'balance':
      return { ...base, title: 'Saldo', dataIndex: 'balance', width: 110, align: 'right' as const,
        sorter: (a: Vendor, b: Vendor) => Number(a.balance ?? 0) - Number(b.balance ?? 0),
        render: (v: number) => (
          <Text strong style={{ color: Number(v) > 0 ? '#1faec2' : '#6b7280' }}>
            {Number(v) > 0 ? fmtQ(v) : '—'}
          </Text>
        ) }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 100,
        sorter: (a: Vendor, b: Vendor) => (a.status ?? '').localeCompare(b.status ?? ''),
        render: (v: string) => {
          const c = STATUS_CONFIG[v ?? 'active']
          return <Badge status={c?.color as any} text={c?.label} />
        } }
    case 'ciudad':
      return { ...base, title: 'Ciudad', width: 120,
        sorter: (a: Vendor, b: Vendor) => ((a.billingAddress as any)?.city ?? '').localeCompare((b.billingAddress as any)?.city ?? ''),
        render: (_: any, r: Vendor) => {
          const city = (r.billingAddress as any)?.city
          return city ? <Text style={{ fontSize: 12 }}>{city}</Text> : <Text type="secondary">—</Text>
        } }
    case 'notes':
      return { ...base, title: 'Notas', dataIndex: 'notes', width: 160, ellipsis: true,
        sorter: (a: Vendor, b: Vendor) => (a.notes ?? '').localeCompare(b.notes ?? ''),
        render: (v: string) => v
          ? <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
          : <Text type="secondary">—</Text> }
    default: return null
  }
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)

  // Column config
  const [colConfig,  setColConfig]  = useState<ColConfig[]>(() => loadColConfig(STORAGE_KEY, ALL_COL_META, DEFAULT_COL_CONFIG))
  const [colPopover, setColPopover] = useState(false)

  // Filtros avanzados
  const [vFilters,     setVFilters]     = useState<VendorAdFilters>(EMPTY_FILTERS)
  const [vDraft,       setVDraft]       = useState<VendorAdFilters>(EMPTY_FILTERS)
  const [vFilterOpen,  setVFilterOpen]  = useState(false)

  const activeCount = useMemo(() =>
    Object.entries(vFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [vFilters])

  const filteredVendors = useMemo(() => applyVendorFilters(vendors, vFilters), [vendors, vFilters])

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVendors({ search, page, limit: 20 })
      if (Array.isArray(res)) { setVendors(res); setTotal(res.length) }
      else { setVendors(res.data ?? res.items ?? []); setTotal(res.meta?.total ?? res.total ?? 0) }
    } catch { setVendors([]); setTotal(0) }
    finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const handleDelete = async (id: string) => {
    try { await deleteVendor(id); message.success('Proveedor eliminado'); fetchVendors() }
    catch (e: any) { message.error(e?.response?.data?.message || 'No se pudo eliminar') }
  }

  const openFilters = () => { setVDraft(vFilters); setVFilterOpen(true) }
  const applyFilters = () => { setVFilters(vDraft); setVFilterOpen(false) }
  const clearFilters = () => { const e = EMPTY_FILTERS; setVDraft(e); setVFilters(e) }

  // ── Scroll horizontal dinámico según columnas visibles ──────────────────────
  const scrollX = useMemo(() => {
    const dataWidth = colConfig
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (COL_WIDTHS[c.key] ?? 120), 0)
    return dataWidth + 120 // +acciones
  }, [colConfig])

  // ── Columnas dinámicas ──────────────────────────────────────────────────────
  const activeColumns: ColumnsType<Vendor> = [
    ...[...colConfig]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter(c => c.visible)
      .map(c => buildColDef(c.key, navigate))
      .filter((c): c is ColumnsType<Vendor>[number] => c !== null),
    {
      key: '_actions',
      title: 'Acciones',
      align: 'center' as const,
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: Vendor) => (
        <Space size={6}>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/compras/proveedores/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => navigate(`/compras/proveedores/${r.id}/editar`)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Popconfirm
              title="¿Eliminar este proveedor?"
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
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Proveedores</Title>
            <Text type="secondary">Datos maestros de proveedores vinculados a impuestos y contabilidad</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/compras/proveedores/nuevo')} style={{ background: '#1faec2' }}>
          <span data-tour="compras-proveedor-nuevo">Nuevo proveedor</span>
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
          <Badge count={activeCount} size="small">
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
        <Table
          columns={activeColumns}
          dataSource={filteredVendors}
          rowKey="id"
          loading={loading}
          size="middle"
          showSorterTooltip={false}
          scroll={{ x: scrollX, y: 'calc(100vh - 312px)' }}
          onRow={(r) => ({ onDoubleClick: () => navigate(`/compras/proveedores/${r.id}`) })}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} proveedores`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin proveedores — crea el primero con "Nuevo proveedor"' }}
        />
      </Card>

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={360}
        open={vFilterOpen}
        onClose={() => setVFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyFilters}>Aplicar</Button>
          </Space>
        }
      >
        {/* Identificación */}
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Identificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="Nombre" size="small" value={vDraft.filterName ?? ''} onChange={e => setVDraft(d => ({ ...d, filterName: e.target.value || undefined }))} allowClear />
          <Input placeholder="N° Proveedor" size="small" value={vDraft.filterVendorNumber ?? ''} onChange={e => setVDraft(d => ({ ...d, filterVendorNumber: e.target.value || undefined }))} allowClear />
          <Input placeholder="Razón Social SAT" size="small" value={vDraft.filterLegalName ?? ''} onChange={e => setVDraft(d => ({ ...d, filterLegalName: e.target.value || undefined }))} allowClear />
          <Input placeholder="NIT" size="small" value={vDraft.filterTaxId ?? ''} onChange={e => setVDraft(d => ({ ...d, filterTaxId: e.target.value || undefined }))} allowClear />
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Contacto */}
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Contacto</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="Email" size="small" value={vDraft.filterEmail ?? ''} onChange={e => setVDraft(d => ({ ...d, filterEmail: e.target.value || undefined }))} allowClear />
          <Input placeholder="Teléfono" size="small" value={vDraft.filterPhone ?? ''} onChange={e => setVDraft(d => ({ ...d, filterPhone: e.target.value || undefined }))} allowClear />
          <Input placeholder="Ciudad" size="small" value={vDraft.filterCiudad ?? ''} onChange={e => setVDraft(d => ({ ...d, filterCiudad: e.target.value || undefined }))} allowClear />
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Clasificación */}
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Clasificación</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Select
            mode="multiple" size="small" placeholder="Tipo"
            value={vDraft.filterType ?? []}
            onChange={v => setVDraft(d => ({ ...d, filterType: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(TYPE_LABELS).map(([k, label]) => ({ value: k, label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Tipo fiscal"
            value={vDraft.filterTaxTreatment ?? []}
            onChange={v => setVDraft(d => ({ ...d, filterTaxTreatment: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(TAX_TREATMENT_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Estado"
            value={vDraft.filterStatus ?? []}
            onChange={v => setVDraft(d => ({ ...d, filterStatus: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            mode="multiple" size="small" placeholder="Moneda"
            value={vDraft.filterCurrency ?? []}
            onChange={v => setVDraft(d => ({ ...d, filterCurrency: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={[{ value: 'GTQ', label: 'GTQ' }, { value: 'USD', label: 'USD' }]}
          />
          <Select
            mode="multiple" size="small" placeholder="Términos de pago"
            value={vDraft.filterPaymentTerms ?? []}
            onChange={v => setVDraft(d => ({ ...d, filterPaymentTerms: v.length ? v : undefined }))}
            allowClear style={{ width: '100%' }}
            options={PAYMENT_TERMS_OPTS}
          />
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Saldo */}
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Saldo</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber
            placeholder="Mín" size="small" style={{ width: '100%' }}
            value={vDraft.filterBalanceMin ?? null}
            onChange={v => setVDraft(d => ({ ...d, filterBalanceMin: v ?? null }))}
            min={0} prefix="Q"
          />
          <InputNumber
            placeholder="Máx" size="small" style={{ width: '100%' }}
            value={vDraft.filterBalanceMax ?? null}
            onChange={v => setVDraft(d => ({ ...d, filterBalanceMax: v ?? null }))}
            min={0} prefix="Q"
          />
        </div>
      </Drawer>
    </div>
  )
}
