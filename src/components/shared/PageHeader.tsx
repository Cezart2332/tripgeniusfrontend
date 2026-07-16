import React from 'react'
import { motion } from 'framer-motion'
import styled from 'styled-components'

interface StatInfo {
  icon: React.ReactNode
  value: string | number
  label: string
}

interface PageHeaderProps {
  title: string
  description?: string
  stats?: StatInfo[]
  actions?: React.ReactNode
}

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background:
    radial-gradient(ellipse at 82% 0%, rgba(46, 141, 84, 0.06), transparent 65%);

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.md};
  }
`

const HeadingGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

const Title = styled.h1`
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.text[100]} 30%, ${({ theme }) => theme.colors.offroad.accent} 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`

const Description = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.body};
`

const StatsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`

const Stat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  padding: 0.3rem 0.7rem;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

const StatIcon = styled.span`
  color: ${({ theme }) => theme.colors.offroad.accent};
  display: flex;
  font-size: 0.9rem;
`

const StatValue = styled.span`
  color: ${({ theme }) => theme.colors.text[100]};
  font-weight: 600;
`

const ActionsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;

    > * {
      flex: 1;
    }
  }
`

export function PageHeader({ title, description, stats, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Wrapper>
        <HeadingGroup>
          <Title>{title}</Title>
          {description && <Description>{description}</Description>}
          {stats && stats.length > 0 && (
            <StatsRow>
              {stats.map((stat, i) => (
                <Stat key={i}>
                  <StatIcon>{stat.icon}</StatIcon>
                  <StatValue>{stat.value}</StatValue>
                  <span>{stat.label}</span>
                </Stat>
              ))}
            </StatsRow>
          )}
        </HeadingGroup>
        {actions && <ActionsRow>{actions}</ActionsRow>}
      </Wrapper>
    </motion.div>
  )
}
