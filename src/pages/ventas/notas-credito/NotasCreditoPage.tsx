import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Button, Space, Typography, Tag, Input,
  DatePicker, Tooltip, Popconfirm, message, Row, Col, Statistic, Modal, Form,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  EyeOutlined, DeleteOutlined, SendOutlined, EditOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getNotasCredito, deleteNotaCredito, emitirNotaCredito, anularNotaCredito,
  type NotaCredito, NC_STATUS_CONFIG,
} from '../../../api/notas-credito'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

export default function NotasCreditoPage() {
  const navigate = useNavigate()

  const today = dayjs()
  const [fromDate, setFromDate] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [toDate,   setToDate]   = useState(today.format('YYYY-MM-DD'))
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<NotaCredito[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [emitting,   setEmitting]   = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<NotaCredito | null>(null)
  const [voiding,    setVoiding]    = useState(false)
  const [voidForm]   = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotasCredito({ page, limit: 20, search: search || undefined, fromDate, toDate })
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch { setData([]); setTotal(0) }
    finally { setLoading(false) }
  }, [page, search, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const handleEmitir = async (id: string) => {
    setEmitting(id)
    try {
      await emitirNotaCredito(id)
      message.success('Nota de crédito emitida exitosamente')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al emitir')
    } finally { setEmitting(null) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotaCredito(id)
      message.success('Nota de crédito eliminada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al eliminar')
    }
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    try { await voidForm.validateFields() } catch { return }
    setVoiding(true)
    try {
      const { reason } = voidForm.getFieldsValue()
      await anularNotaCredito(voidTarget.id, reason)
      message.success(`${voidTarget.invoiceNumber} anulada correctamente`)
      setVoidTarget(null)
      voidForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al anular')
    } finally { setVoiding(false) }
  }

  // KPIs
  const totalNc       = total
  const totalMonto    = data.reduce((s, nc) => s + Number(nc.total), 0)
  const totalCredito  = data.reduce((s, nc) => s + Number(nc.creditBalance), 0)

  const columns: ColumnsType<NotaCredito> = [
    {
      title: 'N° NC', dataIndex: 'invoiceNumber', width: 160,
      render: (v) => <Text strong style={{ fontFamily: 'monospace', color: '#1B3A6B' }}>{v}</Text>,
    },
    {
      title: 'Fecha', dataIndex: 'invoiceDate', width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Cliente', dataIndex: 'customerName',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {r.customerTaxId && <Text type="secondary" style={{ fontSize: 11 }}>{r.customerTaxId}</Text>}
        </div>
      ),
    },
    {
      title: 'Factura original', dataIndex: 'originalInvoice', width: 150,
      render: (_, r) => r.originalInvoice
        ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.originalInvoice.invoiceNumber}</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Motivo', dataIndex: 'creditNoteReason',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'Estado', dataIndex: 'status', width: 140,
      render: (v: string) => {
        const cfg = NC_STATUS_CONFIG[v as keyof typeof NC_STATUS_CONFIG]
        return <Tag color={cfg?.color ?? 'default'}>{cfg?.label ?? v}</Tag>
      },
    },
    {
      title: 'FEL', dataIndex: 'felStatus', width: 100,
      render: (v) => v
        ? <Tag color={v === 'certificada' ? 'green' : v === 'error' ? 'red' : 'default'}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Total', dataIndex: 'total', width: 130, align: 'right',
      render: (v) => <Text strong style={{ fontFamily: 'monospace' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Crédito disp.', dataIndex: 'creditBalance', width: 130, align: 'right',
      render: (v) => (
        <Text strong style={{ fontFamily: 'monospace', color: Number(v) > 0 ? '#52c41a' : '#bbb' }}>
          {fmtQ(v)}
        </Text>
      ),
    },
    {
      title: 'Acciones', width: 160, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => navigate(`/ventas/notas-credito/${r.id}`)} />
          </Tooltip>
          {r.status === 'draft' && (
            <Tooltip title="Editar">
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1B3A6B' }} />}
                onClick={() => navigate(`/ventas/notas-credito/${r.id}/editar`)} />
            </Tooltip>
          )}
          {r.status === 'draft' && (
            <Tooltip title="Emitir FEL">
              <Button size="small" type="text" icon={<SendOutlined style={{ color: '#52c41a' }} />}
                loading={emitting === r.id}
                onClick={() => handleEmitir(r.id)} />
            </Tooltip>
          )}
          {(r.status === 'sent' || r.status === 'partial') && (
            <Tooltip title="Anular">
              <Button size="small" type="text" icon={<StopOutlined style={{ color: '#fa541c' }} />}
                onClick={() => setVoidTarget(r)} />
            </Tooltip>
          )}
          <Tooltip title="Eliminar">
            <Popconfirm
              title="¿Eliminar esta nota de crédito?"
              description={
                r.status !== 'draft'
                  ? 'Se eliminarán también las pólizas contables asociadas. Esta acción no se puede deshacer.'
                  : 'Esta acción no se puede deshacer.'
              }
              onConfirm={() => handleDelete(r.id)}
              okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ fontSize: 22, color: '#1B3A6B' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Notas de Crédito</Title>
            <Text type="secondary">Gestión de devoluciones y ajustes a clientes</Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#1B3A6B' }}
          onClick={() => navigate('/ventas/notas-credito/nueva')}
        >
          Nueva Nota de Crédito
        </Button>
      </div>

      {/* Filtros */}
      <Card bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space wrap>
          <RangePicker
            format="YYYY-MM-DD"
            value={[dayjs(fromDate), dayjs(toDate)]}
            onChange={(_, strs) => {
              if (strs[0] && strs[1]) { setFromDate(strs[0]); setToDate(strs[1]); setPage(1) }
            }}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar NC, cliente, motivo..."
            style={{ width: 280 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { title: 'Total NCs', value: totalNc, fmt: (v: number) => String(v) },
          { title: 'Monto total', value: totalMonto, fmt: fmtQ },
          { title: 'Crédito disponible', value: totalCredito, fmt: fmtQ },
        ].map(s => (
          <Col span={8} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={s.title}
                value={s.value}
                formatter={v => s.fmt(Number(v))}
                valueStyle={{ fontSize: 16, color: '#1B3A6B' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla */}
      <Card bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: t => `${t} notas de crédito`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'No hay notas de crédito en el período' }}
        />
      </Card>

      {/* Modal anular */}
      <Modal
        title={`Anular ${voidTarget?.invoiceNumber}`}
        open={!!voidTarget}
        onCancel={() => { setVoidTarget(null); voidForm.resetFields() }}
        onOk={handleVoid}
        confirmLoading={voiding}
        okText="Anular nota de crédito"
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Esta acción eliminará las pólizas contables asociadas y marcará la nota de crédito como anulada.
          Solo se puede anular si no ha sido aplicada o reembolsada.
        </Text>
        <Form form={voidForm} layout="vertical">
          <Form.Item name="reason" label="Motivo de anulación"
            rules={[{ required: true, message: 'Ingresa el motivo' }]}>
            <Input.TextArea rows={3} placeholder="Ej: Emitida por error — datos incorrectos" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
