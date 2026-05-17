import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

const motionOnlyProps = new Set([
  'animate',
  'exit',
  'initial',
  'transition',
  'variants',
  'whileInView',
  'viewport',
])

const createMockComponent = (tag: string) =>
  React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...rest }, ref) => {
    const cleanedProps = Object.fromEntries(
      Object.entries(rest).filter(([key]) => !motionOnlyProps.has(key)),
    )
    return React.createElement(tag, { ref, ...cleanedProps }, children)
  })

const motionProxy = new Proxy({}, {
  get: (_target, prop) => {
    const tag = typeof prop === 'string' ? prop : 'div'
    return createMockComponent(tag)
  },
})

vi.mock('framer-motion', () => ({
  motion: motionProxy,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})
