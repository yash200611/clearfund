import { useNavigate } from 'react-router-dom'
import { Users, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { TrustBadge } from '@/components/TrustBadge'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { EscrowProgressBar } from '@/components/EscrowProgressBar'
import type { Campaign } from '@/data/seed'

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate()
  const pct = Math.round((campaign.total_raised / campaign.goal) * 100)

  return (
    <GlassCard
      className="overflow-hidden cursor-pointer group"
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <StatusBadge status={campaign.status} />
          <TrustBadge score={campaign.trust_score} size="sm" />
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

        <EscrowProgressBar
          goal={campaign.goal}
          released={campaign.released}
          locked={campaign.locked}
          refunded={campaign.refunded}
        />

        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-lg font-bold text-white">${campaign.total_raised.toLocaleString()}</p>
            <p className="text-xs text-white/40">of ${campaign.goal.toLocaleString()} goal · {pct}%</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-white/50 text-xs">
              <Users className="w-3 h-3" />
              {campaign.donors_count} donors
            </div>
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <Clock className="w-3 h-3" />
              {campaign.created_at}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
