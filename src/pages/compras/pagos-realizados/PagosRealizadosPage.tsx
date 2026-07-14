import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  Select, message, Popconfirm, Tooltip, Modal, Descriptions, Alert,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  PrinterOutlined, StopOutlined, BookOutlined, DollarOutlined,
  EyeOutlined, SettingOutlined, DeleteOutlined,
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
  cleared: 'green',
  voided:  'red',
}

const STATUS_LABEL: Record<string, string> = {
  draft:   'Borrador',
  issued:  'Emitido',
  cleared: 'Conciliado',
  voided:  'Anulado',
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPagosRealizados({ page, limit: 50, search: search || undefined, status, mode })
      setData(res.data)
      setTotal(res.total)
    } catch {
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

  const columns: ColumnsType<VendorPayment> = [
    {
      title: 'Número', dataIndex: 'paymentNumber', width: 160,
      render: (v) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true,
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
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Modo', dataIndex: 'mode', width: 130,
      render: (v) => MODE_LABELS[v] ?? v,
    },
    {
      title: 'Cheque', dataIndex: 'checkNumber', width: 130,
      render: (v, r) => v ? (
        <Space size={4}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>
          {r.checkType && <Tag style={{ fontSize: 10 }}>{r.checkType === 'physical' ? 'Físico' : 'Elec.'}</Tag>}
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Monto', dataIndex: 'amount', width: 130, align: 'right',
      render: (v, r) => <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(v, r.currency)}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 105,
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
          <DollarOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Pagos a Proveedores</Title>
            <Text type="secondary">Registro de cheques, transferencias y pagos masivos</Text>
          </div>
        </div>
        <Space>
          {selectedChecks.length > 0 && (
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrintSelected}
              style={{ borderColor: '#1B3A6B', color: '#1B3A6B' }}
            >
              Imprimir {selectedChecks.length} cheque{selectedChecks.length > 1 ? 's' : ''}
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B3A6B' }}
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
            dataSource={data}
            rowKey="id"
            loading={loading}
            size="middle"
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
              pageSize: 50,
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
        width={680}
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
                    { title: 'Cuenta', dataIndex: 'accountCode', width: 90,
                      render: (code: string, row: any) => <><Text code style={{ fontSize: 11 }}>{code}</Text> {row.accountName}</> },
                    { title: 'Descripción', dataIndex: 'description', ellipsis: true },
                    { title: 'Débito', dataIndex: 'debit', align: 'right', width: 110,
                      render: (v: number) => v > 0 ? <Text style={{ color: '#cf1322' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text> : '' },
                    { title: 'Crédito', dataIndex: 'credit', align: 'right', width: 110,
                      render: (v: number) => v > 0 ? <Text style={{ color: '#389e0d' }}>Q {Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text> : '' },
                  ]}
                  summary={(rows) => {
                    const totalD = rows.reduce((s, r) => s + Number(r.debit  ?? 0), 0)
                    const totalC = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0)
                    const hasFx  = rows.some(r => r.accountCode?.startsWith('7') || r.accountCode?.startsWith('5'))
                    return (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          {hasFx && <Tag color="orange">Incluye diferencial cambiario</Tag>}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ color: '#cf1322' }}>Q {totalD.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <Text strong style={{ color: '#389e0d' }}>Q {totalC.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
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
                style={{ background: '#1B3A6B' }}
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

      <style>{`
        .row-void td { opacity: 0.45; text-decoration: line-through; }
        .pagos-table .ant-checkbox-inner {
          border: 2px solid #1B3A6B !important;
          border-radius: 3px !important;
        }
        .pagos-table .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #1B3A6B !important;
          border-color: #1B3A6B !important;
        }
        .pagos-table .ant-checkbox:hover .ant-checkbox-inner {
          border-color: #1B3A6B !important;
        }
      `}</style>
    </div>
  )
}
