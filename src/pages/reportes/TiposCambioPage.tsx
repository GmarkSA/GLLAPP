import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, DollarOutlined, FileExcelOutlined, SyncOutlined } from '@ant-design/icons'
import type { RangePickerProps } from 'antd/es/date-picker'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { getExchangeRateHistory, syncBanguatRate, type CurrencyExchangeRate } from '../../api/monedas'
import { getApiError } from '../../api/axios'

const { Title, Text } = Typography

/**
 * Reportes › Tipos de cambio — historial USD/GTQ alimentado por Banguat.
 * Configuración › Monedas solo agrega/activa la moneda; desde ese día el cron
 * diario registra la tasa oficial y aquí se consulta, filtra y exporta.
 */
export default function TiposCambioPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<CurrencyExchangeRate[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [range, setRange] = useState<[string, string] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getExchangeRateHistory('USD', 365)
      setRows(Array.isArray(data) ? data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!range) return rows
    const [a, b] = range
    return rows.filter(r => {
      const d = dayjs(r.effectiveDate).format('YYYY-MM-DD')
      return d >= a && d <= b
    })
  }, [rows, range])

  // KPIs: última tasa oficial, variación vs día anterior y promedio de los últimos 30 registros
  const kpi = useMemo(() => {
    const sorted = [...rows].sort((x, y) => String(y.effectiveDate).localeCompare(String(x.effectiveDate)))
    const ultimo = sorted[0]; const previo = sorted[1]
    const oficial = (r?: CurrencyExchangeRate) => r?.officialRate ? Number(r.officialRate) : null
    const u = oficial(ultimo); const p = oficial(previo)
    const ult30 = sorted.slice(0, 30).map(oficial).filter((v): v is number => v != null)
    return {
      fecha:     ultimo ? dayjs(ultimo.effectiveDate).format('DD/MM/YYYY') : '—',
      ultimo:    u,
      variacion: u != null && p != null ? u - p : null,
      promedio:  ult30.length ? ult30.reduce((s, v) => s + v, 0) / ult30.length : null,
    }
  }, [rows])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const r = await syncBanguatRate()
      message.success(`Banguat actualizado: 1 USD = ${Number(r.banguatRate ?? r.rate).toFixed(6)} GTQ`)
      await load()
    } catch (e: any) {
      message.error(getApiError(e, 'No se pudo sincronizar con Banguat'))
    } finally { setSyncing(false) }
  }

  const handleExcel = () => {
    const data = filtered.map(r => ({
      Fecha: dayjs(r.effectiveDate).format('DD/MM/YYYY'),
      'GTQ → USD': Number(r.rate),
      'Oficial Banguat (1 USD = GTQ)': r.officialRate ? Number(r.officialRate) : '',
      Fuente: r.source,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tipos de cambio')
    XLSX.writeFile(wb, `tipos-de-cambio-usd-gtq-${dayjs().format('YYYY-MM-DD')}.xlsx`)
  }

  const onRange: RangePickerProps['onChange'] = (_, strs) =>
    setRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)

  const fmt6 = (v: number | null) => v == null ? '—' : `Q ${v.toFixed(6)}`

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <DollarOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Tipos de cambio</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              USD / GTQ · tasa oficial del Banco de Guatemala, registrada diariamente desde que se activa la moneda USD
            </Text>
          </div>
        </div>
        <Space wrap>
          <DatePicker.RangePicker size="small" onChange={onRange} format="DD/MM/YYYY" />
          <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>Actualizar Banguat</Button>
          <Button icon={<FileExcelOutlined />} style={{ color: '#2ea172', borderColor: '#2ea172' }} onClick={handleExcel}>Excel</Button>
        </Space>
      </div>

      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8}>
          <Card size="small" style={{ borderLeft: '4px solid #1faec2' }}>
            <Statistic title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Último tipo de cambio · {kpi.fecha}</Text>}
              value={fmt6(kpi.ultimo)} valueStyle={{ fontSize: 18, color: '#1faec2' }} />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>1 USD en quetzales</Text>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card size="small" style={{ borderLeft: `4px solid ${(kpi.variacion ?? 0) >= 0 ? '#2ea172' : '#e5484d'}` }}>
            <Statistic title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Variación vs día anterior</Text>}
              value={kpi.variacion == null ? '—' : `${kpi.variacion >= 0 ? '+' : ''}${kpi.variacion.toFixed(6)}`}
              valueStyle={{ fontSize: 18, color: (kpi.variacion ?? 0) >= 0 ? '#2ea172' : '#e5484d' }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" style={{ borderLeft: '4px solid #1B3A6B' }}>
            <Statistic title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Promedio últimos 30 registros</Text>}
              value={fmt6(kpi.promedio)} valueStyle={{ fontSize: 18, color: '#1B3A6B' }} />
          </Card>
        </Col>
      </Row>

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 31, showSizeChanger: false, showTotal: t => `${t} registros` }}
        scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
        style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }}
        columns={[
          { title: 'Fecha', dataIndex: 'effectiveDate', width: 130,
            render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY')}</Text> },
          { title: 'Conversión GTQ → USD', dataIndex: 'rate',
            render: (v: number) => <Text code>1 GTQ = {Number(v).toFixed(8)} USD</Text> },
          { title: 'Oficial Banguat', dataIndex: 'officialRate',
            render: (v?: number) => v ? <Text style={{ fontVariantNumeric: 'tabular-nums' }}>1 USD = {Number(v).toFixed(6)} GTQ</Text> : <Text type="secondary">Manual</Text> },
          { title: 'Fuente', dataIndex: 'source', width: 110,
            render: (v: string) => <Tag color={v === 'banguat' ? '#1faec2' : 'default'}>{v}</Tag> },
        ]}
      />
    </div>
  )
}
