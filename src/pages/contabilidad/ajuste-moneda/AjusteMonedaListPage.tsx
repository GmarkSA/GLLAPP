import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Typography, Space, Modal, Form, Select, DatePicker,
  InputNumber, message, Tooltip, Popconfirm, Tabs, Spin,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, DollarOutlined, FileTextOutlined,
  BarChartOutlined, LoadingOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  getAjustesMoneda, createAjusteMoneda, deleteAjusteMoneda,
  previewAjusteMoneda, type AjusteMoneda, type AjusteMonedaLinea,
} from '../../../api/ajuste-moneda'
import { getExchangeRateForDate } from '../../../api/monedas'

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
  const [list,      setList]      = useState<AjusteMoneda[]>([])
  const [loading,   setLoading]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [step,      setStep]      = useState<Step>('form')
  const [preview,   setPreview]   = useState<AjusteMonedaLinea[]>([])
  const [savedDto,  setSavedDto]  = useState<{ moneda: string; fechaAjuste: string; tipoCambio: number } | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [tcLoading, setTcLoading] = useState(false)
  const fetchRef = useRef(0)
  const [form] = Form.useForm()

  const fetchTC = useCallback(async (moneda: string, fecha: Dayjs | null) => {
    if (!moneda || !fecha) return
    const token = ++fetchRef.current
    setTcLoading(true)
    try {
      const res = await getExchangeRateForDate(moneda, fecha.format('YYYY-MM-DD'))
      if (fetchRef.current !== token) return
      // officialRate = "1 USD = X GTQ" (Banguat oficial). rate = "1 GTQ = X USD" (inverso).
      const tc = res.officialRate ?? (res.rate > 0 ? Math.round((1 / res.rate) * 1_000_000) / 1_000_000 : null)
      if (tc) form.setFieldValue('tipoCambio', tc)
    } catch {
      // no hay TC registrado para esa fecha — el usuario puede ingresarlo manualmente
    } finally {
      if (fetchRef.current === token) setTcLoading(false)
    }
  }, [form])

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await getAjustesMoneda()) } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleContinuar = async () => {
    try { await form.validateFields() } catch { return }
    const vals = form.getFieldsValue()
    const dto = {
      moneda:      vals.moneda as string,
      fechaAjuste: (vals.fechaAjuste as Dayjs).format('YYYY-MM-DD'),
      tipoCambio:  Number(vals.tipoCambio),
    }
    setSaving(true)
    try {
      const lines = await previewAjusteMoneda(dto)
      if (!lines.length) {
        message.warning('No hay cuentas en esa moneda con saldo a la fecha indicada')
        return
      }
      setSavedDto(dto)
      setPreview(lines)
      setStep('preview')
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al calcular'
      message.error(msg)
    } finally { setSaving(false) }
  }

  const handleGuardar = async () => {
    if (!savedDto) { message.error('Error interno: datos del formulario no disponibles'); return }
    setSaving(true)
    try {
      await createAjusteMoneda(savedDto)
      message.success('Ajuste de moneda registrado y asiento generado')
      setOpen(false)
      setStep('form')
      form.resetFields()
      setPreview([])
      setSavedDto(null)
      load()
    } catch (e: any) {
      if (e?.response?.status === 401) {
        message.error('La sesión expiró. Recarga la página e ingresa nuevamente.')
      } else {
        const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al guardar'
        message.error(msg)
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAjusteMoneda(id)
      message.success('Ajuste y póliza eliminados correctamente')
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al anular'
      message.error(msg)
    }
  }

  const netTotal = preview.reduce((s, l) => s + l.gananciasPerdidas, 0)

  const fmtUSD = (n: number) =>
    `$ ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
  const fmtTC = (n: number) =>
    Number(n).toLocaleString('es-GT', { minimumFractionDigits: 6 })

  const previewColumns = [
    { title: 'Cuenta contable', dataIndex: 'accountName', key: 'name', width: 180,
      render: (v: string, r: AjusteMonedaLinea) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.accountCode}</div>
        </div>
      ) },
    { title: 'Proveedor / Factura', key: 'aux', width: 190,
      render: (_: any, r: AjusteMonedaLinea) => (
        r.vendorName || r.invoiceNumber ? (
          <div>
            {r.vendorName && <div style={{ fontSize: 12, fontWeight: 500 }}>{r.vendorName}</div>}
            {r.invoiceNumber && <div style={{ fontSize: 11, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>{r.invoiceNumber}</div>}
          </div>
        ) : <span style={{ color: '#9aa1ab', fontSize: 11 }}>—</span>
      ) },
    { title: 'Monto USD', dataIndex: 'saldoUSD', key: 'usd', align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtUSD(v)}</span>
      ) },
    { title: 'TC Histórico', dataIndex: 'tcHistorico', key: 'tch', align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#6b7280' }}>{fmtTC(v)}</span>
      ) },
    { title: 'Valor Libro GTQ', dataIndex: 'saldoGTQ', key: 'gtq', align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</span> },
    { title: 'TC Cierre', key: 'tccierre', align: 'right' as const,
      render: () => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>
          {fmtTC(form.getFieldValue('tipoCambio') ?? 0)}
        </span>
      ) },
    { title: 'Valor Revaluado GTQ', dataIndex: 'saldoRevaluado', key: 'rev', align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtQ(v)}</span> },
    { title: 'Gan. / Pérd. GTQ', dataIndex: 'gananciasPerdidas', key: 'gp', align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#2ea172' : '#e5484d', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {v >= 0 ? '+' : ''}{fmtQ(v)}
        </span>
      ) },
  ]

  const listColumns = [
    { title: 'Fecha de Ajuste', dataIndex: 'fechaAjuste', key: 'fecha',
      render: (v: string) => dayjs(v).format('DD MMMM YYYY') },
    { title: 'Moneda', dataIndex: 'moneda', key: 'moneda',
      render: (v: string) => <Tag color="#1faec2">{v}</Tag> },
    { title: 'Tipo de Cambio', dataIndex: 'tipoCambio', key: 'tc',
      render: (v: number) => `1 ${/*will be filled*/''} = ${Number(v).toFixed(6)} GTQ` },
    { title: 'Ganancias / Pérdidas', dataIndex: 'gananciasPerdidas', key: 'gp', align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: Number(v) >= 0 ? '#2ea172' : '#e5484d', fontWeight: 600 }}>
          {Number(v) >= 0 ? '+' : ''}GTQ{Math.abs(Number(v)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </span>
      ) },
    { title: 'Estado', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color="#2ea172">Publicado</Tag> },
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
            <DollarOutlined style={{ marginRight: 8 }} />
            Ajustes de la Moneda Base
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Revaluación de cuentas en moneda extranjera al tipo de cambio de cierre
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
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
        onCancel={() => { setOpen(false); setStep('form'); setPreview([]); setSavedDto(null) }}
        width={step === 'preview' ? 1100 : 500}
        footer={null}
        destroyOnClose
      >
        {step === 'form' ? (
          <Form form={form} layout="vertical" size="middle" style={{ marginTop: 8 }}>
            <Form.Item name="moneda" label="Moneda" rules={[{ required: true }]}>
              <Select
                options={MONEDAS}
                placeholder="Selecciona la moneda"
                onChange={(val) => fetchTC(val, form.getFieldValue('fechaAjuste'))}
              />
            </Form.Item>

            <Form.Item name="fechaAjuste" label="Fecha de cierre" rules={[{ required: true }]}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD MMMM YYYY"
                onChange={(date) => fetchTC(form.getFieldValue('moneda'), date)}
              />
            </Form.Item>

            <Form.Item
              name="tipoCambio"
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Tipo de cambio
                  {tcLoading && <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} />} />}
                </span>
              }
              rules={[{ required: true, message: 'Ingresa el tipo de cambio' }]}
              extra={tcLoading ? 'Consultando TC registrado…' : 'Puedes ajustar el TC manualmente si es necesario'}
            >
              <InputNumber
                style={{ width: '100%' }}
                precision={6}
                min={0.000001}
                placeholder="7.616071"
                addonBefore={`1 ${form.getFieldValue('moneda') ?? 'USD'} =`}
                addonAfter="GTQ"
                disabled={tcLoading}
              />
            </Form.Item>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="primary" style={{ background: '#1faec2' }}
                loading={saving} onClick={handleContinuar}>
                Continuar →
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            {/* Resumen header */}
            <div style={{ padding: '10px 16px', background: '#fafbfc', borderRadius: 6, marginBottom: 16,
              display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Moneda</div>
                <div style={{ fontWeight: 700 }}>{form.getFieldValue('moneda')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Fecha de ajuste</div>
                <div style={{ fontWeight: 700 }}>{form.getFieldValue('fechaAjuste')?.format('DD/MM/YYYY')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>TC cierre</div>
                <div style={{ fontWeight: 700 }}>{Number(form.getFieldValue('tipoCambio')).toFixed(6)} GTQ</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Cuentas afectadas</div>
                <div style={{ fontWeight: 700 }}>{preview.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Gan./Pérd. neta</div>
                <div style={{ fontWeight: 700, color: netTotal >= 0 ? '#2ea172' : '#e5484d' }}>
                  {netTotal >= 0 ? '+' : ''}{fmtQ(netTotal)}
                </div>
              </div>
            </div>

            <Tabs
              size="small"
              items={[
                {
                  key: 'saldos',
                  label: <span><BarChartOutlined /> Saldos revaluados</span>,
                  children: (
                    <Table
                      dataSource={preview}
                      columns={previewColumns}
                      rowKey={(r: AjusteMonedaLinea) => `${r.accountId}-${r.invoiceId ?? r.vendorId ?? 'solo'}`}
                      size="small"
                      pagination={false}
                      scroll={{ x: 950 }}
                      summary={() => (
                        <Table.Summary.Row style={{ background: '#fafbfc' }}>
                          <Table.Summary.Cell index={0} colSpan={5}>
                            <strong>TOTAL</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right" />
                          <Table.Summary.Cell index={2} align="right">
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {fmtQ(preview.reduce((s, l) => s + l.saldoRevaluado, 0))}
                            </strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            <strong style={{ color: netTotal >= 0 ? '#2ea172' : '#e5484d', fontVariantNumeric: 'tabular-nums' }}>
                              {netTotal >= 0 ? '+' : ''}{fmtQ(netTotal)}
                            </strong>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                  ),
                },
                {
                  key: 'poliza',
                  label: <span><FileTextOutlined /> Póliza contable</span>,
                  children: (() => {
                    const gains = preview.filter(l => l.gananciasPerdidas > 0.005)
                    const losses = preview.filter(l => l.gananciasPerdidas < -0.005)
                    const totalGain = Math.round(gains.reduce((s, l) => s + l.gananciasPerdidas, 0) * 100) / 100
                    const totalLoss = Math.round(Math.abs(losses.reduce((s, l) => s + l.gananciasPerdidas, 0)) * 100) / 100

                    const polizaRows: { key: string; descripcion: string; debito: number; credito: number; tipo: 'header' | 'normal' | 'fx' }[] = []

                    const lineDesc = (l: AjusteMonedaLinea) => {
                      const base = `${l.accountCode}  ${l.accountName}`
                      const aux = [l.invoiceNumber, l.vendorName].filter(Boolean).join('  |  ')
                      return aux ? `${base}  |  ${aux}` : base
                    }

                    if (gains.length > 0) {
                      gains.forEach(l => polizaRows.push({
                        key: `gain-acc-${l.accountId}-${l.vendorId ?? 'na'}`,
                        descripcion: lineDesc(l),
                        debito: l.gananciasPerdidas,
                        credito: 0,
                        tipo: 'normal',
                      }))
                      polizaRows.push({
                        key: 'fx-gain',
                        descripcion: 'Ganancia diferencial cambiario',
                        debito: 0,
                        credito: totalGain,
                        tipo: 'fx',
                      })
                    }
                    if (losses.length > 0) {
                      polizaRows.push({
                        key: 'fx-loss',
                        descripcion: 'Pérdida diferencial cambiario',
                        debito: totalLoss,
                        credito: 0,
                        tipo: 'fx',
                      })
                      losses.forEach(l => polizaRows.push({
                        key: `loss-acc-${l.accountId}-${l.vendorId ?? 'na'}`,
                        descripcion: lineDesc(l),
                        debito: 0,
                        credito: Math.abs(l.gananciasPerdidas),
                        tipo: 'normal',
                      }))
                    }

                    const polizaColumns = [
                      { title: 'Descripción', dataIndex: 'descripcion', key: 'desc',
                        render: (v: string, r: any) => (
                          <span style={{ fontWeight: r.tipo === 'fx' ? 700 : 400, color: r.tipo === 'fx' ? '#1faec2' : undefined }}>
                            {v}
                          </span>
                        ) },
                      { title: 'Débito', dataIndex: 'debito', key: 'deb', width: 160, align: 'right' as const,
                        render: (v: number) => v > 0
                          ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</span>
                          : <span style={{ color: '#9aa1ab' }}>—</span> },
                      { title: 'Crédito', dataIndex: 'credito', key: 'cred', width: 160, align: 'right' as const,
                        render: (v: number) => v > 0
                          ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(v)}</span>
                          : <span style={{ color: '#9aa1ab' }}>—</span> },
                    ]

                    const totalDeb = Math.round((totalGain + totalLoss) * 100) / 100
                    const totalCred = totalDeb

                    return (
                      <Table
                        dataSource={polizaRows}
                        columns={polizaColumns}
                        rowKey="key"
                        size="small"
                        pagination={false}
                        rowClassName={(r: any) => r.tipo === 'fx' ? '' : ''}
                        summary={() => (
                          <Table.Summary.Row style={{ background: '#fafbfc', fontWeight: 700 }}>
                            <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(totalDeb)}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(totalCred)}</strong>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        )}
                      />
                    )
                  })(),
                },
              ]}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button onClick={() => setStep('form')}>← Regresar</Button>
              <Button type="primary" style={{ background: '#1faec2' }}
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
