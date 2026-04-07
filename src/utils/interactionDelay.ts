export const BACKEND_BUTTON_UNLOCK_DELAY_MS = 1000

export const waitForBackendButtonUnlock = async (
  delayMs = BACKEND_BUTTON_UNLOCK_DELAY_MS,
): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })

export default waitForBackendButtonUnlock
