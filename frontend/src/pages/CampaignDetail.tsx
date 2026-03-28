import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Users, Shield, Clock, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { EscrowProgressBar } from '@/components/EscrowProgressBar'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { getCampaignById, getMilestones, makeDonation, getCampaignActivity } from '@/api/client'
import type { Campaign, Milestone } from '@/data/seed'
import { ACTIVITY_FEED } from '@/data/seed'

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [amount, setAmount] = useState('100')
  const [donating, setDonating] = useState(false)
  const [activity, setActivity] = useState(ACTIVITY_FEED)

  useEffect(() => {
    if (!id) return
    getCampaignById(id).then(c => setCampaign(c ?? null))
    getMilestones(id).then(setMilestones)
    getCampaignActivity(id).then(setActivity)
  }, [id])

  const handleDonate = async () => {
    if (!campaign || !amount) return
    setDonating(true)
    await makeDonation(campaign.id, Number(amount))
    setDonating(false)
    toast.success(`$${amount} donated to "${campaign.title}"! Funds are now in escrow.`)
    setAmount('100')
  }

  if (!campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
      </div>
    )
  }

  const pct = Math.round((campaign.total_raised / campaign.goal) * 100)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden">
        <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover" />
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
          { label: 'Goal', value: `$${campaign.goal.toLocaleString()}` },
          { label: 'Raised', value: `$${campaign.total_raised.toLocaleString()}` },
          { label: 'Released', value: `$${campaign.released.toLocaleString()}` },
          { label: 'Donors', value: String(campaign.donors_count) },
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

          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Milestone Roadmap</h2>
            <MilestoneTimeline milestones={milestones} />
          </GlassCard>
        </div>

        {/* Right — Donate + Risk + Activity */}
        <div className="space-y-4 lg:sticky lg:top-6 self-start">
          <GlassCard className="p-6">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Progress</span>
                <span className="font-semibold text-white">{pct}%</span>
              </div>
              <EscrowProgressBar goal={campaign.goal} released={campaign.released} locked={campaign.locked} refunded={campaign.refunded} />
              <div className="flex justify-between text-xs text-white/40 mt-2">
                <span>Released: ${campaign.released.toLocaleString()}</span>
                <span>Locked: ${campaign.locked.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Donation Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1"
                  className="w-full pl-8 pr-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['25', '50', '100', '250'].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:bg-white/[0.08] hover:text-white transition-all">
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            <LiquidButton className="w-full" onClick={handleDonate} disabled={donating}>
              {donating ? 'Processing...' : 'DONATE NOW'}
            </LiquidButton>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40">
              <Shield className="w-3 h-3" />
              Funds held in escrow · Auto-refund if failed
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
                <span className={campaign.failure_count > 0 ? 'text-amber-400 font-semibold' : 'text-white font-semibold'}>{campaign.failure_count}/3</span>
              </div>
              <div className="flex justify-between">
                <span>Since</span>
                <span className="text-white font-semibold">{campaign.created_at}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Donors</span>
                <span className="text-white font-semibold">{campaign.donors_count}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-white/50" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {activity.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-start gap-2">
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
        </div>
      </div>
    </div>
  )
}
