import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, AlertTriangle, Check, ExternalLink, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { StatusBadge } from '@/components/StatusBadge'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { useAuth } from '@/contexts/AuthContext'
import { getCampaignById, getMilestones, getCampaignActivity, donateTransfer, signTransfer } from '@/api/client'
import type { Campaign, Milestone } from '@/api/client'
import { transferSolToVault } from '@/lib/solanaTransfer'

interface ActivityItem {
  id: string
  type: string
  message: string
  time: string
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [amount, setAmount] = useState('1')
  const [donating, setDonating] = useState(false)
  const [txResult, setTxResult] = useState<{ signature: string; explorerUrl: string; amount: number } | null>(null)

  useEffect(() => {
    if (!id) return
    getCampaignById(id).then(setCampaign).catch(() => {})
    getMilestones(id).then(setMilestones).catch(() => {})
    getCampaignActivity(id).then((items) => setActivity(items as ActivityItem[])).catch(() => {})
  }, [id])

  const handleDonate = async () => {
    if (!campaign || !id) return

    const sol = parseFloat(amount)
    if (!Number.isFinite(sol) || sol <= 0) {
      toast.error('Enter a valid SOL amount')
      return
    }
    if (!campaign.vault_address) {
      toast.error('This campaign has no vault address configured')
      return
    }
    if (campaign.status !== 'active') {
      toast.error('This campaign is still under review and not accepting donations yet')
      return
    }

    setDonating(true)
    setTxResult(null)
    try {
      let txSignature = ''
      let txWalletAddress = ''
      let txExplorerUrl = ''

      const isLocalnet = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) === 'localnet'

      if (user?.wallet_address || isLocalnet) {
        if (!user?.wallet_address) {
          toast.error('Wallet not provisioned yet. Please wait a moment and try again.')
          return
        }
        const tx = await signTransfer({
          campaign_id: id,
          amount_sol: sol,
        })
        txSignature = tx.signature
        txWalletAddress = tx.wallet_address
        txExplorerUrl = tx.explorer_url
      } else {
        const tx = await transferSolToVault(campaign.vault_address, sol)
        txSignature = tx.signature
        txWalletAddress = tx.walletAddress
        txExplorerUrl = tx.explorerUrl
      }

      const result = await donateTransfer({
        campaign_id: id,
        amount_sol: sol,
        tx_signature: txSignature,
        wallet_address: txWalletAddress,
      })
      setTxResult({
        signature: result.tx_signature ?? result.solana_tx,
        explorerUrl: result.explorer_url ?? txExplorerUrl,
        amount: sol,
      })
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              total_raised_sol: prev.total_raised_sol + sol,
              donors_count: (prev.donors_count ?? 0) + 1,
            }
          : prev,
      )
      toast.success(`${sol} SOL donated successfully`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Donation failed')
    } finally {
      setDonating(false)
    }
  }

  if (!campaign) {
    return (
      <div className="cf-page max-w-6xl">
        <div className="h-64 rounded-3xl border border-white/[0.12] bg-white/[0.03] animate-pulse" />
      </div>
    )
  }

  const raised = campaign.total_raised_sol
  const goal = campaign.total_budget_sol ?? campaign.goal ?? 0
  const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0
  const isDonor = user?.role === 'donor'
  const budgetBreakdown = campaign.budget_breakdown ?? []
  const slashHistory = campaign.slash_history ?? []

  return (
    <div className="cf-page max-w-6xl space-y-6 pb-10">
      <div className="cf-animate-in relative h-72 md:h-80 rounded-[2rem] overflow-hidden border border-white/[0.12]">
        {campaign.image ? (
          <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[linear-gradient(145deg,rgba(255,109,62,0.35),rgba(255,255,255,0.04),rgba(56,189,248,0.2))] flex items-center justify-center">
            <span className="cf-display text-7xl text-white/55">{campaign.category?.[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <StatusBadge status={campaign.status} />
            <TrustBadge score={campaign.trust_score} />
            <RiskBadge failureCount={campaign.failure_count} />
          </div>
          <h1 className="cf-display text-4xl md:text-5xl text-white leading-[1.02]">{campaign.title}</h1>
          <p className="text-white/65 text-sm mt-2">
            by {campaign.ngo_name} · {campaign.category}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Goal', value: goal > 0 ? `${goal} SOL` : 'Open' },
          { label: 'Raised', value: `${raised.toFixed(2)} SOL` },
          { label: 'Milestones', value: `${milestones.length}` },
          { label: 'Donors', value: campaign.donors_count != null ? `${campaign.donors_count}` : '—' },
        ].map((card, i) => (
          <GlassCard key={card.label} className="p-4 text-center cf-animate-in" style={{ animationDelay: `${90 + i * 60}ms` }}>
            <p className="cf-display text-2xl text-white">{card.value}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42 mt-1">{card.label}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="space-y-4">
          <GlassCard className="p-6 cf-animate-in cf-stagger-2">
            <h2 className="cf-section-title text-2xl text-white mb-3">Campaign Narrative</h2>
            <p className="text-sm text-white/62 leading-relaxed">{campaign.description}</p>

            {budgetBreakdown.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-[0.14em] text-white/42 mb-3">Budget Breakdown</h3>
                <div className="space-y-2">
                  {budgetBreakdown.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2">
                      <span className="text-sm text-white/78">{item.name}</span>
                      <span className="text-sm text-white font-semibold">{Number(item.amount_sol).toFixed(2)} SOL</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          {milestones.length > 0 && (
            <GlassCard className="p-6 cf-animate-in cf-stagger-3">
              <h2 className="cf-section-title text-2xl text-white mb-6">Milestone Roadmap</h2>
              <MilestoneTimeline milestones={milestones} />
            </GlassCard>
          )}
        </div>

        <div className="space-y-4">
          <GlassCard className="p-6 cf-animate-in cf-stagger-2">
            {txResult ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/18 flex items-center justify-center mx-auto">
                  <Check className="w-7 h-7 text-emerald-300" />
                </div>
                <h3 className="cf-section-title text-2xl text-white">Donation Successful</h3>
                <p className="text-sm text-white/58">{txResult.amount} SOL transferred to escrow vault.</p>
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-3 text-left">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-1">Transaction Signature</p>
                  <p className="text-xs text-white/70 font-mono break-all">{txResult.signature}</p>
                </div>
                <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[oklch(0.65_0.25_25)] hover:text-white">
                  View in Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <>
                {goal > 0 && (
                  <div className="mb-5">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/58">Funding Progress</span>
                      <span className="text-white">{pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,109,62,0.96),rgba(56,189,248,0.82))]" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="text-xs text-white/44 mt-2">
                      {raised.toFixed(2)} SOL of {goal} SOL
                    </div>
                  </div>
                )}

                {isDonor ? (
                  <>
                    <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Amount (SOL)</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.01" step="0.1" className="cf-soft-input" />
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {['0.1', '0.5', '1', '5'].map((preset) => (
                        <button key={preset} onClick={() => setAmount(preset)} className="h-9 rounded-lg border border-white/[0.12] bg-white/[0.04] text-xs text-white/70 hover:bg-white/[0.08] hover:text-white transition-all">
                          {preset}
                        </button>
                      ))}
                    </div>

                    {!campaign.vault_address && (
                      <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                        <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-200/85">This campaign has no vault address configured. Donations are disabled.</p>
                      </div>
                    )}
                    {campaign.status !== 'active' && (
                      <div className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-300/80">Campaign is under review. Donations unlock after approval.</p>
                      </div>
                    )}

                    <div className="mt-4">
                      <LiquidButton className="w-full" onClick={handleDonate} disabled={donating || !campaign.vault_address || campaign.status !== 'active'}>
                        {donating ? 'Processing transaction...' : 'Donate to Escrow'}
                      </LiquidButton>
                    </div>
                    <p className="text-xs text-white/42 mt-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Auto-refund if milestones fail verification.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/55">Sign in as a donor to contribute to this campaign.</p>
                )}
              </>
            )}
          </GlassCard>

          <GlassCard className="p-5 cf-animate-in cf-stagger-3">
            <h3 className="cf-section-title text-xl text-white mb-3">Risk Brief</h3>
            <div className="space-y-2 text-xs text-white/56">
              <div className="flex justify-between">
                <span>Trust Score</span>
                <span className="text-white">{campaign.trust_score}%</span>
              </div>
              <div className="flex justify-between">
                <span>Failure Count</span>
                <span className="text-white">{campaign.failure_count}/3</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-white">{campaign.created_at?.slice(0, 10)}</span>
              </div>
            </div>
          </GlassCard>

          {slashHistory.length > 0 && (
            <GlassCard className="p-5 cf-animate-in cf-stagger-3">
              <h3 className="cf-section-title text-xl text-white mb-3">Slash History</h3>
              <div className="space-y-2.5">
                {slashHistory.slice().reverse().map((event, idx) => (
                  <div key={`${event.milestone_id}-${idx}`} className="rounded-xl border border-red-400/25 bg-red-500/10 p-3">
                    <p className="text-xs text-red-200/90">
                      Milestone {event.milestone_id.slice(0, 8)}... slashed by {event.percentage_slashed}%
                    </p>
                    <p className="text-[11px] text-red-100/75 mt-1">{event.reason}</p>
                    <p className="text-[11px] text-red-100/60 mt-1">{event.timestamp?.slice(0, 19).replace('T', ' ')}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {activity.length > 0 && (
            <GlassCard className="p-5 cf-animate-in cf-stagger-4">
              <h3 className="cf-section-title text-xl text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-white/70" />
                Recent Activity
              </h3>
              <div className="space-y-2.5">
                {activity.slice(0, 4).map((a, i) => (
                  <div key={a.id ?? i} className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-sm text-white/78">{a.message}</p>
                    <p className="text-[11px] text-white/42 mt-1">{a.time}</p>
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
