import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import RoleSelect from '@/pages/RoleSelect'
import Dashboard from '@/pages/Dashboard'
import CampaignsExplorer from '@/pages/CampaignsExplorer'
import CampaignDetail from '@/pages/CampaignDetail'
import MyDonations from '@/pages/MyDonations'
import NGOStudio from '@/pages/NGOStudio'
import VerificationConsole from '@/pages/VerificationConsole'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'

export default function App() {
  const { needsRoleSelection, isLoading } = useAuth()

  // While loading auth state, show nothing to avoid flicker
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // New user — must pick a role before anything else
  if (needsRoleSelection) {
    return <RoleSelect />
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/select-role" element={<RoleSelect />} />

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
