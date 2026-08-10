import { useState, useCallback, useRef } from 'react'
import {
  Typography, Button, Upload, Table, message, DatePicker, InputNumber,
  Alert, Collapse, Tag, Space, Spin, Popconfirm, Steps, Empty,
} from 'antd'
import {
  DownloadOutlined, UploadOutlined, CheckCircleOutlined,
  TeamOutlined, ShopOutlined, AuditOutlined, HomeOutlined,
  FileExcelOutlined, WarningOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { ColumnType } from 'antd/es/table'
import { batchImportClientes, batchImportProveedores, type BatchImportRow } from '../../api/contactos'
import { getAccounts, setSaldosApertura, type Account, type SaldoAperturaLinea } from '../../api/catalogo'

const { Title, Text } = Typography
const { Panel } = Collapse

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
  })
}

function downloadCsv(filename: string, headers: string[], sampleRow: string[]) {
  const csv = [headers.join(','), sampleRow.join(',')].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Clientes / Proveedores CSV section ──────────────────────────────────────

const ENTITY_HEADERS = ['nombre', 'nit', 'email', 'telefono', 'direccion', 'saldo_inicial', 'fecha_saldo_inicial']
const ENTITY_SAMPLE  = [
  '"Empresa Ejemplo S.A."', '"12345678-9"', '"contacto@empresa.com"',
  '"5555-5555"', '"4a Calle 12-55 zona 10"', '"15000.00"', '"2024-01-01"',
]

interface EntityStep { step: number; rows: BatchImportRow[]; result?: { created: number; updated: number; errors: string[] } }

function EntityImportSection({
  type, fechaMigracion,
}: { type: 'clientes' | 'proveedores'; fechaMigracion: Dayjs | null }) {
  const label   = type === 'clientes' ? 'Clientes (CxC)' : 'Proveedores (CxP)'
  const [state, setState] = useState<EntityStep>({ step: 0, rows: [] })
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsvText(text)
    if (!parsed.length) { message.error('El archivo no contiene datos válidos'); return false }

    const rows: BatchImportRow[] = parsed.map(r => ({
      nombre:              r.nombre || r.name || '',
      nit:                 r.nit || r.taxId || '',
      email:               r.email || r.correo || '',
      telefono:            r.telefono || r.phone || '',
      direccion:           r.direccion || r.address || '',
      saldo_inicial:       r.saldo_inicial ? Number(r.saldo_inicial) : undefined,
      fecha_saldo_inicial: r.fecha_saldo_inicial || (fechaMigracion ? fechaMigracion.format('YYYY-MM-DD') : undefined),
    })).filter(r => r.nombre)

    setState({ step: 1, rows })
    return false
  }

  const handleImport = async () => {
    setLoading(true)
    try {
      const fn = type === 'clientes' ? batchImportClientes : batchImportProveedores
      const result = await fn(state.rows)
      setState(s => ({ ...s, step: 2, result }))
      message.success(`Importación completada: ${result.created} creados, ${result.updated} actualizados`)
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const previewCols: ColumnType<BatchImportRow>[] = [
    { title: 'Nombre',        dataIndex: 'nombre',              width: 200 },
    { title: 'NIT',           dataIndex: 'nit',                 width: 110 },
    { title: 'Email',         dataIndex: 'email',               width: 180 },
    { title: 'Teléfono',      dataIndex: 'telefono',            width: 110 },
    { title: 'Saldo Inicial', dataIndex: 'saldo_inicial',       width: 120,
      render: (v: number) => v != null ? `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : '—' },
    { title: 'Fecha Saldo',   dataIndex: 'fecha_saldo_inicial', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
  ]

  return (
    <div style={{ padding: '12px 0' }}>
      <Steps size="small" current={state.step} style={{ marginBottom: 24 }} items={[
        { title: 'Subir archivo' },
        { title: 'Revisar' },
        { title: 'Completado' },
      ]} />

      {state.step === 0 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadCsv(`plantilla_${type}.csv`, ENTITY_HEADERS, ENTITY_SAMPLE)}
          >
            Descargar plantilla CSV
          </Button>
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleFile}
          >
            <Button icon={<UploadOutlined />} type="primary" style={{ background: '#1B3A6B' }}>
              Subir archivo CSV
            </Button>
          </Upload>
        </div>
      )}

      {state.step === 1 && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{state.rows.length} registros listos para importar</Text>
            <Space>
              <Button onClick={() => setState({ step: 0, rows: [] })}>Cancelar</Button>
              <Popconfirm
                title={`¿Importar ${state.rows.length} ${label}?`}
                description="Los registros existentes (mismo NIT) serán actualizados."
                onConfirm={handleImport}
                okText="Importar"
                okButtonProps={{ style: { background: '#1B3A6B' } }}
              >
                <Button type="primary" icon={<ArrowRightOutlined />} loading={loading}
                  style={{ background: '#1B3A6B' }}>
                  Confirmar importación
                </Button>
              </Popconfirm>
            </Space>
          </div>
          <Table
            dataSource={state.rows}
            columns={previewCols}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </div>
      )}

      {state.step === 2 && state.result && (
        <div>
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message={`Importación de ${label} completada`}
            description={
              <div>
                <div>✅ Creados: <strong>{state.result.created}</strong></div>
                <div>🔄 Actualizados: <strong>{state.result.updated}</strong></div>
                {state.result.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="danger"><WarningOutlined /> {state.result.errors.length} errores:</Text>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                      {state.result.errors.map((e, i) => <li key={i} style={{ fontSize: 12 }}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            }
            style={{ marginBottom: 12 }}
          />
          <Button onClick={() => setState({ step: 0, rows: [] })}>Nueva importación</Button>
        </div>
      )}
    </div>
  )
}

// ─── Saldos de cuentas de mayor ───────────────────────────────────────────────

interface AccountRow extends Account { _debit: number; _credit: number }

const BALANCE_TYPE_ORDER = ['Activo', 'Pasivo', 'Capital', 'Ingresos', 'Costo', 'Gasto', 'Otros']
const BALANCE_TYPE_COLOR: Record<string, string> = {
  Activo: '#1faec2', Pasivo: '#e5484d', Capital: '#7c3aed', Ingresos: '#2ea172',
  Costo: '#f59e0b', Gasto: '#ef4444', Otros: '#6b7280',
}

function SaldosCuentasSection({ fechaMigracion }: { fechaMigracion: Dayjs | null }) {
  const [rows, setRows]       = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState<{ polizaId: string; updated: number } | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    if (loaded.current) return
    setLoading(true)
    try {
      const accounts: Account[] = await getAccounts()
      const filterable = accounts.filter(a => !a.isHeader && a.isActive)
      setRows(filterable.map(a => ({ ...a, _debit: 0, _credit: 0 })))
      loaded.current = true
    } catch {
      message.error('Error cargando catálogo de cuentas')
    } finally {
      setLoading(false)
    }
  }, [])

  const setDebit  = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: v || 0,  _credit: 0 } : r))
  const setCredit = (id: string, v: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, _debit: 0, _credit: v || 0 } : r))

  const touched     = rows.filter(r => r._debit > 0 || r._credit > 0)
  const totalDebit  = touched.reduce((s, r) => s + r._debit,  0)
  const totalCredit = touched.reduce((s, r) => s + r._credit, 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const handleSave = async () => {
    if (!fechaMigracion) { message.error('Selecciona la fecha de migración'); return }
    if (!touched.length)  { message.error('Ingresa al menos un saldo'); return }
    if (!balanced)        { message.error(`La póliza no cuadra: Debe Q${totalDebit.toFixed(2)}, Haber Q${totalCredit.toFixed(2)}`); return }

    setSaving(true)
    try {
      const lineas: SaldoAperturaLinea[] = touched.map(r => ({
        accountId: r.id,
        debit:     r._debit,
        credit:    r._credit,
      }))
      const res = await setSaldosApertura({
        fecha:       fechaMigracion.format('YYYY-MM-DD'),
        descripcion: 'Saldos de apertura / migración inicial',
        lineas,
      })
      setResult(res)
      message.success('Saldos de apertura guardados y póliza OPENING generada')
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Alert
          type="success" showIcon icon={<CheckCircleOutlined />}
          message="Saldos de apertura cargados"
          description={
            <div>
              <div>✅ Cuentas actualizadas: <strong>{result.updated}</strong></div>
              <div>📋 Póliza OPENING generada (ID: <code>{result.polizaId.slice(0, 8)}…</code>)</div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  La póliza está disponible en Contabilidad → Diarios Manuales
                </Text>
              </div>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
        <Button onClick={() => { setResult(null); loaded.current = false; setRows([]) }}>
          Cargar nuevamente
        </Button>
      </div>
    )
  }

  const byType = BALANCE_TYPE_ORDER.map(bt => ({
    bt,
    items: rows.filter(r => (r.balanceType ?? 'Otros') === bt),
  })).filter(g => g.items.length > 0)

  const cols: ColumnType<AccountRow>[] = [
    { title: 'Código', dataIndex: 'code', width: 90 },
    { title: 'Cuenta', dataIndex: 'name', ellipsis: true },
    {
      title: 'Debe (Db)', width: 150,
      render: (_: any, r: AccountRow) => (
        <InputNumber
          value={r._debit || undefined}
          min={0} precision={2} size="small" style={{ width: '100%' }}
          formatter={v => v ? `Q ${v}` : ''}
          parser={v => v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0}
          onChange={v => setDebit(r.id, Number(v) || 0)}
          placeholder="0.00"
        />
      ),
    },
    {
      title: 'Haber (Cr)', width: 150,
      render: (_: any, r: AccountRow) => (
        <InputNumber
          value={r._credit || undefined}
          min={0} precision={2} size="small" style={{ width: '100%' }}
          formatter={v => v ? `Q ${v}` : ''}
          parser={v => v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0}
          onChange={v => setCredit(r.id, Number(v) || 0)}
          placeholder="0.00"
        />
      ),
    },
  ]

  return (
    <div style={{ padding: '12px 0' }}>
      {!loaded.current ? (
        <Button icon={<AuditOutlined />} onClick={load} loading={loading}
          style={{ marginBottom: 16 }}>
          Cargar catálogo de cuentas
        </Button>
      ) : (
        <Spin spinning={loading}>
          {touched.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: balanced ? '#f0fdf4' : '#fef9f0',
              border: `1px solid ${balanced ? '#bbf7d0' : '#fed7aa'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Space>
                <Text strong>Debe:</Text>
                <Text style={{ color: '#1faec2' }}>Q {totalDebit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                <Text strong style={{ marginLeft: 12 }}>Haber:</Text>
                <Text style={{ color: '#e5484d' }}>Q {totalCredit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</Text>
                {!balanced && <Tag color="orange">⚠ Descuadrado Q {Math.abs(totalDebit - totalCredit).toFixed(2)}</Tag>}
                {balanced && touched.length > 0 && <Tag color="success">✓ Cuadrado</Tag>}
              </Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!balanced || !fechaMigracion}
                style={{ background: '#1B3A6B' }}
              >
                Generar póliza de apertura
              </Button>
            </div>
          )}

          {byType.map(({ bt, items }) => (
            <div key={bt} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 6, paddingBottom: 4,
                borderBottom: `2px solid ${BALANCE_TYPE_COLOR[bt] ?? '#e5e7eb'}`,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: BALANCE_TYPE_COLOR[bt] ?? '#6b7280',
                }}>
                  {bt}
                </span>
                <Tag color={BALANCE_TYPE_COLOR[bt]} style={{ fontSize: 11 }}>{items.length} cuentas</Tag>
              </div>
              <Table
                dataSource={items}
                columns={cols}
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={r => (r._debit > 0 || r._credit > 0) ? 'ant-table-row-selected' : ''}
              />
            </div>
          ))}

          {!loading && rows.length === 0 && (
            <Empty description="No hay cuentas de detalle en el catálogo" />
          )}
        </Spin>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CargasInicialesPage() {
  const [fechaMigracion, setFechaMigracion] = useState<Dayjs | null>(null)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Cargas Iniciales</Title>
        <Text type="secondary">
          Migración de datos maestros y saldos de apertura. Carga clientes, proveedores y saldos contables de tu sistema anterior.
        </Text>
      </div>

      {/* Fecha de migración — aplica a todas las secciones */}
      <div style={{
        padding: '14px 18px', borderRadius: 10, marginBottom: 24,
        background: '#f8faff', border: '1px solid #dbe4f0',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <Text strong style={{ fontSize: 14 }}>Fecha de migración</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            Fecha de corte del sistema anterior. Se usará como fecha de saldo inicial.
          </Text>
        </div>
        <DatePicker
          value={fechaMigracion}
          onChange={setFechaMigracion}
          format="DD/MM/YYYY"
          placeholder="Selecciona fecha de corte"
          style={{ width: 200 }}
        />
        {!fechaMigracion && (
          <Tag color="orange" icon={<WarningOutlined />}>
            Selecciona la fecha antes de importar
          </Tag>
        )}
        {fechaMigracion && (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Fecha: {fechaMigracion.format('DD/MM/YYYY')}
          </Tag>
        )}
      </div>

      <Collapse
        defaultActiveKey={[]}
        accordion={false}
        style={{ background: 'transparent' }}
        items={[
          {
            key: 'clientes',
            label: (
              <Space>
                <TeamOutlined style={{ color: '#1faec2' }} />
                <Text strong>Cuentas por Cobrar — Clientes</Text>
                <Tag color="blue">CxC</Tag>
              </Space>
            ),
            children: <EntityImportSection type="clientes" fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'proveedores',
            label: (
              <Space>
                <ShopOutlined style={{ color: '#f59e0b' }} />
                <Text strong>Cuentas por Pagar — Proveedores</Text>
                <Tag color="orange">CxP</Tag>
              </Space>
            ),
            children: <EntityImportSection type="proveedores" fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'cuentas',
            label: (
              <Space>
                <AuditOutlined style={{ color: '#1B3A6B' }} />
                <Text strong>Saldos de Cuentas de Mayor</Text>
                <Tag color="geekblue">Apertura contable</Tag>
              </Space>
            ),
            children: <SaldosCuentasSection fechaMigracion={fechaMigracion} />,
          },
          {
            key: 'activos-fijos',
            label: (
              <Space>
                <HomeOutlined style={{ color: '#6b7280' }} />
                <Text strong>Activos Fijos</Text>
                <Tag>Importación CSV</Tag>
              </Space>
            ),
            children: (
              <div style={{ padding: '12px 0' }}>
                <Alert
                  type="info"
                  showIcon
                  message="Importación de Activos Fijos"
                  description={
                    <div>
                      La carga masiva de activos fijos se gestiona directamente desde el módulo
                      <strong> Activos Fijos</strong>, que incluye plantilla CSV, previsualización
                      y generación de póliza de apertura.
                      <div style={{ marginTop: 8 }}>
                        <Button
                          type="primary"
                          icon={<FileExcelOutlined />}
                          href="/contabilidad/activos-fijos"
                          style={{ background: '#1B3A6B' }}
                        >
                          Ir a Activos Fijos
                        </Button>
                      </div>
                    </div>
                  }
                />
              </div>
            ),
          },
          {
            key: 'inventario',
            label: (
              <Space>
                <FileExcelOutlined style={{ color: '#2ea172' }} />
                <Text strong>Inventario</Text>
                <Tag color="green">Saldos iniciales</Tag>
              </Space>
            ),
            children: (
              <div style={{ padding: '12px 0' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Próximamente"
                  description="La carga masiva de inventario (cantidades y costos iniciales por almacén) estará disponible en la próxima versión."
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
