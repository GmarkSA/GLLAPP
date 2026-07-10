import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Typography, Spin, message, Tag, Space, Tooltip, Table, Progress,
} from 'antd'
import {
  ArrowLeftOutlined, WarningOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getPresupuestoVsReal, type BudgetVsReal, type BudgetVsRealRow,
  PERIODO_LABELS, STATUS_COLOR, STATUS_LABEL,
} from '../../../api/presupuesto'

const { Title, Text } = Typography

const ALERTA_COLOR: Record<string, string> = {
  OVER_BUDGET: '#cf1322',
  WARNING:     '#d4640a',
}

const ALERTA_ICON: Record<string, React.ReactNode> = {
  OVER_BUDGET: <ExclamationCircleOutlined style={{ color: '#cf1322' }} />,
  WARNING:     <WarningOutlined style={{ color: '#d4640a' }} />,
}

function fmtQ(n: number) {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
}

function VarianzaCell({ varianza, porcentaje, alerta }: { varianza: number; porcentaje: number | null; alerta: string | null }) {
  const color = alerta ? ALERTA_COLOR[alerta] : varianza >= 0 ? '#389e0d' : '#cf1322'
  return (
    <span style={{ color, fontWeight: 600 }}>
      {varianza >= 0 ? '+' : ''}{fmtQ(varianza)}
      {porcentaje !== null && (
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
          ({porcentaje >= 0 ? '+' : ''}{porcentaje.toFixed(1)}%)
        </Text>
      )}
    </span>
  )
}

export default function PresupuestoVsRealPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data,    setData]    = useState<BudgetVsReal | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try { setData(await getPresupuestoVsReal(id)) }
    catch { message.error('Error al cargar el reporte') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>

  const { budget, rows } = data
  const labels = PERIODO_LABELS[budget.periodo]
  const periodoCount = labels.length

  const alertCount = rows.filter(r => r.alertaGlobal).length

  // Columnas dinámicas por período
  const periodoColumns = labels.map((label, idx) => {
    const p = idx + 1
    return {
      title: <span style={{ fontSize: 11 }}>{label} {budget.anioFiscal}</span>,
      key:   `periodo_${p}`,
      width: 240,
      render: (_: any, row: BudgetVsRealRow) => {
        const per = row.periodos.find(pe => pe.periodo === p)
        if (!per) return <span style={{ color: '#bfbfbf' }}>—</span>
        const pct = per.presupuestado > 0 ? Math.min(100, (per.real / per.presupuestado) * 100) : 0
        const barColor = per.alerta === 'OVER_BUDGET' ? '#cf1322' : per.alerta === 'WARNING' ? '#d4640a' : '#1B3A6B'
        return (
          <div style={{ fontSize: 11, lineHeight: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8c8c8c' }}>Pres.</span>
              <span>{fmtQ(per.presupuestado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8c8c8c' }}>Real</span>
              <span style={{ fontWeight: per.real > 0 ? 600 : 400 }}>{fmtQ(per.real)}</span>
            </div>
            <Progress
              percent={pct} showInfo={false} size={['100%', 4] as any}
              strokeColor={barColor}
              style={{ margin: '2px 0' }}
            />
            {per.alerta && (
              <Tooltip title={per.alerta === 'OVER_BUDGET' ? 'Gasto supera presupuesto' : 'Gasto cerca del límite (>90%)'}>
                <span style={{ color: ALERTA_COLOR[per.alerta], fontSize: 11, cursor: 'help' }}>
                  {ALERTA_ICON[per.alerta]} {per.alerta === 'OVER_BUDGET' ? 'Excedido' : 'Advertencia'}
                </span>
              </Tooltip>
            )}
          </div>
        )
      },
    }
  })

  const columns = [
    {
      title: 'CUENTA',
      dataIndex: 'accountName',
      fixed: 'left' as const,
      width: 220,
      render: (v: string, row: BudgetVsRealRow) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{row.accountCode}</div>
          {row.alertaGlobal && (
            <Tag color={row.alertaGlobal === 'OVER_BUDGET' ? 'red' : 'orange'} style={{ fontSize: 10, marginTop: 2 }}>
              {ALERTA_ICON[row.alertaGlobal]}{' '}
              {row.alertaGlobal === 'OVER_BUDGET' ? 'EXCEDIDO' : 'ADVERTENCIA'}
            </Tag>
          )}
        </div>
      ),
    },
    ...periodoColumns,
    {
      title: 'TOTAL',
      key: 'total',
      fixed: 'right' as const,
      width: 180,
      render: (_: any, row: BudgetVsRealRow) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Pres.</Text>
            <span>{fmtQ(row.totalPresupuestado)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Real</Text>
            <span style={{ fontWeight: 600 }}>{fmtQ(row.totalReal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <Text type="secondary">Var.</Text>
            <VarianzaCell
              varianza={row.totalVarianza}
              porcentaje={row.totalPresupuestado > 0 ? (row.totalVarianza / row.totalPresupuestado) * 100 : null}
              alerta={row.alertaGlobal}
            />
          </div>
        </div>
      ),
    },
  ]

  // Separar filas por tipo
  const incomeRows  = rows.filter(r => r.accountType === 'INCOME')
  const expenseRows = rows.filter(r => r.accountType === 'EXPENSE')
  const otherRows   = rows.filter(r => !['INCOME', 'EXPENSE'].includes(r.accountType ?? ''))

  const renderSection = (title: string, sectionRows: BudgetVsRealRow[], accentColor: string) => {
    if (!sectionRows.length) return null
    const totalPres = sectionRows.reduce((s, r) => s + r.totalPresupuestado, 0)
    const totalReal = sectionRows.reduce((s, r) => s + r.totalReal, 0)
    const totalVar  = sectionRows.reduce((s, r) => s + r.totalVarianza, 0)
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{
          padding: '6px 12px', background: accentColor, color: '#fff',
          borderRadius: '4px 4px 0 0', fontWeight: 700, fontSize: 13,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{title}</span>
          <Space style={{ fontSize: 12, fontWeight: 400 }}>
            <span>Pres: {fmtQ(totalPres)}</span>
            <span>Real: {fmtQ(totalReal)}</span>
            <span style={{ color: totalVar >= 0 ? '#d9f7be' : '#ffccc7' }}>
              Var: {totalVar >= 0 ? '+' : ''}{fmtQ(totalVar)}
            </span>
          </Space>
        </div>
        <Table
          dataSource={sectionRows} columns={columns} rowKey="accountId"
          size="small" pagination={false} scroll={{ x: 'max-content' }}
          bordered
          rowClassName={row => row.alertaGlobal === 'OVER_BUDGET' ? 'row-over-budget' : row.alertaGlobal === 'WARNING' ? 'row-warning' : ''}
          style={{ borderRadius: '0 0 4px 4px', overflow: 'hidden' }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .row-over-budget { background: #fff2f0 !important; }
        .row-over-budget:hover > td { background: #ffe7e4 !important; }
        .row-warning { background: #fffbe6 !important; }
        .row-warning:hover > td { background: #fff3c4 !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/contabilidad/presupuesto/${id}`)}>
          Volver al presupuesto
        </Button>
        <Title level={4} style={{ margin: 0, color: '#1B3A6B' }}>
          {budget.nombre} — Presupuesto vs Real
        </Title>
        <Tag color={STATUS_COLOR[budget.status]}>{STATUS_LABEL[budget.status]}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(budget.fechaInicio).format('DD MMM YYYY')} – {dayjs(budget.fechaFin).format('DD MMM YYYY')}
        </Text>
      </div>

      {/* Alertas resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {alertCount > 0 ? (
          <>
            {rows.filter(r => r.alertaGlobal === 'OVER_BUDGET').length > 0 && (
              <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExclamationCircleOutlined style={{ color: '#cf1322', fontSize: 18 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#cf1322', fontSize: 13 }}>
                    {rows.filter(r => r.alertaGlobal === 'OVER_BUDGET').length} cuenta(s) excedidas
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>El gasto real supera el presupuesto</div>
                </div>
              </div>
            )}
            {rows.filter(r => r.alertaGlobal === 'WARNING').length > 0 && (
              <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined style={{ color: '#d4640a', fontSize: 18 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#d4640a', fontSize: 13 }}>
                    {rows.filter(r => r.alertaGlobal === 'WARNING').length} cuenta(s) en advertencia
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>El gasto supera el 90% del presupuesto</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <div style={{ fontWeight: 600, color: '#389e0d', fontSize: 13 }}>Todo dentro del presupuesto</div>
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>Actualizar</Button>
        </div>
      </div>

      {renderSection('Ingresos', incomeRows, '#1B3A6B')}
      {renderSection('Gastos',   expenseRows, '#5c5c8a')}
      {otherRows.length > 0 && renderSection('Activo, Pasivo y Capital', otherRows, '#6b7280')}
    </div>
  )
}
