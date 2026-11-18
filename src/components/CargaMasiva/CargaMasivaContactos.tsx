import { useState } from 'react'
import {
  Alert, Button, Modal, Space, Table, Tooltip, Typography, Upload, message,
} from 'antd'
import { FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  batchImportClientes, batchImportProveedores, getCustomers, getVendors,
  type BatchImportRow,
} from '../../api/contactos'
import { getAccounts, type Account } from '../../api/catalogo'
import { getTaxes } from '../../api/impuestos'
import { analizarArchivo, leerFilas } from '../../pages/configuracion/plantillaCarga'
import { filasDeContactos } from '../../pages/configuracion/filasDeContactos'
import {
  construirPlantillaClientes, COLUMNAS_CLIENTES, ESPECIFICACION_CLIENTES,
} from '../../pages/configuracion/plantillaClientes'
import {
  construirPlantillaProveedores, COLUMNAS_PROVEEDORES, ESPECIFICACION_PROVEEDORES,
} from '../../pages/configuracion/plantillaProveedores'
import { ESPECIFICACION_SALDOS } from '../../pages/configuracion/plantillaSaldosPendientes'
import { revisarContactos, type RevisionDeContactos } from './revisarContactos'

const { Text } = Typography

const fmt = (n: number) => Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })

/**
 * La tasa del contacto: una sola, o el rango cuando cada factura trae la suya.
 *
 * Es el dato que el contador cuadra contra su balance anterior, así que se
 * muestra con sus seis decimales, no redondeada.
 */
const tasa = (d: { tasaMin: number; tasaMax: number }) =>
  d.tasaMin === d.tasaMax
    ? d.tasaMin.toFixed(6)
    : `${d.tasaMin.toFixed(6)} – ${d.tasaMax.toFixed(6)}`

/**
 * Bajar y subir contactos en masa, desde su propia pantalla.
 *
 * La carga ya existía en Configuración › Cargas Iniciales, pensada para el
 * arranque. Pero corregir en masa lo que YA está cargado —ponerle la cuenta
 * por pagar a sesenta proveedores, arreglar NIT, cambiar términos de pago— es
 * trabajo de todos los días y se hace mirando la lista, no la configuración.
 *
 * Por eso la plantilla que se baja de aquí viene CON los contactos actuales:
 * se edita en Excel y se vuelve a subir. Lo que se escribe es exactamente lo
 * que la carga lee, así que el viaje de ida y vuelta no pierde nada.
 *
 * La carga de Cargas Iniciales sigue donde estaba: esta no la reemplaza,
 * reutiliza la misma plantilla y el mismo importador.
 */
export default function CargaMasivaContactos({ tipo, onImportado }: {
  tipo: 'proveedores' | 'clientes'
  onImportado?: () => void
}) {
  const [bajando, setBajando]   = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [abierto, setAbierto]   = useState(false)
  const [filas, setFilas]       = useState<BatchImportRow[]>([])
  const [documentos, setDocumentos] = useState<Array<Record<string, unknown>>>([])
  const [faltantes, setFaltantes]   = useState<string[]>([])
  const [revision, setRevision]     = useState<RevisionDeContactos | null>(null)

  const esProveedor = tipo === 'proveedores'
  const titulo      = esProveedor ? 'proveedores' : 'clientes'
  const columnas    = esProveedor ? COLUMNAS_PROVEEDORES : COLUMNAS_CLIENTES
  const spec        = esProveedor ? ESPECIFICACION_PROVEEDORES : ESPECIFICACION_CLIENTES

  /** Las listas de la empresa: sin ellas la plantilla no puede traducir ids a códigos. */
  const catalogos = async () => {
    const [cuentas, impuestos] = await Promise.all([
      getAccounts({ activas: true }).catch(() => [] as Account[]),
      getTaxes().catch(() => [] as any[]),
    ])
    return {
      cuentas:   (cuentas ?? []).map((c: any) => ({ id: c.id, code: c.code, name: c.name, type: c.type })),
      impuestos: (impuestos ?? []).map((i: any) => ({ id: i.id, code: i.code, name: i.name, rate: i.rate })),
      monedas:   ['GTQ', 'USD'],
    }
  }

  const descargar = async () => {
    setBajando(true)
    try {
      const catalogo = await catalogos()
      // Todos, no la página que está a la vista: la plantilla es para
      // trabajar sobre la cartera completa.
      const res = await (esProveedor
        ? getVendors({ limit: 5000 })
        : getCustomers({ limit: 5000 }))
      const actuales: any[] = res?.data ?? res ?? []

      const filasActuales = filasDeContactos(columnas, actuales, {
        campoCuenta:        esProveedor ? 'payableAccountId'  : 'receivableAccountId',
        campoContrapartida: esProveedor ? 'expenseAccountId'  : 'incomeAccountId',
        catalogo,
      })

      const datos = esProveedor
        ? construirPlantillaProveedores(catalogo, filasActuales)
        : construirPlantillaClientes(catalogo, filasActuales)

      const url = URL.createObjectURL(new Blob([datos],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${esProveedor ? 'Proveedores' : 'Clientes'} ${dayjs().format('DD-MM-YYYY')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      message.success(actuales.length
        ? `${actuales.length} ${titulo} en la plantilla`
        : `Plantilla en blanco: todavía no hay ${titulo}`)
    } catch {
      message.error('No se pudo generar la plantilla')
    } finally { setBajando(false) }
  }

  const leerArchivo = async (file: File) => {
    try {
      const datos = await file.arrayBuffer()
      const analisis = analizarArchivo(datos, spec)
      const leidas = leerFilas(datos, spec).filter(f => String(f.nombre ?? '').trim())

      if (!leidas.length) {
        message.error('El archivo no trae ninguna fila con nombre.')
        return false
      }

      /**
       * La hoja de saldos pendientes es opcional: un contacto puede venir con
       * su saldo suelto. Que no esté no puede tumbar la carga.
       */
      let pendientes: Array<Record<string, unknown>> = []
      try {
        pendientes = leerFilas(datos, ESPECIFICACION_SALDOS)
          .filter(f => String(f.nit ?? '').trim() && Number(f.monto ?? 0))
      } catch { pendientes = [] }

      /**
       * Lo que va a pasar, dicho antes de que pase: la carga reconoce a los
       * que ya existen POR SU NIT, y sin NIT crea uno nuevo por fila. Un
       * archivo sin NIT y con el mismo proveedor repetido entra «sin errores»
       * y deja la cartera con once copias, cada una con un pedazo del saldo.
       */
      const actuales = await (esProveedor
        ? getVendors({ limit: 5000 })
        : getCustomers({ limit: 5000 })).catch(() => null)

      setFilas(leidas as unknown as BatchImportRow[])
      setDocumentos(pendientes)
      setFaltantes(analisis.faltantes)
      setRevision(revisarContactos(leidas, (actuales as any)?.data ?? actuales ?? [], pendientes))
      setAbierto(true)
    } catch {
      message.error('No se pudo leer el archivo. ¿Es el Excel de la plantilla?')
    }
    return false
  }

  const importar = async () => {
    setSubiendo(true)
    try {
      const fn = esProveedor ? batchImportProveedores : batchImportClientes
      const r = await fn(filas, undefined, documentos)
      message.success(`${r.created} creados, ${r.updated} actualizados`)
      if (r.errors?.length) {
        Modal.warning({
          title: 'Algunas filas no entraron',
          content: <ul style={{ paddingLeft: 18 }}>{r.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>,
          width: 620,
        })
      }
      setAbierto(false)
      onImportado?.()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al importar')
    } finally { setSubiendo(false) }
  }

  return (
    <>
      <Tooltip title={`Baja los ${titulo} actuales con todos sus datos, en el formato de carga`}>
        <Button icon={<FileExcelOutlined />} loading={bajando} onClick={descargar}>
          Descargar plantilla
        </Button>
      </Tooltip>

      <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={leerArchivo}>
        <Tooltip title={`Crea y actualiza ${titulo} desde la plantilla`}>
          <Button icon={<UploadOutlined />}>Carga masiva</Button>
        </Tooltip>
      </Upload>

      <Modal
        open={abierto}
        title={`Revisar la carga de ${titulo}`}
        onCancel={() => setAbierto(false)}
        width={820}
        okText={`Importar ${filas.length}`}
        okButtonProps={{ loading: subiendo, disabled: !!faltantes.length, style: { background: '#1B3A6B' } }}
        onOk={importar}
      >
        {faltantes.length ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message={`Falta la columna obligatoria: ${faltantes.join(', ')}`}
            description="Sin ella no se puede crear el registro." />
        ) : null}

        {/* La regla de la carga, dicha en voz alta: reconoce por NIT. */}
        {revision && revision.sinNit > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message={`${revision.sinNit} de ${revision.total} filas vienen sin NIT`}
            description="A los que ya existen se les reconoce por el NIT. Sin él, cada fila crea un contacto nuevo aunque el nombre coincida con uno ya cargado." />
        )}

        {revision?.repetidos.length ? (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message={`${revision.repetidos.length} nombre(s) aparecen en varias filas`}
            description={
              <>
                <div style={{ marginBottom: 6 }}>
                  Se crearía <strong>un contacto por fila</strong>, cada uno con su pedazo del saldo.
                  Para varias facturas de un mismo contacto va una sola fila aquí y una fila por
                  factura en la hoja «Saldos pendientes».
                </div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {revision.repetidos.slice(0, 6).map(r => (
                    <li key={r.nombre}>
                      <strong>{r.nombre}</strong> — {r.veces} filas
                      {r.suma ? ` · suman Q ${r.suma.toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : ''}
                    </li>
                  ))}
                  {revision.repetidos.length > 6 && <li>y {revision.repetidos.length - 6} más…</li>}
                </ul>
              </>
            } />
        ) : null}

        {revision?.yaExisten.length ? (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${revision.yaExisten.length} ya está(n) en el sistema`}
            description={
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {revision.yaExisten.slice(0, 6).map(c => (
                  <li key={c.nombre}>
                    <strong>{c.nombre}</strong>{c.numero ? ` (${c.numero})` : ''} —{' '}
                    {c.porNit ? 'mismo NIT: se actualiza' : 'mismo nombre, pero sin NIT: se crearía duplicado'}
                  </li>
                ))}
                {revision.yaExisten.length > 6 && <li>y {revision.yaExisten.length - 6} más…</li>}
              </ul>
            } />
        ) : null}

        {revision?.conSaldo ? (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${revision.conSaldo} con saldo inicial — Q ${revision.sumaDeSaldos.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
            description="Entra como una póliza de apertura contra la cuenta por pagar de cada contacto." />
        ) : null}

        {revision?.documentos ? (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${revision.documentos} documento(s) pendientes — Q ${fmt(revision.documentosEnQuetzales)}`}
            description="El saldo de cada contacto sale de sumar sus documentos convertidos con la tasa de cada uno, no con un promedio." />
        ) : null}

        {/* Sin tasa no se cargan: a 1 × 1 la cartera entraría por una séptima parte. */}
        {revision?.documentosSinTasa ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message={`${revision.documentosSinTasa} documento(s) en moneda extranjera sin tipo de cambio`}
            description="Esos no se van a cargar. Escribí en la hoja «Saldos pendientes» la tasa con la que se registró cada uno." />
        ) : null}

        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Los que ya existan con el mismo NIT se actualizan; el resto se crea.
        </Text>

        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={filas}
          pagination={{ pageSize: 8, size: 'small' }}
          scroll={{ x: 700 }}
          columns={[
            { title: 'Nombre', dataIndex: 'nombre', width: 220 },
            { title: 'NIT', dataIndex: 'nit', width: 110 },
            { title: 'Email', dataIndex: 'email', width: 180 },
            { title: esProveedor ? 'Cuenta por pagar' : 'Cuenta por cobrar',
              dataIndex: esProveedor ? 'cuenta_contacto' : 'cuenta_por_cobrar', width: 130,
              render: (v: string) => v || <Text type="secondary">—</Text> },
            /**
             * El saldo que de verdad va a entrar.
             *
             * Si el contacto trae documentos en la hoja «Saldos pendientes»,
             * mandan ellos y la columna `saldo_inicial` va vacía — así que
             * mostrar esa columna a secas ponía «—» en un contacto que sí
             * traía saldo. Aquí se ve en su moneda, a qué tasa y en quetzales.
             */
            { title: 'Saldo inicial', dataIndex: 'saldo_inicial', width: 210,
              render: (v: number, fila: BatchImportRow) => {
                const doc = revision?.porDocumentos[String(fila.nit ?? '').trim()]
                if (doc) return (
                  <div style={{ lineHeight: 1.35 }}>
                    <div>
                      {doc.moneda !== 'GTQ' && doc.moneda !== 'MIXTA' && (
                        <Text>{doc.moneda} {fmt(doc.monto)} <Text type="secondary">→</Text> </Text>
                      )}
                      <Text strong>Q {fmt(doc.enQuetzales)}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {doc.documentos} doc.
                      {doc.moneda === 'GTQ' ? '' : ` · TC ${tasa(doc)}`}
                      {doc.moneda === 'MIXTA' ? ' · monedas mezcladas' : ''}
                    </Text>
                  </div>
                )
                return v != null
                  ? `Q ${fmt(v)}`
                  : <Text type="secondary">—</Text>
              } },
          ]}
        />
      </Modal>
    </>
  )
}
