import styled from 'styled-components'

export const SkeletonBlock = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${({ $width }) => $width ?? '100%'};
  height: ${({ $height }) => $height ?? '1rem'};
  border-radius: ${({ $radius, theme }) => $radius ?? theme.radii.sm};
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

const Card = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
  }
`

const Thumb = styled(SkeletonBlock)`
  width: 180px;
  height: 120px;
  border-radius: ${({ theme }) => theme.radii.md};
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    height: 160px;
  }
`

const Info = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

export function SkeletonCard() {
  return (
    <Card aria-hidden="true">
      <Thumb />
      <Info>
        <SkeletonBlock $width="80px" $height="0.8rem" />
        <SkeletonBlock $width="240px" $height="1.2rem" />
        <SkeletonBlock $width="180px" $height="0.85rem" />
        <SkeletonBlock $width="100%" $height="0.5rem" style={{ marginTop: 'auto' }} />
      </Info>
    </Card>
  )
}