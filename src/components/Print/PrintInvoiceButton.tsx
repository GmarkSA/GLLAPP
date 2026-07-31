/**
 * PrintInvoiceButton — Imprime directamente con el formato predeterminado.
 * El usuario configura el formato en Configuración → Plantillas de Impresión.
 * El dropdown (▼) permite cambiar el formato puntualmente sin ir a configuración.
 */
import { Dropdown, Button, Space } from 'antd'
import { PrinterOutlined, DownOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Invoice } from '../../api/facturas'
import { PRINT_FORMATS, getDefaultFormatTemplate, type PrintFormatId } from './printFormats'

interface Props {
  invoice:  Invoice
  company?: unknown   // mantenido por compatibilidad
  size?:    'small' | 'middle' | 'large'
  block?:   boolean
}

function openPrint(invoiceId: string, formatId: PrintFormatId) {
  const url = `/ventas/facturas/${invoiceId}/imprimir?format=${formatId}`
  const win = window.open(url, '_blank', 'width=880,height=1020,menubar=no,toolbar=no,location=no,scrollbars=yes')
  if (!win) alert('Permite ventanas emergentes en este sitio para poder imprimir.')
}

export default function PrintInvoiceButton({ invoice, size, block }: Props) {
  const navigate       = useNavigate()
  const defaultFmt     = getDefaultFormatTemplate()
  const defaultFormat  = PRINT_FORMATS.find(f => f.id === defaultFmt.formatId) ?? PRINT_FORMATS[0]

  const handleDirectPrint = () => openPrint(invoice.id, defaultFmt.formatId)

  const menuItems = [
    ...PRINT_FORMATS.filter(f => f.id !== defaultFmt.formatId).map(f => ({
      key:   f.id,
      label: (
        <Space>
          <PrinterOutlined />
          <span>{f.label}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.description}</span>
        </Space>
      ),
    })),
    { type: 'divider' as const },
    {
      key:   '__config',
      icon:  <SettingOutlined />,
      label: 'Cambiar formato predeterminado…',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '__config') {
      navigate('/configuracion/plantillas-impresion')
    } else {
      openPrint(invoice.id, key as PrintFormatId)
    }
  }

  return (
    <Dropdown.Button
      size={size}
      style={block ? { width: '100%' } : undefined}
      icon={<DownOutlined />}
      onClick={handleDirectPrint}
      menu={{ items: menuItems, onClick: handleMenuClick }}
    >
      <PrinterOutlined />
      {' '}Imprimir / PDF
      {' '}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
        ({defaultFormat.label})
      </span>
    </Dropdown.Button>
  )
}
