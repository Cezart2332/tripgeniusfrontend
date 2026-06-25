import { useState, useRef, useEffect } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import styled from 'styled-components'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClear?: () => void
}

const Wrapper = styled.div<{ $focused: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 460px;
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ $focused, theme }) => $focused ? theme.colors.green[500] : theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: ${({ $focused }) => $focused ? `0 0 0 3px rgba(143, 179, 106, 0.14)` : 'inset 0 1px 0 rgba(247, 243, 232, 0.04)'};
`

const IconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 0.8rem;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: 1.1rem;
  flex-shrink: 0;
`

const Input = styled.input`
  width: 100%;
  padding: 0.65rem 0.5rem 0.65rem 0.5rem;
  background: transparent;
  border: none;
  outline: none;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  min-height: 44px;
  font-family: inherit;

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }
`

const ClearBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  margin-right: 0.4rem;
  background: rgba(247, 243, 232, 0.08);
  color: ${({ theme }) => theme.colors.text[380]};
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(247, 243, 232, 0.14);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

export function SearchBar({ value, onChange, placeholder = 'Search...', onClear }: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClear = () => {
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <Wrapper $focused={focused}>
      <IconWrap>
        <FiSearch />
      </IconWrap>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
      />
      {value && (
        <ClearBtn onClick={handleClear} aria-label="Clear search">
          <FiX size={14} />
        </ClearBtn>
      )}
    </Wrapper>
  )
}
