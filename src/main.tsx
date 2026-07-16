import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    check()
    setInterval(check, 60 * 60 * 1000)
  },
})
// iOS Safari ignores user-scalable=0 in the browser, so page pinch-zoom must be
// blocked manually for the app to feel native. Pinch inside MapLibre maps stays
// enabled — the map canvas handles its own touch gestures.
for (const gestureEvent of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(
    gestureEvent,
    (e) => {
      if ((e.target as Element | null)?.closest?.('.maplibregl-map')) return
      e.preventDefault()
    },
    { passive: false },
  )
}

import { GoogleOAuthProvider } from '@react-oauth/google'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import 'maplibre-gl/dist/maplibre-gl.css'
import GlobalStyles from './styles/globalStyles'
import theme from './styles/theme'
import App from './App.tsx'
import { persistor, store } from './data/store'

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <GlobalStyles />
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </GoogleOAuthProvider>,
)
