import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, Building2, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { GlassCard } from '@/components/ui/glass-card'

const roles = [
  {
    key: 'donor',
    icon: Users,
    title: 'Donor',
    description: 'Support NGOs and track how your money is used',
  },
  {
    key: 'ngo',
    icon: Building2,
    title: 'NGO',
    description: 'Create campaigns and unlock milestone-based funding',
  },
  {
    key: 'verifier',
    icon: CheckCircle,
    title: 'Verifier',
    description: 'Review evidence and approve milestone completions',
  },
]

export default function Register() {
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
          <span className="text-xl font-bold text-white">Aidex</span>
        </div>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create an account</h1>
          <p className="text-sm text-white/50 mb-6">Choose your role on the platform</p>

          <div className="space-y-3 mb-8">
            {roles.map(({ key, icon: Icon, title, description }) => (
              <div
                key={key}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]"
              >
                <Icon className="w-5 h-5 text-white/60 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-white/40 mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/30 mb-4 text-center">
            Your role is assigned by an admin after registration.
          </p>

          <LiquidButton className="w-full" onClick={() => login({ screen_hint: 'signup' })}>
            CREATE ACCOUNT
          </LiquidButton>

          <p className="mt-6 text-center text-sm text-white/40">
            Already have an account?{' '}
            <button
              onClick={() => login()}
              className="text-white/70 hover:text-white underline transition-colors"
            >
              Sign in
            </button>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
