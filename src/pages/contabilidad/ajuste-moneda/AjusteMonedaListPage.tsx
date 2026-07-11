import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Typography, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Popconfirm, Spin,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, DollarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getAjustesMoneda, createAjusteMoneda, deleteAjusteMoneda,
  previewAjusteMoneda, type AjusteMoneda, type AjusteMonedaLinea,
} from '../../../api/ajuste-moneda'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title, Text } = Typography

function fmtQ(n: number) {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}

const MONEDAS = [
  { label: 'USD – Dólar Estadounidense', value: 'USD' },
  { label: 'EUR – Euro',                 value: 'EUR' },
  { label: 'MXN – Peso Mexicano',        value: 'MXN' },
]

type Step = 'form' | 'preview'

export default function AjusteMonedaListPage() {
  const navigate  = useNavigate()
  const [list,    setList]    = useState<AjusteMoneda[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [step,    setStep]    = useState<Step>('form')
  const [preview, setPreview] = useState<AjusteMonedaLinea[]>([])
  const [saving,  setSaving]  = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await getAjustesMoneda()) } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    getAccounts({ activas: true }).then((r: any) => setAccounts(Array.isArray(r) ? r : [])).catch(() => {})
  }, [load])

  const handleContinuar = async () => {
    try { await form.validateFields() } catch { return }
    const vals = form.getFieldsValue()
    setSaving(true)
    try {
      const lines = await previewAjusteMoneda({
        moneda:       vals.moneda,
        fechaAjuste:  vals.fechaAjuste.format('YYYY-MM-DD'),
        tipoCambio:   Number(vals.tipoCambio),
      })
      if (!lines.length) {
        message.warning('No hay cuentas en esa moneda con saldo a la fecha indicada')
        return
      }
      setPreview(lines)
      setStep('preview')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al calcular')
    } finally { setSaving(false) }
  }

  const handleGuardar = async () => {
    const vals = form.getFieldsValue()
    setSaving(true)
    try {
      await createAjusteMoneda({
        moneda:       vals.moneda,
        fechaAjuste:  vals.fechaAjuste.format('YYYY-MM-DD'),
        tipoCambio:   Number(vals.tipoCambio),
        notas:        vals.notas,
        fxAccountId:  vals.fxAccountId,
      })
      message.success('Ajuste de moneda registrado y asiento generado')
      setOpen(false)
      setStep('form')
      form.resetFields()
      setPreview([])
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAjusteMoneda(id)
      message.success('Ajuste anulado')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al anular')
    }
  }

  const netTotal = preview.reduce((s, l) => s + l.gananciasPerdidas, 0)

  const previewColumns = [
    { title: 'Cuenta', dataIndex: 'accountName', key: 'name',
      render: (v: string, r: AjusteMonedaLinea) => (
        <div><div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.accountCode}</div></div>
      ) },
    { title: 'Saldo (USD)', dataIndex: 'saldoUSD', key: 'usd', align: 'right' as const,
      render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span> },
    { title: 'Saldo (GTQ)', dataIndex: 'saldoGTQ', key: 'gtq', align: 'right' as const,
      render: (v: number) => fmtQ(v) },
    { title: 'Saldo Revaluado (GTQ)', dataIndex: 'saldoRevaluado', key: 'rev', align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{fmtQ(v)}</span> },
    { title: 'Ganancia / Pérdida (GTQ)', dataIndex: 'gananciasPerdidas', key: 'gp', align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#389e0d' : '#cf1322', fontWeight: 700 }}>
          {v >= 0 ? '+' : ''}{fmtQ(v)}
        </span>
      ) },
  ]

  const listColumns = [
    { title: 'Fecha de Ajuste', dataIndex: 'fechaAjuste', key: 'fecha',
      render: (v: string) => dayjs(v).format('DD MMMM YYYY') },
    { title: 'Moneda', dataIndex: 'moneda', key: 'moneda',
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tipo de Cambio', dataIndex: 'tipoCambio', key: 'tc',
      render: (v: number) => `1 ${/*will be filled*/''} = ${Number(v).toFixed(6)} GTQ` },
    { title: 'Ganancias / Pérdidas', dataIndex: 'gananciasPerdidas', key: 'gp', align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: Number(v) >= 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
          {Number(v) >= 0 ? '+' : ''}GTQ{Math.abs(Number(v)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </span>
      ) },
    { title: 'Notas', dataIndex: 'notas', key: 'notas',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Estado', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={v === 'posted' ? 'green' : 'default'}>{v === 'posted' ? 'Publicado' : 'Anulado'}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: AjusteMoneda) => (
        <Space>
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/contabilidad/ajuste-moneda/${r.id}`)} />
          </Tooltip>
          {r.status === 'posted' && (
            <Popconfirm title="¿Anular este ajuste?" onConfirm={() => handleDelete(r.id)} okText="Sí" cancelText="No">
              <Tooltip title="Anular">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // Filtrar cuentas de resultado (ingresos o gastos) para diferencial cambiario
  const fxAccounts = accounts.filter(a =>
    !a.isHeader && ['income', 'INCOME', 'expense', 'EXPENSE'].includes(a.type)
  )

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
            <DollarOutlined style={{ marginRight: 8 }} />
            Ajustes de la Moneda Base
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Revaluación de cuentas en moneda extranjera al tipo de cambio de cierre
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }}
          onClick={() => { setOpen(true); setStep('form'); setPreview([]) }}>
          + Nuevo
        </Button>
      </div>

      <Table
        dataSource={list}
        columns={listColumns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No hay ajustes registrados' }}
      />

      {/* ── Modal: Nuevo Ajuste ── */}
      <Modal
        title={step === 'form' ? 'Ajuste de la moneda base' : 'Vista previa — Revaluación'}
        open={open}
        onCancel={() => { setOpen(false); setStep('form'); setPreview([]) }}
        width={step === 'preview' ? 860 : 480}
        footer={null}
        destroyOnClose
      >
        {step === 'form' ? (
          <Form form={form} layout="vertical" size="middle" style={{ marginTop: 8 }}>
            <Form.Item name="moneda" label="Moneda*" rules={[{ required: true }]}>
              <Select options={MONEDAS} placeholder="Selecciona la moneda" />
            </Form.Item>

            <Form.Item name="fechaAjuste" label="Fecha de ajuste*" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMMM YYYY"
                defaultValue={dayjs().endOf('month')} />
            </Form.Item>

            <Form.Item name="tipoCambio" label="Tipo de cambio*" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }}
                precision={6}
                min={0.000001}
                placeholder="7.616071"
                addonBefore="1 USD ="
                addonAfter="GTQ"
              />
            </Form.Item>

            <Form.Item name="fxAccountId" label="Cuenta diferencial cambiario*"
              rules={[{ required: true, message: 'Selecciona la cuenta para registrar la ganancia/pérdida' }]}
              extra="Cuenta donde se registra la ganancia o pérdida por diferencial">
              <Select
                showSearch
                placeholder="Buscar cuenta..."
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={fxAccounts.map(a => ({ label: `${a.code} — ${a.name}`, value: a.id }))}
              />
            </Form.Item>

            <Form.Item name="notas" label="Notas*" rules={[{ required: true }]}>
              <Input.TextArea rows={2} placeholder="Ej. cierre mensual junio 2026" />
            </Form.Item>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="primary" style={{ background: '#1B3A6B' }}
                loading={saving} onClick={handleContinuar}>
                Continuar →
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            {/* Resumen */}
            <div style={{ padding: '10px 16px', background: '#f0f5ff', borderRadius: 6, marginBottom: 16,
              display: 'flex', gap: 32, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>Moneda</div>
                <div style={{ fontWeight: 700 }}>{form.getFieldValue('moneda')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>Fecha ajuste</div>
                <div style={{ fontWeight: 700 }}>{form.getFieldValue('fechaAjuste')?.format('DD/MM/YYYY')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>Tipo de cambio</div>
                <div style={{ fontWeight: 700 }}>{Number(form.getFieldValue('tipoCambio')).toFixed(6)} GTQ</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>Gan./Pérd. neta</div>
                <div style={{ fontWeight: 700, color: netTotal >= 0 ? '#389e0d' : '#cf1322' }}>
                  {netTotal >= 0 ? '+' : ''}{fmtQ(netTotal)}
                </div>
              </div>
            </div>

            <Table
              dataSource={preview}
              columns={previewColumns}
              rowKey="accountId"
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
              summary={() => (
                <Table.Summary.Row style={{ background: '#f5f5f5' }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>TOTAL</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong>{fmtQ(preview.reduce((s, l) => s + l.saldoRevaluado, 0))}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <strong style={{ color: netTotal >= 0 ? '#389e0d' : '#cf1322' }}>
                      {netTotal >= 0 ? '+' : ''}{fmtQ(netTotal)}
                    </strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button onClick={() => setStep('form')}>← Regresar</Button>
              <Button type="primary" style={{ background: '#1B3A6B' }}
                loading={saving} onClick={handleGuardar}>
                Guardar y Publicar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
