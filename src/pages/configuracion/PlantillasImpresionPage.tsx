import { useState } from 'react'
import {
  Card, Form, Select, Switch, Input, Button, message,
  Divider, Space, Radio, Tooltip, Row, Col,
} from 'antd'
import {
  SaveOutlined, PrinterOutlined, FontSizeOutlined,
  BgColorsOutlined, LayoutOutlined, FileTextOutlined,
} from '@ant-design/icons'
import {
  type PrintTemplate,
  DEFAULT_TEMPLATE,
  getSavedTemplate,
  saveTemplate,
} from '../../components/Print/printFormats'

const PRESET_COLORS = [
  { label: 'Turquesa',   value: '#1faec2' },
  { label: 'Azul navy',  value: '#1B3A6B' },
  { label: 'Verde',      value: '#2ea172' },
  { label: 'Morado',     value: '#6c47d2' },
  { label: 'Rojo',       value: '#e5484d' },
  { label: 'Naranja',    value: '#f97316' },
  { label: 'Gris',       value: '#6b7280' },
  { label: 'Negro',      value: '#111827' },
]

function InvoicePreview({ tpl }: { tpl: PrintTemplate }) {
  const pc = tpl.primaryColor
  const ff = `'${tpl.fontFamily}', Arial, sans-serif`

  return (
    <div style={{
      fontFamily:  ff,
      fontSize:    10,
      color:       '#000',
      background:  '#fff',
      border:      '1px solid #e5e7eb',
      borderRadius: 6,
      padding:     '16px 18px',
      lineHeight:  1.5,
      userSelect:  'none',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   12,
        flexDirection:  tpl.headerLayout === 'logo-right' ? 'row-reverse' : 'row',
      }}>
        <div>
          {tpl.showLogo && (
            <div style={{
              width: 48, height: 16, background: `${pc}33`,
              borderRadius: 3, marginBottom: 4,
            }} />
          )}
          <div style={{ fontWeight: 700, fontSize: 13, color: pc }}>EMPRESA EJEMPLO, S.A.</div>
          <div style={{ fontSize: 9, color: '#666' }}>NIT: 1234567-8</div>
          <div style={{ fontSize: 9, color: '#666' }}>Ciudad de Guatemala</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' }}>Factura Cambiaria</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: pc }}>FV-00001</div>
          <div style={{ fontSize: 9, color: '#555' }}>Fecha: 31/07/2026</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `2px solid ${pc}`, marginBottom: 8 }} />

      {/* Cliente + FEL */}
      <div style={{ display: 'grid', gridTemplateColumns: tpl.showFelBox ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>Facturar a</div>
          <div style={{ fontWeight: 600 }}>CLIENTE DE EJEMPLO</div>
          <div style={{ fontSize: 9, color: '#666' }}>NIT: CF</div>
        </div>
        {tpl.showFelBox && (
          <div style={{ border: `1px solid ${pc}44`, borderRadius: 4, padding: '6px 8px', background: `${pc}0d` }}>
            <div style={{ fontSize: 8, textTransform: 'uppercase', color: pc, marginBottom: 2 }}>Certificación FEL</div>
            <div style={{ fontSize: 8, color: '#666' }}>Serie: AA9 · Núm: 56153</div>
            <div style={{ fontSize: 7, color: '#888', wordBreak: 'break-all' }}>UUID: 19942AA9-2178...</div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: 9 }}>
        <thead>
          <tr style={{ background: pc }}>
            <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>#</th>
            <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
            {tpl.showUnit     && <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Unidad</th>}
            <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Cant.</th>
            <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Precio</th>
            {tpl.showDiscount && <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Desc.%</th>}
            {tpl.showTaxCol   && <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>IVA%</th>}
            <th style={{ color: '#fff', padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {[
            { desc: 'Servicio de consultoría', unit: 'SER', qty: '1.00', price: 'Q 5,000.00', disc: '—', iva: '12%', total: 'Q 5,000.00' },
            { desc: 'Licencia de software',    unit: 'UND', qty: '3.00', price: 'Q 1,200.00', disc: '5%', iva: '12%', total: 'Q 3,600.00' },
          ].map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '4px 6px', color: '#aaa' }}>{i + 1}</td>
              <td style={{ padding: '4px 6px', fontWeight: 500 }}>{row.desc}</td>
              {tpl.showUnit     && <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.unit}</td>}
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.qty}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.price}</td>
              {tpl.showDiscount && <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.disc}</td>}
              {tpl.showTaxCol   && <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.iva}</td>}
              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ width: 180, fontSize: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#666' }}>
            <span>Subtotal (base sin IVA)</span><span>Q 7,589.29</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: pc, fontWeight: 500 }}>
            <span>IVA (12%)</span><span>Q 910.71</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            background: pc, color: '#fff', fontWeight: 700, fontSize: 10,
            borderRadius: 4, padding: '4px 8px', marginTop: 4,
          }}>
            <span>TOTAL FACTURA (GTQ)</span><span>Q 8,500.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 9, color: '#2ea172' }}>
            <span>Pagos aplicados</span><span>− Q 1,000.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, fontWeight: 700, color: '#e5484d', borderTop: '1px solid rgba(10,10,10,0.12)', marginTop: 2 }}>
            <span>SALDO ADEUDADO</span><span>Q 7,500.00</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#aaa' }}>
        <span>{tpl.footerText || 'Lucía — Sistema de Contabilidad'}</span>
        {tpl.showPrintDate && <span>Impreso: 31/07/2026 04:35 p.m.</span>}
      </div>
    </div>
  )
}

export default function PlantillasImpresionPage() {
  const [tpl, setTpl] = useState<PrintTemplate>(getSavedTemplate)

  const update = (patch: Partial<PrintTemplate>) =>
    setTpl(prev => ({ ...prev, ...patch }))

  const handleSave = () => {
    saveTemplate(tpl)
    message.success('Plantilla guardada. Se aplicará en la próxima impresión.')
  }

  const handleReset = () => {
    setTpl(DEFAULT_TEMPLATE)
    saveTemplate(DEFAULT_TEMPLATE)
    message.info('Plantilla restablecida a valores predeterminados.')
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
            <PrinterOutlined style={{ marginRight: 8, color: '#1faec2' }} />
            Plantillas de Impresión
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Personaliza el diseño de facturas y cotizaciones. Los cambios se aplican en tiempo real en la vista previa.
          </div>
        </div>
        <Space>
          <Button onClick={handleReset}>Restablecer</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}
            style={{ background: '#1faec2', borderColor: '#1faec2' }}>
            Guardar plantilla
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        {/* ── Panel de configuración ── */}
        <Col xs={24} lg={10}>

          {/* Tipografía */}
          <Card
            size="small"
            title={<Space><FontSizeOutlined style={{ color: '#1faec2' }} /><span>Tipografía</span></Space>}
            style={{ marginBottom: 16 }}
          >
            <Form layout="vertical" size="small">
              <Form.Item label="Fuente del documento" style={{ marginBottom: 0 }}>
                <Select
                  value={tpl.fontFamily}
                  onChange={v => update({ fontFamily: v })}
                  options={[
                    { label: 'Arial (predeterminado)', value: 'Arial' },
                    { label: 'Helvetica',              value: 'Helvetica' },
                    { label: 'Times New Roman',         value: 'Times New Roman' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>

          {/* Color */}
          <Card
            size="small"
            title={<Space><BgColorsOutlined style={{ color: '#1faec2' }} /><span>Color principal</span></Space>}
            style={{ marginBottom: 16 }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Color del encabezado de tabla, acento y totales</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRESET_COLORS.map(c => (
                  <Tooltip key={c.value} title={c.label}>
                    <div
                      onClick={() => update({ primaryColor: c.value })}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background:  c.value, cursor: 'pointer',
                        border:      tpl.primaryColor === c.value ? '3px solid #111' : '2px solid transparent',
                        boxShadow:   '0 1px 4px rgba(0,0,0,0.2)',
                        transition:  'transform 0.15s',
                        transform:   tpl.primaryColor === c.value ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Color personalizado:</div>
              <input
                type="color"
                value={tpl.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
                style={{ width: 36, height: 28, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer', padding: 2 }}
              />
              <Input
                value={tpl.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
                style={{ width: 100, fontFamily: 'monospace', fontSize: 12 }}
                maxLength={7}
              />
            </div>
          </Card>

          {/* Diseño */}
          <Card
            size="small"
            title={<Space><LayoutOutlined style={{ color: '#1faec2' }} /><span>Diseño del encabezado</span></Space>}
            style={{ marginBottom: 16 }}
          >
            <Form layout="vertical" size="small">
              <Form.Item label="Posición de la empresa / logo" style={{ marginBottom: 12 }}>
                <Radio.Group
                  value={tpl.headerLayout}
                  onChange={e => update({ headerLayout: e.target.value })}
                >
                  <Space direction="vertical" style={{ gap: 4 }}>
                    <Radio value="logo-left">
                      <span>Empresa a la <strong>izquierda</strong>, número de factura a la derecha</span>
                    </Radio>
                    <Radio value="logo-right">
                      <span>Empresa a la <strong>derecha</strong>, número de factura a la izquierda</span>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Logo de empresa" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch checked={tpl.showLogo} onChange={v => update({ showLogo: v })} size="small" />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {tpl.showLogo ? 'Mostrar logo en documentos' : 'Ocultar logo'}
                  </span>
                </div>
              </Form.Item>
            </Form>
          </Card>

          {/* Columnas */}
          <Card
            size="small"
            title={<Space><FileTextOutlined style={{ color: '#1faec2' }} /><span>Columnas de la tabla</span></Space>}
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'showUnit',     label: 'Columna Unidad (UND, SER, KG…)' },
                { key: 'showDiscount', label: 'Columna Descuento %' },
                { key: 'showTaxCol',   label: 'Columna IVA %' },
                { key: 'showFelBox',   label: 'Recuadro de Certificación FEL' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    checked={tpl[key as keyof PrintTemplate] as boolean}
                    onChange={v => update({ [key]: v })}
                    size="small"
                  />
                  <span style={{ fontSize: 12 }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Pie de página */}
          <Card
            size="small"
            title={<Space><FileTextOutlined style={{ color: '#1faec2' }} /><span>Pie de página</span></Space>}
          >
            <Form layout="vertical" size="small">
              <Form.Item label="Texto del pie" style={{ marginBottom: 10 }}>
                <Input
                  value={tpl.footerText}
                  onChange={e => update({ footerText: e.target.value })}
                  placeholder="Ej: Mi Empresa — Sistema ERP"
                  maxLength={80}
                />
              </Form.Item>
              <Form.Item label="Fecha y hora de impresión" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch checked={tpl.showPrintDate} onChange={v => update({ showPrintDate: v })} size="small" />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {tpl.showPrintDate ? 'Mostrar fecha/hora en pie' : 'Ocultar fecha/hora'}
                  </span>
                </div>
              </Form.Item>
            </Form>
          </Card>

        </Col>

        {/* ── Vista previa ── */}
        <Col xs={24} lg={14}>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginBottom:   12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Vista previa — Factura carta
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Se actualiza en tiempo real
              </div>
            </div>
            <InvoicePreview tpl={tpl} />
            <Divider style={{ margin: '16px 0 8px' }} />
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              Esta plantilla se aplica a Facturas y Cotizaciones al imprimir o generar PDF.
              Los cambios se guardan localmente hasta que presiones <strong>Guardar plantilla</strong>.
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}
