/**
 * Editor visual de layout del cheque físico Guatemala.
 * Medidas de referencia: Instructivo JM-51-2003 (Junta Monetaria / Banguat).
 *
 * Tipos de cheque estándar:
 *   Personal  6 1/2" × 2 3/4" = 16.51 cm × 6.99 cm
 *   Comercial 7 1/2" × 2 3/4" = 19.05 cm × 6.99 cm
 *
 * Distribución de zonas (estándar Banguat — anverso):
 *   Zona 1: Banco Librado          (esquina sup. izq.)
 *   Zona 2: Nombre/No. Cuenta      (centro superior)
 *   Zona 3: No. Cheque             (esquina sup. der.)
 *   Zona 4: Lugar y Fecha          (debajo zona 1)
 *   Zona 5: Importe numérico       (a la derecha de zona 4)
 *   Zona 6: Pago a la Orden de     (beneficiario, ancho completo)
 *   Zona 7: Suma en letras         (ancho completo)
 *   Zona 8: Libre / Nombre cuenta  (inf. izq.)
 *   Zona 9: Firma(s)               (inf. der., sobre banda libre)
 *   Zona 10: Banda libre MICR      (5/8" desde abajo — sin campos)
 *
 * Funciona como controlado compatible con Ant Design Form.Item.
 */
import { useState, useEffect, useCallback } from 'react'
import { InputNumber, Switch, Button, Select, Space, Tag, Typography, Collapse, Tooltip } from 'antd'
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography
const { Option } = Select

// ── Constantes de conversión ─────────────────────────────────────────────────

const IN2CM  = 2.54          // pulgadas → cm
const SCALE  = 18            // px por cm en el preview
const cm2px  = (s: string)  => parseFloat(s ?? '0') * SCALE
const px2cm  = (n: number)  => `${n.toFixed(2)}cm`
const parseCm = (s?: string) => parseFloat(s ?? '0')

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface FieldPos {
  top:    string
  left:   string
  width?: string
  show?:  boolean
}

export interface CheckLayoutPositions {
  width?:        string
  height?:       string
  beneficiario?: FieldPos
  fecha?:        FieldPos
  monto?:        FieldPos
  letras?:       FieldPos
  firma?:        FieldPos
  noNegociable?: FieldPos
}

// ── Presets de tamaño (Instructivo JM-51-2003) ───────────────────────────────

/**
 * Cheque Personal: 6 1/2" × 2 3/4"
 * Distribución de alturas de filas (de arriba a abajo):
 *   Fila 1 (zonas 1-3): 7/8"  = 2.22cm  — encabezado banco / nombre / no. cheque
 *   Fila 2 (zonas 4-5): 2/8"  = 0.64cm  — fecha + importe numérico
 *   Fila 3 (zona 6):    2/8"  = 0.64cm  — beneficiario
 *   Fila 4 (zona 7):    2/8"  = 0.64cm  — monto en letras
 *   Fila 5 (zonas 8-9): 4/8"  = 1.27cm  — libre + firma(s)
 *   Banda libre:         5/8"  = 1.59cm  — solo caracteres MICR, sin texto
 */
const PERSONAL: CheckLayoutPositions = (() => {
  const w = 6.5  * IN2CM   // 16.51 cm
  const h = 2.75 * IN2CM   // 6.985 cm
  const r1h = (7/8) * IN2CM  // 2.22cm — fila 1
  const r2h = (2/8) * IN2CM  // 0.635cm
  const r3h = (2/8) * IN2CM
  const r4h = (2/8) * IN2CM
  const r5h = (4/8) * IN2CM  // 1.27cm

  const r2top = r1h
  const r3top = r1h + r2h
  const r4top = r1h + r2h + r3h
  const r5top = r1h + r2h + r3h + r4h

  // Zona 4 (fecha) ocupa 3" desde la izquierda
  // Zona 5 (importe) ocupa lo restante a la derecha
  const fechaW = 3 * IN2CM      // 7.62cm
  const montoX = fechaW + 0.1

  // Zona 9 (firma) empieza después de zona 8 (2.5" = 6.35cm)
  const firmaX = 2.5 * IN2CM

  return {
    width: `${w.toFixed(2)}cm`,
    height: `${h.toFixed(2)}cm`,
    beneficiario: { top: px2cm(r3top * SCALE), left: '0.40cm',  width: `${(w - 0.5).toFixed(2)}cm` },
    fecha:        { top: px2cm(r2top * SCALE), left: '0.40cm'   },
    monto:        { top: px2cm(r2top * SCALE), left: `${montoX.toFixed(2)}cm` },
    letras:       { top: px2cm(r4top * SCALE), left: '0.40cm',  width: `${(w - 0.5).toFixed(2)}cm` },
    firma:        { top: px2cm(r5top * SCALE), left: `${firmaX.toFixed(2)}cm`, width: `${(w - firmaX - 0.3).toFixed(2)}cm`, show: false },
    noNegociable: { top: '0.30cm',             left: `${(w / 2 - 1.5).toFixed(2)}cm`, show: false },
  }
})()

/**
 * Cheque Comercial/Voucher: 7 1/2" × 2 3/4"
 * Misma distribución de filas que el personal, sólo cambia el ancho.
 * Zona 8 (libre) = 3 1/2" = 8.89cm → zona 9 (firma) empieza ahí.
 */
const COMERCIAL: CheckLayoutPositions = (() => {
  const w = 7.5  * IN2CM   // 19.05 cm
  const h = 2.75 * IN2CM

  const r1h = (7/8) * IN2CM
  const r2h = (2/8) * IN2CM
  const r3h = (2/8) * IN2CM
  const r4h = (2/8) * IN2CM
  const r5h = (4/8) * IN2CM  // eslint-disable-line @typescript-eslint/no-unused-vars

  const r2top = r1h
  const r3top = r1h + r2h
  const r4top = r1h + r2h + r3h
  const r5top = r1h + r2h + r3h + r4h

  const fechaW  = 3   * IN2CM     // 7.62cm (misma que personal)
  const montoX  = fechaW + 0.1
  const firmaX  = 3.5 * IN2CM     // zona 8 = 3.5" = 8.89cm

  return {
    width: `${w.toFixed(2)}cm`,
    height: `${h.toFixed(2)}cm`,
    beneficiario: { top: px2cm(r3top * SCALE), left: '0.40cm',  width: `${(w - 0.5).toFixed(2)}cm` },
    fecha:        { top: px2cm(r2top * SCALE), left: '0.40cm'   },
    monto:        { top: px2cm(r2top * SCALE), left: `${montoX.toFixed(2)}cm` },
    letras:       { top: px2cm(r4top * SCALE), left: '0.40cm',  width: `${(w - 0.5).toFixed(2)}cm` },
    firma:        { top: px2cm(r5top * SCALE), left: `${firmaX.toFixed(2)}cm`, width: `${(w - firmaX - 0.3).toFixed(2)}cm`, show: false },
    noNegociable: { top: '0.30cm',             left: `${(w / 2 - 1.5).toFixed(2)}cm`, show: false },
  }
})()

/**
 * Formato Carta / Bancario (no estándar Banguat —
 * usado comúnmente por BI, G&T, Banrural en sus formatos digitales).
 */
const CARTA: CheckLayoutPositions = {
  width: '21.00cm', height: '9.00cm',
  beneficiario: { top: '1.80cm', left: '2.20cm',  width: '13.00cm' },
  fecha:        { top: '1.80cm', left: '16.50cm' },
  monto:        { top: '1.80cm', left: '18.00cm' },
  letras:       { top: '3.20cm', left: '1.00cm',  width: '17.50cm' },
  firma:        { top: '7.20cm', left: '2.00cm',  width: '8.00cm',  show: false },
  noNegociable: { top: '0.40cm', left: '8.00cm',  show: false },
}

// Mapa de presets para el selector
const PRESETS: Record<string, { label: string; desc: string; pos: CheckLayoutPositions }> = {
  personal:  {
    label: 'Cheque Personal (6½" × 2¾")',
    desc:  '16.51 × 6.99 cm — Estándar Banguat JM-51-2003',
    pos:   PERSONAL,
  },
  comercial: {
    label: 'Cheque Comercial/Voucher (7½" × 2¾")',
    desc:  '19.05 × 6.99 cm — Estándar Banguat JM-51-2003',
    pos:   COMERCIAL,
  },
  carta: {
    label: 'Formato Carta / Bancario Digital',
    desc:  '21 × 9 cm — Usado por BI, G&T, Banrural',
    pos:   CARTA,
  },
  custom: {
    label: 'Personalizado',
    desc:  'Ancho y alto libres',
    pos:   CARTA,
  },
}

// Presets derivados del "formato banco" elegido en el formulario padre
const BASE_BY_FORMAT: Record<string, CheckLayoutPositions> = {
  generic:  CARTA,
  bi:       { ...CARTA },
  bac:      { ...CARTA, width: '21.00cm', height: '9.50cm' },
  gt:       { ...CARTA },
  banrural: { ...CARTA },
}

// ── Configuración de campos visuales ─────────────────────────────────────────

const FIELD_CONFIG = [
  { key: 'beneficiario', label: 'BENEFICIARIO',   color: '#1677ff', hasWidth: true              },
  { key: 'fecha',        label: 'FECHA',           color: '#52c41a', hasWidth: false             },
  { key: 'monto',        label: 'Q MONTO',         color: '#fa8c16', hasWidth: false             },
  { key: 'letras',       label: 'MONTO EN LETRAS', color: '#722ed1', hasWidth: true              },
  { key: 'firma',        label: 'FIRMA',           color: '#8c8c8c', hasWidth: true,  optional: true },
  { key: 'noNegociable', label: 'NO NEGOCIABLE',   color: '#f5222d', hasWidth: false, optional: true },
] as const

type FieldKey = typeof FIELD_CONFIG[number]['key']

function deepMerge(base: CheckLayoutPositions, over: CheckLayoutPositions | null | undefined): CheckLayoutPositions {
  if (!over) return { ...base }
  const r: any = { ...base }
  for (const k of Object.keys(over) as (keyof CheckLayoutPositions)[]) {
    if (over[k] != null) {
      r[k] = typeof over[k] === 'object'
        ? { ...(base as any)[k], ...(over[k] as any) }
        : over[k]
    }
  }
  return r
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  value?:      CheckLayoutPositions | null
  onChange?:   (v: CheckLayoutPositions) => void
  baseFormat?: string
}

export default function CheckLayoutEditor({ value, onChange, baseFormat = 'generic' }: Props) {
  const defaultBase = BASE_BY_FORMAT[baseFormat] ?? CARTA
  const [pos,    setPos]    = useState<CheckLayoutPositions>(() => deepMerge(defaultBase, value))
  const [preset, setPreset] = useState<string>('custom')

  useEffect(() => {
    setPos(deepMerge(BASE_BY_FORMAT[baseFormat] ?? CARTA, value))
  }, [baseFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  const push = useCallback((next: CheckLayoutPositions) => {
    setPos(next)
    onChange?.(next)
  }, [onChange])

  const updateField = useCallback((field: FieldKey, patch: Partial<FieldPos>) => {
    setPos(prev => {
      const next = { ...prev, [field]: { ...(prev as any)[field], ...patch } }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const applyPreset = (key: string) => {
    setPreset(key)
    if (key !== 'custom') {
      push({ ...PRESETS[key].pos })
    }
  }

  const resetToBase = () => {
    const fresh = deepMerge(BASE_BY_FORMAT[baseFormat] ?? CARTA, null)
    push(fresh)
    setPreset('custom')
  }

  const checkW = parseCm(pos.width  ?? '21cm')
  const checkH = parseCm(pos.height ?? '9cm')
  const bandaH = (5/8) * IN2CM  // 1.59cm — banda libre MICR (siempre)

  const previewW = checkW * SCALE
  const previewH = checkH * SCALE
  const bandaPx  = bandaH * SCALE

  // ── Sub-componente: caja en el preview ───────────────────────────────────

  const PreviewBox = ({ fkey, label, color }: { fkey: FieldKey; label: string; color: string }) => {
    const f = (pos as any)[fkey] as FieldPos | undefined
    if (!f || f.show === false) return null
    const top  = cm2px(f.top)
    const left = cm2px(f.left)
    const w    = f.width ? cm2px(f.width) : Math.max(label.length * 5.5, 30)
    return (
      <div style={{
        position: 'absolute', top, left, width: w, height: 13,
        background: `${color}25`, border: `1.5px solid ${color}`, borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', fontSize: 7, color, fontWeight: 700,
        fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    )
  }

  // ── Sub-componente: fila de inputs por campo ──────────────────────────────

  const FieldRow = ({
    fkey, label, color, hasWidth, optional,
  }: { fkey: FieldKey; label: string; color: string; hasWidth: boolean; optional?: boolean }) => {
    const f = ((pos as any)[fkey] ?? {}) as FieldPos
    const disabled = optional && f.show === false
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Tag color={color} style={{ margin: 0, fontSize: 11 }}>{label}</Tag>
          {optional && (
            <Switch
              size="small"
              checked={f.show !== false}
              onChange={v => updateField(fkey, { show: v })}
              checkedChildren="Visible" unCheckedChildren="Oculto"
            />
          )}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasWidth ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: 8,
        }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>↕ Desde arriba (cm)</Text>
            <InputNumber
              size="small" style={{ width: '100%' }} min={0} max={checkH - bandaH}
              step={0.05} precision={2}
              value={parseCm(f.top)}
              onChange={v => updateField(fkey, { top: px2cm((v ?? 0) as number) })}
              disabled={disabled}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>← Desde izquierda (cm)</Text>
            <InputNumber
              size="small" style={{ width: '100%' }} min={0} max={checkW}
              step={0.05} precision={2}
              value={parseCm(f.left)}
              onChange={v => updateField(fkey, { left: px2cm((v ?? 0) as number) })}
              disabled={disabled}
            />
          </div>
          {hasWidth && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>↔ Ancho (cm)</Text>
              <InputNumber
                size="small" style={{ width: '100%' }} min={1} max={checkW}
                step={0.1} precision={2}
                value={parseCm(f.width ?? '10')}
                onChange={v => updateField(fkey, { width: px2cm((v ?? 10) as number) })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Collapse
      size="small"
      items={[{
        key: '1',
        label: (
          <Space>
            <span style={{ fontWeight: 600 }}>Personalizar layout del cheque</span>
            <Tooltip title="Configura la posición de cada campo sobre el cheque preimpreso físico. Medidas en centímetros desde la esquina superior izquierda.">
              <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
            </Tooltip>
          </Space>
        ),
        children: (
          <div>
            {/* Selector de tamaño preestablecido */}
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Tamaño preestablecido (Instructivo JM-51-2003 Banguat)
              </Text>
              <Select
                style={{ width: '100%' }}
                size="small"
                value={preset}
                onChange={applyPreset}
              >
                {Object.entries(PRESETS).map(([k, p]) => (
                  <Option key={k} value={k}>
                    <div style={{ lineHeight: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: '#8c8c8c' }}>{p.desc}</div>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>

            {/* Tamaño manual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Ancho del cheque (cm)</Text>
                <InputNumber
                  size="small" style={{ width: '100%' }} min={10} max={30} step={0.1} precision={2}
                  value={checkW}
                  onChange={v => { push({ ...pos, width: px2cm((v ?? 21) as number) }); setPreset('custom') }}
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Alto del cheque (cm)</Text>
                <InputNumber
                  size="small" style={{ width: '100%' }} min={5} max={20} step={0.1} precision={2}
                  value={checkH}
                  onChange={v => { push({ ...pos, height: px2cm((v ?? 7) as number) }); setPreset('custom') }}
                />
              </div>
              <Button size="small" icon={<ReloadOutlined />} onClick={resetToBase}>
                Restaurar base
              </Button>
            </div>

            {/* Preview del cheque a escala */}
            <div style={{ marginBottom: 14, overflowX: 'auto' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Preview — {checkW.toFixed(1)}cm × {checkH.toFixed(1)}cm
                {' '}(escala ×{SCALE}px/cm)
                <span style={{ color: '#fa8c16', marginLeft: 8 }}>
                  La franja naranja inferior es la banda libre MICR — no colocar campos ahí.
                </span>
              </Text>
              <div style={{
                position: 'relative',
                width: previewW, height: previewH,
                background: '#fffef5',
                border: '2px solid #bbb',
                borderRadius: 3,
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {/* Banda libre MICR */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: bandaPx, background: '#fa8c1618',
                  borderTop: '1.5px dashed #fa8c16',
                  display: 'flex', alignItems: 'center', paddingLeft: 4,
                }}>
                  <span style={{ fontSize: 7, color: '#fa8c16', fontWeight: 700 }}>
                    BANDA LIBRE MICR (5/8")
                  </span>
                </div>
                {/* Campos */}
                {FIELD_CONFIG.map(f => (
                  <PreviewBox key={f.key} fkey={f.key} label={f.label} color={f.color} />
                ))}
              </div>
            </div>

            {/* Inputs de posición por campo */}
            {FIELD_CONFIG.map(f => (
              <FieldRow
                key={f.key}
                fkey={f.key}
                label={f.label}
                color={f.color}
                hasWidth={f.hasWidth}
                optional={'optional' in f ? f.optional : false}
              />
            ))}

            <Text type="secondary" style={{ fontSize: 10 }}>
              Referencia: Resolución JM-51-2003 — Instructivo para la Estandarización de Cheques en el Sistema Bancario Nacional (Banguat).
              La banda libre MICR (5/8" = 1.59cm desde abajo) nunca debe contener texto impreso.
            </Text>
          </div>
        ),
      }]}
    />
  )
}
