import { AxiosError, isAxiosError } from 'axios'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const msg = (data as { message?: string }).message
      if (typeof msg === 'string' && msg.length > 0) return msg
    }
    if (typeof data === 'string' && data.length > 0) return data
    return error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return !error.response && error.code !== 'ERR_CANCELED'
  }
  return false
}

export function asAxiosError(error: unknown): AxiosError | null {
  return isAxiosError(error) ? error : null
}

export function isQueuedRequestError(error: unknown): error is { queued: true } {
  return typeof error === 'object' && error !== null && 'queued' in error &&
    Boolean((error as { queued?: boolean }).queued)
}
