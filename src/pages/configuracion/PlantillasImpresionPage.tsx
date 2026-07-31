import { useState } from 'react'
import {
  Card, Form, Select, Switch, Input, Button, message,
  Space, Radio, Tooltip, Row, Col, Tag, Badge,
} from 'antd'
import {
  SaveOutlined, PrinterOutlined, FontSizeOutlined,
  BgColorsOutlined, LayoutOutlined, FileTextOutlined, StarFilled, StarOutlined,
} from '@ant-design/icons'
import {
  PRINT_FORMATS,
  type PrintFormatId,
  type PrintTemplate,
  type FormatTemplate,
  DEFAULT_TEMPLATE,
  getFormatTemplates,
  saveFormatTemplates,
} from '../../components/Print/printFormats'

const PRESET_COLORS = [
  { label: 'Turquesa',  value: '#1faec2' },
  { label: 'Azul navy', value: '#1B3A6B' },
  { label: 'Verde',     value: '#2ea172' },
  { label: 'Morado',    value: '#6c47d2' },
  { label: 'Rojo',      value: '#e5484d' },
  { label: 'Naranja',   value: '#f97316' },
  { label: 'Gris',      value: '#6b7280' },
  { label: 'Negro',     value: '#111827' },
]

// ── Vista previa ──────────────────────────────────────────────────────────────

function InvoicePreview({ tpl, isTicket }: { tpl: PrintTemplate; isTicket: boolean }) {
  const pc = tpl.primaryColor
  const ff = `'${tpl.fontFamily}', Arial, sans-serif`

  if (isTicket) {
    return (
      <div style={{ fontFamily: ff, fontSize: 9, color: '#000', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 10px', maxWidth: 180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {tpl.showLogo && <div style={{ width: 40, height: 12, background: `${pc}33`, borderRadius: 2, margin: '0 auto 4px' }} />}
          <div style={{ fontWeight: 700, color: pc, fontSize: 10 }}>EMPRESA EJEMPLO</div>
          <div style={{ fontSize: 8, color: '#666' }}>NIT: 1234567-8</div>
        </div>
        <div style={{ borderTop: `2px solid ${pc}`, margin: '4px 0' }} />
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, color: pc }}>FACTURA</div>
        <div style={{ textAlign: 'center', fontSize: 8, color: '#555', marginBottom: 4 }}>FV-00001 · 31/07/2026</div>
        <div style={{ borderTop: '1px dashed #ccc', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontWeight: 500 }}>Servicio consultoría</span>
          <span style={{ fontWeight: 600 }}>Q 5,000</span>
        </div>
        <div style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>1 × Q 5,000.00</div>
        <div style={{ borderTop: `2px solid ${pc}`, margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 11 }}>
          <span>TOTAL</span><span>Q 5,600.00</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 7, color: '#aaa', marginTop: 6 }}>
          {tpl.footerText}
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: ff, fontSize: 9, color: '#000', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexDirection: tpl.headerLayout === 'logo-right' ? 'row-reverse' : 'row' }}>
        <div>
          {tpl.showLogo && <div style={{ width: 44, height: 14, background: `${pc}33`, borderRadius: 3, marginBottom: 3 }} />}
          <div style={{ fontWeight: 700, fontSize: 11, color: pc }}>EMPRESA EJEMPLO, S.A.</div>
          <div style={{ fontSize: 8, color: '#666' }}>NIT: 1234567-8 · Ciudad de Guatemala</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase' }}>Factura Cambiaria</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: pc }}>FV-00001</div>
          <div style={{ fontSize: 8, color: '#555' }}>31/07/2026</div>
        </div>
      </div>
      <div style={{ borderTop: `2px solid ${pc}`, marginBottom: 7 }} />
      <div style={{ display: 'grid', gridTemplateColumns: tpl.showFelBox ? '1fr 1fr' : '1fr', gap: 6, marginBottom: 7 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 3, padding: '5px 6px' }}>
          <div style={{ fontSize: 7, color: '#6b7280', marginBottom: 2 }}>FACTURAR A</div>
          <div style={{ fontWeight: 600, fontSize: 9 }}>CLIENTE DE EJEMPLO</div>
          <div style={{ fontSize: 7, color: '#666' }}>NIT: CF</div>
        </div>
        {tpl.showFelBox && (
          <div style={{ border: `1px solid ${pc}44`, borderRadius: 3, padding: '5px 6px', background: `${pc}0d` }}>
            <div style={{ fontSize: 7, color: pc, marginBottom: 2 }}>CERTIFICACIÓN FEL</div>
            <div style={{ fontSize: 7, color: '#666' }}>Serie: AA9 · Núm: 56153</div>
          </div>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6, fontSize: 8 }}>
        <thead>
          <tr style={{ background: pc }}>
            {['#', 'Descripción', ...(tpl.showUnit ? ['Unidad'] : []), 'Cant.', 'Precio', ...(tpl.showDiscount ? ['Desc.%'] : []), ...(tpl.showTaxCol ? ['IVA%'] : []), 'Total'].map((h, i) => (
              <th key={i} style={{ color: '#fff', padding: '3px 5px', textAlign: i === 1 ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[['1', 'Servicio consultoría', 'SER', '1.00', 'Q 5,000', '—', '12%', 'Q 5,000'], ['2', 'Licencia software', 'UND', '3.00', 'Q 1,200', '5%', '12%', 'Q 3,600']].map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
              {[row[0], row[1], ...(tpl.showUnit ? [row[2]] : []), row[3], row[4], ...(tpl.showDiscount ? [row[5]] : []), ...(tpl.showTaxCol ? [row[6]] : []), row[7]].map((cell, j) => (
                <td key={j} style={{ padding: '3px 5px', textAlign: j === 1 ? 'left' : 'right', fontWeight: j === 0 ? 700 : 'normal' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <div style={{ width: 160, fontSize: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}><span>Subtotal</span><span>Q 7,589.29</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: pc }}><span>IVA (12%)</span><span>Q 910.71</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: pc, color: '#fff', fontWeight: 700, borderRadius: 3, padding: '3px 6px', marginTop: 3 }}>
            <span>TOTAL FACTURA</span><span>Q 8,500.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ea172', marginTop: 2 }}><span>Pagos aplicados</span><span>− Q 1,000.00</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e5484d', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 2, marginTop: 2 }}>
            <span>SALDO ADEUDADO</span><span>Q 7,500.00</span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 5, display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#aaa' }}>
        <span>{tpl.footerText}</span>
        {tpl.showPrintDate && <span>Impreso: 31/07/2026</span>}
      </div>
    </div>
  )
}

// ── Panel de diseño ───────────────────────────────────────────────────────────

function DesignEditor({ tpl, onChange }: { tpl: PrintTemplate; onChange: (patch: Partial<PrintTemplate>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <Card size="small" title={<Space><FontSizeOutlined style={{ color: '#1faec2' }} /><span>Tipografía</span></Space>}>
        <Form layout="vertical" size="small">
          <Form.Item label="Fuente" style={{ marginBottom: 0 }}>
            <Select
              value={tpl.fontFamily}
              onChange={v => onChange({ fontFamily: v })}
              options={[
                { label: 'Arial (predeterminado)', value: 'Arial' },
                { label: 'Helvetica',              value: 'Helvetica' },
                { label: 'Times New Roman',        value: 'Times New Roman' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={<Space><BgColorsOutlined style={{ color: '#1faec2' }} /><span>Color principal</span></Space>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {PRESET_COLORS.map(c => (
            <Tooltip key={c.value} title={c.label}>
              <div onClick={() => onChange({ primaryColor: c.value })} style={{
                width: 24, height: 24, borderRadius: '50%', background: c.value, cursor: 'pointer',
                border: tpl.primaryColor === c.value ? '3px solid #111' : '2px solid transparent',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                transform: tpl.primaryColor === c.value ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.15s',
              }} />
            </Tooltip>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Personalizado:</span>
          <input type="color" value={tpl.primaryColor} onChange={e => onChange({ primaryColor: e.target.value })}
            style={{ width: 32, height: 26, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer', padding: 2 }} />
          <Input value={tpl.primaryColor} onChange={e => onChange({ primaryColor: e.target.value })}
            style={{ width: 90, fontFamily: 'monospace', fontSize: 12 }} maxLength={7} />
        </div>
      </Card>

      <Card size="small" title={<Space><LayoutOutlined style={{ color: '#1faec2' }} /><span>Encabezado</span></Space>}>
        <Form layout="vertical" size="small">
          <Form.Item label="Posición empresa / logo" style={{ marginBottom: 10 }}>
            <Radio.Group value={tpl.headerLayout} onChange={e => onChange({ headerLayout: e.target.value })}>
              <Space direction="vertical" style={{ gap: 4 }}>
                <Radio value="logo-left">Empresa a la <strong>izquierda</strong></Radio>
                <Radio value="logo-right">Empresa a la <strong>derecha</strong></Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="Logo" style={{ marginBottom: 0 }}>
            <Space>
              <Switch checked={tpl.showLogo} onChange={v => onChange({ showLogo: v })} size="small" />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{tpl.showLogo ? 'Visible' : 'Oculto'}</span>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={<Space><FileTextOutlined style={{ color: '#1faec2' }} /><span>Columnas</span></Space>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'showUnit',     label: 'Columna Unidad' },
            { key: 'showDiscount', label: 'Columna Descuento %' },
            { key: 'showTaxCol',   label: 'Columna IVA %' },
            { key: 'showFelBox',   label: 'Recuadro FEL' },
          ].map(({ key, label }) => (
            <Space key={key}>
              <Switch checked={tpl[key as keyof PrintTemplate] as boolean} onChange={v => onChange({ [key]: v })} size="small" />
              <span style={{ fontSize: 12 }}>{label}</span>
            </Space>
          ))}
        </div>
      </Card>

      <Card size="small" title={<Space><FileTextOutlined style={{ color: '#1faec2' }} /><span>Pie de página</span></Space>}>
        <Form layout="vertical" size="small">
          <Form.Item label="Texto del pie" style={{ marginBottom: 10 }}>
            <Input value={tpl.footerText} onChange={e => onChange({ footerText: e.target.value })} maxLength={80} />
          </Form.Item>
          <Form.Item label="Fecha de impresión" style={{ marginBottom: 0 }}>
            <Space>
              <Switch checked={tpl.showPrintDate} onChange={v => onChange({ showPrintDate: v })} size="small" />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{tpl.showPrintDate ? 'Visible' : 'Oculta'}</span>
            </Space>
          </Form.Item>
        </Form>
      </Card>

    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PlantillasImpresionPage() {
  const [formatTemplates, setFormatTemplates] = useState<FormatTemplate[]>(getFormatTemplates)
  const [selectedId, setSelectedId]           = useState<PrintFormatId>(() => {
    const def = getFormatTemplates().find(t => t.isDefault)
    return def?.formatId ?? 'carta'
  })

  const selectedEntry = formatTemplates.find(t => t.formatId === selectedId)!
  const selectedFormat = PRINT_FORMATS.find(f => f.id === selectedId)!

  const updateTemplate = (patch: Partial<PrintTemplate>) => {
    setFormatTemplates(prev => prev.map(t =>
      t.formatId === selectedId ? { ...t, template: { ...t.template, ...patch } } : t
    ))
  }

  const setDefault = (formatId: PrintFormatId) => {
    setFormatTemplates(prev => prev.map(t => ({ ...t, isDefault: t.formatId === formatId })))
  }

  const resetTemplate = () => {
    setFormatTemplates(prev => prev.map(t =>
      t.formatId === selectedId ? { ...t, template: { ...DEFAULT_TEMPLATE } } : t
    ))
    message.info('Plantilla restablecida a valores predeterminados.')
  }

  const handleSave = () => {
    saveFormatTemplates(formatTemplates)
    message.success('Plantillas guardadas. El botón "Imprimir PDF" usará el formato predeterminado.')
  }

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
            <PrinterOutlined style={{ marginRight: 8, color: '#1faec2' }} />
            Plantillas de Impresión
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Elige el formato predeterminado y personaliza el diseño de cada uno.
            El botón "Imprimir PDF" usará el formato marcado como predeterminado sin preguntar.
          </div>
        </div>
        <Space>
          <Button onClick={resetTemplate}>Restablecer</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}
            style={{ background: '#1faec2', borderColor: '#1faec2' }}>
            Guardar
          </Button>
        </Space>
      </div>

      <Row gutter={20}>

        {/* ── Selector de formatos ── */}
        <Col xs={24} lg={6}>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Formatos disponibles
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRINT_FORMATS.map(f => {
              const entry     = formatTemplates.find(t => t.formatId === f.id)!
              const isSelected = selectedId === f.id
              const isDefault  = entry.isDefault

              return (
                <Card
                  key={f.id}
                  size="small"
                  onClick={() => setSelectedId(f.id)}
                  style={{
                    cursor:      'pointer',
                    border:      isSelected ? '2px solid #1faec2' : '1px solid #e5e7eb',
                    background:  isSelected ? '#f0fbfd' : '#fff',
                    transition:  'all 0.15s',
                  }}
                  styles={{ body: { padding: '10px 12px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{f.label}</span>
                        {f.isTicket && <Tag color="green" style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>Térmica</Tag>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{f.description}</div>
                    </div>
                    <Tooltip title={isDefault ? 'Predeterminado' : 'Establecer como predeterminado'}>
                      <Button
                        type="text"
                        size="small"
                        icon={isDefault
                          ? <StarFilled style={{ color: '#f59e0b', fontSize: 16 }} />
                          : <StarOutlined style={{ color: '#d1d5db', fontSize: 16 }} />
                        }
                        onClick={e => { e.stopPropagation(); setDefault(f.id) }}
                        style={{ padding: 0, height: 'auto' }}
                      />
                    </Tooltip>
                  </div>
                  {isDefault && (
                    <Badge
                      count="Predeterminado"
                      style={{ background: '#1faec2', fontSize: 10, marginTop: 6 }}
                    />
                  )}
                </Card>
              )
            })}
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#6b7280' }}>
            <StarFilled style={{ color: '#f59e0b', marginRight: 4 }} />
            El formato con ★ es el que se usa al presionar "Imprimir PDF" sin seleccionar manualmente.
          </div>
        </Col>

        {/* ── Editor de diseño ── */}
        <Col xs={24} lg={9}>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Diseño — {selectedFormat.label}
          </div>
          <DesignEditor
            tpl={selectedEntry.template}
            onChange={updateTemplate}
          />
        </Col>

        {/* ── Vista previa ── */}
        <Col xs={24} lg={9}>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Vista previa
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Tiempo real</span>
            </div>
            <InvoicePreview
              tpl={selectedEntry.template}
              isTicket={selectedFormat.isTicket}
            />
            <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              Cada formato tiene su propio diseño independiente.
            </div>
          </div>
        </Col>

      </Row>
    </div>
  )
}
