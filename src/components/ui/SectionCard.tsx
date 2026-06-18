import React from 'react'
import { Card } from 'antd'
import type { CardProps } from 'antd'
import { shadow, radius } from '../../styles/theme'

interface SectionCardProps extends CardProps {
  children: React.ReactNode
}

export function SectionCard({ children, style, ...rest }: SectionCardProps) {
  return (
    <Card
      bordered={false}
      style={{ borderRadius: radius.lg, boxShadow: shadow.card, ...style }}
      {...rest}
    >
      {children}
    </Card>
  )
}
