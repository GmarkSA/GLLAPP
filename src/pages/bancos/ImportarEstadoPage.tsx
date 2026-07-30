import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Select, Space, Table, Tag, Typography, Upload, message, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, FileExcelOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import {
  getBankAccounts,
  getImportHistory,
  importStatement,
  money,
  type BankAccount,
  type BankImportBatch,
  type TransactionType,
} from '../../api/bancos'
import { formGrid, NAVY, pageHeaderStyle, panelStyle } from './bancosShared'

const { Title, Text } = Typography

type ParsedRow = {
  transactionDate: string
  description: string
  amount: number
  type: TransactionType
  reference?: string
  runningBalance?: number
}

const cleanNumber = (value: unknown) => Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0

// ── PDF: extrae texto de cada página agrupando por coordenada Y ───────────────
async function parsePdfToMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const allRows: string[][] = []
  const Y_TOL        = 5   // tolerancia en pts para agrupar ítems en la misma fila
  const MERGE_GAP    = 5   // pts — si la brecha entre ítems es menor se fusionan como una celda

  for (let p = 1; p <= pdf.numPages; p++) {
    const page   = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Agrupar ítems de texto por Y redondeado
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

    // Ordenar filas top-to-bottom (Y en PDF crece hacia arriba → orden descendente)
    const sortedYs = [...byY.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x)
      const cells: string[] = []
      let cur    = items[0].text
      let curEnd = items[0].xEnd

      for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - curEnd
        if (gap <= MERGE_GAP) {
          // Mismo "token" — fusionar (agregar espacio si hay brecha visible)
          cur += (gap > 0 ? ' ' : '') + items[i].text
        } else {
          cells.push(cur)
          cur = items[i].text
        }
        curEnd = Math.max(curEnd, items[i].xEnd)
      }
      cells.push(cur)
      if (cells.length > 0) allRows.push(cells)
    }
  }

  return allRows
}

export default function ImportarEstadoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState(searchParams.get('accountId') || undefined)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<any[][]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string>()
  const [isPdf, setIsPdf] = useState(false)
  const [history, setHistory] = useState<BankImportBatch[]>([])
  const [loading, setLoading] = useState(false)

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId),
    [accounts, selectedAccountId],
  )

  useEffect(() => {
    getBankAccounts({ status: 'active' }).then(setAccounts).catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    if (!selectedAccountId) return
    getImportHistory(selectedAccountId, { limit: 20 })
      .then(res => setHistory(res.data || []))
      .catch(() => setHistory([]))
  }, [selectedAccountId])

  // Parsea fechas en DD-MM-YYYY, DD/MM/YYYY o ISO YYYY-MM-DD → siempre devuelve YYYY-MM-DD
  const parseDate = (raw: unknown): string => {
    const s = String(raw || '').trim()
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) {
      const sep = s[2]
      const [d, m, y] = s.split(sep)
      return `${y}-${m}-${d}`
    }
    const d = dayjs(s)
    return d.isValid() ? d.format('YYYY-MM-DD') : ''
  }

  const buildRows = (values: any) => {
    const parsed = rawRows
      .map(row => {
        const debit  = cleanNumber(row[values.debitField])
        const credit = cleanNumber(row[values.creditField])
        const directAmount = cleanNumber(row[values.amountField])
        const amount = directAmount || credit || Math.abs(debit)
        const parsedDate = parseDate(row[values.dateField])
        const description = String(row[values.descriptionField] ?? '').trim()
        if (!parsedDate || !description || !amount) return null
        return {
          transactionDate: parsedDate,
          description,
          amount,
          type: (credit > 0 || values.typeDefault === 'credit') && !debit ? 'credit' : 'debit',
          reference: values.referenceField !== undefined ? String(row[values.referenceField] ?? '') : undefined,
          runningBalance: values.balanceField !== undefined ? cleanNumber(row[values.balanceField]) : undefined,
        } as ParsedRow
      })
      .filter(Boolean) as ParsedRow[]
    setRows(parsed)
  }

  const beforeUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const pdfFile = ext === 'pdf'
    setIsPdf(pdfFile)
    setFileName(file.name)
    setRows([])

    let matrix: any[][] = []

    try {
      const buffer = await file.arrayBuffer()
      if (pdfFile) {
        matrix = await parsePdfToMatrix(buffer)
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      }
    } catch {
      message.error(`No se pudo leer el archivo ${pdfFile ? 'PDF' : 'Excel/CSV'}`)
      return false
    }

    const allRows = matrix.filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''))

    // Detectar fila de encabezados real (primera fila donde col[0] es "fecha")
    let headerIdx = 0
    for (let i = 0; i < Math.min(allRows.length, 25); i++) {
      if (String(allRows[i][0] || '').trim().toLowerCase() === 'fecha') {
        headerIdx = i
        break
      }
    }

    const head: any[] = allRows[headerIdx] ?? []
    const body = allRows.slice(headerIdx + 1)
    const labels = head.map((h, i) => String(h || `Columna ${i + 1}`))

    setHeaders(labels)
    setRawRows(body)
    form.resetFields(['dateField', 'descriptionField', 'debitField', 'creditField',
      'amountField', 'referenceField', 'balanceField'])

    // Auto-mapeo multi-banco (BI, BAC, Banrural, G&T, Citi…)
    const tryFind = (...needles: string[]) =>
      labels.findIndex(l => needles.some(n => l.trim().toLowerCase().includes(n.toLowerCase())))

    const autoMap = {
      dateField:        tryFind('fecha'),
      descriptionField: tryFind('descripci', 'concepto', 'detalle', 'transacci'),
      referenceField:   tryFind('no. doc', 'ref', 'cheque', 'documento'),
      debitField:       tryFind('debe', 'débito', 'debito', 'cargo', 'retiro', 'egreso'),
      creditField:      tryFind('haber', 'crédito', 'credito', 'abono', 'depósito', 'deposito', 'ingreso'),
      balanceField:     tryFind('saldo'),
    }

    const detected = Object.values(autoMap).filter(v => v >= 0).length >= 4
    if (detected) {
      form.setFieldsValue(autoMap)
      message.success(`Formato detectado${pdfFile ? ' en PDF' : ''} — columnas auto-asignadas`)
    }

    return false
  }

  const handlePreview = async () => {
    const values = await form.validateFields()
    buildRows(values)
  }

  const handleImport = async () => {
    if (!selectedAccountId || rows.length === 0) return
    setLoading(true)
    try {
      const res = await importStatement(selectedAccountId, {
        rows,
        fileName,
        fileType: fileName?.split('.').pop()?.toLowerCase(),
      })
      message.success(`Importadas ${res.imported}; omitidas ${res.skipped}`)
      setRows([])
      setRawRows([])
      setHeaders([])
      setIsPdf(false)
      form.resetFields()
      const updated = await getImportHistory(selectedAccountId, { limit: 20 })
      setHistory(updated.data || [])
    } catch {
      message.error('No se pudo importar el estado de cuenta')
    } finally {
      setLoading(false)
    }
  }

  const headerOptions = headers.map((label, value) => ({ label, value }))

  const previewColumns: ColumnsType<ParsedRow> = [
    { title: 'Fecha', dataIndex: 'transactionDate', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Descripcion', dataIndex: 'description', ellipsis: true },
    { title: 'Tipo', dataIndex: 'type', width: 100, render: v => <Tag color={v === 'credit' ? '#2ea172' : '#e5484d'}>{v === 'credit' ? 'Ingreso' : 'Egreso'}</Tag> },
    { title: 'Monto', dataIndex: 'amount', width: 130, align: 'right', render: v => money(Number(v), selectedAccount?.currency) },
    { title: 'Referencia', dataIndex: 'reference', width: 150 },
  ]

  return (
    <div>
      <div style={pageHeaderStyle}>
        <div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bancos')} />
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Importar estado de cuenta</Title>
          </Space>
          <div><Text type="secondary">Carga Excel, CSV o PDF del banco — asigna columnas y revisa la vista previa antes de importar.</Text></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 12, alignItems: 'start' }}>
        <Card size="small" style={panelStyle}>
          <Form form={form} layout="vertical" size="small" initialValues={{ typeDefault: 'debit' }}>
            <Form.Item label="Cuenta bancaria" required>
              <Select
                placeholder="Selecciona una cuenta"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accounts.map(a => ({ value: a.id, label: `${a.name} - ${a.currency}` }))}
              />
            </Form.Item>

            <Upload.Dragger
              beforeUpload={beforeUpload}
              showUploadList={false}
              accept=".xlsx,.xls,.csv,.pdf"
              disabled={!selectedAccountId}
            >
              <p className="ant-upload-drag-icon">
                {isPdf
                  ? <FilePdfOutlined style={{ color: '#e5484d' }} />
                  : <FileExcelOutlined style={{ color: NAVY }} />
                }
              </p>
              <p className="ant-upload-text">Arrastra o selecciona archivo</p>
              <p className="ant-upload-hint">Excel, CSV o PDF con estado de cuenta bancario</p>
            </Upload.Dragger>

            {isPdf && headers.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 10, fontSize: 11 }}
                message="PDF cargado — verifica el mapeo de columnas"
                description="El texto se extrae automáticamente. Los montos con símbolo de moneda pueden aparecer como una sola celda. Revisa la vista previa antes de importar."
              />
            )}

            {headers.length > 0 && (
              <>
                <div style={{ ...formGrid, marginTop: 12 }}>
                  <Form.Item name="dateField" label="Fecha" rules={[{ required: true }]}>
                    <Select options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="descriptionField" label="Descripcion" rules={[{ required: true }]}>
                    <Select options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="debitField" label="Debito / retiro">
                    <Select allowClear options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="creditField" label="Credito / deposito">
                    <Select allowClear options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="amountField" label="Monto unico">
                    <Select allowClear options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="referenceField" label="Referencia">
                    <Select allowClear options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="balanceField" label="Saldo">
                    <Select allowClear options={headerOptions} />
                  </Form.Item>
                  <Form.Item name="typeDefault" label="Tipo por defecto">
                    <Select options={[{ value: 'debit', label: 'Egreso' }, { value: 'credit', label: 'Ingreso' }]} />
                  </Form.Item>
                </div>
                <Space>
                  <Button icon={<FileExcelOutlined />} onClick={handlePreview}>Vista previa</Button>
                  <Button type="primary" icon={<UploadOutlined />} disabled={!rows.length} loading={loading} onClick={handleImport} style={{ background: NAVY }}>
                    Importar
                  </Button>
                </Space>
              </>
            )}
          </Form>
        </Card>

        <Card size="small" style={panelStyle} bodyStyle={{ padding: 0 }}>
          <Table<ParsedRow>
            columns={previewColumns}
            dataSource={rows}
            rowKey={(_, index) => String(index)}
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 50, showTotal: t => `${t} registros` }}
            locale={{ emptyText: 'Carga un archivo y genera la vista previa' }}
          />
        </Card>
      </div>

      <Card size="small" title="Historial de importaciones" style={{ ...panelStyle, marginTop: 12 }} bodyStyle={{ padding: 0 }}>
        <Table<BankImportBatch>
          dataSource={history}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showTotal: t => `${t} registros` }}
          columns={[
            { title: 'Fecha', dataIndex: 'createdAt', width: 140, render: v => dayjs(v).format('DD/MM/YYYY HH:mm') },
            { title: 'Archivo', dataIndex: 'fileName', ellipsis: true },
            { title: 'Filas', dataIndex: 'totalRows', width: 90, align: 'right' },
            { title: 'Importadas', dataIndex: 'importedCount', width: 110, align: 'right' },
            { title: 'Omitidas', dataIndex: 'skippedCount', width: 100, align: 'right' },
            { title: 'Estado', dataIndex: 'status', width: 110, render: v => <Tag color={v === 'completed' ? '#2ea172' : '#e5484d'}>{v === 'completed' ? 'Completado' : 'Fallido'}</Tag> },
          ]}
        />
      </Card>
    </div>
  )
}
