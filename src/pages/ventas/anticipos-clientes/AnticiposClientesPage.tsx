import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Table, Button, Space, Typography, Tag, Select, message,
  Popconfirm, Tooltip, Modal, Alert, Descriptions, Divider, Spin, DatePicker,
  Drawer, InputNumber, Badge, Input,
} from 'antd'
import {
  ReloadOutlined, CheckCircleOutlined, StopOutlined, BookOutlined, RollbackOutlined,
  UndoOutlined, DeleteOutlined, FilterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getAnticiposClientes, aplicarAnticipoCliente, reembolsarAnticipoCliente,
  desaplicarAnticipoCliente, restaurarAnticipoCliente, eliminarAnticipoCliente,
  type AnticipoCliente,
} from '../../../api/anticipos-clientes'
import { getJournalEntry } from '../../../api/compras'
import { getInvoices, type Invoice } from '../../../api/facturas'
import { getCustomers } from '../../../api/contactos'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  pending: 'blue',
  partial:  '#ff7f00',
  paid:     '#2ea172',
  voided:   'default',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Abierto',
  partial:  'Parcial',
  paid:     'Aplicado',
  voided:   'Cerrado',
}

const STATUS_OPTIONS = [
  { label: 'Abierto',  value: 'pending' },
  { label: 'Parcial',  value: 'partial' },
  { label: 'Aplicado', value: 'paid'    },
  { label: 'Cerrado',  value: 'voided'  },
]

interface Customer { id: string; name: string; taxId?: string }

// ── Filtros avanzados (client-side sobre datos cargados) ──────────────────────
interface AntAdFilters {
  filterInvoiceNumber?: string
  filterTotalMin?: number | null
  filterTotalMax?: number | null
  filterBalanceMin?: number | null
  filterBalanceMax?: number | null
}
function applyAntFilters(data: AnticipoCliente[], f: AntAdFilters): AnticipoCliente[] {
  return data.filter(r => {
    if (f.filterInvoiceNumber && !String(r.invoiceNumber ?? '').toLowerCase().includes(f.filterInvoiceNumber.toLowerCase())) return false
    if (f.filterTotalMin != null && Number(r.total) < f.filterTotalMin) return false
    if (f.filterTotalMax != null && Number(r.total) > f.filterTotalMax) return false
    if (f.filterBalanceMin != null && Number(r.balance) < f.filterBalanceMin) return false
    if (f.filterBalanceMax != null && Number(r.balance) > f.filterBalanceMax) return false
    return true
  })
}

export default function AnticiposClientesPage() {
  const [data,          setData]          = useState<AnticipoCliente[]>([])
  const [total,         setTotal]         = useState(0)
  const [loading,       setLoading]       = useState(false)
  const [page,          setPage]          = useState(1)
  const [customers,     setCustomers]     = useState<Customer[]>([])
  const [filtroCliente, setFiltroCliente] = useState<string | undefined>()
  const [filtroStatus,  setFiltroStatus]  = useState<string | undefined>()

  // Modal: ver póliza
  const [polizaAnt,   setPolizaAnt]   = useState<AnticipoCliente | null>(null)
  const [jeLines,     setJeLines]     = useState<any[]>([])
  const [jeLoading,   setJeLoading]   = useState(false)

  // Modal: aplicar a factura
  const [applying,     setApplying]     = useState<AnticipoCliente | null>(null)
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([])
  const [loadingInv,   setLoadingInv]   = useState(false)
  const [selectedInv,  setSelectedInv]  = useState<string | undefined>()
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyDate,    setApplyDate]    = useState<string>(dayjs().format('YYYY-MM-DD'))

  // Anular
  const [voiding,      setVoiding]      = useState<string | null>(null)

  // Desaplicar
  const [desaplicando,  setDesaplicando]  = useState<string | null>(null)
  // Restaurar / Eliminar
  const [restaurando,   setRestaurando]   = useState<string | null>(null)
  const [eliminando,    setEliminando]    = useState<string | null>(null)

  // Filtros avanzados
  const [antFilters,    setAntFilters]    = useState<AntAdFilters>({})
  const [antDraft,      setAntDraft]      = useState<AntAdFilters>({})
  const [antFilterOpen, setAntFilterOpen] = useState(false)
  const antActiveCount = useMemo(() => Object.entries(antFilters).filter(([, v]) =>
    v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
  ).length, [antFilters])
  const openAntFilters  = () => { setAntDraft({ ...antFilters }); setAntFilterOpen(true) }
  const applyAntFilters2 = () => { setAntFilters({ ...antDraft }); setAntFilterOpen(false) }
  const clearAntFilters  = () => { setAntDraft({}); setAntFilters({}); setAntFilterOpen(false) }
  const filteredAntipos = useMemo(() => applyAntFilters(data, antFilters), [data, antFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnticiposClientes({ customerId: filtroCliente, status: filtroStatus, page, limit: 50 })
      setData(res.data)
      setTotal(res.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [filtroCliente, filtroStatus, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getCustomers({ limit: 200 }).then((res: any) => {
      const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
      setCustomers(list.map((c: any) => ({ id: c.id, name: c.name, taxId: c.taxId })))
    }).catch(() => {})
  }, [])

  // Abrir póliza en modal
  const openPoliza = (ant: AnticipoCliente) => {
    setPolizaAnt(ant)
    setJeLines([])
    const jeId = (ant as any).journalEntryId as string | undefined
    if (jeId) {
      setJeLoading(true)
      getJournalEntry(jeId)
        .then(je => setJeLines(je.lines ?? []))
        .catch(() => setJeLines([]))
        .finally(() => setJeLoading(false))
    }
  }

  // Abrir modal aplicar
  const openApply = async (ant: AnticipoCliente) => {
    setApplying(ant)
    setSelectedInv(undefined)
    setApplyDate(dayjs().format('YYYY-MM-DD'))
    setLoadingInv(true)
    try {
      const res = await getInvoices({ customerId: ant.customerId, status: 'pending,sent,partial,overdue', limit: 100 })
      const list: Invoice[] = Array.isArray(res) ? res : (res?.data ?? [])
      setOpenInvoices(list.filter((inv: Invoice) => Number(inv.balance) > 0.01))
    } catch { setOpenInvoices([]) }
    finally { setLoadingInv(false) }
  }

  const handleApply = async () => {
    if (!applying || !selectedInv) return
    setApplyLoading(true)
    try {
      const res = await aplicarAnticipoCliente(applying.id, { invoiceId: selectedInv, date: applyDate }) as any
      message.success(`Anticipo ${applying.invoiceNumber} aplicado — ${fmtQ(Number(res.amount ?? 0))} acreditados`)
      setApplying(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al aplicar el anticipo')
    } finally { setApplyLoading(false) }
  }

  const handleDesaplicar = async (id: string, invoiceNumber: string) => {
    setDesaplicando(id)
    try {
      await desaplicarAnticipoCliente(id)
      message.success(`Anticipo ${invoiceNumber} desaplicado — pólizas revertidas`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al desaplicar el anticipo')
    } finally { setDesaplicando(null) }
  }

  const handleRestaurar = async (id: string, invoiceNumber: string) => {
    setRestaurando(id)
    try {
      await restaurarAnticipoCliente(id)
      message.success(`Anticipo ${invoiceNumber} restaurado a pendiente — ya puede reembolsarse correctamente`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al restaurar el anticipo')
    } finally { setRestaurando(null) }
  }

  const handleEliminar = async (id: string, invoiceNumber: string) => {
    setEliminando(id)
    try {
      await eliminarAnticipoCliente(id)
      message.success(`Anticipo ${invoiceNumber} eliminado`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al eliminar el anticipo')
    } finally { setEliminando(null) }
  }

  const handleVoid = async (id: string, invoiceNumber: string) => {
    setVoiding(id)
    try {
      await reembolsarAnticipoCliente(id)
      message.success(`Anticipo ${invoiceNumber} anulado — póliza de reverso creada automáticamente`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al anular el anticipo')
    } finally { setVoiding(null) }
  }

  const columns: ColumnsType<AnticipoCliente> = [
    {
      title: 'N.º Anticipo', dataIndex: 'invoiceNumber', width: 130,
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => String(a.invoiceNumber ?? '').localeCompare(String(b.invoiceNumber ?? '')),
      render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Cliente', dataIndex: 'customerName',
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => String(a.customerName ?? '').localeCompare(String(b.customerName ?? '')),
      render: (v: string, r: AnticipoCliente) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.customerTaxId && <div style={{ fontSize: 11, color: '#9ca3af' }}>NIT: {r.customerTaxId}</div>}
        </div>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'invoiceDate', width: 110,
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => String(a.invoiceDate ?? '').localeCompare(String(b.invoiceDate ?? '')),
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Monto original', dataIndex: 'total', width: 130, align: 'right' as const,
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => Number(a.total ?? 0) - Number(b.total ?? 0),
      render: (v: number) => fmtQ(v),
    },
    {
      title: 'Saldo disponible', dataIndex: 'balance', width: 140, align: 'right' as const,
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => Number(a.balance ?? 0) - Number(b.balance ?? 0),
      render: (v: number) => (
        <Text style={{ fontWeight: 700, color: Number(v) > 0 ? '#d97706' : '#2ea172' }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      sorter: (a: AnticipoCliente, b: AnticipoCliente) => String(a.status ?? '').localeCompare(String(b.status ?? '')),
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Acciones', width: 130,
      render: (_: any, r: AnticipoCliente) => (
        <Space size={4}>
          <Tooltip title="Ver póliza contable">
            <Button size="small" icon={<BookOutlined />}
              onClick={() => openPoliza(r)}
            />
          </Tooltip>
          <Tooltip title="Aplicar a factura">
            <Button size="small" icon={<CheckCircleOutlined />}
              style={r.status === 'paid' || r.status === 'voided' ? {} : { color: '#1faec2', borderColor: '#1faec2' }}
              disabled={r.status === 'paid' || r.status === 'voided'}
              onClick={() => openApply(r)}
            />
          </Tooltip>
          {(r.status === 'partial' || r.status === 'paid') && (
            <Popconfirm
              title={`¿Desaplicar anticipo ${r.invoiceNumber}?`}
              description="Se revertirán todas las aplicaciones a facturas y sus pólizas."
              okText="Desaplicar"
              cancelText="Cancelar"
              okButtonProps={{ style: { background: '#d97706' } }}
              onConfirm={() => handleDesaplicar(r.id, r.invoiceNumber)}
            >
              <Tooltip title="Desaplicar (revertir aplicaciones)">
                <Button size="small" icon={<RollbackOutlined />}
                  loading={desaplicando === r.id}
                  style={{ color: '#d97706', borderColor: '#d97706' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {r.status !== 'paid' && r.status !== 'voided' && (
            <Popconfirm
              title={`¿Anular anticipo ${r.invoiceNumber}?`}
              description="Se creará un asiento de reverso contable automáticamente."
              okText="Anular"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleVoid(r.id, r.invoiceNumber)}
            >
              <Tooltip title="Anular anticipo (revierte póliza)">
                <Button size="small" danger icon={<StopOutlined />} loading={voiding === r.id} />
              </Tooltip>
            </Popconfirm>
          )}
          {r.status === 'voided' && (
            <Popconfirm
              title={`¿Restaurar anticipo ${r.invoiceNumber}?`}
              description="Vuelve a estado Pendiente para poder reembolsarlo correctamente."
              okText="Restaurar"
              cancelText="Cancelar"
              okButtonProps={{ style: { background: '#1faec2' } }}
              onConfirm={() => handleRestaurar(r.id, r.invoiceNumber)}
            >
              <Tooltip title="Restaurar a pendiente (para re-procesar)">
                <Button size="small" icon={<UndoOutlined />}
                  loading={restaurando === r.id}
                  style={{ color: '#1faec2', borderColor: '#1faec2' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {r.status === 'voided' && (
            <Popconfirm
              title={`¿Eliminar definitivamente ${r.invoiceNumber}?`}
              description="Se revertirá su póliza contable y se borrará el registro."
              okText="Eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleEliminar(r.id, r.invoiceNumber)}
            >
              <Tooltip title="Eliminar definitivamente">
                <Button size="small" danger icon={<DeleteOutlined />} loading={eliminando === r.id} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Anticipos de Clientes</Title>
        <Button icon={<ReloadOutlined />} onClick={load}>Actualizar</Button>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Select
          showSearch placeholder="Filtrar por cliente" allowClear
          style={{ width: 280 }} optionFilterProp="label"
          options={customers.map(c => ({ label: c.name, value: c.id }))}
          onChange={v => { setFiltroCliente(v); setPage(1) }}
        />
        <Select
          placeholder="Estado" allowClear style={{ width: 150 }}
          options={STATUS_OPTIONS}
          onChange={v => { setFiltroStatus(v); setPage(1) }}
        />
        <Badge count={antActiveCount} size="small" color="#1faec2" offset={[-4, 4]}>
          <Button size="small" icon={<FilterOutlined />} onClick={openAntFilters}
            style={antActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}>
            Filtros
          </Button>
        </Badge>
      </Space>

      <Table
        dataSource={filteredAntipos} columns={columns} rowKey="id"
        loading={loading} size="small" showSorterTooltip={false}
        pagination={{ current: page, pageSize: 50, total, onChange: p => setPage(p), showTotal: t => `${t} anticipos` }}
        locale={{ emptyText: 'No hay anticipos registrados' }}
      />

      {/* ── Modal: Ver póliza ──────────────────────────────────── */}
      <Modal
        title={polizaAnt ? `Póliza — ${polizaAnt.invoiceNumber}` : 'Póliza contable'}
        open={!!polizaAnt}
        onCancel={() => setPolizaAnt(null)}
        footer={<Button onClick={() => setPolizaAnt(null)}>Cerrar</Button>}
        width={640}
      >
        {polizaAnt && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Anticipo">{polizaAnt.invoiceNumber}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{polizaAnt.customerName}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{dayjs(polizaAnt.invoiceDate).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Monto">{fmtQ(polizaAnt.total)}</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '8px 0' }} />
            {jeLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : !(polizaAnt as any).journalEntryId ? (
              <Alert type="warning" message="Este anticipo no tiene póliza contable registrada." />
            ) : jeLines.length === 0 ? (
              <Alert type="warning" message="No se pudieron cargar las líneas de la póliza." />
            ) : (
              <Table
                dataSource={jeLines}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Cuenta', dataIndex: 'accountCode', width: 80 },
                  { title: 'Nombre', dataIndex: 'accountName' },
                  {
                    title: 'Débito', dataIndex: 'debit', width: 110, align: 'right' as const,
                    render: (v: number) => v > 0 ? fmtQ(v) : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Crédito', dataIndex: 'credit', width: 110, align: 'right' as const,
                    render: (v: number) => v > 0 ? fmtQ(v) : <Text type="secondary">—</Text>,
                  },
                ]}
              />
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Aplicar anticipo a factura ──────────────────── */}
      <Modal
        title={applying ? `Aplicar ${applying.invoiceNumber} — Saldo: ${fmtQ(applying.balance)}` : 'Aplicar anticipo'}
        open={!!applying}
        onCancel={() => setApplying(null)}
        onOk={handleApply}
        okText="Aplicar anticipo"
        confirmLoading={applyLoading}
        okButtonProps={{ disabled: !selectedInv, style: { background: '#1faec2' } }}
        width={520}
      >
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Fecha contable</span>
          <DatePicker size="small" format="DD/MM/YYYY" style={{ flex: 1 }}
            value={dayjs(applyDate)}
            onChange={d => setApplyDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            Selecciona la factura a la que se aplicará el anticipo
          </div>
          {loadingInv ? (
            <Select disabled placeholder="Cargando facturas..." style={{ width: '100%' }} />
          ) : openInvoices.length === 0 ? (
            <Alert type="warning" message="Este cliente no tiene facturas con saldo pendiente." />
          ) : (
            <Select
              placeholder="Seleccionar factura..."
              style={{ width: '100%' }}
              value={selectedInv}
              onChange={v => setSelectedInv(v)}
              optionFilterProp="label"
              showSearch
              options={openInvoices.map(inv => ({
                label: `${inv.invoiceNumber} — ${fmtQ(Number(inv.balance))} pendiente`,
                value: inv.id,
              }))}
            />
          )}
        </div>
        {applying && selectedInv && (() => {
          const inv = openInvoices.find(i => i.id === selectedInv)
          if (!inv) return null
          const applyAmt = Math.min(applying.balance, Number(inv.balance))
          return (
            <Alert type="success" showIcon
              message={`Se aplicarán ${fmtQ(applyAmt)} al saldo de ${inv.invoiceNumber}`}
              description={`Saldo restante del anticipo: ${fmtQ(Math.max(0, applying.balance - applyAmt))}`}
            />
          )
        })()}
      </Modal>

      {/* Drawer filtros avanzados */}
      <Drawer
        title={<Space><FilterOutlined style={{ color: '#1faec2' }} /><span>Filtros avanzados</span></Space>}
        open={antFilterOpen}
        onClose={() => setAntFilterOpen(false)}
        width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={clearAntFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyAntFilters2}>
              Aplicar{antActiveCount > 0 ? ` (${antActiveCount})` : ''}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>N° Anticipo</div>
            <Input size="small" allowClear placeholder="ANT-00001..."
              value={antDraft.filterInvoiceNumber ?? ''}
              onChange={e => setAntDraft(d => ({ ...d, filterInvoiceNumber: e.target.value || undefined }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Monto</Typography.Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Total desde</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} addonBefore="Q"
              value={antDraft.filterTotalMin ?? null}
              onChange={v => setAntDraft(d => ({ ...d, filterTotalMin: v ?? null }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Total hasta</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} addonBefore="Q"
              value={antDraft.filterTotalMax ?? null}
              onChange={v => setAntDraft(d => ({ ...d, filterTotalMax: v ?? null }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Divider style={{ margin: '4px 0 8px' }} />
            <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Saldo disponible</Typography.Text>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Saldo desde</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} addonBefore="Q"
              value={antDraft.filterBalanceMin ?? null}
              onChange={v => setAntDraft(d => ({ ...d, filterBalanceMin: v ?? null }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Saldo hasta</div>
            <InputNumber size="small" style={{ width: '100%' }} min={0} addonBefore="Q"
              value={antDraft.filterBalanceMax ?? null}
              onChange={v => setAntDraft(d => ({ ...d, filterBalanceMax: v ?? null }))} />
          </div>
        </div>
      </Drawer>
    </div>
  )
}
