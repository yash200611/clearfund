import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { AppUser } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: AppUser['role'][]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, login } = useAuth()
  const location = useLocation()
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirectingRef.current) {
      redirectingRef.current = true
      login({ returnTo: `${location.pathname}${location.search}${location.hash}` })
    }
    if (isAuthenticated) {
      redirectingRef.current = false
    }
  }, [isLoading, isAuthenticated, login, location.pathname, location.search, location.hash])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (roles && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
