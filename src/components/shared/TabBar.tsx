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

const Wrapper = styled.div<{ $pill: boolean }>`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  touch-action: pan-x;
  scrollbar-width: none;
  -ms-overflow-style: none;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    display: none;
  }

  ${({ $pill, theme }) =>
    $pill &&
    `
    background: ${theme.colors.surface[900]};
    border: 1px solid ${theme.glass.border};
    border-radius: ${theme.radii.lg};
    padding: ${theme.spacing.xs};
  `}
`

const TabList = styled.div<{ $variant: 'default' | 'pill' }>`
  position: relative;
  display: flex;
  gap: ${({ $variant }) => ($variant === 'pill' ? '0.25rem' : '0')};
  min-width: ${({ $variant }) => ($variant === 'pill' ? '100%' : 'auto')};
  width: ${({ $variant }) => ($variant === 'pill' ? 'max-content' : '100%')};
  border-bottom: ${({ $variant, theme }) =>
    $variant === 'default' ? `1px solid ${theme.colors.lineSoft}` : 'none'};
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
      ? theme.colors.bg[980]
      : $active
        ? theme.colors.text[100]
        : theme.colors.text[380]};
  background: transparent;
  border: none;
  border-radius: ${({ $variant, theme }) => $variant === 'pill' ? theme.radii.lg : '0'};
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease;
  min-height: 44px;
  flex-shrink: 0;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const PillIndicator = styled(motion.div)`
  position: absolute;
  inset: 0;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[400]}, ${({ theme }) => theme.colors.offroad.accent});
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: 0 2px 12px rgba(143, 179, 106, 0.2);
  z-index: 0;
  pointer-events: none;
`

const UnderlineIndicator = styled(motion.div)`
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, ${({ theme }) => theme.colors.green[400]}, ${({ theme }) => theme.colors.offroad.accent});
  z-index: 1;
  pointer-events: none;
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
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.danger[500]};
  color: #fff;
  line-height: 1;
`

const pillIndicatorTransition = { type: 'spring' as const, stiffness: 500, damping: 35 }

export function TabBar({ tabs, activeTab, onChange, variant = 'default' }: TabBarProps) {
  const isPill = variant === 'pill'
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const updateIndicator = useCallback(() => {
    if (isPill) return
    const activeEl = tabRefs.current.get(activeTab)
    const wrapperEl = activeEl?.closest<HTMLDivElement>('[data-tab-wrapper]')
    if (!activeEl || !wrapperEl) return

    const wrapperRect = wrapperEl.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    setIndicatorStyle({
      left: elRect.left - wrapperRect.left,
      width: elRect.width,
    })
  }, [activeTab, isPill])

  useEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTab)
    if (!activeEl) return

    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (finePointer) {
      activeEl.scrollIntoView({ inline: 'nearest', block: 'nearest' })
      activeEl.focus({ preventScroll: true })
    }
  }, [activeTab])

  useEffect(() => {
    if (isPill) return
    const wrapper = tabRefs.current.get(activeTab)?.closest<HTMLDivElement>('[data-tab-wrapper]')
    if (!wrapper) return

    const observer = new ResizeObserver(updateIndicator)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [updateIndicator, activeTab, isPill])

  const handleTabClick = (key: string) => {
    onChange(key)
  }

  return (
    <Wrapper $pill={isPill} data-tab-wrapper>
      <TabList $variant={variant} role="tablist">
        {!isPill && (
          <UnderlineIndicator
            initial={false}
            animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <Tab
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el)
                else tabRefs.current.delete(tab.key)
              }}
              $active={isActive}
              $variant={variant}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => handleTabClick(tab.key)}
            >
              {isPill && isActive && (
                <PillIndicator
                  layoutId="pill-indicator"
                  transition={pillIndicatorTransition}
                />
              )}
              {tab.icon}
              <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <Badge>{tab.badge}</Badge>
              )}
            </Tab>
          )
        })}
      </TabList>
    </Wrapper>
  )
}
