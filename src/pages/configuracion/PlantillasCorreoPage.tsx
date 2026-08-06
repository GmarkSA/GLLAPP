import { useState } from 'react'
import {
  Card, Form, Select, Switch, Input, Button, message,
  Space, Tag, Tooltip, Row, Col, Popconfirm, Badge,
} from 'antd'
import {
  SaveOutlined, MailOutlined, PlusOutlined, DeleteOutlined,
  StarFilled, StarOutlined, CopyOutlined,
} from '@ant-design/icons'
import {
  type EmailTemplate,
  type EmailDocumentType,
  EMAIL_VARS,
  PREVIEW_VARS,
  replaceVars,
  getEmailTemplates,
  saveEmailTemplates,
} from '../../api/emailTemplates'

const { TextArea } = Input

const DOC_TYPE_LABELS: Record<EmailDocumentType, string> = {
  factura:           'Factura',
  cotizacion:        'Cotización',
  pago:              'Pago recibido',
  factura_proveedor: 'Factura Proveedor',
  orden_compra:      'Orden de Compra',
}

const DOC_TYPE_COLORS: Record<EmailDocumentType, string> = {
  factura:           '#1faec2',
  cotizacion:        '#6c47d2',
  pago:              '#2ea172',
  factura_proveedor: '#ff7f00',
  orden_compra:      '#1B3A6B',
}

// ── Vista previa del email ────────────────────────────────────────────────────

function EmailPreview({ tpl }: { tpl: EmailTemplate }) {
  const greeting = replaceVars(tpl.greeting, PREVIEW_VARS)
  const msg      = replaceVars(tpl.message,  PREVIEW_VARS)
  const subject  = replaceVars(tpl.subject,  PREVIEW_VARS)

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
      {/* Barra de email */}
      <div style={{ background: '#f9fafb', padding: '8px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 11 }}>
        <div style={{ color: '#6b7280' }}>
          <strong>De:</strong> {PREVIEW_VARS.nombreEmpresa} &lt;facturas@lucia.gllconsulting.com&gt;
        </div>
        <div style={{ color: '#6b7280' }}>
          <strong>Para:</strong> cliente@empresaejemplo.com
        </div>
        <div style={{ color: '#111827', fontWeight: 600, marginTop: 4 }}>
          <strong>Asunto:</strong> {subject}
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ background: '#f3f4f6', padding: 12 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

          {/* Logo banner */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ width: 80, height: 20, background: '#1faec233', borderRadius: 4 }} />
          </div>
          <div style={{ background: '#1B3A6B', color: '#fff', padding: '12px 20px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
            #{PREVIEW_VARS.numeroFactura} de {DOC_TYPE_LABELS[tpl.documentType]}
          </div>

          {/* Cuerpo */}
          <div style={{ padding: '18px 20px', color: '#374151' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13 }}>{greeting}</p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#555', textAlign: 'justify' }}>
              Gracias por confiar en nosotros. Su documento puede ser visto, impreso o descargado como PDF ingresando al sistema.
            </p>
            {msg && (
              <p style={{ margin: '0 0 14px', fontSize: 12, padding: '8px 12px', background: '#f9fafb', borderLeft: '3px solid #1faec2', borderRadius: '0 4px 4px 0' }}>
                {msg}
              </p>
            )}

            {/* Tabla resumen */}
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: 11 }}>
              {[
                ['N° Documento', PREVIEW_VARS.numeroFactura],
                ['Fecha',        PREVIEW_VARS.fecha],
                ['Total',        PREVIEW_VARS.total],
                ['Saldo adeudado', PREVIEW_VARS.saldo],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '40%' }}>{label}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{value}</td>
                </tr>
              ))}
            </table>

            {/* Importe */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 5, padding: '12px', textAlign: 'center', margin: '12px 0', background: '#fafafa' }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                IMPORTE DE LA FACTURA
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e5484d' }}>{PREVIEW_VARS.total}</div>
            </div>

            {/* Cuentas bancarias */}
            {tpl.showBankAccounts && (
              <div style={{ marginTop: 12, fontSize: 11, color: '#555' }}>
                <p style={{ margin: '0 0 4px' }}>El pago puede realizarse en las siguientes cuentas:</p>
                <div style={{ fontWeight: 600, color: '#374151' }}>Cuenta Monetaria Principal — Banco Ejemplo #00123456</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: '#f9fafb', padding: '10px 20px', textAlign: 'center', fontSize: 10, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
            {PREVIEW_VARS.nombreEmpresa}
            {tpl.footerText && ` · ${tpl.footerText}`}
            <br /><span style={{ fontSize: 9 }}>Enviado desde Lucía</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

function newTemplate(): EmailTemplate {
  return {
    id:               `tpl-${Date.now()}`,
    name:             'Nueva plantilla',
    documentType:     'factura',
    subject:          'Factura {{numeroFactura}} — {{nombreEmpresa}}',
    greeting:         'Estimado/a {{nombreCliente}}:',
    message:          '',
    showBankAccounts: true,
    footerText:       '',
    isDefault:        false,
  }
}

export default function PlantillasCorreoPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(getEmailTemplates)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const def = getEmailTemplates().find(t => t.isDefault)
    return def?.id ?? getEmailTemplates()[0]?.id ?? ''
  })

  const selected = templates.find(t => t.id === selectedId)

  const update = (patch: Partial<EmailTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch } : t))
  }

  const setDefault = (id: string) => {
    setTemplates(prev => prev.map(t => ({ ...t, isDefault: t.id === id })))
  }

  const addTemplate = () => {
    const tpl = newTemplate()
    setTemplates(prev => [...prev, tpl])
    setSelectedId(tpl.id)
  }

  const duplicateTemplate = () => {
    if (!selected) return
    const copy: EmailTemplate = { ...selected, id: `tpl-${Date.now()}`, name: `${selected.name} (copia)`, isDefault: false }
    setTemplates(prev => [...prev, copy])
    setSelectedId(copy.id)
  }

  const deleteTemplate = (id: string) => {
    const remaining = templates.filter(t => t.id !== id)
    if (remaining.length === 0) return
    // Si era la predeterminada, marcar la primera como default
    if (templates.find(t => t.id === id)?.isDefault && remaining.length > 0) {
      remaining[0].isDefault = true
    }
    setTemplates(remaining)
    if (selectedId === id) setSelectedId(remaining[0].id)
  }

  const handleSave = () => {
    saveEmailTemplates(templates)
    message.success('Plantillas de correo guardadas.')
  }

  const insertVar = (varKey: string) => {
    // Inserta la variable en el campo Mensaje adicional (simplificado)
    if (!selected) return
    update({ message: `${selected.message}{{${varKey}}}` })
  }

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
            <MailOutlined style={{ marginRight: 8, color: '#1faec2' }} />
            Plantillas de Correo
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Crea y personaliza las plantillas que se usan al enviar facturas, cotizaciones y pagos por correo.
          </div>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}
          style={{ background: '#1faec2', borderColor: '#1faec2' }}>
          Guardar plantillas
        </Button>
      </div>

      <Row gutter={20}>

        {/* ── Lista de plantillas ── */}
        <Col xs={24} lg={6}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mis plantillas
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={addTemplate}>Nueva</Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map(tpl => (
              <Card
                key={tpl.id}
                size="small"
                onClick={() => setSelectedId(tpl.id)}
                style={{
                  cursor:     'pointer',
                  border:     selectedId === tpl.id ? '2px solid #1faec2' : '1px solid #e5e7eb',
                  background: selectedId === tpl.id ? '#f0fbfd' : '#fff',
                  transition: 'all 0.15s',
                }}
                styles={{ body: { padding: '10px 12px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tpl.name}
                    </div>
                    <Tag color={DOC_TYPE_COLORS[tpl.documentType]} style={{ fontSize: 10, padding: '0 6px' }}>
                      {DOC_TYPE_LABELS[tpl.documentType]}
                    </Tag>
                  </div>
                  <Tooltip title={tpl.isDefault ? 'Predeterminada' : 'Establecer como predeterminada'}>
                    <Button
                      type="text" size="small"
                      icon={tpl.isDefault
                        ? <StarFilled  style={{ color: '#f59e0b', fontSize: 15 }} />
                        : <StarOutlined style={{ color: '#d1d5db', fontSize: 15 }} />
                      }
                      onClick={e => { e.stopPropagation(); setDefault(tpl.id) }}
                      style={{ padding: 0, height: 'auto' }}
                    />
                  </Tooltip>
                </div>
                {tpl.isDefault && (
                  <Badge count="Predeterminada"
                    style={{ background: '#1faec2', fontSize: 10, marginTop: 6 }} />
                )}
              </Card>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#6b7280' }}>
            <StarFilled style={{ color: '#f59e0b', marginRight: 4 }} />
            La plantilla ★ se pre-selecciona automáticamente al enviar el correo.
          </div>
        </Col>

        {/* ── Editor ── */}
        <Col xs={24} lg={9}>
          {selected ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Editor — {selected.name}
                </span>
                <Space size={4}>
                  <Tooltip title="Duplicar plantilla">
                    <Button size="small" icon={<CopyOutlined />} onClick={duplicateTemplate} />
                  </Tooltip>
                  <Popconfirm
                    title="¿Eliminar esta plantilla?"
                    okText="Eliminar" cancelText="Cancelar"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteTemplate(selected.id)}
                    disabled={templates.length <= 1}
                  >
                    <Tooltip title={templates.length <= 1 ? 'Debe existir al menos una plantilla' : 'Eliminar plantilla'}>
                      <Button size="small" icon={<DeleteOutlined />} danger disabled={templates.length <= 1} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>

              <Form layout="vertical" size="small">

                <Card size="small" style={{ marginBottom: 12 }}>
                  <Form.Item label="Nombre de la plantilla" style={{ marginBottom: 10 }}>
                    <Input value={selected.name} onChange={e => update({ name: e.target.value })} />
                  </Form.Item>
                  <Form.Item label="Tipo de documento" style={{ marginBottom: 0 }}>
                    <Select
                      value={selected.documentType}
                      onChange={v => update({ documentType: v })}
                      options={[
                        { label: 'Factura',             value: 'factura'           },
                        { label: 'Cotización',          value: 'cotizacion'        },
                        { label: 'Pago recibido',       value: 'pago'              },
                        { label: 'Factura Proveedor',   value: 'factura_proveedor' },
                        { label: 'Orden de Compra',     value: 'orden_compra'      },
                      ]}
                    />
                  </Form.Item>
                </Card>

                <Card size="small" title="Contenido del correo" style={{ marginBottom: 12 }}>
                  <Form.Item label="Asunto" style={{ marginBottom: 10 }}>
                    <Input
                      value={selected.subject}
                      onChange={e => update({ subject: e.target.value })}
                      placeholder="Ej: Factura {{numeroFactura}} — {{nombreEmpresa}}"
                    />
                  </Form.Item>
                  <Form.Item label="Saludo" style={{ marginBottom: 10 }}>
                    <Input
                      value={selected.greeting}
                      onChange={e => update({ greeting: e.target.value })}
                      placeholder="Ej: Estimado/a {{nombreCliente}}:"
                    />
                  </Form.Item>
                  <Form.Item label="Mensaje adicional" style={{ marginBottom: 0 }}>
                    <TextArea
                      value={selected.message}
                      onChange={e => update({ message: e.target.value })}
                      rows={4}
                      placeholder="Texto adicional que aparece en el cuerpo del correo (opcional)"
                    />
                  </Form.Item>
                </Card>

                <Card size="small" title="Variables disponibles" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                    Haz clic en una variable para insertarla en el mensaje:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EMAIL_VARS.map(v => (
                      <Tooltip key={v.key} title={`Ejemplo: ${v.example}`}>
                        <Tag
                          style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                          color="blue"
                          onClick={() => insertVar(v.key)}
                        >
                          {`{{${v.key}}}`}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                </Card>

                <Card size="small" title="Opciones adicionales">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Space>
                      <Switch
                        checked={selected.showBankAccounts}
                        onChange={v => update({ showBankAccounts: v })}
                        size="small"
                      />
                      <span style={{ fontSize: 12 }}>Mostrar cuentas bancarias en el correo</span>
                    </Space>
                    <Form.Item label="Pie del correo (adicional)" style={{ marginBottom: 0 }}>
                      <Input
                        value={selected.footerText}
                        onChange={e => update({ footerText: e.target.value })}
                        placeholder="Ej: Atención al cliente: 2222-3333"
                        maxLength={100}
                      />
                    </Form.Item>
                  </div>
                </Card>

              </Form>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              Selecciona una plantilla para editarla
            </div>
          )}
        </Col>

        {/* ── Vista previa ── */}
        <Col xs={24} lg={9}>
          {selected && (
            <div style={{ position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Vista previa
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Tiempo real</span>
              </div>
              <EmailPreview tpl={selected} />
              <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                Los datos en la vista previa son de ejemplo.
                Las variables <code style={{ fontSize: 10 }}>{'{{var}}'}</code> se reemplazan al momento de enviar.
              </div>
            </div>
          )}
        </Col>

      </Row>
    </div>
  )
}
