import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Space, Typography, Tag,
  Select, message, Popconfirm, Tooltip, Modal, Descriptions, Divider, Alert,
} from 'antd'
import {
  ReloadOutlined, StopOutlined, BookOutlined, WalletOutlined, BankOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getVendorAdvances, voidVendorAdvance, unvoidVendorAdvance, getJournalEntry,
  applyVendorAdvanceToBill, getBills,
  type VendorAdvance, type PurchaseInvoice,
} from '../../../api/compras'

const { Text, Title } = Typography

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const STATUS_COLOR: Record<string, string> = {
  open:    'blue',
  partial: '#ff7f00',
  applied: '#2ea172',
  voided:  'red',
}

const STATUS_LABEL: Record<string, string> = {
  open:    'Abierto',
  partial: 'Parcial',
  applied: 'Aplicado',
  voided:  'Anulado',
}

export default function AnticiposProveedorPage() {
  const [data,    setData]    = useState<VendorAdvance[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [page,    setPage]    = useState(1)
  const [status,  setStatus]  = useState<string | undefined>()
  const [voiding,   setVoiding]   = useState<string | null>(null)
  const [unvoiding, setUnvoiding] = useState(false)
  const [detail,   setDetail]   = useState<VendorAdvance | null>(null)
  const [jeLines,  setJeLines]  = useState<any[]>([])
  const [jeLoading, setJeLoading] = useState(false)

  // Modal: aplicar a factura de compra
  const [applying,     setApplying]     = useState<VendorAdvance | null>(null)
  const [openBills,    setOpenBills]    = useState<PurchaseInvoice[]>([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [selectedBill, setSelectedBill] = useState<string | undefined>()
  const [applyLoading, setApplyLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVendorAdvances({ page, limit: 50, status })
      setData(res.data)
      setTotal(res.total)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const handleVoid = async (id: string) => {
    setVoiding(id)
    try {
      await voidVendorAdvance(id)
      message.success('Anticipo anulado correctamente')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al anular')
    } finally {
      setVoiding(null)
    }
  }

  const handleUnvoid = async (id: string) => {
    setUnvoiding(true)
    try {
      await unvoidVendorAdvance(id)
      message.success('Anticipo restaurado a Abierto — póliza de reverso eliminada')
      setDetail(null)
      setJeLines([])
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al revertir')
    } finally {
      setUnvoiding(false)
    }
  }

  const openApply = async (adv: VendorAdvance) => {
    setApplying(adv)
    setSelectedBill(undefined)
    setLoadingBills(true)
    try {
      const res = await getBills({ vendorId: adv.vendorId, status: 'open,partial,overdue', limit: 100 })
      const list: PurchaseInvoice[] = Array.isArray(res) ? res : (res?.data ?? [])
      setOpenBills(list.filter(b => Number(b.balance ?? 0) > 0.01))
    } catch { setOpenBills([]) }
    finally { setLoadingBills(false) }
  }

  const handleApply = async () => {
    if (!applying || !selectedBill) return
    setApplyLoading(true)
    try {
      await applyVendorAdvanceToBill(applying.id, selectedBill)
      const bill = openBills.find(b => b.id === selectedBill)
      message.success(`Anticipo ${applying.advanceNumber} aplicado a ${bill?.invoiceNumber ?? 'factura'}`)
      setApplying(null)
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al aplicar el anticipo')
    } finally { setApplyLoading(false) }
  }

  const columns: ColumnsType<VendorAdvance> = [
    {
      title: 'Número', dataIndex: 'advanceNumber', width: 160,
      render: (v) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{v}</Text>,
    },
    {
      title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true,
      render: (v) => <Text>{v ?? <Text type="secondary">Sin proveedor</Text>}</Text>,
    },
    {
      title: 'Fecha', dataIndex: 'advanceDate', width: 115,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Monto', dataIndex: 'amount', width: 140, align: 'right',
      render: (v, r) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Saldo', dataIndex: 'balance', width: 140, align: 'right',
      render: (v, r) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: Number(v) > 0 ? '#ff7f00' : '#2ea172' }}>
          {fmtQ(v, r.currency)}
        </Text>
      ),
    },
    {
      title: 'Estado', dataIndex: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      key: 'actions', width: 120, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver póliza">
            <Button size="small" icon={<BookOutlined />} onClick={() => {
              setDetail(r)
              setJeLines([])
              if (r.journalEntryId) {
                setJeLoading(true)
                getJournalEntry(r.journalEntryId)
                  .then(je => setJeLines(je.lines ?? []))
                  .catch(() => {})
                  .finally(() => setJeLoading(false))
              }
            }} />
          </Tooltip>
          {r.status !== 'voided' && r.status !== 'applied' && (
            <Tooltip title="Aplicar a factura de compra">
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#1faec2', borderColor: '#1faec2' }}
                onClick={() => openApply(r)}
              />
            </Tooltip>
          )}
          {r.status !== 'voided' && r.status !== 'applied' && (
            <Popconfirm
              title="¿Anular anticipo?"
              description="Se creará un asiento de reverso contable."
              okText="Anular"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleVoid(r.id)}
            >
              <Tooltip title="Anular">
                <Button size="small" danger icon={<StopOutlined />} loading={voiding === r.id} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <WalletOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Anticipos a Proveedores</Title>
            <Text type="secondary">Prepagos y anticipos registrados a proveedores</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
          Actualizar
        </Button>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Select
          placeholder="Estado"
          allowClear
          value={status}
          onChange={v => { setStatus(v); setPage(1) }}
          style={{ width: 150 }}
          options={[
            { value: 'open',    label: 'Abierto' },
            { value: 'partial', label: 'Parcial' },
            { value: 'applied', label: 'Aplicado' },
            { value: 'voided',  label: 'Anulado' },
          ]}
        />
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          rowClassName={(r) => r.status === 'voided' ? 'row-void' : ''}
          pagination={{
            total,
            current: page,
            pageSize: 50,
            onChange: setPage,
            showTotal: t => `${t} anticipos`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Sin anticipos registrados' }}
        />
      </Card>

      <Modal
        open={!!detail}
        onCancel={() => { setDetail(null); setJeLines([]) }}
        footer={null}
        title={`Anticipo ${detail?.advanceNumber}`}
        width={620}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginTop: 8 }}>
              <Descriptions.Item label="Proveedor" span={2}>{detail.vendorName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{dayjs(detail.advanceDate).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Monto">{fmtQ(detail.amount, detail.currency)}</Descriptions.Item>
              <Descriptions.Item label="Saldo">{fmtQ(detail.balance, detail.currency)}</Descriptions.Item>
              {detail.advanceAccountCode && (
                <Descriptions.Item label="Cuenta anticipo" span={2}>
                  <Text code style={{ fontSize: 11 }}>{detail.advanceAccountCode}</Text>
                  <span style={{ marginLeft: 6 }}>{detail.advanceAccountName}</span>
                </Descriptions.Item>
              )}
              {detail.reference && (
                <Descriptions.Item label="Ref. bancaria" span={2}>
                  <BankOutlined style={{ marginRight: 6, color: '#1faec2' }} />
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{detail.reference}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.status === 'voided' && (
              <Popconfirm
                title="¿Revertir anulación?"
                description="Se eliminará la póliza de reverso y el anticipo quedará Abierto nuevamente."
                okText="Revertir"
                cancelText="Cancelar"
                onConfirm={() => handleUnvoid(detail.id)}
              >
                <Button
                  block danger loading={unvoiding}
                  style={{ marginTop: 12 }}
                  icon={<StopOutlined />}
                >
                  Revertir anulación — restaurar a Abierto
                </Button>
              </Popconfirm>
            )}

            <Divider style={{ margin: '14px 0 10px' }} />
            <Text strong style={{ fontSize: 13 }}>Póliza contable</Text>
            <Table
              size="small"
              loading={jeLoading}
              dataSource={jeLines}
              rowKey={(_, i) => String(i)}
              pagination={false}
              style={{ marginTop: 8 }}
              locale={{ emptyText: 'Sin póliza contable' }}
              columns={[
                {
                  title: 'Cuenta', key: 'cuenta',
                  render: (_: any, row: any) => (
                    <div>
                      <Text code style={{ fontSize: 11 }}>{row.accountCode}</Text>
                      <span style={{ marginLeft: 6, fontSize: 12 }}>{row.accountName}</span>
                      {row.description && <div style={{ fontSize: 11, color: '#9aa1ab', marginTop: 1 }}>{row.description}</div>}
                    </div>
                  ),
                },
                {
                  title: 'Débito', dataIndex: 'debit', align: 'right' as const, width: 120,
                  render: (v: number) => v > 0
                    ? <Text style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                    : <Text type="secondary">—</Text>,
                },
                {
                  title: 'Crédito', dataIndex: 'credit', align: 'right' as const, width: 120,
                  render: (v: number) => v > 0
                    ? <Text style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                    : <Text type="secondary">—</Text>,
                },
              ]}
              summary={(rows) => {
                const totalD = rows.reduce((s, r) => s + Number(r.debit  ?? 0), 0)
                const totalC = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0)
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} />
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#e5484d' }}>Q {totalD.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ color: '#2ea172' }}>Q {totalC.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </>
        )}
      </Modal>

      {/* ── Modal: Aplicar anticipo a factura de compra ─────────────── */}
      <Modal
        title={applying ? `Aplicar ${applying.advanceNumber} — Saldo: ${fmtQ(applying.balance, applying.currency)}` : 'Aplicar anticipo'}
        open={!!applying}
        onCancel={() => setApplying(null)}
        onOk={handleApply}
        okText="Aplicar anticipo"
        confirmLoading={applyLoading}
        okButtonProps={{ disabled: !selectedBill, style: { background: '#1faec2' } }}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
            Selecciona la factura de compra a la que se aplicará el anticipo
          </div>
          {loadingBills ? (
            <Select disabled placeholder="Cargando facturas..." style={{ width: '100%' }} />
          ) : openBills.length === 0 ? (
            <Alert type="warning" message="Este proveedor no tiene facturas con saldo pendiente." />
          ) : (
            <Select
              placeholder="Seleccionar factura..."
              style={{ width: '100%' }}
              value={selectedBill}
              onChange={v => setSelectedBill(v)}
              optionFilterProp="label"
              showSearch
              options={openBills.map(b => ({
                label: `${b.invoiceNumber} — ${fmtQ(Number(b.balance ?? 0), b.currency)} pendiente`,
                value: b.id,
              }))}
            />
          )}
        </div>
        {applying && selectedBill && (() => {
          const bill = openBills.find(b => b.id === selectedBill)
          if (!bill) return null
          const billBalance = Number(bill.balance ?? 0)
          const applyAmt = Math.min(applying.balance, billBalance)
          return (
            <Alert type="success" showIcon
              message={`Se aplicarán ${fmtQ(applyAmt, applying.currency)} al saldo de ${bill.invoiceNumber}`}
              description={`Saldo restante del anticipo: ${fmtQ(Math.max(0, applying.balance - applyAmt), applying.currency)}`}
            />
          )
        })()}
      </Modal>

      <style>{`
        .row-void td { opacity: 0.45; text-decoration: line-through; }
      `}</style>
    </div>
  )
}
