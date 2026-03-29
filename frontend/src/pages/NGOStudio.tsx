import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns, createCampaign } from '@/api/client'
import type { Campaign } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = ['My Campaigns', 'New Campaign']

export default function NGOStudio() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Healthcare', vault_address: '' })

  const loadMyCampaigns = () => {
    getCampaigns()
      .then((data) => setCampaigns(data.filter((c) => c.ngo_id === user?.id)))
      .catch(() => {})
  }

  useEffect(() => { loadMyCampaigns() }, [user?.id])

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
      toast.success('Campaign launched! It will go live after review.')
      setForm({ title: '', description: '', category: 'Healthcare', vault_address: '' })
      setTab(0)
      loadMyCampaigns()
    } catch (err) {
      toast.error('Failed to create campaign. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">NGO Studio</h2>
          <p className="text-sm text-white/50">Manage your campaigns and launch new ones.</p>
        </div>
        <button onClick={() => setTab(1)} className="flex items-center gap-1.5 text-sm text-[oklch(0.65_0.25_25)] hover:text-white transition-colors">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', i === tab ? 'bg-white/[0.10] text-white' : 'text-white/50 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        <div>
          {campaigns.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <p className="text-white/40 text-lg font-semibold mb-2">No campaigns yet</p>
              <p className="text-white/30 text-sm mb-6">Launch your first campaign to start receiving escrow-protected donations.</p>
              <LiquidButton onClick={() => setTab(1)}>LAUNCH CAMPAIGN</LiquidButton>
            </GlassCard>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(c => <CampaignCard key={c._id} campaign={c} />)}
            </div>
          )}
        </div>
      ) : (
        <GlassCard className="p-8 max-w-2xl">
          <h3 className="text-lg font-semibold text-white mb-6">Launch a New Campaign</h3>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Campaign Title</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
                placeholder="e.g. Mobile Clinic for Rural Communities" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} required
                placeholder="Describe your campaign, goals, and impact..." rows={4}
                className={cn(inputClass, 'resize-none')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                  className={inputClass}>
                  {['Healthcare', 'Education', 'Water & Sanitation', 'Shelter & Safety', 'Climate', 'Food Security'].map(c => (
                    <option key={c} value={c} className="bg-neutral-900">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Vault Address (optional)</label>
                <input value={form.vault_address} onChange={e => setForm(f => ({...f, vault_address: e.target.value}))}
                  placeholder="Solana vault address" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <LiquidButton type="submit" disabled={saving}>
                {saving ? 'Launching...' : 'LAUNCH CAMPAIGN'}
              </LiquidButton>
              <MetalButton type="button" onClick={() => setTab(0)}>Cancel</MetalButton>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  )
}
