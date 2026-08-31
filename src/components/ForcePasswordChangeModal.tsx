import { useState } from 'react'
import { Modal, Form, Input, Button, Typography, message, Space } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { changeMyPassword } from '../api/auth'
import { useAuthStore } from '../store/authStore'

const { Text } = Typography

/**
 * Clave inicial estilo SAP: si el admin asignó la contraseña (mustChangePassword),
 * el usuario debe definir la suya antes de operar. No se puede cerrar sin cambiarla
 * (o cerrando sesión). Tras el cambio el backend invalida las sesiones → re-login.
 */
export default function ForcePasswordChangeModal() {
  const navigate = useNavigate()
  const user   = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  if (!user?.mustChangePassword) return null

  const guardar = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      await changeMyPassword(v.currentPassword, v.newPassword)
      message.success('Contraseña actualizada — inicia sesión con tu nueva contraseña', 6)
      logout()
      navigate('/login')
    } catch (e: any) {
      const raw = e?.response?.data?.message
      if (raw) message.error(Array.isArray(raw) ? raw.join(' · ') : String(raw), 6)
    } finally { setSaving(false) }
  }

  return (
    <Modal open closable={false} maskClosable={false} keyboard={false} centered width={440} footer={null}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, margin: '0 auto 10px', background: 'linear-gradient(135deg,#1faec2,#0e8fa0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          <LockOutlined />
        </div>
        <Typography.Title level={5} style={{ margin: 0 }}>Define tu contraseña</Typography.Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Tu administrador te asignó una contraseña temporal. Por seguridad debes cambiarla antes de continuar.
        </Text>
      </div>
      <Form form={form} layout="vertical" size="middle">
        <Form.Item name="currentPassword" label="Contraseña temporal (la que te dio tu administrador)" rules={[{ required: true, message: 'Requerida' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label="Nueva contraseña" rules={[{ required: true, message: 'Requerida' }, { min: 8, message: 'Mínimo 8 caracteres' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" label="Confirmar nueva contraseña" dependencies={['newPassword']}
          rules={[{ required: true, message: 'Requerida' }, ({ getFieldValue }) => ({ validator: (_, v) => v && v !== getFieldValue('newPassword') ? Promise.reject(new Error('Las contraseñas no coinciden')) : Promise.resolve() })]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <Button type="text" style={{ color: '#9aa1ab' }} onClick={() => { logout(); navigate('/login') }}>Cerrar sesión</Button>
        <Space>
          <Button type="primary" loading={saving} style={{ background: '#1faec2' }} onClick={guardar}>Guardar contraseña →</Button>
        </Space>
      </div>
    </Modal>
  )
}
