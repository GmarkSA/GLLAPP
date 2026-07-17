/**
 * PrintInvoiceButton — Botón "Imprimir / PDF" con selector de formato.
 *
 * Abre /ventas/facturas/:id/imprimir?format=... en una ventana nueva.
 * La página destino tiene su propio CSS @page y dispara window.print()
 * automáticamente, evitando el problema de "about:blank" en el footer.
 */
import { useState } from 'react'
import { Button, Modal, Radio, Space, Tag, Divider } from 'antd'
import { PrinterOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Invoice } from '../../api/facturas'
import type { PrintFormatId } from './printFormats'
import { PRINT_FORMATS, getSavedFormat, saveFormat } from './printFormats'

interface Props {
  invoice:  Invoice
  company?: unknown   // mantenido por compatibilidad — la página de impresión carga sus propios datos
  size?:    'small' | 'middle' | 'large'
  block?:   boolean
}

export default function PrintInvoiceButton({ invoice, size, block }: Props) {
  const [open,     setOpen]     = useState(false)
  const [formatId, setFormatId] = useState<PrintFormatId>(getSavedFormat)

  const handlePrint = () => {
    saveFormat(formatId)
    setOpen(false)

    const url = `/ventas/facturas/${invoice.id}/imprimir?format=${formatId}`
    const win = window.open(url, '_blank', 'width=880,height=1020,menubar=no,toolbar=no,location=no,scrollbars=yes')
    if (!win) {
      alert('Permite ventanas emergentes en este sitio para poder imprimir.')
    }
  }

  const selectedFormat = PRINT_FORMATS.find(f => f.id === formatId) ?? PRINT_FORMATS[0]

  return (
    <>
      <Button
        icon={<PrinterOutlined />}
        size={size}
        block={block}
        onClick={() => setOpen(true)}
      >
        Imprimir / PDF
      </Button>

      <Modal
        open={open}
        title={
          <Space>
            <PrinterOutlined style={{ color: '#1faec2' }} />
            <span style={{ color: '#1faec2', fontWeight: 600 }}>Formato de impresión</span>
          </Space>
        }
        onOk={handlePrint}
        onCancel={() => setOpen(false)}
        okText="Imprimir"
        cancelText="Cancelar"
        okButtonProps={{ icon: <PrinterOutlined />, style: { background: '#1faec2', borderColor: '#1faec2' } }}
        width={440}
      >
        <Divider style={{ margin: '12px 0' }} />

        <Radio.Group
          value={formatId}
          onChange={e => setFormatId(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%', gap: 8 }}>
            {PRINT_FORMATS.map(f => (
              <Radio
                key={f.id}
                value={f.id}
                style={{
                  width:        '100%',
                  border:       `1px solid ${formatId === f.id ? '#1faec2' : 'rgba(10,10,10,0.08)'}`,
                  borderRadius: 8,
                  padding:      '10px 14px',
                  background:   formatId === f.id ? '#fafbfc' : '#fafbfc',
                }}
              >
                <Space>
                  <FileTextOutlined style={{ color: f.isTicket ? '#2ea172' : '#1faec2', fontSize: 15 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{f.description}</div>
                  </div>
                  {f.isTicket && <Tag color="#2ea172" style={{ fontSize: 10 }}>Térmica</Tag>}
                  {f.id === 'carta' && <Tag color="#1faec2" style={{ fontSize: 10 }}>Recomendado</Tag>}
                </Space>
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        <Divider style={{ margin: '14px 0 8px' }} />
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          Se abrirá una ventana nueva lista para imprimir o guardar como PDF.
          El formato <strong>{selectedFormat.label}</strong> se recordará para el próximo documento.
        </div>
      </Modal>
    </>
  )
}
