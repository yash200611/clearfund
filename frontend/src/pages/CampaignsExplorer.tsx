import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns } from '@/api/client'
import type { Campaign } from '@/data/seed'
import { cn } from '@/lib/utils'

const CATEGORIES = ['All', 'Healthcare', 'Education', 'Water & Sanitation', 'Shelter & Safety', 'Climate']

export default function CampaignsExplorer() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getCampaigns({ search, category }).then(data => {
      setCampaigns(data)
      setLoading(false)
    })
  }, [search, category])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Explore Campaigns</h2>
        <p className="text-sm text-white/50">Discover verified NGO campaigns with milestone-locked escrow.</p>
      </div>

      <GlassCard className="p-4 flex flex-col sm:flex-row gap-4" hover={false}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                category === cat
                  ? 'bg-white/[0.12] text-white border border-white/20'
                  : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/80'
              )}>
              {cat}
            </button>
          ))}
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <p className="text-white/40 text-lg font-semibold">No campaigns found</p>
          <p className="text-white/30 text-sm mt-1">Try a different search or category</p>
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  )
}
