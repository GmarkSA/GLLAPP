import { useState, useCallback, useRef } from 'react'
import {
  Typography, Button, Upload, Table, message, DatePicker, InputNumber,
  Alert, Collapse, Tag, Space, Spin, Popconfirm, Steps, Empty, Select, Tooltip,
} from 'antd'
import {
  DownloadOutlined, UploadOutlined, CheckCircleOutlined,
  TeamOutlined, ShopOutlined, AuditOutlined, HomeOutlined,
  FileExcelOutlined, WarningOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { ColumnType } from 'antd/es/table'
import { batchImportClientes, batchImportProveedores, type BatchImportRow } from '../../api/contactos'
import { getAccounts, setSaldosApertura, type Account, type SaldoAperturaLinea } from '../../api/catalogo'
import { getProducts, importSaldosInicialesInventario, type Product, type SaldoInicialInventarioItem, type SaldoInicialInventarioResult } from '../../api/inventario'
import { getAlmacenes, getGrupos, type Almacen, type GrupoArticulo } from '../../api/expedientes'
import { getTaxes } from '../../api/impuestos'
import {
  construirPlantillaInventario, leerArchivoDeArticulos, analizarArchivoDeArticulos,
  type AnalisisDelArchivo,
} from './plantillaInventario'

const { Title, Text } = Typography
const { Panel } = Collapse

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
  })
}

function downloadCsv(filename: string, headers: string[], sampleRow: string[]) {
  const csv = [headers.join(','), sampleRow.join(',')].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Clientes / Proveedores CSV section ──────────────────────────────────────

const ENTITY_HEADERS = ['nombre', 'nit', 'email', 'telefono', 'direccion', 'saldo_inicial', 'fecha_saldo_inicial']
const ENTITY_SAMPLE  = [
  '"Empresa Ejemplo S.A."', '"12345678-9"', '"contacto@empresa.com"',
  '"5555-5555"', '"4a Calle 12-55 zona 10"', '"15000.00"', '"2024-01-01"',
]

interface EntityStep { step: number; rows: BatchImportRow[]; result?: { created: number; updated: number; errors: string[] } }

function EntityImportSection({
  type, fechaMigracion,
}: { type: 'clientes' | 'proveedores'; fechaMigracion: Dayjs | null }) {
  const label   = type === 'clientes' ? 'Clientes (CxC)' : 'Proveedores (CxP)'
  const [state, setState] = useState<EntityStep>({ step: 0, rows: [] })
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsvText(text)
    if (!parsed.length) { message.error('El archivo no contiene datos válidos'); return false }

    const rows: BatchImportRow[] = parsed.map(r => ({
      nombre:              r.nombre || r.name || '',
      nit:                 r.nit || r.taxId || '',
      email:               r.email || r.correo || '',
      telefono:            r.telefono || r.phone || '',
      direccion:           r.direccion || r.address || '',
      saldo_inicial:       r.saldo_inicial ? Number(r.saldo_inicial) : undefined,
      fecha_saldo_inicial: r.fecha_saldo_inicial || (fechaMigracion ? fechaMigracion.format('YYYY-MM-DD') : undefined),
    })).filter(r => r.nombre)

    setState({ step: 1, rows })
    return false
  }

  const handleImport = async () => {
    setLoading(true)
    try {
      const fn = type === 'clientes' ? batchImportClientes : batchImportProveedores
      const result = await fn(state.rows)
      setState(s => ({ ...s, step: 2, result }))
      message.success(`Importación completada: ${result.created} creados, ${result.updated} actualizados`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const previewCols: ColumnType<BatchImportRow>[] = [
    { title: 'Nombre',        dataIndex: 'nombre',              width: 200 },
    { title: 'NIT',           dataIndex: 'nit',                 width: 110 },
    { title: 'Email',         dataIndex: 'email',               width: 180 },
    { title: 'Teléfono',      dataIndex: 'telefono',            width: 110 },
    { title: 'Saldo Inicial', dataIndex: 'saldo_inicial',       width: 120,
      render: (v: number) => v != null ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—' },
    { title: 'Fecha Saldo',   dataIndex: 'fecha_saldo_inicial', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
  ]

  return (
    <div style={{ padding: '12px 0' }}>
      <Steps size="small" current={state.step} style={{ marginBottom: 24 }} items={[
        { title: 'Subir archivo' },
        { title: 'Revisar' },
        { title: 'Completado' },
      ]} />

      {state.step === 0 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadCsv(`plantilla_${type}.csv`, ENTITY_HEADERS, ENTITY_SAMPLE)}
          >
            Descargar plantilla CSV
          </Button>
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleFile}
          >
            <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
              Subir archivo CSV
            </Button>
          </Upload>
        </div>
      )}

      {state.step === 1 && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{state.rows.length} registros listos para importar</Text>
            <Space>
              <Button onClick={() => setState({ step: 0, rows: [] })}>Cancelar</Button>
              <Popconfirm
                title={`¿Importar ${state.rows.length} ${label}?`}
                description="Los registros existentes (mismo NIT) serán actualizados."
                onConfirm={handleImport}
                okText="Importar"
                okButtonProps={{ style: { background: '#1B3A6B' } }}
              >
                <Button type="primary" icon={<ArrowRightOutlined />} loading={loading}
                  style={{ background: '#1B3A6B' }}>
                  Confirmar importación
                </Button>
              </Popconfirm>
            </Space>
          </div>
          <Table
            dataSource={state.rows}
            columns={previewCols}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </div>
      )}

      {state.step === 2 && state.result && (
        <div>
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message={`Importación de ${label} completada`}
            description={
              <div>
                <div>✅ Creados: <strong>{state.result.created}</strong></div>
                <div>🔄 Actualizados: <strong>{state.result.updated}</strong></div>
                {state.result.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="danger"><WarningOutlined /> {state.result.errors.length} errores:</Text>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                      {state.result.errors.map((err: string, i: number) => <li key={i} style={{ fontSize: 12 }}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            }
            style={{ marginBottom: 12 }}
          />
          <Button onClick={() => setState({ step: 0, rows: [] })}>Nueva importación</Button>
        </div>
      )}
    </div>
  )
}

// ─── Saldos de cuentas de mayor ───────────────────────────────────────────────

interface AccountRow extends Account { _debit: number; _credit: number }

const BALANCE_TYPE_ORDER = ['Activo', 'Pasivo', 'Capital', 'Ingresos', 'Costo', 'Gasto', 'Otros']
const BALANCE_TYPE_COLOR: Record<string, string> = {
  Activo: '#1faec2', Pasivo: '#e5484d', Capital: '#7c3aed', Ingresos: '#2ea172',
  Costo: '#f59e0b', Gasto: '#ef4444', Otros: '#6b7280',
}

function SaldosCuentasSection({ fechaMigracion }: { fechaMigracion: Dayjs | null }) {
  const [rows, setRows]       = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState<{ polizaId: string; updated: number } | null>(null)
  // Decide qué se dibuja, así que es estado: una referencia no repinta la pantalla
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const accounts: Account[] = await getAccounts()
      const filterable = accounts.filter(a => !a.isHeader && a.isActive)
      setRows(filterable.map(a => ({ ...a, _debit: 0, _credit: 0 })))
      setLoaded(true)
    } catch {
      message.error('Error cargando catálogo de cuentas')
    } finally {
      setLoading(false)
    }
  }, [loaded])

  const setDebit  = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: v || 0,  _credit: 0 } : r))
  const setCredit = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: 0, _credit: v || 0 } : r))

  const touched     = rows.filter(r => r._debit > 0 || r._credit > 0)
  const totalDebit  = touched.reduce((s, r) => s + r._debit,  0)
  const totalCredit = touched.reduce((s, r) => s + r._credit, 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const handleSave = async () => {
    if (!fechaMigracion) { message.error('Selecciona la fecha de migración'); return }
    if (!touched.length)  { message.error('Ingresa al menos un saldo'); return }
    if (!balanced)        { message.error(`La póliza no cuadra: Debe Q${totalDebit.toFixed(2)}, Haber Q${totalCredit.toFixed(2)}`); return }

    setSaving(true)
    try {
      const lineas: SaldoAperturaLinea[] = touched.map(r => ({
        accountId: r.id,
        debit:     r._debit,
        credit:    r._credit,
      }))
      const res = await setSaldosApertura({
        fecha:       fechaMigracion.format('YYYY-MM-DD'),
        descripcion: 'Saldos de apertura / migración inicial',
        lineas,
      })
      setResult(res)
      message.success('Saldos de apertura guardados y póliza OPENING generada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Alert
          type="success" showIcon icon={<CheckCircleOutlined />}
          message="Saldos de apertura cargados"
          description={
            <div>
              <div>✅ Cuentas actualizadas: <strong>{result.updated}</strong></div>
              <div>📋 Póliza OPENING generada (ID: <code>{result.polizaId.slice(0, 8)}…</code>)</div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  La póliza está disponible en Contabilidad → Diarios Manuales
                </Text>
              </div>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
        <Button onClick={() => { setResult(null); setLoaded(false); setRows([]) }}>
          Cargar nuevamente
        </Button>
      </div>
    )
  }

  const byType = BALANCE_TYPE_ORDER.map(bt => ({
    bt,
    items: rows.filter(r => (r.balanceType ?? 'Otros') === bt),
  })).filter(g => g.items.length > 0)

  const cols: ColumnType<AccountRow>[] = [
    { title: 'Código', dataIndex: 'code', width: 90 },
    { title: 'Cuenta', dataIndex: 'name', ellipsis: true },
    {
      title: 'Debe (Db)', width: 150,
      render: (_: any, r: AccountRow) => (
        <InputNumber
          value={r._debit || undefined}
          min={0} precision={2} size="small" style={{ width: '100%' }}
          formatter={v => v ? `Q ${v}` : ''}
          parser={v => v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0}
          onChange={v => setDebit(r.id, Number(v) || 0)}
          placeholder="0.00"
        />
      ),
    },
    {
      title: 'Haber (Cr)', width: 150,
      render: (_: any, r: AccountRow) => (
        <InputNumber
          value={r._credit || undefined}
          min={0} precision={2} size="small" style={{ width: '100%' }}
          formatter={v => v ? `Q ${v}` : ''}
          parser={v => v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0}
          onChange={v => setCredit(r.id, Number(v) || 0)}
          placeholder="0.00"
        />
      ),
    },
  ]

  return (
    <div style={{ padding: '12px 0' }}>
      {!loaded ? (
        <Button icon={<AuditOutlined />} onClick={load} loading={loading}
          style={{ marginBottom: 16 }}>
          Cargar catálogo de cuentas
        </Button>
      ) : (
        <Spin spinning={loading}>
          {touched.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: balanced ? '#f0fdf4' : '#fef9f0',
              border: `1px solid ${balanced ? '#bbf7d0' : '#fed7aa'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Space>
                <Text strong>Debe:</Text>
                <Text style={{ color: '#1faec2' }}>Q {totalDebit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                <Text strong style={{ marginLeft: 12 }}>Haber:</Text>
                <Text style={{ color: '#e5484d' }}>Q {totalCredit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                {!balanced && <Tag color="orange">⚠ Descuadrado Q {Math.abs(totalDebit - totalCredit).toFixed(2)}</Tag>}
                {balanced && touched.length > 0 && <Tag color="success">✓ Cuadrado</Tag>}
              </Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!balanced || !fechaMigracion}
                style={{ background: '#1B3A6B' }}
              >
                Generar póliza de apertura
              </Button>
            </div>
          )}

          {byType.map(({ bt, items }) => (
            <div key={bt} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 6, paddingBottom: 4,
                borderBottom: `2px solid ${BALANCE_TYPE_COLOR[bt] ?? '#e5e7eb'}`,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: BALANCE_TYPE_COLOR[bt] ?? '#6b7280',
                }}>
                  {bt}
                </span>
                <Tag color={BALANCE_TYPE_COLOR[bt]} style={{ fontSize: 11 }}>{items.length} cuentas</Tag>
              </div>
              <Table
                dataSource={items}
                columns={cols}
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={r => (r._debit > 0 || r._credit > 0) ? 'ant-table-row-selected' : ''}
              />
            </div>
          ))}

          {!loading && rows.length === 0 && (
            <Empty description="No hay cuentas de detalle en el catálogo" />
          )}
        </Spin>
      )}
    </div>
  )
}

// ─── Inventario saldos iniciales section ─────────────────────────────────────

const INV_HEADERS = ['sku', 'nombre', 'cantidad', 'costo_unitario']
const INV_SAMPLE  = ['"ART-001"', '"Cemento gris 50kg"', '"100"', '"85.00"']

interface InvRow {
  sku: string; nombre: string; quantity: number; unitCost: number; productId?: string
  /** Almacén de la fila. Manda sobre el «almacén destino» de la pantalla. */
  warehouseId?: string
  almacenCodigo?: string
}
interface InvStep { step: number; rows: InvRow[]; result?: SaldoInicialInventarioResult }

function InventarioSection({ fechaMigracion }: { fechaMigracion: Dayjs | null }) {
  const [almacenes,      setAlmacenes]      = useState<Almacen[]>([])
  const [warehouseId,    setWarehouseId]    = useState<string | undefined>()
  /** Lo que Lucía entendió del archivo, para enseñarlo antes de cargar. */
  const [analisis,       setAnalisis]       = useState<AnalisisDelArchivo | null>(null)
  /** Filas que el archivo trae sin existencia: esta carga no tiene qué hacer con ellas. */
  const [sinExistencia,  setSinExistencia]  = useState(0)
  const [products,       setProducts]       = useState<Product[]>([])
  const [catalogo,       setCatalogo]       = useState<{
    cuentas: Array<{ code: string; name: string }>
    impuestos: Array<{ code: string; name: string; rate?: number }>
    grupos: Array<{ code: string; name: string }>
  }>({ cuentas: [], impuestos: [], grupos: [] })
  const [state,          setState]          = useState<InvStep>({ step: 0, rows: [] })
  const [loading,        setLoading]        = useState(false)
  const [dataLoading,    setDataLoading]    = useState(false)
  const loaded = useRef(false)

  const loadData = useCallback(async () => {
    if (loaded.current) return
    setDataLoading(true)
    try {
      // Las cuentas, impuestos y grupos van DENTRO de la plantilla: así nadie
      // tiene que adivinar que su cuenta de ingresos es la 410001 ni que su
      // impuesto se llama PC-V01.
      const [alms, prods, cuentas, impuestos, grupos] = await Promise.all([
        getAlmacenes(),
        getProducts({ limit: 500 }).then((r: any) => r.data ?? r),
        getAccounts().catch(() => []),
        getTaxes().catch(() => []),
        getGrupos().catch(() => []),
      ])
      setAlmacenes(Array.isArray(alms) ? alms : [])
      setProducts(Array.isArray(prods) ? prods : [])
      setCatalogo({
        cuentas: (Array.isArray(cuentas) ? cuentas : [])
          .filter((c: any) => c?.code && c?.isActive !== false)
          .map((c: any) => ({ code: String(c.code), name: String(c.name ?? '') })),
        impuestos: (Array.isArray(impuestos) ? impuestos : [])
          .filter((t: any) => t?.code)
          .map((t: any) => ({ code: String(t.code), name: String(t.name ?? ''), rate: Number(t.rate) || 0 })),
        grupos: (Array.isArray(grupos) ? grupos : [])
          .map((g: GrupoArticulo) => ({ code: String(g.code ?? ''), name: String(g.name ?? '') })),
      })
      loaded.current = true
    } catch {
      message.error('Error cargando datos de inventario')
    } finally {
      setDataLoading(false)
    }
  }, [])

  /**
   * La plantilla con las cuentas, impuestos, grupos y unidades REALES de la
   * empresa, y las 26 columnas de las tres pestañas del artículo.
   */
  const descargarPlantillaExcel = async () => {
    await loadData()
    const datos = construirPlantillaInventario({
      ...catalogo,
      unidades:  ['UND', 'CAJA', 'BOLSA', 'PAQUETE', 'YARDA', 'RESMA', 'ROLLO', 'SET', 'KG', 'LT', 'MT'],
      almacenes: almacenes.map(a => ({ code: String(a.code ?? ''), name: String(a.name ?? '') })),
    })
    const url = URL.createObjectURL(new Blob([datos], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Plantilla carga de inventario.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (file: File) => {
    await loadData()
    setAnalisis(null)
    setSinExistencia(0)

    // Excel o CSV: el lector reconoce los encabezados de la plantilla y también
    // los que exporta Zoho, así el archivo se sube tal como sale del otro sistema.
    let crudas: Array<Record<string, any>>
    if (/\.xlsx?$/i.test(file.name)) {
      const bytes = await file.arrayBuffer()
      try {
        crudas = leerArchivoDeArticulos(bytes) as any[]
      } catch (e: any) {
        message.error(e?.message ?? 'No se pudo leer el archivo'); return false
      }
      // Qué entendió de cada columna, para enseñárselo antes de cargar.
      try { setAnalisis(analizarArchivoDeArticulos(bytes)) } catch { setAnalisis(null) }
    } else {
      crudas = parseCsvText(await file.text()).map(r => ({
        sku:         r.sku || r.SKU || r.codigo || '',
        nombre:      r.nombre || r.name || '',
        existencia:  Number(r.cantidad || r.quantity || 0),
        costo:       Number(r.costo_unitario || r.unitCost || r.costo || 0),
      }))
    }
    if (!crudas.length) {
      message.error(
        'El archivo no trae ninguna fila. Si es la plantilla recién descargada, ' +
        'escribe tus artículos en la hoja «Artículos», debajo de los encabezados: ' +
        'la hoja «Ejemplo» es solo de muestra y no se carga.',
        10,
      )
      return false
    }

    // El almacén de la fila manda sobre el «almacén destino» de la pantalla: el
    // archivo sabe dónde va cada artículo y la pantalla solo pone el de relleno.
    const porCodigo = new Map(almacenes
      .filter(a => a.code)
      .map(a => [String(a.code).trim().toUpperCase(), a.id]))

    const rows: InvRow[] = crudas.map(r => {
      const sku     = String(r.sku ?? '').trim()
      const found   = products.find(p => p.sku === sku)
      const codigo  = String(r.almacenCodigo ?? '').trim()
      return {
        sku,
        nombre:        String(r.nombre ?? '') || found?.name || sku,
        quantity:      Number(r.existencia ?? 0),
        unitCost:      Number(r.costo ?? 0),
        productId:     found?.id,
        almacenCodigo: codigo || undefined,
        warehouseId:   codigo ? porCodigo.get(codigo.toUpperCase()) : undefined,
      }
    })
    // Esta carga registra el SALDO: una fila sin existencia no tiene nada que
    // registrar. Antes se descartaba en silencio y el usuario no sabía por qué
    // el total no cuadraba con su archivo.
    const conSaldo = rows.filter(r => r.sku && r.quantity > 0)
    setSinExistencia(rows.length - conSaldo.length)

    const almacenDesconocido = conSaldo.filter(r => r.almacenCodigo && !r.warehouseId)
    if (almacenDesconocido.length > 0) {
      message.warning(
        `${almacenDesconocido.length} fila(s) traen un almacén que no existe ` +
        `(${[...new Set(almacenDesconocido.map(r => r.almacenCodigo))].join(', ')}). ` +
        'Se usará el almacén destino de la pantalla para esas filas.',
        8,
      )
    }

    if (!conSaldo.length) {
      message.warning(
        'El archivo se leyó, pero ninguna fila trae existencia mayor que cero. ' +
        'Esta carga registra el SALDO: los artículos se crean en Inventario › Artículos.',
      )
      return false
    }
    setState({ step: 1, rows: conSaldo })
    return false
  }

  const handleImport = async () => {
    if (!fechaMigracion) { message.error('Selecciona la fecha de migración'); return }
    setLoading(true)
    try {
      const items: SaldoInicialInventarioItem[] = state.rows.map(r => ({
        sku:         r.sku,
        productId:   r.productId,
        quantity:    r.quantity,
        unitCost:    r.unitCost,
        warehouseId: r.warehouseId ?? warehouseId,
      }))
      const result = await importSaldosInicialesInventario({
        fecha: fechaMigracion.format('YYYY-MM-DD'),
        defaultWarehouseId: warehouseId,
        items,
      })
      setState(s => ({ ...s, step: 2, result }))
      message.success(`Saldos de inventario cargados: ${result.created} artículos`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  /** Cómo se le enseña cada tipo de dato al usuario. */
  const ETIQUETA_TIPO: Record<string, { label: string; color: string }> = {
    texto:  { label: 'Texto',     color: 'default' },
    moneda: { label: 'Moneda Q',  color: 'green'   },
    numero: { label: 'Número',    color: 'blue'    },
    si_no:  { label: 'Sí / No',   color: 'purple'  },
    opcion: { label: 'Lista fija', color: 'orange' },
  }

  const previewCols: ColumnType<InvRow>[] = [
    { title: 'SKU',           dataIndex: 'sku',      width: 110 },
    { title: 'Nombre',        dataIndex: 'nombre',   ellipsis: true },
    { title: 'Encontrado',    dataIndex: 'productId', width: 100,
      render: (v?: string) => v
        ? <Tag color="success">✓ Existe</Tag>
        : <Tag color="error">No encontrado</Tag> },
    { title: 'Cantidad',  dataIndex: 'quantity',  width: 100, align: 'right' as const,
      render: (v: number) => v.toLocaleString('es-GT') },
    { title: 'Costo Unit.', dataIndex: 'unitCost', width: 110, align: 'right' as const,
      render: (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` },
    { title: 'Total', width: 120, align: 'right' as const,
      render: (_: any, r: InvRow) => `Q ${(r.quantity * r.unitCost).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` },
  ]

  const totalValor = state.rows.reduce((s, r) => s + r.quantity * r.unitCost, 0)
  const notFound   = state.rows.filter(r => !r.productId).length

  return (
    <div style={{ padding: '12px 0' }}>
      <Steps size="small" current={state.step} style={{ marginBottom: 20 }} items={[
        { title: 'Subir CSV' },
        { title: 'Revisar' },
        { title: 'Completado' },
      ]} />

      {state.step === 0 && (
        <Spin spinning={dataLoading}>
          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Almacén destino</Text>
            <Select
              placeholder="Selecciona almacén (opcional)"
              style={{ width: 280 }}
              allowClear
              value={warehouseId}
              onChange={setWarehouseId}
              onFocus={loadData}
              options={almacenes.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              Solo para las filas que no traigan almacén en el archivo. La columna
              <Text code style={{ fontSize: 11 }}>almacen</Text> manda sobre esta selección.
            </Text>
          </div>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              style={{ background: '#1B3A6B' }}
              loading={dataLoading}
              onClick={descargarPlantillaExcel}
            >
              Descargar plantilla Excel
            </Button>
            <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={handleFile}>
              <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
                Subir archivo Excel
              </Button>
            </Upload>
          </Space>
          <div style={{ marginTop: 12 }}>
            <Alert
              type="info" showIcon
              message="Formato del archivo"
              description={
                <div style={{ fontSize: 12 }}>
                  La plantilla Excel lleva las columnas de las tres pestañas del artículo.
                  Para el saldo bastan <code>sku</code>, <code>existencia_actual</code> y{' '}
                  <code>precio_compra</code>; las que no use puede borrarlas.<br />
                  El SKU debe coincidir con el código del artículo ya creado en el sistema.
                  Si el archivo trae la columna <code>almacen</code>, esa decide; si no, se usa
                  el almacén destino de arriba.
                </div>
              }
            />
          </div>
        </Spin>
      )}

      {state.step === 1 && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <Text strong>{state.rows.length} artículos</Text>
              {notFound > 0 && <Tag color="orange">⚠ {notFound} SKU no encontrados (serán omitidos)</Tag>}
              <Tag color="blue">Valor total: Q {totalValor.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Tag>
            </Space>
            <Space>
              <Button onClick={() => setState({ step: 0, rows: [] })}>Cancelar</Button>
              <Popconfirm
                title={`¿Cargar saldos iniciales de ${state.rows.length} artículos?`}
                description="Se creará un ajuste tipo 'apertura' y se actualizará el stock de cada artículo."
                onConfirm={handleImport}
                okText="Importar"
                okButtonProps={{ style: { background: '#1B3A6B' } }}
              >
                <Button type="primary" icon={<ArrowRightOutlined />} loading={loading}
                  style={{ background: '#1B3A6B' }}>
                  Confirmar carga
                </Button>
              </Popconfirm>
            </Space>
          </div>
          {/*
            * Qué leyó del archivo. Sin esto el usuario sube a ciegas y solo se
            * entera al final, con un «SKU no encontrado» que no dice qué
            * columna se leyó mal ni qué dato no se estaba leyendo.
            */}
          {analisis && (
            <Collapse
              size="small"
              /* Abierto de entrada: plegado, el usuario no ve qué se leyó del
                 archivo y vuelve a cargar a ciegas. */
              defaultActiveKey={['cols']}
              style={{ marginBottom: 12 }}
              items={[{
                key: 'cols',
                label: (
                  <Space size={6}>
                    <Text strong style={{ fontSize: 13 }}>Qué leyó Lucía de tu archivo</Text>
                    <Tag color="blue">{analisis.filas} filas</Tag>
                    <Tag color="success">{analisis.columnas.filter(c => c.reconocida).length} columnas reconocidas</Tag>
                    {analisis.columnas.some(c => c.problema) && (
                      <Tag color="error">
                        {analisis.columnas.filter(c => c.problema).length} con datos que no cuadran
                      </Tag>
                    )}
                  </Space>
                ),
                children: (
                  <Table
                    dataSource={analisis.columnas}
                    rowKey="encabezado"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content', y: 320 }}
                    columns={[
                      { title: 'Columna del archivo', dataIndex: 'encabezado', width: 190, ellipsis: true },
                      { title: 'Campo en Lucía', dataIndex: 'titulo', width: 170,
                        render: (v?: string, r?: any) => v
                          ? <Text style={{ fontSize: 12 }}>{v}</Text>
                          : <Tooltip title={`Lucía no conoce la columna «${r.encabezado}»: se va a ignorar. No es un error si no hace falta.`}>
                              <Tag color="default" style={{ fontSize: 11 }}>No se usa</Tag>
                            </Tooltip> },
                      { title: 'Tipo', dataIndex: 'tipo', width: 110,
                        render: (v: string) => <Tag style={{ fontSize: 11 }} color={ETIQUETA_TIPO[v]?.color}>
                          {ETIQUETA_TIPO[v]?.label ?? v}</Tag> },
                      { title: 'Ejemplo del archivo', dataIndex: 'ejemplo', width: 200, ellipsis: true,
                        render: (v: string, r: any) => v
                          ? <Text style={{ fontSize: 12 }} code>{v}</Text>
                          : r.reconocida
                            ? <Text type="secondary" style={{ fontSize: 11 }}>— vacía en todas las filas —</Text>
                            : <Text type="secondary" style={{ fontSize: 11 }}>—</Text> },
                      { title: 'Estado', width: 300,
                        render: (_: any, r: any) => r.problema
                          ? <Text type="danger" style={{ fontSize: 12 }}>⚠ {r.problema}</Text>
                          : !r.reconocida
                            ? <Text type="secondary" style={{ fontSize: 12 }}>Se ignora</Text>
                            : r.vacia
                              ? <Text type="warning" style={{ fontSize: 12 }}>No va a llenar nada</Text>
                              : <Text type="success" style={{ fontSize: 12 }}>✓ Se está llenando</Text> },
                    ]}
                  />
                ),
              }]}
            />
          )}

          {analisis && analisis.faltantes.length > 0 && (
            <Alert
              type="warning" showIcon style={{ marginBottom: 12 }}
              message={`Tu archivo no trae: ${analisis.faltantes.join(', ')}`}
              description="Son columnas obligatorias de la plantilla. Descárgala arriba y usa sus encabezados."
            />
          )}

          {sinExistencia > 0 && (
            <Alert
              type="info" showIcon style={{ marginBottom: 12 }}
              message={`${sinExistencia} fila(s) del archivo no traen existencia y no se van a cargar`}
              description="Esta carga registra el SALDO del inventario: una fila sin cantidad no tiene saldo que registrar."
            />
          )}

          {/*
            * El error que veía el dueño era «SKU no encontrado» al final de la
            * carga, sin decir qué hacer. Esta carga NO crea artículos: los
            * actualiza. Si el artículo no existe todavía, el camino es la carga
            * de inventario, que crea el artículo y su saldo en un solo paso.
            */}
          {notFound > 0 && (
            <Alert
              type="error" showIcon style={{ marginBottom: 12 }}
              message={`${notFound} de ${state.rows.length} artículos no existen todavía en Lucía`}
              description={
                <div style={{ fontSize: 12 }}>
                  <div>
                    Esta carga registra el <strong>saldo</strong> de artículos que ya están creados;
                    no crea artículos. Los que no existen se van a omitir.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Para crearlos y cargarles su saldo en un solo paso, usa
                    <strong> Inventario › Cargar inventario</strong> con este mismo archivo.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    SKU que no existen: <Text code>{state.rows.filter(r => !r.productId)
                      .slice(0, 8).map(r => r.sku).join(', ')}</Text>
                    {notFound > 8 && <Text type="secondary"> y {notFound - 8} más</Text>}
                  </div>
                </div>
              }
            />
          )}

          <Table
            dataSource={state.rows}
            columns={previewCols}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            rowClassName={r => !r.productId ? 'ant-table-row-danger' : ''}
          />
        </div>
      )}

      {state.step === 2 && state.result && (
        <div>
          <Alert
            type="success" showIcon icon={<CheckCircleOutlined />}
            message="Saldos iniciales de inventario cargados"
            description={
              <div>
                <div>✅ Artículos actualizados: <strong>{state.result.created}</strong></div>
                <div>📋 Ajuste creado (ID: <code>{state.result.ajusteId.slice(0, 8)}…</code>)</div>
                {state.result.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="danger"><WarningOutlined /> {state.result.errors.length} errores:</Text>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                      {state.result.errors.map((e: string, i: number) => <li key={i} style={{ fontSize: 12 }}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    El ajuste está disponible en Inventario → Ajustes (tipo: Apertura)
                  </Text>
                </div>
              </div>
            }
            style={{ marginBottom: 12 }}
          />
          <Button onClick={() => setState({ step: 0, rows: [] })}>Nueva carga</Button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CargasInicialesPage() {
  const [fechaMigracion, setFechaMigracion] = useState<Dayjs | null>(null)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Cargas Iniciales</Title>
        <Text type="secondary">
          Migración de datos maestros y saldos de apertura. Carga clientes, proveedores y saldos contables de tu sistema anterior.
        </Text>
      </div>

      {/* Fecha de migración — aplica a todas las secciones */}
      <div style={{
        padding: '14px 18px', borderRadius: 10, marginBottom: 24,
        background: '#f8faff', border: '1px solid #dbe4f0',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <Text strong style={{ fontSize: 14 }}>Fecha de migración</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            Fecha de corte del sistema anterior. Se usará como fecha de saldo inicial.
          </Text>
        </div>
        <DatePicker
          value={fechaMigracion}
          onChange={setFechaMigracion}
          format="DD/MM/YYYY"
          placeholder="Selecciona fecha de corte"
          style={{ width: 200 }}
        />
        {!fechaMigracion && (
          <Tag color="orange" icon={<WarningOutlined />}>
            Selecciona la fecha antes de importar
          </Tag>
        )}
        {fechaMigracion && (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Fecha: {fechaMigracion.format('DD/MM/YYYY')}
          </Tag>
        )}
      </div>

      <Collapse
        defaultActiveKey={[]}
        accordion={false}
        style={{ background: 'transparent' }}
        items={[
          {
            key: 'clientes',
            label: (
              <Space>
                <TeamOutlined style={{ color: '#1faec2' }} />
                <Text strong>Cuentas por Cobrar — Clientes</Text>
                <Tag color="blue">CxC</Tag>
              </Space>
            ),
            children: <EntityImportSection type="clientes" fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'proveedores',
            label: (
              <Space>
                <ShopOutlined style={{ color: '#f59e0b' }} />
                <Text strong>Cuentas por Pagar — Proveedores</Text>
                <Tag color="orange">CxP</Tag>
              </Space>
            ),
            children: <EntityImportSection type="proveedores" fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'cuentas',
            label: (
              <Space>
                <AuditOutlined style={{ color: '#1B3A6B' }} />
                <Text strong>Saldos de Cuentas de Mayor</Text>
                <Tag color="geekblue">Apertura contable</Tag>
              </Space>
            ),
            children: <SaldosCuentasSection fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'activos-fijos',
            label: (
              <Space>
                <HomeOutlined style={{ color: '#6b7280' }} />
                <Text strong>Activos Fijos</Text>
                <Tag>Importación CSV</Tag>
              </Space>
            ),
            children: (
              <div style={{ padding: '12px 0' }}>
                <Alert
                  type="info"
                  showIcon
                  message="Importación de Activos Fijos"
                  description={
                    <div>
                      La carga masiva de activos fijos se gestiona directamente desde el módulo
                      <strong> Activos Fijos</strong>, que incluye plantilla CSV, previsualización
                      y generación de póliza de apertura.
                      <div style={{ marginTop: 8 }}>
                        <Button
                          type="primary"
                          icon={<FileExcelOutlined />}
                          href="/contabilidad/activos-fijos"
                          style={{ background: '#1B3A6B' }}
                        >
                          Ir a Activos Fijos
                        </Button>
                      </div>
                    </div>
                  }
                />
              </div>
            ),
          },
          {
            key: 'inventario',
            label: (
              <Space>
                <FileExcelOutlined style={{ color: '#2ea172' }} />
                <Text strong>Inventario</Text>
                <Tag color="green">Saldos iniciales</Tag>
              </Space>
            ),
            children: <InventarioSection fechaMigracion={fechaMigracion} />,
          },
        ]}
      />
    </div>
  )
}
