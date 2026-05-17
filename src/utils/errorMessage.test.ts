import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  asAxiosError,
  getErrorMessage,
  isNetworkError,
  isQueuedRequestError,
} from './errorMessage'

describe('errorMessage', () => {
  it('extracts message from Axios error responses', () => {
    const response = {
      data: { message: 'Bad request' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {},
    }
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', {}, {}, response)

    expect(getErrorMessage(error)).toBe('Bad request')
    expect(asAxiosError(error)).toBe(error)
  })

  it('handles string response payloads and fallback values', () => {
    const response = {
      data: 'Plain failure',
      status: 500,
      statusText: 'Server Error',
      headers: {},
      config: {},
    }
    const error = new AxiosError('Boom', 'ERR_BAD_RESPONSE', {}, {}, response)

    expect(getErrorMessage(error)).toBe('Plain failure')
  })

  it('detects network and queued request errors', () => {
    const networkError = new AxiosError('Network down', 'ERR_NETWORK')
    const canceledError = new AxiosError('Canceled', 'ERR_CANCELED')

    expect(isNetworkError(networkError)).toBe(true)
    expect(isNetworkError(canceledError)).toBe(false)
    expect(isQueuedRequestError({ queued: true })).toBe(true)
  })
})
