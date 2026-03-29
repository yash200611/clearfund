import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Heart,
  Plus,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { CampaignCard } from '@/components/CampaignCard'
import { useAuth } from '@/contexts/AuthContext'
import { donateTransfer, getCampaigns, getMyDonations, getPlatformAnalytics, signPrivyTransfer } from '@/api/client'
import type { Campaign, Donation } from '@/api/client'
import { transferSolToVault } from '@/lib/solanaTransfer'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [investAmount, setInvestAmount] = useState('1')
  const [investing, setInvesting] = useState(false)
  const [investResult, setInvestResult] = useState<{ signature: string; explorerUrl: string } | null>(null)

  const isNGO = user?.role === 'ngo'
  const isDonor = user?.role === 'donor'

  useEffect(() => {
    getCampaigns().then(setCampaigns).catch(() => {})
    if (isDonor) getMyDonations().then(setDonations).catch(() => {})
    getPlatformAnalytics().then((s) => setStats(s as Record<string, unknown>)).catch(() => {})
  }, [isDonor])

  const totalDonated = donations.reduce((s, d) => s + d.amount_sol, 0)
  const totalReleased = donations.reduce((s, d) => s + d.released_sol, 0)
  const totalLocked = donations.reduce((s, d) => s + d.locked_sol, 0)
  const myCampaigns = campaigns.filter((c) => c.ngo_id === user?.id)
  const featuredCampaigns = campaigns.slice(0, 6)
  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'

  const kpis = useMemo(
    () =>
      isDonor
        ? [
            { icon: Wallet, label: 'Capital Deployed', value: `${totalDonated.toFixed(2)} SOL`, hint: 'Lifetime contributions' },
            { icon: TrendingUp, label: 'Verified Impact', value: `${totalReleased.toFixed(2)} SOL`, hint: 'Released after milestones' },
            { icon: Shield, label: 'Escrow Reserve', value: `${totalLocked.toFixed(2)} SOL`, hint: 'Protected in vaults' },
            { icon: Target, label: 'Campaign Bets', value: `${donations.length}`, hint: 'Projects backed' },
          ]
        : [
            { icon: Briefcase, label: 'Campaigns Live', value: `${myCampaigns.length}`, hint: 'Active mission threads' },
            {
              icon: DollarSign,
              label: 'Gross Raised',
              value: `${myCampaigns.reduce((s, c) => s + c.total_raised_sol, 0).toFixed(2)} SOL`,
              hint: 'Across all campaigns',
            },
            {
              icon: TrendingUp,
              label: 'Verification Success',
              value: `${stats?.success_rate ?? '—'}`,
              hint: 'Platform-level approval trend',
            },
            { icon: Users, label: 'Donor Reach', value: `${stats?.total_donors ?? '—'}`, hint: 'Global capital network' },
          ],
    [donations.length, isDonor, myCampaigns, stats, totalDonated, totalLocked, totalReleased],
  )

  const openInvest = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setInvestAmount('1')
    setInvestResult(null)
  }

  const closeInvest = () => {
    if (investing) return
    setSelectedCampaign(null)
    setInvestResult(null)
  }

  const confirmInvest = async () => {
    if (!selectedCampaign) return
    if (!selectedCampaign.vault_address) {
      toast.error('This campaign has no vault address configured')
      return
    }

    const amountSol = parseFloat(investAmount)
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      toast.error('Enter a valid SOL amount')
      return
    }

    setInvesting(true)
    try {
      let txSignature = ''
      let txWalletAddress = ''
      let txExplorerUrl = ''

      if (user?.wallet_address) {
        const tx = await signPrivyTransfer({
          campaign_id: selectedCampaign._id,
          amount_sol: amountSol,
        })
        txSignature = tx.signature
        txWalletAddress = tx.wallet_address
        txExplorerUrl = tx.explorer_url
      } else {
        const tx = await transferSolToVault(selectedCampaign.vault_address, amountSol)
        txSignature = tx.signature
        txWalletAddress = tx.walletAddress
        txExplorerUrl = tx.explorerUrl
      }

      const donation = await donateTransfer({
        campaign_id: selectedCampaign._id,
        amount_sol: amountSol,
        tx_signature: txSignature,
        wallet_address: txWalletAddress,
      })

      setCampaigns((prev) =>
        prev.map((c) =>
          c._id === selectedCampaign._id
            ? { ...c, total_raised_sol: c.total_raised_sol + amountSol, donors_count: (c.donors_count ?? 0) + 1 }
            : c,
        ),
      )
      setDonations((prev) => [donation, ...prev])
      setInvestResult({
        signature: donation.tx_signature ?? donation.solana_tx,
        explorerUrl: donation.explorer_url ?? txExplorerUrl,
      })
      toast.success(`${amountSol} SOL transferred to vault`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
    } finally {
      setInvesting(false)
    }
  }

  return (
    <div className="cf-page space-y-8 pb-9">
      <section className="cf-animate-in grid xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <GlassCard glow className="p-7 md:p-9 relative overflow-hidden">
          <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
          <p className="inline-flex items-center gap-2 cf-chip px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/80 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[oklch(0.65_0.25_25)]" />
            {isDonor ? 'Donor Command Center' : 'NGO Command Center'}
          </p>
          <h2 className="cf-display text-4xl md:text-5xl text-white mt-4 leading-[1.02]">
            Good {greeting}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="text-white/62 mt-4 max-w-xl text-[15px] leading-relaxed">
            {isDonor
              ? 'Track every SOL across escrow, review active opportunities, and deploy capital with milestone confidence.'
              : 'Operate campaigns like a modern fundraising studio with instant visibility into capital, milestones, and reach.'}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            {isNGO ? (
              <LiquidButton size="xl" onClick={() => navigate('/ngo-studio')}>
                <Plus className="w-4 h-4" />
                Launch Campaign
              </LiquidButton>
            ) : (
              <LiquidButton size="xl" onClick={() => navigate('/campaigns')}>
                <Heart className="w-4 h-4" />
                Fund a Campaign
              </LiquidButton>
            )}
            <button
              onClick={() => navigate(isNGO ? '/analytics' : '/my-donations')}
              className="h-12 px-6 rounded-xl border border-white/[0.16] bg-white/[0.05] hover:bg-white/[0.09] text-white text-sm font-semibold flex items-center gap-2 transition-all"
            >
              {isNGO ? <BarChart3 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              {isNGO ? 'View Intelligence' : 'Open Donation Ledger'}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5 md:p-6 cf-animate-in cf-stagger-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-3">Live Snapshot</p>
          <div className="space-y-3">
            {[
              { label: 'Campaigns Active', value: `${campaigns.length}` },
              { label: 'Escrow Mode', value: 'Milestone Locked' },
              { label: 'Risk Tolerance', value: 'Strict' },
              { label: 'Trust Rail', value: `${stats?.success_rate ?? '—'} success` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/[0.11] bg-white/[0.04] px-3 py-2.5">
                <span className="text-xs text-white/55">{row.label}</span>
                <span className="text-sm text-white font-semibold">{row.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ icon: Icon, label, value, hint }, i) => (
          <GlassCard key={label} className="p-5 cf-animate-in" style={{ animationDelay: `${90 + i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">{label}</p>
              <div className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.15] flex items-center justify-center">
                <Icon className="w-4 h-4 text-white/70" />
              </div>
            </div>
            <p className="cf-display text-3xl text-white mt-3">{value}</p>
            <p className="text-xs text-white/48 mt-1">{hint}</p>
          </GlassCard>
        ))}
      </section>

      <section className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <GlassCard className="p-6 cf-animate-in cf-stagger-2" hover={false}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                {isNGO ? 'Your Projects' : 'Capital Opportunities'}
              </p>
              <h3 className="cf-section-title text-2xl text-white mt-1">
                {isNGO ? 'Campaign Control Deck' : 'Featured Campaign Grid'}
              </h3>
            </div>
            <button onClick={() => navigate('/campaigns')} className="text-sm text-white/58 hover:text-white flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {featuredCampaigns.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {featuredCampaigns.slice(0, 4).map((campaign, i) => (
                <div key={campaign._id} className="cf-animate-in" style={{ animationDelay: `${160 + i * 70}ms` }}>
                  <CampaignCard
                    campaign={campaign}
                    actionLabel={isDonor ? 'Invest now' : undefined}
                    onAction={isDonor ? openInvest : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.12] bg-white/[0.03] p-10 text-center">
              <p className="cf-section-title text-2xl text-white/85">No campaigns yet</p>
              <p className="text-sm text-white/45 mt-2">Create one to activate milestone-based fundraising.</p>
              {isNGO && (
                <button
                  onClick={() => navigate('/ngo-studio')}
                  className="mt-5 h-11 px-5 rounded-xl border border-white/[0.2] bg-white/[0.06] text-sm text-white hover:bg-white/[0.1]"
                >
                  Open NGO Studio
                </button>
              )}
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5 cf-animate-in cf-stagger-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="cf-section-title text-xl text-white">{isDonor ? 'Recent Deployments' : 'Ops Feed'}</h3>
              <ArrowUpRight className="w-4 h-4 text-white/55" />
            </div>
            {isDonor && donations.length > 0 ? (
              <div className="space-y-2.5">
                {donations.slice(0, 5).map((d) => (
                  <div key={d._id} className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{d.campaign_title ?? 'Campaign'}</p>
                      <p className="text-[11px] text-white/45">{d.ngo_name ?? 'NGO'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white font-semibold tabular-nums">{d.amount_sol.toFixed(2)} SOL</p>
                      <p className="text-[11px] text-white/40">{d.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/45">
                {isDonor
                  ? 'Your donations will show up here once you deploy funds.'
                  : 'Campaign operations and milestone events will appear here.'}
              </p>
            )}
          </GlassCard>

          <GlassCard className="p-5 cf-animate-in cf-stagger-3">
            <h3 className="cf-section-title text-xl text-white mb-4">Quick Routes</h3>
            <div className="grid gap-2.5">
              {[
                { label: isNGO ? 'Open NGO Studio' : 'Browse Campaigns', path: isNGO ? '/ngo-studio' : '/campaigns' },
                { label: isNGO ? 'View Intelligence' : 'My Donation Ledger', path: isNGO ? '/analytics' : '/my-donations' },
                { label: 'Account Settings', path: '/settings' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="w-full text-left rounded-xl border border-white/[0.11] bg-white/[0.04] px-3.5 py-3 text-sm text-white/72 hover:text-white hover:bg-white/[0.07] transition-all flex items-center justify-between"
                >
                  {item.label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {isDonor && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeInvest} />
          <GlassCard className="relative w-full max-w-lg p-6 border-white/[0.2]">
            <button
              onClick={closeInvest}
              disabled={investing}
              className="absolute top-3 right-3 p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {investResult ? (
              <div className="space-y-4">
                <h3 className="cf-section-title text-2xl text-white">Transfer Confirmed</h3>
                <p className="text-sm text-white/62">
                  Funds were recorded for <span className="text-white font-semibold">{selectedCampaign.title}</span>.
                </p>
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35 mb-1">Transaction Signature</p>
                  <p className="text-xs text-white/70 break-all font-mono">{investResult.signature}</p>
                </div>
                <a
                  href={investResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[oklch(0.65_0.25_25)] hover:text-white"
                >
                  Open in Solana Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={closeInvest} className="w-full h-11 rounded-xl border border-white/[0.18] bg-white/[0.06] text-sm text-white hover:bg-white/[0.1]">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="cf-section-title text-2xl text-white">Deploy Capital</h3>
                <p className="text-sm text-white/60">Send SOL directly to the campaign vault with escrow protections.</p>

                <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/35 mb-1">Target Campaign</p>
                  <p className="text-sm text-white font-semibold">{selectedCampaign.title}</p>
                  <p className="text-[11px] text-white/45 mt-1 break-all">Vault: {selectedCampaign.vault_address ?? 'Not configured'}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50 mb-2 block">Amount (SOL)</label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="cf-soft-input"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {['0.1', '0.5', '1', '2'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setInvestAmount(preset)}
                      className="h-9 rounded-lg border border-white/[0.12] bg-white/[0.04] text-xs text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <button
                  onClick={confirmInvest}
                  disabled={investing || !selectedCampaign.vault_address}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white border border-white/[0.2] bg-[linear-gradient(130deg,rgba(255,109,62,0.92),rgba(56,189,248,0.78))] disabled:opacity-50"
                >
                  {investing ? 'Processing transaction...' : 'Confirm transfer'}
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}
