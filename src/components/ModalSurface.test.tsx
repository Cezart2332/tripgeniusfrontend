import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSurface } from './ModalSurface'

describe('ModalSurface', () => {
  it('closes when clicking the scrim or pressing Escape', () => {
    const onClose = vi.fn()

    const { container } = render(
      <ModalSurface isOpen title="Edit settings" onClose={onClose}>
        <p>Content</p>
      </ModalSurface>,
    )

    const scrim = container.querySelector('.modal-scrim')
    expect(scrim).not.toBeNull()

    if (scrim) {
      fireEvent.click(scrim)
    }

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('does not close when clicking inside the modal', () => {
    const onClose = vi.fn()

    render(
      <ModalSurface isOpen title="Edit settings" onClose={onClose}>
        <button type="button">Save</button>
      </ModalSurface>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
