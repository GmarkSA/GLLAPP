import { useState, useEffect } from 'react'
import { Spin } from 'antd'
import { getEmpresaInfo, type EmpresaInfo } from '../../api/reportes'
import Declaracion2237 from './Declaracion2237'
import Declaracion2046 from './Declaracion2046'

export default function DeclaracionIvaPage() {
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    getEmpresaInfo()
      .then(e => { setEmpresa(e); setReady(true) })
      .catch(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (empresa?.fiscal_regime_code === 'gt_pequeno_contribuyente') {
    return <Declaracion2046 />
  }

  return <Declaracion2237 />
}
