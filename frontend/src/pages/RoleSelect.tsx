import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Heart, Building2, ChevronRight } from 'lucide-react'
import { MeshGradient } from '@paper-design/shaders-react'
import { useAuth } from '@/contexts/AuthContext'

export default function RoleSelect() {
  const { setRole, user } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<'donor' | 'ngo' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      await setRole(selected)
      navigate('/dashboard', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const roles = [
    {
      key: 'donor' as const,
      icon: Heart,
      title: 'Donor',
      subtitle: 'I want to fund campaigns',
      description:
        'Support verified NGO projects with SOL. Every rupee is held in escrow and only released when AI confirms real-world milestones are met.',
      perks: ['Full donation transparency', 'Automatic refunds if NGO fails', 'Real-time milestone tracking'],
    },
    {
      key: 'ngo' as const,
      icon: Building2,
      title: 'NGO',
      subtitle: 'I represent an organization',
      description:
        'Create campaigns, define milestones, and submit evidence. Our AI agent verifies your work independently before funds are released.',
      perks: ['Launch milestone-based campaigns', 'AI-powered evidence verification', 'On-chain fund release'],
    },
  ]

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <MeshGradient
          className="w-full h-full"
          colors={['#000000', '#1a1a1a', '#333333', '#ffffff']}
          speed={0.6}
        />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <Shield className="w-6 h-6 text-[oklch(0.65_0.25_25)]" />
            <span className="text-xl font-bold text-white">Aidex</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            How will you use<br />Aidex?
          </h1>
          <p className="text-white/50 text-base">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Choose your role to get started.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {roles.map(({ key, icon: Icon, title, subtitle, description, perks }) => {
            const isSelected = selected === key
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`
                  relative text-left rounded-3xl p-7 transition-all duration-300 outline-none
                  border backdrop-blur-xl
                  ${isSelected
                    ? 'bg-white/15 border-white/40 shadow-[0_0_40px_rgba(255,255,255,0.08)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}
                `}
              >
                {/* Selected ring */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-3xl ring-2 ring-white/30 pointer-events-none" />
                )}

                <div className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center mb-5
                  ${isSelected ? 'bg-white/20' : 'bg-white/8'}
                `}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h2 className="text-xl font-bold text-white mb-0.5">{title}</h2>
                <p className="text-sm text-white/50 mb-4">{subtitle}</p>
                <p className="text-sm text-white/60 leading-relaxed mb-5">{description}</p>

                <ul className="space-y-2">
                  {perks.map(perk => (
                    <li key={perk} className="flex items-center gap-2 text-xs text-white/50">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-white/70' : 'bg-white/30'}`} />
                      {perk}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Continue button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={!selected || loading}
            className={`
              flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-base transition-all duration-300
              ${selected && !loading
                ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.15)] cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'}
            `}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Continue as {selected ? (selected === 'donor' ? 'Donor' : 'NGO') : '...'}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
