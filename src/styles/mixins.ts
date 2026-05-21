import { css, type DefaultTheme } from 'styled-components'

export const glassMorphism = (strong = false) => css`
  background: ${({ theme }) => strong ? theme.glass.bgStrong : theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
`

export const textGradient = (theme: DefaultTheme, from?: string, to?: string) => css`
  background: linear-gradient(135deg, ${from ?? theme.colors.text[100]} 30%, ${to ?? theme.colors.green[500]} 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`

export const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
`

export const buttonPrimary = css`
  ${buttonBase}
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.3), 0 0 80px rgba(23, 247, 2, 0.1);
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
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }

  &:active {
    background: rgba(65, 162, 56, 0.12);
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
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
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
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const cardSurface = css`
  ${glassMorphism()}
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: ${({ theme }) => theme.shadows.glow};
    transform: translateY(-1px);
  }
`

export const skeletonShimmer = css`
  background: linear-gradient(
    90deg,
    rgba(65, 162, 56, 0.06) 25%,
    rgba(65, 162, 56, 0.12) 50%,
    rgba(65, 162, 56, 0.06) 75%
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

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, ${color ?? 'var(--green-500)'}, transparent 60%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
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
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
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
