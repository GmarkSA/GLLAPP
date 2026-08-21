import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import { AccountBookOutlined, CheckCircleOutlined, SaveOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons'
import {
  getCuentasPlanilla, guardarCuentasPlanilla, validarCuentasPlanilla,
  type ConceptoCuentaPlanilla,
} from '../../../api/planillas'
import { getAccounts, type Account } from '../../../api/catalogo'

const { Text, Title } = Typography
const NAVY = '#1faec2'

/** Palabras clave para el botón "usar catálogo sugerido" */
const KEYWORDS: Record<string, string[]> = {
  cuentaGastoSueldos:                 ['sueldos', 'salarios'],
  cuentaGastoBonificacionIncentivo:   ['bonificacion incentivo', 'bonificación incentivo', 'bonificacion'],
  cuentaGastoHorasExtra:              ['horas extra', 'extraordinari'],
  cuentaGastoProvisionAguinaldo:      ['aguinaldo'],
  cuentaGastoProvisionBono14:         ['bono 14', 'bono14', 'bono catorce'],
  cuentaGastoProvisionVacaciones:     ['vacacion'],
  cuentaGastoProvisionIndemnizacion:  ['indemnizacion', 'indemnización'],
  cuentaGastoCuotaPatronalIGSS:       ['cuota patronal', 'igss'],
  cuentaPasivoSueldosPorPagar:        ['sueldos por pagar', 'salarios por pagar', 'sueldos'],
  cuentaPasivoIGSSPorPagar:           ['igss por pagar', 'igss'],
  cuentaPasivoISRPorPagar:            ['isr', 'retencion', 'retención'],
  cuentaPasivoAguinaldoPorPagar:      ['aguinaldo'],
  cuentaPasivoBono14PorPagar:         ['bono 14', 'bono14', 'bono catorce'],
  cuentaPasivoVacacionesPorPagar:     ['vacacion'],
  cuentaPasivoIndemnizacionPorPagar:  ['indemnizacion', 'indemnización'],
  cuentaOtrasDeduccionesPorPagar:     ['otras deducciones', 'deducciones'],
}

const NATURALEZA_BALANCE_TYPES: Record<'gasto' | 'pasivo', string[]> = {
  gasto:  ['Gastos', 'Costos', 'Otros Gastos'],
  pasivo: ['Pasivo'],
}

export default function CuentasPlanillaPage() {
  const [conceptos, setConceptos] = useState<ConceptoCuentaPlanilla[]>([])
  const [valores, setValores] = useState<Record<string, string | null>>({})
  const [cuentas, setCuentas] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validacion, setValidacion] = useState<{ completo: boolean; faltantes: Array<{ campo: string; etiqueta: string }> } | null>(null)

  const cargar = () => {
    setLoading(true)
    Promise.all([getCuentasPlanilla(), getAccounts({ limit: 1000 }), validarCuentasPlanilla()])
      .then(([data, accs, val]) => {
        setConceptos(data.conceptos)
        setValores(data.configuracion ?? {})
        const lista = Array.isArray(accs) ? accs : (accs as any)?.data ?? []
        setCuentas(lista.filter((a: Account) => (a as any).isActive !== false && !(a as any).isHeader))
        setValidacion(val)
      })
      .catch(() => message.error('Error cargando configuración de cuentas'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const opcionesPorNaturaleza = useMemo(() => {
    const build = (naturaleza: 'gasto' | 'pasivo') => {
      const tipos = NATURALEZA_BALANCE_TYPES[naturaleza]
      return cuentas
        .filter(a => tipos.includes((a as any).balanceType ?? ''))
        .sort((a, b) => String((a as any).code).localeCompare(String((b as any).code)))
        .map(a => ({
          value: a.id,
          label: `${(a as any).code} · ${(a as any).name}`,
        }))
    }
    return { gasto: build('gasto'), pasivo: build('pasivo') }
  }, [cuentas])

  const sugerir = () => {
    const nuevos = { ...valores }
    let asignadas = 0
    for (const c of conceptos) {
      if (nuevos[c.campo]) continue
      const tipos = NATURALEZA_BALANCE_TYPES[c.naturaleza]
      const candidatas = cuentas.filter(a => tipos.includes((a as any).balanceType ?? ''))
      const kws = KEYWORDS[c.campo] ?? []
      const hit = kws
        .map(kw => candidatas.find(a => String((a as any).name).toLowerCase().includes(kw)))
        .find(Boolean)
      if (hit) { nuevos[c.campo] = hit.id; asignadas++ }
    }
    setValores(nuevos)
    message.info(asignadas > 0
      ? `${asignadas} cuentas sugeridas por nombre — revisa antes de guardar`
      : 'No se encontraron cuentas con nombres similares en el catálogo')
  }

  const guardar = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {}
      conceptos.forEach(c => { payload[c.campo] = valores[c.campo] ?? null })
      await guardarCuentasPlanilla(payload)
      const val = await validarCuentasPlanilla()
      setValidacion(val)
      message.success('Mapeo de cuentas guardado')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const renderGrupo = (naturaleza: 'gasto' | 'pasivo', titulo: string) => (
    <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}
      title={<Text strong>{titulo}</Text>}>
      <Table
        scroll={{ y: 'calc(100vh - 330px)' }}
        size="small" rowKey="campo" pagination={false} showHeader={false}
        dataSource={conceptos.filter(c => c.naturaleza === naturaleza)}
        columns={[
          {
            key: 'etiqueta', width: 250,
            render: (_, c: ConceptoCuentaPlanilla) => (
              <Space size={6}>
                <Text style={{ fontSize: 12 }}>{c.etiqueta.replace(/^(Gasto|Pasivo) — /, '')}</Text>
                {c.obligatoria && <Tag color="#1faec2" style={{ fontSize: 10, margin: 0 }}>obligatoria</Tag>}
              </Space>
            ),
          },
          {
            key: 'cuenta',
            render: (_, c: ConceptoCuentaPlanilla) => (
              <Select
                style={{ width: '100%' }} size="small" allowClear showSearch
                placeholder="Seleccionar cuenta contable"
                optionFilterProp="label"
                value={valores[c.campo] ?? undefined}
                onChange={v => setValores(prev => ({ ...prev, [c.campo]: v ?? null }))}
                options={opcionesPorNaturaleza[naturaleza]}
                status={c.obligatoria && !valores[c.campo] ? 'warning' : undefined}
              />
            ),
          },
        ]}
      />
    </Card>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AccountBookOutlined style={{ fontSize: 22, color: '#1faec2' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>Cuentas contables de planilla</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Mapeo de cada concepto de nómina a su cuenta del catálogo — requisito para contabilizar planillas
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={sugerir}>Usar catálogo sugerido</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={guardar} style={{ background: NAVY }}>
            Guardar
          </Button>
        </Space>
      </div>

      {validacion && (
        validacion.completo ? (
          <Alert type="success" showIcon icon={<CheckCircleOutlined />} style={{ marginBottom: 16 }}
            message="Mapeo completo — las planillas podrán contabilizarse." />
        ) : (
          <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }}
            message={`Faltan ${validacion.faltantes.length} cuentas obligatorias por mapear`}
            description={
              <span style={{ fontSize: 12 }}>
                {validacion.faltantes.map(f => f.etiqueta).join(' · ')}
                <br />No se podrá aprobar la primera planilla hasta completar este mapeo.
              </span>
            } />
        )
      )}

      <Spin spinning={loading}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(560px, 1fr))', gap: 16 }}>
          {renderGrupo('gasto', 'Cuentas de gasto (Debe — dimensionadas por centro)')}
          {renderGrupo('pasivo', 'Cuentas de pasivo (Haber — agrupadas por período)')}
        </div>
      </Spin>
    </div>
  )
}
