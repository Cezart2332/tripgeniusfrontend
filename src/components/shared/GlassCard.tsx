import styled, { css } from 'styled-components'

interface GlassCardProps {
  padding?: string
  hover?: boolean
  glow?: boolean
}

export const GlassCard = styled.div<GlassCardProps>`
  background:
    linear-gradient(145deg, rgba(247, 243, 232, 0.045), rgba(247, 243, 232, 0.015)),
    ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: inset 0 1px 0 rgba(247, 243, 232, 0.04);
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
