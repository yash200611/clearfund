import { useEffect, useState } from 'react'
import { getPlatformAnalytics } from '@/api/client'
import { GlassCard } from '@/components/ui/glass-card'

interface PlatformStats {
  total_raised_sol: number
  total_released_sol: number
  total_locked_sol: number
  campaigns_active: number
  campaigns_completed: number
  milestones_approved: number
  milestones_rejected: number
  avg_confidence_score: number
  agent_decisions_today: number
  lava_status?: string
}

export default function Analytics() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlatformAnalytics()
      .then(s => setStats(s as PlatformStats))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="cf-page flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="cf-page">
        <p className="text-white/40 text-sm">Failed to load analytics.</p>
      </div>
    )
  }

  const totalMilestones = stats.milestones_approved + stats.milestones_rejected
  const successRate = totalMilestones > 0
    ? Math.round((stats.milestones_approved / totalMilestones) * 100)
    : 0

  const cards = [
    { label: 'Total Raised', value: `${stats.total_raised_sol.toFixed(2)} SOL` },
    { label: 'Released to NGOs', value: `${stats.total_released_sol.toFixed(2)} SOL` },
    { label: 'In Escrow', value: `${stats.total_locked_sol.toFixed(2)} SOL` },
    { label: 'Active Campaigns', value: String(stats.campaigns_active) },
    { label: 'Completed Campaigns', value: String(stats.campaigns_completed) },
    { label: 'Milestones Approved', value: String(stats.milestones_approved) },
    { label: 'Milestones Rejected', value: String(stats.milestones_rejected) },
    { label: 'AI Success Rate', value: `${successRate}%` },
    { label: 'Avg AI Confidence', value: `${stats.avg_confidence_score.toFixed(1)}` },
    { label: 'Agent Decisions Today', value: String(stats.agent_decisions_today) },
  ]

  return (
    <div className="cf-page max-w-7xl space-y-6">
      <div className="cf-animate-in flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-2">Telemetry</p>
          <h2 className="cf-section-title text-3xl sm:text-4xl font-bold text-white mb-1">Analytics</h2>
          <p className="text-sm text-white/55">Live platform metrics from MongoDB and Solana.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5">
          <div className={`w-2 h-2 rounded-full ${stats.lava_status === 'ok' ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="text-xs text-white/50">Lava {stats.lava_status ?? 'unknown'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value }, i) => (
          <GlassCard key={label} className="p-5 cf-animate-in" style={{ animationDelay: `${130 + i * 60}ms` }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45 mb-2">{label}</p>
            <p className="cf-display text-2xl font-black text-white tabular-nums">{value}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
