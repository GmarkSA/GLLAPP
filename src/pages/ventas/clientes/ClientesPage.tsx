import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Tag, Space, Typography, Card,
  Avatar, Badge, Tooltip, Popconfirm, message,
  Select, Popover,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, UserOutlined, BankOutlined, MailOutlined,
  PhoneOutlined, SettingOutlined,
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

// ── Definiciones de columna ───────────────────────────────────────────────────
function buildColDef(key: string, navigate: (p: string) => void, handleDelete: (id: string) => void): ColumnsType<Customer>[number] | null {
  const base = { key }
  switch (key) {
    case 'nombre':
      return { ...base, title: 'Cliente', width: 260, fixed: 'left' as const,
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
        render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v || '—'}</Text> }
    case 'type':
      return { ...base, title: 'Tipo', dataIndex: 'type', width: 130,
        render: (v: string) => <Tag style={{ fontSize: 11 }}>{TYPE_LABELS[v] ?? v}</Tag> }
    case 'legalName':
      return { ...base, title: 'Razón Social SAT', dataIndex: 'legalName', width: 200, ellipsis: true,
        render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> }
    case 'taxId':
      return { ...base, title: 'NIT', dataIndex: 'taxId', width: 110,
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
        render: (v: number) => Number(v) > 0 ? <Text style={{ fontSize: 12 }}>{fmtQ(v)}</Text> : <Text type="secondary">—</Text> }
    case 'taxTreatment':
      return { ...base, title: 'Tipo fiscal', dataIndex: 'taxTreatment', width: 145,
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
        render: (v: number) => (
          <Text strong style={{ color: Number(v) > 0 ? '#1faec2' : '#6b7280' }}>
            {Number(v) > 0 ? fmtQ(v) : '—'}
          </Text>
        ) }
    case 'status':
      return { ...base, title: 'Estado', dataIndex: 'status', width: 100,
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCustomers({ search, page, limit: 20 })
      if (Array.isArray(res)) { setCustomers(res); setTotal(res.length) }
      else { setCustomers(res.data ?? res.items ?? []); setTotal(res.meta?.total ?? res.total ?? 0) }
    } catch { setCustomers([]); setTotal(0) }
    finally { setLoading(false) }
  }, [search, page])

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
          Nuevo cliente
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
          <Select placeholder="Tipo fiscal" style={{ width: 170 }} allowClear>
            {Object.entries(TAX_TREATMENT_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}><Tag color={v.color}>{v.label}</Tag></Option>
            ))}
          </Select>
          <Select placeholder="Estado" style={{ width: 130 }} allowClear>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
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
          scroll={{ x: scrollX, y: 'calc(100vh - 280px)' }}
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
    </div>
  )
}
