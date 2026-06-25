import styled from 'styled-components'

type StatusColor = 'green' | 'gold' | 'danger' | 'muted'

interface StatusPillProps {
  label: string
  color?: StatusColor
  size?: 'sm' | 'md'
}

const colorMap: Record<StatusColor, { bg: string; text: string; border: string }> = {
  green: { bg: 'rgba(143, 179, 106, 0.1)', text: '#8fb36a', border: 'rgba(143, 179, 106, 0.25)' },
  gold: { bg: 'rgba(201, 162, 39, 0.12)', text: '#c9a227', border: 'rgba(201, 162, 39, 0.3)' },
  danger: { bg: 'rgba(219, 74, 91, 0.1)', text: '#db4a5b', border: 'rgba(219, 74, 91, 0.25)' },
  muted: { bg: 'rgba(169, 200, 163, 0.08)', text: '#a9c8a3', border: 'rgba(169, 200, 163, 0.15)' },
}

const Pill = styled.span<{ $color: StatusColor; $size: 'sm' | 'md' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: ${({ $size }) => $size === 'sm' ? '0.15rem 0.55rem' : '0.25rem 0.75rem'};
  font-size: ${({ $size, theme }) => $size === 'sm' ? theme.typography.caption : theme.typography.bodySmall};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ $color }) => colorMap[$color].border};
  background: ${({ $color }) => colorMap[$color].bg};
  color: ${({ $color }) => colorMap[$color].text};
  line-height: 1;
  white-space: nowrap;
`

const Dot = styled.span<{ $color: StatusColor }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $color }) => colorMap[$color].text};
`

export function StatusPill({ label, color = 'muted', size = 'sm' }: StatusPillProps) {
  return (
    <Pill $color={color} $size={size}>
      <Dot $color={color} />
      {label}
    </Pill>
  )
}