import { useState, useEffect, useCallback } from 'react'
import {
  Table, DatePicker, Select, Button, Space, Card, Statistic,
  Row, Col, Empty, message, Typography, Tag,
} from 'antd'
import { SearchOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import {
  getKardexCompleto, getProducts,
  type ReporteDeKardex, type RenglonDeKardex, type Product,
} from '../../api/inventario'

const { Text } = Typography

/**
 * El kardex: todo lo que entró y salió de un artículo, con su saldo.
 *
 * El kardex anterior solo leía los AJUSTES: un artículo con compras y ventas
 * mostraba dos renglones y un saldo que no explicaba nada. Este une las tres
 * fuentes —movimientos, ajustes y ventas— porque las existencias se mueven por
 * caminos distintos y cada uno guarda su rastro en su propia tabla.
 */

const num = (n: number) =>
  Number(n ?? 0).toLocaleString('es-GT', { maximumFractionDigits: 4 })

const Q = (n: number) =>
  `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const qStyle = { fontVariantNumeric: 'tabular-nums' as const }

/**
 * Cómo se nombra y se pinta cada clase de movimiento.
 *
 * Los tipos vienen del módulo de inventario con su convención: `entrada_*`
 * suma, `salida_*` resta. Lo que no esté en la lista se muestra tal cual en
 * vez de esconderse tras una etiqueta genérica.
 */
export const ETIQUETA_DE_TIPO: Record<string, { label: string; color: string }> = {
  entrada_compra:         { label: 'Compra',            color: '#2ea172' },
  entrada_reversa:        { label: 'Reversa (entrada)', color: '#1faec2' },
  entrada_produccion:     { label: 'Producción',        color: '#2ea172' },
  salida_venta:           { label: 'Venta',             color: '#e5484d' },
  salida_baja:            { label: 'Baja / merma',      color: '#f59e0b' },
  salida_devolucion_prov: { label: 'Devolución a prov.', color: '#f59e0b' },
  salida_reversa:         { label: 'Reversa (salida)',  color: '#1faec2' },
  ajuste:                 { label: 'Ajuste',            color: '#7c3aed' },
}

export const etiquetaDeTipo = (tipo: string) =>
  ETIQUETA_DE_TIPO[tipo] ?? { label: tipo, color: '#6b7280' }

export default function KardexCompletoTab() {
  const [productos, setProductos] = useState<Product[]>([])
  const [productId, setProductId] = useState<string | undefined>()
  const [rango, setRango]         = useState<[Dayjs, Dayjs] | null>(
    [dayjs().startOf('month'), dayjs().endOf('month')])
  const [data, setData]           = useState<ReporteDeKardex | null>(null)
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    getProducts({ limit: 5000 })
      .then((r: any) => setProductos(Array.isArray(r) ? r : r?.data ?? []))
      .catch(() => setProductos([]))
  }, [])

  const buscar = useCallback(async () => {
    if (!rango) { message.warning('Elige el período'); return }
    setLoading(true)
    try {
      setData(await getKardexCompleto({
        desde: rango[0].format('YYYY-MM-DD'),
        hasta: rango[1].format('YYYY-MM-DD'),
        productId,
      }))
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo generar el kardex')
      setData(null)
    } finally { setLoading(false) }
  }, [rango, productId])

  const exportar = () => {
    if (!data?.movimientos.length) return
    const filas = data.movimientos.map(m => ({
      Fecha: m.fecha,
      Documento: m.documento ?? '',
      Tipo: etiquetaDeTipo(m.tipo).label,
      SKU: m.sku ?? '',
      Artículo: m.articulo ?? '',
      Descripción: m.descripcion ?? '',
      Entrada: m.entrada,
      Salida: m.salida,
      Saldo: m.saldo,
      'Costo unitario': m.costoUnitario ?? 0,
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Kardex')
    XLSX.writeFile(libro, `Kardex ${data.periodo.desde} a ${data.periodo.hasta}.xlsx`)
  }

  const columnas = [
    { title: 'Fecha', width: 110,
      render: (_: any, m: RenglonDeKardex) => (
        // dayjs y no new Date: el navegador parsea la fecha como medianoche UTC
        // y en Guatemala muestra el día anterior.
        <span style={{ fontSize: 12 }}>{m.fecha ? dayjs(m.fecha).format('DD/MM/YYYY') : '—'}</span>
      ) },
    { title: 'Documento', width: 130,
      render: (_: any, m: RenglonDeKardex) => (
        <span style={{ fontSize: 12, fontWeight: 600 }}>{m.documento ?? '—'}</span>
      ) },
    { title: 'Tipo', width: 140,
      render: (_: any, m: RenglonDeKardex) => {
        const t = etiquetaDeTipo(m.tipo)
        return <Tag color={t.color} style={{ fontSize: 10 }}>{t.label}</Tag>
      } },
    { title: 'Artículo',
      render: (_: any, m: RenglonDeKardex) => (
        <div>
          <Text style={{ fontSize: 12 }}>{m.articulo ?? '—'}</Text>
          {m.sku && <div style={{ fontSize: 11, color: '#6b7280' }}>{m.sku}</div>}
          {m.descripcion && (
            <div style={{ fontSize: 11, color: '#9aa1ab' }}>{m.descripcion}</div>
          )}
        </div>
      ) },
    { title: 'Entrada', align: 'right' as const, width: 100,
      render: (_: any, m: RenglonDeKardex) => m.entrada > 0
        ? <span style={{ ...qStyle, fontSize: 12, color: '#2ea172', fontWeight: 600 }}>{num(m.entrada)}</span>
        : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span> },
    { title: 'Salida', align: 'right' as const, width: 100,
      render: (_: any, m: RenglonDeKardex) => m.salida > 0
        ? <span style={{ ...qStyle, fontSize: 12, color: '#e5484d', fontWeight: 600 }}>{num(m.salida)}</span>
        : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span> },
    { title: 'Saldo', align: 'right' as const, width: 110,
      render: (_: any, m: RenglonDeKardex) => (
        // Un saldo negativo se muestra en rojo, no se esconde: el kardex
        // refleja lo que hay, y si quedó negativo hay algo que revisar.
        <span style={{
          ...qStyle, fontSize: 12, fontWeight: 700,
          color: m.saldo < 0 ? '#e5484d' : '#1B3A6B',
        }}>{num(m.saldo)}</span>
      ) },
    { title: 'Costo unit.', align: 'right' as const, width: 110,
      render: (_: any, m: RenglonDeKardex) => (
        <span style={{ ...qStyle, fontSize: 12, color: '#6b7280' }}>{Q(m.costoUnitario ?? 0)}</span>
      ) },
  ]

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          placeholder="Todos los artículos"
          style={{ width: 300 }}
          value={productId}
          onChange={setProductId}
          options={productos.map(p => ({
            value: p.id,
            label: `${p.sku ? `${p.sku} · ` : ''}${p.name}`,
          }))}
        />
        <DatePicker.RangePicker
          value={rango}
          onChange={v => setRango(v as [Dayjs, Dayjs])}
          format="DD/MM/YYYY"
          allowClear={false}
        />
        <Button type="primary" icon={<SearchOutlined />} loading={loading}
          onClick={buscar} style={{ background: '#1B3A6B' }}>
          Generar
        </Button>
        {data && data.movimientos.length > 0 && (
          <Button icon={<FileExcelOutlined />} onClick={exportar}
            style={{ background: '#217346', borderColor: '#217346', color: '#fff' }}>
            Excel
          </Button>
        )}
      </Space>

      {data && (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { title: 'Saldo inicial', value: data.resumen.saldoInicial, color: '#6b7280' },
              { title: 'Entradas',      value: data.resumen.entradas,     color: '#2ea172' },
              { title: 'Salidas',       value: data.resumen.salidas,      color: '#e5484d' },
              { title: 'Saldo final',   value: data.resumen.saldoFinal,   color: '#1B3A6B' },
            ].map(s => (
              <Col span={6} key={s.title}>
                <Card size="small">
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                    value={s.value} precision={2}
                    valueStyle={{ fontSize: 18, color: s.color, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {data.movimientos.length === 0 ? (
            <Empty description="Sin movimientos en el período" />
          ) : (
            <Table
              size="small"
              rowKey={(m, i) => `${m.documento ?? ''}-${m.productId ?? ''}-${i}`}
              dataSource={data.movimientos}
              columns={columnas}
              pagination={{ pageSize: 100, showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
            />
          )}

          <Tag color="default" style={{ marginTop: 12, fontSize: 11, whiteSpace: 'normal' }}>
            Incluye compras y demás movimientos, ajustes, y las salidas por venta.
            El saldo parte de las existencias anteriores al período.
          </Tag>
        </>
      )}
    </div>
  )
}
