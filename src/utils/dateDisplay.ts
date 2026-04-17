const dateLabelFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

const getRawDisplayValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return ''
    }

    return value.toISOString()
  }

  return ''
}

export const parseDisplayDate = (value: unknown): Date | null => {
  const normalizedValue = getRawDisplayValue(value)

  if (!normalizedValue) {
    return null
  }

  const dateOnlyMatch = normalizedValue.match(dateOnlyPattern)
  if (dateOnlyMatch) {
    const [, yearToken, monthToken, dayToken] = dateOnlyMatch
    const year = Number(yearToken)
    const month = Number(monthToken)
    const day = Number(dayToken)
    const parsedDate = new Date(year, month - 1, day)

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return null
    }

    return parsedDate
  }

  const parsedDate = new Date(normalizedValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return parsedDate
}

export const formatDisplayDate = (value: unknown): string => {
  const parsedDate = parseDisplayDate(value)
  if (!parsedDate) {
    const rawValue = getRawDisplayValue(value)
    return rawValue || 'Date unavailable'
  }

  return dateLabelFormatter.format(parsedDate)
}

export const formatDisplayDateRange = (startDate: unknown, endDate: unknown): string =>
  `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`

export const toLocalStartOfDay = (value: unknown): Date | null => {
  const parsedDate = parseDisplayDate(value)
  if (!parsedDate) {
    return null
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  )
}