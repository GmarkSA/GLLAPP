import { useEffect, useState, useCallback, memo } from 'react'
import {
  Button, Table, Tag, Space, message, InputNumber,
  Switch, Typography, Alert, Popconfirm, Select, Modal, Form, Input,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ReloadOutlined, LockOutlined, UnlockOutlined,
  DeleteOutlined, SaveOutlined, BookOutlined, EditOutlined,
} from '@ant-design/icons'
import {
  getClasesActivoFijo, actualizarClaseActivoFijo, eliminarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title } = Typography

type Pending = Partial<Omit<ClaseActivoFijo, 'id' | 'companyId'>>

// ── Selector de cuenta compacto — recibe cuentas ya cargadas ──────────────────
const AccountCellSelect = memo(function AccountCellSelect({
  accounts, value, onChange, disabled,
}: {
  accounts: Account[]
  value: string | null | undefined
  onChange: (v: string | null) => void
  disabled?: boolean
}) {
  const options = accounts.map(a => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
    code:  a.code,
    name:  a.name,
  }))

  return (
    <Select
      showSearch
      allowClear
      size="small"
      style={{ width: '100%' }}
      disabled={disabled}
      value={value ?? undefined}
      onChange={v => onChange(v ?? null)}
      options={options}
      optionFilterProp="label"
      notFoundContent="Sin cuentas"
      labelRender={opt => {
        const acct = accounts.find(a => a.id === opt.value)
        if (!acct) return <span style={{ color: '#bbb' }}>—</span>
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            <BookOutlined style={{ color: '#1677ff', fontSize: 11, flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1677ff', flexShrink: 0 }}>
              {acct.code}
            </span>
            <span style={{
              fontSize: 11, color: '#555',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {acct.name}
            </span>
          </span>
        )
      }}
      optionRender={opt => (
        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1B3A6B', flexShrink: 0 }}>
            {(opt.data as any).code}
          </span>
          <span style={{ fontSize: 12, color: '#333' }}>{(opt.data as any).name}</span>
        </span>
      )}
    />
  )
})

// ── Página ────────────────────────────────────────────────────────────────────
export default function ClasesActivoFijoPage() {
  const [data,        setData]        = useState<ClaseActivoFijo[]>([])
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [loading,     setLoading]     = useState(false)
  const [seeding,     setSeeding]     = useState(false)
  const [pending,     setPending]     = useState<Record<string, Pending>>({})
  const [saving,      setSaving]      = useState<Record<string, boolean>>({})
  const [editTarget,  setEditTarget]  = useState<ClaseActivoFijo | null>(null)
  const [editSaving,  setEditSaving]  = useState(false)
  const [editForm]  = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getClasesActivoFijo()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Carga cuentas UNA sola vez para toda la tabla
  useEffect(() => {
    getAccounts({ activas: true })
      .then((r: any) => setAccounts(Array.isArray(r) ? r.filter((a: Account) => !a.isHeader) : []))
      .catch(() => {})
  }, [])

  const val = <K extends keyof ClaseActivoFijo>(r: ClaseActivoFijo, field: K): ClaseActivoFijo[K] =>
    ((pending[r.id ?? '']?.[field as keyof Pending]) as ClaseActivoFijo[K] | undefined) ?? r[field]

  const set = (id: string, field: keyof Pending, value: unknown) =>
    setPending(p => ({ ...p, [id]: { ...(p[id] ?? {}), [field]: value } }))

  const isDirty = (id: string) => !!id && !!pending[id] && Object.keys(pending[id]).length > 0

  const handleSave = async (r: ClaseActivoFijo) => {
    if (!r.id) return
    setSaving(s => ({ ...s, [r.id!]: true }))
    try {
      await actualizarClaseActivoFijo(r.id, pending[r.id] ?? {})
      setPending(p => { const c = { ...p }; delete c[r.id!]; return c })
      message.success(`${r.codigo} guardado`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(s => ({ ...s, [r.id!]: false })) }
  }

  const handleBloquear = async (r: ClaseActivoFijo) => {
    if (!r.id) return
    try {
      await actualizarClaseActivoFijo(r.id, { activo: !r.activo })
      message.success(r.activo ? 'Clase bloqueada' : 'Clase desbloqueada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const handleEliminar = async (r: ClaseActivoFijo) => {
    if (!r.id) return
    try {
      await eliminarClaseActivoFijo(r.id)
      message.success('Clase eliminada')
      load()
    } catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
  }

  const openEdit = (r: ClaseActivoFijo) => {
    setEditTarget(r)
    editForm.setFieldsValue({ nombre: r.nombre })
  }

  const handleEditSave = async () => {
    if (!editTarget?.id) return
    const { nombre } = editForm.getFieldsValue()
    setEditSaving(true)
    try {
      await actualizarClaseActivoFijo(editTarget.id, { nombre })
      message.success('Nombre actualizado')
      setEditTarget(null)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setEditSaving(false) }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try { await seedGuatemalaClases(); message.success('Clases Guatemala generadas'); load() }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setSeeding(false) }
  }

  const acctCol = (field: keyof Pending, title: string): ColumnsType<ClaseActivoFijo>[number] => ({
    title: <span style={{ fontSize: 11 }}>{title}</span>,
    width: 160,
    render: (_: unknown, r: ClaseActivoFijo) => !r.id ? <span style={{ color: '#d9d9d9' }}>—</span> : (
      <AccountCellSelect
        accounts={accounts}
        value={val(r, field as keyof ClaseActivoFijo) as string | null}
        onChange={v => set(r.id!, field, v)}
      />
    ),
  })

  const columns: ColumnsType<ClaseActivoFijo> = [
    {
      title: 'Código', dataIndex: 'codigo', width: 80, fixed: 'left',
      render: (v: string, r: ClaseActivoFijo) => (
        <span style={{ fontFamily: 'monospace', color: '#1B3A6B', fontWeight: 700, fontSize: 13 }}>
          {v}
          {!r.id && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>plantilla</Tag>}
        </span>
      ),
    },
    {
      title: 'Clase de Activo', dataIndex: 'nombre', width: 200, fixed: 'left',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: 11 }}>Tasa Anual</span>, width: 100,
      render: (_: unknown, r: ClaseActivoFijo) => (
        <InputNumber
          size="small" style={{ width: '100%' }} min={0} max={1} precision={4} step={0.05}
          value={val(r, 'tasaDepreciacionAnual') as number}
          onChange={v => r.id && set(r.id, 'tasaDepreciacionAnual', v)}
          disabled={!r.id}
          formatter={v => `${((Number(v) || 0) * 100).toFixed(2)}%`}
          parser={v => (Number(v?.replace('%', '').trim()) / 100) as 0 | 1}
        />
      ),
    },
    {
      title: <span style={{ fontSize: 11 }}>Vida Útil (m)</span>, width: 100,
      render: (_: unknown, r: ClaseActivoFijo) => (
        <InputNumber
          size="small" style={{ width: '100%' }} min={0}
          value={val(r, 'vidaUtilMeses') as number ?? undefined}
          onChange={v => r.id && set(r.id, 'vidaUtilMeses', v)}
          disabled={!r.id}
          placeholder="meses"
        />
      ),
    },
    {
      title: <span style={{ fontSize: 11 }}>No Dep.</span>, width: 70, align: 'center',
      render: (_: unknown, r: ClaseActivoFijo) => (
        <Switch
          size="small"
          checked={val(r, 'esNoDepreciable') as boolean}
          onChange={v => r.id && set(r.id, 'esNoDepreciable', v)}
          disabled={!r.id}
        />
      ),
    },
    acctCol('cuentaAltasId',                'Altas (costo activo)'),
    acctCol('cuentaDepreciacionAcumuladaId', 'Depreciación Acumulada'),
    acctCol('cuentaGastoDepreciacionId',     'Gasto de Depreciación'),
    acctCol('cuentaGananciaPorVentaId',      'Ganancia por Venta AF'),
    acctCol('cuentaPerdidaPorDeterioro',     'Pérdida por Deterioro'),
    acctCol('cuentaPerdidaPorVentaId',       'Pérdida por Venta AF'),
    acctCol('cuentaGananciaActivoFijoId',    'Ganancia AF (otras)'),
    {
      title: <span style={{ fontSize: 11 }}>Estado</span>, width: 90,
      render: (_: unknown, r: ClaseActivoFijo) => r.id
        ? <Tag color={r.activo ? 'success' : 'default'}>{r.activo ? 'Activo' : 'Bloqueado'}</Tag>
        : <Tag color="blue">Plantilla</Tag>,
    },
    {
      title: 'Acciones', width: 145, fixed: 'right',
      render: (_: unknown, r: ClaseActivoFijo) => !r.id ? null : (
        <Space size={4} wrap={false}>
          <Button size="small" type="primary" icon={<SaveOutlined />}
            loading={saving[r.id!]}
            disabled={!isDirty(r.id!)}
            onClick={() => handleSave(r)}
            style={{ background: isDirty(r.id!) ? '#1B3A6B' : undefined, padding: '0 6px' }} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title={r.activo ? '¿Bloquear?' : '¿Desbloquear?'} onConfirm={() => handleBloquear(r)}>
            <Button size="small"
              icon={r.activo ? <LockOutlined /> : <UnlockOutlined />}
              danger={r.activo}
              style={!r.activo ? { color: '#52c41a', borderColor: '#52c41a' } : undefined}
            />
          </Popconfirm>
          <Popconfirm title="¿Eliminar esta clase?" onConfirm={() => handleEliminar(r)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Clases de Activo Fijo (ISR Guatemala)</Title>
        <Button icon={<ReloadOutlined />} loading={seeding} onClick={handleSeed}>
          Generar clases Guatemala
        </Button>
      </div>

      {data.length === 0 && !loading && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Sin clases configuradas"
          description='Haz clic en "Generar clases Guatemala" para crear las clases del ISR Art. 19 bis automáticamente.' />
      )}

      <Table
        dataSource={data}
        columns={columns}
        rowKey={r => r.id ?? r.codigo}
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowClassName={r => isDirty(r.id ?? '') ? 'row-dirty' : ''}
      />

      <style>{`
        .row-dirty td { background: #fffbe6 !important; }
        .ant-table-cell { vertical-align: middle; }
      `}</style>

      <Modal
        title={`Editar: ${editTarget?.codigo} — ${editTarget?.nombre}`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleEditSave}
        okText="Guardar"
        confirmLoading={editSaving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={420}
      >
        <Form form={editForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="nombre" label="Nombre de la clase" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
