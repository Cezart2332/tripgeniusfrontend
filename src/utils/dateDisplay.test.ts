import { describe, expect, it } from 'vitest'
import {
  formatDisplayDate,
  formatDisplayDateRange,
  parseDisplayDate,
  toLocalStartOfDay,
} from './dateDisplay'

describe('dateDisplay', () => {
  it('parses date-only strings and rejects invalid dates', () => {
    const valid = parseDisplayDate('2024-02-29')
    expect(valid).not.toBeNull()
    expect(valid?.getFullYear()).toBe(2024)
    expect(valid?.getMonth()).toBe(1)
    expect(valid?.getDate()).toBe(29)

    expect(parseDisplayDate('2024-02-30')).toBeNull()
  })

  it('formats dates using the locale formatter', () => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const expected = formatter.format(new Date(2024, 1, 29))

    expect(formatDisplayDate('2024-02-29')).toBe(expected)
  })

  it('falls back to raw values when formatting fails', () => {
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date')
    expect(formatDisplayDate(null)).toBe('Date unavailable')
  })

  it('formats date ranges and local start-of-day timestamps', () => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const start = new Date(2024, 3, 10)
    const end = new Date(2024, 3, 12)

    expect(formatDisplayDateRange('2024-04-10', '2024-04-12')).toBe(
      `${formatter.format(start)} - ${formatter.format(end)}`,
    )

    const localStart = toLocalStartOfDay('2024-04-10')
    expect(localStart?.getHours()).toBe(0)
    expect(localStart?.getMinutes()).toBe(0)
  })
})
