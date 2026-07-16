import styled from 'styled-components'
import { FiInfo } from 'react-icons/fi'
import type { ReactNode } from 'react'

const HintWrap = styled.p<{ $tone: 'muted' | 'accent' }>`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0.35rem 0 0;
  font-size: ${({ theme }) => theme.typography.caption};
  line-height: 1.45;
  color: ${({ theme, $tone }) =>
    $tone === 'accent' ? theme.colors.green[580] : theme.colors.text[380]};

  svg {
    flex-shrink: 0;
    margin-top: 0.1rem;
    opacity: 0.8;
  }
`

interface FieldHintProps {
  children: ReactNode
  /** 'accent' renders the hint in green for tips worth highlighting. */
  tone?: 'muted' | 'accent'
  /** Hide the info icon for very short hints. */
  icon?: boolean
  id?: string
}

/** Small helper text shown under a form field or control. */
export function FieldHint({ children, tone = 'muted', icon = true, id }: FieldHintProps) {
  return (
    <HintWrap $tone={tone} id={id}>
      {icon && <FiInfo size={13} aria-hidden />}
      <span>{children}</span>
    </HintWrap>
  )
}
