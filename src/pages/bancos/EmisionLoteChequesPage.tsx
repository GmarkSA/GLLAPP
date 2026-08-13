import { useState, useEffect, useMemo } from 'react'
import {
  Card, Button, Select, DatePicker, Checkbox, InputNumber, Input,
  Typography, Space, Tag, Alert, Collapse, Table, message,
  Divider, Form, Radio, Tooltip,
} from 'antd'
import { PrinterOutlined, ThunderboltOutlined, BankOutlined, SortAscendingOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPendingInvoicesAllVendors, createBatchPayment,
  type PendingInvoice, type PendingInvoicesByVendor,
} from '../../api/pagosRealizados'
import { getBankAccounts } from '../../api/bancos'

const { Title, Text } = Typography
const { Panel } = Collapse

const fmtQ = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

interface VendorSelection {
  vendorId:   string
  vendorName: string
  invoiceIds: string[]
  amounts:    Record<string, number>
  total:      number
}

interface FlatInvoice extends PendingInvoice {
  vendorId:   string
  vendorName: string
}

export default function EmisionLoteChequesPage() {
  const navigate  = useNavigate()
  const [form]    = Form.useForm()

  const [allVendors,   setAllVendors]   = useState<PendingInvoicesByVendor[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selections,   setSelections]   = useState<Record<string, VendorSelection>>({})
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [mode,         setMode]         = useState<string>('check')
  const [sortMode,     setSortMode]     = useState<'vendor' | 'aging'>('vendor')
  const [totalBudget,  setTotalBudget]  = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      getPendingInvoicesAllVendors(),
      getBankAccounts({ status: 'active' }),
    ]).then(([vendors, accs]) => {
      setAllVendors(vendors)
      setBankAccounts(Array.isArray(accs) ? accs : (accs as any)?.data ?? [])
    }).catch(() => message.error('Error al cargar facturas pendientes'))
    .finally(() => setLoading(false))
  }, [])

  // Todas las facturas aplanadas ordenadas por antigüedad (vencimiento ASC, sin fecha al final)
  const allInvoicesFlat = useMemo<FlatInvoice[]>(() => {
    const flat: FlatInvoice[] = allVendors.flatMap(v =>
      v.invoices.map(inv => ({ ...inv, vendorId: v.vendorId, vendorName: v.vendorName }))
    )
    return flat.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return dayjs(a.dueDate).diff(dayjs(b.dueDate))
    })
  }, [allVendors])

  const toggleInvoice = (vendorId: string, vendorName: string, inv: PendingInvoice) => {
    setSelections(prev => {
      const vendor = prev[vendorId] ?? { vendorId, vendorName, invoiceIds: [], amounts: {}, total: 0 }
      const already = vendor.invoiceIds.includes(inv.id)
      const newIds     = already ? vendor.invoiceIds.filter(x => x !== inv.id) : [...vendor.invoiceIds, inv.id]
      const newAmounts = { ...vendor.amounts }
      if (already) delete newAmounts[inv.id]
      else newAmounts[inv.id] = inv.balance
      const newTotal = newIds.reduce((s, id) => s + (newAmounts[id] ?? 0), 0)
      const next = { ...prev }
      if (newIds.length === 0) delete next[vendorId]
      else next[vendorId] = { ...vendor, invoiceIds: newIds, amounts: newAmounts, total: newTotal }
      return next
    })
  }

  const setAmount = (vendorId: string, invId: string, val: number | null, invBalance: number) => {
    setSelections(prev => {
      const vendor = prev[vendorId]
      if (!vendor) return prev
      const newAmounts = { ...vendor.amounts, [invId]: val ?? invBalance }
      const newTotal   = vendor.invoiceIds.reduce((s, id) => s + (newAmounts[id] ?? 0), 0)
      return { ...prev, [vendorId]: { ...vendor, amounts: newAmounts, total: newTotal } }
    })
  }

  const selectAllVendor = (v: PendingInvoicesByVendor) => {
    setSelections(prev => {
      const ids     = v.invoices.map(i => i.id)
      const amounts = Object.fromEntries(v.invoices.map(i => [i.id, i.balance]))
      const total   = v.invoices.reduce((s, i) => s + i.balance, 0)
      return { ...prev, [v.vendorId]: { vendorId: v.vendorId, vendorName: v.vendorName, invoiceIds: ids, amounts, total } }
    })
  }

  const clearVendor = (vendorId: string) => {
    setSelections(prev => { const n = { ...prev }; delete n[vendorId]; return n })
  }

  // Distribuir monto automáticamente en las facturas más antiguas primero
  const autoApply = () => {
    if (!totalBudget || totalBudget <= 0) {
      message.warning('Ingresa un monto disponible para distribuir')
      return
    }
    const r = (n: number) => Math.round(n * 100) / 100
    let remaining = totalBudget
    const newSelections: Record<string, VendorSelection> = {}

    for (const inv of allInvoicesFlat) {
      if (remaining <= 0.005) break
      const apply = r(Math.min(inv.balance, remaining))
      if (apply <= 0) continue
      remaining = r(remaining - apply)

      const exist = newSelections[inv.vendorId] ?? {
        vendorId:   inv.vendorId,
        vendorName: inv.vendorName,
        invoiceIds: [],
        amounts:    {},
        total:      0,
      }
      exist.invoiceIds = [...exist.invoiceIds, inv.id]
      exist.amounts    = { ...exist.amounts, [inv.id]: apply }
      exist.total      = r(exist.total + apply)
      newSelections[inv.vendorId] = exist
    }

    setSelections(newSelections)
    const applied = r(totalBudget - remaining)
    message.success(
      `Distribuidos ${fmtQ(applied)} en ${Object.keys(newSelections).length} proveedor(es)` +
      (remaining > 0.005 ? ` — saldo sin aplicar: ${fmtQ(remaining)}` : '')
    )
  }

  const selectedVendors = Object.values(selections)
  const totalChecks     = selectedVendors.length
  const grandTotal      = selectedVendors.reduce((s, v) => s + v.total, 0)

  const invoiceColumns = (vendorId: string, vendorName: string): ColumnsType<PendingInvoice> => [
    {
      title: '', key: 'sel', width: 40,
      render: (_, r) => (
        <Checkbox
          checked={selections[vendorId]?.invoiceIds.includes(r.id) ?? false}
          onChange={() => toggleInvoice(vendorId, vendorName, r)}
        />
      ),
    },
    { title: 'Factura', dataIndex: 'invoiceNumber', width: 140,
      render: (val) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{val}</Text> },
    { title: 'Vencimiento', dataIndex: 'dueDate', width: 110,
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>
        const days = dayjs(d).diff(dayjs(), 'day')
        return <Tag color={days < 0 ? '#e5484d' : days <= 7 ? '#ff7f00' : '#2ea172'}>{dayjs(d).format('DD/MM/YYYY')}</Tag>
      } },
    { title: 'Saldo', dataIndex: 'balance', width: 130, align: 'right' as const,
      render: (val) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(Number(val))}</Text> },
    {
      title: 'Monto a pagar', key: 'amt', width: 150, align: 'right' as const,
      render: (_, r) => {
        const sel = selections[vendorId]
        if (!sel?.invoiceIds.includes(r.id)) return <Text type="secondary">—</Text>
        return (
          <InputNumber
            size="small" min={0.01} max={r.balance}
            value={sel.amounts[r.id] ?? r.balance}
            precision={2} style={{ width: 120 }}
            onChange={val => setAmount(vendorId, r.id, val, r.balance)}
            onClick={e => e.stopPropagation()}
          />
        )
      },
    },
  ]

  // Columnas para vista por antigüedad (incluye proveedor)
  const agingColumns: ColumnsType<FlatInvoice> = [
    {
      title: '', key: 'sel', width: 40,
      render: (_, r) => (
        <Checkbox
          checked={selections[r.vendorId]?.invoiceIds.includes(r.id) ?? false}
          onChange={() => toggleInvoice(r.vendorId, r.vendorName, r)}
        />
      ),
    },
    { title: 'Vencimiento', dataIndex: 'dueDate', width: 115,
      render: (d) => {
        if (!d) return <Text type="secondary">Sin fecha</Text>
        const days = dayjs(d).diff(dayjs(), 'day')
        return <Tag color={days < 0 ? '#e5484d' : days <= 7 ? '#ff7f00' : '#2ea172'}>{dayjs(d).format('DD/MM/YYYY')}</Tag>
      } },
    { title: 'Proveedor', dataIndex: 'vendorName', ellipsis: true },
    { title: 'Factura', dataIndex: 'invoiceNumber', width: 140,
      render: (val) => <Text style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{val}</Text> },
    { title: 'Saldo', dataIndex: 'balance', width: 130, align: 'right' as const,
      render: (val) => <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(Number(val))}</Text> },
    {
      title: 'Monto a pagar', key: 'amt', width: 150, align: 'right' as const,
      render: (_, r) => {
        const sel = selections[r.vendorId]
        if (!sel?.invoiceIds.includes(r.id)) return <Text type="secondary">—</Text>
        return (
          <InputNumber
            size="small" min={0.01} max={r.balance}
            value={sel.amounts[r.id] ?? r.balance}
            precision={2} style={{ width: 120 }}
            onChange={val => setAmount(r.vendorId, r.id, val, r.balance)}
            onClick={e => e.stopPropagation()}
          />
        )
      },
    },
  ]

  const handleSubmit = async (values: any) => {
    if (selectedVendors.length === 0) { message.warning('Selecciona al menos una factura de algún proveedor'); return }

    setSubmitting(true)
    try {
      const payments = selectedVendors.map(v => ({
        type:          'regular' as const,
        vendorId:      v.vendorId,
        vendorName:    v.vendorName,
        invoiceIds:    v.invoiceIds,
        amounts:       v.amounts,
        paymentDate:   values.paymentDate.format('YYYY-MM-DD'),
        mode:          values.mode,
        currency:      'GTQ',
        bankAccountId: values.bankAccountId || undefined,
        reference:     values.reference || undefined,
        checkType:     values.mode === 'check' ? (values.checkType || 'physical') : undefined,
        notes:         values.notes || undefined,
      }))

      const result = await createBatchPayment(payments)
      message.success(`${result.payments.length} pago(s) generados correctamente`)

      if (result.checks.length > 0) {
        const printAll = window.confirm(
          `Se generaron ${result.checks.length} cheque(s):\n${result.checks.map(c => `• ${c.vendorName}: ${c.checkNumber}`).join('\n')}\n\n¿Imprimir todos?`
        )
        if (printAll) {
          for (const chk of result.checks) {
            window.open(`/bancos/pagos-realizados/${chk.id}/cheque`, '_blank')
          }
        }
      }

      navigate('/bancos/pagos-realizados')
    } catch (e: any) {
      const d = e?.response?.data
      message.error(d?.error?.message || d?.message || 'Error al procesar el lote')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Space>
          <PrinterOutlined style={{ fontSize: 20, color: '#1faec2' }} />
          <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Emisión de cheques en lote</Title>
        </Space>
        {totalChecks > 0 && (
          <Tag color="#1faec2" style={{ fontSize: 13, padding: '4px 12px' }}>
            {totalChecks} proveedor{totalChecks > 1 ? 'es' : ''} seleccionado{totalChecks > 1 ? 's' : ''} — {fmtQ(grandTotal)}
          </Tag>
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
        size="small"
        onFinish={handleSubmit}
        initialValues={{ paymentDate: dayjs(), mode: 'check', checkType: 'physical' }}
      >
        {/* Parámetros globales del lote */}
        <Card
          title="Parámetros del lote"
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="Fecha de pago" name="paymentDate" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Modo de pago" name="mode" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'check',         label: 'Cheque' },
                  { value: 'bank_transfer', label: 'Transferencia' },
                  { value: 'cash',          label: 'Efectivo' },
                  { value: 'other',         label: 'Otro' },
                ]}
                onChange={v => setMode(v)}
              />
            </Form.Item>

            <Form.Item label="Cuenta bancaria emisora" name="bankAccountId">
              <Select
                allowClear placeholder="Seleccionar cuenta"
                options={bankAccounts.map((b: any) => ({
                  value: b.id,
                  label: `${b.name}${b.bankName ? ` — ${b.bankName}` : ''}`,
                }))}
              />
            </Form.Item>

            {mode === 'check' && (
              <Form.Item label="Tipo de cheque" name="checkType">
                <Radio.Group>
                  <Radio value="physical">Físico</Radio>
                  <Radio value="electronic">Electrónico</Radio>
                </Radio.Group>
              </Form.Item>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Referencia bancaria" name="reference" style={{ marginBottom: 0 }}>
              <Input placeholder="Ej. 12148396 — número del estado de cuenta" />
            </Form.Item>
            <Form.Item label="Notas generales" name="notes" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={2} placeholder="Observaciones del lote..." />
            </Form.Item>
          </div>
        </Card>

        {/* Distribución automática por monto */}
        <Card
          bordered={false}
          style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16, background: '#f8fcff' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Monto disponible para pago</Text>
              <InputNumber
                prefix="Q"
                min={0.01}
                precision={2}
                value={totalBudget}
                onChange={v => setTotalBudget(v)}
                style={{ width: 180 }}
                placeholder="0.00"
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Ordenar facturas por</Text>
              <Select
                value={sortMode}
                onChange={v => setSortMode(v)}
                style={{ width: 200 }}
                options={[
                  { value: 'vendor', label: 'Proveedor (agrupado)' },
                  { value: 'aging',  label: 'Antigüedad (vencimiento ASC)' },
                ]}
              />
            </div>
            <Tooltip title="Aplica el monto disponible a las facturas más antiguas primero, distribuyendo automáticamente entre proveedores">
              <Button
                icon={<RocketOutlined />}
                onClick={autoApply}
                style={{ borderColor: '#1faec2', color: '#1faec2' }}
              >
                Distribuir automáticamente
              </Button>
            </Tooltip>
            {totalBudget && grandTotal > 0 && (
              <Tag color={grandTotal > totalBudget ? '#e5484d' : '#2ea172'} style={{ alignSelf: 'center' }}>
                {grandTotal > totalBudget
                  ? `Excede en ${fmtQ(grandTotal - totalBudget)}`
                  : `Disponible: ${fmtQ(totalBudget - grandTotal)}`}
              </Tag>
            )}
          </div>
        </Card>

        {/* Facturas pendientes */}
        {loading ? (
          <Card loading style={{ borderRadius: 10 }} />
        ) : allVendors.length === 0 ? (
          <Alert type="success" showIcon message="No hay facturas pendientes de pago en ningún proveedor." />
        ) : sortMode === 'aging' ? (
          /* Vista plana por antigüedad */
          <Card
            bordered={false}
            title={
              <Space>
                <SortAscendingOutlined />
                <span>Facturas ordenadas por antigüedad — {allInvoicesFlat.length} facturas de {allVendors.length} proveedores</span>
              </Space>
            }
            style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          >
            <Table
              size="small"
              columns={agingColumns}
              dataSource={allInvoicesFlat}
              rowKey="id"
              pagination={{ pageSize: 50, showTotal: t => `${t} facturas` }}
              onRow={(r) => ({ onClick: () => toggleInvoice(r.vendorId, r.vendorName, r), style: { cursor: 'pointer' } })}
              rowClassName={(r) => selections[r.vendorId]?.invoiceIds.includes(r.id) ? 'ant-table-row-selected' : ''}
              scroll={{ x: 800 }}
            />
          </Card>
        ) : (
          /* Vista agrupada por proveedor */
          <Collapse
            defaultActiveKey={[]}
            style={{ borderRadius: 10, overflow: 'hidden' }}
          >
            {allVendors.map(v => {
              const sel      = selections[v.vendorId]
              const selCount = sel?.invoiceIds.length ?? 0
              const selTotal = sel?.total ?? 0
              return (
                <Panel
                  key={v.vendorId}
                  header={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Space>
                        <BankOutlined />
                        <Text strong>{v.vendorName}</Text>
                        <Tag>{v.invoices.length} factura{v.invoices.length > 1 ? 's' : ''}</Tag>
                      </Space>
                      <Space>
                        {selCount > 0 && (
                          <Tag color="#1faec2">
                            <ThunderboltOutlined /> {selCount} selec. — {fmtQ(selTotal)}
                          </Tag>
                        )}
                        <Button
                          size="small"
                          onClick={e => { e.stopPropagation(); selectAllVendor(v) }}
                        >Selec. todas</Button>
                        {selCount > 0 && (
                          <Button size="small" danger onClick={e => { e.stopPropagation(); clearVendor(v.vendorId) }}>
                            Limpiar
                          </Button>
                        )}
                      </Space>
                    </div>
                  }
                >
                  <Table
                    size="small"
                    columns={invoiceColumns(v.vendorId, v.vendorName)}
                    dataSource={v.invoices}
                    rowKey="id"
                    pagination={false}
                    onRow={(r) => ({ onClick: () => toggleInvoice(v.vendorId, v.vendorName, r), style: { cursor: 'pointer' } })}
                    summary={() => selCount > 0 ? (
                      <Table.Summary.Row style={{ background: '#fafbfc' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong>{selCount} factura{selCount > 1 ? 's' : ''} seleccionada{selCount > 1 ? 's' : ''}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} />
                        <Table.Summary.Cell index={4} align="right">
                          <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{fmtQ(selTotal)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    ) : null}
                  />
                </Panel>
              )
            })}
          </Collapse>
        )}

        {/* Resumen del lote y botón */}
        {totalChecks > 0 && (
          <Card
            style={{ marginTop: 16, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', background: '#fafbfc' }}
            bordered={false}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 14 }}>Resumen del lote</Text>
                {selectedVendors.map(v => (
                  <Text key={v.vendorId} style={{ fontSize: 12 }}>
                    • {v.vendorName}: {v.invoiceIds.length} factura{v.invoiceIds.length > 1 ? 's' : ''} — {fmtQ(v.total)}
                  </Text>
                ))}
                <Divider style={{ margin: '6px 0' }} />
                <Text strong>Total lote: {fmtQ(grandTotal)}</Text>
              </Space>
              <Space>
                <Button onClick={() => navigate('/bancos/pagos-realizados')}>Cancelar</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<PrinterOutlined />}
                  style={{ background: '#1faec2' }}
                  size="middle"
                >
                  Generar {totalChecks} {mode === 'check' ? `cheque${totalChecks > 1 ? 's' : ''}` : `pago${totalChecks > 1 ? 's' : ''}`} — {fmtQ(grandTotal)}
                </Button>
              </Space>
            </div>
          </Card>
        )}
      </Form>
    </div>
  )
}
