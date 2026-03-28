import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Users, Briefcase, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import type { Role } from '@/data/seed'

const ROLES: { value: Role; icon: React.ElementType; label: string; desc: string }[] = [
  { value: 'donor', icon: Users, label: 'Donor', desc: 'Fund campaigns with confidence' },
  { value: 'ngo', icon: Briefcase, label: 'NGO', desc: 'Launch milestone campaigns' },
  { value: 'verifier', icon: CheckSquare, label: 'Verifier', desc: 'Review milestone evidence' },
]

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('donor')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    setLoading(false)
    toast.success('Account created! Please sign in.')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Shield className="w-6 h-6 text-[oklch(0.65_0.25_25)]" />
          <span className="text-xl font-bold text-white">ClearFund</span>
        </div>

        <GlassCard className="p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
          <p className="text-sm text-white/50 mb-8">Join the transparent giving platform</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="Your name"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all text-sm"
              />
            </div>
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

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">I am a...</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ value, icon: Icon, label, desc }) => (
                  <button type="button" key={value}
                    onClick={() => setRole(value)}
                    className={cn(
                      'flex flex-col items-center p-3 rounded-xl border text-center transition-all duration-200',
                      role === value
                        ? 'border-[oklch(0.65_0.25_25)]/50 bg-[oklch(0.65_0.25_25)]/10 shadow-[0_0_20px_rgba(255,100,50,0.08)]'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                    )}>
                    <Icon className={cn('w-5 h-5 mb-1.5', role === value ? 'text-[oklch(0.65_0.25_25)]' : 'text-white/50')} />
                    <span className={cn('text-xs font-semibold', role === value ? 'text-white' : 'text-white/60')}>{label}</span>
                    <span className="text-[10px] text-white/30 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <LiquidButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'CREATE ACCOUNT'}
            </LiquidButton>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="text-white/70 hover:text-white underline transition-colors">Sign in</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
