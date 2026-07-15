import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Table, Tag, Space, Popconfirm, message, Modal, Form, Input,
  InputNumber, Select, DatePicker, Typography, Tooltip, Drawer, Alert,
  Upload, Steps, Divider, Result,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, CheckCircleOutlined,
  DollarOutlined, StopOutlined, UploadOutlined, DownloadOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getActivosFijos, crearActivoFijo, actualizarActivoFijo,
  activarActivoFijo, venderActivoFijo, darDeBajaActivoFijo,
  importarMasivoActivosFijos,
  type ActivoFijo, type EstadoActivoFijo, type ImportarActivoItem, type ImportarMasivoResult,
} from '../../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../../api/clases-activo-fijo'
import SelectorDimensionesAnaliticas, { type DimensionesValue } from '../../../components/SelectorDimensionesAnaliticas'

const { Title, Text } = Typography

const ESTADO_COLOR: Record<EstadoActivoFijo, string> = {
  BORRADOR:    'default',
  ACTIVO:      'success',
  VENDIDO:     'processing',
  DADO_DE_BAJA: 'error',
}

const ESTADO_LABEL: Record<EstadoActivoFijo, string> = {
  BORRADOR:    'Borrador',
  ACTIVO:      'Activo',
  VENDIDO:     'Vendido',
  DADO_DE_BAJA: 'Dado de Baja',
}

// ── Helpers CSV ──────────────────────────────────────────────────────────────

const CSV_HEADERS = ['nombre', 'codigo_clase', 'fecha_adquisicion', 'costo_original', 'valor_residual', 'dep_acumulada', 'ubicacion', 'numero_serie', 'descripcion']

function descargarPlantillaCSV() {
  const ejemplo = [
    'Vehículo Toyota Hilux 2020,VEH,2020-01-15,120000,0,48000,Bodega Central,SN-12345,',
    'Computadora Dell,EQU,2021-06-01,15000,0,6000,Oficina Principal,COMP-001,',
    'Mobiliario de Oficina,MOB,2019-03-01,30000,0,18000,Sala de Reuniones,,',
  ].join('\n')
  const csv = `${CSV_HEADERS.join(',')}\n${ejemplo}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'plantilla_activos_fijos.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parsearCSV(texto: string, clases: ClaseActivoFijo[]): { filas: ImportarActivoItem[]; errores: string[] } {
  const lineas = texto.trim().split('\n').filter(Boolean)
  if (lineas.length < 2) return { filas: [], errores: ['El archivo está vacío o solo tiene encabezados'] }

  const errores: string[] = []
  const filas: ImportarActivoItem[] = []

  lineas.slice(1).forEach((linea, i) => {
    const fila = i + 2
    const cols  = linea.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const [nombre, codigoClase, fechaAdq, costoStr, residualStr, depAcumStr, ubicacion, serie, descripcion] = cols

    if (!nombre) { errores.push(`Fila ${fila}: nombre requerido`); return }

    const costo = parseFloat(costoStr)
    if (isNaN(costo) || costo <= 0) { errores.push(`Fila ${fila}: costo_original inválido`); return }

    if (!fechaAdq || !/^\d{4}-\d{2}-\d{2}$/.test(fechaAdq)) {
      errores.push(`Fila ${fila}: fecha_adquisicion debe ser YYYY-MM-DD`); return
    }

    const claseEncontrada = codigoClase ? clases.find(c => c.codigo.toUpperCase() === codigoClase.toUpperCase()) : undefined

    if (codigoClase && !claseEncontrada) {
      errores.push(`Fila ${fila}: código de clase "${codigoClase}" no encontrado`)
    }

    const residual = parseFloat(residualStr) || 0
    const depAcum  = parseFloat(depAcumStr)  || 0

    if (depAcum > 0 && depAcum >= costo - residual) {
      errores.push(`Fila ${fila}: dep_acumulada (${depAcum}) no puede ser mayor o igual al valor depreciable (${costo - residual})`)
      return
    }

    filas.push({
      name:                      nombre,
      claseActivoFijoId:         claseEncontrada?.id ?? undefined,
      acquisitionDate:           fechaAdq,
      originalCost:              costo,
      salvageValue:              residual || undefined,
      depreciacionAcumuladaInicial: depAcum || undefined,
      location:                  ubicacion || undefined,
      serialNumber:              serie || undefined,
      description:               descripcion || undefined,
    })
  })

  return { filas, errores }
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ActivosFijosPage() {
  const navigate = useNavigate()
  const [data,         setData]         = useState<ActivoFijo[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [clases,       setClases]       = useState<ClaseActivoFijo[]>([])
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>()

  // Formulario crear/editar
  const [modalForm, setModalForm] = useState(false)
  const [editing,   setEditing]   = useState<ActivoFijo | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [form] = Form.useForm()
  const depAcumWatch = Form.useWatch('depreciacionAcumuladaInicial', form)
  const costoWatch   = Form.useWatch('originalCost', form)
  const residualWatch = Form.useWatch('salvageValue', form)

  // Acciones
  const [modalVender, setModalVender] = useState(false)
  const [modalBaja,   setModalBaja]   = useState(false)
  const [actionId,    setActionId]    = useState<string | null>(null)
  const [actLoading,  setActLoading]  = useState(false)
  const [formVender]  = Form.useForm()
  const [formBaja]    = Form.useForm()

  // Importación masiva
  const [drawerImport,  setDrawerImport]  = useState(false)
  const [importStep,    setImportStep]    = useState(0)
  const [csvFilas,      setCsvFilas]      = useState<ImportarActivoItem[]>([])
  const [csvErrores,    setCsvErrores]    = useState<string[]>([])
  const [importando,    setImportando]    = useState(false)
  const [importResult,  setImportResult]  = useState<ImportarMasivoResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getActivosFijos({ search, estado: filtroEstado, page })
      setData(res.data)
      setTotal(res.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [search, filtroEstado, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getClasesActivoFijo().then(setClases).catch(() => {})
  }, [])

  // ── Preview depreciación acumulada ──────────────────────────────────────────

  const depAcum  = Number(depAcumWatch  ?? 0)
  const costo    = Number(costoWatch    ?? 0)
  const residual = Number(residualWatch ?? 0)
  const valorEnLibros = costo - depAcum

  // ── Crear / Editar ──────────────────────────────────────────────────────────

  const openNew = () => { setEditing(null); form.resetFields(); setModalForm(true) }
  const openEdit = (r: ActivoFijo) => {
    setEditing(r)
    form.setFieldsValue({
      name: r.name,
      description: r.description,
      claseActivoFijoId: r.claseActivoFijoId,
      acquisitionDate: r.acquisitionDate ? dayjs(r.acquisitionDate) : null,
      originalCost: r.originalCost,
      salvageValue: r.salvageValue,
      location: r.location,
      serialNumber: r.serialNumber,
      dimensiones: {
        centroCostoId:     r.centroCostoId     ?? undefined,
        centroBeneficioId: r.centroBeneficioId ?? undefined,
      },
    })
    setModalForm(true)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      const dim = vals.dimensiones as DimensionesValue | undefined
      const { dimensiones: _dim, ...rest } = vals
      void _dim
      const payload = {
        ...rest,
        acquisitionDate:   vals.acquisitionDate?.format('YYYY-MM-DD'),
        centroCostoId:     dim?.centroCostoId     ?? null,
        centroBeneficioId: dim?.centroBeneficioId ?? null,
      }
      if (editing) {
        await actualizarActivoFijo(editing.id, payload)
        message.success('Activo fijo actualizado')
      } else {
        await crearActivoFijo(payload)
        message.success('Activo fijo creado en borrador')
      }
      setModalForm(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  // ── Activar ─────────────────────────────────────────────────────────────────

  const handleActivar = async (id: string) => {
    setActLoading(true)
    try {
      await activarActivoFijo(id)
      message.success('Activo activado — póliza generada')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al activar')
    } finally { setActLoading(false) }
  }

  // ── Vender ──────────────────────────────────────────────────────────────────

  const handleVender = async () => {
    const vals = await formVender.validateFields()
    setActLoading(true)
    try {
      await venderActivoFijo(actionId!, {
        fechaVenta: vals.fechaVenta.format('YYYY-MM-DD'),
        precioVenta: vals.precioVenta,
        motivo: vals.motivo,
      })
      message.success('Venta registrada — póliza contable generada')
      setModalVender(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al registrar venta')
    } finally { setActLoading(false) }
  }

  // ── Dar de Baja ─────────────────────────────────────────────────────────────

  const handleBaja = async () => {
    const vals = await formBaja.validateFields()
    setActLoading(true)
    try {
      await darDeBajaActivoFijo(actionId!, {
        fecha: vals.fecha.format('YYYY-MM-DD'),
        motivo: vals.motivo,
      })
      message.success('Baja registrada — póliza contable generada')
      setModalBaja(false)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al dar de baja')
    } finally { setActLoading(false) }
  }

  // ── Importación masiva ───────────────────────────────────────────────────────

  const abrirImport = () => {
    setImportStep(0); setCsvFilas([]); setCsvErrores([]); setImportResult(null)
    setDrawerImport(true)
  }

  const handleCSVFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const texto = e.target?.result as string
      const { filas, errores } = parsearCSV(texto, clases)
      setCsvFilas(filas)
      setCsvErrores(errores)
      setImportStep(1)
    }
    reader.readAsText(file, 'UTF-8')
    return false
  }

  const handleConfirmarImport = async () => {
    setImportando(true)
    try {
      const result = await importarMasivoActivosFijos(csvFilas)
      setImportResult(result)
      setImportStep(2)
      if (result.exitosos > 0) load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error en la importación')
    } finally { setImportando(false) }
  }

  // ── Tabla ────────────────────────────────────────────────────────────────────

  const columns = [
    { title: 'Número', dataIndex: 'assetNumber', width: 110 },
    { title: 'Nombre', dataIndex: 'name' },
    {
      title: 'Clase', dataIndex: 'claseActivoFijoId', width: 160,
      render: (v: string) => clases.find(c => c.id === v)?.nombre ?? '—',
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 110,
      render: (v: EstadoActivoFijo) => (
        <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v]}</Tag>
      ),
    },
    {
      title: 'Costo Original', dataIndex: 'originalCost', width: 130, align: 'right' as const,
      render: (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Valor en Libros', dataIndex: 'currentBookValue', width: 130, align: 'right' as const,
      render: (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Cuota Mensual', dataIndex: 'depreciacionMensual', width: 130, align: 'right' as const,
      render: (v: number | null) => v
        ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
        : '—',
    },
    {
      title: 'Adquisición', dataIndex: 'acquisitionDate', width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Acciones', width: 170,
      render: (_: any, r: ActivoFijo) => (
        <Space size={4}>
          <Tooltip title="Ver detalle e historial">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/contabilidad/activos-fijos/${r.id}`)} />
          </Tooltip>
          {r.estado === 'BORRADOR' && (
            <Tooltip title="Activar activo">
              <Popconfirm
                title={
                  Number(r.accumulatedDepreciation) > 0
                    ? '¿Activar activo migrado? Se generará póliza de apertura con saldo inicial.'
                    : '¿Activar este activo? Se generará póliza de alta.'
                }
                onConfirm={() => handleActivar(r.id)}
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  style={{ background: '#1B3A6B' }} loading={actLoading} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.estado === 'ACTIVO' && (
            <>
              <Tooltip title="Registrar venta">
                <Button size="small" icon={<DollarOutlined />}
                  onClick={() => { setActionId(r.id); formVender.resetFields(); setModalVender(true) }} />
              </Tooltip>
              <Tooltip title="Dar de baja">
                <Button size="small" danger icon={<StopOutlined />}
                  onClick={() => { setActionId(r.id); formBaja.resetFields(); setModalBaja(true) }} />
              </Tooltip>
            </>
          )}
          {(r.estado === 'BORRADOR' || r.estado === 'ACTIVO') && (
            <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
          )}
        </Space>
      ),
    },
  ]

  // ── Columnas preview importación ─────────────────────────────────────────────

  const importColumns = [
    { title: 'Fila', render: (_: any, __: any, i: number) => i + 2, width: 55 },
    { title: 'Nombre', dataIndex: 'name' },
    {
      title: 'Clase', dataIndex: 'claseActivoFijoId', width: 140,
      render: (v: string) => clases.find(c => c.id === v)?.nombre ?? <Text type="secondary">Sin clase</Text>,
    },
    {
      title: 'Costo (Q)', dataIndex: 'originalCost', width: 110, align: 'right' as const,
      render: (v: number) => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Dep. Acum. (Q)', dataIndex: 'depreciacionAcumuladaInicial', width: 120, align: 'right' as const,
      render: (v: number) => v ? Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '—',
    },
    {
      title: 'Valor Libros (Q)', width: 125, align: 'right' as const,
      render: (_: any, r: ImportarActivoItem) => {
        const vl = r.originalCost - (r.depreciacionAcumuladaInicial ?? 0)
        return Number(vl).toLocaleString('es-GT', { minimumFractionDigits: 2 })
      },
    },
    { title: 'Adquisición', dataIndex: 'acquisitionDate', width: 105 },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>Activos Fijos</Title>
        <Space>
          <Button icon={<ImportOutlined />} onClick={abrirImport}>
            Importar saldos iniciales
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
            style={{ background: '#1B3A6B' }}>Nuevo Activo</Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Buscar por nombre, número o serie..."
          onSearch={v => { setSearch(v); setPage(1) }}
          allowClear style={{ width: 280 }}
        />
        <Select
          placeholder="Estado" allowClear style={{ width: 140 }}
          onChange={v => { setFiltroEstado(v); setPage(1) }}
          options={[
            { label: 'Borrador',     value: 'BORRADOR' },
            { label: 'Activo',       value: 'ACTIVO' },
            { label: 'Vendido',      value: 'VENDIDO' },
            { label: 'Dado de Baja', value: 'DADO_DE_BAJA' },
          ]}
        />
      </Space>

      <Table
        dataSource={data} columns={columns} rowKey="id"
        loading={loading} size="small"
        pagination={{
          current: page, pageSize: 50, total,
          onChange: p => setPage(p),
          showTotal: t => `${t} activos`,
        }}
      />

      {/* ── Modal: Nuevo / Editar ─────────────────────────────────────── */}
      <Modal
        title={editing ? `Editar ${editing.assetNumber}` : 'Nuevo Activo Fijo'}
        open={modalForm} onCancel={() => setModalForm(false)}
        onOk={handleSave} okText="Guardar" confirmLoading={saving}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
        width={660}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Form.Item name="name" label="Nombre del activo" rules={[{ required: true }]}>
              <Input placeholder="Vehículo Toyota Hilux 2024" />
            </Form.Item>
            <Form.Item name="claseActivoFijoId" label="Clase" rules={[{ required: true }]}>
              <Select
                showSearch placeholder="Clase"
                optionFilterProp="label"
                options={clases.map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
              />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="acquisitionDate" label="Fecha de adquisición" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="originalCost" label="Costo original (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
            <Form.Item name="salvageValue" label="Valor residual (Q)">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>

          {/* Campo saldo inicial — solo visible al crear */}
          {!editing && (
            <>
              <Divider dashed style={{ margin: '8px 0' }} />
              <Form.Item
                name="depreciacionAcumuladaInicial"
                label="Depreciación acumulada al ingreso (Q)"
                tooltip="Solo para traslado de saldos iniciales. Dejar vacío para activos nuevos."
                extra={
                  depAcum > 0 && costo > 0
                    ? <span style={{ fontSize: 11, color: '#1B3A6B' }}>
                        Valor en libros al ingresar: <strong>Q {valorEnLibros.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</strong>
                        {residual > 0 && depAcum >= costo - residual
                          ? <span style={{ color: '#f5222d' }}> — excede el valor depreciable</span>
                          : null}
                      </span>
                    : <span style={{ fontSize: 11, color: '#8c8c8c' }}>Solo para migración desde otro sistema</span>
                }
              >
                <InputNumber style={{ width: 200 }} min={0} precision={2}
                  placeholder="0.00 — dejar vacío si es activo nuevo" />
              </Form.Item>
              <Divider dashed style={{ margin: '8px 0' }} />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="location" label="Ubicación">
              <Input placeholder="Bodega Central" />
            </Form.Item>
            <Form.Item name="serialNumber" label="Número de serie">
              <Input placeholder="SN-12345" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dimensiones" style={{ marginBottom: 0 }}>
            <SelectorDimensionesAnaliticas layout="form" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Vender ────────────────────────────────────────────── */}
      <Modal
        title={<><DollarOutlined /> Registrar Venta de Activo</>}
        open={modalVender} onCancel={() => setModalVender(false)}
        onOk={handleVender} okText="Registrar venta"
        confirmLoading={actLoading}
        okButtonProps={{ style: { background: '#1B3A6B' } }}
      >
        <Form form={formVender} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="fechaVenta" label="Fecha de venta" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="precioVenta" label="Precio de venta (Q)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <Form.Item name="motivo" label="Motivo / referencia">
            <Input placeholder="Venta a tercero, placa XYZ..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Dar de baja ───────────────────────────────────────── */}
      <Modal
        title={<><StopOutlined /> Dar de Baja Activo</>}
        open={modalBaja} onCancel={() => setModalBaja(false)}
        onOk={handleBaja} okText="Registrar baja" okButtonProps={{ danger: true }}
        confirmLoading={actLoading}
      >
        <Form form={formBaja} layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item name="fecha" label="Fecha de baja" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo (deterioro / siniestro)" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Ej: Siniestro total por accidente de tránsito" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer: Importación masiva ───────────────────────────────── */}
      <Drawer
        title="Importar saldos iniciales — Activos Fijos"
        open={drawerImport}
        onClose={() => setDrawerImport(false)}
        width={900}
        footer={
          importStep === 1 && csvFilas.length > 0 && csvErrores.length === 0 ? (
            <Space>
              <Button onClick={() => setImportStep(0)}>Volver</Button>
              <Button type="primary" loading={importando}
                style={{ background: '#1B3A6B' }}
                onClick={handleConfirmarImport}>
                Importar {csvFilas.length} activos
              </Button>
            </Space>
          ) : importStep === 2 ? (
            <Button onClick={() => setDrawerImport(false)}>Cerrar</Button>
          ) : null
        }
      >
        <Steps current={importStep} size="small" style={{ marginBottom: 24 }}
          items={[
            { title: 'Cargar CSV' },
            { title: 'Revisar' },
            { title: 'Resultado' },
          ]}
        />

        {/* Paso 0: Cargar archivo */}
        {importStep === 0 && (
          <div>
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="Formato del archivo CSV"
              description={
                <div>
                  <p style={{ margin: '4px 0' }}>Columnas requeridas: <code>nombre</code>, <code>fecha_adquisicion</code> (YYYY-MM-DD), <code>costo_original</code></p>
                  <p style={{ margin: '4px 0' }}>Columnas opcionales: <code>codigo_clase</code>, <code>valor_residual</code>, <code>dep_acumulada</code>, <code>ubicacion</code>, <code>numero_serie</code>, <code>descripcion</code></p>
                  <p style={{ margin: '4px 0' }}>Si la clase se incluye y el activo tiene depreciación acumulada, se activa automáticamente con póliza de apertura.</p>
                </div>
              }
            />
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button icon={<DownloadOutlined />} onClick={descargarPlantillaCSV}>
                Descargar plantilla CSV
              </Button>
              <Upload accept=".csv" beforeUpload={handleCSVFile} showUploadList={false}>
                <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
                  Seleccionar archivo CSV
                </Button>
              </Upload>
            </Space>
          </div>
        )}

        {/* Paso 1: Revisar */}
        {importStep === 1 && (
          <div>
            {csvErrores.length > 0 && (
              <Alert type="error" showIcon style={{ marginBottom: 16 }}
                message={`${csvErrores.length} error(es) encontrados — corrige el archivo y vuelve a cargarlo`}
                description={<ul style={{ margin: 0, paddingLeft: 16 }}>{csvErrores.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              />
            )}
            {csvFilas.length > 0 && (
              <>
                <Text style={{ display: 'block', marginBottom: 8 }}>
                  <strong>{csvFilas.length}</strong> activos listos para importar
                  {csvFilas.filter(f => (f.depreciacionAcumuladaInicial ?? 0) > 0).length > 0 &&
                    <> — <strong>{csvFilas.filter(f => (f.depreciacionAcumuladaInicial ?? 0) > 0).length}</strong> con saldo inicial</>}
                </Text>
                <Table
                  dataSource={csvFilas} columns={importColumns}
                  rowKey={(_, i) => String(i)}
                  size="small" pagination={false} scroll={{ y: 400 }}
                />
              </>
            )}
            {csvFilas.length === 0 && csvErrores.length === 0 && (
              <Alert type="warning" message="El archivo no contiene filas de datos" />
            )}
          </div>
        )}

        {/* Paso 2: Resultado */}
        {importStep === 2 && importResult && (
          <div>
            <Result
              status={importResult.errores === 0 ? 'success' : importResult.exitosos === 0 ? 'error' : 'warning'}
              title={`${importResult.exitosos} importados, ${importResult.errores} errores`}
            />
            <Table
              dataSource={importResult.detalles}
              rowKey="fila"
              size="small"
              pagination={false}
              scroll={{ y: 400 }}
              columns={[
                { title: 'Fila', dataIndex: 'fila', width: 55 },
                { title: 'Nombre', dataIndex: 'nombre' },
                { title: 'N.º Activo', dataIndex: 'assetNumber', width: 110 },
                {
                  title: 'Estado', dataIndex: 'estado', width: 80,
                  render: (v: string) => <Tag color={v === 'ok' ? 'success' : 'error'}>{v === 'ok' ? 'OK' : 'Error'}</Tag>,
                },
                { title: 'Detalle', dataIndex: 'mensaje', render: (v: string) => v ?? '—' },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}
