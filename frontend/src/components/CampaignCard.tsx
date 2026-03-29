import { useNavigate } from 'react-router-dom'
import { Users, Clock, Loader2 } from 'lucide-react'
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
    <GlassCard
      className="overflow-hidden cursor-pointer group"
      onClick={() => navigate(`/campaigns/${campaign._id}`)}
    >
      <div className="relative h-44 overflow-hidden">
        {campaign.image ? (
          <img
            src={campaign.image}
            alt={campaign.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-white/[0.04] flex items-center justify-center">
            <span className="text-4xl font-black text-white/10">{campaign.category?.[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap items-center">
          {campaign.status === 'under_review' && (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          )}
          <StatusBadge status={campaign.status} />
          {campaign.status !== 'under_review' && (
            <TrustBadge score={campaign.trust_score} size="sm" />
          )}
        </div>
        <div className="absolute top-3 right-3">
          <RiskBadge failureCount={campaign.failure_count} />
        </div>
        <div className="absolute bottom-3 left-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
            {campaign.category}
          </span>
        </div>
      </div>

      <div className="p-5">
        <p className="text-xs text-white/40 font-medium mb-1">{campaign.ngo_name}</p>
        <h3 className="text-base font-semibold text-white mb-2 line-clamp-2 leading-snug">{campaign.title}</h3>
        <p className="text-sm text-white/50 mb-4 line-clamp-2">{campaign.description}</p>

        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[oklch(0.65_0.25_25)] rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-lg font-bold text-white">{raised.toFixed(2)} SOL</p>
            {goal > 0 && (
              <p className="text-xs text-white/40">of {goal} SOL goal · {pct}%</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {campaign.donors_count != null && (
              <div className="flex items-center gap-1 text-white/50 text-xs">
                <Users className="w-3 h-3" />
                {campaign.donors_count} donors
              </div>
            )}
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <Clock className="w-3 h-3" />
              {campaign.created_at?.slice(0, 10)}
            </div>
          </div>
        </div>

        {actionLabel && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onAction && !actionDisabled) {
                onAction(campaign)
              }
            }}
            disabled={actionDisabled || !onAction}
            className="mt-4 w-full py-2.5 rounded-xl bg-[oklch(0.65_0.25_25)]/90 text-white text-sm font-semibold transition-all hover:bg-[oklch(0.65_0.25_25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </GlassCard>
  )
}
