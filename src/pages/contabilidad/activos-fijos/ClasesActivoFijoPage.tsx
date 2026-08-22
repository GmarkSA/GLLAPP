import { useEffect, useState, useCallback, memo } from 'react'
import {
  Button, Table, Tag, Space, message, InputNumber,
  Switch, Typography, Alert, Popconfirm, Select, Modal, Form, Input,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompanyStore } from '../../../store/companyStore'
import { guideHighlight, markSetupStepDone, SETUP_ROUTES } from '../../../hooks/setupProgress'
import {
  ReloadOutlined, LockOutlined, UnlockOutlined, PlusOutlined,
  DeleteOutlined, SaveOutlined, BookOutlined, EditOutlined, CopyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  getClasesActivoFijo, crearClaseActivoFijo, actualizarClaseActivoFijo,
  eliminarClaseActivoFijo, seedGuatemalaClases,
  type ClaseActivoFijo,
} from '../../../api/clases-activo-fijo'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Title } = Typography

type Pending = Partial<Omit<ClaseActivoFijo, 'id' | 'companyId'>>

// Cuentas sugeridas por clase (ISR Guatemala — catálogo GLL estándar)
const SUGERENCIAS_CLASES: Record<string, {
  altaCode?: string; depAcumCode?: string; gastoDepCode?: string
  gananciaCode?: string; perdidaCode?: string
}> = {
  '1000': { altaCode: '160001' },                                                                                                   // TERRENOS — sin depreciación
  '2000': { altaCode: '160006', depAcumCode: '160011', gastoDepCode: '640005', gananciaCode: '460001', perdidaCode: '660001' },    // MOBILIARIO Y EQUIPO
  '3000': { altaCode: '160005', depAcumCode: '160010', gastoDepCode: '640004', gananciaCode: '460001', perdidaCode: '660001' },    // EQUIPO DE COMPUTACIÓN
  '4000': { altaCode: '170001', depAcumCode: '170003', gastoDepCode: '640006', gananciaCode: '460001', perdidaCode: '660001' },    // PROGRAMAS DE COMPUTACIÓN
  '5000': { altaCode: '160004', depAcumCode: '160009', gastoDepCode: '640003', gananciaCode: '460001', perdidaCode: '660001' },    // VEHÍCULOS
  '6000': { altaCode: '160003', depAcumCode: '160008', gastoDepCode: '640002', gananciaCode: '460001', perdidaCode: '660001' },    // HERRAMIENTAS
  '7000': { altaCode: '160003', depAcumCode: '160008', gastoDepCode: '640002', gananciaCode: '460001', perdidaCode: '660001' },    // MAQUINARIA Y EQUIPO
  '8000': { altaCode: '160002', depAcumCode: '160007', gastoDepCode: '640001', gananciaCode: '460001', perdidaCode: '660001' },    // EDIFICIOS Y CONSTRUCCIONES
  '9000': { altaCode: '170001', depAcumCode: '170003', gastoDepCode: '640006', gananciaCode: '460001', perdidaCode: '660001' },    // TÍTULOS Y DERECHOS
}

type NuevaClaseForm = {
  codigo: string
  nombre: string
  tasaDepreciacionAnual: number
  vidaUtilMeses: number | null
  esNoDepreciable: boolean
}

// ── Selector de cuenta compacto ───────────────────────────────────────────────
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
      showSearch allowClear size="small" style={{ width: '100%' }}
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
            <BookOutlined style={{ color: '#1faec2', fontSize: 11, flexShrink: 0 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#1faec2', flexShrink: 0 }}>{acct.code}</span>
            <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {acct.name}
            </span>
          </span>
        )
      }}
      optionRender={opt => (
        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#1faec2', flexShrink: 0 }}>
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
  const [data,        setData]       = useState<ClaseActivoFijo[]>([])
  const [accounts,    setAccounts]   = useState<Account[]>([])
  const [loading,     setLoading]    = useState(false)
  const [seeding,     setSeeding]    = useState(false)
  const [sugeriendo,  setSugeriendo] = useState(false)
  // Guía de configuración (paso 5): llegó con ?from=setup
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromSetup = searchParams.get('from') === 'setup'
  const activeCompanyId = useCompanyStore(s => s.activeCompany?.id)
  const [setupDone, setSetupDone] = useState(false)
  const confirmarPasoClases = async (irAlSiguiente: boolean) => {
    if (activeCompanyId) await markSetupStepDone(activeCompanyId, 'clases_af').catch(() => {})
    setSetupDone(true)
    if (irAlSiguiente) navigate(SETUP_ROUTES.impuestos)
  }
  const [pending,     setPending]    = useState<Record<string, Pending>>({})
  const [saving,      setSaving]     = useState<Record<string, boolean>>({})

  // Modal editar nombre
  const [editTarget, setEditTarget] = useState<ClaseActivoFijo | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm]  = Form.useForm()

  // Modal agregar / copiar como
  const [nuevaModal, setNuevaModal] = useState(false)
  const [nuevaSaving, setNuevaSaving] = useState(false)
  const [nuevaForm] = Form.useForm<NuevaClaseForm>()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getClasesActivoFijo()) }
    catch { setData([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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

  // ── Editar nombre ─────────────────────────────────────────────────────────
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

  // ── Agregar / Copiar como ─────────────────────────────────────────────────
  const openNueva = () => {
    nuevaForm.resetFields()
    nuevaForm.setFieldsValue({ tasaDepreciacionAnual: 0.20, vidaUtilMeses: 60, esNoDepreciable: false })
    setNuevaModal(true)
  }

  const openCopiar = (r: ClaseActivoFijo) => {
    nuevaForm.setFieldsValue({
      codigo:               '',
      nombre:               `${r.nombre} (copia)`,
      tasaDepreciacionAnual: r.tasaDepreciacionAnual,
      vidaUtilMeses:         r.vidaUtilMeses ?? undefined,
      esNoDepreciable:       r.esNoDepreciable,
    })
    setNuevaModal(true)
  }

  const handleNuevaSave = async () => {
    try { await nuevaForm.validateFields() } catch { return }
    const vals = nuevaForm.getFieldsValue()
    setNuevaSaving(true)
    try {
      await crearClaseActivoFijo({
        codigo:               vals.codigo,
        nombre:               vals.nombre,
        tasaDepreciacionAnual: vals.tasaDepreciacionAnual ?? 0,
        vidaUtilMeses:         vals.esNoDepreciable ? null : (vals.vidaUtilMeses ?? null),
        esNoDepreciable:       vals.esNoDepreciable ?? false,
      })
      message.success('Clase creada')
      setNuevaModal(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al crear')
    } finally { setNuevaSaving(false) }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try { await seedGuatemalaClases(); message.success('Clases Guatemala generadas'); load(); if (fromSetup) await confirmarPasoClases(false) }
    catch (e: any) { message.error(e?.response?.data?.message ?? 'Error') }
    finally { setSeeding(false) }
  }

  const handleSugerir = async () => {
    setSugeriendo(true)
    const byCode = (code: string) => accounts.find(a => a.code === code)?.id ?? null
    let saved = 0
    try {
      for (const clase of data) {
        if (!clase.id) continue
        const sug = SUGERENCIAS_CLASES[clase.codigo]
        if (!sug) continue
        const update: Partial<Pending> = {}
        if (sug.altaCode)     { const id = byCode(sug.altaCode);     if (id) update.cuentaAltasId = id }
        if (sug.depAcumCode)  { const id = byCode(sug.depAcumCode);  if (id) update.cuentaDepreciacionAcumuladaId = id }
        if (sug.gastoDepCode) { const id = byCode(sug.gastoDepCode); if (id) update.cuentaGastoDepreciacionId = id }
        if (sug.gananciaCode) { const id = byCode(sug.gananciaCode); if (id) update.cuentaGananciaPorVentaId = id }
        if (sug.perdidaCode)  { const id = byCode(sug.perdidaCode);  if (id) update.cuentaPerdidaPorVentaId = id }
        if (Object.keys(update).length > 0) {
          await actualizarClaseActivoFijo(clase.id, update)
          saved++
        }
      }
      message.success(`Catálogo sugerido aplicado en ${saved} clase${saved !== 1 ? 's' : ''}.`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al aplicar sugerencias')
    } finally {
      setSugeriendo(false)
    }
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const acctCol = (field: keyof Pending, title: string): ColumnsType<ClaseActivoFijo>[number] => ({
    title: <span style={{ fontSize: 11 }}>{title}</span>,
    width: 140,
    render: (_: unknown, r: ClaseActivoFijo) => !r.id ? <span style={{ color: '#9aa1ab' }}>—</span> : (
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
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2', fontWeight: 700, fontSize: 13 }}>
          {v}
          {!r.id && <Tag color="#1faec2" style={{ marginLeft: 4, fontSize: 10 }}>plantilla</Tag>}
        </span>
      ),
    },
    {
      title: 'Clase de Activo', dataIndex: 'nombre', width: 280, fixed: 'left',
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
    acctCol('cuentaPerdidaPorVentaId',       'Pérdida por Venta AF'),
    acctCol('cuentaCostoVentaAFId',          'Costo de Venta AF'),
    acctCol('cuentaPerdidaPorDeterioro',     'Pérdida por Deterioro'),
    acctCol('cuentaSaldosInicialesId',       'Saldos Iniciales (migración)'),
    {
      title: <span style={{ fontSize: 11 }}>Estado</span>, width: 90,
      render: (_: unknown, r: ClaseActivoFijo) => r.id
        ? <Tag color={r.activo ? 'success' : 'default'}>{r.activo ? 'Activo' : 'Bloqueado'}</Tag>
        : <Tag color="#1faec2">Plantilla</Tag>,
    },
    {
      title: 'Acciones', width: 175, fixed: 'right',
      render: (_: unknown, r: ClaseActivoFijo) => !r.id ? null : (
        <Space size={4} wrap={false}>
          <Button size="small" icon={<SaveOutlined />}
            loading={saving[r.id!]}
            disabled={!isDirty(r.id!)}
            onClick={() => handleSave(r)}
            style={isDirty(r.id!)
              ? { background: '#2ea172', borderColor: '#2ea172', color: '#fff', padding: '0 6px' }
              : { padding: '0 6px' }} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" icon={<CopyOutlined />} title="Copiar como" onClick={() => openCopiar(r)} />
          <Popconfirm title={r.activo ? '¿Bloquear?' : '¿Desbloquear?'} onConfirm={() => handleBloquear(r)}>
            <Button size="small"
              icon={r.activo ? <LockOutlined /> : <UnlockOutlined />}
              danger={r.activo}
              style={!r.activo ? { color: '#2ea172', borderColor: '#2ea172' } : undefined}
            />
          </Popconfirm>
          <Popconfirm title="¿Eliminar esta clase?" onConfirm={() => handleEliminar(r)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const guardadas = data.filter(c => !!c.id).length   // el backend devuelve las clases Guatemala en memoria (id null) si no hay guardadas
  const setupBanner = fromSetup && (
    <div style={{
      marginBottom: 12, padding: '10px 16px', borderRadius: 10,
      border: `1.5px solid ${setupDone ? '#bbf7d0' : '#b2e6f0'}`, background: setupDone ? '#f0fdf4' : '#f0fafe',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Tag color={setupDone ? '#2ea172' : '#1faec2'} style={{ margin: 0 }}>Paso 5 de 9</Tag>
      <span style={{ flex: 1, fontSize: 13 }}>
        {setupDone
          ? <b>Clases de activo fijo generadas ✓ — ya puedes continuar.</b>
          : guardadas > 0
            ? <><b>Ya tienes clases guardadas.</b> Vincula sus cuentas con «Cargar catálogo sugerido» si hace falta y confirma para continuar.</>
            : <><b>Genera las clases ISR Guatemala</b> con el botón resaltado «Cargar clases de AF»; luego «Cargar catálogo sugerido» vincula sus cuentas.</>}
      </span>
      {setupDone
        ? <Button type="primary" style={{ background: '#2ea172', borderColor: '#2ea172' }} onClick={() => navigate(SETUP_ROUTES.impuestos)}>Continuar al paso 6 →</Button>
        : guardadas > 0
          ? <Button type="primary" style={{ background: '#1faec2' }} onClick={() => confirmarPasoClases(true)}>Confirmar y continuar →</Button>
          : <Button onClick={() => navigate(SETUP_ROUTES.guide)}>Volver a la guía</Button>}
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      {setupBanner}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Clases de Activo Fijo (ISR Guatemala)</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNueva}
            style={{ background: '#1faec2' }}>
            Agregar
          </Button>
          <Popconfirm
            title="Cargar catálogo sugerido"
            description="Se asignarán cuentas del catálogo GLL estándar a cada clase. ¿Continuar?"
            onConfirm={handleSugerir}
            okText="Aplicar"
            cancelText="Cancelar"
            okButtonProps={{ style: { background: '#1faec2' } }}
          >
            <Button icon={<ThunderboltOutlined />} loading={sugeriendo}
              style={{ color: '#1faec2', borderColor: '#1faec2', ...(fromSetup && !setupDone && guardadas > 0 ? guideHighlight : {}) }}>
              Cargar catálogo sugerido
            </Button>
          </Popconfirm>
          <Button icon={<ReloadOutlined />} loading={seeding} onClick={handleSeed}
            style={fromSetup && !setupDone && guardadas === 0 ? guideHighlight : undefined}>
            Cargar clases de AF
          </Button>
        </Space>
      </div>

      {data.length === 0 && !loading && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Sin clases configuradas"
          description='Haz clic en "Cargar clases de AF" para crear las clases del ISR Art. 19 bis automáticamente.' />
      )}

      <Table
        dataSource={data}
        columns={columns}
        rowKey={r => r.id ?? r.codigo}
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 'calc(100vh - 330px)' }}
        rowClassName={r => isDirty(r.id ?? '') ? 'row-dirty' : ''}
      />

      <style>{`
        .row-dirty td { background: rgba(255,127,0,0.10) !important; }
        .ant-table-cell { vertical-align: middle; }
      `}</style>

      {/* ── Modal: Editar nombre ──────────────────────────────────────────── */}
      <Modal
        title={`Editar: ${editTarget?.codigo} — ${editTarget?.nombre}`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleEditSave}
        okText="Guardar"
        confirmLoading={editSaving}
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={420}
      >
        <Form form={editForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="nombre" label="Nombre de la clase" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Agregar / Copiar como ─────────────────────────────────── */}
      <Modal
        title="Nueva clase de activo fijo"
        open={nuevaModal}
        onCancel={() => setNuevaModal(false)}
        onOk={handleNuevaSave}
        okText="Crear"
        confirmLoading={nuevaSaving}
        okButtonProps={{ style: { background: '#1faec2' } }}
        width={460}
      >
        <Form form={nuevaForm} layout="vertical" size="small" style={{ marginTop: 12 }}
          initialValues={{ tasaDepreciacionAnual: 0.20, vidaUtilMeses: 60, esNoDepreciable: false }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: 3100" style={{ fontVariantNumeric: 'tabular-nums' }} />
            </Form.Item>
            <Form.Item name="nombre" label="Nombre de la clase" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: VEHÍCULOS DE CARGA" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="tasaDepreciacionAnual" label="Tasa anual">
              <InputNumber
                style={{ width: '100%' }} min={0} max={1} precision={4} step={0.05}
                formatter={v => `${((Number(v) || 0) * 100).toFixed(2)}%`}
                parser={v => (Number(v?.replace('%', '').trim()) / 100) as 0 | 1}
              />
            </Form.Item>
            <Form.Item name="vidaUtilMeses" label="Vida útil (meses)">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="ej: 60" />
            </Form.Item>
            <Form.Item name="esNoDepreciable" label="No depreciable" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
