import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { CreditCardOutlined, LockOutlined } from '@ant-design/icons'

export interface CardTokenResult {
  token: string
  last4: string
  brand: 'visa' | 'mastercard'
  holderName: string
}

interface CardTokenizerProps {
  onToken: (result: CardTokenResult) => void
  loading?: boolean
}

// TODO: conectar QPayPro SDK cuando esté disponible
// Reemplazar mockTokenize() con: QPayPro.tokenize({ ccNumber, expMonth, expYear, cvv })
async function mockTokenize(ccNumber: string, expMonth: string, expYear: string, cvv: string): Promise<string> {
  // Placeholder — nunca envía PAN al backend, solo simula el SDK
  void ccNumber; void expMonth; void expYear; void cvv;
  return `tok_${Date.now()}_mock`
}

function detectBrand(num: string): 'visa' | 'mastercard' {
  return num.startsWith('4') ? 'visa' : 'mastercard'
}

function formatCardDisplay(value: string): string {
  return value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().substring(0, 19)
}

export default function CardTokenizer({ onToken, loading }: CardTokenizerProps) {
  const [form] = Form.useForm()
  const [tokenizing, setTokenizing] = useState(false)
  const [cardDisplay, setCardDisplay] = useState('')

  const handleSubmit = async (values: {
    ccNumber: string
    expiry: string
    cvv: string
    holderName: string
  }) => {
    setTokenizing(true)
    try {
      const rawNum = values.ccNumber.replace(/\s/g, '')
      const [expMonth, expYear] = values.expiry.split('/')

      // TODO: reemplazar mockTokenize con QPayPro.tokenize(...)
      const token = await mockTokenize(rawNum, expMonth.trim(), expYear.trim(), values.cvv)

      onToken({
        token,
        last4: rawNum.slice(-4),
        brand: detectBrand(rawNum),
        holderName: values.holderName,
      })
    } catch {
      message.error('Error al procesar la tarjeta. Intenta de nuevo.')
    } finally {
      setTokenizing(false)
    }
  }

  return (
    <Form form={form} layout="vertical" size="small" onFinish={handleSubmit}>
      <Form.Item
        name="holderName"
        label="Nombre en la tarjeta"
        rules={[{ required: true, message: 'Ingresa el nombre' }]}
      >
        <Input prefix={<CreditCardOutlined />} placeholder="JUAN GARCIA" autoComplete="cc-name" />
      </Form.Item>

      <Form.Item
        name="ccNumber"
        label="Número de tarjeta"
        rules={[{ required: true }, { len: 19, message: 'Número inválido' }]}
      >
        <Input
          placeholder="•••• •••• •••• ••••"
          autoComplete="cc-number"
          inputMode="numeric"
          maxLength={19}
          prefix={
            cardDisplay.startsWith('4')
              ? <img src="/visa.svg" style={{ width: 24 }} alt="Visa" />
              : <CreditCardOutlined />
          }
          onChange={(e) => {
            const formatted = formatCardDisplay(e.target.value)
            setCardDisplay(formatted)
            form.setFieldValue('ccNumber', formatted)
          }}
        />
      </Form.Item>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Form.Item
          name="expiry"
          label="Vencimiento (MM/AA)"
          rules={[{ required: true }, { pattern: /^\d{2}\/\d{2}$/, message: 'Formato MM/AA' }]}
        >
          <Input placeholder="MM/AA" autoComplete="cc-exp" maxLength={5} inputMode="numeric"
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, '')
              if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4)
              form.setFieldValue('expiry', v)
            }}
          />
        </Form.Item>

        <Form.Item
          name="cvv"
          label="CVV / CVC"
          rules={[{ required: true }, { min: 3, max: 4, message: '3-4 dígitos' }]}
        >
          <Input
            prefix={<LockOutlined />}
            placeholder="•••"
            autoComplete="cc-csc"
            maxLength={4}
            inputMode="numeric"
            onChange={(e) => form.setFieldValue('cvv', e.target.value.replace(/\D/g, ''))}
          />
        </Form.Item>
      </div>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={tokenizing || loading}
          block
          style={{ background: '#1faec2' }}
        >
          Confirmar pago
        </Button>
      </Form.Item>
    </Form>
  )
}
