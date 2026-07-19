import { css, type DefaultTheme } from 'styled-components'

export const glassMorphism = (strong = false) => css`
  background: ${({ theme }) => strong ? theme.glass.bgStrong : theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`

/* Flat headings: the old gradient-text treatment is retired for a clean look. */
export const textGradient = (theme: DefaultTheme, from?: string) => css`
  color: ${from ?? theme.colors.text[100]};
`

export const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: background ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')},
    border-color ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')},
    color ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')},
    transform ${({ theme }) => theme.animation.duration.fast}s ease,
    box-shadow ${({ theme }) => theme.animation.duration.normal}s ease;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
`

export const buttonPrimary = css`
  ${buttonBase}
  padding: 0.65rem 1.5rem;
  background: ${({ theme }) => theme.colors.green[400]};
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.green[500]};
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
  }
`

export const buttonGhost = css`
  ${buttonBase}
  padding: 0.55rem 1.2rem;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.glass.border};

  &:hover {
    background: rgba(28, 43, 32, 0.05);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }

  &:active {
    background: rgba(28, 43, 32, 0.08);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: transparent;
  }
`

export const buttonDanger = css`
  ${buttonBase}
  padding: 0.55rem 1.2rem;
  background: transparent;
  color: ${({ theme }) => theme.colors.danger[500]};
  border: 1px solid rgba(219, 74, 91, 0.25);

  &:hover {
    background: rgba(219, 74, 91, 0.1);
    border-color: ${({ theme }) => theme.colors.danger[500]};
  }
`

export const buttonSmall = css`
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  min-height: 36px;
  min-width: 36px;
`

export const buttonLarge = css`
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
  min-height: 52px;
`

export const inputField = css`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.glass.border};
  background: ${({ theme }) => theme.colors.surface[900]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.16);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const cardSurface = css`
  ${glassMorphism()}
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: ${({ theme }) => theme.shadows.md};
    transform: translateY(-1px);
  }
`

export const skeletonShimmer = css`
  background: linear-gradient(
    90deg,
    rgba(28, 43, 32, 0.05) 25%,
    rgba(28, 43, 32, 0.10) 50%,
    rgba(28, 43, 32, 0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

export const glowingBorder = (color?: string) => css`
  position: relative;
  border-color: ${color ?? 'rgba(46, 141, 84, 0.45)'} !important;
`

export const hideOnMobile = css`
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: none !important;
  }
`

export const showOnMobile = css`
  display: none !important;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: flex !important;
  }
`

export const pageContainer = css`
  width: min(1320px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1320px, 100% - 1rem);
    padding-bottom: 7rem;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

export const flexCenter = css`
  display: flex;
  align-items: center;
  justify-content: center;
`

export const flexBetween = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const textTruncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
