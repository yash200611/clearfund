import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Shield, Users,
  ChevronRight, Briefcase, Heart, Plus, Wallet,
  BarChart3, Clock
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { CampaignCard } from '@/components/CampaignCard'
import { useAuth } from '@/contexts/AuthContext'
import { getCampaigns, getMyDonations, getPlatformAnalytics } from '@/api/client'
import type { Campaign, Donation } from '@/api/client'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)

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

  return (
    <div className="p-6 space-y-10 max-w-7xl mx-auto">
      {/* ── Hero greeting ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[24px] p-8 md:p-10">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[oklch(0.65_0.25_25)]/[0.03] blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
              {isNGO ? 'NGO Dashboard' : 'Donor Dashboard'}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2">
              Good {greeting}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-base text-white/50 max-w-lg">
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">Overview</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value, sub }) => (
            <GlassCard key={label} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</p>
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/50" />
                </div>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/40 mt-1">{sub}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* ── NGO: My Campaigns section ── */}
      {isNGO && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">Your Projects</p>
              <h2 className="text-2xl font-bold text-white">My Campaigns</h2>
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
              <h3 className="text-lg font-semibold text-white mb-2">No campaigns yet</h3>
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">Your Impact</p>
              <h2 className="text-2xl font-bold text-white">Recent Donations</h2>
            </div>
            <button
              onClick={() => navigate('/my-donations')}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-3">
            {donations.slice(0, 4).map(d => (
              <GlassCard key={d._id} className="p-4 flex items-center justify-between">
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
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">
              {isNGO ? 'Platform Activity' : 'Discover'}
            </p>
            <h2 className="text-2xl font-bold text-white">
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
          {featuredCampaigns.map(c => <CampaignCard key={c._id} campaign={c} />)}
        </div>
      </div>
    </div>
  )
}
