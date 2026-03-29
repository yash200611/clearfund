import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Shield, Users,
  ChevronRight, Briefcase, Heart, Plus, Wallet,
  BarChart3, Clock, ExternalLink, X
} from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { CampaignCard } from '@/components/CampaignCard'
import { useAuth } from '@/contexts/AuthContext'
import { donateTransfer, getCampaigns, getMyDonations, getPlatformAnalytics } from '@/api/client'
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
    getPlatformAnalytics().then(s => setStats(s as Record<string, unknown>)).catch(() => {})
  }, [isDonor])

  const totalDonated = donations.reduce((s, d) => s + d.amount_sol, 0)
  const totalReleased = donations.reduce((s, d) => s + d.released_sol, 0)
  const totalLocked = donations.reduce((s, d) => s + d.locked_sol, 0)

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'

  const donorStats = [
    { icon: DollarSign, label: 'Total Donated', value: `${totalDonated.toFixed(2)} SOL`, sub: 'Lifetime giving' },
    { icon: TrendingUp, label: 'Released to NGOs', value: `${totalReleased.toFixed(2)} SOL`, sub: 'Impact delivered' },
    { icon: Shield, label: 'In Escrow', value: `${totalLocked.toFixed(2)} SOL`, sub: 'Protected funds' },
    { icon: Users, label: 'Campaigns Backed', value: String(donations.length), sub: 'Supported projects' },
  ]

  const ngoStats = [
    { icon: Briefcase, label: 'My Campaigns', value: String(campaigns.filter(c => c.ngo_id === user?.id).length), sub: 'Active projects' },
    { icon: DollarSign, label: 'Total Raised', value: `${campaigns.filter(c => c.ngo_id === user?.id).reduce((s, c) => s + c.total_raised_sol, 0).toFixed(2)} SOL`, sub: 'Across all campaigns' },
    { icon: TrendingUp, label: 'Success Rate', value: (stats?.success_rate as string) ?? '—', sub: 'Milestones verified' },
    { icon: Users, label: 'Total Donors', value: String(stats?.total_donors ?? '—'), sub: 'Global community' },
  ]

  const statCards = isDonor ? donorStats : ngoStats

  // NGO sees their own campaigns, donor sees all featured
  const myCampaigns = isNGO ? campaigns.filter(c => c.ngo_id === user?.id) : []
  const featuredCampaigns = campaigns.slice(0, 3)

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
      const tx = await transferSolToVault(selectedCampaign.vault_address, amountSol)
      const donation = await donateTransfer({
        campaign_id: selectedCampaign._id,
        amount_sol: amountSol,
        tx_signature: tx.signature,
        wallet_address: tx.walletAddress,
      })

      setCampaigns(prev => prev.map(c => (
        c._id === selectedCampaign._id
          ? { ...c, total_raised_sol: c.total_raised_sol + amountSol, donors_count: (c.donors_count ?? 0) + 1 }
          : c
      )))
      setDonations(prev => [donation, ...prev])
      setInvestResult({
        signature: donation.tx_signature ?? donation.solana_tx,
        explorerUrl: donation.explorer_url ?? tx.explorerUrl,
      })
      toast.success(`${amountSol} SOL sent to campaign vault`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transfer failed'
      toast.error(msg)
    } finally {
      setInvesting(false)
    }
  }

  return (
    <div className="cf-page space-y-10">
      {/* ── Hero greeting ── */}
      <div className="cf-animate-in relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[linear-gradient(138deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_60%)] backdrop-blur-[28px] p-7 md:p-10">
        <div className="absolute top-0 right-0 w-[440px] h-[440px] rounded-full bg-[oklch(0.65_0.25_25)]/[0.08] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 right-[10%] w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.17em] text-white/55 bg-white/[0.05] border border-white/[0.14] px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
              {isNGO ? 'NGO Dashboard' : 'Donor Dashboard'}
            </div>
            <h1 className="cf-display text-3xl md:text-5xl text-white leading-tight mb-2">
              Good {greeting}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-base text-white/65 max-w-lg">
              {isNGO
                ? 'Manage your campaigns, track milestones, and see your impact grow in real time.'
                : "Here's what's happening with your donations and the campaigns you support."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {isNGO ? (
              <LiquidButton size="xl" onClick={() => navigate('/ngo-studio')}>
                <Plus className="w-4 h-4" />
                CREATE CAMPAIGN
              </LiquidButton>
            ) : (
              <LiquidButton size="xl" onClick={() => navigate('/campaigns')}>
                <Heart className="w-4 h-4" />
                FUND A CAMPAIGN
              </LiquidButton>
            )}
            <MetalButton onClick={() => navigate(isNGO ? '/analytics' : '/my-donations')}>
              {isNGO ? (
                <><BarChart3 className="w-4 h-4 mr-2" /> Analytics</>
              ) : (
                <><Wallet className="w-4 h-4 mr-2" /> My Donations</>
              )}
            </MetalButton>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="cf-animate-in cf-stagger-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-4">Overview</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value, sub }, i) => (
            <GlassCard key={label} className="p-5 lg:p-6 cf-animate-in" style={{ animationDelay: `${180 + i * 70}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">{label}</p>
                <div className="w-9 h-9 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/50" />
                </div>
              </div>
              <p className="cf-display text-2xl font-black text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/45 mt-1">{sub}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* ── NGO: My Campaigns section ── */}
      {isNGO && (
        <div className="cf-animate-in cf-stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-1">Your Projects</p>
              <h2 className="cf-section-title text-3xl font-bold text-white">My Campaigns</h2>
            </div>
            <button
              onClick={() => navigate('/ngo-studio')}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              Manage all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {myCampaigns.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCampaigns.slice(0, 3).map(c => <CampaignCard key={c._id} campaign={c} />)}
            </div>
          ) : (
            <GlassCard className="p-10 text-center">
              <Briefcase className="w-10 h-10 text-white/20 mx-auto mb-4" />
              <h3 className="cf-section-title text-2xl font-semibold text-white mb-2">No campaigns yet</h3>
              <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                Create your first campaign to start receiving milestone-based funding from donors worldwide.
              </p>
              <LiquidButton size="lg" onClick={() => navigate('/ngo-studio')}>
                <Plus className="w-4 h-4" />
                CREATE YOUR FIRST CAMPAIGN
              </LiquidButton>
            </GlassCard>
          )}
        </div>
      )}

      {/* ── Donor: Recent donations ── */}
      {isDonor && donations.length > 0 && (
        <div className="cf-animate-in cf-stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-1">Your Impact</p>
              <h2 className="cf-section-title text-3xl font-bold text-white">Recent Donations</h2>
            </div>
            <button
              onClick={() => navigate('/my-donations')}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-3">
            {donations.slice(0, 4).map((d, idx) => (
              <GlassCard
                key={d._id}
                className="p-4 sm:p-5 flex items-center justify-between cf-animate-in"
                style={{ animationDelay: `${240 + idx * 70}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[oklch(0.65_0.25_25)]/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-[oklch(0.65_0.25_25)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{d.campaign_title ?? 'Campaign'}</p>
                    <p className="text-xs text-white/40">{d.ngo_name ?? 'NGO'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">{d.amount_sol.toFixed(2)} SOL</p>
                  <div className="flex items-center gap-1 text-xs text-white/40 justify-end">
                    <Clock className="w-3 h-3" />
                    {d.created_at?.slice(0, 10)}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured / Explore Campaigns ── */}
      <div className="cf-animate-in cf-stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-1">
                {isNGO ? 'Platform Activity' : 'Discover'}
              </p>
            <h2 className="cf-section-title text-3xl font-bold text-white">
              {isNGO ? 'Active Campaigns' : 'Featured Campaigns'}
            </h2>
          </div>
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
          >
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredCampaigns.map((c, i) => (
            <div key={c._id} className="cf-animate-in" style={{ animationDelay: `${190 + i * 70}ms` }}>
              <CampaignCard
                campaign={c}
                actionLabel={isDonor ? 'Invest' : undefined}
                onAction={isDonor ? openInvest : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {isDonor && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeInvest} />
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[linear-gradient(150deg,rgba(20,20,24,0.96),rgba(13,13,16,0.96))] shadow-2xl p-6">
            <button
              onClick={closeInvest}
              disabled={investing}
              className="absolute top-3 right-3 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            {investResult ? (
              <div className="space-y-4">
                <h3 className="cf-section-title text-2xl font-bold text-white">Investment Confirmed</h3>
                <p className="text-sm text-white/60">
                  Donation was recorded for <span className="text-white font-semibold">{selectedCampaign.title}</span>.
                </p>
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1">Transaction</p>
                  <p className="text-xs text-white/65 break-all font-mono">{investResult.signature}</p>
                </div>
                <a
                  href={investResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[oklch(0.65_0.25_25)] hover:text-white"
                >
                  View on Solana Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="pt-2">
                  <LiquidButton className="w-full" onClick={closeInvest}>Done</LiquidButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="cf-section-title text-2xl font-bold text-white">Confirm Investment</h3>
                <p className="text-sm text-white/60">
                  Send SOL from your donor wallet to this campaign vault.
                </p>
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1">Campaign</p>
                  <p className="text-sm text-white font-semibold">{selectedCampaign.title}</p>
                  <p className="text-[11px] text-white/45 mt-1 break-all">Vault: {selectedCampaign.vault_address ?? 'Not configured'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/45 mb-2 block">
                    Amount (SOL)
                  </label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="cf-soft-input"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['0.1', '0.5', '1'].map(v => (
                    <button
                      key={v}
                      onClick={() => setInvestAmount(v)}
                      className="py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/65 text-xs hover:bg-white/[0.08] hover:text-white"
                    >
                      {v} SOL
                    </button>
                  ))}
                </div>
                <LiquidButton
                  className="w-full"
                  onClick={confirmInvest}
                  disabled={investing || !selectedCampaign.vault_address}
                >
                  {investing ? 'Processing Transaction...' : 'Confirm & Send'}
                </LiquidButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
