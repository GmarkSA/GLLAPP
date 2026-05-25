import { type ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Space, DatePicker, Tooltip, Modal, Form, Input, Select,
  message, Spin, Alert, Typography, Tag,
} from 'antd'
import {
  ArrowLeftOutlined, FileExcelOutlined, FilePdfOutlined,
  PrinterOutlined, InfoCircleOutlined, NumberOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { exportReporte, nextCorrelativo, type CorrelativoData } from '../api/reportes'

const { RangePicker } = DatePicker
const { Text } = Typography

interface ReportLayoutProps {
  title: string
  subtitle: string
  tipoExport: string        // e.g. 'balance-general'
  loading?: boolean
  error?: string | null
  children: ReactNode
  /** For reports with a single date instead of range */
  singleDate?: boolean
  date?: string
  fromDate?: string
  toDate?: string
  onDateChange?: (date: string) => void
  onRangeChange?: (from: string, to: string) => void
  /** Extra toolbar elements (e.g. comparison toggle) */
  extra?: ReactNode
  /** Export params to include (date, fromDate, toDate etc.) */
  exportParams?: Record<string, string>
}

const YEAR_PRESETS = [
  { label: 'Este año', from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') },
  { label: 'Año pasado', from: dayjs().subtract(1,'year').startOf('year').format('YYYY-MM-DD'), to: dayjs().subtract(1,'year').endOf('year').format('YYYY-MM-DD') },
  { label: 'Q1', from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().month(2).endOf('month').format('YYYY-MM-DD') },
  { label: 'Q2', from: dayjs().month(3).startOf('month').format('YYYY-MM-DD'), to: dayjs().month(5).endOf('month').format('YYYY-MM-DD') },
  { label: 'Q3', from: dayjs().month(6).startOf('month').format('YYYY-MM-DD'), to: dayjs().month(8).endOf('month').format('YYYY-MM-DD') },
  { label: 'Q4', from: dayjs().month(9).startOf('month').format('YYYY-MM-DD'), to: dayjs().month(11).endOf('month').format('YYYY-MM-DD') },
]

export default function ReportLayout({
  title, subtitle, tipoExport, loading, error, children,
  singleDate, date, fromDate, toDate,
  onDateChange, onRangeChange,
  extra, exportParams = {},
}: ReportLayoutProps) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [folioOpen, setFolioOpen] = useState(false)
  const [folioData, setFolioData] = useState<CorrelativoData | null>(null)
  const [folioForm] = Form.useForm()

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = { ...exportParams }
    if (singleDate && date)  p.date     = date
    if (!singleDate && fromDate) p.fromDate = fromDate
    if (!singleDate && toDate)   p.toDate   = toDate
    return p
  }

  const handleExport = async (fmt: 'excel' | 'pdf') => {
    setExporting(true)
    try {
      await exportReporte(tipoExport, fmt, buildParams())
      message.success(`Descargando ${fmt === 'excel' ? 'Excel' : 'PDF'}...`)
    } catch {
      message.error('Error al exportar. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  const handleFolioOpen = async () => {
    const year = (singleDate ? date : fromDate)?.substring(0, 4)
    try {
      const data = await nextCorrelativo(tipoExport, year)
      setFolioData(data)
      folioForm.setFieldsValue({
        correlativo: data.current_correlativo,
        folio: data.folio_start,
        fiscal_year: data.fiscal_year,
      })
      setFolioOpen(true)
    } catch {
      setFolioOpen(true)
    }
  }

  const handleFolioExport = async (fmt: 'excel' | 'pdf') => {
    const vals = folioForm.getFieldsValue()
    setExporting(true)
    setFolioOpen(false)
    try {
      await exportReporte(tipoExport, fmt, {
        ...buildParams(),
        folio:       String(vals.folio || ''),
        correlativo: String(vals.correlativo || ''),
      })
      message.success('Exportando con folio y correlativo...')
    } catch {
      message.error('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16, flexWrap: 'wrap', gap: 12,
      }}>
        <Space align="start">
          <Button
            type="text" icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/reportes')}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1B3A6B' }}>{title}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
          </div>
        </Space>

        <Space wrap size={8}>
          {/* Date / Range picker */}
          {singleDate ? (
            <DatePicker
              value={date ? dayjs(date) : dayjs()}
              onChange={d => onDateChange?.(d?.format('YYYY-MM-DD') || '')}
              allowClear={false}
              placeholder="Fecha de corte"
              style={{ width: 140 }}
            />
          ) : (
            <Space size={4} wrap>
              {YEAR_PRESETS.map(p => (
                <Button
                  key={p.label} size="small"
                  type={fromDate === p.from && toDate === p.to ? 'primary' : 'default'}
                  onClick={() => onRangeChange?.(p.from, p.to)}
                  style={{ fontSize: 11, padding: '0 8px' }}
                >
                  {p.label}
                </Button>
              ))}
              <RangePicker
                value={fromDate && toDate ? [dayjs(fromDate), dayjs(toDate)] : null}
                onChange={vals => {
                  if (vals?.[0] && vals?.[1]) {
                    onRangeChange?.(vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD'))
                  }
                }}
                allowClear={false}
                style={{ width: 220 }}
              />
            </Space>
          )}

          {extra}

          {/* Export actions */}
          <Tooltip title="Exportar Excel">
            <Button
              icon={<FileExcelOutlined />}
              loading={exporting}
              onClick={() => handleExport('excel')}
              style={{ color: '#217346', borderColor: '#217346' }}
            >
              Excel
            </Button>
          </Tooltip>
          <Tooltip title="Exportar PDF">
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={() => handleExport('pdf')}
              style={{ color: '#c0392b', borderColor: '#c0392b' }}
            >
              PDF
            </Button>
          </Tooltip>
          <Tooltip title="Imprimir desde el navegador">
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} />
          </Tooltip>
          <Tooltip title="Exportar con folio y correlativo SAT">
            <Button
              icon={<NumberOutlined />}
              onClick={handleFolioOpen}
              type="dashed"
            >
              Folio / Correlativo
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Error */}
      {error && (
        <Alert
          type="warning"
          message={error}
          description="Esto puede deberse a que no hay asientos contables registrados aún. Los reportes se actualizarán automáticamente al ingresar movimientos."
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Tooltip title="Los reportes se basan en asientos contables publicados (estado 'posted'). Crea asientos en Contabilidad → Libro Diario.">
              <Button type="text" icon={<InfoCircleOutlined />} size="small">Info</Button>
            </Tooltip>
          }
        />
      )}

      {/* Content */}
      <Spin spinning={!!loading}>
        <div id="report-print-area">
          {children}
        </div>
      </Spin>

      {/* Folio / Correlativo Modal */}
      <Modal
        title={
          <Space>
            <NumberOutlined style={{ color: '#1677ff' }} />
            Folio y Correlativo SAT
          </Space>
        }
        open={folioOpen}
        onCancel={() => setFolioOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setFolioOpen(false)}>Cancelar</Button>
            <Button icon={<FilePdfOutlined />} type="primary" danger onClick={() => handleFolioExport('pdf')}>
              Exportar PDF con folio
            </Button>
            <Button icon={<FileExcelOutlined />} type="primary" onClick={() => handleFolioExport('excel')}
              style={{ background: '#217346', borderColor: '#217346' }}>
              Exportar Excel con folio
            </Button>
          </Space>
        }
        width={440}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Cumplimiento Tributario Guatemala (SAT)"
          description={
            <div style={{ fontSize: 12 }}>
              Según el Código de Comercio de Guatemala (Decreto 2-70) Art. 373 y Ley del ISR, los libros contables
              deben ser habilitados por la SAT. Cada libro tiene un <b>folio</b> (número de página) y un{' '}
              <b>correlativo</b> que reinicia cada año fiscal. El sistema registra el correlativo automáticamente.
            </div>
          }
        />
        <Form form={folioForm} layout="vertical">
          <Form.Item name="fiscal_year" label="Año Fiscal">
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="correlativo"
            label={
              <Space size={4}>
                Correlativo del reporte
                <Tooltip title="Número secuencial del libro contable para este año fiscal. Se incrementa automáticamente.">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
          >
            <Input addonBefore="#" disabled />
          </Form.Item>
          <Form.Item
            name="folio"
            label={
              <Space size={4}>
                Folio (número de página inicial)
                <Tooltip title="Número de la primera página de este reporte en el libro habilitado por SAT.">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
          >
            <Input type="number" min={1} addonBefore="Folio" />
          </Form.Item>
        </Form>
        {folioData && (
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">
              Correlativo {folioData.current_correlativo} · Año {folioData.fiscal_year}
            </Tag>
            {folioData.last_generated && (
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                Último: {new Date(folioData.last_generated).toLocaleString('es-GT')}
              </Text>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
