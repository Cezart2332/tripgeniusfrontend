import styled from 'styled-components'
import { SkeletonBlock } from './SkeletonBlock'

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