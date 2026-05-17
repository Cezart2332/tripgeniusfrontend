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
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { BrowserRouter } from 'react-router-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import './adventure.css'
import App from './App.tsx'
import { persistor, store } from './data/store'

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </GoogleOAuthProvider>,
)
