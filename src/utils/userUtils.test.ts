import { describe, expect, it } from 'vitest'
import { getAvatarUrl } from './userUtils'

describe('getAvatarUrl', () => {
  it('uses the explicit profile URL when provided', () => {
    const url = getAvatarUrl('Alex', 'https://cdn.example.com/avatar.png')
    expect(url).toBe('https://cdn.example.com/avatar.png')
  })

  it('builds a fallback avatar URL with encoded name', () => {
    const url = getAvatarUrl('Alex Doe', null)
    expect(url).toContain('https://ui-avatars.com/api/')
    expect(url).toContain('name=Alex%20Doe')
    expect(url).toContain('background=41a238')
  })
})
