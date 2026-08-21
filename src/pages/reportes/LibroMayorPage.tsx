import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Space, Typography, Select,
  Button, Segmented, InputNumber,
} from 'antd'
import {
  BookOutlined, DownloadOutlined, ArrowLeftOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getLibroMayor, getCuentasConMovimientos, exportReporte,
  type LibroMayorMovement, type LibroMayorData,
} from '../../api/reportes'

const { Text, Title } = Typography

type ViewMode = 'resumido' | 'detallado'

type FlatRow =
  | { _type: 'acct-header'; d: LibroMayorData; _key: string }
  | { _type: 'opening';     d: LibroMayorData; _key: string }
  | { _type: 'movement';    d: LibroMayorData; mov: LibroMayorMovement; idx: number; _key: string }
  | { _type: 'closing';     d: LibroMayorData; _key: string }

const MESES = [
  { value: 1,  label: 'Enero' },      { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },      { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },       { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },      { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },  { value: 12, label: 'Diciembre' },
]
const CUR_YEAR = dayjs().year()
const ANIOS = Array.from({ length: 6 }, (_, i) => ({ value: CUR_YEAR - i, label: String(CUR_YEAR - i) }))

const fmtQ     = (n: number) => n === 0 ? '—' : `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const fmtQFull = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
const balColor = (n: number) => n >= 0 ? '#374151' : '#e5484d'

export default function LibroMayorPage() {
  const navigate = useNavigate()
  const today = dayjs()
  const [selectedMonth, setSelectedMonth] = useState(today.month() + 1)
  const [selectedYear,  setSelectedYear]  = useState(today.year())
  const [viewMode,      setViewMode]      = useState<ViewMode>('resumido')
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [mayorData,     setMayorData]     = useState<LibroMayorData[]>([])
  const [loading,       setLoading]       = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [folio,         setFolio]         = useState<number>(1)

  const fromDate = dayjs().year(selectedYear).month(selectedMonth - 1).startOf('month').format('YYYY-MM-DD')
  const toDate   = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month').format('YYYY-MM-DD')

  const load = useCallback(async () => {
    setLoading(true)
    setMayorData([])
    setAccountFilter('')
    try {
      const ctaList = await getCuentasConMovimientos({ fromDate, toDate })
      if (!ctaList?.length) return
      const results = await Promise.all(
        ctaList.map(c => getLibroMayor(c.id, { fromDate, toDate }).catch(() => null))
      )
      setMayorData(results.filter(Boolean) as LibroMayorData[])
    } catch {
      setMayorData([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const filteredData = accountFilter
    ? mayorData.filter(d => d.account.id === accountFilter)
    : mayorData

  const totalDebit  = filteredData.reduce((s, d) => s + d.totalDebit,  0)
  const totalCredit = filteredData.reduce((s, d) => s + d.totalCredit, 0)

  // ── RESUMIDO ──────────────────────────────────────────────────────────────
  const resumidoColumns = [
    {
      title: 'Código', width: 110,
      render: (_: any, d: LibroMayorData) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#1faec2' }}>
          {d.account.code}
        </Text>
      ),
    },
    {
      title: 'Cuenta',
      render: (_: any, d: LibroMayorData) => (
        <Text style={{ fontSize: 12 }}>{d.account.name}</Text>
      ),
    },
    {
      title: 'Tipo', width: 100,
      render: (_: any, d: LibroMayorData) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{d.account.balanceType}</Text>
      ),
    },
    {
      title: 'Saldo Inicial', width: 150, align: 'right' as const,
      render: (_: any, d: LibroMayorData) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: balColor(d.openingBalance) }}>
          {fmtQ(d.openingBalance)}
        </Text>
      ),
    },
    {
      title: 'Débito', width: 150, align: 'right' as const,
      render: (_: any, d: LibroMayorData) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: d.totalDebit > 0 ? '#1faec2' : '#bbb' }}>
          {fmtQ(d.totalDebit)}
        </Text>
      ),
    },
    {
      title: 'Crédito', width: 150, align: 'right' as const,
      render: (_: any, d: LibroMayorData) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: d.totalCredit > 0 ? '#2ea172' : '#bbb' }}>
          {fmtQ(d.totalCredit)}
        </Text>
      ),
    },
    {
      title: 'Saldo Final', width: 150, align: 'right' as const,
      render: (_: any, d: LibroMayorData) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: balColor(d.closingBalance) }}>
          {fmtQFull(d.closingBalance)}
        </Text>
      ),
    },
  ]

  // ── DETALLADO flat rows ───────────────────────────────────────────────────
  // Columns: [0]Fecha [1]Descripción [2]Póliza/Ref [3]Debe [4]Haber [5]Saldo
  const flatRows: FlatRow[] = filteredData.flatMap(d => [
    { _type: 'acct-header' as const, d, _key: `ah-${d.account.id}` },
    { _type: 'opening'     as const, d, _key: `op-${d.account.id}` },
    ...d.movements.map((mov, idx) => ({
      _type: 'movement' as const, d, mov, idx, _key: `mv-${d.account.id}-${idx}`,
    })),
    { _type: 'closing' as const, d, _key: `cl-${d.account.id}` },
  ])

  const flatColumns = [
    {
      title: 'Fecha', width: 110,
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header') return { colSpan: 6 }
        if (row._type === 'opening')     return { colSpan: 5 }
        if (row._type === 'closing')     return { colSpan: 3 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type === 'acct-header') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Text strong style={{ fontSize: 12, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>
                {row.d.account.code}
              </Text>
              <Text strong style={{ fontSize: 13 }}>{row.d.account.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{row.d.account.balanceType}</Text>
            </div>
          )
        }
        if (row._type === 'opening') {
          return (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Saldo inicial al {dayjs(fromDate).format('DD/MM/YYYY')}
            </Text>
          )
        }
        if (row._type === 'closing') {
          return <Text strong style={{ fontSize: 11, color: '#374151' }}>Totales del período</Text>
        }
        return (
          <Text style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {dayjs(row.mov.date).format('DD/MM/YYYY')}
          </Text>
        )
      },
    },
    {
      title: 'Descripción',
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening' || row._type === 'closing') return { colSpan: 0 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type !== 'movement') return null
        return (
          <div>
            <Text style={{ fontSize: 12 }}>{row.mov.description}</Text>
            {row.mov.contactName && (
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{row.mov.contactName}</Text>
            )}
          </div>
        )
      },
    },
    {
      title: 'Póliza / Ref.', width: 160,
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening' || row._type === 'closing') return { colSpan: 0 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type !== 'movement') return null
        return (
          <Space size={4}>
            <Text style={{ fontSize: 11, color: '#1faec2', fontVariantNumeric: 'tabular-nums' }}>
              {row.mov.entryNumber}
            </Text>
            {row.mov.reference && (
              <Text type="secondary" style={{ fontSize: 10 }}>· {row.mov.reference}</Text>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Debe', width: 130, align: 'right' as const,
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening') return { colSpan: 0 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening') return null
        const v = row._type === 'closing' ? row.d.totalDebit : row.mov.debit
        return (
          <Text strong={row._type === 'closing'}
            style={{ fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#1faec2' : '#bbb' }}>
            {fmtQ(v)}
          </Text>
        )
      },
    },
    {
      title: 'Haber', width: 130, align: 'right' as const,
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening') return { colSpan: 0 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type === 'acct-header' || row._type === 'opening') return null
        const v = row._type === 'closing' ? row.d.totalCredit : row.mov.credit
        return (
          <Text strong={row._type === 'closing'}
            style={{ fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#2ea172' : '#bbb' }}>
            {fmtQ(v)}
          </Text>
        )
      },
    },
    {
      title: 'Saldo', width: 140, align: 'right' as const,
      onCell: (row: FlatRow) => {
        if (row._type === 'acct-header') return { colSpan: 0 }
        return {}
      },
      render: (_: any, row: FlatRow) => {
        if (row._type === 'acct-header') return null
        if (row._type === 'opening') {
          return (
            <Text style={{ fontVariantNumeric: 'tabular-nums', color: balColor(row.d.openingBalance) }}>
              {fmtQFull(row.d.openingBalance)}
            </Text>
          )
        }
        const v = row._type === 'closing' ? row.d.closingBalance : row.mov.balance
        return (
          <Text strong={row._type === 'closing'}
            style={{ fontVariantNumeric: 'tabular-nums', color: balColor(v) }}>
            {fmtQFull(v)}
          </Text>
        )
      },
    },
  ]

  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = { fromDate, toDate, mode: viewMode, folio: String(folio) }
      if (accountFilter) params.accountId = accountFilter
      await exportReporte('libro-mayor', 'excel', params)
    } finally { setExporting(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')} style={{ marginTop: 2 }} />
          <BookOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Libro Mayor</Title>
            <Text type="secondary">Movimientos por cuenta contable en el período</Text>
          </div>
        </div>
        <Space>
          <Text style={{ fontSize: 12, color: '#555' }}>Folio:</Text>
          <InputNumber
            min={1}
            value={folio}
            onChange={v => setFolio(v ?? 1)}
            style={{ width: 70 }}
            size="small"
          />
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
            disabled={filteredData.length === 0}
          >
            Exportar Excel
          </Button>
        </Space>
      </div>

      {/* Filtros */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Select
              value={selectedMonth}
              onChange={v => setSelectedMonth(v)}
              options={MESES}
              style={{ width: 130 }}
              size="middle"
            />
            <Select
              value={selectedYear}
              onChange={v => setSelectedYear(v)}
              options={ANIOS}
              style={{ width: 90 }}
              size="middle"
            />
            <Segmented
              options={[
                { label: 'Resumido',   value: 'resumido' },
                { label: 'Detallado', value: 'detallado' },
              ]}
              value={viewMode}
              onChange={v => { setViewMode(v as ViewMode); setAccountFilter('') }}
            />
            {viewMode === 'detallado' && (
              <Select
                showSearch
                allowClear
                style={{ width: 300 }}
                placeholder="Filtrar por cuenta..."
                value={accountFilter || undefined}
                onChange={v => setAccountFilter(v ?? '')}
                optionFilterProp="label"
                options={mayorData.map(d => ({
                  value: d.account.id,
                  label: `${d.account.code} — ${d.account.name}`,
                }))}
              />
            )}
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
              Actualizar
            </Button>
          </Space>
          <Space split={<span style={{ color: '#e2e8f0' }}>|</span>} size={16}>
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Cuentas </Text>
              <Text strong style={{ fontSize: 13, color: '#374151' }}>{filteredData.length}</Text>
            </span>
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Debe </Text>
              <Text strong style={{ fontSize: 13, color: '#1faec2' }}>
                Q {totalDebit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </span>
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Haber </Text>
              <Text strong style={{ fontSize: 13, color: '#2ea172' }}>
                Q {totalCredit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </Text>
            </span>
          </Space>
        </div>
      </Card>

      {/* Tabla */}
      <Card
        bordered={false}
        style={{ borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        {viewMode === 'resumido' ? (
          <Table
            columns={resumidoColumns}
            dataSource={filteredData}
            rowKey={d => d.account.id}
            loading={loading}
            size="small"
            pagination={false}
            scroll={{ x: 900, y: 'calc(100vh - 350px)' }}
            summary={() => filteredData.length === 0 ? null : (
              <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Text strong>Total General</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1faec2' }}>
                    Q {totalDebit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>
                    Q {totalCredit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            locale={{ emptyText: 'Sin cuentas con movimientos en el período' }}
          />
        ) : (
          <Table
            columns={flatColumns}
            dataSource={flatRows}
            rowKey="_key"
            loading={loading}
            size="small"
            pagination={false}
            scroll={{ x: 800, y: 'calc(100vh - 350px)' }}
            rowClassName={(row: FlatRow) => {
              if (row._type === 'acct-header') return 'row-lm-header'
              if (row._type === 'opening')     return 'row-lm-opening'
              if (row._type === 'closing')     return 'row-lm-closing'
              return ''
            }}
            locale={{ emptyText: 'Sin cuentas con movimientos en el período' }}
          />
        )}
      </Card>
      <style>{`
        .row-lm-header  td { background: #f0f6ff !important; border-top: 4px solid #d1e3ff !important; border-bottom: 1px solid #d1e3ff !important; }
        .row-lm-opening td { background: #fafbff !important; font-style: italic; }
        .row-lm-closing td { background: #f8fafc !important; border-top: 1px solid #e2e8f0 !important; border-bottom: 3px solid #d1e3ff !important; }
      `}</style>
    </div>
  )
}
