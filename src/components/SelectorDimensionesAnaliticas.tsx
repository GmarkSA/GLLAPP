/**
 * SelectorDimensionesAnaliticas
 *
 * Componente reutilizable para asignar Centro de Costo y Centro de Beneficio
 * en cualquier formulario o tabla del ERP.
 *
 * Modos:
 *   layout="form"    — dos Form.Items con labels, grid 2 columnas (para cabeceras de documentos)
 *   layout="compact" — dos selects sin labels en una fila (para celdas de tabla)
 *
 * Caché a nivel de módulo: todas las instancias comparten las opciones cargadas.
 * Se invalida automáticamente al cambiar de companyId.
 */
import { useEffect, useState } from 'react'
import { Select, Form, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { getCentrosCosto, type CentroCosto } from '../api/centros-costo'
import { getCentrosBeneficio, type CentroBeneficio } from '../api/centros-beneficio'
import { useCompanyStore } from '../store/companyStore'

// ── Caché módulo-nivel ──────────────────────────────────────────────────────
let _cacheCompanyId: string | null = null
let _cacheCC: CentroCosto[]       = []
let _cacheCB: CentroBeneficio[]   = []
let _loadingPromise: Promise<void> | null = null

async function cargarOpciones(companyId: string): Promise<void> {
  if (_cacheCompanyId === companyId && (_cacheCC.length > 0 || _cacheCB.length > 0)) return
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = Promise.allSettled([getCentrosCosto(), getCentrosBeneficio()])
    .then(([cc, cb]) => {
      _cacheCompanyId = companyId
      _cacheCC = cc.status === 'fulfilled' ? (cc.value as CentroCosto[]).filter(c => c.activo) : []
      _cacheCB = cb.status === 'fulfilled' ? (cb.value as CentroBeneficio[]).filter(c => c.activo) : []
    })
    .finally(() => { _loadingPromise = null })

  return _loadingPromise
}

// ── Tipos públicos ──────────────────────────────────────────────────────────
export interface DimensionesValue {
  centroCostoId?:    string | null
  centroBeneficioId?: string | null
}

export interface SelectorDimensionesAnaliticasProps {
  value?:    DimensionesValue
  onChange?: (v: DimensionesValue) => void
  /** Opciones pre-cargadas por el padre (evita re-fetch en tablas con muchas filas) */
  centrosCosto?:    CentroCosto[]
  centrosBeneficio?: CentroBeneficio[]
  disabled?:              boolean
  requiredCentroCosto?:   boolean
  requiredCentroBeneficio?: boolean
  /** Ocultar Centro de Costo (ej: módulo Ventas — solo aplica Centro de Beneficio) */
  showCentroCosto?: boolean
  /** "form": labels + grid 2 cols. "compact": sin labels, una fila */
  layout?: 'form' | 'compact'
  size?: 'small' | 'middle'
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function SelectorDimensionesAnaliticas({
  value,
  onChange,
  centrosCosto: ccProp,
  centrosBeneficio: cbProp,
  disabled = false,
  requiredCentroCosto   = false,
  requiredCentroBeneficio = false,
  showCentroCosto = true,
  layout = 'form',
  size   = 'middle',
}: SelectorDimensionesAnaliticasProps) {
  const { activeCompany } = useCompanyStore()
  const [cc,      setCC]      = useState<CentroCosto[]>(ccProp ?? _cacheCC)
  const [cb,      setCB]      = useState<CentroBeneficio[]>(cbProp ?? _cacheCB)
  const [loading, setLoading] = useState(false)

  // Si el padre ya pasó las opciones, usarlas directamente
  useEffect(() => { if (ccProp) setCC(ccProp) }, [ccProp])
  useEffect(() => { if (cbProp) setCB(cbProp) }, [cbProp])

  // Auto-cargar si no vienen del padre
  useEffect(() => {
    if (ccProp && cbProp) return
    if (!activeCompany?.id) return
    // Si el caché ya tiene datos para esta empresa, aplicar sin esperar
    if (_cacheCompanyId === activeCompany.id && (_cacheCC.length > 0 || _cacheCB.length > 0)) {
      if (!ccProp) setCC(_cacheCC)
      if (!cbProp) setCB(_cacheCB)
      return
    }
    setLoading(true)
    cargarOpciones(activeCompany.id).then(() => {
      if (!ccProp) setCC([..._cacheCC])
      if (!cbProp) setCB([..._cacheCB])
    }).finally(() => setLoading(false))
  }, [activeCompany?.id, ccProp, cbProp])

  const ccVal = value?.centroCostoId    ?? undefined
  const cbVal = value?.centroBeneficioId ?? undefined

  const handleCC = (v: string | undefined) =>
    onChange?.({ ...value, centroCostoId: v ?? null })
  const handleCB = (v: string | undefined) =>
    onChange?.({ ...value, centroBeneficioId: v ?? null })

  const selectCC = (
    <Select
      size={size}
      showSearch
      allowClear
      loading={loading}
      disabled={disabled}
      value={ccVal}
      onChange={handleCC}
      placeholder="Centro de Costo"
      optionFilterProp="label"
      style={{ width: '100%' }}
      options={cc.map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
    />
  )

  const selectCB = (
    <Select
      size={size}
      showSearch
      allowClear
      loading={loading}
      disabled={disabled}
      value={cbVal}
      onChange={handleCB}
      placeholder="Centro de Beneficio"
      optionFilterProp="label"
      style={{ width: '100%' }}
      options={cb.map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id }))}
    />
  )

  // ── Modo compacto (tabla) ─────────────────────────────────────────────────
  if (layout === 'compact') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: showCentroCosto ? '1fr 1fr' : '1fr', gap: 4 }}>
        {selectCB}
        {showCentroCosto && selectCC}
      </div>
    )
  }

  // ── Modo formulario (cabecera de documento) ───────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showCentroCosto ? '1fr 1fr' : '1fr', gap: 12 }}>
      <Form.Item
        label={
          <span>
            Centro de Beneficio
            <Tooltip title="Línea de negocio a la que pertenece esta transacción. Permite generar Estado de Resultados y Balance General segmentados.">
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#6b7280' }} />
            </Tooltip>
          </span>
        }
        required={requiredCentroBeneficio}
        style={{ marginBottom: 0 }}
      >
        {selectCB}
      </Form.Item>
      {showCentroCosto && (
        <Form.Item
          label={
            <span>
              Centro de Costo
              <Tooltip title="Área de responsabilidad para el análisis de gastos y costos. Solo aplica a cuentas de tipo Costo o Gasto.">
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#6b7280' }} />
              </Tooltip>
            </span>
          }
          required={requiredCentroCosto}
          style={{ marginBottom: 0 }}
        >
          {selectCC}
        </Form.Item>
      )}
    </div>
  )
}

// ── Hook auxiliar para pre-cargar opciones en páginas con tabla ─────────────
/**
 * Llama esto en el useEffect del padre para pre-cargar las opciones una sola vez.
 * Luego pasa centrosCosto y centrosBeneficio como props al componente en cada fila.
 *
 * @example
 * const [cc, cb] = useCentrosOptions()
 * <SelectorDimensionesAnaliticas centrosCosto={cc} centrosBeneficio={cb} ... />
 */
export function useCentrosOptions(): [CentroCosto[], CentroBeneficio[]] {
  const { activeCompany } = useCompanyStore()
  const [cc, setCC] = useState<CentroCosto[]>(_cacheCC)
  const [cb, setCB] = useState<CentroBeneficio[]>(_cacheCB)

  useEffect(() => {
    if (!activeCompany?.id) return
    if (_cacheCompanyId === activeCompany.id && (_cacheCC.length > 0 || _cacheCB.length > 0)) {
      setCC([..._cacheCC])
      setCB([..._cacheCB])
      return
    }
    cargarOpciones(activeCompany.id).then(() => {
      setCC([..._cacheCC])
      setCB([..._cacheCB])
    })
  }, [activeCompany?.id])

  return [cc, cb]
}
