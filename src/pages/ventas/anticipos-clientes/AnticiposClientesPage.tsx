import { useEffect, useState, useCallback } from 'react'
import {
  Table, Button, Space, Typography, Tag, Select, message,
  Popconfirm, Tooltip, Modal, Alert,
} from 'antd'
import {
  ReloadOutlined, CheckCircleOutlined, RollbackOutlined, BookOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getAnticiposClientes, aplicarAnticipoCliente, reembolsarAnticipoCliente,
  type AnticipoCliente,
} from '../../../api/anticipos-clientes'
import { getInvoices, type Invoice } from '../../../api/facturas'
import { getCustomers } from '../../../api/contactos'

const { Text, Title } = Typography

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  pending: 'blue',
  partial:  '#ff7f00',
  paid:     '#2ea172',
  voided:   'red',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Disponible',
  partial:  'Parcial',
  paid:     'Aplicado',
  voided:   'Anulado',
}

interface Customer { id: string; name: string; taxId?: string }

export default function AnticiposClientesPage() {
  const [data,         setData]         = useState<AnticipoCliente[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [page,         setPage]         = useState(1)
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [filtroCliente, setFiltroCliente] = useState<string | undefined>()

  // Modal aplicar
  const [applying,     setApplying]     = useState<AnticipoCliente | null>(null)
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([])
  const [loadingInv,   setLoadingInv]   = useState(false)
  const [selectedInv,  setSelectedInv]  = useState<string | undefined>()
  const [applyLoading, setApplyLoading] = useState(false)

  // Refund
  const [refunding, setRefunding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnticiposClientes({ customerId: filtroCliente, page, limit: 50 })
      setData(res.data)
      setTotal(res.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [filtroCliente, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getCustomers({ limit: 200 }).then((res: any) => {
      const list: any[] = Array.isArray(res) ? res : (res?.data ?? [])
      setCustomers(list.map((c: any) => ({ id: c.id, name: c.name, taxId: c.taxId })))
    }).catch(() => {})
  }, [])

  // Abrir modal para aplicar anticipo a factura
  const openApply = async (ant: AnticipoCliente) => {
    setApplying(ant)
    setSelectedInv(undefined)
    setLoadingInv(true)
    try {
      const res = await getInvoices({ customerId: ant.customerId, status: 'open,overdue,partial', limit: 100 })
      const list: Invoice[] = Array.isArray(res) ? res : (res?.data ?? [])
      setOpenInvoices(list.filter((inv: Invoice) => Number(inv.balance) > 0.01))
    } catch { setOpenInvoices([]) }
    finally { setLoadingInv(false) }
  }

  const handleApply = async () => {
    if (!applying || !selectedInv) return
    setApplyLoading(true)
    try {
      const res = await aplicarAnticipoCliente(applying.id, { invoiceId: selectedInv }) as any
      message.success(`Anticipo ${applying.invoiceNumber} aplicado — Q${Number(res.amount ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} acreditados`)
      setApplying(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al aplicar el anticipo')
    } finally { setApplyLoading(false) }
  }

  const handleRefund = async (id: string) => {
    setRefunding(id)
    try {
      await reembolsarAnticipoCliente(id)
      message.success('Anticipo marcado como reembolsado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al reembolsar')
    } finally { setRefunding(null) }
  }

  const columns: ColumnsType<AnticipoCliente> = [
    {
      title: 'N.º Anticipo', dataIndex: 'invoiceNumber', width: 130,
      render: (v: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Cliente', dataIndex: 'customerName',
      render: (v: string, r: AnticipoCliente) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.customerTaxId && <div style={{ fontSize: 11, color: '#9ca3af' }}>NIT: {r.customerTaxId}</div>}
        </div>
      ),
    },
    {
      title: 'Fecha', dataIndex: 'invoiceDate', width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Monto original', dataIndex: 'total', width: 130, align: 'right' as const,
      render: (v: number) => fmtQ(v),
    },
    {
      title: 'Saldo disponible', dataIndex: 'balance', width: 140, align: 'right' as const,
      render: (v: number) => (
        <Text style={{ fontWeight: 700, color: Number(v) > 0 ? '#d97706' : '#2ea172' }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Acciones', width: 140,
      render: (_: any, r: AnticipoCliente) => (
        <Space size={4}>
          <Tooltip title="Aplicar a factura">
            <Button size="small" icon={<CheckCircleOutlined />}
              style={{ color: '#1faec2', borderColor: '#1faec2' }}
              onClick={() => openApply(r)}
            />
          </Tooltip>
          <Tooltip title="Ver póliza contable">
            <Button size="small" icon={<BookOutlined />}
              disabled={!r.journalEntryId}
              onClick={() => r.journalEntryId && window.open(`/contabilidad/asientos/${r.journalEntryId}`, '_blank')}
            />
          </Tooltip>
          <Popconfirm
            title="¿Marcar como reembolsado? Esta acción es irreversible."
            onConfirm={() => handleRefund(r.id)}
          >
            <Tooltip title="Reembolsar al cliente">
              <Button size="small" danger icon={<RollbackOutlined />} loading={refunding === r.id} />
            </Tooltip>
          </Popconfirm>
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

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Solo se muestran anticipos con saldo disponible. Para ver anticipos ya aplicados, consulta el historial de Pagos Recibidos."
      />

      <Space style={{ marginBottom: 12 }}>
        <Select
          showSearch placeholder="Filtrar por cliente" allowClear
          style={{ width: 280 }} optionFilterProp="label"
          options={customers.map(c => ({ label: c.name, value: c.id }))}
          onChange={v => { setFiltroCliente(v); setPage(1) }}
        />
      </Space>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{ current: page, pageSize: 50, total, onChange: p => setPage(p), showTotal: t => `${t} anticipos` }}
        locale={{ emptyText: 'No hay anticipos con saldo disponible' }}
      />

      {/* Modal: Aplicar anticipo a factura */}
      <Modal
        title={applying ? `Aplicar anticipo ${applying.invoiceNumber} — Saldo: ${fmtQ(applying.balance)}` : 'Aplicar anticipo'}
        open={!!applying}
        onCancel={() => setApplying(null)}
        onOk={handleApply}
        okText="Aplicar anticipo"
        confirmLoading={applyLoading}
        okButtonProps={{ disabled: !selectedInv, style: { background: '#1faec2' } }}
        width={560}
      >
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
              description={`Saldo restante del anticipo después de aplicar: ${fmtQ(Math.max(0, applying.balance - applyAmt))}`}
            />
          )
        })()}
      </Modal>
    </div>
  )
}
