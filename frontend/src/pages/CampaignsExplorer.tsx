import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns } from '@/api/client'
import type { Campaign } from '@/api/client'
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
    }).catch(() => setLoading(false))
  }, [search, category])

  return (
    <div className="cf-page space-y-7">
      <div className="cf-animate-in">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-2">Discovery</p>
        <h2 className="cf-section-title text-3xl sm:text-4xl font-bold text-white mb-2">Explore Campaigns</h2>
        <p className="text-sm text-white/55">Discover verified NGO campaigns with milestone-locked escrow.</p>
      </div>

      <GlassCard className="p-4 sm:p-5 flex flex-col gap-4 cf-animate-in cf-stagger-1" hover={false}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="cf-soft-input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                category === cat
                  ? 'bg-[linear-gradient(130deg,rgba(255,255,255,0.17),rgba(255,255,255,0.05))] text-white border border-white/25'
                  : 'bg-white/[0.04] text-white/52 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/85'
              )}>
              {cat}
            </button>
          ))}
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 cf-animate-soft cf-stagger-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 rounded-3xl bg-white/[0.03] border border-white/[0.08] animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <GlassCard className="p-12 text-center cf-animate-in cf-stagger-2">
          <p className="cf-section-title text-white/80 text-2xl font-semibold">No campaigns found</p>
          <p className="text-white/40 text-sm mt-1">Try a different search or category</p>
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c, i) => (
            <div key={c._id} className="cf-animate-in" style={{ animationDelay: `${160 + i * 55}ms` }}>
              <CampaignCard campaign={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
