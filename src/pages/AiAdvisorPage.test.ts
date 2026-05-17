import { describe, expect, it } from 'vitest'
import { parseAiLinks, parseAiMessage } from './AiAdvisorPage'

describe('AiAdvisorPage parsing helpers', () => {
  it('parses trip payloads from AI messages', () => {
    const raw = 'Here are ideas. [TRIPS:{"trips":[{"id":1,"title":"Rome"}]}]'
    const result = parseAiMessage(raw)

    expect(result.text).toBe('Here are ideas.')
    expect(result.trips).toEqual([{ id: 1, title: 'Rome' }])
  })

  it('handles partial trip tags gracefully', () => {
    const raw = 'Draft response [TRIPS:'
    const result = parseAiMessage(raw)

    expect(result.text).toBe('Draft response')
    expect(result.trips).toEqual([])
  })

  it('parses link payloads from AI messages', () => {
    const raw = 'Check these. [LINKS:{"links":[{"title":"Guide","url":"https://example.com"}]}]'
    const result = parseAiLinks(raw)

    expect(result.text).toBe('Check these.')
    expect(result.links).toEqual([{ title: 'Guide', url: 'https://example.com' }])
  })
})
