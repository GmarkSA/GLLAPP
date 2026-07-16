import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Spin, Typography, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { getPatrono, guardarPatrono, type ConfiguracionPatrono } from '../../../api/planillas'

const { Text, Title } = Typography
const NAVY = '#1B3A6B'

export default function DatosPatronoPage() {
  const [form] = Form.useForm<ConfiguracionPatrono>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPatrono()
      .then(p => { if (p) form.setFieldsValue(p) })
      .catch(() => message.error('Error cargando datos del patrono'))
      .finally(() => setLoading(false))
  }, [form])

  const guardar = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      await guardarPatrono(vals)
      message.success('Datos del patrono guardados')
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: NAVY }}>Datos del patrono</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Fuente única para el archivo IGSS, contratos laborales, finiquitos y recibos de pago
          </Text>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={guardar} style={{ background: NAVY }}>
          Guardar
        </Button>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" size="small">
          <Card size="small" title={<Text strong>Identificación</Text>} style={{ borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="razonSocial" label="Razón social" rules={[{ required: true, message: 'Requerido' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="nit" label="NIT" rules={[{ required: true, message: 'Requerido' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="numeroPatronalIGSS" label="Número patronal IGSS">
                <Input placeholder="usado en el archivo de planilla" />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="nombreComercial" label="Nombre comercial">
                <Input />
              </Form.Item>
              <Form.Item name="actividadEconomica" label="Actividad económica">
                <Input />
              </Form.Item>
              <Form.Item name="codigoActividadEconomicaIGSS" label="Código actividad IGSS">
                <Input />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 12px' }}>
              <Form.Item name="tipoPlanillaNombreIGSS" label="Nombre del tipo de planilla (archivo IGSS)"
                tooltip="Descripción del tipo de planilla que exige el archivo de planilla electrónica v2.2.0, ej. 'Sueldos administración'">
                <Input />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title={<Text strong>Dirección y contacto</Text>} style={{ borderRadius: 8, marginBottom: 16 }}>
            <Form.Item name="direccionFiscal" label="Dirección fiscal">
              <Input />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="departamento" label="Departamento">
                <Input />
              </Form.Item>
              <Form.Item name="municipio" label="Municipio">
                <Input />
              </Form.Item>
              <Form.Item name="telefono" label="Teléfono">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Correo electrónico" rules={[{ type: 'email', message: 'Correo inválido' }]}>
                <Input />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title={<Text strong>Representante legal y régimen</Text>} style={{ borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="representanteLegalNombre" label="Nombre del representante legal">
                <Input />
              </Form.Item>
              <Form.Item name="representanteLegalDPI" label="DPI del representante">
                <Input />
              </Form.Item>
              <Form.Item name="regimenFiscal" label="Régimen fiscal">
                <Input />
              </Form.Item>
            </div>
          </Card>
        </Form>
      </Spin>

      <Alert
        type="info" showIcon style={{ marginTop: 16 }}
        message="Estos datos alimentan el encabezado del archivo IGSS v2.2.0 y los documentos laborales."
        description="El número patronal IGSS forma parte del nombre del archivo de planilla electrónica (numeroPatronal-AAAAMM-ddmmyyyyHHMM.txt)."
      />
    </div>
  )
}
