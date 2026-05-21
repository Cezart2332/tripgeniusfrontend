import { type ReactNode, useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import styled from 'styled-components'

interface TabItem {
  key: string
  label: string
  icon?: ReactNode
  badge?: number
}

interface TabBarProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (key: string) => void
  variant?: 'default' | 'pill'
}

const Wrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const TabList = styled.div<{ $variant: 'default' | 'pill' }>`
  position: relative;
  display: flex;
  gap: ${({ $variant }) => $variant === 'pill' ? '0.25rem' : '0'};
  border-bottom: ${({ $variant, theme }) => $variant === 'default' ? `1px solid ${theme.colors.lineSoft}` : 'none'};
  padding: ${({ $variant, theme }) => $variant === 'pill' ? theme.spacing.xs : '0'};
  border-radius: ${({ $variant, theme }) => $variant === 'pill' ? theme.radii.pill : '0'};
  background: ${({ $variant }) => $variant === 'pill' ? 'rgba(9, 14, 10, 0.75)' : 'transparent'};
  border: ${({ $variant, theme }) => $variant === 'pill' ? `1px solid ${theme.colors.lineSoft}` : 'none'};
`

const Tab = styled.button<{ $active: boolean; $variant: 'default' | 'pill' }>`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: ${({ $variant }) => $variant === 'pill' ? '0.5rem 1rem' : '0.7rem 1rem'};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: ${({ $active }) => $active ? 700 : 500};
  color: ${({ $active, $variant, theme }) =>
    $active && $variant === 'pill'
      ? '#0a1e08'
      : $active
        ? theme.colors.text[100]
        : theme.colors.text[380]};
  background: transparent;
  border: none;
  border-radius: ${({ $variant, theme }) => $variant === 'pill' ? theme.radii.pill : '0'};
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease;
  min-height: 40px;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const ActiveIndicator = styled(motion.div)<{ $variant: 'default' | 'pill' }>`
  position: absolute;
  bottom: ${({ $variant }) => $variant === 'default' ? '-1px' : '0'};
  left: 0;
  right: 0;
  height: ${({ $variant }) => $variant === 'default' ? '2px' : '100%'};
  ${({ $variant, theme }) => $variant === 'default' ? `
    background: linear-gradient(90deg, ${theme.colors.green[580]}, ${theme.colors.green[500]});
  ` : `
    background: linear-gradient(135deg, ${theme.colors.green[580]}, ${theme.colors.green[500]});
    border-radius: ${theme.radii.pill};
    box-shadow: 0 2px 12px rgba(23, 247, 2, 0.2);
  `}
  z-index: ${({ $variant }) => $variant === 'pill' ? '-1' : '1'};
`

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.danger[500]};
  color: #fff;
  line-height: 1;
`

export function TabBar({ tabs, activeTab, onChange, variant = 'default' }: TabBarProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(activeTab)
    const wrapperEl = activeEl?.closest<HTMLDivElement>('[data-tab-wrapper]')
    if (!activeEl || !wrapperEl) return

    const wrapperRect = wrapperEl.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    setIndicatorStyle({
      left: elRect.left - wrapperRect.left,
      width: elRect.width,
    })
  }, [activeTab])

  useEffect(() => {
    updateIndicator()
    const activeEl = tabRefs.current.get(activeTab)
    activeEl?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    activeEl?.focus({ preventScroll: true })
  }, [activeTab, updateIndicator])

  useEffect(() => {
    const wrapper = tabRefs.current.get(activeTab)?.closest<HTMLDivElement>('[data-tab-wrapper]')
    if (!wrapper) return

    const observer = new ResizeObserver(updateIndicator)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [updateIndicator, activeTab])

  return (
    <Wrapper data-tab-wrapper>
      <TabList $variant={variant} role="tablist">
        <ActiveIndicator
          $variant={variant}
          layoutId={variant === 'pill' ? 'pill-indicator' : 'tab-indicator'}
          initial={false}
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            ref={(el) => { if (el) tabRefs.current.set(tab.key, el) }}
            $active={activeTab === tab.key}
            $variant={variant}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon}
            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge>{tab.badge}</Badge>
            )}
          </Tab>
        ))}
      </TabList>
    </Wrapper>
  )
}