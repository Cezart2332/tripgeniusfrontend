// Coadă locală, persistentă, pentru mesajele de chat trimise cât timp ești offline.
// Se golește la revenirea conexiunii (vezi TripPage), moment în care serverul le
// atribuie timestamp-ul real (ora sincronizării), nu ora la care le-ai scris offline.

export interface PendingChatItem {
  clientId: string
  content: string
  mentionedUserIds: number[]
  createdAt: string
}

const storageKey = (tripId: number | string) => `chat-pending-${tripId}`

export function loadPendingChat(tripId: number | string): PendingChatItem[] {
  try {
    const raw = localStorage.getItem(storageKey(tripId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingChatItem[]) : []
  } catch {
    return []
  }
}

function savePendingChat(tripId: number | string, items: PendingChatItem[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(storageKey(tripId))
    else localStorage.setItem(storageKey(tripId), JSON.stringify(items))
  } catch {
    // storage plin / indisponibil — ignorăm, mesajul rămâne cel puțin în UI
  }
}

export function addPendingChat(tripId: number | string, item: PendingChatItem): void {
  const items = loadPendingChat(tripId)
  items.push(item)
  savePendingChat(tripId, items)
}

export function removePendingChat(tripId: number | string, clientId: string): void {
  const items = loadPendingChat(tripId).filter((i) => i.clientId !== clientId)
  savePendingChat(tripId, items)
}
