import { useEffect, useState } from 'react'
import { Compass, Search, SlidersHorizontal } from 'lucide-react'
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
    getCampaigns({ search, category })
      .then((data) => setCampaigns(data))
      .finally(() => setLoading(false))
  }, [search, category])

  return (
    <div className="cf-page space-y-6 pb-10">
      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2">Discovery Terminal</p>
            <h2 className="cf-display text-4xl md:text-5xl text-white">Explore Campaigns</h2>
            <p className="text-white/58 mt-3 max-w-2xl">
              Screen verified NGO opportunities, compare trust profiles, and deploy capital into milestone-locked impact rails.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] px-4 py-3 text-sm text-white/66 flex items-center gap-2">
            <Compass className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />
            {campaigns.length} opportunities indexed
          </div>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-[0.32fr_0.68fr] gap-4">
        <GlassCard className="p-5 cf-animate-in cf-stagger-1" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="w-4 h-4 text-white/70" />
            <h3 className="cf-section-title text-xl text-white">Filters</h3>
          </div>

          <label className="text-xs uppercase tracking-[0.15em] text-white/45 mb-2 block">Search</label>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Project title or NGO..." className="cf-soft-input pl-10" />
          </div>

          <label className="text-xs uppercase tracking-[0.15em] text-white/45 mb-2 block">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'rounded-xl px-3 py-2 text-[11px] font-semibold text-left transition-all border',
                  category === cat
                    ? 'border-white/[0.28] bg-[linear-gradient(130deg,rgba(255,255,255,0.17),rgba(255,255,255,0.05))] text-white'
                    : 'border-white/[0.1] bg-white/[0.03] text-white/62 hover:text-white hover:bg-white/[0.08]',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 md:p-6 cf-animate-in cf-stagger-2" hover={false}>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 rounded-2xl border border-white/[0.1] bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-14 text-center">
              <p className="cf-section-title text-3xl text-white/85">No campaigns found</p>
              <p className="text-sm text-white/45 mt-2">Try broadening your search filters.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {campaigns.map((campaign, i) => (
                <div key={campaign._id} className="cf-animate-in" style={{ animationDelay: `${110 + i * 50}ms` }}>
                  <CampaignCard campaign={campaign} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
