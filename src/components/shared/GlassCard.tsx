import styled, { css } from 'styled-components'

interface GlassCardProps {
  padding?: string
  hover?: boolean
  glow?: boolean
}

export const GlassCard = styled.div<GlassCardProps>`
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: inset 0 1px 0 rgba(28, 43, 32, 0.04);
  padding: ${({ padding, theme }) => padding ?? theme.spacing.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.map(String).join(',')};

  ${({ hover }) => hover && css`
    &:hover {
      border-color: ${({ theme }) => theme.colors.line};
      box-shadow: ${({ theme }) => theme.shadows.lg};
      transform: translateY(-2px);
    }
  `}

  ${({ glow }) => glow && css`
    box-shadow: ${({ theme }) => theme.shadows.glow};
  `}
`
