import styled from 'styled-components'

interface AvatarStackProps {
  avatars: Array<{ url: string; alt: string }>
  max?: number
  size?: number
}

const Stack = styled.div`
  display: flex;
  align-items: center;
`

const Avatar = styled.img<{ $size: number; $index: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid ${({ theme }) => theme.colors.bg[960]};
  margin-left: ${({ $index }) => $index > 0 ? '-8px' : '0'};
  transition: transform 0.2s ease;
  position: relative;
  z-index: ${({ $index }) => 10 - $index};

  &:hover {
    transform: translateY(-2px);
  }
`

const Overflow = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.green[700]};
  border: 2px solid ${({ theme }) => theme.colors.bg[960]};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text[100]};
  margin-left: -8px;
`

export function AvatarStack({ avatars, max = 4, size = 32 }: AvatarStackProps) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <Stack>
      {visible.map((avatar, i) => (
        <Avatar
          key={i}
          src={avatar.url}
          alt={avatar.alt}
          $size={size}
          $index={i}
        />
      ))}
      {overflow > 0 && <Overflow $size={size}>+{overflow}</Overflow>}
    </Stack>
  )
}