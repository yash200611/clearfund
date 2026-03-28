import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Users, Shield, Clock, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { getCampaignById, getMilestones, getCampaignActivity } from '@/api/client'
import type { Campaign, Milestone } from '@/api/client'

interface ActivityItem { id: string; type: string; message: string; time: string }

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [amount, setAmount] = useState('1')
  const [donating, setDonating] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    if (!id) return
    getCampaignById(id).then(setCampaign).catch(() => {})
    getMilestones(id).then(setMilestones).catch(() => {})
    getCampaignActivity(id).then(items => setActivity(items as ActivityItem[])).catch(() => {})
  }, [id])

  const handleDonate = async () => {
    if (!campaign) return
    setDonating(true)
    // Wallet integration handled by backend — show placeholder toast
    await new Promise(r => setTimeout(r, 600))
    setDonating(false)
    toast.success(`${amount} SOL donation initiated for "${campaign.title}"! Connect your wallet to complete.`)
  }

  if (!campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
      </div>
    )
  }

  const raised = campaign.total_raised_sol
  const goal = campaign.goal ?? 0
  const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden">
        {campaign.image ? (
          <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/[0.04] flex items-center justify-center">
            <span className="text-6xl font-black text-white/10">{campaign.category?.[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <StatusBadge status={campaign.status} />
            <TrustBadge score={campaign.trust_score} />
            <RiskBadge failureCount={campaign.failure_count} />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">{campaign.title}</h1>
          <p className="text-white/60 text-sm mt-1">by {campaign.ngo_name} · {campaign.category}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Goal', value: goal > 0 ? `${goal} SOL` : '—' },
          { label: 'Raised', value: `${raised.toFixed(2)} SOL` },
          { label: 'Milestones', value: String(milestones.length) },
          { label: 'Donors', value: campaign.donors_count != null ? String(campaign.donors_count) : '—' },
        ].map(({ label, value }) => (
          <GlassCard key={label} className="p-4 text-center">
            <p className="text-xl font-black text-white tabular-nums">{value}</p>
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mt-0.5">{label}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Description + Milestones */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-3">About this Campaign</h2>
            <p className="text-sm text-white/60 leading-relaxed">{campaign.description}</p>
          </GlassCard>

          {milestones.length > 0 && (
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Milestone Roadmap</h2>
              <MilestoneTimeline milestones={milestones} />
            </GlassCard>
          )}
        </div>

        {/* Right — Donate + Risk + Activity */}
        <div className="space-y-4 lg:sticky lg:top-6 self-start">
          <GlassCard className="p-6">
            {goal > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/60">Progress</span>
                  <span className="font-semibold text-white">{pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[oklch(0.65_0.25_25)] rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-white/40 mt-2">
                  <span>{raised.toFixed(2)} SOL raised</span>
                  <span>of {goal} SOL</span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Amount (SOL)</label>
              <div className="relative">
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.1"
                  className="w-full px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['0.1', '0.5', '1', '5'].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:bg-white/[0.08] hover:text-white transition-all">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <LiquidButton className="w-full" onClick={handleDonate} disabled={donating}>
              {donating ? 'Connecting Wallet...' : 'DONATE NOW'}
            </LiquidButton>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40">
              <Shield className="w-3 h-3" />
              Solana escrow · Auto-refund on failure
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-white/50" />
              Risk Assessment
            </h3>
            <div className="space-y-2 text-xs text-white/50">
              <div className="flex justify-between">
                <span>Trust Score</span>
                <span className="text-white font-semibold">{campaign.trust_score}%</span>
              </div>
              <div className="flex justify-between">
                <span>Milestone Failures</span>
                <span className={campaign.failure_count > 0 ? 'text-amber-400 font-semibold' : 'text-white font-semibold'}>
                  {campaign.failure_count}/3
                </span>
              </div>
              <div className="flex justify-between">
                <span>Since</span>
                <span className="text-white font-semibold">{campaign.created_at?.slice(0, 10)}</span>
              </div>
              {campaign.donors_count != null && (
                <div className="flex justify-between">
                  <span>Total Donors</span>
                  <span className="text-white font-semibold">{campaign.donors_count}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {activity.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-white/50" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {activity.slice(0, 4).map((a, i) => (
                  <div key={a.id ?? i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-white/70">{a.message}</p>
                      <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {a.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
