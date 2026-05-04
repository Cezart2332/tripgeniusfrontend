import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from './components/AppLayout'
import { AiAdvisorPage } from './pages/AiAdvisorPage'
import { AddTimelinePage } from './pages/AddTimelinePage'
import { CreateTripPage } from './pages/CreateTripPage'
import { DiscoveryPage } from './pages/DiscoveryPage'
import { EditTimelinePage } from './pages/EditTimelinePage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { ProfileInvitesPage } from './pages/ProfileInvitesPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { TripPage } from './pages/TripPage'
import { NavigationPage } from './pages/NavigationPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { isReallyOnline, flushQueue } from './data/api'

function App() {


  useEffect(() => {
    isReallyOnline().then(online => {
      if (online) flushQueue()
    })
  }, [])
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<DiscoveryPage />} />
        <Route path="discover" element={<Navigate replace to="/app" />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/invites" element={<ProfileInvitesPage />} />
        <Route path="create-trip" element={<CreateTripPage />} />
        <Route path="add-timeline/:tripId" element={<AddTimelinePage />} />
        <Route path="edit-timeline/:tripId/:id" element={<EditTimelinePage />} />
        <Route path="trip" element={<Navigate replace to="/app/discover" />} />
        <Route path="trip/:tripId" element={<TripPage />} />
        <Route path="ai" element={<AiAdvisorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/navigation/:tripId/:day" element={<NavigationPage />} />

      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App
