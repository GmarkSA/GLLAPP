import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  Select, message, Popconfirm, Tooltip, Modal, Descriptions, Alert,
  Drawer, InputNumber, Divider, Badge,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  PrinterOutlined, StopOutlined, BookOutlined, DollarOutlined,
  EyeOutlined, SettingOutlined, DeleteOutlined, FilterOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPagosRealizados, anularPagoRealizado, deletePagoRealizado,
  type VendorPayment, type AppliedInvoice,
} from '../../../api/pagosRealizados'
import { getAsiento } from '../../../api/asientos'

const { Text, Title } = Typography

const fmtQ = (n: number, cur = 'GTQ') =>
  `${cur === 'GTQ' ? 'Q' : cur} ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const MODE_LABELS: Record<string, string> = {
  cash:          'Efectivo',
  bank_transfer: 'Transferencia',
  check:         'Cheque',
  credit_card:   'Tarjeta crédito',
  debit_card:    'Tarjeta débito',
  other:         'Otro',
}

const STATUS_COLOR: Record<string, string> = {
  draft:   'default',
  issued:  'blue',
  cleared: '#2ea172',
  voided:  'red',
}

const STATUS_LABEL: Record<string, string> = {
  draft:   'Borrador',
  issued:  'Emitido',
  cleared: 'Conciliado',
  voided:  'Anulado',
}

// ── Filtros avanzados ─────────────────────────────────────────────────────────
interface PrAdFilters {
  filterPaymentNumber?: string
  filterVendorName?: string
  filterCheckNumber?: string
  filterAmountMin?: number | null
  filterAmountMax?: number | null
}

const PR_EMPTY: PrAdFilters = {}

function applyPrFilters(data: VendorPayment[], f: PrAdFilters): VendorPayment[] {
  return data.filter(r => {
    if (f.filterPaymentNumber && !r.paymentNumber?.toLowerCase().includes(f.filterPaymentNumber.toLowerCase())) return false
    if (f.filterVendorName && !r.vendorName?.toLowerCase().includes(f.filterVendorName.toLowerCase())) return false
    if (f.filterCheckNumber && !r.checkNumber?.toLowerCase().includes(f.filterCheckNumber.toLowerCase())) return false
    if (f.filterAmountMin != null && Number(r.amount ?? 0) < f.filterAmountMin) return false
    if (f.filterAmountMax != null && Number(r.amount ?? 0) > f.filterAmountMax) return false
    return true
  })
}

export default function PagosRealizadosPage() {
  const navigate = useNavigate()
  const [data,     setData]     = useState<VendorPayment[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState<string | undefined>()
  const [mode,     setMode]     = useState<string | undefined>()
  const [voiding,      setVoiding]      = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [detail,       setDetail]       = useState<VendorPayment | null>(null)
  const [jeLines,      setJeLines]      = useState<any[]>([])
  const [jeLoading,    setJeLoading]    = useState(false)
  const [previewId,    setPreviewId]    = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // Filtros avanzados
  const [prFilters,    setPrFilters]    = useState<PrAdFilters>(PR_EMPTY)
  const [prDraft,      setPrDraft]      = useState<PrAdFilters>(PR_EMPTY)
  const [prFilterOpen, setPrFilterOpen] = useState(false)

  const prActiveCount = useMemo(() =>
    Object.entries(prFilters).filter(([, v]) =>
      v != null && (Array.isArray(v) ? v.length > 0 : v !== '')
    ).length
  , [prFilters])

  const filteredData = useMemo(() => applyPrFilters(data, prFilters), [data, prFilters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPagosRealizados({ page, limit: 200, search: search || undefined, status, mode })
      setData(res.data)
      setTotal((res as any)?.meta?.total ?? res.total ?? 0)
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al cargar pagos realizados')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, search, status, mode])

  useEffect(() => { load() }, [load])

  const handleVoid = async (id: string) => {
    setVoiding(id)
    try {
      await anularPagoRealizado(id)
      message.success('Pago anulado correctamente')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al anular')
    } finally {
      setVoiding(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await deletePagoRealizado(id)
      message.success('Pago eliminado')
      load()
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  const handleOpenDetail = async (row: VendorPayment) => {
    setDetail(row)
    if (row.journalEntryId) {
      setJeLoading(true)
      setJeLines([])
      try {
        const je = await getAsiento(row.journalEntryId)
        setJeLines(je.lines ?? [])
      } catch {
        setJeLines([])
      } finally {
        setJeLoading(false)
      }
    } else {
      setJeLines([])
    }
  }

  const openPrFilters = () => { setPrDraft(prFilters); setPrFilterOpen(true) }
  const applyPrFiltersHandler = () => { setPrFilters(prDraft); setPrFilterOpen(false) }
  const clearPrFilters = () => { setPrDraft(PR_EMPTY); setPrFilters(PR_EMPTY) }

  const columns: ColumnsType<VendorPayment> = [
    {
      title: 'Número', dataIndex: 'paymentNumber', width: 160,
      sorter: (a, b) => (a.paymentNumber ?? '').localeCompare(b.paymentNumber ?? ''),
      render: (v) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{v}</Text>,
    },
    {
      title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true,
      sorter: (a, b) => (a.vendorName ?? '').localeCompare(b.vendorName ?? ''),
      render: (v) => <Text>{v ?? '—'}</Text>,
    },
    {
      title: 'Facturas', key: 'invoices',
      render: (_, r) => {
        if (r.appliedInvoices?.length) {
          return (
            <Space wrap size={2}>
              {r.appliedInvoices.map((a: AppliedInvoice) => (
                <Tag key={a.purchaseInvoiceId} style={{ fontSize: 10 }}>{a.invoiceNumber}</Tag>
              ))}
            </Space>
          )
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      },
    },
    {
      title: 'Fecha', dataIndex: 'paymentDate', width: 105,
      defaultSortOrder: 'descend' as const,
      sorter: (a, b) => (a.paymentDate ?? '').localeCompare(b.paymentDate ?? ''),
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Modo', dataIndex: 'mode', width: 130,
      sorter: (a, b) => (a.mode ?? '').localeCompare(b.mode ?? ''),
      render: (v) => MODE_LABELS[v] ?? v,
    },
    {
      title: 'Cheque', dataIndex: 'checkNumber', width: 130,
      sorter: (a, b) => (a.checkNumber ?? '').localeCompare(b.checkNumber ?? ''),
      render: (v, r) => v ? (
        <Space size={4}>
          <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Text>
          {r.checkType && <Tag style={{ fontSize: 10 }}>{r.checkType === 'physical' ? 'Físico' : 'Elec.'}</Tag>}
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Monto', dataIndex: 'amount', width: 130, align: 'right',
      sorter: (a, b) => Number(a.amount ?? 0) - Number(b.amount ?? 0),
      render: (v, r) => <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 105,
      sorter: (a, b) => (a.status ?? '').localeCompare(b.status ?? ''),
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      key: 'actions', width: 160, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver detalle / Póliza">
            <Button size="small" icon={<BookOutlined />} onClick={() => handleOpenDetail(r)} />
          </Tooltip>
          {r.mode === 'check' && r.status !== 'voided' && (
            <Tooltip title="Vista previa cheque">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setPreviewId(r.id)}
              />
            </Tooltip>
          )}
          {r.mode === 'check' && r.status !== 'voided' && (
            <Tooltip title="Imprimir cheque">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/bancos/pagos-realizados/${r.id}/cheque`, '_blank')}
              />
            </Tooltip>
          )}
          {r.mode !== 'check' && r.status !== 'voided' && (
            <Tooltip title="Comprobante de pago">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/bancos/pagos-realizados/${r.id}/comprobante`, '_blank')}
              />
            </Tooltip>
          )}
          {r.status !== 'voided' && (
            <Popconfirm
              title="¿Anular pago?"
              description="Se revertirán los balances de las facturas asociadas."
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
          {r.status === 'voided' && (
            <Popconfirm
              title="¿Eliminar pago?"
              description="Esta acción elimina el registro permanentemente."
              okText="Eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r.id)}
            >
              <Tooltip title="Eliminar">
                <Button size="small" danger icon={<DeleteOutlined />} loading={deleting === r.id} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const selectedChecks = data.filter(r => selectedKeys.includes(r.id) && r.mode === 'check' && r.status !== 'voided')

  const handlePrintSelected = () => {
    if (selectedChecks.length === 0) { message.warning('Selecciona cheques para imprimir'); return }
    const ids = selectedChecks.map(c => c.id).join(',')
    window.open(`/bancos/cheques/imprimir-lote?ids=${ids}`, '_blank')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DollarOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Pagos a Proveedores</Title>
            <Text type="secondary">Registro de cheques, transferencias y pagos masivos</Text>
          </div>
        </div>
        <Space>
          {selectedChecks.length > 0 && (
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrintSelected}
              style={{ borderColor: '#1faec2', color: '#1faec2' }}
            >
              Imprimir {selectedChecks.length} cheque{selectedChecks.length > 1 ? 's' : ''}
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1faec2' }}
            onClick={() => navigate('/bancos/pagos-realizados/nuevo')}
          >
            Nuevo pago
          </Button>
        </Space>
      </div>

      {/* Filtros */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar número, proveedor, cheque..."
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
          <Select
            placeholder="Estado"
            allowClear
            value={status}
            onChange={v => { setStatus(v); setPage(1) }}
            style={{ width: 130 }}
            options={[
              { value: 'issued',  label: 'Emitido' },
              { value: 'cleared', label: 'Conciliado' },
              { value: 'voided',  label: 'Anulado' },
            ]}
          />
          <Select
            placeholder="Modo de pago"
            allowClear
            value={mode}
            onChange={v => { setMode(v); setPage(1) }}
            style={{ width: 150 }}
            options={[
              { value: 'cash',          label: 'Efectivo' },
              { value: 'bank_transfer', label: 'Transferencia' },
              { value: 'check',         label: 'Cheque' },
              { value: 'credit_card',   label: 'Tarjeta crédito' },
            ]}
          />
          <Badge count={prActiveCount} size="small">
            <Button
              icon={<FilterOutlined />}
              onClick={openPrFilters}
              style={prActiveCount > 0 ? { borderColor: '#1faec2', color: '#1faec2' } : undefined}
            >
              Filtros
            </Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </Card>

      {/* Tabla */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div className="pagos-table">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            size="middle"
            showSorterTooltip={false}
            scroll={{ x: 1200 }}
            rowClassName={(r) => r.status === 'voided' ? 'row-void' : ''}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as string[]),
              getCheckboxProps: (r) => ({
                disabled: r.status === 'voided',
                title: r.status === 'voided' ? 'Pago anulado' : undefined,
              }),
            }}
            pagination={{
              total,
              current: page,
              pageSize: 200,
              onChange: setPage,
              showTotal: t => `${t} pagos`,
              showSizeChanger: false,
            }}
            locale={{ emptyText: 'Sin pagos registrados' }}
          />
        </div>
      </Card>

      {/* Modal detalle */}
      <Modal
        open={!!detail}
        onCancel={() => { setDetail(null); setJeLines([]) }}
        footer={null}
        title={`Pago ${detail?.paymentNumber}`}
        width={780}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginTop: 8 }}>
              <Descriptions.Item label="Proveedor" span={2}>{detail.vendorName}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{dayjs(detail.paymentDate).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Modo">{MODE_LABELS[detail.mode]}</Descriptions.Item>
              <Descriptions.Item label="Monto">{fmtQ(detail.amount, detail.currency)}</Descriptions.Item>
              {detail.currency !== 'GTQ' && detail.exchangeRate && (
                <Descriptions.Item label="Tipo de cambio" span={2}>
                  {detail.currency} 1 = Q {Number(detail.exchangeRate).toFixed(6)}
                  &nbsp;→&nbsp;
                  <Text strong>Q {(Number(detail.amount) * Number(detail.exchangeRate)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                </Descriptions.Item>
              )}
              {detail.checkNumber && (
                <Descriptions.Item label="Cheque No.">{detail.checkNumber}</Descriptions.Item>
              )}
              {detail.bankName && (
                <Descriptions.Item label="Banco">{detail.bankName}</Descriptions.Item>
              )}
              {detail.reference && (
                <Descriptions.Item label="Referencia" span={2}>{detail.reference}</Descriptions.Item>
              )}
              {detail.appliedInvoices?.length ? (
                <Descriptions.Item label="Facturas aplicadas" span={2}>
                  {detail.appliedInvoices.map((a: AppliedInvoice) => (
                    <div key={a.purchaseInvoiceId}>
                      <Tag>{a.invoiceNumber}</Tag> {fmtQ(a.amount, detail.currency)}
                    </div>
                  ))}
                </Descriptions.Item>
              ) : null}
              {detail.notes && (
                <Descriptions.Item label="Notas" span={2}>{detail.notes}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Póliza contable */}
            {detail.journalEntryId && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 13 }}>Póliza contable</Text>
                <Table
                  size="small"
                  loading={jeLoading}
                  dataSource={jeLines}
                  rowKey={(_, i) => String(i)}
                  pagination={false}
                  style={{ marginTop: 8 }}
                  columns={[
                    { title: 'Cuenta', key: 'cuenta',
                      render: (_: any, row: any) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{row.accountCode}</Text>
                          <span style={{ marginLeft: 6, fontSize: 12 }}>{row.accountName}</span>
                          {row.description && <div style={{ fontSize: 11, color: '#9aa1ab', marginTop: 1 }}>{row.description}</div>}
                        </div>
                      ) },
                    { title: 'Débito', dataIndex: 'debit', align: 'right', width: 120,
                      render: (v: number) => v > 0 ? <Text style={{ color: '#e5484d', fontVariantNumeric: 'tabular-nums' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text> : <Text type="secondary">—</Text> },
                    { title: 'Crédito', dataIndex: 'credit', align: 'right', width: 120,
                      render: (v: number) => v > 0 ? <Text style={{ color: '#2ea172', fontVariantNumeric: 'tabular-nums' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text> : <Text type="secondary">—</Text> },
                  ]}
                  summary={(rows) => {
                    const totalD = rows.reduce((s, r) => s + Number(r.debit  ?? 0), 0)
                    const totalC = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0)
                    const hasFx  = rows.some(r => r.accountCode?.startsWith('7') || r.accountCode?.startsWith('5'))
                    return (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}>
                          {hasFx && <Tag color="#ff7f00">Incluye diferencial cambiario</Tag>}
                        </Table.Summary.Cell>
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
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Modal: vista previa inline del cheque */}
      <Modal
        open={!!previewId}
        onCancel={() => setPreviewId(null)}
        footer={null}
        title="Vista previa del cheque"
        width={900}
        destroyOnClose
      >
        {previewId && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12, fontSize: 12 }}
              message={
                <span>
                  ¿Los campos no coinciden con tu cheque físico?{' '}
                  Ajusta las posiciones en{' '}
                  <a onClick={() => { setPreviewId(null); navigate('/bancos/configuracion-pagos') }}>
                    <SettingOutlined /> Bancos → Configuración de impresión
                  </a>
                </span>
              }
            />
            <iframe
              src={`/bancos/pagos-realizados/${previewId}/cheque?preview=true`}
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 6 }}
              title="Vista previa cheque"
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setPreviewId(null)}>Cerrar</Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                style={{ background: '#1faec2' }}
                onClick={() => {
                  window.open(`/bancos/pagos-realizados/${previewId}/cheque`, '_blank')
                  setPreviewId(null)
                }}
              >
                Imprimir
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Drawer filtros avanzados */}
      <Drawer
        title="Filtros avanzados"
        placement="right"
        width={340}
        open={prFilterOpen}
        onClose={() => setPrFilterOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={clearPrFilters}>Limpiar todo</Button>
            <Button type="primary" style={{ background: '#1faec2' }} onClick={applyPrFiltersHandler}>Aplicar</Button>
          </Space>
        }
      >
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Pago</Text>
        <div style={{ display: 'grid', gap: 10, marginTop: 8, marginBottom: 16 }}>
          <Input placeholder="N° pago" size="small" value={prDraft.filterPaymentNumber ?? ''} onChange={e => setPrDraft(d => ({ ...d, filterPaymentNumber: e.target.value || undefined }))} allowClear />
          <Input placeholder="Proveedor" size="small" value={prDraft.filterVendorName ?? ''} onChange={e => setPrDraft(d => ({ ...d, filterVendorName: e.target.value || undefined }))} allowClear />
          <Input placeholder="N° cheque" size="small" value={prDraft.filterCheckNumber ?? ''} onChange={e => setPrDraft(d => ({ ...d, filterCheckNumber: e.target.value || undefined }))} allowClear />
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        <Text strong style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Monto</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InputNumber placeholder="Mín" size="small" style={{ width: '100%' }} value={prDraft.filterAmountMin ?? null} onChange={v => setPrDraft(d => ({ ...d, filterAmountMin: v ?? null }))} min={0} prefix="Q" />
          <InputNumber placeholder="Máx" size="small" style={{ width: '100%' }} value={prDraft.filterAmountMax ?? null} onChange={v => setPrDraft(d => ({ ...d, filterAmountMax: v ?? null }))} min={0} prefix="Q" />
        </div>
      </Drawer>

      <style>{`
        .row-void td { opacity: 0.45; text-decoration: line-through; }
        .pagos-table .ant-checkbox-inner {
          border: 2px solid #1faec2 !important;
          border-radius: 3px !important;
        }
        .pagos-table .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #1faec2 !important;
          border-color: #1faec2 !important;
        }
        .pagos-table .ant-checkbox:hover .ant-checkbox-inner {
          border-color: #1faec2 !important;
        }
      `}</style>
    </div>
  )
}
