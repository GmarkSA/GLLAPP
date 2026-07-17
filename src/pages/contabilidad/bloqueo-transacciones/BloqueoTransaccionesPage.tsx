import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Button, message, Typography, Alert, Tooltip, Tag,
} from 'antd'
import {
  LockOutlined, UnlockOutlined, WarningOutlined,
  LeftOutlined, RightOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  getBloqueos, getBloqueoVigente, bloquearMasivo, desbloquear,
  type BloqueoContable, type ModuloBloqueable,
} from '../../../api/bloqueo-contable'

dayjs.locale('es')

const { Title, Text } = Typography

// ─── Constantes ──────────────────────────────────────────────────────────────

const MODULOS: { label: string; value: ModuloBloqueable; color: string }[] = [
  { label: 'Todos los módulos', value: 'TODOS',         color: '#e5484d'     },
  { label: 'Ventas',            value: 'VENTAS',         color: '#1faec2'    },
  { label: 'Compras',           value: 'COMPRAS',        color: '#ff7f00'  },
  { label: 'Bancos',            value: 'BANCOS',         color: 'cyan'    },
  { label: 'Contabilidad',      value: 'CONTABILIDAD',   color: '#6b7280'  },
  { label: 'Inventario',        value: 'INVENTARIO',     color: '#2ea172'   },
  { label: 'Proyectos',         value: 'PROYECTOS',      color: 'lime'    },
  { label: 'Reportes',          value: 'REPORTES',       color: 'gold'    },
  { label: 'Automatización',    value: 'AUTOMATIZACION', color: 'volcano' },
  { label: 'Configuración',     value: 'CONFIGURACION',  color: 'default' },
]

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ─── Estilos de celda ─────────────────────────────────────────────────────────

const cellBase: React.CSSProperties = {
  width: 42, minWidth: 42, textAlign: 'center',
  padding: '6px 4px', borderBottom: '1px solid rgba(10,10,10,0.08)',
  cursor: 'pointer', userSelect: 'none',
}

// ─── Indicador visual de bloqueo ─────────────────────────────────────────────

function CeldaBloqueo({
  bloqueo, inherited, loading, onClick,
}: {
  bloqueo: BloqueoContable | null
  inherited: boolean   // bloqueado por TODOS, no directamente
  loading: boolean
  onClick: () => void
}) {
  const isBlocked = !!bloqueo && bloqueo.estado !== 'DESBLOQUEADO'

  let bg        = 'transparent'
  let border    = '1px solid rgba(10,10,10,0.08)'
  let iconColor = 'rgba(10,10,10,0.08)'

  if (isBlocked && inherited) { bg = '#fff1f0'; border = '1px solid #f8c9cb'; iconColor = '#e5484d' }
  else if (isBlocked)         { bg = '#1faec2'; border = '1px solid #1faec2'; iconColor = '#fff' }

  const box = (
    <div
      onClick={inherited ? undefined : onClick}
      style={{
        width: 22, height: 22, borderRadius: 4,
        border, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto',
        cursor: loading ? 'wait' : inherited ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {isBlocked && <LockOutlined style={{ fontSize: 11, color: iconColor }} />}
    </div>
  )

  if (inherited) {
    return (
      <Tooltip title={`Bloqueado por "Todos los módulos" — ${bloqueo?.motivo ?? ''}`}>
        {box}
      </Tooltip>
    )
  }
  if (isBlocked) {
    return (
      <Tooltip title={`Bloqueado: ${bloqueo?.motivo ?? ''}`}>
        {box}
      </Tooltip>
    )
  }
  return box
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function BloqueoTransaccionesPage() {
  const [bloqueos,  setBloqueos]  = useState<BloqueoContable[]>([])
  const [vigente,   setVigente]   = useState<BloqueoContable | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [year,      setYear]      = useState(dayjs().year())
  const [savingCell, setSavingCell] = useState<string | null>(null)

  // ── Carga ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, vig] = await Promise.all([getBloqueos(), getBloqueoVigente()])
      setBloqueos(Array.isArray(rows) ? rows : [])
      setVigente(vig)
    } catch { setBloqueos([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Mapa bloqueo por (módulo, YYYY-MM) ───────────────────────────────────
  // Clave: "MODULO-YYYY-MM" → BloqueoContable
  const blockedMap = useMemo(() => {
    const map = new Map<string, BloqueoContable>()
    bloqueos.forEach(b => {
      if (b.estado === 'DESBLOQUEADO') return
      if (b.periodoInicio && b.periodoFin) {
        let cur = dayjs(b.periodoInicio + 'T00:00:00').startOf('month')
        const end = dayjs(b.periodoFin + 'T00:00:00').startOf('month')
        while (!cur.isAfter(end)) {
          map.set(`${b.modulo}-${cur.format('YYYY-MM')}`, b)
          cur = cur.add(1, 'month')
        }
      } else if (b.periodoFin) {
        // legacy: single month
        const fin = dayjs(b.periodoFin + 'T00:00:00')
        map.set(`${b.modulo}-${fin.format('YYYY-MM')}`, b)
      }
    })
    return map
  }, [bloqueos])

  // Obtiene el bloqueo efectivo para una celda (propio o heredado de TODOS)
  const getCellInfo = (modulo: string, mesKey: string): { bloqueo: BloqueoContable | null; inherited: boolean } => {
    const direct = blockedMap.get(`${modulo}-${mesKey}`) ?? null
    if (direct) return { bloqueo: direct, inherited: false }
    if (modulo !== 'TODOS') {
      const todos = blockedMap.get(`TODOS-${mesKey}`) ?? null
      if (todos) return { bloqueo: todos, inherited: true }
    }
    return { bloqueo: null, inherited: false }
  }

  // ── Acción directa al hacer clic en celda ────────────────────────────────
  const handleCellClick = async (
    mode: 'bloquear' | 'desbloquear',
    modulo: string,
    mesKey: string,
    bloqueoId?: string,
  ) => {
    const motivoFinal = 'Cierre de período'
    const key = `${modulo}-${mesKey}`
    setSavingCell(key)
    try {
      if (mode === 'bloquear') {
        await bloquearMasivo({ modulos: [modulo], meses: [mesKey], motivo: motivoFinal })
        message.success('Período bloqueado')
      } else {
        await desbloquear(bloqueoId!, motivoFinal)
        message.success('Período desbloqueado')
      }
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error')
    } finally { setSavingCell(null) }
  }

  // ── Meses del año actual ──────────────────────────────────────────────────
  const mesKeys = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
    [year],
  )
  const curMes = dayjs().format('YYYY-MM')

  // ── Render ────────────────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: '8px 4px',
    fontSize: 11, fontWeight: 700,
    color: '#6b7280',
    borderBottom: '2px solid rgba(10,10,10,0.08)',
    textAlign: 'center',
    minWidth: 42,
    userSelect: 'none',
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Cabecera */}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#0a0a0a' }}>
          <LockOutlined style={{ marginRight: 8 }} />
          Bloqueo de Transacciones
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Selecciona un mes para bloquearlo o desbloquearlo por módulo
        </Text>
      </div>

      {/* Banner vigente */}
      {vigente?.periodoFin && vigente?.motivo && (
        <Alert
          type="warning" showIcon icon={<WarningOutlined />}
          message={
            <span>
              <strong>Período bloqueado</strong>
              {` hasta ${dayjs(vigente.periodoFin + 'T00:00:00').format('DD MMMM YYYY')} — `}
              <Tag color="#e5484d">{vigente.modulo}</Tag>
            </span>
          }
          description={`Motivo: ${vigente.motivo}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Barra de controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Año */}
        <Button size="small" icon={<LeftOutlined />} onClick={() => setYear(y => y - 1)} />
        <Text strong style={{ fontSize: 15, minWidth: 44, textAlign: 'center' }}>{year}</Text>
        <Button size="small" icon={<RightOutlined />} onClick={() => setYear(y => y + 1)} />

        {loading && <Text type="secondary" style={{ fontSize: 12 }}>Cargando...</Text>}
      </div>

      {/* Tabla matriz */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {mesKeys.map(k => <col key={k} />)}
          </colgroup>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 12 }}>Módulo</th>
              {mesKeys.map((k, i) => {
                const isCurrent = k === curMes
                return (
                  <th key={k} style={{
                    ...thStyle,
                    color: isCurrent ? '#1faec2' : '#6b7280',
                    background: isCurrent ? '#e6f0ff' : 'transparent',
                    borderRadius: isCurrent ? '4px 4px 0 0' : 0,
                  }}>
                    {MESES_ES[i]}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((mod, rowIdx) => (
              <tr
                key={mod.value}
                style={{ background: rowIdx === 0 ? '#fff8f8' : rowIdx % 2 === 0 ? '#fafbfc' : '#fff' }}
              >
                {/* Columna módulo */}
                <td style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(10,10,10,0.08)',
                  borderRight: '1px solid rgba(10,10,10,0.08)',
                }}>
                  <Tag color={mod.color} style={{ margin: 0, fontSize: 11 }}>{mod.label}</Tag>
                </td>

                {/* Columna por mes */}
                {mesKeys.map(mesKey => {
                  const { bloqueo, inherited } = getCellInfo(mod.value, mesKey)
                  const cellKey = `${mod.value}-${mesKey}`
                  const isCurrent = mesKey === curMes
                  const isBlocked = !!bloqueo && bloqueo.estado !== 'DESBLOQUEADO'

                  return (
                    <td key={mesKey} style={{
                      ...cellBase,
                      background: isCurrent ? '#fafbfc' : undefined,
                    }}>
                      <CeldaBloqueo
                        bloqueo={bloqueo}
                        inherited={inherited}
                        loading={savingCell === cellKey}
                        onClick={() => {
                          if (isBlocked && !inherited) {
                            handleCellClick('desbloquear', mod.value, mesKey, bloqueo!.id)
                          } else if (!isBlocked) {
                            handleCellClick('bloquear', mod.value, mesKey)
                          }
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {[
          { icon: <LockOutlined style={{ color: '#fff', fontSize: 11 }} />, bg: '#1faec2', label: 'Bloqueado' },
          { icon: null, bg: '#fff1f0', border: '#f8c9cb', label: 'Heredado (Todos los módulos)' },
          { icon: null, bg: 'transparent', border: 'rgba(10,10,10,0.08)', label: 'Abierto' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 3,
              background: l.bg, border: `1px solid ${l.border ?? l.bg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {l.icon}
            </div>
            <Text style={{ fontSize: 11 }} type="secondary">{l.label}</Text>
          </div>
        ))}
      </div>

    </div>
  )
}
