import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Shield, Users } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { CampaignCard } from '@/components/CampaignCard'
import { useAuth } from '@/contexts/AuthContext'
import { getCampaigns, getMyDonations, getPlatformAnalytics } from '@/api/client'
import type { Campaign } from '@/data/seed'
import type { Donation } from '@/data/seed'

export default function Dashboard() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<{ total_protected: string; success_rate: string; total_campaigns: number; total_donors: number } | null>(null)

  useEffect(() => {
    getCampaigns().then(setCampaigns)
    if (user?.role === 'donor') getMyDonations().then(setDonations)
    getPlatformAnalytics().then(setStats)
  }, [user])

  const totalDonated = donations.reduce((s, d) => s + d.amount, 0)
  const totalReleased = donations.reduce((s, d) => s + d.released_portion, 0)
  const totalRefundable = donations.reduce((s, d) => s + d.refundable_portion, 0)

  const donorStatCards = [
    { icon: DollarSign, label: 'Total Donated', value: `$${totalDonated.toLocaleString()}`, sub: 'Lifetime giving' },
    { icon: TrendingUp, label: 'Released to NGOs', value: `$${totalReleased.toLocaleString()}`, sub: 'Impact delivered' },
    { icon: Shield, label: 'In Escrow', value: `$${totalRefundable.toLocaleString()}`, sub: 'Protected funds' },
    { icon: Users, label: 'Campaigns', value: String(donations.length), sub: 'Supported projects' },
  ]

  const platformStatCards = [
    { icon: DollarSign, label: 'Total Protected', value: stats?.total_protected ?? '—', sub: 'Across all campaigns' },
    { icon: TrendingUp, label: 'Success Rate', value: stats?.success_rate ?? '—', sub: 'Milestones verified' },
    { icon: Shield, label: 'Active Campaigns', value: String(stats?.total_campaigns ?? '—'), sub: 'Live right now' },
    { icon: Users, label: 'Total Donors', value: stats?.total_donors?.toLocaleString() ?? '—', sub: 'Global community' },
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {user?.role === 'donor' ? 'Featured Campaigns' : 'Active Campaigns'}
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.slice(0, 3).map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      </div>
    </div>
  )
}
