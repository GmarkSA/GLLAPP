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
import {
  getAccounts, setSaldosApertura, importarCatalogo,
  type Account, type SaldoAperturaLinea, type ImportarCatalogoResult,
} from '../../api/catalogo'
import { getProducts, importSaldosInicialesInventario, cargaMasivaArticulos, type Product, type SaldoInicialInventarioItem, type SaldoInicialInventarioResult } from '../../api/inventario'
import { getAlmacenes, getGrupos, type Almacen, type GrupoArticulo } from '../../api/expedientes'
import { getTaxes } from '../../api/impuestos'
import { getBankAccounts, type BankAccount } from '../../api/bancos'
import {
  construirPlantillaInventario, leerArchivoDeArticulos, analizarArchivoDeArticulos,
  type AnalisisDelArchivo, type FilaDeArticulo,
} from './plantillaInventario'
import {
  construirPlantillaClientes, ESPECIFICACION_CLIENTES,
} from './plantillaClientes'
import {
  construirPlantillaProveedores, ESPECIFICACION_PROVEEDORES,
} from './plantillaProveedores'
import {
  construirPlantillaCuentas, ESPECIFICACION_CUENTAS,
} from './plantillaCuentas'
import { ESPECIFICACION_SALDOS } from './plantillaSaldosPendientes'
import { analizarArchivo, leerFilas, etiquetaDeTipo, type AnalisisDelArchivo as Revision } from './plantillaCarga'

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


/**
 * Qué entendió Lucía del archivo, antes de cargar nada.
 *
 * Sin esto el usuario sube el archivo a ciegas y solo se entera de lo que
 * falló cuando la carga terminó. Aquí ve columna por columna: cuál reconoció,
 * de qué tipo la espera, con qué valor del propio archivo, y qué no cuadra.
 */
const COLOR_DE_TIPO: Record<string, string> = {
  texto: 'default', moneda: 'green', numero: 'blue',
  si_no: 'purple', opcion: 'orange', fecha: 'cyan',
}

function PanelDeRevision({ revision }: { revision: Revision }) {
  const conProblema = revision.columnas.filter(c => c.problema).length
  const sinUsar     = revision.columnas.filter(c => !c.reconocida).length

  return (
    <Collapse size="small" style={{ marginBottom: 12 }} defaultActiveKey={conProblema ? ['r'] : []}
      items={[{
        key: 'r',
        label: (
          <Space size={6} wrap>
            <Text strong style={{ fontSize: 13 }}>
              Qué leyó Lucía: {revision.columnas.length} columnas, {revision.filas} filas
            </Text>
            {conProblema > 0 && <Tag color="error" style={{ fontSize: 11 }}>{conProblema} con problema</Tag>}
            {sinUsar > 0 && <Tag color="default" style={{ fontSize: 11 }}>{sinUsar} sin usar</Tag>}
          </Space>
        ),
        children: (
          <Table
            dataSource={revision.columnas}
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
              { title: 'Tipo', dataIndex: 'tipo', width: 150,
                render: (v: string) => <Tag style={{ fontSize: 11 }} color={COLOR_DE_TIPO[v]}>
                  {etiquetaDeTipo(v as any)}</Tag> },
              { title: 'Ejemplo del archivo', dataIndex: 'ejemplo', width: 200, ellipsis: true,
                render: (v: string, r: any) => v
                  ? <Text style={{ fontSize: 12 }} code>{v}</Text>
                  : r.reconocida
                    ? <Text type="secondary" style={{ fontSize: 11 }}>— vacía en todas las filas —</Text>
                    : <Text type="secondary" style={{ fontSize: 11 }}>—</Text> },
              { title: 'Estado', width: 300,
                render: (_: any, r: any) => r.problema
                  ? <Text type="danger" style={{ fontSize: 12 }}>⚠ {r.problema}</Text>
                  : r.reconocida
                    ? <Text type="success" style={{ fontSize: 12 }}>Se va a cargar</Text>
                    : <Text type="secondary" style={{ fontSize: 12 }}>Se ignora</Text> },
            ]}
          />
        ),
      }]}
    />
  )
}

// ─── Clientes / Proveedores CSV section ──────────────────────────────────────


interface EntityStep {
  step: number
  rows: BatchImportRow[]
  /** Lo que Lucía entendió del Excel, para enseñarlo antes de cargar. */
  revision?: Revision
  /** Los documentos pendientes de la segunda hoja, cada uno con su tasa. */
  documentos?: Array<Record<string, unknown>>
  result?: { created: number; updated: number; errors: string[]; avisos?: string[] }
}

function EntityImportSection({
  type, fechaMigracion,
}: { type: 'clientes' | 'proveedores'; fechaMigracion: Dayjs | null }) {
  const label   = type === 'clientes' ? 'Clientes (CxC)' : 'Proveedores (CxP)'
  const [state, setState] = useState<EntityStep>({ step: 0, rows: [] })
  const [loading, setLoading] = useState(false)

  /**
   * El Excel de la plantilla nueva, que lleva los campos de toda la pantalla.
   *
   * El CSV de siempre sigue funcionando: un archivo viejo tiene que seguir
   * cargando. Lo que cambia es que ahora hay un camino que no obliga a
   * completar a mano el tratamiento fiscal, la cuenta por cobrar y los
   * términos de pago de cada cliente después de cargar.
   */
  const descargarPlantillaExcel = async () => {
    setLoading(true)
    try {
      const [cuentas, impuestos] = await Promise.all([
        getAccounts({ activas: true }).catch(() => [] as Account[]),
        getTaxes().catch(() => [] as any[]),
      ])
      const listas = {
        cuentas:   (cuentas ?? []).map((c: any) => ({ code: c.code, name: c.name, type: c.type })),
        impuestos: (impuestos ?? []).map((i: any) => ({ code: i.code, name: i.name, rate: i.rate })),
        monedas:   ['GTQ', 'USD'],
      }
      const datos = type === 'clientes'
        ? construirPlantillaClientes(listas)
        : construirPlantillaProveedores(listas)
      const url = URL.createObjectURL(
        new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url; a.download = `Plantilla carga de ${type}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('No se pudo generar la plantilla')
    } finally { setLoading(false) }
  }

  const handleExcel = async (file: File) => {
    try {
      const datos = await file.arrayBuffer()
      const spec = type === 'clientes' ? ESPECIFICACION_CLIENTES : ESPECIFICACION_PROVEEDORES
      const revision = analizarArchivo(datos, spec)
      const filas = leerFilas(datos, spec)
        .filter(f => String(f.nombre ?? '').trim())

      if (!filas.length) {
        message.error('El archivo no trae ninguna fila con nombre.')
        return false
      }

      /**
       * La segunda hoja: los documentos pendientes, cada uno con su tipo de
       * cambio. Es opcional —si el archivo no la trae, el contacto puede venir
       * con su saldo suelto— así que leerla no puede tumbar la carga.
       */
      let documentos: Array<Record<string, unknown>> = []
      try {
        documentos = leerFilas(datos, ESPECIFICACION_SALDOS)
          .filter(f => String(f.nit ?? '').trim() && Number(f.monto ?? 0))
      } catch { documentos = [] }

      setState({ step: 1, rows: filas as unknown as BatchImportRow[], revision, documentos })
    } catch {
      message.error('No se pudo leer el archivo. ¿Es el Excel de la plantilla?')
    }
    return false
  }

  const handleImport = async () => {
    setLoading(true)
    try {
      const fn = type === 'clientes' ? batchImportClientes : batchImportProveedores
      const result = await fn(state.rows, fechaMigracion?.format('YYYY-MM-DD'), state.documentos)
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
          <Button icon={<FileExcelOutlined />} loading={loading} onClick={descargarPlantillaExcel}>
            Descargar plantilla Excel
          </Button>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleExcel}>
            <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
              Subir archivo Excel
            </Button>
          </Upload>
        </div>
      )}

      {state.step === 1 && (
        <div>
          {state.revision && <PanelDeRevision revision={state.revision} />}
          {state.documentos?.length ? (
            <Alert type="info" showIcon style={{ marginBottom: 12 }}
              message={`${state.documentos.length} documento(s) pendientes, cada uno con su tipo de cambio`}
              description="El saldo de cada contacto sale de sumar sus documentos convertidos con la tasa de cada uno, no con un promedio." />
          ) : null}
          {state.revision?.faltantes.length ? (
            <Alert type="error" showIcon style={{ marginBottom: 12 }}
              message={`Falta la columna obligatoria: ${state.revision.faltantes.join(', ')}`}
              description="Sin ella no se puede crear el registro." />
          ) : null}
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
          {state.result.avisos?.length ? (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message={`${state.result.avisos.length} dato(s) que no se pudieron asignar`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                  {state.result.avisos.map((a, i) => <li key={i} style={{ fontSize: 12 }}>{a}</li>)}
                </ul>
              } />
          ) : null}
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

interface AccountRow extends Account {
  _debit: number
  _credit: number
  /**
   * La moneda de la cuenta bancaria enlazada, cuando no es el quetzal.
   *
   * El catálogo no guarda moneda: la que manda es la de la cuenta de banco que
   * cuelga de esa cuenta contable. Si está en dólares, el saldo de apertura
   * necesita su tipo de cambio — sin él la cuenta bancaria queda en cero y el
   * balance entra por una séptima parte de su valor.
   */
  _moneda?: string
  _tipoCambio?: number
}

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

  // ── Crear el catálogo desde la plantilla ──────────────────────────────────
  const [cargando, setCargando]   = useState(false)
  const [revision, setRevision]   = useState<Revision | null>(null)
  const [porCargar, setPorCargar] = useState<Array<Record<string, unknown>>>([])
  const [cargado, setCargado]     = useState<ImportarCatalogoResult | null>(null)

  /**
   * La plantilla se arma con las cuentas que la empresa YA tiene, en su propia
   * hoja: sin eso, para colgar una cuenta nueva de su madre hay que ir a
   * buscar el código a otra pantalla.
   */
  const descargarPlantillaCuentas = async () => {
    setCargando(true)
    try {
      const existentes: Account[] = await getAccounts().catch(() => [])
      const grupos = [...new Set((existentes ?? [])
        .map(c => String(c.groupCode ?? '').trim()).filter(Boolean))].sort()
      const datos = construirPlantillaCuentas({
        existentes: (existentes ?? []).map(c => ({ code: c.code, name: c.name })),
        grupos,
      })
      const url = URL.createObjectURL(
        new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'Plantilla catalogo de cuentas.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('No se pudo generar la plantilla')
    } finally { setCargando(false) }
  }

  const leerCatalogo = async (file: File) => {
    try {
      const datos = await file.arrayBuffer()
      setRevision(analizarArchivo(datos, ESPECIFICACION_CUENTAS))
      const filas = leerFilas(datos, ESPECIFICACION_CUENTAS)
        .filter(f => String(f.codigo ?? '').trim() && String(f.nombre ?? '').trim())
      if (!filas.length) {
        message.error('El archivo no trae ninguna fila con código y nombre.')
        return false
      }
      setPorCargar(filas)
      setCargado(null)
    } catch {
      message.error('No se pudo leer el archivo. ¿Es el Excel de la plantilla?')
    }
    return false
  }

  const cargarCatalogo = async () => {
    setCargando(true)
    try {
      const r = await importarCatalogo(porCargar)
      setCargado(r)
      setPorCargar([]); setRevision(null)
      message.success(`${r.imported} cuenta(s) creada(s), ${r.updated} actualizada(s)`)
      // El catálogo cambió: lo de abajo —los saldos— tiene que releerlo.
      setLoaded(false); setRows([])
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo cargar el catálogo')
    } finally { setCargando(false) }
  }

  const load = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const [accounts, bancos] = await Promise.all([
        getAccounts() as Promise<Account[]>,
        getBankAccounts().catch(() => [] as BankAccount[]),
      ])
      // Qué cuentas del catálogo son, en realidad, cuentas en moneda extranjera.
      const monedaPorCuenta = new Map<string, string>()
      for (const b of bancos ?? []) {
        const moneda = String((b as any).currency ?? 'GTQ').toUpperCase()
        if ((b as any).glAccountId && moneda !== 'GTQ') {
          monedaPorCuenta.set(String((b as any).glAccountId), moneda)
        }
      }
      const filterable = accounts.filter(a => !a.isHeader && a.isActive)
      setRows(filterable.map(a => ({
        ...a, _debit: 0, _credit: 0, _moneda: monedaPorCuenta.get(a.id),
      })))
      setLoaded(true)
    } catch {
      message.error('Error cargando catálogo de cuentas')
    } finally {
      setLoading(false)
    }
  }, [loaded])

  const setDebit  = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: v || 0,  _credit: 0 } : r))
  const setCredit = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: 0, _credit: v || 0 } : r))
  const setTipoCambio = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _tipoCambio: v || undefined } : r))

  /**
   * Una cuenta en moneda extranjera con saldo y sin tipo de cambio no se puede
   * guardar: la cuenta bancaria quedaría en cero y nadie lo notaría hasta
   * conciliar, o peor, hasta intentar revaluar.
   */
  const sinTipoDeCambio = rows.filter(r =>
    r._moneda && (r._debit > 0 || r._credit > 0) && !(Number(r._tipoCambio) > 0))

  const touched     = rows.filter(r => r._debit > 0 || r._credit > 0)
  const totalDebit  = touched.reduce((s, r) => s + r._debit,  0)
  const totalCredit = touched.reduce((s, r) => s + r._credit, 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const handleSave = async () => {
    if (!fechaMigracion) { message.error('Selecciona la fecha de migración'); return }
    if (!touched.length)  { message.error('Ingresa al menos un saldo'); return }
    if (!balanced)        { message.error(`La póliza no cuadra: Debe Q${totalDebit.toFixed(2)}, Haber Q${totalCredit.toFixed(2)}`); return }
    if (sinTipoDeCambio.length) {
      message.error(
        `Falta el tipo de cambio de: ${sinTipoDeCambio.map(r => r.code).join(', ')}. ` +
        'Sin él la cuenta bancaria queda en cero.')
      return
    }

    setSaving(true)
    try {
      const lineas: SaldoAperturaLinea[] = touched.map(r => ({
        accountId: r.id,
        debit:     r._debit,
        credit:    r._credit,
        // Con esto el backend actualiza el saldo de la cuenta bancaria EN SU
        // MONEDA, que es el número que se concilia contra el estado de cuenta.
        ...(r._moneda && Number(r._tipoCambio) > 0
          ? { moneda: r._moneda, tipoCambio: Number(r._tipoCambio) }
          : {}),
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

  /** El saldo en la moneda de la cuenta, a partir de los quetzales y la tasa. */
  const enSuMoneda = (r: AccountRow) => {
    const monto = r._debit || r._credit
    const tc = Number(r._tipoCambio)
    return monto > 0 && tc > 0 ? Math.round((monto / tc) * 100) / 100 : null
  }

  const cols: ColumnType<AccountRow>[] = [
    { title: 'Código', dataIndex: 'code', width: 90 },
    {
      title: 'Cuenta', dataIndex: 'name', ellipsis: true,
      render: (v: string, r: AccountRow) => r._moneda
        ? <Space size={6}>
            <Text>{v}</Text>
            <Tag color="#2ea172" style={{ margin: 0, fontSize: 10 }}>{r._moneda}</Tag>
          </Space>
        : v,
    },
    {
      /**
       * El tipo de cambio solo aparece donde hace falta: en las cuentas que
       * son, en realidad, una cuenta de banco en moneda extranjera. En las
       * demás la columna queda vacía y no estorba.
       */
      title: 'Tipo de cambio', width: 130,
      render: (_: any, r: AccountRow) => r._moneda ? (
        <InputNumber
          value={r._tipoCambio}
          min={0} step={0.000001} precision={6} size="small" style={{ width: '100%' }}
          placeholder="7.663360"
          status={(r._debit > 0 || r._credit > 0) && !(Number(r._tipoCambio) > 0) ? 'error' : undefined}
          onChange={v => setTipoCambio(r.id, Number(v) || 0)}
        />
      ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
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
      /**
       * El equivalente en la moneda de la cuenta, como lo enseña Zoho: se
       * escribe el valor en quetzales y la tasa, y debajo aparece a cuántos
       * dólares corresponde. Es el número que va a quedar en la cuenta
       * bancaria y el que se concilia contra el estado de cuenta.
       */
      title: 'Equivalente', width: 150, align: 'right' as const,
      render: (_: any, r: AccountRow) => {
        const eq = enSuMoneda(r)
        if (!r._moneda) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        if (eq === null) return <Text type="secondary" style={{ fontSize: 11 }}>pon la tasa</Text>
        return (
          <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {r._moneda} {eq.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </Text>
        )
      },
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
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Dos pasos distintos"
        description="Arriba se CREA el catálogo desde la plantilla —códigos, nombres, tipos y los interruptores que hacen que ventas, compras e inventario encuentren sus cuentas—. Abajo se capturan los SALDOS de apertura de las cuentas que ya existen, que generan su póliza."
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Button icon={<FileExcelOutlined />} loading={cargando} onClick={descargarPlantillaCuentas}>
          Descargar plantilla Excel
        </Button>
        <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={leerCatalogo}>
          <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
            Subir catálogo Excel
          </Button>
        </Upload>
      </div>

      {revision && <PanelDeRevision revision={revision} />}
      {revision?.faltantes.length ? (
        <Alert type="error" showIcon style={{ marginBottom: 12 }}
          message={`Falta la columna obligatoria: ${revision.faltantes.join(', ')}`}
          description="Sin código, nombre y tipo no se puede crear la cuenta." />
      ) : null}

      {porCargar.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Text strong>{porCargar.length} cuenta(s) listas para cargar</Text>
          <Popconfirm
            title={`¿Cargar ${porCargar.length} cuenta(s)?`}
            description="Las que ya existan (mismo código) se actualizan."
            onConfirm={cargarCatalogo} okText="Cargar"
            okButtonProps={{ style: { background: '#1B3A6B' } }}
          >
            <Button type="primary" icon={<ArrowRightOutlined />} loading={cargando}
              style={{ background: '#1B3A6B' }}>
              Confirmar carga del catálogo
            </Button>
          </Popconfirm>
          <Button onClick={() => { setPorCargar([]); setRevision(null) }}>Cancelar</Button>
        </div>
      )}

      {cargado && (
        <Alert type="success" showIcon style={{ marginBottom: 16 }}
          message={`${cargado.imported} cuenta(s) creada(s) · ${cargado.updated} actualizada(s)`}
          description={
            <div style={{ fontSize: 12 }}>
              {cargado.avisos?.length > 0 && (
                <ul style={{ margin: '4px 0', paddingLeft: 18, maxHeight: 140, overflowY: 'auto' }}>
                  {cargado.avisos.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
              {cargado.errors?.length > 0 && (
                <ul style={{ margin: '4px 0', paddingLeft: 18, color: '#b00' }}>
                  {cargado.errors.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
          } />
      )}

      {!loaded ? (
        <Button icon={<AuditOutlined />} onClick={load} loading={loading}
          style={{ marginBottom: 16 }}>
          Cargar saldos de las cuentas existentes
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
  /**
   * El archivo completo, con sus 26 columnas. La vista previa solo enseña
   * cuatro, pero para CREAR el artículo hacen falta sus cuentas e impuestos.
   */
  const [filasDelArchivo, setFilasDelArchivo] = useState<FilaDeArticulo[]>([])
  const [articulosCreados, setArticulosCreados] = useState(0)
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
    setFilasDelArchivo([])
    setArticulosCreados(0)

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
      setFilasDelArchivo(crudas as FilaDeArticulo[])
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
      /**
       * El artículo que todavía no existe se CREA, no se omite.
       *
       * Quien sube un archivo de inventario espera que el inventario quede
       * cargado. Decirle «SKU no encontrado» y no hacer nada lo deja con el
       * archivo en la mano y sin camino: tiene las cuentas y el impuesto en
       * ese mismo archivo. Se crean primero y después se les registra el
       * saldo, que es el orden que exige la contabilidad.
       */
      let filas = state.rows
      const faltantes = filas.filter(r => !r.productId)
      if (faltantes.length > 0) {
        const skus = new Set(faltantes.map(r => r.sku.toUpperCase()))
        const aCrear = filasDelArchivo.filter(f => skus.has(String(f.sku ?? '').toUpperCase()))
        if (aCrear.length > 0) {
          const creacion = await cargaMasivaArticulos(aCrear, { almacenId: warehouseId })
          setArticulosCreados(creacion.creados)
          if (creacion.errores?.length > 0) {
            message.warning(
              `${creacion.errores.length} artículo(s) no se pudieron crear: ` +
              creacion.errores.slice(0, 3).map(e => `${e.sku || e.nombre}: ${e.motivo}`).join(' · '),
              12,
            )
          }
          // Releer para resolver el id de los recién creados.
          const frescos = await getProducts({ limit: 500 }).then((r: any) => r?.data ?? r)
          const porSku = new Map((Array.isArray(frescos) ? frescos : [])
            .map((p: any) => [String(p.sku).toUpperCase(), p.id]))
          filas = filas.map(r => r.productId
            ? r
            : { ...r, productId: porSku.get(r.sku.toUpperCase()) as string | undefined })
        }
      }

      const items: SaldoInicialInventarioItem[] = filas.map(r => ({
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
              {notFound > 0 && <Tag color="blue">{notFound} artículo(s) nuevos — se van a crear</Tag>}
              <Tag color="blue">Valor total: Q {totalValor.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Tag>
            </Space>
            <Space>
              <Button onClick={() => setState({ step: 0, rows: [] })}>Cancelar</Button>
              <Popconfirm
                title={`¿Cargar saldos iniciales de ${state.rows.length} artículos?`}
                description={notFound > 0
                  ? `Se crean ${notFound} artículo(s) nuevos y se registra el saldo de los ${state.rows.length}, con su póliza de apertura.`
                  : "Se creará un ajuste tipo 'apertura' y se actualizará el stock de cada artículo."}
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
              type="info" showIcon style={{ marginBottom: 12 }}
              message={`${notFound} de ${state.rows.length} artículos todavía no existen y se van a crear`}
              description={
                <div style={{ fontSize: 12 }}>
                  <div>
                    Se crean con las cuentas, el impuesto y el precio que trae el archivo, y
                    después se les registra su saldo con la póliza de apertura.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Nuevos: <Text code>{state.rows.filter(r => !r.productId)
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
