import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Button, Space, Typography, Tag, Table, Divider,
  Spin, message, Modal, Form, Input, InputNumber, Select,
  DatePicker, Alert, Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined, SendOutlined, CheckCircleOutlined,
  DollarOutlined, SafetyCertificateOutlined,
  FileTextOutlined, EditOutlined, StopOutlined, DeleteOutlined,
  SyncOutlined, GlobalOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getNotaCredito, emitirNotaCredito, aplicarNotaCredito, reembolsarNotaCredito,
  anularNotaCredito, deleteNotaCredito, recomputeJournalNC,
  NC_STATUS_CONFIG, type NotaCredito, type NcItem,
} from '../../../api/notas-credito'
import { getInvoices } from '../../../api/facturas'
import { getBankAccounts } from '../../../api/bancos'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const fmtQ  = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: number) => `GTQ ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function NotaCreditoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [nc,          setNc]          = useState<NotaCredito | null>(null)
  const [company,     setCompany]     = useState<OrganizationProfile>({ name: '' })
  const [loading,     setLoading]     = useState(true)
  const [emitting,    setEmitting]    = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [showVoid,    setShowVoid]    = useState(false)
  const [voiding,     setVoiding]     = useState(false)
  const [voidForm]    = Form.useForm()

  const [showApply,  setShowApply]  = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [applying,   setApplying]   = useState(false)
  const [refunding,  setRefunding]  = useState(false)
  const [invoices,   setInvoices]   = useState<any[]>([])
  const [bankAccts,  setBankAccts]  = useState<any[]>([])
  const [applyForm]  = Form.useForm()
  const [refundForm] = Form.useForm()

  const loadNc = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, org] = await Promise.all([
        getNotaCredito(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setNc(data)
      setCompany(org)
    } catch { message.error('No se pudo cargar la nota de crédito') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadNc() }, [loadNc])

  const loadInvoicesForApply = async () => {
    if (!nc) return
    const res  = await getInvoices({ customerId: nc.customerId, limit: 50 } as any)
    const list = Array.isArray(res) ? res : ((res as any)?.data ?? [])
    setInvoices(list.filter((inv: any) => inv.status !== 'voided' && inv.status !== 'paid' && inv.id !== nc.originalInvoiceId)
      .map((inv: any) => ({ value: inv.id, label: `${inv.invoiceNumber} — ${fmtQ(Number(inv.balance))} pendiente` })))
  }

  const loadBankAccounts = async () => {
    const res  = await getBankAccounts().catch(() => [])
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
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al emitir') }
    finally { setEmitting(false) }
  }

  const handleApply = async () => {
    try { await applyForm.validateFields() } catch { return }
    setApplying(true)
    try {
      const vals = applyForm.getFieldsValue()
      await aplicarNotaCredito(nc!.id, { invoiceId: vals.invoiceId, amount: vals.amount })
      message.success(`Crédito de ${fmtQ(vals.amount)} aplicado correctamente`)
      setShowApply(false); applyForm.resetFields(); loadNc()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al aplicar') }
    finally { setApplying(false) }
  }

  const handleRefund = async () => {
    try { await refundForm.validateFields() } catch { return }
    setRefunding(true)
    try {
      const vals = refundForm.getFieldsValue()
      await reembolsarNotaCredito(nc!.id, {
        amount: vals.amount, paymentDate: vals.paymentDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        mode: vals.mode || 'cash', bankAccountId: vals.bankAccountId, reference: vals.reference, notes: vals.notes,
      })
      message.success('Reembolso registrado y asiento contable generado')
      setShowRefund(false); refundForm.resetFields(); loadNc()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al registrar reembolso') }
    finally { setRefunding(false) }
  }

  const handleVoid = async () => {
    if (!nc) return
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      const updated = await anularNotaCredito(nc.id, reason)
      setNc(updated); setShowVoid(false); voidForm.resetFields()
      message.success('Nota de crédito anulada. Las pólizas contables fueron eliminadas.')
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al anular') }
    finally { setVoiding(false) }
  }

  const handleDelete = async () => {
    if (!nc) return
    try {
      await deleteNotaCredito(nc.id)
      message.success('Nota de crédito eliminada')
      navigate('/ventas/notas-credito')
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  const handleRecompute = async () => {
    if (!nc) return
    setRecomputing(true)
    try {
      const updated = await recomputeJournalNC(nc.id)
      setNc(updated)
      message.success('Pólizas contables recalculadas con las cuentas maestras')
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al recalcular') }
    finally { setRecomputing(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!nc) return <div style={{ padding: 40 }}><Text>Nota de crédito no encontrada</Text></div>

  const statusCfg = NC_STATUS_CONFIG[nc.status] ?? { label: nc.status, color: 'default' }
  const canAct    = nc.status !== 'draft' && nc.status !== 'voided'
  const isFelCertified = !!nc.felUuid

  const buildJournalEntries = () => {
    if (nc.journalLines?.length) {
      return nc.journalLines.map((l: any) => ({
        key: l.key, cuenta: `${l.accountCode} — ${l.accountName}`,
        debe: Number(l.debe), haber: Number(l.haber), tipo: l.tipo,
        seccion: (l.key.startsWith('inv_') || l.key.startsWith('costo_')) ? 'costo' : 'venta',
      }))
    }
    const subtotal = Number(nc.subtotal); const tax = Number(nc.taxAmount); const total = Number(nc.total)
    return [
      { key: 'cxc',  cuenta: '1130 — Cuentas por Cobrar Clientes', debe: 0, haber: total, tipo: 'activo', seccion: 'venta' },
      { key: 'ing',  cuenta: '4110 — Ingresos por Ventas', debe: subtotal, haber: 0, tipo: 'ingreso', seccion: 'venta' },
      ...(tax > 0 ? [{ key: 'iva', cuenta: '2210 — IVA por Pagar', debe: tax, haber: 0, tipo: 'pasivo', seccion: 'venta' }] : []),
    ]
  }

  const journalEntries = buildJournalEntries()
  const salesEntries   = journalEntries.filter(e => e.seccion === 'venta')
  const costEntries    = journalEntries.filter(e => e.seccion === 'costo')
  const salesTotal     = salesEntries.reduce((s, r) => s + r.debe, 0)
  const costTotal      = costEntries.reduce((s, r) => s + r.debe, 0)

  const itemColumns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text> },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v: string, row: NcItem) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {row.unit && <Text type="secondary" style={{ fontSize: 11 }}>{row.unit}</Text>}
        </div>
      ),
    },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Precio', dataIndex: 'unitPrice', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtQ(v)}</Text> },
    { title: 'Dto.%', dataIndex: 'discountPercent', width: 70, align: 'center' as const, render: (v: number) => v ? <Tag color="orange">{v}%</Tag> : null },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'center' as const, render: (v: number) => <Tag>{v}%</Tag> },
    {
      title: 'Total línea', dataIndex: 'lineTotal', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontFamily: 'monospace', color: '#cf1322', fontSize: 13 }}>{fmtQ(v)}</Text>,
    },
  ]

  const journalCols = [
    {
      title: 'CUENTA', dataIndex: 'cuenta',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'UBICACIÓN', width: 160,
      render: () => <Text type="secondary" style={{ fontSize: 12 }}>{company.name ?? '—'}</Text>,
    },
    {
      title: 'DÉBITO', dataIndex: 'debe', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
    {
      title: 'CRÉDITO', dataIndex: 'haber', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace', color: v > 0 ? '#389e0d' : undefined }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
  ]

  const ribbonColors: Record<string, string> = { voided: '#ff4d4f', draft: '#8c8c8c', sent: '#cf1322', partial: '#fa8c16' }
  const ribbonColor = ribbonColors[nc.status] ?? '#cf1322'

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ventas/notas-credito')}>
          Notas de crédito
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        {nc.felStatus && (
          <Tag color={nc.felStatus === 'certificada' ? 'green' : 'orange'} icon={<SafetyCertificateOutlined />} style={{ margin: 0 }}>
            {nc.felStatus}
          </Tag>
        )}
        <Divider type="vertical" />
        {nc.status === 'draft' && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/ventas/notas-credito/${nc.id}/editar`)}>
            Editar
          </Button>
        )}
        {nc.status === 'draft' && (
          <Button
            type="primary" icon={<SendOutlined />} loading={emitting} onClick={handleEmitir}
            style={{ background: nc.felTipoDocumento === 'NABN' ? '#fa8c16' : '#cf1322', borderColor: nc.felTipoDocumento === 'NABN' ? '#fa8c16' : '#cf1322' }}
          >
            Emitir FEL ({nc.felTipoDocumento || 'NCRE'})
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
        {(nc.status === 'sent' || nc.status === 'partial') && (
          <Button danger icon={<StopOutlined />} onClick={() => setShowVoid(true)}>Anular</Button>
        )}
        {nc.status !== 'draft' && (
          <Button icon={<SyncOutlined />} loading={recomputing} onClick={handleRecompute} style={{ color: '#722ed1', borderColor: '#722ed1' }}>
            Recalcular cuentas
          </Button>
        )}
        <Popconfirm
          title="¿Eliminar nota de crédito?"
          description={nc.status !== 'draft' ? 'Se eliminarán también las pólizas contables.' : 'Esta acción no se puede deshacer.'}
          onConfirm={handleDelete} okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
        </Popconfirm>
      </div>

      {/* ── Alerta borrador ───────────────────────────────────────────────── */}
      {nc.status === 'draft' && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="Esta nota de crédito está en borrador. Debe emitirse vía FEL (NCRE) para que sea válida y genere el asiento de reversión." />
      )}

      {/* ── Documento ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', position: 'relative' }}>

        {/* Ribbon */}
        <div style={{
          position: 'absolute', top: 18, left: -28, width: 120, textAlign: 'center',
          background: ribbonColor, color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 0', transform: 'rotate(-45deg)', letterSpacing: 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 1, textTransform: 'uppercase',
        }}>
          {statusCfg.label}
        </div>

        {/* Cabecera */}
        <div style={{ padding: '32px 40px 24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24 }}>
          <div>
            {company.logoUrl && (
              <img src={company.logoUrl} alt="logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain', marginBottom: 12 }} />
            )}
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>{company.name}</Title>
            {company.address && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{company.address}</Text>}
            {(company.city || company.country) && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {company.taxId && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>NIT: {company.taxId}</Text>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 240 }}>
            <Title level={3} style={{ margin: '0 0 4px', color: '#cf1322' }}>
              Nota de Crédito
            </Title>
            <Tag color={nc.felTipoDocumento === 'NABN' ? 'orange' : 'red'} style={{ marginBottom: 12 }}>
              {nc.felTipoDocumento || 'NCRE'}
            </Tag>
            {canAct && (
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Crédito disponible
                </Text>
                <Text style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#52c41a' }}>
                  {fmtGTQ(Number(nc.creditBalance))}
                </Text>
              </div>
            )}
            {!canAct && (
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Total nota
                </Text>
                <Text style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#cf1322' }}>
                  {fmtGTQ(Number(nc.total))}
                </Text>
              </div>
            )}
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Cliente + Metadatos */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Nota de crédito a
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1B3A6B', display: 'block' }}>{nc.customerName}</Text>
            {nc.customerTaxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {nc.customerTaxId}</Text>}
            {nc.creditNoteReason && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Motivo</Text>
                <Text style={{ fontSize: 12 }}>{nc.creditNoteReason}</Text>
              </div>
            )}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, width: '50%' }}>Número</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace', color: '#cf1322' }}>{nc.invoiceNumber}</Text></td>
                </tr>
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6 }}>Fecha</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong>{dayjs(nc.invoiceDate).format('DD MMM YYYY')}</Text></td>
                </tr>
                {nc.originalInvoice && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Factura original</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Link to={`/ventas/facturas/${nc.originalInvoiceId}`} style={{ color: '#1B3A6B', fontFamily: 'monospace', fontSize: 12 }}>
                        {nc.originalInvoice.invoiceNumber}
                      </Link>
                    </td>
                  </tr>
                )}
                {nc.felSerie && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Serie</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{nc.felSerie}</Text></td>
                  </tr>
                )}
                {nc.felNumero && (
                  <tr>
                    <td style={{ color: '#888', paddingBottom: 6 }}>Número SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontFamily: 'monospace' }}>{nc.felNumero}</Text></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table
            columns={itemColumns}
            dataSource={nc.items ?? []}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA (12%)</Text>
                <Text>{fmtQ(Number(nc.taxAmount))}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total nota de crédito</Text>
                <Text strong style={{ fontSize: 14, color: '#cf1322', fontFamily: 'monospace' }}>{fmtGTQ(Number(nc.total))}</Text>
              </div>
              {canAct && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text strong style={{ fontSize: 14 }}>Crédito disponible</Text>
                  <Text strong style={{ fontSize: 14, color: '#52c41a', fontFamily: 'monospace' }}>{fmtGTQ(Number(nc.creditBalance))}</Text>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Más información ───────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px', background: '#fafafa' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° Nota de crédito</Text>
            <Text strong style={{ fontFamily: 'monospace', color: '#cf1322' }}>{nc.invoiceNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            <Text type="secondary">Moneda</Text><Text>{nc.currency}</Text>
          </div>

          {isFelCertified && (
            <>
              <Divider style={{ margin: '16px 0 14px' }} />
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#cf1322', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 12 }}>
                Campos FEL / SAT
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 0', fontSize: 13 }}>
                {nc.felTipoDocumento && <><Text type="secondary">Tipo de documento</Text><Text>{nc.felTipoDocumento}</Text></>}
                {nc.felSerie && <><Text type="secondary">Serie</Text><Text style={{ fontFamily: 'monospace' }}>{nc.felSerie}</Text></>}
                {nc.felNumero && <><Text type="secondary">Número</Text><Text style={{ fontFamily: 'monospace' }}>{nc.felNumero}</Text></>}
                {nc.felAutorizacion && <><Text type="secondary">Autorización</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{nc.felAutorizacion}</Text></>}
                {nc.felUuid && <><Text type="secondary">UUID</Text><Text style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{nc.felUuid}</Text></>}
                {(nc as any).felUrl && (
                  <>
                    <Text type="secondary">URL</Text>
                    <a href={(nc as any).felUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      <GlobalOutlined style={{ marginRight: 4 }} />{(nc as any).felUrl}
                    </a>
                  </>
                )}
                {nc.felCertificadaAt && <><Text type="secondary">Fecha de certificación</Text><Text>{dayjs(nc.felCertificadaAt).format('DD/MM/YYYY HH:mm:ss')}</Text></>}
              </div>
            </>
          )}
        </div>

        {/* ── Diario / Póliza contable ──────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px 28px' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Diario
          </Text>
          {nc.status === 'draft' && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="El asiento de reversión se generará al emitir la nota de crédito vía FEL." />
          )}
          {/* Póliza reversión venta */}
          {salesEntries.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                Nota de crédito — Reversión de venta
              </Text>
              <Table
                dataSource={salesEntries} columns={journalCols} rowKey="key"
                size="small" pagination={false}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>{Number(salesTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace', color: '#389e0d' }}>{Number(salesTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </>
          )}
          {/* Póliza reversión costo/inventario */}
          {costEntries.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1', display: 'block', marginBottom: 6 }}>
                Nota de crédito — Reversión de costo / Inventario
              </Text>
              <Table
                dataSource={costEntries} columns={journalCols} rowKey="key"
                size="small" pagination={false}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>{Number(costTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontSize: 12, fontFamily: 'monospace', color: '#389e0d' }}>{Number(costTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      <Modal title={`Anular ${nc.invoiceNumber}`} open={showVoid}
        onCancel={() => { setShowVoid(false); voidForm.resetFields() }}
        onOk={handleVoid} confirmLoading={voiding} okText="Confirmar anulación" okButtonProps={{ danger: true }}
      >
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="Se eliminarán las pólizas contables y la NC quedará anulada. Solo posible si no ha sido aplicada ni reembolsada." />
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de anulación" rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Error en datos del cliente, importe incorrecto..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Aplicar nota de crédito a factura" open={showApply}
        onCancel={() => { setShowApply(false); applyForm.resetFields() }}
        onOk={handleApply} confirmLoading={applying} okText="Aplicar crédito" okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Crédito disponible: <Text strong style={{ color: '#52c41a' }}>{fmtQ(Number(nc.creditBalance))}</Text>
        </Text>
        <Form form={applyForm} layout="vertical">
          <Form.Item name="invoiceId" label="Factura destino" rules={[{ required: true, message: 'Selecciona una factura' }]}>
            <Select placeholder="Seleccionar factura pendiente del cliente..." options={invoices} />
          </Form.Item>
          <Form.Item name="amount" label="Monto a aplicar"
            rules={[{ required: true, message: 'Ingresa el monto' }, { type: 'number', max: Number(nc.creditBalance), message: `Máximo: ${fmtQ(Number(nc.creditBalance))}` }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} max={Number(nc.creditBalance)} precision={2} prefix="Q" placeholder="0.00" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Reembolso en efectivo / banco" open={showRefund}
        onCancel={() => { setShowRefund(false); refundForm.resetFields() }}
        onOk={handleRefund} confirmLoading={refunding} okText="Registrar reembolso" okButtonProps={{ style: { background: '#52c41a' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Crédito disponible: <Text strong style={{ color: '#52c41a' }}>{fmtQ(Number(nc.creditBalance))}</Text>
        </Text>
        <Form form={refundForm} layout="vertical" initialValues={{ mode: 'cash', paymentDate: dayjs() }}>
          <Form.Item name="amount" label="Monto a reembolsar"
            rules={[{ required: true, message: 'Ingresa el monto' }, { type: 'number', max: Number(nc.creditBalance), message: `Máximo: ${fmtQ(Number(nc.creditBalance))}` }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} max={Number(nc.creditBalance)} precision={2} prefix="Q" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="paymentDate" label="Fecha" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="mode" label="Forma de pago">
              <Select options={[{ value: 'cash', label: 'Efectivo' }, { value: 'bank_transfer', label: 'Transferencia' }, { value: 'check', label: 'Cheque' }]} />
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
