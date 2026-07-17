/* GLL Design Tokens — fuente de verdad JS (espejo de los CSS custom props en index.css) */

export const colors = {
  /* Acción principal */
  action:       '#1faec2',
  actionHover:  '#1a97a8',
  actionSoft:   '#e6fafd',

  /* Acento — un CTA naranja por pantalla */
  accent:       '#ff7f00',
  accentHover:  '#e06f00',
  accentSoft:   '#fff2e5',

  /* Identidad / momentos de marca — solo loaders, spinners, barra de carga */
  brandVibe:    '#24cae2',

  /* Textos */
  ink:          '#0a0a0a',
  muted:        '#6b7280',
  muted2:       '#9aa1ab',

  /* Fondos */
  bg:           '#fbfcfe',
  surface:      '#ffffff',

  /* Bordes */
  border:       'rgba(10,10,10,0.08)',
  borderStrong: 'rgba(10,10,10,0.14)',

  /* Hover de fila — muy sutil */
  rowHover:     'rgba(31,174,194,0.055)',

  /* Semánticos financieros */
  success:      '#2ea172',
  successSoft:  '#e8f5ef',
  danger:       '#e5484d',
  dangerSoft:   '#fdecec',
} as const

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
} as const

export const shadow = {
  rest:  '0 1px 2px rgba(10,10,10,0.04), 0 1px 3px rgba(10,10,10,0.03)',
  hover: '0 4px 12px rgba(10,10,10,0.08), 0 2px 4px rgba(10,10,10,0.04)',
} as const

export const transition = {
  ease: 'cubic-bezier(0.22,0.61,0.36,1)',
  dur:  '180ms',
} as const

export const fmt = (n: number) =>
  `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
