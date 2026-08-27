import { Select } from 'antd'
import { BarcodeOutlined } from '@ant-design/icons'

interface BarcodeInputProps {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
}

/**
 * Captura uno o varios códigos de barras como "chips". Compatible con lectores
 * físicos USB/Bluetooth (HID): estos escriben el código y terminan con Enter,
 * igual que tipear manualmente — Select en modo "tags" ya confirma cada tag al
 * presionar Enter o coma, sin necesitar librería ni permisos de cámara.
 */
export default function BarcodeInput({ value, onChange, placeholder }: BarcodeInputProps) {
  return (
    <Select
      mode="tags"
      value={value ?? []}
      onChange={onChange}
      tokenSeparators={[',']}
      open={false}
      suffixIcon={<BarcodeOutlined style={{ color: '#bbb' }} />}
      placeholder={placeholder ?? 'Escanea o escribe un código y presiona Enter'}
      style={{ width: '100%' }}
    />
  )
}
