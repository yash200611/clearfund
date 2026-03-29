import { useEffect, useRef, useState } from 'react'
import { Plus, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns, getCampaignById, createCampaign } from '@/api/client'
import type { Campaign } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = ['My Campaigns', 'New Campaign']
const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 40 // ~100 seconds max

interface ReviewState {
  campaignId: string
  title: string
  phase: 'started' | 'completed'
  recommendation?: string
  status?: string
  trust_score?: number
  reasoning?: string
  risk_flags?: string[]
}

export default function NGOStudio() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Healthcare' })
  const [review, setReview] = useState<ReviewState | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)

  const loadMyCampaigns = () => {
    getCampaigns()
      .then((data) => setCampaigns(data.filter((c) => c.ngo_id === user?.id)))
      .catch(() => {})
  }

  useEffect(() => { loadMyCampaigns() }, [user?.id])

  // Poll campaign status until review is done
  const startPolling = (campaignId: string) => {
    pollCountRef.current = 0
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1
      try {
        const c = await getCampaignById(campaignId)
        const recommendation = c.campaign_review?.recommendation
        const reviewedAt = c.campaign_review?.reviewed_at
        const hasGeminiDecision = Boolean(reviewedAt || (recommendation && recommendation !== 'pending'))

        if (c.status !== 'under_review' || hasGeminiDecision) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setReview(prev => prev ? {
            ...prev,
            phase: 'completed',
            recommendation,
            status: c.status,
            trust_score: c.trust_score,
            reasoning: c.campaign_review?.reasoning,
            risk_flags: c.campaign_review?.risk_flags,
          } : prev)
          loadMyCampaigns()
        }
      } catch {}

      if (pollCountRef.current >= MAX_POLLS) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        // Timed out — surface this explicitly so it doesn't look like a completed review.
        setReview(prev => prev ? {
          ...prev,
          phase: 'completed',
          status: 'under_review',
          recommendation: 'pending',
          reasoning: 'Gemini review is still processing or unavailable. Check backend logs for the campaign review result.',
          risk_flags: ['campaign_review_pending'],
        } : prev)
        loadMyCampaigns()
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const campaign = await createCampaign({
        title: form.title,
        description: form.description,
        category: form.category,
      })
      const title = form.title
      setForm({ title: '', description: '', category: 'Healthcare' })
      setReview({ campaignId: campaign._id, title, phase: 'started' })
      startPolling(campaign._id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create campaign. Please try again.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const closeReview = () => {
    setReview(null)
    setTab(0)
  }

  const inputClass = "w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Live Review Overlay */}
      {review && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <GlassCard className="w-full max-w-lg p-8 space-y-5">
            <div className="flex items-center gap-3">
              {review.phase === 'started' ? (
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin flex-shrink-0" />
              ) : review.status === 'active' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              ) : review.status === 'rejected' ? (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                  {review.phase === 'started'
                    ? 'Gemini is reviewing your campaign...'
                    : review.recommendation === 'pending'
                      ? 'Review Still In Progress'
                      : 'Review Complete'}
                </p>
                <p className="text-white font-semibold text-sm mt-0.5 line-clamp-1">{review.title}</p>
              </div>
            </div>

            {review.phase === 'started' && (
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400/70 rounded-full animate-pulse w-2/3" />
                </div>
                <p className="text-xs text-white/40">Analyzing description, category, and risk signals…</p>
              </div>
            )}

            {review.phase === 'completed' && (
              <div className="space-y-4">
                {/* Status + Score */}
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest',
                    review.status === 'active' ? 'bg-emerald-400/15 text-emerald-400' :
                    review.status === 'rejected' ? 'bg-red-400/15 text-red-400' :
                    'bg-amber-400/15 text-amber-400'
                  )}>
                    {review.status === 'active' ? 'Approved — Live' :
                     review.status === 'rejected' ? 'Rejected' : 'Under Review'}
                  </span>
                  {review.recommendation && (
                    <span className="text-xs text-white/50 uppercase tracking-widest">
                      Model decision: <span className="text-white/80">{review.recommendation}</span>
                    </span>
                  )}
                  {review.trust_score !== undefined && (
                    <span className="text-xs text-white/50">
                      Trust score: <span className="text-white font-semibold">{review.trust_score}%</span>
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                {review.reasoning && (
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-2">Gemini's Reasoning</p>
                    <p className="text-sm text-white/80 leading-relaxed">{review.reasoning}</p>
                  </div>
                )}

                {/* Risk flags */}
                {review.risk_flags && review.risk_flags.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Risk Flags</p>
                    {review.risk_flags.map((flag, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-400/80">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {flag.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>
                )}

                <LiquidButton onClick={closeReview} className="w-full">
                  View My Campaigns
                </LiquidButton>
              </div>
            )}
          </GlassCard>
        </div>
      )}

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
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                className={inputClass}>
                {['Healthcare', 'Education', 'Water & Sanitation', 'Shelter & Safety', 'Climate', 'Food Security'].map(c => (
                  <option key={c} value={c} className="bg-neutral-900">{c}</option>
                ))}
              </select>
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
