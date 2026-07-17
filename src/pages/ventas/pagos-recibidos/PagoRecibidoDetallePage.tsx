import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography, Space, Button, Tag, Spin,
  Table, Popconfirm, message, Alert, Divider,
} from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, SyncOutlined,
  BankOutlined, FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPagoRecibido, deletePagoRecibido, reprocessPagoJournal,
  type PagoRecibido, PAYMENT_MODE_LABELS,
} from '../../../api/pagos-recibidos'

const { Title, Text } = Typography

const fmtQ = (n: number | undefined | null, cur = 'GTQ') =>
  n != null ? `${cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—'

const INVOICE_STATUS_COLOR: Record<string, string> = {
  sent: '#1faec2', partial: '#1faec2', paid: '#2ea172', voided: '#e5484d', overdue: '#e5484d', draft: 'default',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada', partial: 'Pago parcial', paid: 'Pagada',
  voided: 'Anulada', overdue: 'Vencida', draft: 'Borrador',
}

interface JeLine { id: string; accountCode: string; accountName: string; description?: string; debit: number; credit: number }

export default function PagoRecibidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pago,         setPago]         = useState<PagoRecibido | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [deleting,     setDeleting]     = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try { setPago(await getPagoRecibido(id)) }
    catch { message.error('No se pudo cargar el pago') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const handleReprocess = async () => {
    if (!id) return
    setReprocessing(true)
    try {
      const res = await reprocessPagoJournal(id)
      message.success(res.message ?? 'Póliza contable reprocesada')
      await load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al reprocesar la póliza')
    } finally { setReprocessing(false) }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deletePagoRecibido(id)
      message.success('Pago eliminado y saldo revertido en la factura')
      navigate('/ventas/pagos-recibidos')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar')
      setDeleting(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!pago)  return <div style={{ textAlign: 'center', padding: 80 }}><Text type="secondary">Pago no encontrado</Text></div>

  const invoice  = pago.invoice
  const customer = pago.customer
  const bankAcc  = pago.bankAccount
  const je       = pago.journalEntry

  const invoiceRows = invoice ? [{
    key:     invoice.id,
    number:  invoice.invoiceNumber,
    date:    invoice.invoiceDate,
    total:   invoice.total,
    paid:    pago.amount,
    id:      invoice.id,
    status:  invoice.status,
  }] : []

  const invoiceCols = [
    {
      title: 'Número de factura', dataIndex: 'number',
      render: (v: string, r: any) => (
        <a onClick={() => navigate(`/ventas/facturas/${r.id}`)} style={{ color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>
          {v}
        </a>
      ),
    },
    {
      title: 'Fecha de la factura', dataIndex: 'date', width: 150,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Importe de la factura', dataIndex: 'total', width: 180, align: 'right' as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v, pago.currency)}</Text>,
    },
    {
      title: 'Importe del pago', dataIndex: 'paid', width: 160, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(v, pago.currency)}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={INVOICE_STATUS_COLOR[v] ?? 'default'}>{INVOICE_STATUS_LABEL[v] ?? v}</Tag>,
    },
  ]

  const jeCols: ColumnsType<JeLine> = [
    {
      title: 'Cuenta',
      render: (_, r) => (
        <Space>
          <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{r.accountCode}</Text>
          <Text>{r.accountName}</Text>
        </Space>
      ),
    },
    {
      title: 'Ubicación', width: 140,
      render: () => <Text type="secondary" style={{ fontSize: 12 }}>{customer?.name ?? pago.customerName ?? '—'}</Text>,
    },
    {
      title: 'Débito', dataIndex: 'debit', width: 130, align: 'right' as const,
      render: (v) => Number(v) > 0
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">0.00</Text>,
    },
    {
      title: 'Crédito', dataIndex: 'credit', width: 130, align: 'right' as const,
      render: (v) => Number(v) > 0
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">0.00</Text>,
    },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/pagos-recibidos')}>
          Volver
        </Button>
        <Space>
          <Popconfirm
            title="¿Reprocesar póliza contable?"
            description="Elimina la póliza actual y crea una nueva con las cuentas del catálogo."
            onConfirm={handleReprocess}
            okText="Reprocesar" cancelText="Cancelar"
          >
            <Button icon={<SyncOutlined />} loading={reprocessing} style={{ borderColor: '#1faec2', color: '#1faec2' }}>
              Reprocesar póliza
            </Button>
          </Popconfirm>
          <Popconfirm
            title="¿Eliminar este pago?"
            description="Se revertirá el saldo en la factura y se eliminará la póliza contable."
            onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting}>Eliminar</Button>
          </Popconfirm>
        </Space>
      </div>

      {/* ── Documento recibo ──────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>

        {/* Encabezado del recibo */}
        <div style={{
          background: '#1faec2',
          padding: '20px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#fff', letterSpacing: 2, fontWeight: 700 }}>
              RECIBO DE PAGOS
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              {pago.paymentNumber}
            </Text>
          </div>
          <div style={{
            background: '#22c55e',
            borderRadius: 10,
            padding: '10px 24px',
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>
              IMPORTE RECIBIDO
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {fmtQ(pago.amount, pago.currency)}
            </div>
          </div>
        </div>

        {/* Cuerpo del recibo */}
        <div style={{ padding: '28px 32px' }}>

          {/* Fila de metadatos del pago */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px 32px',
            marginBottom: 28,
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Fecha de pago
              </Text>
              <Text strong style={{ fontSize: 14 }}>{dayjs(pago.paymentDate).format('DD MMM YYYY')}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Número de referencia
              </Text>
              <Text strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{pago.reference ?? '—'}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Modo de pago
              </Text>
              <Text strong style={{ fontSize: 14 }}>
                {pago.mode ? PAYMENT_MODE_LABELS[pago.mode] ?? pago.mode : '—'}
              </Text>
            </div>
          </div>

          <Divider style={{ margin: '0 0 24px' }} />

          {/* Recibido de */}
          <div style={{ marginBottom: 28 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Recibido de
            </Text>
            <Text strong style={{ fontSize: 16, color: '#1faec2' }}>
              {customer?.name ?? pago.customerName ?? pago.customerId}
            </Text>
            {(customer?.taxId ?? pago.customerTaxId) && (
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                NIT: {customer?.taxId ?? pago.customerTaxId}
              </Text>
            )}
          </div>

          {/* Tabla de facturas */}
          {invoiceRows.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                Pago de
              </Text>
              <Table
                columns={invoiceCols}
                dataSource={invoiceRows}
                rowKey="key"
                size="small"
                pagination={false}
                style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }}
              />
            </div>
          )}

          {/* Footer del recibo */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 8,
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Fecha de contabilización de transacción :{' '}
              <Text strong style={{ color: '#555' }}>
                {dayjs(pago.paymentDate).format('DD MMM YYYY')}
              </Text>
            </Text>
            {je && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Póliza:{' '}
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{je.entryNumber}</Text>
              </Text>
            )}
          </div>
        </div>

        {/* ── Más información ───────────────────────────────────────────────── */}
        {(bankAcc || pago.notes) && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: '20px 32px', background: '#fafbfc' }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
                Más información
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                {bankAcc && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Depósito para</Text>
                    <Space size={6}>
                      <BankOutlined style={{ color: '#1faec2' }} />
                      <Text strong style={{ fontSize: 13 }}>{bankAcc.name}</Text>
                      {bankAcc.bankName && <Text type="secondary" style={{ fontSize: 12 }}>— {bankAcc.bankName}</Text>}
                      {bankAcc.accountNumber && <Text type="secondary" style={{ fontSize: 12 }}>({bankAcc.accountNumber})</Text>}
                    </Space>
                  </div>
                )}
                {invoice && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Factura</Text>
                    <Space size={6}>
                      <FileTextOutlined style={{ color: '#1faec2' }} />
                      <a
                        onClick={() => navigate(`/ventas/facturas/${invoice.id}`)}
                        style={{ color: '#1faec2', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {invoice.invoiceNumber}
                      </a>
                      <Tag color={INVOICE_STATUS_COLOR[invoice.status] ?? 'default'} style={{ fontSize: 11 }}>
                        {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                      </Tag>
                    </Space>
                  </div>
                )}
                {pago.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Notas</Text>
                    <Text style={{ fontSize: 13 }}>{pago.notes}</Text>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Diario / Póliza contable ──────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 32px' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Diario
          </Text>

          {je ? (
            <>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{je.description}</Text>
                <Space>
                  <Button size="small" style={{ borderColor: 'rgba(10,10,10,0.08)', fontSize: 12 }}>Acumulación</Button>
                  <Button size="small" style={{ borderColor: 'rgba(10,10,10,0.08)', fontSize: 12 }}>Efectivo</Button>
                </Space>
              </div>
              <Table
                columns={jeCols}
                dataSource={(je.lines ?? []) as JeLine[]}
                rowKey="id"
                size="small"
                pagination={false}
                style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafbfc' }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong style={{ fontSize: 12 }}>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Number(je.totalDebit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>
                          {Number(je.totalCredit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
              {(je.lines ?? []).length === 0 && (
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  message="La póliza existe pero no tiene líneas contables"
                  description="Use el botón Reprocesar póliza para regenerarlas con las cuentas del catálogo actual."
                />
              )}
            </>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="Sin póliza contable"
              description="Este pago no tiene póliza contable. Use el botón Reprocesar póliza para generarla."
            />
          )}
        </div>

      </div>
    </div>
  )
}
