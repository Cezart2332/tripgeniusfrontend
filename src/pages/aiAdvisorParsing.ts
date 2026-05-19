export interface TripCard {
  title: string
  id: number
  type?: 'trip' | 'offroad'
}

export interface ParsedMessage {
  text: string
  trips: TripCard[]
}

export interface LinkCard {
  title: string
  url: string
}

export function parseAiMessage(raw: string): ParsedMessage {
  // Finds content between [TRIPS: and the trailing ]
  const tripMatch = raw.match(/\[TRIPS:(.*?)\]+\s*$/)

  const partialTagIndex = raw.indexOf('[TRIPS:')
  if (partialTagIndex !== -1 && !tripMatch) {
    return { text: raw.slice(0, partialTagIndex).trim(), trips: [] }
  }

  if (!tripMatch) return { text: raw, trips: [] }

  try {
    // Normalize trailing braces before parsing
    const jsonStr = tripMatch[1].trim().replace(/}+\]$/, '}]').replace(/\}+$/, '}')
    const parsed = JSON.parse(jsonStr)
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: parsed.trips || [] }
  } catch {
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: [] }
  }
}

export function parseAiLinks(raw: string): { text: string; links: LinkCard[] } {
  const linkMatch = raw.match(/\[LINKS:(.*?)\]+\s*$/s)

  const partialTagIndex = raw.indexOf('[LINKS:')
  if (partialTagIndex !== -1 && !linkMatch) {
    return { text: raw.slice(0, partialTagIndex).trim(), links: [] }
  }

  if (!linkMatch) return { text: raw, links: [] }

  try {
    const jsonStr = linkMatch[1].trim()
    const parsed = JSON.parse(jsonStr)
    const text = raw.replace(/\[LINKS:.*$/s, '').trim()
    // Normalize casing — AI may return Title/Url or title/url
    const links = (parsed.links || []).map((l: Record<string, string>) => ({
      title: l.title || l.Title || '',
      url: l.url || l.Url || ''
    })).filter((l: LinkCard) => l.title && l.url)
    return { text, links }
  } catch {
    const text = raw.replace(/\[LINKS:.*$/s, '').trim()
    return { text, links: [] }
  }
}
