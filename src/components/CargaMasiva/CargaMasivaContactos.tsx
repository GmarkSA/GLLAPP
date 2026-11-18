import { useState } from 'react'
import {
  Alert, Button, DatePicker, Modal, Space, Table, Tooltip, Typography, Upload, message,
} from 'antd'
import { FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
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

/** Cifras de ancho fijo: en una columna de montos, es lo que deja compararlos. */
const numeros = { fontVariantNumeric: 'tabular-nums' } as const

/**
 * Qué fecha proponer para la póliza de apertura.
 *
 * La más reciente que trae el propio archivo: la del saldo inicial de los
 * contactos, y si no, la del último documento. Es el corte de la migración
 * —el día en que esos saldos eran ciertos—, no el día en que se suben. Si el
 * archivo no trae ninguna, se deja vacío para que lo elija el usuario: poner
 * «hoy» por omisión es justo el error que esto viene a evitar.
 */
export const fechaQuePropone = (
  filas: Array<Record<string, unknown>>,
  documentos: Array<Record<string, unknown>>,
): Dayjs | null => {
  const deLosContactos = filas
    .map(f => String(f.fecha_saldo_inicial ?? '').slice(0, 10)).filter(Boolean)
  const deLosDocumentos = documentos
    .map(d => String(d.fecha ?? '').slice(0, 10)).filter(Boolean)

  const candidatas = deLosContactos.length ? deLosContactos : deLosDocumentos
  if (!candidatas.length) return null

  return dayjs(candidatas.sort().at(-1))
}

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
  /**
   * La fecha de la póliza de apertura.
   *
   * No se mandaba ninguna, así que el servidor fechaba la póliza HOY: los
   * saldos de una migración al 31/12/2025 entraban al balance con fecha de
   * noviembre de 2026, en otro ejercicio. Ahora se elige aquí, a la vista, y
   * se propone la del propio archivo.
   */
  const [fechaApertura, setFechaApertura] = useState<Dayjs | null>(null)

  const esProveedor = tipo === 'proveedores'
  const titulo      = esProveedor ? 'proveedores' : 'clientes'
  const columnas    = esProveedor ? COLUMNAS_PROVEEDORES : COLUMNAS_CLIENTES
  const spec        = esProveedor ? ESPECIFICACION_PROVEEDORES : ESPECIFICACION_CLIENTES

  /**
   * El saldo que de verdad le va a entrar a esta fila.
   *
   * Si el contacto trae documentos en la hoja «Saldos pendientes», mandan
   * ellos y la columna `saldo_inicial` va vacía a propósito: leerla a secas
   * ponía «—» en un contacto que sí traía saldo. Si no hay documentos, el
   * saldo suelto se trata como lo que es, una cifra en quetzales.
   */
  const saldoDeLaFila = (fila: BatchImportRow) => {
    const porDocumentos = revision?.porDocumentos[String(fila.nit ?? '').trim()]
    if (porDocumentos) return porDocumentos

    const suelto = fila.saldo_inicial
    if (suelto == null || !Number(suelto)) return null
    return {
      documentos: 0, moneda: 'GTQ',
      monto: Number(suelto), enQuetzales: Number(suelto),
      tasaMin: 1, tasaMax: 1,
    }
  }

  /** ¿Hay algo que contabilizar? Sin saldos, la fecha de apertura no hace falta. */
  const haySaldos = Boolean(revision && (revision.conSaldo || revision.documentos))

  /** Los documentos de un contacto, para abrirlos debajo de su fila. */
  const documentosDe = (nit: unknown) => {
    const clave = String(nit ?? '').trim()
    return clave
      ? documentos.filter(d => String(d.nit ?? '').trim() === clave)
      : []
  }

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

      setFechaApertura(fechaQuePropone(leidas, pendientes))
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
      const r = await fn(filas, fechaApertura?.format('YYYY-MM-DD'), documentos)
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
        width={1180}
        style={{ maxWidth: '96vw', top: 24 }}
        okText={`Importar ${filas.length}`}
        okButtonProps={{
          loading: subiendo,
          disabled: !!faltantes.length || (!fechaApertura && haySaldos),
          style: { background: '#1B3A6B' },
        }}
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

        {/* Un NIT escrito distinto en las dos hojas: el documento no se carga ni se ve. */}
        {revision?.documentosSinContacto ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message={`${revision.documentosSinContacto} documento(s) no corresponden a ningún contacto del archivo`}
            description="Su NIT no aparece en la hoja de contactos, así que no se van a cargar. Revisá que esté escrito igual en las dos hojas." />
        ) : null}

        {/* Sin tasa no se cargan: a 1 × 1 la cartera entraría por una séptima parte. */}
        {revision?.documentosSinTasa ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message={`${revision.documentosSinTasa} documento(s) en moneda extranjera sin tipo de cambio`}
            description="Esos no se van a cargar. Escribí en la hoja «Saldos pendientes» la tasa con la que se registró cada uno." />
        ) : null}

        {/*
          * La fecha CONTABLE, que es otra cosa que la del documento.
          *
          * Cada factura conserva la suya —es su trazabilidad y no se toca—,
          * pero la póliza entra al mayor con una sola: la del corte de la
          * migración. Antes no se preguntaba y el servidor usaba «hoy».
          */}
        <Space align="center" style={{ marginBottom: 10 }} wrap>
          <Text strong>Fecha de contabilización</Text>
          <DatePicker
            value={fechaApertura}
            onChange={setFechaApertura}
            format="DD/MM/YYYY"
            allowClear={false}
            placeholder="Elegí la fecha contable"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Con esta fecha entra la póliza al mayor. Cada documento conserva la suya.
          </Text>
        </Space>

        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Los que ya existan con el mismo NIT se actualizan; el resto se crea.
        </Text>

        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={filas}
          pagination={{ pageSize: 8, size: 'small' }}
          scroll={{ x: 1000 }}
          /**
           * El detalle, debajo de su contacto.
           *
           * El total de un proveedor no se revisa: se revisan las facturas que
           * lo forman, una por una, con su número y su tasa. Van desplegables y
           * no en una lista aparte porque con sesenta proveedores una lista
           * suelta de doscientos documentos no se puede recorrer.
           */
          expandable={{
            rowExpandable: (fila: BatchImportRow) => documentosDe(fila.nit).length > 0,
            expandedRowRender: (fila: BatchImportRow) => (
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                dataSource={documentosDe(fila.nit)}
                pagination={false}
                columns={[
                  { title: 'Documento', dataIndex: 'documento', width: 180,
                    render: (v: string) => v || <Text type="secondary">sin número</Text> },
                  { title: 'Fecha del documento', dataIndex: 'fecha', width: 150,
                    render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : <Text type="secondary">—</Text> },
                  { title: 'Vence', dataIndex: 'vencimiento', width: 110,
                    render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : <Text type="secondary">—</Text> },
                  { title: 'Monto', width: 130, align: 'right' as const,
                    render: (_: unknown, d: Record<string, unknown>) => (
                      <Text style={numeros}>
                        {String(d.moneda ?? 'GTQ').toUpperCase()} {fmt(Number(d.monto ?? 0))}
                      </Text>
                    ) },
                  { title: 'Tipo de cambio', dataIndex: 'tipo_cambio', width: 130, align: 'right' as const,
                    render: (v: number, d: Record<string, unknown>) => {
                      const extranjera = String(d.moneda ?? 'GTQ').toUpperCase() !== 'GTQ'
                      if (!extranjera) return <Text type="secondary">—</Text>
                      return Number(v) > 0
                        ? <Text style={numeros}>{Number(v).toFixed(6)}</Text>
                        : <Text type="danger">falta la tasa</Text>
                    } },
                  { title: 'En quetzales', width: 130, align: 'right' as const,
                    render: (_: unknown, d: Record<string, unknown>) => {
                      const moneda = String(d.moneda ?? 'GTQ').toUpperCase()
                      const tc = moneda === 'GTQ' ? 1 : Number(d.tipo_cambio ?? 0)
                      if (!tc) return <Text type="danger">no se cargará</Text>
                      return <Text strong style={numeros}>Q {fmt(Number(d.monto ?? 0) * tc)}</Text>
                    } },
                ]}
              />
            ),
          }}
          columns={[
            { title: 'Nombre', dataIndex: 'nombre', width: 210 },
            { title: 'NIT', dataIndex: 'nit', width: 110 },
            { title: 'Email', dataIndex: 'email', width: 150,
              render: (v: string) => v || <Text type="secondary">—</Text> },
            { title: esProveedor ? 'Cuenta por pagar' : 'Cuenta por cobrar',
              dataIndex: esProveedor ? 'cuenta_contacto' : 'cuenta_por_cobrar', width: 130,
              render: (v: string) => v || <Text type="secondary">—</Text> },
            /**
             * El saldo, en tres columnas y no en una.
             *
             * Primero se mostraba todo junto en una celda. Con dos filas se
             * lee; con sesenta proveedores, no: los montos quedan a distinta
             * altura y no se pueden recorrer con la vista ni comparar. Cada
             * dato en su columna, alineado a la derecha y con cifras de ancho
             * fijo, que es como se lee una cartera.
             */
            { title: 'Saldo en su moneda', width: 140, align: 'right' as const,
              render: (_: unknown, fila: BatchImportRow) => {
                const s = saldoDeLaFila(fila)
                if (!s || s.moneda === 'GTQ') return <Text type="secondary">—</Text>
                if (s.moneda === 'MIXTA') return <Text type="secondary">varias monedas</Text>
                return <Text style={numeros}>{s.moneda} {fmt(s.monto)}</Text>
              } },
            { title: 'Tipo de cambio', width: 150, align: 'right' as const,
              render: (_: unknown, fila: BatchImportRow) => {
                const s = saldoDeLaFila(fila)
                if (!s || s.moneda === 'GTQ') return <Text type="secondary">—</Text>
                return <Text style={numeros}>{tasa(s)}</Text>
              } },
            { title: 'Saldo en Q', width: 140, align: 'right' as const,
              render: (_: unknown, fila: BatchImportRow) => {
                const s = saldoDeLaFila(fila)
                if (!s) return <Text type="secondary">—</Text>
                return (
                  <div style={{ lineHeight: 1.3 }}>
                    <Text strong style={numeros}>Q {fmt(s.enQuetzales)}</Text>
                    {s.documentos > 0 && (
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{s.documentos} doc.</Text></div>
                    )}
                  </div>
                )
              } },
          ]}
        />
      </Modal>
    </>
  )
}
