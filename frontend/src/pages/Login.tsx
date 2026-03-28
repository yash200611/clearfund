import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { GlassCard } from '@/components/ui/glass-card'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Shield className="w-6 h-6 text-[oklch(0.65_0.25_25)]" />
          <span className="text-xl font-bold text-white">ClearFund</span>
        </div>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-white/50 mb-8">Sign in to your account to continue</p>

          <LiquidButton className="w-full" onClick={() => login()}>
            SIGN IN
          </LiquidButton>

          <p className="mt-6 text-center text-sm text-white/40">
            Don't have an account?{' '}
            <button
              onClick={() => login({ screen_hint: 'signup' })}
              className="text-white/70 hover:text-white underline transition-colors"
            >
              Register
            </button>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
