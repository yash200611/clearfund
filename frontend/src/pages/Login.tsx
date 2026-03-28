import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { GlassCard } from '@/components/ui/glass-card'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const ok = await login(email, password)
    setLoading(false)
    if (ok) {
      toast.success('Welcome back!')
      navigate('/dashboard')
    } else {
      toast.error('Invalid credentials. Try donor@test.com / donor123')
    }
  }

  const testCreds = [
    { label: 'Donor', email: 'donor@test.com', pwd: 'donor123' },
    { label: 'NGO', email: 'ngo@test.com', pwd: 'ngo123' },
    { label: 'Verifier', email: 'verifier@test.com', pwd: 'verifier123' },
  ]

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Shield className="w-6 h-6 text-[oklch(0.65_0.25_25)]" />
          <span className="text-xl font-bold text-white">ClearFund</span>
        </div>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-white/50 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all text-sm"
              />
            </div>
            <LiquidButton type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Signing in...' : 'SIGN IN'}
            </LiquidButton>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-3">Test Credentials</p>
            <div className="grid grid-cols-3 gap-2">
              {testCreds.map(c => (
                <button key={c.label}
                  onClick={() => { setEmail(c.email); setPassword(c.pwd) }}
                  className="text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl px-2 py-2 text-white/50 hover:text-white hover:bg-white/[0.07] transition-all">
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-white/40">
            Don't have an account?{' '}
            <Link to="/register" className="text-white/70 hover:text-white underline transition-colors">Register</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
