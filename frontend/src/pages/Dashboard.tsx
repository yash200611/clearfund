import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Shield, Users } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { CampaignCard } from '@/components/CampaignCard'
import { useAuth } from '@/contexts/AuthContext'
import { getCampaigns, getMyDonations, getPlatformAnalytics } from '@/api/client'
import type { Campaign, Donation } from '@/api/client'

export default function Dashboard() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    getCampaigns().then(setCampaigns).catch(() => {})
    if (user?.role === 'donor') getMyDonations().then(setDonations).catch(() => {})
    getPlatformAnalytics().then(s => setStats(s as Record<string, unknown>)).catch(() => {})
  }, [user])

  const totalDonated = donations.reduce((s, d) => s + d.amount_sol, 0)
  const totalReleased = donations.reduce((s, d) => s + d.released_sol, 0)
  const totalLocked = donations.reduce((s, d) => s + d.locked_sol, 0)

  const donorStatCards = [
    { icon: DollarSign, label: 'Total Donated', value: `${totalDonated.toFixed(2)} SOL`, sub: 'Lifetime giving' },
    { icon: TrendingUp, label: 'Released to NGOs', value: `${totalReleased.toFixed(2)} SOL`, sub: 'Impact delivered' },
    { icon: Shield, label: 'In Escrow', value: `${totalLocked.toFixed(2)} SOL`, sub: 'Protected funds' },
    { icon: Users, label: 'Campaigns', value: String(donations.length), sub: 'Supported projects' },
  ]

  const platformStatCards = [
    { icon: DollarSign, label: 'Total Protected', value: (stats?.total_protected as string) ?? '—', sub: 'Across all campaigns' },
    { icon: TrendingUp, label: 'Success Rate', value: (stats?.success_rate as string) ?? '—', sub: 'Milestones verified' },
    { icon: Shield, label: 'Active Campaigns', value: String(stats?.total_campaigns ?? '—'), sub: 'Live right now' },
    { icon: Users, label: 'Total Donors', value: String(stats?.total_donors ?? '—'), sub: 'Global community' },
  ]

  const statCards = user?.role === 'donor' ? donorStatCards : platformStatCards

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-white/50">Here's what's happening with your {user?.role === 'donor' ? 'donations' : 'campaigns'} today.</p>
      </div>

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

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          {user?.role === 'donor' ? 'Featured Campaigns' : 'Active Campaigns'}
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.slice(0, 3).map(c => <CampaignCard key={c._id} campaign={c} />)}
        </div>
      </div>
    </div>
  )
}
