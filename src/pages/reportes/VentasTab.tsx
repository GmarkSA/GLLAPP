import { useState, useCallback } from 'react'
import {
  Table, DatePicker, Button, Space, Segmented, Card, Statistic,
  Row, Col, Empty, message, Typography, Tag,
} from 'antd'
import { SearchOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import {
  getReporteVentas, type VistaDeVentas, type FilaDeVentas, type ReporteDeVentas,
} from '../../api/inventario'

const { Text } = Typography

/**
 * Las ventas del período, por cliente, artículo, día y mes.
 *
 * Es la misma venta mirada de cuatro maneras, y por eso los totales de las
 * cuatro vistas coinciden: el servidor parte del mismo filtro para todas. Si
 * no coincidieran, lo primero que el usuario haría es desconfiar del reporte
 * entero.
 */

const Q = (n: number) =>
  `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const num = (n: number) =>
  Number(n ?? 0).toLocaleString('es-GT', { maximumFractionDigits: 4 })

const qStyle = { fontVariantNumeric: 'tabular-nums' as const }

const VISTAS: Array<{ value: VistaDeVentas; label: string }> = [
  { value: 'cliente',  label: 'Por cliente' },
  { value: 'articulo', label: 'Por artículo' },
  { value: 'dia',      label: 'Por día' },
  { value: 'mes',      label: 'Consolidado por mes' },
]

/** El nombre de la primera columna cambia con la vista; el resto no. */
const PRIMERA: Record<VistaDeVentas, string> = {
  cliente:  'Cliente',
  articulo: 'Artículo',
  dia:      'Fecha',
  mes:      'Mes',
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Cómo se lee la primera celda de cada fila.
 *
 * Las fechas se formatean con dayjs y no con `new Date`: el navegador parsea
 * «2026-01-10» como medianoche UTC y en Guatemala —UTC-6— eso muestra el día
 * anterior.
 */
export function etiquetaDeFila(fila: FilaDeVentas, vista: VistaDeVentas): string {
  if (vista === 'dia') {
    return fila.fecha ? dayjs(fila.fecha).format('DD/MM/YYYY') : '—'
  }
  if (vista === 'mes') {
    if (!fila.mes) return '—'
    const [anio, mes] = fila.mes.split('-')
    const nombre = MESES[Number(mes) - 1] ?? mes
    return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`
  }
  return fila.nombre || '—'
}

export default function VentasTab() {
  const [vista, setVista]     = useState<VistaDeVentas>('cliente')
  const [rango, setRango]     = useState<[Dayjs, Dayjs] | null>(
    [dayjs().startOf('month'), dayjs().endOf('month')])
  const [data, setData]       = useState<ReporteDeVentas | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = useCallback(async (v: VistaDeVentas = vista) => {
    if (!rango) { message.warning('Elige el período'); return }
    setLoading(true)
    try {
      setData(await getReporteVentas({
        vista: v,
        desde: rango[0].format('YYYY-MM-DD'),
        hasta: rango[1].format('YYYY-MM-DD'),
      }))
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'No se pudo generar el reporte')
      setData(null)
    } finally { setLoading(false) }
  }, [rango, vista])

  const cambiarVista = (v: VistaDeVentas) => {
    setVista(v)
    // Si ya hay un reporte en pantalla, se recarga con la nueva vista: pedir
    // «Generar» otra vez para ver lo mismo de otra forma sería un paso de más.
    if (data) buscar(v)
  }

  const exportar = () => {
    if (!data?.filas.length) return
    const filas = data.filas.map(f => ({
      [PRIMERA[vista]]: etiquetaDeFila(f, vista),
      ...(vista === 'articulo' ? { SKU: f.sku ?? '' } : {}),
      Cantidad: f.cantidad,
      Base: f.base,
      Impuesto: f.impuesto,
      Total: f.total,
      Documentos: f.documentos,
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas')
    XLSX.writeFile(libro, `Ventas ${vista} ${data.periodo.desde} a ${data.periodo.hasta}.xlsx`)
  }

  const columnas = [
    {
      title: PRIMERA[vista],
      render: (_: any, f: FilaDeVentas) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600 }}>{etiquetaDeFila(f, vista)}</Text>
          {vista === 'articulo' && f.sku && (
            <div style={{ fontSize: 11, color: '#6b7280' }}>{f.sku}</div>
          )}
        </div>
      ),
    },
    { title: 'Cantidad', align: 'right' as const, width: 110,
      render: (_: any, f: FilaDeVentas) => (
        <span style={{ ...qStyle, fontSize: 12 }}>{num(f.cantidad)}</span>
      ) },
    { title: 'Base', align: 'right' as const, width: 130,
      render: (_: any, f: FilaDeVentas) => (
        <span style={{ ...qStyle, fontSize: 12 }}>{Q(f.base)}</span>
      ) },
    { title: 'Impuesto', align: 'right' as const, width: 120,
      render: (_: any, f: FilaDeVentas) => (
        <span style={{ ...qStyle, fontSize: 12, color: '#6b7280' }}>{Q(f.impuesto)}</span>
      ) },
    { title: 'Total', align: 'right' as const, width: 140,
      render: (_: any, f: FilaDeVentas) => (
        <span style={{ ...qStyle, fontSize: 12, fontWeight: 700, color: '#1B3A6B' }}>{Q(f.total)}</span>
      ) },
    { title: 'Docs', align: 'right' as const, width: 80,
      render: (_: any, f: FilaDeVentas) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>{f.documentos}</span>
      ) },
  ]

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          value={rango}
          onChange={v => setRango(v as [Dayjs, Dayjs])}
          format="DD/MM/YYYY"
          allowClear={false}
        />
        <Button type="primary" icon={<SearchOutlined />} loading={loading}
          onClick={() => buscar()} style={{ background: '#1B3A6B' }}>
          Generar
        </Button>
        {data && data.filas.length > 0 && (
          <Button icon={<FileExcelOutlined />} onClick={exportar}
            style={{ background: '#217346', borderColor: '#217346', color: '#fff' }}>
            Excel
          </Button>
        )}
      </Space>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={vista}
          onChange={v => cambiarVista(v as VistaDeVentas)}
          options={VISTAS}
        />
      </div>

      {data && (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { title: 'Base',     value: data.totales.base,     color: '#1faec2' },
              { title: 'Impuesto', value: data.totales.impuesto, color: '#6b7280' },
              { title: 'Total vendido', value: data.totales.total, color: '#1B3A6B' },
            ].map(s => (
              <Col span={8} key={s.title}>
                <Card size="small">
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>{s.title}</span>}
                    value={s.value} prefix="Q" precision={2}
                    valueStyle={{ fontSize: 18, color: s.color, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {data.filas.length === 0 ? (
            <Empty description="Sin ventas en el período" />
          ) : (
            <Table
              size="small"
              rowKey={(f, i) => `${f.id ?? f.fecha ?? f.mes ?? ''}-${i}`}
              dataSource={data.filas}
              columns={columnas}
              pagination={false}
              scroll={{ x: 'max-content' }}
              summary={() => (
                <Table.Summary fixed="bottom">
                  <Table.Summary.Row style={{ background: '#f0fdf4', fontWeight: 700 }}>
                    <Table.Summary.Cell index={0}>
                      <Text strong style={{ fontSize: 12 }}>
                        TOTAL — {data.totales.filas} {data.totales.filas === 1 ? 'fila' : 'filas'}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ ...qStyle, fontSize: 12 }}>{num(data.totales.cantidad)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <span style={{ ...qStyle, fontSize: 12 }}>{Q(data.totales.base)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span style={{ ...qStyle, fontSize: 12 }}>{Q(data.totales.impuesto)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <span style={{ ...qStyle, fontSize: 12, color: '#1B3A6B' }}>
                        {Q(data.totales.total)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          )}

          {/*
            * Las cuatro vistas suman lo mismo porque parten del mismo filtro.
            * Decirlo evita que alguien compare dos pestañas y dude del dato.
            */}
          <Tag color="default" style={{ marginTop: 12, fontSize: 11, whiteSpace: 'normal' }}>
            Las cuatro vistas son el mismo período y suman el mismo total. No incluyen
            borradores, facturas anuladas ni anticipos.
          </Tag>
        </>
      )}
    </div>
  )
}
