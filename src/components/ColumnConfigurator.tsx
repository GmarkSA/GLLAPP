/**
 * ColumnConfigurator — selector de columnas reutilizable.
 * Cada página define sus propias columnas y clave de localStorage.
 */
import { Button, Checkbox, Divider, Space, Tooltip, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface ColConfig {
  key:       string
  visible:   boolean
  sortOrder: number
}

export interface ColMeta {
  key:          string
  label:        string
  description?: string
}

// ── Helpers de localStorage ───────────────────────────────────────────────────

export function loadColConfig(
  storageKey:    string,
  allColMeta:    ColMeta[],
  defaultConfig: ColConfig[],
): ColConfig[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return defaultConfig
    const parsed: ColConfig[] = JSON.parse(stored)
    // Agrega columnas nuevas que no estén en el config guardado
    const storedKeys = new Set(parsed.map(c => c.key))
    const merged = [...parsed]
    allColMeta.forEach((m, i) => {
      if (!storedKeys.has(m.key))
        merged.push({ key: m.key, visible: false, sortOrder: parsed.length + i + 1 })
    })
    return merged
  } catch {
    return defaultConfig
  }
}

export function saveColConfig(storageKey: string, cfg: ColConfig[]) {
  localStorage.setItem(storageKey, JSON.stringify(cfg))
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  config:        ColConfig[]
  allColMeta:    ColMeta[]
  defaultConfig: ColConfig[]
  storageKey:    string
  onChange:      (cfg: ColConfig[]) => void
}

export default function ColumnConfigurator({
  config, allColMeta, defaultConfig, storageKey, onChange,
}: Props) {
  const sorted = [...config].sort((a, b) => a.sortOrder - b.sortOrder)

  const apply = (next: ColConfig[]) => {
    onChange(next)
    saveColConfig(storageKey, next)
  }

  const toggle = (key: string) =>
    apply(config.map(c => c.key === key ? { ...c, visible: !c.visible } : c))

  const move = (key: string, dir: -1 | 1) => {
    const arr = [...sorted]
    const idx = arr.findIndex(c => c.key === key)
    const tgt = idx + dir
    if (tgt < 0 || tgt >= arr.length) return
    ;[arr[idx], arr[tgt]] = [arr[tgt], arr[idx]]
    apply(arr.map((c, i) => ({ ...c, sortOrder: i + 1 })))
  }

  const reset = () => apply(defaultConfig)

  const visibleCount = config.filter(c => c.visible).length

  return (
    <div style={{ width: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13, color: '#374151' }}>Columnas visibles</Text>
        <Tooltip title="Restaurar columnas por defecto">
          <Button size="small" type="text" icon={<ReloadOutlined />} onClick={reset} style={{ color: '#6b7280' }} />
        </Tooltip>
      </div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 10 }}>
        {visibleCount} de {config.length} columnas activas
      </Text>

      <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
        {sorted.map((col, idx) => {
          const meta = allColMeta.find(m => m.key === col.key)
          return (
            <div
              key={col.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 4px', borderRadius: 4, marginBottom: 2,
                background: col.visible ? '#f0f7ff' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <Checkbox checked={col.visible} onChange={() => toggle(col.key)} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: col.visible ? 600 : 400 }}>
                  {meta?.label ?? col.key}
                </Text>
                {meta?.description && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block', lineHeight: 1.2 }}>
                    {meta.description}
                  </Text>
                )}
              </div>
              <Space size={0}>
                <Button size="small" type="text" icon={<ArrowUpOutlined style={{ fontSize: 9 }} />}
                  onClick={() => move(col.key, -1)} disabled={idx === 0}
                  style={{ padding: '0 3px', height: 20, color: '#9aa1ab' }} />
                <Button size="small" type="text" icon={<ArrowDownOutlined style={{ fontSize: 9 }} />}
                  onClick={() => move(col.key, 1)} disabled={idx === sorted.length - 1}
                  style={{ padding: '0 3px', height: 20, color: '#9aa1ab' }} />
              </Space>
            </div>
          )
        })}
      </div>

      <Divider style={{ margin: '10px 0 6px' }} />
      <Text type="secondary" style={{ fontSize: 10 }}>
        Preferencias guardadas en este navegador
      </Text>
    </div>
  )
}
