import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus, Rocket, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { CampaignCard } from '@/components/CampaignCard'
import { StatusBadge } from '@/components/StatusBadge'
import { createCampaign, getCampaignById, getCampaigns, submitMilestone } from '@/api/client'
import type { BudgetBreakdownItem, Campaign, Milestone } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = ['My Campaigns', 'Launch Campaign']
const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 40
const FLOAT_EPSILON = 1e-9

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

interface BudgetDraftItem {
  name: string
  amount_sol: string
}

interface MilestoneDraftItem {
  title: string
  description: string
  expected_completion_date: string
  amount_sol: string
}

interface EvidenceDraft {
  description: string
  evidenceCsv: string
}

function defaultForm() {
  return {
    title: '',
    description: '',
    category: 'Healthcare',
    total_budget_sol: '',
    budget_breakdown: [
      { name: 'Equipment', amount_sol: '' },
      { name: 'Logistics', amount_sol: '' },
      { name: 'Staffing', amount_sol: '' },
      { name: 'Operations', amount_sol: '' },
    ] as BudgetDraftItem[],
    milestones: [
      { title: '', description: '', expected_completion_date: '', amount_sol: '' },
      { title: '', description: '', expected_completion_date: '', amount_sol: '' },
    ] as MilestoneDraftItem[],
  }
}

function isApprovedStatus(status: string): boolean {
  return status === 'approved' || status === 'released'
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= FLOAT_EPSILON
}

function parseEvidenceUrls(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function sortedMilestones(items: Milestone[]): Milestone[] {
  return [...items].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
}

export default function NGOStudio() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, EvidenceDraft>>({})
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)

  const loadMyCampaigns = useCallback(async () => {
    try {
      const data = await getCampaigns()
      const mine = data.filter((c) => c.ngo_id === user?.id)
      const details = await Promise.all(
        mine.map(async (campaign) => {
          try {
            return await getCampaignById(campaign._id)
          } catch {
            return campaign
          }
        }),
      )
      setCampaigns(details)
    } catch {
      // Keep current UI state on transient fetch failures.
    }
  }, [user?.id])

  useEffect(() => {
    loadMyCampaigns()
  }, [loadMyCampaigns])

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    [],
  )

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
      } catch {
        // Keep polling until timeout.
      }

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

  const updateBudgetItem = (index: number, next: Partial<BudgetDraftItem>) => {
    setForm((prev) => ({
      ...prev,
      budget_breakdown: prev.budget_breakdown.map((item, i) => (i === index ? { ...item, ...next } : item)),
    }))
  }

  const updateMilestoneItem = (index: number, next: Partial<MilestoneDraftItem>) => {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.map((item, i) => (i === index ? { ...item, ...next } : item)),
    }))
  }

  const addBudgetItem = () => {
    setForm((prev) => ({
      ...prev,
      budget_breakdown: [...prev.budget_breakdown, { name: '', amount_sol: '' }],
    }))
  }

  const removeBudgetItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      budget_breakdown: prev.budget_breakdown.filter((_, i) => i !== index),
    }))
  }

  const addMilestoneItem = () => {
    setForm((prev) => {
      if (prev.milestones.length >= 5) return prev
      return {
        ...prev,
        milestones: [...prev.milestones, { title: '', description: '', expected_completion_date: '', amount_sol: '' }],
      }
    })
  }

  const removeMilestoneItem = (index: number) => {
    setForm((prev) => {
      if (prev.milestones.length <= 2) return prev
      return {
        ...prev,
        milestones: prev.milestones.filter((_, i) => i !== index),
      }
    })
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const totalBudget = Number.parseFloat(form.total_budget_sol)
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      toast.error('Enter a valid total budget in SOL')
      return
    }

    const budgetBreakdown: BudgetBreakdownItem[] = []
    for (const item of form.budget_breakdown) {
      const name = item.name.trim()
      const amount = Number.parseFloat(item.amount_sol)
      if (!name) {
        toast.error('Each budget category must include a name')
        return
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(`Budget amount must be greater than 0 for ${name}`)
        return
      }
      budgetBreakdown.push({ name, amount_sol: amount })
    }

    const milestones = form.milestones.map((item, index) => ({
      title: item.title.trim(),
      description: item.description.trim(),
      expected_completion_date: item.expected_completion_date,
      amount_sol: Number.parseFloat(item.amount_sol),
      index,
    }))

    if (milestones.length < 2 || milestones.length > 5) {
      toast.error('Campaign must have between 2 and 5 milestones')
      return
    }

    for (const m of milestones) {
      if (!m.title || !m.description || !m.expected_completion_date) {
        toast.error(`Milestone ${m.index + 1} is missing required fields`)
        return
      }
      if (!Number.isFinite(m.amount_sol) || m.amount_sol <= 0) {
        toast.error(`Milestone ${m.index + 1} must have a valid SOL amount`)
        return
      }
    }

    const budgetSum = budgetBreakdown.reduce((sum, item) => sum + item.amount_sol, 0)
    const milestoneSum = milestones.reduce((sum, item) => sum + item.amount_sol, 0)

    if (!isClose(budgetSum, totalBudget)) {
      toast.error(`Budget categories total ${budgetSum.toFixed(4)} SOL but campaign budget is ${totalBudget.toFixed(4)} SOL`)
      return
    }
    if (!isClose(milestoneSum, totalBudget)) {
      toast.error(`Milestones total ${milestoneSum.toFixed(4)} SOL but campaign budget is ${totalBudget.toFixed(4)} SOL`)
      return
    }

    setSaving(true)
    try {
      const campaign = await createCampaign({
        title: form.title,
        description: form.description,
        category: form.category,
        total_budget_sol: totalBudget,
        budget_breakdown: budgetBreakdown,
        milestones: milestones.map((m) => ({
          title: m.title,
          description: m.description,
          expected_completion_date: m.expected_completion_date,
          amount_sol: m.amount_sol,
        })),
      })

      const title = form.title
      setForm(defaultForm())
      setReview({
        campaignId: campaign._id,
        title,
        phase: campaign.status === 'under_review' ? 'started' : 'completed',
        recommendation: campaign.campaign_review?.recommendation,
        status: campaign.status,
        trust_score: campaign.trust_score,
        reasoning: campaign.campaign_review?.reasoning,
        risk_flags: campaign.campaign_review?.risk_flags,
      })
      loadMyCampaigns()
      if (campaign.status === 'under_review') {
        startPolling(campaign._id)
      }
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

  const updateEvidenceDraft = (milestoneId: string, patch: Partial<EvidenceDraft>) => {
    setEvidenceDrafts((prev) => ({
      ...prev,
      [milestoneId]: {
        description: prev[milestoneId]?.description ?? '',
        evidenceCsv: prev[milestoneId]?.evidenceCsv ?? '',
        ...patch,
      },
    }))
  }

  const handleSubmitMilestone = async (campaignId: string, milestone: Milestone) => {
    const milestoneId = milestone.milestone_id ?? milestone._id
    if (!milestoneId) {
      toast.error('Milestone id is missing')
      return
    }

    const draft = evidenceDrafts[milestoneId] ?? { description: '', evidenceCsv: '' }
    const description = draft.description.trim()
    if (!description) {
      toast.error('Add a short submission note before submitting this milestone')
      return
    }

    setSubmittingMilestoneId(milestoneId)
    try {
      await submitMilestone(milestoneId, {
        description,
        evidence_urls: parseEvidenceUrls(draft.evidenceCsv),
      })
      toast.success('Milestone submitted for verification')
      setEvidenceDrafts((prev) => {
        const next = { ...prev }
        delete next[milestoneId]
        return next
      })
      await loadMyCampaigns()
      const updated = await getCampaignById(campaignId)
      setCampaigns((prev) => prev.map((c) => (c._id === campaignId ? updated : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit milestone')
    } finally {
      setSubmittingMilestoneId(null)
    }
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
                    {review.status === 'active' ? 'Approved - Live' : review.status === 'rejected' ? 'Rejected' : 'Under Review'}
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
              Design campaign budgets, define milestone release plans, and launch with strict sequencing controls.
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
          <div className="space-y-5">
            {campaigns.map((campaign, i) => {
              const milestones = sortedMilestones(campaign.milestones ?? [])
              const nextOpenIndex = milestones.findIndex((m) => !isApprovedStatus(m.status))
              const campaignFrozen = campaign.status === 'frozen' || campaign.status === 'failed'

              return (
                <div key={campaign._id} className="space-y-3 cf-animate-in" style={{ animationDelay: `${90 + i * 55}ms` }}>
                  <CampaignCard campaign={campaign} />

                  <GlassCard className="p-4" hover={false}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="cf-section-title text-lg text-white">Milestones</h4>
                      {campaignFrozen ? <StatusBadge status="frozen" /> : <StatusBadge status={campaign.status} />}
                    </div>

                    {milestones.length === 0 ? (
                      <p className="text-sm text-white/50">No milestones were found for this campaign.</p>
                    ) : (
                      <div className="space-y-3">
                        {milestones.map((milestone, index) => {
                          const milestoneId = milestone.milestone_id ?? milestone._id
                          const currentStatus = milestone.status
                          const canSubmit =
                            !campaignFrozen &&
                            milestoneId &&
                            index === nextOpenIndex &&
                            currentStatus !== 'submitted' &&
                            currentStatus !== 'processing' &&
                            !isApprovedStatus(currentStatus)

                          return (
                            <div key={milestoneId ?? `${campaign._id}-${index}`} className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-white font-semibold">{index + 1}. {milestone.title}</p>
                                  <p className="text-xs text-white/58 mt-1">{milestone.description}</p>
                                  <p className="text-xs text-white/45 mt-1">
                                    Due {(milestone.expected_completion_date ?? milestone.due_date ?? '').slice(0, 10)} · {milestone.amount_sol} SOL
                                  </p>
                                </div>
                                <StatusBadge status={currentStatus === 'released' ? 'approved' : currentStatus} />
                              </div>

                              {canSubmit && milestoneId && (
                                <div className="mt-3 space-y-2">
                                  <textarea
                                    rows={2}
                                    value={evidenceDrafts[milestoneId]?.description ?? ''}
                                    onChange={(e) => updateEvidenceDraft(milestoneId, { description: e.target.value })}
                                    placeholder="Submission note for verifier/oracle"
                                    className="cf-soft-input resize-none"
                                  />
                                  <input
                                    value={evidenceDrafts[milestoneId]?.evidenceCsv ?? ''}
                                    onChange={(e) => updateEvidenceDraft(milestoneId, { evidenceCsv: e.target.value })}
                                    placeholder="Evidence URLs (comma or newline separated)"
                                    className="cf-soft-input"
                                  />
                                  <button
                                    onClick={() => handleSubmitMilestone(campaign._id, milestone)}
                                    disabled={submittingMilestoneId === milestoneId}
                                    className="h-10 px-4 rounded-lg border border-white/[0.2] bg-white/[0.06] text-sm text-white hover:bg-white/[0.1] inline-flex items-center gap-2 disabled:opacity-55"
                                  >
                                    {submittingMilestoneId === milestoneId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Submit Milestone
                                  </button>
                                </div>
                              )}

                              {!canSubmit && !campaignFrozen && index > nextOpenIndex && nextOpenIndex >= 0 && (
                                <p className="text-xs text-amber-300/80 mt-2">Waiting for previous milestone approval.</p>
                              )}
                              {campaignFrozen && (
                                <p className="text-xs text-red-300/80 mt-2">Campaign is frozen. No further submissions allowed.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </GlassCard>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <GlassCard className="p-6 md:p-8 max-w-4xl cf-animate-in cf-stagger-2" hover={false}>
          <h3 className="cf-section-title text-3xl text-white mb-6">Launch Campaign</h3>
          <form onSubmit={handleCreate} className="space-y-6">
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
                placeholder="Describe mission, beneficiaries, and expected impact..."
                className="cf-soft-input resize-none"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
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

              <div>
                <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Total Budget (SOL)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.total_budget_sol}
                  onChange={(e) => setForm((f) => ({ ...f, total_budget_sol: e.target.value }))}
                  required
                  className="cf-soft-input"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Budget Breakdown</p>
                <button
                  type="button"
                  onClick={addBudgetItem}
                  className="text-xs text-white/70 hover:text-white border border-white/[0.16] rounded-lg px-2.5 py-1"
                >
                  Add Category
                </button>
              </div>

              {form.budget_breakdown.map((item, index) => (
                <div key={`budget-${index}`} className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateBudgetItem(index, { name: e.target.value })}
                    placeholder="Category name"
                    className="cf-soft-input"
                    required
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.amount_sol}
                    onChange={(e) => updateBudgetItem(index, { amount_sol: e.target.value })}
                    placeholder="SOL"
                    className="cf-soft-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeBudgetItem(index)}
                    className="h-10 px-3 rounded-lg border border-white/[0.14] bg-white/[0.04] text-white/65 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Milestones (2 to 5)</p>
                <button
                  type="button"
                  onClick={addMilestoneItem}
                  disabled={form.milestones.length >= 5}
                  className="text-xs text-white/70 hover:text-white border border-white/[0.16] rounded-lg px-2.5 py-1 disabled:opacity-40"
                >
                  Add Milestone
                </button>
              </div>

              {form.milestones.map((item, index) => (
                <div key={`milestone-${index}`} className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-semibold">Milestone {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeMilestoneItem(index)}
                      disabled={form.milestones.length <= 2}
                      className="text-xs text-white/60 hover:text-white disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    value={item.title}
                    onChange={(e) => updateMilestoneItem(index, { title: e.target.value })}
                    placeholder="Milestone title"
                    className="cf-soft-input"
                    required
                  />
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateMilestoneItem(index, { description: e.target.value })}
                    placeholder="Milestone description"
                    className="cf-soft-input resize-none"
                    required
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={item.expected_completion_date}
                      onChange={(e) => updateMilestoneItem(index, { expected_completion_date: e.target.value })}
                      className="cf-soft-input"
                      required
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.amount_sol}
                      onChange={(e) => updateMilestoneItem(index, { amount_sol: e.target.value })}
                      placeholder="Release amount (SOL)"
                      className="cf-soft-input"
                      required
                    />
                  </div>
                </div>
              ))}
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

