import { useEffect, useState, useMemo } from 'react'
import {
  Button, Select, Table, Tag, Typography, Statistic, Card,
  Divider, Row, Col, Modal, Form, Input, message, Space,
} from 'antd'
import {
  AppstoreOutlined, PrinterOutlined, FileExcelOutlined, FilePdfOutlined, MailOutlined, FilterOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { getActivosFijos, type ActivoFijo, type EstadoActivoFijo } from '../../api/activos-fijos'
import { getClasesActivoFijo, type ClaseActivoFijo } from '../../api/clases-activo-fijo'
import { useCentrosOptions } from '../../components/SelectorDimensionesAnaliticas'

const { Title, Text } = Typography

const Q = (n: number | string | null | undefined) =>
  `Q ${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

const ESTADO_COLOR: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'default', ACTIVO: 'success', VENDIDO: 'processing', DADO_DE_BAJA: 'error',
}
const ESTADO_LABEL: Record<EstadoActivoFijo, string> = {
  BORRADOR: 'Borrador', ACTIVO: 'Activo', VENDIDO: 'Vendido', DADO_DE_BAJA: 'Dado de Baja',
}

interface TableRow {
  key:                  string
  isGroup:              boolean
  claseNombre?:         string
  claseNombreRow?:      string | null
  groupCount?:          number
  groupCosto?:          number
  groupDepAcum?:        number
  groupValLib?:         number
  groupBajaValor?:      number
  assetNumber?:         string
  name?:                string
  estado?:              EstadoActivoFijo
  acquisitionDate?:     string
  originalCost?:        number
  accumulatedDepreciation?: number
  currentBookValue?:    number
  depreciacionMensual?: number | null
  pctAmortizado?:       number
  ccNombre?:            string | null
  cbNombre?:            string | null
  disposedAt?:          string | null
  disposalValue?:       number | null
  id?:                  string
}

export default function ReporteActivosFijosPage() {
  const [activos,  setActivos]  = useState<ActivoFijo[]>([])
  const [clases,   setClases]   = useState<ClaseActivoFijo[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [emailForm] = Form.useForm()

  const [filtroEstado, setFiltroEstado] = useState<string | undefined>()
  const [filtroClase,  setFiltroClase]  = useState<string | undefined>()
  const [filtroCC,     setFiltroCC]     = useState<string | undefined>()
  const [filtroCB,     setFiltroCB]     = useState<string | undefined>()

  const [centrosCosto, centrosBeneficio] = useCentrosOptions()

  useEffect(() => {
    setLoading(true)
    Promise.all([getActivosFijos({ limit: 9999 }), getClasesActivoFijo()])
      .then(([af, cl]) => {
        setActivos(Array.isArray(af?.data) ? af.data : [])
        setClases(cl)
      }).finally(() => setLoading(false))
  }, [])

  const claseMap = useMemo(() => new Map(clases.map(c => [c.id, c.nombre])), [clases])
  const ccMap    = useMemo(() => new Map(centrosCosto.map(c => [c.id, c.nombre])),    [centrosCosto])
  const cbMap    = useMemo(() => new Map(centrosBeneficio.map(c => [c.id, c.nombre])), [centrosBeneficio])

  const filtered = useMemo(() => activos.filter(a => {
    if (filtroEstado && a.estado !== filtroEstado) return false
    if (filtroClase  && a.claseActivoFijoId !== filtroClase)  return false
    if (filtroCC     && a.centroCostoId     !== filtroCC)     return false
    if (filtroCB     && a.centroBeneficioId !== filtroCB)     return false
    return true
  }), [activos, filtroEstado, filtroClase, filtroCC, filtroCB])

  const kpi = useMemo(() => {
    const activos2  = filtered.filter(a => a.estado === 'ACTIVO')
    const bajas     = filtered.filter(a => a.estado === 'DADO_DE_BAJA' || a.estado === 'VENDIDO')
    return {
      totalActivos:  filtered.length,
      countActivos:  activos2.length,
      totalCosto:    filtered.reduce((s, a) => s + Number(a.originalCost), 0),
      totalDepAcum:  filtered.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
      totalValLib:   filtered.reduce((s, a) => s + Number(a.currentBookValue), 0),
      depMensual:    activos2.reduce((s, a) => s + Number(a.depreciacionMensual ?? 0), 0),
      totalBajas:    bajas.length,
      totalBajaValor: bajas.reduce((s, a) => s + Number(a.disposalValue ?? 0), 0),
    }
  }, [filtered])

  const grandTotal = useMemo(() => {
    const activeOnly   = filtered.filter(a => a.estado !== 'DADO_DE_BAJA' && a.estado !== 'VENDIDO')
    const disposedOnly = filtered.filter(a => a.estado === 'DADO_DE_BAJA' || a.estado === 'VENDIDO')
    return {
      costo:     activeOnly.reduce((s, a) => s + Number(a.originalCost), 0),
      depAcum:   activeOnly.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
      valLib:    activeOnly.reduce((s, a) => s + Number(a.currentBookValue), 0),
      bajaValor: disposedOnly.reduce((s, a) => s + Number(a.disposalValue ?? 0), 0),
    }
  }, [filtered])

  const tableRows = useMemo((): TableRow[] => {
    const groups = new Map<string, ActivoFijo[]>()
    for (const a of filtered) {
      const gKey = a.claseActivoFijoId ?? '__sin_clase__'
      if (!groups.has(gKey)) groups.set(gKey, [])
      groups.get(gKey)!.push(a)
    }

    const rows: TableRow[] = []
    for (const [claseId, items] of groups) {
      const nombre   = claseId === '__sin_clase__' ? 'Sin clase asignada' : (claseMap.get(claseId) ?? claseId)
      const activeItems   = items.filter(a => a.estado !== 'DADO_DE_BAJA' && a.estado !== 'VENDIDO')
      const disposedItems = items.filter(a => a.estado === 'DADO_DE_BAJA' || a.estado === 'VENDIDO')
      rows.push({
        key: `group-${claseId}`, isGroup: true,
        claseNombre:  nombre,
        groupCount:   items.length,
        groupCosto:   activeItems.reduce((s, a) => s + Number(a.originalCost), 0),
        groupDepAcum: activeItems.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
        groupValLib:  activeItems.reduce((s, a) => s + Number(a.currentBookValue), 0),
        groupBajaValor: disposedItems.reduce((s, a) => s + Number(a.disposalValue ?? 0), 0),
      })
      for (const a of items) {
        const pct = Number(a.originalCost) > 0
          ? Math.round(Number(a.accumulatedDepreciation) / Number(a.originalCost) * 100)
          : 0
        const isDisposed = a.estado === 'DADO_DE_BAJA' || a.estado === 'VENDIDO'
        rows.push({
          key: a.id, isGroup: false, id: a.id,
          assetNumber: a.assetNumber, name: a.name, estado: a.estado,
          acquisitionDate: a.acquisitionDate,
          originalCost:            isDisposed ? 0 : Number(a.originalCost),
          accumulatedDepreciation: isDisposed ? 0 : Number(a.accumulatedDepreciation),
          currentBookValue:        isDisposed ? 0 : Number(a.currentBookValue),
          depreciacionMensual: isDisposed ? null : (a.depreciacionMensual ? Number(a.depreciacionMensual) : null),
          pctAmortizado: isDisposed ? 0 : pct,
          claseNombreRow: a.claseActivoFijoId ? (claseMap.get(a.claseActivoFijoId) ?? a.claseActivoFijoId) : null,
          ccNombre: a.centroCostoId    ? (ccMap.get(a.centroCostoId)    ?? a.centroCostoId) : null,
          cbNombre: a.centroBeneficioId ? (cbMap.get(a.centroBeneficioId) ?? a.centroBeneficioId) : null,
          disposedAt:   a.disposedAt,
          disposalValue: a.disposalValue ? Number(a.disposalValue) : null,
        })
      }
    }
    return rows
  }, [filtered, claseMap, ccMap, cbMap])

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const handleExcel = () => {
    try {
      const headers = [
        'N.º Activo', 'Nombre', 'Clase', 'Estado',
        'Fecha Adq.', 'Costo Original', 'Dep. Acumulada', 'Valor en Libros',
        '% Amort.', 'Dep. Mensual', 'Centro de Costo', 'Centro de Beneficio',
        'Fecha de Baja', 'Valor de Baja/Venta',
      ]
      const rows = filtered.map(a => {
        const disp = a.estado === 'DADO_DE_BAJA' || a.estado === 'VENDIDO'
        return [
          a.assetNumber,
          a.name,
          a.claseActivoFijoId ? (claseMap.get(a.claseActivoFijoId) ?? '') : 'Sin clase',
          ESTADO_LABEL[a.estado],
          a.acquisitionDate ? dayjs(a.acquisitionDate).format('DD/MM/YYYY') : '',
          disp ? 0 : Number(a.originalCost),
          disp ? 0 : Number(a.accumulatedDepreciation),
          disp ? 0 : Number(a.currentBookValue),
          disp ? 0 : (Number(a.originalCost) > 0 ? Math.round(Number(a.accumulatedDepreciation) / Number(a.originalCost) * 100) : 0),
          disp ? 0 : (a.depreciacionMensual ? Number(a.depreciacionMensual) : 0),
          a.centroCostoId    ? (ccMap.get(a.centroCostoId)    ?? '') : '',
          a.centroBeneficioId ? (cbMap.get(a.centroBeneficioId) ?? '') : '',
          a.disposedAt ? dayjs(a.disposedAt).format('DD/MM/YYYY') : '',
          a.disposalValue ? Number(a.disposalValue) : '',
        ]
      })
      const totals = [
        'TOTAL GENERAL', '', '', '',
        '', grandTotal.costo, grandTotal.depAcum, grandTotal.valLib,
        '', '', '', '',
        '', grandTotal.bajaValor,
      ]
      const wsData = [headers, ...rows, [], totals]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [
        { wch: 12 }, { wch: 35 }, { wch: 22 }, { wch: 12 },
        { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
        { wch: 14 }, { wch: 18 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Activos Fijos')
      XLSX.writeFile(wb, `reporte-activos-fijos-${dayjs().format('YYYY-MM-DD')}.xlsx`)
    } catch {
      message.error('Error al generar el archivo Excel')
    }
  }

  // ── Enviar por correo ─────────────────────────────────────────────────────
  const handleEmail = ({ email }: { email: string }) => {
    const subject = encodeURIComponent(`Reporte de Activos Fijos — ${dayjs().format('DD/MM/YYYY')}`)
    const body = encodeURIComponent(
      `Estimado/a,\n\nAdjunto el Reporte de Activos Fijos al ${dayjs().format('DD/MM/YYYY')}.\n\n` +
      `Resumen:\n` +
      `• Total activos: ${kpi.totalActivos} (${kpi.countActivos} activos en operación)\n` +
      `• Costo original total: ${Q(kpi.totalCosto)}\n` +
      `• Depreciación acumulada: ${Q(kpi.totalDepAcum)}\n` +
      `• Valor en libros: ${Q(kpi.totalValLib)}\n` +
      `• Depreciación mensual en curso: ${Q(kpi.depMensual)}\n` +
      (kpi.totalBajas > 0 ? `• Activos dados de baja/vendidos: ${kpi.totalBajas}\n` : '') +
      `\nGenerado por Lucía.`,
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self')
    setShowEmail(false)
    emailForm.resetFields()
    message.success('Cliente de correo abierto — adjunta el PDF o Excel descargado')
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  // Order: N.º | Nombre | Clase | C.Costo | C.Beneficio | Estado | Fecha Adq. | Costo | DepAcum | ValLib | %Amort | DepMens | FechaBaja | ValBaja
  const columns = [
    {
      title: 'N.º Activo', dataIndex: 'assetNumber', width: 110,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.assetNumber}</Text>,
    },
    {
      title: 'Nombre / Descripción', dataIndex: 'name',
      render: (_: any, r: TableRow) => {
        if (r.isGroup) return (
          <Text strong style={{ color: '#1faec2', fontSize: 12 }}>
            {r.claseNombre}
            <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
              ({r.groupCount} {r.groupCount === 1 ? 'activo' : 'activos'})
            </Text>
          </Text>
        )
        return <Text style={{ fontSize: 12 }}>{r.name}</Text>
      },
    },
    {
      title: 'Clase', dataIndex: 'claseNombreRow', width: 130,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : r.claseNombreRow
          ? <Text style={{ fontSize: 11 }}>{r.claseNombreRow}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'C. Costo', dataIndex: 'ccNombre', width: 110,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : r.ccNombre
          ? <Text style={{ fontSize: 11 }}>{r.ccNombre}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'C. Beneficio', dataIndex: 'cbNombre', width: 110,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : r.cbNombre
          ? <Text style={{ fontSize: 11 }}>{r.cbNombre}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 100,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : <Tag color={ESTADO_COLOR[r.estado!]} style={{ fontSize: 11 }}>{ESTADO_LABEL[r.estado!]}</Tag>,
    },
    {
      title: 'Fecha Adq.', dataIndex: 'acquisitionDate', width: 95,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : <Text style={{ fontSize: 12 }}>{r.acquisitionDate ? dayjs(r.acquisitionDate).format('DD/MM/YYYY') : '—'}</Text>,
    },
    {
      title: 'Costo Original', dataIndex: 'originalCost', width: 130, align: 'right' as const,
      render: (_: any, r: TableRow) => r.isGroup
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>{Q(r.groupCosto)}</Text>
        : <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(r.originalCost)}</Text>,
    },
    {
      title: 'Dep. Acumulada', dataIndex: 'accumulatedDepreciation', width: 130, align: 'right' as const,
      render: (_: any, r: TableRow) => r.isGroup
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#ff7f00' }}>{Q(r.groupDepAcum)}</Text>
        : <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#ff7f00' }}>{Q(r.accumulatedDepreciation)}</Text>,
    },
    {
      title: 'Valor en Libros', dataIndex: 'currentBookValue', width: 130, align: 'right' as const,
      render: (_: any, r: TableRow) => r.isGroup
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{Q(r.groupValLib)}</Text>
        : <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#2ea172' }}>{Q(r.currentBookValue)}</Text>,
    },
    {
      title: '% Amort.', dataIndex: 'pctAmortizado', width: 78, align: 'center' as const,
      render: (_: any, r: TableRow) => {
        if (r.isGroup) return null
        const pct = r.pctAmortizado ?? 0
        const color = pct >= 90 ? '#e5484d' : pct >= 50 ? '#ff7f00' : '#2ea172'
        return <Text style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</Text>
      },
    },
    {
      title: 'Dep. Mensual', dataIndex: 'depreciacionMensual', width: 115, align: 'right' as const,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : r.depreciacionMensual
          ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{Q(r.depreciacionMensual)}</Text>
          : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Fecha de Baja', dataIndex: 'disposedAt', width: 105,
      render: (_: any, r: TableRow) => r.isGroup ? null
        : r.disposedAt
          ? <Text style={{ fontSize: 12, color: '#e5484d' }}>{dayjs(r.disposedAt).format('DD/MM/YYYY')}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Valor de Baja/Venta', dataIndex: 'disposalValue', width: 140, align: 'right' as const,
      render: (_: any, r: TableRow) => r.isGroup
        ? (r.groupBajaValor ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#e5484d' }}>{Q(r.groupBajaValor)}</Text> : null)
        : r.disposalValue
          ? <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#e5484d' }}>{Q(r.disposalValue)}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .af-group-row td { background: #f5f7fa !important; }
        .af-group-row:hover td { background: #eef2f8 !important; }
      `}</style>

      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppstoreOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Reporte de Activos Fijos</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Generado el {dayjs().format('DD/MM/YYYY HH:mm')} · {filtered.length} activos
            </Text>
          </div>
        </div>
        <Space className="no-print" wrap>
          <Button icon={<FileExcelOutlined />} style={{ color: '#2ea172', borderColor: '#2ea172' }}
            onClick={handleExcel}>
            Excel
          </Button>
          <Button icon={<FilePdfOutlined />} style={{ color: '#e5484d', borderColor: '#e5484d' }}
            onClick={() => window.print()}>
            PDF
          </Button>
          <Button icon={<MailOutlined />} onClick={() => setShowEmail(true)}>
            Enviar correo
          </Button>
        </Space>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderLeft: '4px solid #1faec2' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Total activos</Text>}
              value={kpi.totalActivos}
              valueStyle={{ fontSize: 20, color: '#1faec2' }}
            />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>{kpi.countActivos} en operación</Text>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" style={{ borderLeft: '4px solid #1faec2' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Costo original</Text>}
              value={kpi.totalCosto} precision={2} prefix="Q"
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              valueStyle={{ fontSize: 16, color: '#1faec2' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" style={{ borderLeft: '4px solid #ff7f00' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Dep. acumulada</Text>}
              value={kpi.totalDepAcum} precision={2} prefix="Q"
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              valueStyle={{ fontSize: 16, color: '#ff7f00' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" style={{ borderLeft: '4px solid #2ea172' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Valor en libros</Text>}
              value={kpi.totalValLib} precision={2} prefix="Q"
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              valueStyle={{ fontSize: 16, color: '#2ea172' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" style={{ borderLeft: '4px solid #2f54eb' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#6b7280' }}>Dep. mensual en curso</Text>}
              value={kpi.depMensual} precision={2} prefix="Q"
              formatter={v => Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              valueStyle={{ fontSize: 16, color: '#2f54eb' }}
            />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              Anual: Q {(kpi.depMensual * 12).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Baja card (sólo si hay bajas) */}
      {kpi.totalBajas > 0 && (
        <div style={{
          background: '#fff1f0', border: '1px solid #f8c9cb', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#e5484d', fontWeight: 600 }}>
            Bajas / Ventas: {kpi.totalBajas} activos
          </Text>
          <Divider type="vertical" />
          <Text style={{ fontSize: 12, color: '#e5484d' }}>
            Valor recuperado: <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Q(kpi.totalBajaValor)}</Text>
          </Text>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        marginBottom: 16, padding: '10px 14px',
        background: '#fafbfc', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8,
      }}>
        <FilterOutlined style={{ color: '#6b7280' }} />
        <Select allowClear placeholder="Estado" size="small" style={{ width: 130 }}
          value={filtroEstado} onChange={setFiltroEstado}
          options={[
            { value: 'ACTIVO',       label: 'Activo' },
            { value: 'BORRADOR',     label: 'Borrador' },
            { value: 'VENDIDO',      label: 'Vendido' },
            { value: 'DADO_DE_BAJA', label: 'Dado de Baja' },
          ]}
        />
        <Select allowClear showSearch placeholder="Clase de activo" size="small" style={{ width: 200 }}
          value={filtroClase} onChange={setFiltroClase} optionFilterProp="label"
          options={clases.map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        />
        <Select allowClear showSearch placeholder="Centro de Costo" size="small" style={{ width: 170 }}
          value={filtroCC} onChange={setFiltroCC} optionFilterProp="label"
          options={centrosCosto.map(c => ({ value: c.id, label: c.nombre }))}
        />
        <Select allowClear showSearch placeholder="Centro de Beneficio" size="small" style={{ width: 170 }}
          value={filtroCB} onChange={setFiltroCB} optionFilterProp="label"
          options={centrosBeneficio.map(c => ({ value: c.id, label: c.nombre }))}
        />
        {(filtroEstado || filtroClase || filtroCC || filtroCB) && (
          <Button size="small" type="link" onClick={() => {
            setFiltroEstado(undefined); setFiltroClase(undefined)
            setFiltroCC(undefined); setFiltroCB(undefined)
          }}>Limpiar filtros</Button>
        )}
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <Table<TableRow>
        dataSource={tableRows}
        columns={columns}
        loading={loading}
        pagination={false}
        size="small"
        rowKey="key"
        rowClassName={r => r.isGroup ? 'af-group-row' : ''}
        scroll={{ x: 1700 }}
        style={{ border: '1px solid rgba(10,10,10,0.08)', borderRadius: 8, overflow: 'hidden' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: '#fafbfc' }}>
              {/* cols 0-6: N.º | Nombre | Clase | C.Costo | C.Beneficio | Estado | Fecha Adq. */}
              <Table.Summary.Cell index={0} colSpan={7}>
                <Text strong style={{ color: '#1faec2', fontSize: 12 }}>
                  TOTAL GENERAL — {filtered.length} activos
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>{Q(grandTotal.costo)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#ff7f00' }}>{Q(grandTotal.depAcum)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="right">
                <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>{Q(grandTotal.valLib)}</Text>
              </Table.Summary.Cell>
              {/* cols 10-12: % Amort | Dep. Mensual | Fecha de Baja */}
              <Table.Summary.Cell index={10} colSpan={3} />
              <Table.Summary.Cell index={13} align="right">
                {grandTotal.bajaValor > 0 && (
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#e5484d' }}>{Q(grandTotal.bajaValor)}</Text>
                )}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* ── Modal: Enviar correo ─────────────────────────────────────────────── */}
      <Modal
        title="Enviar reporte por correo"
        open={showEmail}
        onCancel={() => { setShowEmail(false); emailForm.resetFields() }}
        footer={null}
        width={420}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Se abrirá tu cliente de correo con el resumen del reporte.
          Adjunta el Excel o PDF que hayas descargado.
        </Text>
        <Form form={emailForm} layout="vertical" onFinish={handleEmail}>
          <Form.Item
            name="email"
            label="Correo del destinatario"
            rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
          >
            <Input placeholder="cfo@empresa.com" size="middle" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setShowEmail(false); emailForm.resetFields() }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<MailOutlined />}
              style={{ background: '#1faec2' }}>
              Abrir correo
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
