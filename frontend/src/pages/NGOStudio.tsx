import { useCallback, useEffect, useState } from 'react'
import { Plus, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns, createCampaign } from '@/api/client'
import type { Campaign } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = ['My Campaigns', 'Launch Campaign']

export default function NGOStudio() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Healthcare', vault_address: '' })

  const loadMyCampaigns = useCallback(() => {
    getCampaigns()
      .then((data) => setCampaigns(data.filter((c) => c.ngo_id === user?.id)))
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    loadMyCampaigns()
  }, [loadMyCampaigns])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createCampaign({
        title: form.title,
        description: form.description,
        category: form.category,
        vault_address: form.vault_address || undefined,
      })
      toast.success('Campaign launched and queued for review.')
      setForm({ title: '', description: '', category: 'Healthcare', vault_address: '' })
      setTab(0)
      loadMyCampaigns()
    } catch {
      toast.error('Failed to create campaign. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cf-page max-w-6xl space-y-6 pb-10">
      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-2">Builder Surface</p>
            <h2 className="cf-display text-4xl md:text-5xl text-white">NGO Studio</h2>
            <p className="text-sm text-white/58 mt-3 max-w-2xl">
              Design and launch campaigns with escrow-ready vault settings and clear impact narratives.
            </p>
          </div>
          <button
            onClick={() => setTab(1)}
            className="h-11 px-4 rounded-xl border border-white/[0.18] bg-white/[0.05] text-sm text-white/75 hover:text-white hover:bg-white/[0.09] transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </GlassCard>

      <div className="inline-flex rounded-2xl border border-white/[0.12] bg-white/[0.03] p-1.5">
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm transition-all',
              i === tab
                ? 'bg-[linear-gradient(130deg,rgba(255,255,255,0.18),rgba(255,255,255,0.05))] text-white'
                : 'text-white/58 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        campaigns.length === 0 ? (
          <GlassCard className="p-12 text-center cf-animate-in cf-stagger-2">
            <Rocket className="w-10 h-10 text-white/30 mx-auto mb-4" />
            <p className="cf-section-title text-3xl text-white/86">No campaigns yet</p>
            <p className="text-sm text-white/48 mt-2">Launch your first campaign to start receiving milestone-based funding.</p>
            <button
              onClick={() => setTab(1)}
              className="mt-5 h-11 px-5 rounded-xl border border-white/[0.2] bg-white/[0.06] text-sm text-white hover:bg-white/[0.1]"
            >
              Start new campaign
            </button>
          </GlassCard>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((campaign, i) => (
              <div key={campaign._id} className="cf-animate-in" style={{ animationDelay: `${90 + i * 55}ms` }}>
                <CampaignCard campaign={campaign} />
              </div>
            ))}
          </div>
        )
      ) : (
        <GlassCard className="p-6 md:p-8 max-w-3xl cf-animate-in cf-stagger-2" hover={false}>
          <h3 className="cf-section-title text-3xl text-white mb-6">Launch Campaign</h3>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Campaign Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                placeholder="e.g. Mobile clinic for remote regions"
                className="cf-soft-input"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Narrative</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
                rows={4}
                placeholder="Describe mission, milestones, and expected outcomes..."
                className="cf-soft-input resize-none"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="cf-soft-input"
                >
                  {['Healthcare', 'Education', 'Water & Sanitation', 'Shelter & Safety', 'Climate', 'Food Security'].map((category) => (
                    <option key={category} value={category} className="bg-neutral-900">
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Vault Address (optional)</label>
                <input
                  value={form.vault_address}
                  onChange={(e) => setForm((f) => ({ ...f, vault_address: e.target.value }))}
                  placeholder="Solana vault address"
                  className="cf-soft-input"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <LiquidButton type="submit" size="xl" disabled={saving}>
                {saving ? 'Launching...' : 'Launch Campaign'}
              </LiquidButton>
              <button
                type="button"
                onClick={() => setTab(0)}
                className="h-12 px-5 rounded-xl border border-white/[0.16] bg-white/[0.04] text-sm text-white/72 hover:text-white hover:bg-white/[0.09] transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  )
}
