import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Typography, Space, Button, Tag, Spin,
  Table, Popconfirm, message, Row, Col, Divider, Alert,
} from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, DollarOutlined, BookOutlined,
  FileTextOutlined, BankOutlined, SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { getPagoRecibido, deletePagoRecibido, reprocessPagoJournal, type PagoRecibido, PAYMENT_MODE_LABELS } from '../../../api/pagos-recibidos'

const { Title, Text } = Typography

const fmtQ = (n: number | undefined | null) =>
  n != null ? `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—'

const INVOICE_STATUS_COLOR: Record<string, string> = {
  sent: 'blue', partial: 'geekblue', paid: 'green', voided: 'red', overdue: 'red', draft: 'default',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada', partial: 'Pago parcial', paid: 'Pagada',
  voided: 'Anulada', overdue: 'Vencida', draft: 'Borrador',
}

export default function PagoRecibidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pago,        setPago]        = useState<PagoRecibido | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [deleting,    setDeleting]    = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getPagoRecibido(id)
      setPago(data)
    } catch { message.error('No se pudo cargar el pago') }
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

  const invoice    = pago.invoice
  const customer   = pago.customer
  const bankAcc    = pago.bankAccount
  const je         = pago.journalEntry

  // ── Journal entry table
  interface JeLine { id: string; accountCode: string; accountName: string; description?: string; debit: number; credit: number }
  const jeColumns: ColumnsType<JeLine> = [
    {
      title: 'Cuenta',
      render: (_, r) => (
        <Space>
          <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B3A6B' }}>{r.accountCode}</Text>
          <Text>{r.accountName}</Text>
        </Space>
      ),
    },
    {
      title: 'Debe', dataIndex: 'debit', width: 130, align: 'right',
      render: (v) => Number(v) > 0
        ? <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{fmtQ(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Haber', dataIndex: 'credit', width: 130, align: 'right',
      render: (v) => Number(v) > 0
        ? <Text strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>{fmtQ(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
              {pago.paymentNumber}
            </Title>
            <Text type="secondary">
              {dayjs(pago.paymentDate).format('DD/MM/YYYY')}
              {pago.mode ? ` · ${PAYMENT_MODE_LABELS[pago.mode] ?? pago.mode}` : ''}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/pagos-recibidos')}>
            Volver
          </Button>
          <Popconfirm
            title="¿Reprocesar póliza contable?"
            description="Esto eliminará la póliza actual y creará una nueva con las cuentas correctas del catálogo."
            onConfirm={handleReprocess}
            okText="Reprocesar" cancelText="Cancelar"
          >
            <Button icon={<SyncOutlined />} loading={reprocessing} style={{ borderColor: '#1890ff', color: '#1890ff' }}>
              Reprocesar póliza
            </Button>
          </Popconfirm>
          <Popconfirm
            title="¿Eliminar este pago?"
            description="Se revertirá el saldo en la factura y se eliminará la póliza contable."
            onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting}>
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={16}>
        {/* Datos del pago */}
        <Col xs={24} lg={14}>
          <Card
            title={<Space><DollarOutlined style={{ color: '#1B3A6B' }} />Datos del pago</Space>}
            bordered={false}
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            <Descriptions column={2} size="small" labelStyle={{ color: '#888', fontSize: 12 }}>
              <Descriptions.Item label="N° Pago">
                <Text strong style={{ fontFamily: 'monospace' }}>{pago.paymentNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Fecha">
                {dayjs(pago.paymentDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Cliente">
                <Space direction="vertical" size={0}>
                  <Text strong>{customer?.name ?? pago.customerName ?? pago.customerId}</Text>
                  {(customer?.taxId ?? pago.customerTaxId) && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      NIT: {customer?.taxId ?? pago.customerTaxId}
                    </Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Monto">
                <Text strong style={{ fontSize: 16, color: '#1B3A6B', fontFamily: 'monospace' }}>
                  {fmtQ(pago.amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Forma de pago">
                {pago.mode ? <Tag>{PAYMENT_MODE_LABELS[pago.mode] ?? pago.mode}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Referencia">
                {pago.reference ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              {bankAcc && (
                <Descriptions.Item label="Cuenta bancaria" span={2}>
                  <Space>
                    <BankOutlined />
                    <Text>{bankAcc.name}</Text>
                    {bankAcc.bankName && <Text type="secondary">— {bankAcc.bankName}</Text>}
                    {bankAcc.accountNumber && <Text type="secondary">({bankAcc.accountNumber})</Text>}
                  </Space>
                </Descriptions.Item>
              )}
              {pago.notes && (
                <Descriptions.Item label="Notas" span={2}>
                  <Text type="secondary">{pago.notes}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Partida contable */}
          <Card
            title={<Space><BookOutlined style={{ color: '#1B3A6B' }} />Póliza contable</Space>}
            extra={je ? <Text type="secondary" style={{ fontSize: 12 }}>{je.entryNumber}</Text> : null}
            bordered={false}
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          >
            {je ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{je.description}</Text>
                </div>
                <Table
                  columns={jeColumns}
                  dataSource={(je.lines ?? []) as JeLine[]}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ background: '#fafafa' }}>
                        <Table.Summary.Cell index={0}>
                          <Text strong>Total</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>
                            {fmtQ(je.totalDebit)}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>
                            {fmtQ(je.totalCredit)}
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
                    description={
                      <span>
                        Las cuentas no estaban configuradas al crear el pago. Use el botón{' '}
                        <strong>Reprocesar póliza</strong> para regenerarlas con las cuentas del catálogo actual.
                      </span>
                    }
                  />
                )}
              </>
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Sin póliza contable"
                description={
                  <span>
                    Este pago no tiene una póliza contable. Use el botón{' '}
                    <strong>Reprocesar póliza</strong> en la barra superior para generarla.
                  </span>
                }
              />
            )}
          </Card>
        </Col>

        {/* Panel factura */}
        <Col xs={24} lg={10}>
          <Card
            title={<Space><FileTextOutlined style={{ color: '#1B3A6B' }} />Factura aplicada</Space>}
            bordered={false}
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          >
            {invoice ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">N° Factura</Text>
                  <Text
                    strong
                    style={{ fontFamily: 'monospace', color: '#1B3A6B', cursor: 'pointer' }}
                    onClick={() => navigate(`/ventas/facturas/${invoice.id}`)}
                  >
                    {invoice.invoiceNumber}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Fecha</Text>
                  <Text>{invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('DD/MM/YYYY') : '—'}</Text>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Total factura</Text>
                  <Text>{fmtQ(invoice.total)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Pagado</Text>
                  <Text>{fmtQ(invoice.paidAmount)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Saldo actual</Text>
                  <Text strong style={{ color: Number(invoice.balance) > 0 ? '#fa541c' : '#52c41a' }}>
                    {fmtQ(invoice.balance)}
                  </Text>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Estado</Text>
                  <Tag color={INVOICE_STATUS_COLOR[invoice.status] ?? 'default'}>
                    {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                  </Tag>
                </div>
                <Button
                  block
                  type="default"
                  icon={<FileTextOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() => navigate(`/ventas/facturas/${invoice.id}`)}
                >
                  Ver factura
                </Button>
              </Space>
            ) : (
              <Text type="secondary">No se encontró la factura</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
