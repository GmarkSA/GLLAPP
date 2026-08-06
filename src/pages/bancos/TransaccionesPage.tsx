import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
  Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import AccountSelect from '../../components/AccountSelect'
import { useCompanyStore } from '../../store/companyStore'
import CategorizarDrawer from './CategorizarDrawer'
import { getAsiento, updateAsiento, postAsiento, voidAsiento, type AsientoDetalle } from '../../api/asientos'
import {
  ACCOUNT_TYPE_CONFIG,
  TRANSACTION_STATUS_CONFIG,
  addTransaction,
  deleteTransaction,
  getBankAccount,
  getTransactions,
  importStatement,
  updateTransaction,
  type BankAccount,
  type BankTransaction,
  type TransactionStatus,
  type TransactionType,
} from '../../api/bancos'
import { accountTypeIcon, formGrid, moneyFmt, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function TransactionModal({ open, account, onClose, onSaved }: {
  open: boolean
  account: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!account) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      await addTransaction(account.id, {
        ...values,
        companyId: activeCompany?.id,
        bankAccountId: account.id,
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
        currency: account.currency,
        exchangeRate: values.exchangeRate || 1,
      })
      message.success('Transaccion registrada')
      form.resetFields()
      onSaved()
      onClose()
    } catch {
      message.error('No se pudo registrar la transaccion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Agregar transaccion"
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleSave}
      okText="Registrar"
      okButtonProps={{ loading: saving, style: { background: NAVY } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" size="small" initialValues={{ transactionDate: dayjs(), type: 'debit', exchangeRate: 1 }}>
        <div style={formGrid}>
          <Form.Item name="transactionDate" label="Fecha" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
            <Select options={[
              { value: 'credit', label: 'Ingreso' },
              { value: 'debit', label: 'Egreso' },
            ]} />
          </Form.Item>
          <Form.Item name="amount" label={`Monto ${account?.currency || ''}`} rules={[{ required: true }]}>
            <InputNumber<number>
              min={0}
              precision={2}
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number((v || '').replace(/,/g, ''))}
            />
          </Form.Item>
          <Form.Item name="exchangeRate" label="Tipo de cambio">
            <InputNumber<number> min={0} precision={6} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Descripcion" rules={[{ required: true }]}>
          <Input placeholder="Detalle de la transaccion" />
        </Form.Item>
        <div style={formGrid}>
          <Form.Item name="reference" label="Referencia">
            <Input placeholder="Cheque, deposito, transferencia" />
          </Form.Item>
          <Form.Item name="accountId" label="Cuenta contable">
            <AccountSelect size="small" filter={{}} placeholder="Categorizar con cuenta contable" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

async function parsePdfToMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const allRows: string[][] = []
  const Y_TOL = 5
  const MERGE_GAP = 5
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const byY = new Map<number, Array<{ x: number; xEnd: number; text: string }>>()
    for (const raw of content.items) {
      if (!('str' in raw)) continue
      const { str, transform, width } = raw as { str: string; transform: number[]; width: number }
      if (!str.trim()) continue
      const y = Math.round(transform[5] / Y_TOL) * Y_TOL
      const x = transform[4]
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ x, xEnd: x + Math.abs(width || 0), text: str.trim() })
    }
    const sortedYs = [...byY.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x)
      const cells: string[] = []
      let cur = items[0].text
      let curEnd = items[0].xEnd
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - curEnd
        if (gap < MERGE_GAP) { cur += ' ' + items[i].text; curEnd = Math.max(curEnd, items[i].xEnd) }
        else { cells.push(cur); cur = items[i].text; curEnd = items[i].xEnd }
      }
      cells.push(cur)
      allRows.push(cells)
    }
  }
  return allRows
}

function ImportModal({ open, account, onClose, onSaved }: {
  open: boolean
  account: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const [rows,      setRows]      = useState<any[]>([])
  const [saving,    setSaving]    = useState(false)
  const [isPdf,     setIsPdf]     = useState(false)
  const [rawMatrix, setRawMatrix] = useState<any[][] | null>(null)
  // Inicializar al mes actual para que el primer upload de PDF funcione sin configurar nada
  const [periodMonth, setPeriodMonth] = useState<number>(dayjs().month() + 1)
  const [periodYear,  setPeriodYear]  = useState<number>(dayjs().year())

  // Quita tildes y normaliza a minúsculas para comparaciones robustas
  const normStr = (s: string) =>
    String(s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // parseDate recibe mes/año explícitos para evitar closures obsoletos
  const parseDate = (raw: unknown, month: number, year: number): string => {
    if (typeof raw === 'number' && raw > 40_000 && raw < 60_000) {
      const dt = new Date(Math.round((raw - 25569) * 86_400_000))
      const y = dt.getUTCFullYear(), mo = String(dt.getUTCMonth() + 1).padStart(2, '0'), d = String(dt.getUTCDate()).padStart(2, '0')
      return `${y}-${mo}-${d}`
    }
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getUTCFullYear(), mo = String(raw.getUTCMonth() + 1).padStart(2, '0'), d = String(raw.getUTCDate()).padStart(2, '0')
      return `${y}-${mo}-${d}`
    }
    const s = String(raw || '').trim()
    // Solo día numérico 1–31 (PDF correo Banco Industrial)
    if (/^\d{1,2}$/.test(s)) {
      const d = parseInt(s)
      if (d >= 1 && d <= 31 && month && year)
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) {
      const sep = s[2]; const [d, m, y] = s.split(sep)
      return `${y}-${m}-${d}`
    }
    const p = dayjs(s); return p.isValid() ? p.format('YYYY-MM-DD') : ''
  }

  // Parsea CSV como texto plano para preservar las fechas exactamente como aparecen.
  // XLSX auto-convierte fechas ambiguas (DD ≤ 12) a seriales numéricos cuando DD y MM
  // son intercambiables (por ejemplo "01-06-2026" lo lee como MM-DD-YYYY = enero 6).
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = []
    for (const line of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
      const cols: string[] = []
      let field = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { field += '"'; i++ }
          else inQ = !inQ
        } else if (c === ',' && !inQ) {
          cols.push(field); field = ''
        } else field += c
      }
      cols.push(field)
      if (cols.some(c => c.trim() !== '')) rows.push(cols)
    }
    return rows
  }

  // parseRows recibe mes/año explícitos para poder re-parsear sin stale closures
  const parseRows = (allRows: any[][], month: number, year: number) => {
    const noEmpty = allRows.filter(r => r.some(c => c !== undefined && c !== null && c !== ''))

    // Detectar fila de encabezado real: acepta "Fecha" (Excel BI) y "Día"/"Dia" (PDF BI correo)
    let headerIdx = 0
    for (let i = 0; i < Math.min(noEmpty.length, 20); i++) {
      const f = normStr(String(noEmpty[i][0] || ''))
      if (f === 'fecha' || f === 'dia') { headerIdx = i; break }
    }
    const head = noEmpty[headerIdx] as string[]
    const body = noEmpty.slice(headerIdx + 1)

    // Comparación sin tildes — cubre ambos formatos BI:
    //   Excel: Fecha | TT | Descripción | No. Doc | Debe  | Haber  | Saldo
    //   PDF:   Día   | Doc.| Descripción | Débito  | Crédito| Saldo
    const col = (needle: string) =>
      head.findIndex((h: string) => normStr(String(h)).startsWith(normStr(needle)))

    const iDate  = col('fecha') >= 0 ? col('fecha') : col('dia') >= 0 ? col('dia') : 0
    const iDesc  = col('descrip') >= 0 ? col('descrip') : 1
    const iRef   = col('no. doc') >= 0 ? col('no. doc')
                 : col('doc.') >= 0    ? col('doc.')
                 : col('doc')  >= 0    ? col('doc') : -1
    const iDebe  = col('debe') >= 0   ? col('debe')
                 : col('debito') >= 0  ? col('debito') : 2
    const iHaber = col('haber') >= 0  ? col('haber')
                 : col('credito') >= 0 ? col('credito')
                 : col('abono') >= 0   ? col('abono') : iDebe + 1
    const iSaldo = col('saldo') >= 0 ? col('saldo') : -1

    return body
      .map(cols => {
        const transactionDate = parseDate(cols[iDate], month, year)
        const description = String(cols[iDesc] ?? '').trim()
        const debitAmt  = Number(String(cols[iDebe]  ?? '').replace(/[^0-9.-]/g, ''))
        const creditAmt = Number(String(cols[iHaber] ?? '').replace(/[^0-9.-]/g, ''))
        const amount = creditAmt > 0 ? creditAmt : Math.abs(debitAmt)
        if (!transactionDate || !description || !amount) return null
        return {
          transactionDate,
          description,
          amount,
          type: creditAmt > 0 ? 'credit' : 'debit',
          reference: iRef >= 0 && cols[iRef] ? String(cols[iRef]) : undefined,
          runningBalance: iSaldo >= 0 && cols[iSaldo] ? Number(String(cols[iSaldo]).replace(/[^0-9.-]/g, '')) : undefined,
        }
      })
      .filter(Boolean)
  }

  const beforeUpload = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const pdfFile = ext === 'pdf'
    setIsPdf(pdfFile)
    const buffer = await file.arrayBuffer()
    let parsed: any[][]
    try {
      if (pdfFile) {
        parsed = await parsePdfToMatrix(buffer)
        setRawMatrix(parsed)  // guardar para re-parsear al cambiar período
      } else if (ext === 'csv') {
        parsed = parseCSV(new TextDecoder().decode(buffer).replace(/^﻿/, ''))
        setRawMatrix(null)
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        parsed = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
        setRawMatrix(null)
      }
      setRows(parseRows(parsed, periodMonth, periodYear))
    } catch {
      message.error(`No se pudo leer el archivo ${pdfFile ? 'PDF' : 'Excel/CSV'}`)
    }
    return false
  }

  // Cambia mes y re-parsea inmediatamente si ya hay una matriz PDF cargada
  const handleMonthChange = (m: number) => {
    setPeriodMonth(m)
    if (rawMatrix) setRows(parseRows(rawMatrix, m, periodYear))
  }

  // Cambia año y re-parsea inmediatamente si ya hay una matriz PDF cargada
  const handleYearChange = (y: number) => {
    setPeriodYear(y)
    if (rawMatrix) setRows(parseRows(rawMatrix, periodMonth, y))
  }

  const handleImport = async () => {
    if (!account || rows.length === 0) return
    setSaving(true)
    try {
      const res = await importStatement(account.id, { rows })
      message.success(`Importadas: ${res.imported} - Duplicadas/omitidas: ${res.skipped}`)
      setRows([])
      setRawMatrix(null)
      onSaved()
      onClose()
    } catch {
      message.error('No se pudo importar el estado de cuenta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Importar estado de cuenta"
      open={open}
      width={760}
      onCancel={() => { setRows([]); setRawMatrix(null); setIsPdf(false); onClose() }}
      footer={[
        <Button key="cancel" onClick={() => { setRows([]); setRawMatrix(null); setIsPdf(false); onClose() }}>Cancelar</Button>,
        <Button key="import" type="primary" disabled={!rows.length} loading={saving} onClick={handleImport} style={{ background: NAVY }}>
          Importar {rows.length || ''} movimientos
        </Button>,
      ]}
      destroyOnClose
    >
      {/* Selector de período siempre visible — necesario para PDF BI que muestra solo el día */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', background: '#f8f9fc', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}>
        <span style={{ color: '#6b7280' }}>Período del estado:</span>
        <Select size="small" value={periodMonth} onChange={handleMonthChange} style={{ width: 120 }}
          options={[{v:1,l:'Enero'},{v:2,l:'Febrero'},{v:3,l:'Marzo'},{v:4,l:'Abril'},{v:5,l:'Mayo'},{v:6,l:'Junio'},{v:7,l:'Julio'},{v:8,l:'Agosto'},{v:9,l:'Septiembre'},{v:10,l:'Octubre'},{v:11,l:'Noviembre'},{v:12,l:'Diciembre'}].map(x=>({value:x.v,label:x.l}))} />
        <Select size="small" value={periodYear} onChange={handleYearChange} style={{ width: 82 }}
          options={Array.from({length:4},(_,i)=>({value:dayjs().year()-i,label:String(dayjs().year()-i)}))} />
        <span style={{ color: '#9aa1ab', fontSize: 11 }}>Requerido para PDF Banco Industrial (muestra solo el día)</span>
      </div>
      <Upload.Dragger beforeUpload={beforeUpload} showUploadList={false} accept=".xlsx,.xls,.csv,.pdf">
        <p className="ant-upload-drag-icon">
          {isPdf ? <FilePdfOutlined style={{ color: '#e5484d' }} /> : <FileExcelOutlined style={{ color: NAVY }} />}
        </p>
        <p className="ant-upload-text">Arrastra o selecciona un archivo Excel, CSV o PDF</p>
        <p className="ant-upload-hint">Estado de cuenta Banco Industrial y otros bancos guatemaltecos.</p>
      </Upload.Dragger>
      {rows.length > 0 && (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          dataSource={rows}
          rowKey={(_, i) => String(i)}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content', y: 320 }}
          columns={[
            { title: 'Fecha', dataIndex: 'transactionDate', width: 105, render: (v: string) => dayjs(v).isValid() ? dayjs(v).format('DD/MM/YYYY') : v },
            { title: 'Descripcion', dataIndex: 'description', ellipsis: true },
            { title: 'Ref.', dataIndex: 'reference', width: 90 },
            { title: 'Tipo', dataIndex: 'type', width: 90, render: (v: string) => <Tag color={v === 'credit' ? '#2ea172' : '#e5484d'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
            { title: 'Monto', dataIndex: 'amount', width: 120, align: 'right', render: (v: number) => moneyFmt(Number(v), account?.currency) },
          ]}
        />
      )}
    </Modal>
  )
}

function PolizaModal({ jeId, isForeign, onClose }: {
  jeId: string | null
  isForeign: boolean
  onClose: () => void
}) {
  const [je, setJe]           = useState<AsientoDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [date, setDate]       = useState('')
  const [rate, setRate]       = useState<number>(1)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!jeId) return
    setLoading(true)
    setEditing(false)
    getAsiento(jeId).then(d => { setJe(d); setDate(String(d.entryDate).split('T')[0]); setRate(d.exchangeRate ?? 1) }).catch(() => setJe(null)).finally(() => setLoading(false))
  }, [jeId])

  const handleSave = async () => {
    if (!jeId) return
    setSaving(true)
    try {
      const updated = await updateAsiento(jeId, { entryDate: date || undefined, exchangeRate: isForeign ? rate : undefined })
      setJe(updated)
      setEditing(false)
      message.success('Póliza actualizada')
    } catch {
      message.error('No se pudo actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!jeId) return
    setSaving(true)
    try {
      const updated = await postAsiento(jeId)
      setJe(updated)
      message.success('Póliza publicada — ya impacta en reportes financieros')
    } catch {
      message.error('No se pudo publicar la póliza')
    } finally {
      setSaving(false)
    }
  }

  const fmtQ = (n: number) => n === 0 ? '—' : `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

  return (
    <Modal
      title={je ? `Póliza ${je.entryNumber}` : 'Póliza contable'}
      open={!!jeId}
      onCancel={onClose}
      footer={null}
      width={620}
    >
      {loading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
      {!loading && je && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Text type="secondary" style={{ fontSize: 11 }}>FECHA</Text><div><Text strong>{String(je.entryDate).split('T')[0].split('-').reverse().join('/')}</Text></div></div>
            <div><Text type="secondary" style={{ fontSize: 11 }}>ESTADO</Text><div><Tag color={je.status === 'posted' ? '#2ea172' : '#ff7f00'}>{je.status}</Tag></div></div>
            {isForeign && <div><Text type="secondary" style={{ fontSize: 11 }}>TIPO DE CAMBIO</Text><div><Text strong>{je.exchangeRate}</Text></div></div>}
          </div>

          {editing && (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isForeign ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <Text style={{ fontSize: 12 }}>Fecha del asiento</Text>
                  <Input size="small" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                {isForeign && (
                  <div>
                    <Text style={{ fontSize: 12 }}>Tipo de cambio (GTQ)</Text>
                    <InputNumber size="small" min={0.000001} precision={6} value={rate} onChange={v => setRate(Number(v) || 1)} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
              <Space>
                <Button size="small" type="primary" loading={saving} style={{ background: NAVY }} onClick={handleSave}>Guardar</Button>
                <Button size="small" onClick={() => setEditing(false)}>Cancelar</Button>
              </Space>
            </div>
          )}

          <Table
            size="small"
            dataSource={je.lines}
            rowKey={(_, i) => String(i)}
            pagination={false}
            columns={[
              { title: 'Cuenta', ellipsis: true, render: (_: any, l: any) => <Text style={{ fontSize: 12 }}>{l.accountCode} — {l.accountName}</Text> },
              { title: 'Debe',  dataIndex: 'debit',  width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: v > 0 ? '#1faec2' : '#ccc' }}>{fmtQ(v)}</Text> },
              { title: 'Haber', dataIndex: 'credit', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: v > 0 ? '#2ea172' : '#ccc' }}>{fmtQ(v)}</Text> },
            ]}
            style={{ marginBottom: 12 }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button icon={<FileTextOutlined />} onClick={() => setEditing(v => !v)}>
                {editing ? 'Cancelar edición' : 'Editar fecha / tipo de cambio'}
              </Button>
              {je.status === 'draft' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={saving}
                  style={{ background: '#2ea172', borderColor: '#2ea172' }}
                  onClick={handlePublish}
                >
                  Publicar póliza
                </Button>
              )}
            </Space>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </>
      )}
      {!loading && !je && <Text type="secondary">No se encontró la póliza contable.</Text>}
    </Modal>
  )
}

export default function TransaccionesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TransactionStatus | undefined>()
  const [type, setType] = useState<TransactionType | undefined>()
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [categorizarTx, setCategorizarTx] = useState<BankTransaction | null>(null)
  const [polizaJeId, setPolizaJeId]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getBankAccount(id)
      .then(setAccount)
      .catch(() => {
        message.error('Cuenta bancaria no encontrada')
        navigate('/bancos')
      })
  }, [id, navigate])

  const loadTransactions = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [res, acc] = await Promise.all([
        getTransactions(id, {
          page,
          limit: 50,
          search: search || undefined,
          status,
          type,
          fromDate: dates?.[0]?.format('YYYY-MM-DD'),
          toDate: dates?.[1]?.format('YYYY-MM-DD'),
        }),
        getBankAccount(id),
      ])
      setTransactions(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
      setAccount(acc)
    } catch {
      setTransactions([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dates, id, page, search, status, type])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const summary = useMemo(() => {
    const incoming = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0)
    const outgoing = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0)
    const pending = transactions.filter(t => t.status === 'pending').length
    return { incoming, outgoing, pending }
  }, [transactions])

  const fmtDate = (d: string) => {
    const s = String(d || '').split('T')[0]
    if (!s || s <= '1970-01-01') return <Text type="secondary">—</Text>
    const [y, m, day] = s.split('-')
    return `${day}/${m}/${y}`
  }

  const handleDelete = async (txId: string) => {
    try {
      await deleteTransaction(id!, txId)
      message.success('Movimiento eliminado')
      loadTransactions()
    } catch {
      message.error('No se pudo eliminar')
    }
  }

  const columns: ColumnsType<BankTransaction> = [
    {
      title: 'Fecha',
      dataIndex: 'transactionDate',
      width: 100,
      fixed: 'left',
      defaultSortOrder: 'ascend',
      sorter: (a, b) => String(a.transactionDate).localeCompare(String(b.transactionDate)),
      render: fmtDate,
    },
    {
      title: 'Descripción / Referencia',
      dataIndex: 'description',
      ellipsis: true,
      render: (v, row) => (
        <div>
          <Text strong>{v}</Text>
          {row.reference && <div style={{ fontSize: 12, color: '#6b7280' }}>Ref. {row.reference}</div>}
        </div>
      ),
    },
    {
      title: 'Haber (Ingreso)',
      key: 'haber',
      width: 150,
      align: 'right',
      render: (_, row) => row.type === 'credit'
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#2ea172' }}>+ {moneyFmt(Number(row.amount), account?.currency)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Debe (Egreso)',
      key: 'debe',
      width: 150,
      align: 'right',
      render: (_, row) => row.type === 'debit'
        ? <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: '#e5484d' }}>- {moneyFmt(Number(row.amount), account?.currency)}</Text>
        : <Text type="secondary">—</Text>,
    },
    { title: 'Saldo', dataIndex: 'runningBalance', width: 130, align: 'right', render: v => v == null ? <Text type="secondary">—</Text> : <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{moneyFmt(Number(v), account?.currency)}</Text> },
    { title: 'Estado', dataIndex: 'status', width: 120, render: v => {
      const cfg = TRANSACTION_STATUS_CONFIG[v as TransactionStatus] || TRANSACTION_STATUS_CONFIG.pending
      return <Tag color={cfg.color}>{cfg.label}</Tag>
    } },
    { title: 'Cuenta contable', key: 'account', width: 180, render: (_, row) => row.accountName || row.accountCode ? <Tooltip title={row.accountName}><Tag color="#6b7280">{row.accountCode || row.accountName}</Tag></Tooltip> : <Tag color="#ff7f00">Sin categorizar</Tag> },
    {
      title: '',
      key: 'actions',
      width: 130,
      fixed: 'right',
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          {(row.status === 'categorized' || row.status === 'reconciled') && (
            <Tooltip title={row.matchedJournalEntryId ? 'Ver póliza contable' : 'Sin póliza registrada'}>
              <Button
                size="small" type="text"
                icon={<FileTextOutlined style={{ color: row.matchedJournalEntryId ? NAVY : 'rgba(10,10,10,0.08)' }} />}
                disabled={!row.matchedJournalEntryId}
                onClick={() => row.matchedJournalEntryId && setPolizaJeId(row.matchedJournalEntryId)}
              />
            </Tooltip>
          )}
          {row.status === 'categorized' ? (
            <>
              <Tooltip title="Marcar conciliada">
                <Button
                  size="small" type="text" icon={<CheckCircleOutlined style={{ color: '#2ea172' }} />}
                  onClick={() => Modal.confirm({
                    title: 'Marcar como conciliada',
                    content: 'Esta accion deja preparada la transaccion para conciliacion formal.',
                    okText: 'Confirmar',
                    okButtonProps: { style: { background: NAVY } },
                    onOk: async () => { await updateTransaction(id!, row.id, { status: 'reconciled' }); loadTransactions() },
                  })}
                />
              </Tooltip>
              <Tooltip title="Marcar pendiente">
                <Button
                  size="small" type="text" icon={<RollbackOutlined style={{ color: '#ff7f00' }} />}
                  onClick={() => Modal.confirm({
                    title: 'Marcar como pendiente',
                    content: row.matchedJournalEntryId
                      ? 'La transacción volverá a Pendiente y su póliza contable será anulada.'
                      : 'La transacción volverá a estado Pendiente para ser recategorizada.',
                    okText: 'Confirmar',
                    onOk: async () => {
                      if (row.matchedJournalEntryId) {
                        await voidAsiento(row.matchedJournalEntryId).catch(() => null)
                      }
                      await updateTransaction(id!, row.id, {
                        status: 'pending',
                        matchedJournalEntryId: null,
                        matchedInvoiceId: null,
                        matchedPaymentId: null,
                        accountId: null,
                        accountCode: null,
                        accountName: null,
                      } as any)
                      loadTransactions()
                    },
                  })}
                />
              </Tooltip>
            </>
          ) : row.status !== 'reconciled' ? (
            <Tooltip title="Categorizar">
              <Button
                size="small" type="text" icon={<TagsOutlined style={{ color: NAVY }} />}
                onClick={() => setCategorizarTx(row)}
              />
            </Tooltip>
          ) : null}
          <Popconfirm title="¿Eliminar este movimiento?" onConfirm={() => handleDelete(row.id)} okText="Sí" cancelText="No">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!account) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <Spin size="large" />
      </div>
    )
  }

  const cfg = ACCOUNT_TYPE_CONFIG[account.type]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: `${cfg.color}16`,
          }}>
            {accountTypeIcon(account.type, cfg.color)}
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>{account.name}</Title>
            <Text type="secondary">{account.bankName} - {account.currency}</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<CheckCircleOutlined />} onClick={() => navigate(`/bancos/${account.id}/conciliacion`)}>Conciliacion</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Importar estado</Button>
          <Button icon={<ControlOutlined />} onClick={() => navigate('/bancos/reglas')}>Reglas bancarias</Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: NAVY }} onClick={() => setTransactionOpen(true)}>Agregar transaccion</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card size="small" style={panelStyle}><Statistic title="Saldo sistema" value={account.currentBalance} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: NAVY, fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Ingresos filtrados" value={summary.incoming} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: '#2ea172', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Egresos filtrados" value={summary.outgoing} formatter={v => moneyFmt(Number(v), account.currency)} valueStyle={{ color: '#e5484d', fontSize: 18 }} /></Card>
        <Card size="small" style={panelStyle}><Statistic title="Pendientes" value={summary.pending} valueStyle={{ color: summary.pending ? '#ff7f00' : '#2ea172', fontSize: 18 }} /></Card>
      </div>

      <Card size="small" style={{ ...panelStyle, marginBottom: 12 }}>
        <Space wrap>
          <Input.Search size="small" allowClear placeholder="Buscar descripcion o referencia" value={search} onChange={e => setSearch(e.target.value)} onSearch={() => { setPage(1); loadTransactions() }} style={{ width: 280 }} />
          <RangePicker size="small" format="DD/MM/YYYY" onChange={v => { setDates(v as any); setPage(1) }} />
          <Select allowClear size="small" placeholder="Tipo" value={type} onChange={v => { setType(v); setPage(1) }} style={{ width: 130 }} options={[
            { value: 'credit', label: 'Ingresos' },
            { value: 'debit', label: 'Egresos' },
          ]} />
          <Select allowClear size="small" placeholder="Estado" value={status} onChange={v => { setStatus(v); setPage(1) }} style={{ width: 170 }} options={Object.entries(TRANSACTION_STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))} />
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={loadTransactions}>Actualizar</Button>
        </Space>
      </Card>

      <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
        <Table<BankTransaction>
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
          pagination={{ current: page, pageSize: 50, total, showTotal: t => `${t} registros`, onChange: setPage }}
        />
      </Card>

      <TransactionModal open={transactionOpen} account={account} onClose={() => setTransactionOpen(false)} onSaved={loadTransactions} />
      <ImportModal open={importOpen} account={account} onClose={() => setImportOpen(false)} onSaved={loadTransactions} />
      <CategorizarDrawer
        open={!!categorizarTx}
        transaction={categorizarTx}
        account={account}
        onClose={() => setCategorizarTx(null)}
        onSaved={loadTransactions}
      />
      <PolizaModal
        jeId={polizaJeId}
        isForeign={account.currency !== 'GTQ'}
        onClose={() => setPolizaJeId(null)}
      />
    </div>
  )
}
