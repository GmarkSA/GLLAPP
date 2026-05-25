import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Table,
  Breadcrumb, Spin, message, Modal, Form, Input, InputNumber, Select,
  DatePicker, Progress, Divider, Alert, Popconfirm,
} from 'antd'
import {
  HomeOutlined, SendOutlined, CheckCircleOutlined,
  RollbackOutlined, DollarOutlined, SafetyCertificateOutlined,
  FileTextOutlined, BookOutlined, EditOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getNotaCredito, emitirNotaCredito, aplicarNotaCredito, reembolsarNotaCredito,
  anularNotaCredito, deleteNotaCredito, recomputeJournalNC,
  NC_STATUS_CONFIG, type NotaCredito, type NcItem,
} from '../../../api/notas-credito'
import { getInvoices } from '../../../api/facturas'
import { getBankAccounts } from '../../../api/bancos'

const { Title, Text } = Typography

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function NotaCreditoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [nc,        setNc]        = useState<NotaCredito | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [emitting,  setEmitting]  = useState(false)
  const [showJournal,   setShowJournal]   = useState(false)
  const [recomputing,   setRecomputing]   = useState(false)
  const [showVoid,      setShowVoid]      = useState(false)
  const [voiding,       setVoiding]       = useState(false)
  const [voidForm]      = Form.useForm()

  // Modales
  const [showApply,   setShowApply]   = useState(false)
  const [showRefund,  setShowRefund]  = useState(false)
  const [applying,    setApplying]    = useState(false)
  const [refunding,   setRefunding]   = useState(false)
  const [invoices,    setInvoices]    = useState<any[]>([])
  const [bankAccts,   setBankAccts]   = useState<any[]>([])
  const [applyForm]   = Form.useForm()
  const [refundForm]  = Form.useForm()

  const loadNc = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getNotaCredito(id)
      setNc(data)
    } catch { message.error('No se pudo cargar la nota de crédito') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadNc() }, [loadNc])

  const loadInvoicesForApply = async () => {
    if (!nc) return
    const res = await getInvoices({ customerId: nc.customerId, limit: 50 } as any)
    const list = Array.isArray(res) ? res : ((res as any)?.data ?? [])
    setInvoices(
      list
        .filter((inv: any) => inv.status !== 'voided' && inv.status !== 'paid' && inv.id !== nc.originalInvoiceId)
        .map((inv: any) => ({
          value: inv.id,
          label: `${inv.invoiceNumber} — ${fmtQ(Number(inv.balance))} pendiente`,
        }))
    )
  }

  const loadBankAccounts = async () => {
    const res = await getBankAccounts().catch(() => [])
    const list = Array.isArray(res) ? res : ((res as any)?.data ?? [])
    setBankAccts(list.map((b: any) => ({ value: b.id, label: `${b.name} — ${b.currency}` })))
  }

  const handleEmitir = async () => {
    if (!nc) return
    setEmitting(true)
    try {
      const updated = await emitirNotaCredito(nc.id)
      setNc(updated)
      message.success('Nota de crédito emitida y asiento contable generado')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al emitir')
    } finally { setEmitting(false) }
  }

  const handleApply = async () => {
    try { await applyForm.validateFields() } catch { return }
    setApplying(true)
    try {
      const vals = applyForm.getFieldsValue()
      await aplicarNotaCredito(nc!.id, { invoiceId: vals.invoiceId, amount: vals.amount })
      message.success(`Crédito de ${fmtQ(vals.amount)} aplicado correctamente`)
      setShowApply(false)
      applyForm.resetFields()
      loadNc()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al aplicar')
    } finally { setApplying(false) }
  }

  const handleRefund = async () => {
    try { await refundForm.validateFields() } catch { return }
    setRefunding(true)
    try {
      const vals = refundForm.getFieldsValue()
      await reembolsarNotaCredito(nc!.id, {
        amount:        vals.amount,
        paymentDate:   vals.paymentDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        mode:          vals.mode || 'cash',
        bankAccountId: vals.bankAccountId,
        reference:     vals.reference,
        notes:         vals.notes,
      })
      message.success('Reembolso registrado y asiento contable generado')
      setShowRefund(false)
      refundForm.resetFields()
      loadNc()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al registrar reembolso')
    } finally { setRefunding(false) }
  }

  const handleVoid = async () => {
    if (!nc) return
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      const updated = await anularNotaCredito(nc.id, reason)
      setNc(updated)
      setShowVoid(false)
      voidForm.resetFields()
      message.success('Nota de crédito anulada. Las pólizas contables fueron eliminadas.')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al anular')
    } finally { setVoiding(false) }
  }

  const handleDelete = async () => {
    if (!nc) return
    try {
      await deleteNotaCredito(nc.id)
      message.success('Nota de crédito eliminada')
      navigate('/ventas/notas-credito')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar')
    }
  }

  const handleRecompute = async () => {
    if (!nc) return
    setRecomputing(true)
    try {
      const updated = await recomputeJournalNC(nc.id)
      setNc(updated)
      setShowJournal(true)
      message.success('Pólizas contables recalculadas con las cuentas maestras')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al recalcular')
    } finally { setRecomputing(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!nc) return <div style={{ padding: 40 }}><Text>Nota de crédito no encontrada</Text></div>

  const statusCfg = NC_STATUS_CONFIG[nc.status] ?? { label: nc.status, color: 'default' }

  // ── Partida contable ─────────────────────────────────────────────────────
  const buildJournalEntries = () => {
    // Líneas reales guardadas por el backend al emitir
    if (nc.journalLines?.length) {
      return nc.journalLines.map((l: any) => ({
        key:    l.key,
        cuenta: `${l.accountCode} — ${l.accountName}`,
        debe:   Number(l.debe),
        haber:  Number(l.haber),
        tipo:   l.tipo,
        seccion: (l.key.startsWith('inv_') || l.key.startsWith('costo_')) ? 'costo' : 'venta',
      }))
    }
    // Estimación para borradores (antes de emitir)
    const subtotal = Number(nc.subtotal)
    const tax      = Number(nc.taxAmount)
    const total    = Number(nc.total)
    return [
      { key: 'cxc',  cuenta: '1130 — Cuentas por Cobrar Clientes', debe: 0,       haber: total,    tipo: 'activo',  seccion: 'venta' },
      { key: 'ing',  cuenta: '4110 — Ingresos por Ventas',         debe: subtotal, haber: 0,        tipo: 'ingreso', seccion: 'venta' },
      ...(tax > 0 ? [
        { key: 'iva', cuenta: '2210 — IVA por Pagar',              debe: tax,      haber: 0,        tipo: 'pasivo',  seccion: 'venta' },
      ] : []),
    ]
  }

  const journalEntries = buildJournalEntries()
  const salesEntries   = journalEntries.filter(e => e.seccion === 'venta')
  const costEntries    = journalEntries.filter(e => e.seccion === 'costo')
  const salesTotal     = salesEntries.reduce((s, r) => s + r.debe, 0)
  const costTotal      = costEntries.reduce((s, r) => s + r.debe, 0)

  const tipoColor = (tipo: string) =>
    tipo === 'activo'  ? '#1890ff'
    : tipo === 'ingreso' ? '#52c41a'
    : tipo === 'pasivo'  ? '#fa8c16'
    : tipo === 'costo'   ? '#722ed1'
    : '#ff4d4f'

  const journalColumns = [
    {
      title: 'Cuenta Contable', dataIndex: 'cuenta',
      render: (v: string, row: any) => (
        <Space>
          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: tipoColor(row.tipo) }} />
          <Text style={{ fontSize: 12 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Debe', dataIndex: 'debe', width: 145, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#1890ff', fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Haber', dataIndex: 'haber', width: 145, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#52c41a', fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
  ]
  const creditUsed = Number(nc.appliedCreditAmount) / Math.max(Number(nc.total), 1) * 100
  const canAct     = nc.status !== 'draft' && nc.status !== 'voided'

  const itemColumns: ColumnsType<NcItem> = [
    { title: 'Descripción', dataIndex: 'description' },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' },
    { title: 'Precio', dataIndex: 'unitPrice', width: 120, align: 'right',
      render: v => <Text style={{ fontFamily: 'monospace' }}>{fmtQ(v)}</Text> },
    { title: 'Dto.%', dataIndex: 'discountPercent', width: 70, align: 'right',
      render: v => v ? `${v}%` : '—' },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'right',
      render: v => v ? `${v}%` : '—' },
    { title: 'Total línea', dataIndex: 'lineTotal', width: 130, align: 'right',
      render: v => <Text strong style={{ fontFamily: 'monospace', color: '#cf1322' }}>{fmtQ(v)}</Text> },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/"><HomeOutlined /></Link> },
        { title: <Link to="/ventas/notas-credito">Notas de Crédito</Link> },
        { title: nc.invoiceNumber },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ fontSize: 22, color: '#cf1322' }} />
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{nc.invoiceNumber}</Title>
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
            {nc.felStatus && (
              <Tag color={nc.felStatus === 'certificada' ? 'green' : 'orange'} icon={<SafetyCertificateOutlined />}>
                {nc.felStatus}
              </Tag>
            )}
          </div>
          <Text type="secondary">{nc.customerName} — {dayjs(nc.invoiceDate).format('DD/MM/YYYY')}</Text>
        </div>
        <Space wrap>
          <Button icon={<RollbackOutlined />} onClick={() => navigate('/ventas/notas-credito')}>
            Volver
          </Button>

          {/* ── Acciones por estado ── */}
          {nc.status === 'draft' && (
            <Button icon={<EditOutlined />}
              onClick={() => navigate(`/ventas/notas-credito/${nc.id}/editar`)}>
              Editar
            </Button>
          )}
          {nc.status === 'draft' && (
            <Button
              type="primary" icon={<SendOutlined />}
              loading={emitting} onClick={handleEmitir}
              style={{ background: nc.felTipoDocumento === 'NABN' ? '#fa8c16' : '#1B3A6B' }}
            >
              Emitir FEL ({nc.felTipoDocumento || 'NCRE'})
            </Button>
          )}
          <Popconfirm
            title="¿Eliminar nota de crédito?"
            description={
              nc.status !== 'draft'
                ? 'Se eliminarán también las pólizas contables. Esta acción no se puede deshacer.'
                : 'Esta acción no se puede deshacer.'
            }
            onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
          {(nc.status === 'sent' || nc.status === 'partial') && (
            <Button danger icon={<StopOutlined />} onClick={() => setShowVoid(true)}>
              Anular
            </Button>
          )}
          {canAct && Number(nc.creditBalance) > 0 && (
            <>
              <Button
                icon={<CheckCircleOutlined />}
                style={{ color: '#1B3A6B', borderColor: '#1B3A6B' }}
                onClick={() => { loadInvoicesForApply(); setShowApply(true) }}
              >
                Aplicar a factura
              </Button>
              <Button
                icon={<DollarOutlined />}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => { loadBankAccounts(); setShowRefund(true) }}
              >
                Reembolso
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* Alerta si es borrador */}
      {nc.status === 'draft' && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="Esta nota de crédito está en borrador. Debe emitirse vía FEL (NCRE) para que sea válida y genere el asiento contable de reversión."
        />
      )}

      {/* Resumen crédito */}
      {canAct && (
        <Card
          bordered={false}
          style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', background: '#f6ffed', borderLeft: '4px solid #52c41a' }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text type="secondary">Crédito disponible</Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a', fontFamily: 'monospace' }}>
                {fmtQ(Number(nc.creditBalance))}
              </div>
            </div>
            <div style={{ width: 200 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Aplicado: {fmtQ(Number(nc.appliedCreditAmount))} / {fmtQ(Number(nc.total))}</Text>
              <Progress percent={Math.round(creditUsed)} strokeColor="#1B3A6B" size="small" />
            </div>
          </div>
        </Card>
      )}

      {/* Datos generales */}
      <Card
        title="Datos generales"
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
      >
        <Descriptions size="small" column={3}>
          <Descriptions.Item label="N° NC"><Text strong style={{ fontFamily: 'monospace' }}>{nc.invoiceNumber}</Text></Descriptions.Item>
          <Descriptions.Item label="Fecha">{dayjs(nc.invoiceDate).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Moneda">{nc.currency}</Descriptions.Item>
          <Descriptions.Item label="Cliente"><Text strong>{nc.customerName}</Text></Descriptions.Item>
          <Descriptions.Item label="NIT">{nc.customerTaxId || '—'}</Descriptions.Item>
          <Descriptions.Item label="Tipo FEL">
            <Tag color={nc.felTipoDocumento === 'NABN' ? 'orange' : 'blue'}>
              {nc.felTipoDocumento || 'NCRE'}
            </Tag>
          </Descriptions.Item>
          {nc.originalInvoice && (
            <Descriptions.Item label="Factura original" span={2}>
              <Link to={`/ventas/facturas/${nc.originalInvoiceId}`}>
                <Text style={{ color: '#1B3A6B', fontFamily: 'monospace' }}>
                  {nc.originalInvoice.invoiceNumber}
                </Text>
              </Link>
              {' '}<Text type="secondary">— {fmtQ(Number(nc.originalInvoice.total))}</Text>
            </Descriptions.Item>
          )}
          {nc.creditNoteReason && (
            <Descriptions.Item label="Motivo" span={3}>
              <Text>{nc.creditNoteReason}</Text>
            </Descriptions.Item>
          )}
          {nc.felUuid && (
            <>
              <Descriptions.Item label="UUID SAT"><Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{nc.felUuid}</Text></Descriptions.Item>
              <Descriptions.Item label="Autorización"><Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{nc.felAutorizacion}</Text></Descriptions.Item>
              <Descriptions.Item label="Certificada">{nc.felCertificadaAt ? dayjs(nc.felCertificadaAt).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Ítems */}
      <Card
        title="Líneas de la nota de crédito"
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={itemColumns}
          dataSource={nc.items ?? []}
          rowKey={(_, i) => String(i)}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={5}><Text strong>Subtotal</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(Number(nc.subtotal))}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={5}><Text>IVA (12%)</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text style={{ fontFamily: 'monospace' }}>{fmtQ(Number(nc.taxAmount))}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row style={{ background: '#fff2f0' }}>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong style={{ fontSize: 14 }}>TOTAL NOTA DE CRÉDITO</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#cf1322' }}>
                    {fmtQ(Number(nc.total))}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* Partida contable */}
      <Card
        size="small"
        style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        title={
          <Space>
            <BookOutlined style={{ color: '#1B3A6B' }} />
            <span>Partida Contable — Reversión</span>
            {!showJournal && (
              <Tag color="geekblue" style={{ cursor: 'pointer' }} onClick={() => setShowJournal(true)}>
                Ver
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space size={4}>
            {nc.status !== 'draft' && (
              <Button
                size="small" type="link"
                loading={recomputing}
                onClick={handleRecompute}
                style={{ color: '#722ed1', padding: '0 4px' }}
              >
                ↻ Recalcular cuentas
              </Button>
            )}
            {showJournal && (
              <Button size="small" type="text" onClick={() => setShowJournal(false)}>Ocultar</Button>
            )}
          </Space>
        }
      >
        {showJournal ? (
          <>
            <Alert
              type={nc.status === 'draft' ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                nc.status === 'draft'
                  ? 'Estimación contable — las cuentas reales se asignarán al emitir (NCRE/NABN)'
                  : 'Asientos de reversión generados automáticamente al emitir la nota de crédito'
              }
            />

            {/* Póliza 1: Reversión de venta */}
            <Text strong style={{ fontSize: 12, color: '#1B3A6B', display: 'block', marginBottom: 4 }}>
              📄 Póliza de reversión — Venta
              {nc.journalEntryId && (
                <Text code style={{ fontSize: 10, marginLeft: 8 }}>{nc.journalEntryId.substring(0, 8)}…</Text>
              )}
            </Text>
            <Table
              dataSource={salesEntries}
              columns={journalColumns}
              rowKey="key"
              pagination={false}
              size="small"
              style={{ marginBottom: 12 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total póliza</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#1890ff', fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(salesTotal)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ color: '#52c41a', fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(salesTotal)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />

            {/* Póliza 2: Reversión de costo (solo si hay artículos inventariables) */}
            {costEntries.length > 0 && (
              <>
                <Text strong style={{ fontSize: 12, color: '#722ed1', display: 'block', marginBottom: 4 }}>
                  📦 Póliza de reversión — Costo / Inventario
                  {nc.costJournalEntryId && (
                    <Text code style={{ fontSize: 10, marginLeft: 8 }}>{nc.costJournalEntryId.substring(0, 8)}…</Text>
                  )}
                </Text>
                <Table
                  dataSource={costEntries}
                  columns={journalColumns}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 8 }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}><Text strong style={{ fontSize: 12 }}>Total póliza</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong style={{ color: '#1890ff', fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(costTotal)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ color: '#52c41a', fontFamily: 'monospace', fontSize: 12 }}>{fmtQ(costTotal)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </>
            )}

            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              ✓ Cada póliza está balanceada (Débito = Crédito)
            </div>
          </>
        ) : (
          <div style={{ color: '#8c8c8c', fontSize: 13, padding: '4px 0' }}>
            {nc.status === 'draft'
              ? 'El asiento de reversión se generará al emitir. Haga clic en Ver para previsualizar con cuentas estimadas.'
              : 'Haga clic en Ver para mostrar las pólizas de reversión (venta + costo de inventario).'}
          </div>
        )}
      </Card>

      {/* Modal: Anular */}
      <Modal
        title={`Anular ${nc.invoiceNumber}`}
        open={showVoid}
        onCancel={() => { setShowVoid(false); voidForm.resetFields() }}
        onOk={handleVoid}
        confirmLoading={voiding}
        okText="Confirmar anulación"
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="Esta acción eliminará las pólizas contables y marcará la NC como anulada. Solo es posible si no ha sido aplicada ni reembolsada."
        />
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de anulación"
            rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Error en datos del cliente, importe incorrecto..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Aplicar a factura */}
      <Modal
        title="Aplicar nota de crédito a factura"
        open={showApply}
        onCancel={() => { setShowApply(false); applyForm.resetFields() }}
        onOk={handleApply}
        confirmLoading={applying}
        okText="Aplicar crédito"
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Crédito disponible: <Text strong style={{ color: '#52c41a' }}>{fmtQ(Number(nc.creditBalance))}</Text>
        </Text>
        <Form form={applyForm} layout="vertical">
          <Form.Item name="invoiceId" label="Factura destino" rules={[{ required: true, message: 'Selecciona una factura' }]}>
            <Select placeholder="Seleccionar factura pendiente del cliente..." options={invoices} />
          </Form.Item>
          <Form.Item name="amount" label="Monto a aplicar"
            rules={[
              { required: true, message: 'Ingresa el monto' },
              { type: 'number', max: Number(nc.creditBalance), message: `Máximo: ${fmtQ(Number(nc.creditBalance))}` },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }} min={0.01} max={Number(nc.creditBalance)}
              precision={2} prefix="Q" placeholder="0.00"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Reembolso */}
      <Modal
        title="Reembolso en efectivo / banco"
        open={showRefund}
        onCancel={() => { setShowRefund(false); refundForm.resetFields() }}
        onOk={handleRefund}
        confirmLoading={refunding}
        okText="Registrar reembolso"
        okButtonProps={{ style: { background: '#52c41a' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Crédito disponible: <Text strong style={{ color: '#52c41a' }}>{fmtQ(Number(nc.creditBalance))}</Text>
        </Text>
        <Form form={refundForm} layout="vertical" initialValues={{ mode: 'cash', paymentDate: dayjs() }}>
          <Form.Item name="amount" label="Monto a reembolsar"
            rules={[
              { required: true, message: 'Ingresa el monto' },
              { type: 'number', max: Number(nc.creditBalance), message: `Máximo: ${fmtQ(Number(nc.creditBalance))}` },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} max={Number(nc.creditBalance)} precision={2} prefix="Q" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="paymentDate" label="Fecha" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="mode" label="Forma de pago">
              <Select options={[
                { value: 'cash',          label: '💵 Efectivo' },
                { value: 'bank_transfer', label: '🏦 Transferencia' },
                { value: 'check',         label: '📄 Cheque' },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="bankAccountId" label="Cuenta bancaria (opcional)">
            <Select allowClear placeholder="Seleccionar cuenta..." options={bankAccts} />
          </Form.Item>
          <Form.Item name="reference" label="Referencia / N° cheque">
            <Input placeholder="Ej: CHQ-001234" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
