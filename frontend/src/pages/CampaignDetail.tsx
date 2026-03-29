import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, Clock, Activity, ExternalLink, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { useAuth } from '@/contexts/AuthContext'
import { getCampaignById, getMilestones, getCampaignActivity, donateTransfer } from '@/api/client'
import type { Campaign, Milestone } from '@/api/client'
import { transferSolToVault } from '@/lib/solanaTransfer'

interface ActivityItem { id: string; type: string; message: string; time: string }

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [amount, setAmount] = useState('1')
  const [donating, setDonating] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  // Post-donation success state
  const [txResult, setTxResult] = useState<{ signature: string; explorerUrl: string; amount: number } | null>(null)

  useEffect(() => {
    if (!id) return
    getCampaignById(id).then(setCampaign).catch(() => {})
    getMilestones(id).then(setMilestones).catch(() => {})
    getCampaignActivity(id).then(items => setActivity(items as ActivityItem[])).catch(() => {})
  }, [id])

  const handleDonate = async () => {
    if (!campaign || !id) return
    const sol = parseFloat(amount)
    if (isNaN(sol) || sol <= 0) {
      toast.error('Enter a valid SOL amount')
      return
    }
    if (!campaign.vault_address) {
      toast.error('This campaign has no vault address configured')
      return
    }

    setDonating(true)
    setTxResult(null)
    try {
      const tx = await transferSolToVault(campaign.vault_address, sol)
      const result = await donateTransfer({
        campaign_id: id,
        amount_sol: sol,
        tx_signature: tx.signature,
        wallet_address: tx.walletAddress,
      })
      setTxResult({
        signature: result.tx_signature ?? result.solana_tx,
        explorerUrl: result.explorer_url ?? tx.explorerUrl,
        amount: sol,
      })
      // Update local campaign state
      setCampaign(prev => prev ? {
        ...prev,
        total_raised_sol: prev.total_raised_sol + sol,
        donors_count: (prev.donors_count ?? 0) + 1,
      } : prev)
      toast.success(`${sol} SOL donated successfully!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Donation failed'
      toast.error(msg)
    } finally {
      setDonating(false)
    }
  }

  if (!campaign) {
    return (
      <div className="cf-page max-w-6xl">
        <div className="h-64 rounded-3xl bg-white/[0.03] border border-white/[0.08] animate-pulse" />
      </div>
    )
  }

  const raised = campaign.total_raised_sol
  const goal = campaign.goal ?? 0
  const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0
  const isDonor = user?.role === 'donor'

  return (
    <div className="cf-page max-w-6xl space-y-6">
      {/* Hero */}
      <div className="cf-animate-in relative h-64 md:h-80 rounded-[2rem] overflow-hidden border border-white/[0.08]">
        {campaign.image ? (
          <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[linear-gradient(145deg,rgba(255,87,34,0.2),rgba(255,255,255,0.04),rgba(0,229,255,0.12))] flex items-center justify-center">
            <span className="cf-display text-6xl text-white/40">{campaign.category?.[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <StatusBadge status={campaign.status} />
            <TrustBadge score={campaign.trust_score} />
            <RiskBadge failureCount={campaign.failure_count} />
          </div>
          <h1 className="cf-display text-3xl md:text-4xl text-white">{campaign.title}</h1>
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
        ].map(({ label, value }, i) => (
          <GlassCard key={label} className="p-4 text-center cf-animate-in" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <p className="cf-display text-xl font-black text-white tabular-nums">{value}</p>
            <p className="text-xs text-white/42 uppercase tracking-[0.14em] font-semibold mt-0.5">{label}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Description + Milestones */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6 cf-animate-in cf-stagger-2">
            <h2 className="cf-section-title text-2xl font-semibold text-white mb-3">About this Campaign</h2>
            <p className="text-sm text-white/60 leading-relaxed">{campaign.description}</p>
          </GlassCard>

          {milestones.length > 0 && (
            <GlassCard className="p-6 cf-animate-in cf-stagger-3">
              <h2 className="cf-section-title text-2xl font-semibold text-white mb-6">Milestone Roadmap</h2>
              <MilestoneTimeline milestones={milestones} />
            </GlassCard>
          )}
        </div>

        {/* Right — Donate + Risk + Activity */}
        <div className="space-y-4 lg:sticky lg:top-6 self-start">
          {/* Donation Card */}
          <GlassCard className="p-6 cf-animate-in cf-stagger-2">
            {/* Success state */}
            {txResult ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                  <Check className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h3 className="cf-section-title text-2xl font-bold text-white">Donation Successful!</h3>
                  <p className="text-sm text-white/50 mt-1">{txResult.amount} SOL sent to escrow vault</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">Transaction</p>
                  <p className="text-xs text-white/60 font-mono break-all">{txResult.signature}</p>
                </div>
                <a
                  href={txResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[oklch(0.65_0.25_25)] hover:text-white transition-colors"
                >
                  View on Solana Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="pt-2">
                  <MetalButton className="w-full" onClick={() => setTxResult(null)}>
                    Make Another Donation
                  </MetalButton>
                </div>
              </div>
            ) : (
              <>
                {goal > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/60">Progress</span>
                      <span className="font-semibold text-white">{pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[linear-gradient(90deg,oklch(0.65_0.25_25),oklch(0.74_0.19_71))] rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-white/40 mt-2">
                      <span>{raised.toFixed(2)} SOL raised</span>
                      <span>of {goal} SOL</span>
                    </div>
                  </div>
                )}

                {isDonor ? (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Amount (SOL)</label>
                      <input
                        type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.1"
                        className="cf-soft-input"
                      />
                      <div className="flex gap-2 mt-2">
                        {['0.1', '0.5', '1', '5'].map(v => (
                          <button key={v} onClick={() => setAmount(v)}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:bg-white/[0.08] hover:text-white transition-all">
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!campaign.vault_address && (
                      <div className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-300/80">This campaign is missing a vault address. Donation is disabled.</p>
                      </div>
                    )}

                    <LiquidButton className="w-full" onClick={handleDonate} disabled={donating || !campaign.vault_address}>
                      {donating ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending Transaction...
                        </div>
                      ) : (
                        'DONATE NOW'
                      )}
                    </LiquidButton>

                    <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40">
                      <Shield className="w-3 h-3" />
                      Solana escrow · Auto-refund on failure
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-white/50">Sign in as a donor to contribute to this campaign.</p>
                  </div>
                )}
              </>
            )}
          </GlassCard>

          <GlassCard className="p-5 cf-animate-in cf-stagger-3">
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
            <GlassCard className="p-5 cf-animate-in cf-stagger-4">
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
