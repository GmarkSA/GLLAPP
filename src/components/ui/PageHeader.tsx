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
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ fontSize: 24, color: colors.action, flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <Title level={4} style={{ margin: 0, color: colors.ink }}>{title}</Title>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </div>
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
