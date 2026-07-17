import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Tag, Table, Divider, Spin, message,
  Modal, Form, Input, Alert, Popconfirm, Space,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckOutlined,
  SyncOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getBill, approveCreditNote, voidBill, deleteBill, regenerateBillJournalEntry,
  getJournalEntry,
  BILL_STATUS_CONFIG, BILL_TYPE_CONFIG,
  type PurchaseInvoice, type JournalEntry,
} from '../../../api/compras'
import { getOrganizationProfile, type OrganizationProfile } from '../../../api/configuracion'

const { Title, Text } = Typography
const fmtQ   = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtGTQ = (n: number, cur = 'GTQ') => `${cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function NotaCreditoProveedorDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [bill,         setBill]         = useState<PurchaseInvoice | null>(null)
  const [company,      setCompany]      = useState<OrganizationProfile>({ name: '' })
  const [journal,      setJournal]      = useState<JournalEntry | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [approving,    setApproving]    = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [voiding,      setVoiding]      = useState(false)
  const [showVoid,     setShowVoid]     = useState(false)
  const [voidForm] = Form.useForm()

  const loadBill = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [b, org] = await Promise.all([
        getBill(id),
        getOrganizationProfile().catch(() => ({ name: '' } as OrganizationProfile)),
      ])
      setBill(b)
      setCompany(org)
      if (b.journalEntryId) getJournalEntry(b.journalEntryId).then(setJournal).catch(() => {})
    } catch { message.error('No se pudo cargar la nota de crédito') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadBill() }, [loadBill])

  const handleApprove = async () => {
    if (!bill) return
    setApproving(true)
    try {
      await approveCreditNote(bill.id)
      message.success('Nota de crédito aprobada — póliza contable generada')
      loadBill()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al aprobar') }
    finally { setApproving(false) }
  }

  const handleVoid = async () => {
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      await voidBill(bill!.id, reason)
      message.success('Nota de crédito anulada')
      setShowVoid(false); voidForm.resetFields(); loadBill()
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al anular') }
    finally { setVoiding(false) }
  }

  const handleDelete = async () => {
    try { await deleteBill(bill!.id); message.success('Nota de crédito eliminada'); navigate('/compras/notas-credito-proveedor') }
    catch (e: any) { message.error(e?.response?.data?.message || 'Error al eliminar') }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updated = await regenerateBillJournalEntry(bill!.id)
      if (updated.journalEntryId) getJournalEntry(updated.journalEntryId).then(setJournal).catch(() => {})
      message.success('Póliza regenerada')
    } catch (e: any) { message.error(e?.response?.data?.message || 'Error al regenerar') }
    finally { setRegenerating(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!bill)   return <div style={{ padding: 40 }}><Text>Nota de crédito no encontrada</Text></div>

  const statusCfg  = BILL_STATUS_CONFIG[bill.status] ?? { label: bill.status, color: 'default' }
  const canEdit    = ['draft', 'pending_approval'].includes(bill.status)
  const canApprove = ['draft', 'pending_approval'].includes(bill.status)
  const canVoid    = ['open'].includes(bill.status)
  const hasFel     = !!bill.felSerie || !!bill.felNumber || !!bill.felUuid

  const ribbonColors: Record<string, string> = {
    voided: '#e5484d', draft: '#6b7280', open: '#2ea172',
    pending_approval: '#6b7280', partial: '#1faec2',
  }
  const ribbonColor = ribbonColors[bill.status] ?? '#6b7280'

  const itemColumns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text> },
    {
      title: 'Descripción', dataIndex: 'description',
      render: (v: string, row: any) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {row.unit && <Text type="secondary" style={{ fontSize: 11 }}>{row.unit}</Text>}
        </div>
      ),
    },
    { title: 'Cant.', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Precio', dataIndex: 'unitPrice', width: 130, align: 'right' as const, render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</Text> },
    { title: 'IVA%', dataIndex: 'taxPercent', width: 70, align: 'center' as const, render: (v: number) => <Tag>{v ?? 12}%</Tag> },
    {
      title: 'Total línea', dataIndex: 'lineTotal', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172', fontSize: 13 }}>{fmtQ(v)}</Text>,
    },
  ]

  const journalCols = [
    { title: 'CUENTA', dataIndex: 'cuenta', render: (v: string) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v}</Text> },
    { title: 'UBICACIÓN', width: 160, render: () => <Text type="secondary" style={{ fontSize: 12 }}>{company.name ?? '—'}</Text> },
    {
      title: 'DÉBITO', dataIndex: 'debit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
    {
      title: 'CRÉDITO', dataIndex: 'credit', width: 130, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#2ea172' : undefined }}>{v > 0 ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}</Text>,
    },
  ]

  const journalRows = journal ? (journal.lines ?? []).map(l => ({
    key: l.id, cuenta: `${l.accountCode} — ${l.accountName}`, debit: Number(l.debit), credit: Number(l.credit),
  })) : []

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── Barra de acciones ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        marginBottom: 16, padding: '10px 0', borderBottom: '1px solid rgba(10,10,10,0.08)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/compras/notas-credito-proveedor')}>
          Notas de crédito
        </Button>
        <Divider type="vertical" />
        <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 12 }}>{statusCfg.label}</Tag>
        <Divider type="vertical" />
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/compras/notas-credito-proveedor/${bill.id}/editar`)}>
            Editar
          </Button>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckOutlined />} loading={approving} onClick={handleApprove}
            style={{ background: '#2ea172', borderColor: '#2ea172' }}>
            Aprobar NC
          </Button>
        )}
        {!canEdit && bill.status !== 'voided' && (
          <Button icon={<SyncOutlined />} loading={regenerating} onClick={handleRegenerate}
            style={{ color: '#6b7280', borderColor: '#6b7280' }}>
            Regenerar póliza
          </Button>
        )}
        {canVoid && (
          <Button danger icon={<StopOutlined />} onClick={() => setShowVoid(true)}>Anular</Button>
        )}
        {canEdit && (
          <Popconfirm title="¿Eliminar esta nota de crédito?" onConfirm={handleDelete}
            okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        )}
      </div>

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
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{company.name}</Title>
            {company.address && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{company.address}</Text>}
            {(company.city || company.country) && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {[company.city, company.state, company.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {company.taxId && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>NIT: {company.taxId}</Text>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 240 }}>
            <Title level={3} style={{ margin: '0 0 4px', color: '#2ea172' }}>
              Nota de Crédito Proveedor
            </Title>
            <Tag style={{ marginBottom: 12 }}>{BILL_TYPE_CONFIG[bill.invoiceType]?.label ?? bill.invoiceType}</Tag>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Crédito recibido
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>
                {fmtGTQ(Number(bill.total), bill.currency)}
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 40px' }} />

        {/* Proveedor + Metadatos */}
        <div style={{ padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
              Nota de crédito de
            </Text>
            <Text strong style={{ fontSize: 15, color: '#1faec2', display: 'block' }}>{bill.vendorName}</Text>
            {bill.vendorTaxId && <Text type="secondary" style={{ fontSize: 12 }}>NIT: {bill.vendorTaxId}</Text>}
            {bill.creditNoteReason && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Motivo</Text>
                <Text style={{ fontSize: 12 }}>{bill.creditNoteReason}</Text>
              </div>
            )}
            {bill.notes && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Notas</Text>
                <Text style={{ fontSize: 12 }}>{bill.notes}</Text>
              </div>
            )}
          </div>
          <div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#6b7280', paddingBottom: 6, width: '50%' }}>Número interno</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{bill.invoiceNumber}</Text>
                  </td>
                </tr>
                {bill.vendorInvoiceNumber && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Número proveedor</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                      <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.vendorInvoiceNumber}</Text>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#6b7280', paddingBottom: 6 }}>Fecha</td>
                  <td style={{ textAlign: 'right', paddingBottom: 6 }}>
                    <Text strong>{dayjs(bill.invoiceDate).format('DD MMM YYYY')}</Text>
                  </td>
                </tr>
                {bill.felSerie && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Serie FEL</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felSerie}</Text></td>
                  </tr>
                )}
                {bill.felNumber && (
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: 6 }}>Número SAT</td>
                    <td style={{ textAlign: 'right', paddingBottom: 6 }}><Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felNumber}</Text></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ítems */}
        <div style={{ padding: '0 40px 24px' }}>
          <Table columns={itemColumns} dataSource={bill.items ?? []} rowKey={(_, i) => String(i)}
            pagination={false} size="small" scroll={{ x: 620 }}
            style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">Subtotal</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.subtotal), bill.currency)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <Text type="secondary">IVA</Text>
                <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.taxAmount), bill.currency)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total nota de crédito</Text>
                <Text strong style={{ fontSize: 14, color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>{fmtGTQ(Number(bill.total), bill.currency)}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── Más información ─────────────────────────────────────────────── */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '20px 40px', background: '#fafbfc' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
            Más información
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
            <Text type="secondary">N° interno</Text>
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{bill.invoiceNumber}</Text>
            {company.name && <><Text type="secondary">Empresa</Text><Text>{company.name}</Text></>}
            <Text type="secondary">Moneda</Text><Text>{bill.currency}</Text>
            {bill.accountingDate && <><Text type="secondary">Fecha contabilización</Text><Text>{dayjs(bill.accountingDate).format('DD/MM/YYYY')}</Text></>}
          </div>

          {hasFel && (
            <>
              <Divider style={{ margin: '16px 0 14px' }} />
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#2ea172', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 12 }}>
                Campos FEL / SAT
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 0', fontSize: 13 }}>
                {bill.felSerie && <><Text type="secondary">Serie</Text><Text style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felSerie}</Text></>}
                {bill.felNumber && <><Text type="secondary">Número</Text><Text style={{ fontVariantNumeric: 'tabular-nums' }}>{bill.felNumber}</Text></>}
                {bill.felAuthNumber && <><Text type="secondary">Autorización</Text><Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, wordBreak: 'break-all' }}>{bill.felAuthNumber}</Text></>}
                {bill.felUuid && <><Text type="secondary">UUID</Text><Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, wordBreak: 'break-all' }}>{bill.felUuid}</Text></>}
                {bill.felCertDate && <><Text type="secondary">Fecha certificación</Text><Text>{dayjs(bill.felCertDate).format('DD/MM/YYYY HH:mm:ss')}</Text></>}
              </div>
            </>
          )}
        </div>

        {/* ── Diario ─────────────────────────────────────────────────────── */}
        {journal && (
          <>
            <Divider style={{ margin: 0 }} />
            <div style={{ padding: '20px 40px 28px' }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
                Diario
              </Text>
              <Space size={8} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
                  Nota de crédito proveedor — {journal.entryNumber}
                </Text>
                <Tag color={journal.status === 'posted' ? '#2ea172' : 'default'} style={{ margin: 0 }}>
                  {journal.status === 'posted' ? 'Publicada' : journal.status}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(journal.entryDate).format('DD/MM/YYYY')}</Text>
              </Space>
              <Table dataSource={journalRows} columns={journalCols} rowKey="key"
                size="small" pagination={false}
                style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafbfc' }}>
                      <Table.Summary.Cell index={0} colSpan={2}><Text strong style={{ fontSize: 12 }}>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Number(journal.totalDebit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{Number(journal.totalCredit).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )} />
            </div>
          </>
        )}
      </div>

      {/* ── Modal anular ─────────────────────────────────────────────────── */}
      <Modal title="Anular nota de crédito" open={showVoid}
        onCancel={() => { setShowVoid(false); voidForm.resetFields() }}
        onOk={handleVoid} confirmLoading={voiding} okText="Confirmar anulación"
        okButtonProps={{ danger: true }}>
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="Se revertirán las pólizas contables y la nota de crédito quedará anulada." />
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo" rules={[{ required: true, message: 'El motivo es requerido' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Error en importes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
