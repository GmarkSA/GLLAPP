import { useState } from 'react'
import {
  Modal, Upload, Button, Table, Alert, Space, Typography, Select,
  DatePicker, Steps, Tag, message, Checkbox,
} from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { cargaMasivaArticulos, getProducts, importSaldosInicialesInventario } from '../../api/inventario'
import { getAlmacenes, getGrupos, type Almacen, type GrupoArticulo } from '../../api/expedientes'
import { getTaxes } from '../../api/impuestos'
import { getAccounts } from '../../api/catalogo'
import { getApiError } from '../../api/axios'
import {
  construirPlantillaInventario, leerArchivoDeArticulos, type FilaDeArticulo,
} from '../configuracion/plantillaInventario'

const { Text } = Typography

/**
 * Carga masiva de inventario, de punta a punta.
 *
 * Son dos pasos que van en orden y no se pueden invertir: primero se crean los
 * artículos —con sus cuentas e impuestos— y después entra la existencia, que es
 * la que genera la póliza de apertura. Meter el stock en el primer paso dejaría
 * inventario en bodega sin contabilidad.
 *
 * La fecha de contabilización se pregunta ANTES de confirmar, porque es la que
 * decide en qué período aparece el inventario en todos los reportes.
 */
export default function CargaMasivaModal({ open, onClose, onCargado }: {
  open: boolean
  onClose: () => void
  onCargado: () => void
}) {
  const [paso,     setPaso]     = useState(0)
  const [filas,    setFilas]    = useState<FilaDeArticulo[]>([])
  const [cargando, setCargando] = useState(false)
  const [fallo,    setFallo]    = useState<string | null>(null)

  const [grupos,    setGrupos]    = useState<GrupoArticulo[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [impuestos, setImpuestos] = useState<any[]>([])
  const [cuentas,   setCuentas]   = useState<any[]>([])

  const [grupoId,        setGrupoId]        = useState<string | undefined>()
  const [impVentas,      setImpVentas]      = useState<string | undefined>()
  const [impCompras,     setImpCompras]     = useState<string | undefined>()
  const [almacenId,      setAlmacenId]      = useState<string | undefined>()
  const [fechaSaldo,     setFechaSaldo]     = useState<Dayjs | null>(dayjs())
  const [fechaContable,  setFechaContable]  = useState<Dayjs | null>(dayjs())
  const [cargarSaldos,   setCargarSaldos]   = useState(true)
  const [resultado,      setResultado]      = useState<any>(null)

  const cargarCatalogos = async () => {
    const [g, a, i, c] = await Promise.all([
      getGrupos().catch(() => []),
      getAlmacenes().catch(() => []),
      getTaxes().catch(() => []),
      getAccounts().catch(() => []),
    ])
    setGrupos(Array.isArray(g) ? g : [])
    setAlmacenes(Array.isArray(a) ? a : [])
    setImpuestos(Array.isArray(i) ? i : [])
    setCuentas(Array.isArray(c) ? c : [])
  }

  const descargarPlantilla = async () => {
    await cargarCatalogos()
    const datos = construirPlantillaInventario({
      cuentas: cuentas.filter((c: any) => c?.code)
        .map((c: any) => ({ id: String(c.id ?? ''), code: String(c.code), name: String(c.name ?? '') })),
      impuestos: impuestos.filter((t: any) => t?.code)
        .map((t: any) => ({ code: String(t.code), name: String(t.name ?? ''), rate: Number(t.rate) || 0 })),
      grupos:    grupos.map(g => ({ code: String(g.code ?? ''), name: String(g.name ?? '') })),
      unidades:  ['UND', 'CAJA', 'BOLSA', 'PAQUETE', 'YARDA', 'RESMA', 'ROLLO', 'SET'],
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

  const recibirArchivo = async (file: File) => {
    setFallo(null)
    await cargarCatalogos()
    try {
      const leidas = leerArchivoDeArticulos(await file.arrayBuffer())
      if (leidas.length === 0) {
        setFallo('El archivo no trae ninguna fila con nombre o SKU.')
        return false
      }
      setFilas(leidas)
      setPaso(1)
    } catch (e: any) {
      setFallo(e?.message ?? 'No se pudo leer el archivo')
    }
    return false
  }

  const confirmar = async () => {
    if (cargarSaldos && !fechaContable) {
      message.error('Elige la fecha de contabilización')
      return
    }
    setCargando(true)
    setFallo(null)
    try {
      // Paso 1 — los artículos, con sus cuentas e impuestos.
      const r = await cargaMasivaArticulos(filas, {
        grupoId,
        impuestoVentasId:  impVentas ?? null,
        impuestoComprasId: impCompras ?? null,
      })

      // Paso 2 — la existencia, que es la que genera la póliza de apertura.
      let saldos: any = null
      if (cargarSaldos) {
        const conExistencia = filas.filter(f => Number(f.existencia) > 0)
        if (conExistencia.length > 0) {
          const creados = await getProducts({ limit: 500 }).then((x: any) => x?.data ?? [])
          const porSku = new Map(creados.map((p: any) => [String(p.sku), p.id]))
          saldos = await importSaldosInicialesInventario({
            fecha:                 fechaSaldo!.format('YYYY-MM-DD'),
            fechaContabilizacion:  fechaContable!.format('YYYY-MM-DD'),
            defaultWarehouseId:    almacenId,
            items: conExistencia.map(f => ({
              sku:         f.sku ?? '',
              productId:   porSku.get(String(f.sku ?? '')) as string | undefined,
              quantity:    Number(f.existencia),
              unitCost:    Number(f.costo ?? 0),
              warehouseId: almacenId,
            })),
          } as any)
        }
      }

      setResultado({ articulos: r, saldos })
      setPaso(2)
      onCargado()
    } catch (e: unknown) {
      setFallo(getApiError(e, 'No se pudo completar la carga'))
    } finally {
      setCargando(false)
    }
  }

  const cerrar = () => {
    setPaso(0); setFilas([]); setResultado(null); setFallo(null)
    onClose()
  }

  const conExistencia = filas.filter(f => Number(f.existencia) > 0)
  const valorTotal = conExistencia.reduce(
    (s, f) => s + Number(f.existencia ?? 0) * Number(f.costo ?? 0), 0)

  return (
    <Modal
      title="Cargar inventario desde archivo"
      open={open}
      onCancel={cerrar}
      width={980}
      footer={null}
      destroyOnClose
    >
      <Steps
        size="small"
        current={paso}
        style={{ marginBottom: 18 }}
        items={[{ title: 'Subir archivo' }, { title: 'Revisar y contabilizar' }, { title: 'Listo' }]}
      />

      {fallo && <Alert type="error" showIcon message={fallo} style={{ marginBottom: 14 }} />}

      {paso === 0 && (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="info" showIcon
            message="La plantilla lleva las columnas de las tres pestañas del artículo"
            description="También se acepta el archivo tal como lo exporta Zoho. Las columnas que no use puede borrarlas."
          />
          <Space>
            <Button icon={<DownloadOutlined />} onClick={descargarPlantilla}>
              Descargar plantilla Excel
            </Button>
            <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={recibirArchivo}>
              <Button type="primary" icon={<UploadOutlined />} style={{ background: '#1B3A6B' }}>
                Subir archivo
              </Button>
            </Upload>
          </Space>
        </Space>
      )}

      {paso === 1 && (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="success" showIcon
            message={`${filas.length} artículos listos — ${conExistencia.length} con existencia`}
            description={
              <>Valor del inventario a cargar:{' '}
              <Text strong>Q {valorTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
              . Ese es el monto que entrará a la cuenta de inventario.</>
            }
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <Text style={{ fontSize: 12 }}>Grupo de artículos <Text type="danger">*</Text></Text>
              <Select
                style={{ width: '100%' }} value={grupoId} onChange={setGrupoId}
                placeholder="De aquí salen las cuentas contables"
                options={grupos.map(g => ({ value: g.id, label: `${g.code} — ${g.name}` }))}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                La fila que no resuelva sus cuentas no se importa, y se dice cuál falta.
              </Text>
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>Impuesto de ventas</Text>
              <Select
                style={{ width: '100%' }} value={impVentas} onChange={setImpVentas} allowClear
                placeholder="Vacío si el régimen no lo lleva"
                options={impuestos.map((t: any) => ({ value: t.id, label: `${t.code ?? ''} — ${t.name}` }))}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>Impuesto de compras</Text>
              <Select
                style={{ width: '100%' }} value={impCompras} onChange={setImpCompras} allowClear
                options={impuestos.map((t: any) => ({ value: t.id, label: `${t.code ?? ''} — ${t.name}` }))}
              />
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e8eef5', borderRadius: 8, padding: 12 }}>
            <Checkbox checked={cargarSaldos} onChange={e => setCargarSaldos(e.target.checked)}>
              <Text strong style={{ fontSize: 13 }}>Cargar también la existencia y generar su póliza</Text>
            </Checkbox>
            {cargarSaldos && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 10 }}>
                <div>
                  <Text style={{ fontSize: 12 }}>Fecha del saldo</Text>
                  <DatePicker style={{ width: '100%' }} value={fechaSaldo} onChange={setFechaSaldo}
                    format="DD/MM/YYYY" placeholder="Corte del sistema anterior" />
                </div>
                <div>
                  <Text style={{ fontSize: 12 }}>
                    Fecha de contabilización <Text type="danger">*</Text>
                  </Text>
                  <DatePicker style={{ width: '100%' }} value={fechaContable} onChange={setFechaContable}
                    format="DD/MM/YYYY" />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Decide en qué período aparece el inventario en balance, libro mayor y dashboard.
                  </Text>
                </div>
                <div>
                  <Text style={{ fontSize: 12 }}>Almacén</Text>
                  <Select style={{ width: '100%' }} value={almacenId} onChange={setAlmacenId} allowClear
                    options={almacenes.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                </div>
              </div>
            )}
          </div>

          <Table
            size="small"
            dataSource={filas.map((f, i) => ({ ...f, key: i }))}
            pagination={{ pageSize: 8, showTotal: t => `${t} filas` }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'SKU', dataIndex: 'sku', width: 130 },
              { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
              { title: 'Unidad', dataIndex: 'unidad', width: 80 },
              { title: 'Costo', dataIndex: 'costo', width: 90, align: 'right',
                render: (v: number) => v ? `Q ${Number(v).toFixed(2)}` : '—' },
              { title: 'Precio', dataIndex: 'precioVenta', width: 90, align: 'right',
                render: (v: number) => v ? `Q ${Number(v).toFixed(2)}` : '—' },
              { title: 'Existencia', dataIndex: 'existencia', width: 95, align: 'right',
                render: (v: number) => v ? Number(v).toLocaleString('es-GT') : '—' },
              { title: 'Revisar', width: 150, render: (_: any, f: FilaDeArticulo) => {
                if (!f.nombre) return <Tag color="error">Sin nombre</Tag>
                if (f.costo && f.precioVenta && f.precioVenta <= f.costo) {
                  return <Tag color="warning">Precio ≤ costo</Tag>
                }
                return <Tag color="success">OK</Tag>
              } },
            ]}
          />

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setPaso(0)}>Atrás</Button>
            <Button type="primary" loading={cargando} style={{ background: '#1B3A6B' }}
              onClick={confirmar} disabled={!grupoId}>
              Cargar {filas.length} artículos
            </Button>
          </Space>
        </Space>
      )}

      {paso === 2 && resultado && (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="success" showIcon
            message={`${resultado.articulos.creados} artículos creados`}
            description={
              <>
                {resultado.articulos.actualizados > 0 && <>{resultado.articulos.actualizados} actualizados. </>}
                {resultado.articulos.omitidos > 0 && <>{resultado.articulos.omitidos} ya existían. </>}
                {resultado.saldos?.entryNumber && (
                  <>Póliza de apertura <Text strong>{resultado.saldos.entryNumber}</Text>, visible en
                  Contabilidad › Diarios.</>
                )}
              </>
            }
          />

          {resultado.articulos.errores.length > 0 && (
            <Alert type="error" showIcon
              message={`${resultado.articulos.errores.length} filas NO se importaron`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 180, overflow: 'auto' }}>
                  {resultado.articulos.errores.slice(0, 50).map((e: any, i: number) => (
                    <li key={i} style={{ fontSize: 12 }}>Fila {e.fila} ({e.sku || 's/sku'}): {e.motivo}</li>
                  ))}
                </ul>
              } />
          )}

          {resultado.articulos.avisos.length > 0 && (
            <Alert type="warning" showIcon
              message={`${resultado.articulos.avisos.length} filas para revisar`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 140, overflow: 'auto' }}>
                  {resultado.articulos.avisos.slice(0, 30).map((a: any, i: number) => (
                    <li key={i} style={{ fontSize: 12 }}>{a.sku}: {a.motivo}</li>
                  ))}
                </ul>
              } />
          )}

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button type="primary" style={{ background: '#1B3A6B' }} onClick={cerrar}>Listo</Button>
          </Space>
        </Space>
      )}
    </Modal>
  )
}
