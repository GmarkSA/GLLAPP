import { useState, useEffect } from 'react'
import {
  Card, Button, Table, Tag, Badge, Space, Typography, Input,
  Alert, Divider, Spin, Tabs, Tooltip, message, Collapse,
} from 'antd'
import {
  ThunderboltOutlined, SafetyCertificateOutlined, SearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CodeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { companyIntegrationsApi, type ElectronicInvoicingProfile } from '../../api/companyIntegrations'
import { getInvoice, emitirFelInvoice } from '../../api/facturas'
import { useCompanyStore } from '../../store/companyStore'
import {
  FEL_ALL_DOC_TYPES, FEL_DOC_TYPES_BY_REGIME,
  REGIME_LABELS,
} from '../../api/fel'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text, Paragraph } = Typography

// ── Tabla de regímenes × documentos ──────────────────────────────────────────

function RegimeDocTable() {
  const rows = Object.entries(FEL_DOC_TYPES_BY_REGIME).map(([regime, docs]) => ({
    regime,
    label: REGIME_LABELS[regime] ?? regime,
    docs,
  }))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f0f4ff' }}>
            <th style={th}>Tipo de documento</th>
            {rows.map(r => <th key={r.regime} style={{ ...th, width: 130 }}>{r.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {FEL_ALL_DOC_TYPES.map(doc => (
            <tr key={doc.code} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <td style={td}>
                <Tag color="#1faec2" style={{ marginRight: 6 }}>{doc.code}</Tag>
                <span style={{ color: '#555' }}>{doc.description}</span>
              </td>
              {rows.map(r => (
                <td key={r.regime} style={{ ...td, textAlign: 'center' }}>
                  {r.docs.some(d => d.code === doc.code)
                    ? <CheckCircleOutlined style={{ color: '#2ea172' }} />
                    : <span style={{ color: '#9aa1ab' }}>—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Matriz de características fiscales ───────────────────────────────────────

const FISCAL_MATRIX: Array<{ aspecto: string } & Record<string, string | boolean>> = [
  {
    aspecto: 'Tasa IVA',
    gt_pequeno_contribuyente: '5% (pago único trimestral)',
    gt_regimen_general:       '12%',
    gt_regimen_primario:      '0% — exento en acto propio',
    gt_regimen_pecuario:      '0% — exento en acto propio',
  },
  {
    aspecto: 'Mecanismo IVA',
    gt_pequeno_contribuyente: 'Cuota fija sobre ventas totales',
    gt_regimen_general:       'Débito − Crédito Fiscal (declaración mensual)',
    gt_regimen_primario:      'Exento (actividad agropecuaria)',
    gt_regimen_pecuario:      'Exento (actividad pecuaria)',
  },
  {
    aspecto: 'Genera CF al comprador',
    gt_pequeno_contribuyente: false,
    gt_regimen_general:       true,
    gt_regimen_primario:      false,
    gt_regimen_pecuario:      false,
  },
  {
    aspecto: 'Retención IVA que puede recibir',
    gt_pequeno_contribuyente: 'GCE retiene 100% del IVA (5% del total facturado) — Art. 55, Dto. 27-92',
    gt_regimen_general:       'GCE retiene 65% bienes / 15% servicios y honorarios',
    gt_regimen_primario:      '—',
    gt_regimen_pecuario:      '—',
  },
  {
    aspecto: 'ISR aplicable',
    gt_pequeno_contribuyente: 'Sin ISR propio (actividades no exentas usan IOSIAL)',
    gt_regimen_general:       'IOSIAL: 5% ≤ Q30K / 7% excedente  ó  RUAL: 25% utilidad fiscal',
    gt_regimen_primario:      'Exento en actividad agropecuaria',
    gt_regimen_pecuario:      'Exento en actividad pecuaria',
  },
  {
    aspecto: 'Doc. FEL principal (ventas)',
    gt_pequeno_contribuyente: 'FPEQ',
    gt_regimen_general:       'FACT',
    gt_regimen_primario:      'FPRI',
    gt_regimen_pecuario:      'FPEC',
  },
  {
    aspecto: 'Categoría en sistema',
    gt_pequeno_contribuyente: 'iva_pequeno_contribuyente',
    gt_regimen_general:       'iva',
    gt_regimen_primario:      'iva_exento',
    gt_regimen_pecuario:      'iva_exento',
  },
  {
    aspecto: 'Base legal',
    gt_pequeno_contribuyente: 'Art. 50-55, Dto. 27-92',
    gt_regimen_general:       'Art. 10, Dto. 27-92',
    gt_regimen_primario:      'Dto. 01-87 (Ley de Fomento Agropecuario)',
    gt_regimen_pecuario:      'Dto. 01-87',
  },
]

function FiscalMatrixTable() {
  const regimes = Object.keys(FEL_DOC_TYPES_BY_REGIME)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f0f4ff' }}>
            <th style={{ ...th, width: 170 }}>Aspecto</th>
            {regimes.map(r => (
              <th key={r} style={{ ...th, minWidth: 150 }}>{REGIME_LABELS[r] ?? r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FISCAL_MATRIX.map(row => (
            <tr key={row.aspecto} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <td style={{ ...td, fontWeight: 600, color: '#444', whiteSpace: 'nowrap' }}>
                {row.aspecto}
              </td>
              {regimes.map(r => {
                const val = row[r]
                if (typeof val === 'boolean') {
                  return (
                    <td key={r} style={{ ...td, textAlign: 'center' }}>
                      {val
                        ? <CheckCircleOutlined style={{ color: '#2ea172' }} />
                        : <strong style={{ color: '#e5484d', fontSize: 12 }}>NO</strong>}
                    </td>
                  )
                }
                const strVal = String(val ?? '—')
                if (strVal.startsWith('iva')) {
                  return (
                    <td key={r} style={td}>
                      <Tag style={{ fontSize: 10, margin: 0 }}>{strVal}</Tag>
                    </td>
                  )
                }
                return <td key={r} style={td}>{strVal}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabla: al comprar de cada tipo de contribuyente ──────────────────────────

const PURCHASE_RULES = [
  {
    proveedor:      'Régimen General / Opcional Simplificado',
    ivaFactura:     '12%',
    tagColor:       '#1faec2',
    generaCF:       true,
    retencionGCE:   '65% en bienes — 15% en servicios y honorarios profesionales',
    codigoSistema:  'IVA12',
    nota:           'Crédito fiscal acreditable. Registrar en Libro de Compras, columna IVA.',
  },
  {
    proveedor:      'Pequeño Contribuyente',
    ivaFactura:     '5%',
    tagColor:       '#722ed1',
    generaCF:       false,
    retencionGCE:   '100% del IVA (5% del total facturado) → emite Constancia de Retención y entera al SAT',
    codigoSistema:  'COMPRAS_PC / IVARET_PC',
    nota:           'No genera CF. Si eres GCE: usa código IVARET_PC (isWithholding), emite constancia y entera al SAT. El PC no paga ese IVA.',
  },
  {
    proveedor:      'Régimen Primario / Pecuario (acto propio)',
    ivaFactura:     '0%',
    tagColor:       '#6b7280',
    generaCF:       false,
    retencionGCE:   '—',
    codigoSistema:  'IVAEX',
    nota:           'Exento en actividad agropecuaria o pecuaria propia.',
  },
  {
    proveedor:      'No contribuyente — Factura Especial (FESP)',
    ivaFactura:     '12%',
    tagColor:       '#1faec2',
    generaCF:       true,
    retencionGCE:   '100% del IVA — el comprador emite FESP, declara y paga',
    codigoSistema:  'IVA12 (FESP)',
    nota:           'El comprador emite la Factura Especial. Aplica cuando el proveedor no es contribuyente inscrito.',
  },
]

function PurchaseRulesTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <Alert
        type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }}
        message="Usa el impuesto correcto según el tipo de proveedor al registrar una compra"
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f0f4ff' }}>
            <th style={th}>Tipo de proveedor</th>
            <th style={{ ...th, textAlign: 'center', width: 90  }}>IVA facturado</th>
            <th style={{ ...th, textAlign: 'center', width: 80  }}>Genera CF</th>
            <th style={th}>Retención obligada (GCE)</th>
            <th style={{ ...th, width: 140 }}>Código sistema</th>
            <th style={th}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {PURCHASE_RULES.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <td style={{ ...td, fontWeight: 500 }}>{r.proveedor}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <Tag color={r.tagColor} style={{ margin: 0 }}>{r.ivaFactura}</Tag>
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                {r.generaCF
                  ? <CheckCircleOutlined style={{ color: '#2ea172' }} />
                  : <strong style={{ color: '#e5484d', fontSize: 12 }}>NO</strong>}
              </td>
              <td style={td}>{r.retencionGCE}</td>
              <td style={td}><Text code style={{ fontSize: 11 }}>{r.codigoSistema}</Text></td>
              <td style={{ ...td, color: '#6b7280', fontSize: 11 }}>{r.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Panel de prueba de certificación ─────────────────────────────────────────

function CertificationTestPanel() {
  const [invoiceInput, setInvoiceInput] = useState('')
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [certifying, setCertifying] = useState(false)
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  const handleLookup = async () => {
    if (!invoiceInput.trim()) return
    setLoadingInvoice(true)
    setInvoiceData(null)
    setResult(null)
    try {
      const inv = await getInvoice(invoiceInput.trim())
      setInvoiceData(inv)
    } catch {
      message.error('Factura no encontrada. Ingresa un ID válido.')
    } finally { setLoadingInvoice(false) }
  }

  const handleCertify = async () => {
    if (!invoiceData?.id) return
    setCertifying(true)
    setResult(null)
    try {
      const updated = await emitirFelInvoice(invoiceData.id)
      setResult({ success: !!updated.felUuid, data: updated })
      if (updated.felUuid) message.success('¡Certificación exitosa!')
      else message.warning(`Certificador respondió: ${updated.felMensaje}`)
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error de conexión con el certificador'
      setResult({ success: false, error: msg })
      message.error(msg)
    } finally { setCertifying(false) }
  }

  // Construir preview del payload que se enviará (para display)
  const buildPayloadPreview = (inv: any) => ({
    type: inv.felTipoDocumento || '(del perfil FEL activo)',
    currency: inv.currency,
    datetime_issue: inv.invoiceDate,
    total: inv.total,
    external_id: inv.invoiceNumber,
    to: { tax_code: inv.customerTaxId || 'CF', tax_name: inv.customerName },
    items: (inv.items ?? []).map((it: any) => ({
      description: it.description,
      qty: it.quantity,
      price: it.unitPrice,
    })),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        message="Panel de prueba"
        description="Busca una factura por su ID e intenta certificarla ante el SAT. Si el perfil FEL está en modo Sandbox, se usará el ambiente de pruebas del certificador."
        style={{ fontSize: 12 }}
      />

      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="ID de la factura (UUID)"
          value={invoiceInput}
          onChange={e => setInvoiceInput(e.target.value)}
          onPressEnter={handleLookup}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Button onClick={handleLookup} loading={loadingInvoice}>Buscar</Button>
      </Space.Compact>

      {invoiceData && (
        <>
          <Card size="small" style={{ background: '#fafbfc' }}>
            <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <span><Text type="secondary">Número:</Text> <strong>{invoiceData.invoiceNumber}</strong></span>
              <span><Text type="secondary">Cliente:</Text> {invoiceData.customerName}</span>
              <span><Text type="secondary">NIT:</Text> {invoiceData.customerTaxId || 'CF'}</span>
              <span><Text type="secondary">Total:</Text> <strong>Q {Number(invoiceData.total).toFixed(2)}</strong></span>
              <span><Text type="secondary">Tipo FEL:</Text> <Tag color="#1faec2">{invoiceData.felTipoDocumento || 'del perfil'}</Tag></span>
              <span><Text type="secondary">Estado FEL:</Text>
                {invoiceData.felUuid
                  ? <Tag color="#2ea172">Certificada — {invoiceData.felUuid?.slice(0, 8)}…</Tag>
                  : <Tag color="#ff7f00">Sin certificar</Tag>}
              </span>
            </div>

            <Divider style={{ margin: '10px 0' }} />

            <Collapse size="small" ghost items={[{
              key: '1',
              label: <Text style={{ fontSize: 11 }}><CodeOutlined /> Preview del payload a enviar</Text>,
              children: (
                <pre style={{ fontSize: 10, background: '#fafbfc', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 200 }}>
                  {JSON.stringify(buildPayloadPreview(invoiceData), null, 2)}
                </pre>
              ),
            }]} />
          </Card>

          {!invoiceData.felUuid && (
            <Button type="primary" icon={<SafetyCertificateOutlined />}
              loading={certifying} onClick={handleCertify}
              style={{ background: '#096dd9', alignSelf: 'flex-start' }}
            >
              Certificar ante SAT
            </Button>
          )}
        </>
      )}

      {result && (
        <Alert
          type={result.success ? 'success' : 'error'}
          showIcon
          message={result.success ? 'Certificación exitosa' : 'Error en certificación'}
          description={
            result.success ? (
              <div style={{ fontSize: 12 }}>
                <div>UUID: <Text code>{result.data?.felUuid}</Text></div>
                <div>Serie: <strong>{result.data?.felSerie}</strong> — Número: <strong>{result.data?.felNumero}</strong></div>
                {result.data?.felUrl && <div><a href={result.data.felUrl} target="_blank" rel="noreferrer">Ver PDF en SAT →</a></div>}
              </div>
            ) : (
              <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{result.error ?? result.data?.felMensaje}</pre>
            )
          }
        />
      )}
    </div>
  )
}

// ── Sección de perfiles FEL ───────────────────────────────────────────────────

function FelProfilesSection() {
  const activeCompany = useCompanyStore(s => s.activeCompany)
  const [profiles, setProfiles]   = useState<ElectronicInvoicingProfile[]>([])
  const [loading, setLoading]     = useState(false)
  const [testing, setTesting]     = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const load = async () => {
    if (!activeCompany) return
    setLoading(true)
    try { setProfiles(await companyIntegrationsApi.getEInvoicing(activeCompany.id)) }
    catch { message.error('Error al cargar perfiles FEL') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeCompany?.id])

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const result = await companyIntegrationsApi.testEInvoicing(id) as any
      setTestResults(prev => ({ ...prev, [id]: result }))
      load()
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: e?.response?.data?.message ?? 'Error' } }))
    } finally { setTesting(null) }
  }

  const columns: ColumnsType<ElectronicInvoicingProfile> = [
    {
      title: 'Estado',
      width: 90,
      render: (_: any, r: ElectronicInvoicingProfile) => {
        const tr = testResults[r.id]
        if (tr) return <Badge status={tr.success ? 'success' : 'error'} text={tr.success ? 'OK' : 'Error'} />
        return <Badge status={r.status === 'active' ? 'success' : r.status === 'error' ? 'error' : 'default'} text={r.status} />
      },
    },
    { title: 'Proveedor', dataIndex: 'provider', render: (v: string) => <Tag color="#1faec2">{v}</Tag> },
    {
      title: 'Régimen / Tipo default',
      render: (_: any, r: ElectronicInvoicingProfile) => {
        const regime = r.apiConfigurationJson?.regimeCode
        const dt     = r.apiConfigurationJson?.defaultDocumentType
        return (
          <Space size={4}>
            {regime && <Text style={{ fontSize: 12 }}>{REGIME_LABELS[regime] ?? regime}</Text>}
            {dt     && <Tag color="#1faec2">{dt}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Ambiente',
      dataIndex: 'environment',
      width: 100,
      render: (v: string) => v === 'production'
        ? <Tag color="#e5484d"    icon={<CheckCircleOutlined />}>Producción</Tag>
        : <Tag color="#ff7f00" icon={<ExclamationCircleOutlined />}>Sandbox</Tag>,
    },
    {
      title: 'Último test',
      dataIndex: 'lastTestedAt',
      width: 150,
      render: (v?: string, r?: ElectronicInvoicingProfile) => (
        <div>
          <div>{v ? new Date(v).toLocaleString('es-GT') : '—'}</div>
          {r?.lastTestResult && <Text type="secondary" style={{ fontSize: 10 }}>{r.lastTestResult.slice(0, 60)}</Text>}
        </div>
      ),
    },
    {
      title: '',
      width: 110,
      render: (_: any, r: ElectronicInvoicingProfile) => (
        <Tooltip title="Probar conexión real con el certificador">
          <Button size="small" icon={<ThunderboltOutlined />}
            loading={testing === r.id}
            onClick={() => handleTest(r.id)}
          >
            Probar
          </Button>
        </Tooltip>
      ),
    },
  ]

  if (!activeCompany) return <Text type="secondary">Selecciona una empresa primero.</Text>

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={profiles}
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: 'Sin perfiles FEL. Configúralos en Empresas → Facturación Electrónica.' }}
    />
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EspacioDesarrolloPage() {
  const activeCompany = useCompanyStore(s => s.activeCompany)

  return (
    <div style={{ padding: '0 0 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Espacio de Desarrollo</Title>
        <Text type="secondary">
          Herramientas de prueba y referencia para Facturación Electrónica (FEL Guatemala)
          {activeCompany && <> — <strong>{activeCompany.legalName}</strong></>}
        </Text>
      </div>

      {/* Perfiles FEL */}
      <Card
        size="small"
        title={<Space><SafetyCertificateOutlined style={{ color: '#1faec2' }} /><strong>Perfiles FEL activos</strong></Space>}
        style={{ marginBottom: 16 }}
        extra={<Text type="secondary" style={{ fontSize: 11 }}>Administra perfiles en Configuración → Empresas → Facturación Electrónica</Text>}
      >
        <FelProfilesSection />
      </Card>

      {/* Panel de prueba */}
      <Card
        size="small"
        title={<Space><ThunderboltOutlined style={{ color: '#096dd9' }} /><strong>Prueba de certificación</strong></Space>}
        style={{ marginBottom: 16 }}
      >
        <CertificationTestPanel />
      </Card>

      {/* Referencia fiscal completa */}
      <Card
        size="small"
        title={<Space><CodeOutlined style={{ color: '#1faec2' }} /><strong>Referencia fiscal — Guatemala</strong></Space>}
      >
        <Paragraph style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
          Referencia rápida de IVA, retenciones, ISR y documentos FEL por régimen fiscal.
          El tipo de documento FEL está determinado por el <strong>régimen del contribuyente</strong> — configúralo en el perfil FEL.
        </Paragraph>
        <Tabs
          size="small"
          items={[
            {
              key:      'fel',
              label:    'Tipos de documento FEL',
              children: <RegimeDocTable />,
            },
            {
              key:      'iva',
              label:    'Características fiscales',
              children: <FiscalMatrixTable />,
            },
            {
              key:      'compras',
              label:    'Al comprar de...',
              children: <PurchaseRulesTable />,
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ── Estilos de tabla ──────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#1faec2',
  borderBottom: '2px solid rgba(10,10,10,0.08)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '6px 10px',
  verticalAlign: 'middle',
}
