import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import styled from 'styled-components'

interface StatBadgeProps {
  icon: ReactNode
  value: string | number
  label: string
}

const Badge = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  min-width: 80px;
`

const IconWrap = styled.div`
  color: ${({ theme }) => theme.colors.green[500]};
  font-size: 1.2rem;
  opacity: 0.9;
`

const Value = styled.span`
  font-size: 1.1rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text[100]};
  line-height: 1;
`

const Label = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1;
`

export function StatBadge({ icon, value, label }: StatBadgeProps) {
  return (
    <Badge whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <IconWrap>{icon}</IconWrap>
      <Value>{value}</Value>
      <Label>{label}</Label>
    </Badge>
  )
}