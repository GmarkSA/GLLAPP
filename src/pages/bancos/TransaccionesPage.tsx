import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  DatePicker,
  Empty,
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
  CloseOutlined,
  ControlOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LockOutlined,
  MailOutlined,
  PrinterOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SyncOutlined,
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
  approveReconciliationPeriod,
  listReconciliationPeriods,
  reabrirReconciliationPeriod,
  saveReconciliationPeriod,
  sendEmailConciliacion,
  updateTransaction,
  type BankAccount,
  type BankTransaction,
  type ReconciliationPeriod,
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

    // Detectar fila de encabezado real buscando la fila con más palabras clave de columnas.
    // Soporta ambos formatos BI:
    //   Excel: Fecha | TT | Descripción | No. Doc | Debe   | Haber   | Saldo
    //   PDF:   Día   | Doc.| Descripción | Débito  | Crédito| Saldo
    const HEADER_KEYWORDS = ['dia', 'fecha', 'descrip', 'debe', 'haber', 'debito', 'credito', 'saldo', 'doc']
    let headerIdx = -1
    let bestScore = 0
    for (let i = 0; i < Math.min(noEmpty.length, 60); i++) {
      const cells = noEmpty[i].map((c: any) => normStr(String(c || '')))
      const score = HEADER_KEYWORDS.filter(kw => cells.some(c => c.startsWith(kw))).length
      if (score > bestScore) { bestScore = score; headerIdx = i }
      if (score >= 4) break   // suficiente confianza — no seguir buscando
    }
    if (headerIdx < 0 || bestScore < 2) headerIdx = 0   // fallback

    const head = noEmpty[headerIdx] as string[]
    const body = noEmpty.slice(headerIdx + 1)

    // Mapear columnas por nombre (sin tildes)
    const col = (needle: string) =>
      head.findIndex((h: string) => normStr(String(h)).startsWith(normStr(needle)))

    const iDate  = col('fecha') >= 0 ? col('fecha') : col('dia') >= 0 ? col('dia') : 0
    const iDesc  = col('descrip') >= 0 ? col('descrip') : -1
    const iRef   = col('no. doc') >= 0 ? col('no. doc')
                 : col('doc.') >= 0    ? col('doc.')
                 : col('doc')  >= 0    ? col('doc') : -1
    const iDebe  = col('debe') >= 0   ? col('debe')
                 : col('debito') >= 0  ? col('debito') : -1
    const iHaber = col('haber') >= 0  ? col('haber')
                 : col('credito') >= 0 ? col('credito')
                 : col('abono') >= 0   ? col('abono') : -1
    const iSaldo = col('saldo') >= 0 ? col('saldo') : -1

    // Inicializar saldo desde fila SALDO ANTERIOR para clasificar correctamente la primera transacción.
    // Sin esto, prevSaldo=0 y la primera fila (saldo ~300k) siempre se clasifica como credit aunque sea débito.
    let prevSaldo = 0
    for (const row of body) {
      const joined = row.map((c: any) => String(c || '').toUpperCase()).join(' ')
      if (joined.includes('SALDO ANTERIOR') || joined.includes('SALDO INI')) {
        for (const cell of row) {
          const num = Number(String(cell).replace(/[^0-9.,]/g, '').replace(/,/g, ''))
          if (num > 100) { prevSaldo = num; break }
        }
        break
      }
    }

    return body
      .map(cols => {
        const transactionDate = parseDate(cols[iDate], month, year)

        // Descripción: columna mapeada; si no hay mapeo o el valor es solo dígitos
        // (probablemente es un número de referencia), intentar la columna siguiente
        let description = iDesc >= 0 ? String(cols[iDesc] ?? '').trim() : ''
        if (!description || /^\d+$/.test(description)) {
          // Buscar primera columna no-numérica que no sea la fecha ni referencia
          const fallbackIdx = cols.findIndex((_: any, ci: number) =>
            ci !== iDate && ci !== iRef && ci !== iDebe && ci !== iHaber && ci !== iSaldo
            && /[a-zA-Z]/.test(String(cols[ci] ?? ''))
          )
          if (fallbackIdx >= 0) description = String(cols[fallbackIdx]).trim()
        }

        // Montos: cuando el PDF omite celdas vacías (Débito o Crédito en blanco),
        // la fila de datos es más corta que el header y los índices se corren.
        // Solución: si la fila es más corta y Saldo está mapeado →
        //   penúltimo valor = monto transacción, último = saldo corriente.
        //   El tipo se deduce comparando saldo corriente con el anterior.
        let amount = 0
        let txType: 'credit' | 'debit' = 'credit'
        let runningBal: number | undefined

        if (iSaldo >= 0 && cols.length < head.length) {
          const curSaldo = Number(String(cols[cols.length - 1] ?? '').replace(/[^0-9.-]/g, ''))
          const txAmt    = Number(String(cols[cols.length - 2] ?? '').replace(/[^0-9.-]/g, ''))
          if (txAmt > 0) {
            amount      = txAmt
            txType      = curSaldo >= prevSaldo ? 'credit' : 'debit'
            prevSaldo   = curSaldo
            runningBal  = curSaldo
          }
        } else {
          const effectiveDebe  = iDebe  >= 0 ? iDebe  : (iDate === 0 ? 2 : iDate + 2)
          const effectiveHaber = iHaber >= 0 ? iHaber : effectiveDebe + 1
          const debitAmt  = Number(String(cols[effectiveDebe]  ?? '').replace(/[^0-9.-]/g, ''))
          const creditAmt = Number(String(cols[effectiveHaber] ?? '').replace(/[^0-9.-]/g, ''))
          amount = creditAmt > 0 ? creditAmt : Math.abs(debitAmt)
          txType = creditAmt > 0 ? 'credit' : 'debit'
          if (iSaldo >= 0 && cols[iSaldo] !== undefined) {
            prevSaldo  = Number(String(cols[iSaldo]).replace(/[^0-9.-]/g, '')) || prevSaldo
            runningBal = prevSaldo || undefined
          }
        }

        if (!transactionDate || !description || !amount) return null
        return {
          transactionDate,
          description,
          amount,
          type: txType,
          reference: iRef >= 0 && cols[iRef] ? String(cols[iRef]) : undefined,
          runningBalance: runningBal,
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
      width={960}
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
          pagination={{ pageSize: 10, showTotal: t => `${t} movimientos` }}
          scroll={{ y: 380 }}
          columns={[
            { title: 'Fecha',       dataIndex: 'transactionDate', width: 110,
              render: (v: string) => dayjs(v).isValid() ? dayjs(v).format('DD/MM/YYYY') : v },
            { title: 'Descripcion', dataIndex: 'description', ellipsis: true, minWidth: 220 },
            { title: 'Ref.',        dataIndex: 'reference',        width: 100 },
            { title: 'Tipo',        dataIndex: 'type',             width: 100,
              render: (v: string) => <Tag color={v === 'credit' ? '#2ea172' : '#e5484d'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
            { title: 'Monto',       dataIndex: 'amount',           width: 140, align: 'right',
              render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{moneyFmt(Number(v), account?.currency)}</span> },
            { title: 'Saldo',       dataIndex: 'runningBalance',   width: 140, align: 'right',
              render: (v: number | undefined) => v != null && v > 0
                ? <span style={{ fontVariantNumeric: 'tabular-nums', color: '#6b7280', fontSize: 12 }}>{moneyFmt(v, account?.currency)}</span>
                : <span style={{ color: '#d1d5db' }}>—</span> },
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
  const [conciliarOpen, setConciliarOpen]  = useState(false)
  const [conciliarMes,  setConciliarMes]   = useState<number>(dayjs().month() + 1)
  const [conciliarAnio, setConciliarAnio]  = useState<number>(dayjs().year())
  const [conciliarSaldo, setConciliarSaldo] = useState<number | null>(null)
  const readSession = (accountId: string | undefined) => {
    if (!accountId) return null
    try {
      const stored = localStorage.getItem(`conciliacion_${accountId}`)
      return stored ? (JSON.parse(stored) as { month: number; year: number; saldo: number }) : null
    } catch { localStorage.removeItem(`conciliacion_${accountId}`); return null }
  }
  const [activeSession, setActiveSession]  = useState<{ month: number; year: number; saldo: number } | null>(() => readSession(id))
  const [periods, setPeriods]             = useState<ReconciliationPeriod[]>([])
  const [showHistorialTx, setShowHistorialTx] = useState(false)
  const [showCerrarTx, setShowCerrarTx]   = useState(false)
  const [cerrarSaldo, setCerrarSaldo]     = useState<number | null>(null)
  const [savingPeriodTx, setSavingPeriodTx] = useState(false)
  const [showEmailTx, setShowEmailTx]     = useState(false)
  const [emailToTx, setEmailToTx]         = useState('')
  const [emailCcTx, setEmailCcTx]         = useState('')
  const [emailMesTx, setEmailMesTx]       = useState<number>(dayjs().month() + 1)
  const [emailAnioTx, setEmailAnioTx]     = useState<number>(dayjs().year())
  const [sendingEmailTx, setSendingEmailTx] = useState(false)

  const mesesTx = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  // Actualizar sesión activa al volver desde otra página (el componente se remonta)
  useEffect(() => { setActiveSession(readSession(id)) }, [id])

  // Cargar períodos históricos cuando hay sesión activa
  useEffect(() => {
    if (!id || !activeSession) return
    listReconciliationPeriods(id).then(setPeriods).catch(() => null)
  }, [id, activeSession])

  const handleCerrarPeriodTx = async () => {
    if (!id || !activeSession || cerrarSaldo == null || !account) return
    setSavingPeriodTx(true)
    try {
      const { month, year } = activeSession
      const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
      const toDate   = dayjs(fromDate).endOf('month').format('YYYY-MM-DD')
      const txRes    = await getTransactions(id, { limit: 2000, fromDate, toDate })
      const txs      = txRes.data || []
      const totalCredito    = txs.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
      const totalDebito     = txs.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0)
      const reconciledCount = txs.filter(t => t.status === 'reconciled').length
      const pendingCount    = txs.filter(t => t.status === 'pending').length
      const pendingNet      = txs.filter(t => t.status === 'pending').reduce((s, t) => s + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0)
      const diferencia      = Math.abs(pendingNet)
      const saldoSistema    = cerrarSaldo - pendingNet
      await saveReconciliationPeriod(id, {
        month, year, saldoBanco: cerrarSaldo, saldoSistema, diferencia,
        totalCredito, totalDebito, totalTransactions: txs.length, reconciledCount, pendingCount,
      })
      message.success(`Período ${mesesTx[month - 1]} ${year} cerrado correctamente`)
      localStorage.removeItem(`conciliacion_${id}`)
      setActiveSession(null)
      setShowCerrarTx(false)
      listReconciliationPeriods(id).then(setPeriods).catch(() => null)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo cerrar el período')
    } finally {
      setSavingPeriodTx(false)
    }
  }

  const handleSendEmailTx = async () => {
    if (!id || !emailToTx) return
    setSendingEmailTx(true)
    try {
      const res = await sendEmailConciliacion(id, { to: emailToTx, cc: emailCcTx || undefined, month: emailMesTx, year: emailAnioTx })
      if (res.sent) { message.success(`Correo enviado a ${emailToTx}`); setShowEmailTx(false) }
      else message.warning('El servidor de correo no está configurado.')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo enviar el correo')
    } finally {
      setSendingEmailTx(false)
    }
  }

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
          {activeSession ? (
            <Button.Group>
              <Button
                icon={<SyncOutlined spin />}
                style={{ background: '#ff7f00', borderColor: '#ff7f00', color: '#fff' }}
                onClick={() => navigate(`/bancos/${account.id}/conciliacion?month=${activeSession.month}&year=${activeSession.year}&refSaldo=${activeSession.saldo}`)}
              >
                Conciliacion en proceso ({mesesTx[activeSession.month - 1]})
              </Button>
              <Button
                icon={<CloseOutlined />}
                style={{ borderColor: '#ff7f00', color: '#ff7f00' }}
                title="Terminar sesión de conciliación"
                onClick={() => { localStorage.removeItem(`conciliacion_${account.id}`); setActiveSession(null) }}
              />
            </Button.Group>
          ) : (
            <Button icon={<CheckCircleOutlined />} onClick={() => {
              setConciliarMes(dayjs().month() + 1)
              setConciliarAnio(dayjs().year())
              setConciliarSaldo(null)
              setConciliarOpen(true)
            }}>Conciliacion</Button>
          )}
          {activeSession && (
            <>
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => { listReconciliationPeriods(id!).then(setPeriods).catch(() => null); setShowHistorialTx(true) }}
              >
                Historial ({periods.length})
              </Button>
              <Button
                size="small"
                icon={<LockOutlined />}
                onClick={() => { setCerrarSaldo(activeSession.saldo); setShowCerrarTx(true) }}
              >
                Cerrar período
              </Button>
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/bancos/${account?.id}/conciliacion/imprimir?month=${activeSession.month}&year=${activeSession.year}`, '_blank')}
              >
                Imprimir / PDF
              </Button>
              <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => {
                  setEmailToTx(''); setEmailCcTx('')
                  setEmailMesTx(activeSession.month); setEmailAnioTx(activeSession.year)
                  setShowEmailTx(true)
                }}
              >
                Enviar correo
              </Button>
            </>
          )}
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

      <Modal
        title="Iniciar conciliacion bancaria"
        open={conciliarOpen}
        onCancel={() => setConciliarOpen(false)}
        okText="Iniciar conciliacion"
        okButtonProps={{ style: { background: NAVY }, disabled: conciliarSaldo == null }}
        onOk={() => {
          if (conciliarSaldo == null) { message.warning('Ingresa el saldo al cierre del estado de cuenta'); return }
          const session = { month: conciliarMes, year: conciliarAnio, saldo: conciliarSaldo }
          localStorage.setItem(`conciliacion_${account.id}`, JSON.stringify(session))
          setActiveSession(session)
          setConciliarOpen(false)
          navigate(`/bancos/${account.id}/conciliacion?month=${conciliarMes}&year=${conciliarAnio}&refSaldo=${conciliarSaldo}`)
        }}
      >
        <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Mes y año a conciliar</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Select
                size="small"
                value={conciliarMes}
                onChange={setConciliarMes}
                options={['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((label, i) => ({ value: i + 1, label }))}
              />
              <Select
                size="small"
                value={conciliarAnio}
                onChange={setConciliarAnio}
                options={Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i).map(y => ({ value: y, label: String(y) }))}
              />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Saldo al cierre del estado de cuenta bancario</div>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              prefix="Q"
              min={0}
              precision={2}
              placeholder="0.00"
              value={conciliarSaldo}
              onChange={v => setConciliarSaldo(v)}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Ingresa el saldo final que aparece en tu estado de cuenta del banco para este mes.
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Historial de conciliaciones ────────────────────────────────────── */}
      <Modal
        title={<><HistoryOutlined /> Historial de conciliaciones</>}
        open={showHistorialTx}
        onCancel={() => setShowHistorialTx(false)}
        footer={null}
        width={820}
      >
        {periods.length === 0 ? (
          <Empty description="Sin períodos guardados aún" />
        ) : (
          <Table<ReconciliationPeriod>
            size="small"
            dataSource={[...periods].sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month)}
            rowKey="id"
            pagination={false}
            columns={[
              { title: 'Período', render: (_, r) => `${mesesTx[r.month - 1]} ${r.year}`, width: 120 },
              { title: 'Saldo banco', dataIndex: 'saldoBanco', align: 'right', width: 130, render: v => moneyFmt(Number(v)) },
              { title: 'Sin conciliar', dataIndex: 'diferencia', align: 'right', width: 120, render: v => (
                <span style={{ color: Number(v) < 0.01 ? '#2ea172' : '#e5484d' }}>{moneyFmt(Number(v))}</span>
              )},
              { title: 'Estado', dataIndex: 'status', width: 95, render: v => (
                <Tag color={v === 'approved' ? '#2ea172' : v === 'closed' ? NAVY : '#ff7f00'}>
                  {v === 'approved' ? 'Aprobado' : v === 'closed' ? 'Cerrado' : 'Borrador'}
                </Tag>
              )},
              { title: 'Usuario', width: 140, render: (_, r) => (
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {r.approvedByName || r.closedByName || '—'}
                </span>
              )},
              {
                title: 'Acciones', key: 'acciones', width: 210,
                render: (_, r) => (
                  <Space size={4}>
                    <Tooltip title={`Imprimir / PDF ${mesesTx[r.month - 1]} ${r.year}`}>
                      <Button
                        size="small"
                        icon={<PrinterOutlined />}
                        onClick={() => window.open(`/bancos/${account?.id}/conciliacion/imprimir?month=${r.month}&year=${r.year}`, '_blank')}
                      />
                    </Tooltip>
                    {r.status === 'closed' && (
                      <Tooltip title="Aprobar y bloquear el período">
                        <Button
                          size="small"
                          type="primary"
                          style={{ background: '#2ea172', borderColor: '#2ea172', fontSize: 11 }}
                          onClick={async () => {
                            try {
                              const updated = await approveReconciliationPeriod(id!, r.id)
                              setPeriods(prev => prev.map(p => p.id === r.id ? updated : p))
                              message.success(`Período ${mesesTx[r.month - 1]} ${r.year} aprobado`)
                            } catch (e: any) { message.error(e?.response?.data?.message || 'Error al aprobar') }
                          }}
                        >
                          Aprobar
                        </Button>
                      </Tooltip>
                    )}
                    {(r.status === 'closed' || r.status === 'approved') && (
                      <Tooltip title={r.status === 'approved' ? 'Revertir a Cerrado para re-editar' : 'Reabrir para re-conciliar'}>
                        <Button
                          size="small"
                          danger={r.status === 'approved'}
                          style={{ fontSize: 11 }}
                          onClick={async () => {
                            try {
                              const updated = await reabrirReconciliationPeriod(id!, r.id)
                              setPeriods(prev => prev.map(p => p.id === r.id ? updated : p))
                              message.success(`Período ${mesesTx[r.month - 1]} ${r.year} reabierto`)
                            } catch (e: any) { message.error(e?.response?.data?.message || 'Error al reabrir') }
                          }}
                        >
                          {r.status === 'approved' ? 'Habilitar' : 'Reabrir'}
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* ── Cerrar período ─────────────────────────────────────────────────── */}
      <Modal
        title={<><LockOutlined /> Cerrar período de conciliación</>}
        open={showCerrarTx}
        onCancel={() => setShowCerrarTx(false)}
        okText="Cerrar período"
        okButtonProps={{ style: { background: NAVY }, loading: savingPeriodTx, disabled: cerrarSaldo == null }}
        onOk={handleCerrarPeriodTx}
        width={420}
      >
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Período a cerrar</Typography.Text>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {activeSession ? `${mesesTx[activeSession.month - 1]} ${activeSession.year}` : '—'}
            </div>
          </div>
          <div>
            <Typography.Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Saldo al cierre del estado de cuenta</Typography.Text>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              prefix="Q"
              min={0}
              precision={2}
              placeholder="0.00"
              value={cerrarSaldo}
              onChange={v => setCerrarSaldo(v)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Enviar correo ──────────────────────────────────────────────────── */}
      <Modal
        title={<><MailOutlined /> Enviar conciliación por correo</>}
        open={showEmailTx}
        onCancel={() => setShowEmailTx(false)}
        okText="Enviar correo"
        okButtonProps={{ style: { background: NAVY }, loading: sendingEmailTx, disabled: !emailToTx }}
        onOk={handleSendEmailTx}
        width={440}
      >
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <Typography.Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Período a enviar</Typography.Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Select
                size="small"
                value={emailMesTx}
                onChange={setEmailMesTx}
                options={mesesTx.map((label, i) => ({ value: i + 1, label }))}
              />
              <Select
                size="small"
                value={emailAnioTx}
                onChange={setEmailAnioTx}
                options={Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i).map(y => ({ value: y, label: String(y) }))}
              />
            </div>
          </div>
          <div>
            <Typography.Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Para (correo destino) <span style={{ color: '#e5484d' }}>*</span></Typography.Text>
            <Input
              size="small"
              placeholder="correo@empresa.com"
              value={emailToTx}
              onChange={e => setEmailToTx(e.target.value)}
              onPressEnter={handleSendEmailTx}
            />
          </div>
          <div>
            <Typography.Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>CC (opcional)</Typography.Text>
            <Input size="small" placeholder="copia@empresa.com" value={emailCcTx} onChange={e => setEmailCcTx(e.target.value)} />
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            El correo incluirá el resumen de saldos y un enlace al PDF de {mesesTx[emailMesTx - 1]} {emailAnioTx}.
          </Typography.Text>
        </div>
      </Modal>
    </div>
  )
}
