import React from 'react'
import { Typography } from 'antd'
import { colors } from '../../styles/theme'

const { Title, Text } = Typography

interface PageHeaderProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24, color: colors.action }}>{icon}</span>
        <div>
          <Title level={4} style={{ margin: 0, color: colors.ink }}>{title}</Title>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </div>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  )
}
