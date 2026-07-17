import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Select, Space, Table, Tag, Typography, Upload, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
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
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    const allRows = matrix.filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''))

    // Buscar la fila de encabezados real: primera fila cuya col[0] sea exactamente "Fecha"
    // (maneja el formato BI que tiene varias filas de metadatos antes del header real)
    let headerIdx = 0
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
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
    setFileName(file.name)
    setRows([])

    // Auto-mapeo para formato Banco Industrial
    const idx = (needle: string) =>
      labels.findIndex(l => l.trim().toLowerCase().startsWith(needle.toLowerCase()))
    const biMap = {
      dateField:        idx('Fecha'),
      descriptionField: idx('Descripci'),
      referenceField:   idx('No. Doc'),
      debitField:       idx('Debe'),
      creditField:      idx('Haber'),
      balanceField:     idx('Saldo'),
    }
    const detected = Object.values(biMap).filter(v => v >= 0).length >= 4
    if (detected) {
      form.setFieldsValue(biMap)
      message.success('Formato Banco Industrial detectado — columnas auto-asignadas')
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
          <div><Text type="secondary">Carga Excel o CSV, asigna columnas y revisa la vista previa antes de importar.</Text></div>
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

            <Upload.Dragger beforeUpload={beforeUpload} showUploadList={false} accept=".xlsx,.xls,.csv" disabled={!selectedAccountId}>
              <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ color: NAVY }} /></p>
              <p className="ant-upload-text">Arrastra o selecciona archivo</p>
              <p className="ant-upload-hint">Excel o CSV con fecha, descripcion, debito/credito, referencia y saldo.</p>
            </Upload.Dragger>

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
