import { useEffect, useState } from 'react'
import { Alert, Button } from 'antd'
import { RiseOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getAlertaCierre, esAdminUsuario, type AlertaCierre } from '../api/consolidacion'

/**
 * Banner de cierre fiscal en el Dashboard — visible solo para el Admin a partir
 * del día del mes que él configure (Configuración → Contabilidad; default 28),
 * cuando hay recomendaciones de facturación intercompany pendientes.
 */
export default function AlertaCierreFiscalBanner() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [alerta, setAlerta] = useState<AlertaCierre | null>(null)

  useEffect(() => {
    if (!esAdminUsuario(user)) return
    getAlertaCierre().then(setAlerta).catch(() => null)
  }, [user])

  if (!alerta?.activa || !(alerta.recomendaciones?.length)) return null
  const n = alerta.recomendaciones.length

  return (
    <Alert
      type="warning" showIcon icon={<RiseOutlined />}
      style={{ marginBottom: 16, borderRadius: 8 }}
      message={<b>Acción de cierre fiscal — {n} recomendación{n !== 1 ? 'es' : ''} de facturación intercompany antes de fin de mes</b>}
      description={<span style={{ fontSize: 12 }}>{alerta.recomendaciones[0].descripcion}</span>}
      action={
        <Button size="small" type="primary" style={{ background: '#1B3A6B' }}
          onClick={() => navigate('/reportes/consolidacion')}>
          Ver Planificación Fiscal
        </Button>
      }
    />
  )
}
