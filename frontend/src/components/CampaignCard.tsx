import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock, Loader2, Users } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import type { Campaign } from '@/api/client'

interface CampaignCardProps {
  campaign: Campaign
  actionLabel?: string
  onAction?: (campaign: Campaign) => void
  actionDisabled?: boolean
}

export function CampaignCard({ campaign, actionLabel, onAction, actionDisabled = false }: CampaignCardProps) {
  const navigate = useNavigate()
  const raised = campaign.total_raised_sol
  const goal = campaign.goal ?? 0
  const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0

  return (
    <GlassCard className="group overflow-hidden cursor-pointer" onClick={() => navigate(`/campaigns/${campaign._id}`)}>
      <div className="relative h-44 overflow-hidden">
        {campaign.image ? (
          <img
            src={campaign.image}
            alt={campaign.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-[linear-gradient(140deg,rgba(255,109,62,0.42),rgba(255,255,255,0.06),rgba(56,189,248,0.25))] flex items-center justify-center">
            <span className="cf-display text-5xl text-white/60">{campaign.category?.[0]}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="cf-shimmer absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="absolute top-3 left-3 flex gap-2 flex-wrap items-center">
          {campaign.status === 'under_review' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
          <StatusBadge status={campaign.status} />
          {campaign.status !== 'under_review' && <TrustBadge score={campaign.trust_score} size="sm" />}
        </div>

        <div className="absolute top-3 right-3">
          <RiskBadge failureCount={campaign.failure_count} />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/85 px-2.5 py-1 rounded-full border border-white/25 bg-black/30 backdrop-blur-sm">
            {campaign.category}
          </span>
          <ArrowUpRight className="w-4 h-4 text-white/70" />
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/44 mb-1">{campaign.ngo_name ?? 'NGO'}</p>
          <h3 className="cf-section-title text-xl text-white leading-tight line-clamp-2">{campaign.title}</h3>
        </div>

        <p className="text-sm text-white/58 line-clamp-2 min-h-[2.5rem]">{campaign.description}</p>

        <div className="space-y-2">
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,oklch(0.65_0.25_25),rgb(56,189,248))]"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/52">
            <span className="tabular-nums">{raised.toFixed(2)} SOL raised</span>
            <span>{goal > 0 ? `${pct}% of ${goal} SOL` : 'Open ended'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-white/50">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {campaign.donors_count ?? '—'} donors
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {campaign.created_at?.slice(0, 10)}
          </div>
        </div>

        {actionLabel && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onAction && !actionDisabled) onAction(campaign)
            }}
            disabled={actionDisabled || !onAction}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white border border-white/[0.2] bg-[linear-gradient(130deg,rgba(255,109,62,0.92),rgba(56,189,248,0.78))] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </GlassCard>
  )
}
