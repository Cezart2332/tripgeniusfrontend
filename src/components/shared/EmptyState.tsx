import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import styled from 'styled-components'
import { FiAlertCircle } from 'react-icons/fi'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  image?: string
}

const Wrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.xl};
  gap: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  background:
    linear-gradient(145deg, rgba(247, 243, 232, 0.05), rgba(247, 243, 232, 0.015)),
    ${({ theme }) => theme.colors.surface[900]};
  box-shadow: ${({ theme }) => theme.shadows.md};
`

const IconWrap = styled.div`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.offroad.accent};
  opacity: 0.85;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const Illustration = styled.img`
  width: 140px;
  height: auto;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  opacity: 0.8;
`

const Title = styled.h2`
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.h2};
`

const Description = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 360px;
  line-height: 1.5;
`

const ActionWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
`

export function EmptyState({ icon, title, description, action, image }: EmptyStateProps) {
  return (
    <Wrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {image ? (
        <Illustration src={image} alt="" aria-hidden="true" />
      ) : (
        <IconWrap>{icon ?? <FiAlertCircle size={40} />}</IconWrap>
      )}
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
      {action && <ActionWrap>{action}</ActionWrap>}
    </Wrapper>
  )
}
