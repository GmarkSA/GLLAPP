export const colors = {
  primary:   '#1B3A6B',
  primary2:  '#2d5fa6',
  success:   '#12b76a',
  warning:   '#f79009',
  error:     '#f04438',
  info:      '#2d5fa6',
  textMuted: '#6b7280',
  bgLayout:  '#f0f2f7',
  bgCard:    '#ffffff',
  border:    'rgba(0,0,0,0.08)',
} as const

export const radius = {
  sm:  7,
  md:  10,
  lg:  14,
} as const

export const shadow = {
  card:  '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  light: '0 1px 6px rgba(0,0,0,0.06)',
} as const

export const fmt = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
