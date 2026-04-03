import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AiAdvisorPage } from './pages/AiAdvisorPage'
import { CreateTripPage } from './pages/CreateTripPage'
import { DiscoveryPage } from './pages/DiscoveryPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { TripPage } from './pages/TripPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/discover" element={<DiscoveryPage />} />
        <Route path="/create-trip" element={<CreateTripPage />} />
        <Route path="/trip" element={<Navigate replace to="/discover" />} />
        <Route path="/trip/:tripId" element={<TripPage />} />
        <Route path="/ai" element={<AiAdvisorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App
