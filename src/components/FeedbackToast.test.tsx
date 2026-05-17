import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeedbackToast } from './FeedbackToast'

describe('FeedbackToast', () => {
  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers()
    const clearToast = vi.fn()

    render(
      <FeedbackToast
        toast={{ id: 1, message: 'Saved changes', tone: 'success' }}
        clearToast={clearToast}
      />,
    )

    expect(screen.getByText('Saved changes')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3200)
    })

    expect(clearToast).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('dismisses on manual click', () => {
    const clearToast = vi.fn()

    render(
      <FeedbackToast
        toast={{ id: 2, message: 'Something went wrong', tone: 'error' }}
        clearToast={clearToast}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(clearToast).toHaveBeenCalledTimes(1)
  })
})
