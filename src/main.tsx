import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'

dayjs.locale('es')

// Cuando Vercel despliega una nueva versión, los chunks con hash viejo ya no existen.
// Vite emite este evento al fallar un import dinámico → recargamos para obtener el HTML nuevo.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={esES}
        theme={{
          token: {
            colorPrimary:          '#1faec2',
            colorSuccess:          '#2ea172',
            colorWarning:          '#ff7f00',
            colorError:            '#e5484d',
            colorInfo:             '#1faec2',
            borderRadius:          12,
            borderRadiusLG:        12,
            borderRadiusSM:        8,
            fontFamily:            "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            fontSize:              14,
            fontSizeLG:            16,
            lineHeight:            1.6,
            colorBgContainer:      '#ffffff',
            colorBgLayout:         '#fbfcfe',
            colorBorder:           'rgba(10,10,10,0.08)',
            colorBorderSecondary:  'rgba(10,10,10,0.05)',
            boxShadow:             '0 1px 2px rgba(10,10,10,0.04), 0 1px 3px rgba(10,10,10,0.03)',
            boxShadowSecondary:    '0 4px 12px rgba(10,10,10,0.08), 0 2px 4px rgba(10,10,10,0.04)',
            motion:                true,
          },
          components: {
            Button:     { borderRadius: 10, controlHeight: 36, fontWeight: 500 },
            Input:      { borderRadius: 8, controlHeight: 36 },
            Select:     { borderRadius: 8, controlHeight: 36 },
            DatePicker: { borderRadius: 8, controlHeight: 36 },
            Table: {
              borderRadius:  12,
              headerBg:      '#fafbfc',
              headerColor:   '#374151',
              rowHoverBg:    'rgba(31,174,194,0.055)',
            },
            Card:   { borderRadius: 12, paddingLG: 20 },
            Menu:   { itemBorderRadius: 10, subMenuItemBorderRadius: 8 },
            Tag:    { borderRadius: 20 },
            Badge:  { colorPrimary: '#e5484d' },
            Checkbox: { colorBorder: '#374151' },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
