import styled from 'styled-components'

export const SkeletonBlock = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${({ $width }) => $width ?? '100%'};
  height: ${({ $height }) => $height ?? '1rem'};
  border-radius: ${({ $radius, theme }) => $radius ?? theme.radii.sm};
  background: linear-gradient(
    90deg,
    rgba(247, 243, 232, 0.04) 25%,
    rgba(247, 243, 232, 0.11) 50%,
    rgba(247, 243, 232, 0.04) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`
