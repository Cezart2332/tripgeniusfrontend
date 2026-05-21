import type { HubConnection } from '@microsoft/signalr'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatMessage } from '../types/models'

type RejectedPayload = { messageId: number; message?: string }

function matchesMessageId(messageId: string, removedId: number): boolean {
  return String(messageId) === String(removedId)
}

export function registerChatModerationEvents(
  connection: HubConnection,
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  onRejected?: (payload: RejectedPayload) => void,
) {
  connection.on('MessageRemoved', (messageId: number) => {
    setChatMessages((prev) => prev.filter((m) => !matchesMessageId(m.id, messageId)))
  })

  connection.on('MessageRejected', (payload: RejectedPayload) => {
    setChatMessages((prev) => prev.filter((m) => !matchesMessageId(m.id, payload.messageId)))
    onRejected?.(payload)
  })
}
