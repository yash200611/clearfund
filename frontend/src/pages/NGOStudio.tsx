import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus, Rocket, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaignById, getCampaigns, createCampaign } from '@/api/client'
import type { Campaign } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = ['My Campaigns', 'Launch Campaign']
const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 40

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

  const loadMyCampaigns = useCallback(() => {
    getCampaigns()
      .then((data) => setCampaigns(data.filter((c) => c.ngo_id === user?.id)))
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    loadMyCampaigns()
  }, [loadMyCampaigns])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const startPolling = (campaignId: string) => {
    pollCountRef.current = 0
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1
      try {
        const campaign = await getCampaignById(campaignId)
        const recommendation = campaign.campaign_review?.recommendation
        const reviewedAt = campaign.campaign_review?.reviewed_at
        const hasGeminiDecision = Boolean(reviewedAt || (recommendation && recommendation !== 'pending'))

        if (campaign.status !== 'under_review' || hasGeminiDecision) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setReview((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'completed',
                  recommendation,
                  status: campaign.status,
                  trust_score: campaign.trust_score,
                  reasoning: campaign.campaign_review?.reasoning,
                  risk_flags: campaign.campaign_review?.risk_flags,
                }
              : prev,
          )
          loadMyCampaigns()
        }
      } catch {}

      if (pollCountRef.current >= MAX_POLLS) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setReview((prev) =>
          prev
            ? {
                ...prev,
                phase: 'completed',
                status: 'under_review',
                recommendation: 'pending',
                reasoning: 'Gemini review is still processing. Please check back shortly.',
                risk_flags: ['campaign_review_pending'],
              }
            : prev,
        )
        loadMyCampaigns()
      }
    }, POLL_INTERVAL_MS)
  }

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
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const closeReview = () => {
    setReview(null)
    setTab(0)
  }

  return (
    <div className="cf-page max-w-6xl space-y-6 pb-10">
      {review && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6">
          <GlassCard className="w-full max-w-xl p-7 space-y-5">
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
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {review.phase === 'started'
                    ? 'Gemini reviewing campaign'
                    : review.recommendation === 'pending'
                      ? 'Review in progress'
                      : 'Review complete'}
                </p>
                <p className="text-white font-semibold text-sm mt-0.5">{review.title}</p>
              </div>
            </div>

            {review.phase === 'started' && (
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400/70 rounded-full animate-pulse w-2/3" />
                </div>
                <p className="text-xs text-white/45">Analyzing campaign narrative, risk vectors, and trust profile...</p>
              </div>
            )}

            {review.phase === 'completed' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.14em]',
                      review.status === 'active'
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : review.status === 'rejected'
                          ? 'bg-red-400/15 text-red-300'
                          : 'bg-amber-400/15 text-amber-300',
                    )}
                  >
                    {review.status === 'active' ? 'Approved — Live' : review.status === 'rejected' ? 'Rejected' : 'Under Review'}
                  </span>
                  {review.trust_score !== undefined && (
                    <span className="text-xs text-white/55">Trust score: {review.trust_score}%</span>
                  )}
                </div>

                {review.reasoning && (
                  <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-4">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-2">Model Reasoning</p>
                    <p className="text-sm text-white/78 leading-relaxed">{review.reasoning}</p>
                  </div>
                )}

                {review.risk_flags && review.risk_flags.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Risk Flags</p>
                    {review.risk_flags.map((flag, index) => (
                      <div key={index} className="text-xs text-amber-300/85 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
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

      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-2">Builder Surface</p>
            <h2 className="cf-display text-4xl md:text-5xl text-white">NGO Studio</h2>
            <p className="text-sm text-white/58 mt-3 max-w-2xl">
              Design and launch campaigns with clear impact narratives and real-time risk screening.
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

            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="cf-soft-input">
                {['Healthcare', 'Education', 'Water & Sanitation', 'Shelter & Safety', 'Climate', 'Food Security'].map((category) => (
                  <option key={category} value={category} className="bg-neutral-900">
                    {category}
                  </option>
                ))}
              </select>
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
