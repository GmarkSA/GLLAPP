import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import App from './App'
import './index.css'

dayjs.locale('es')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={esES}
        theme={{
          token: {
            colorPrimary: '#1B3A6B',
            colorSuccess: '#12b76a',
            colorWarning: '#f79009',
            colorError: '#f04438',
            colorInfo: '#2d5fa6',
            borderRadius: 10,
            borderRadiusLG: 14,
            borderRadiusSM: 7,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            fontSize: 13,
            fontSizeLG: 15,
            lineHeight: 1.6,
            colorBgContainer: '#ffffff',
            colorBgLayout: '#f0f2f7',
            colorBorder: 'rgba(0,0,0,0.08)',
            colorBorderSecondary: 'rgba(0,0,0,0.05)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.08)',
            motion: true,
          },
          components: {
            Button: { borderRadius: 10, controlHeight: 36, fontWeight: 500 },
            Input: { borderRadius: 10, controlHeight: 36 },
            Select: { borderRadius: 10, controlHeight: 36 },
            DatePicker: { borderRadius: 10, controlHeight: 36 },
            Table: { borderRadius: 12, headerBg: '#f8f9fc', headerColor: '#6b7280', rowHoverBg: '#f5f7ff' },
            Card: { borderRadius: 14, paddingLG: 20 },
            Menu: { itemBorderRadius: 10, subMenuItemBorderRadius: 8 },
            Tag: { borderRadius: 20 },
            Badge: { colorPrimary: '#f04438' },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
