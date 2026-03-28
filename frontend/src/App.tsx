import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import CampaignsExplorer from '@/pages/CampaignsExplorer'
import CampaignDetail from '@/pages/CampaignDetail'
import MyDonations from '@/pages/MyDonations'
import NGOStudio from '@/pages/NGOStudio'
import VerificationConsole from '@/pages/VerificationConsole'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<CampaignsExplorer />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route
          path="/my-donations"
          element={
            <ProtectedRoute roles={['donor']}>
              <MyDonations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo-studio"
          element={
            <ProtectedRoute roles={['ngo']}>
              <NGOStudio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute roles={['verifier']}>
              <VerificationConsole />
            </ProtectedRoute>
          }
        />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
