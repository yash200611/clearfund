import { useEffect, useState } from 'react'
import { Activity, CheckCircle2, Database } from 'lucide-react'
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
      .then((s) => setStats(s as PlatformStats))
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
  const successRate = totalMilestones > 0 ? Math.round((stats.milestones_approved / totalMilestones) * 100) : 0

  return (
    <div className="cf-page space-y-6 pb-10">
      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-2">Intelligence Layer</p>
            <h2 className="cf-display text-4xl md:text-5xl text-white">Platform Analytics</h2>
            <p className="text-sm text-white/58 mt-3">Operational telemetry across escrow rails, campaign lifecycle, and verification confidence.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.14] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white/70">
            <Database className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />
            Lava {stats.lava_status ?? 'unknown'}
          </div>
        </div>
      </GlassCard>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Raised', value: `${stats.total_raised_sol.toFixed(2)} SOL` },
          { label: 'Released', value: `${stats.total_released_sol.toFixed(2)} SOL` },
          { label: 'Escrow Locked', value: `${stats.total_locked_sol.toFixed(2)} SOL` },
          { label: 'Campaigns Active', value: `${stats.campaigns_active}` },
          { label: 'Campaigns Complete', value: `${stats.campaigns_completed}` },
          { label: 'Milestones Approved', value: `${stats.milestones_approved}` },
          { label: 'Milestones Rejected', value: `${stats.milestones_rejected}` },
          { label: 'Avg AI Confidence', value: `${stats.avg_confidence_score.toFixed(1)}` },
        ].map((card, i) => (
          <GlassCard key={card.label} className="p-5 cf-animate-in" style={{ animationDelay: `${80 + i * 45}ms` }}>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/42">{card.label}</p>
            <p className="cf-display text-3xl text-white mt-3">{card.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5 cf-animate-in cf-stagger-2">
          <h3 className="cf-section-title text-2xl text-white mb-4">Verification Health</h3>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,197,94,0.95),rgba(56,189,248,0.8))]"
              style={{ width: `${Math.min(100, successRate)}%` }}
            />
          </div>
          <p className="text-sm text-white/58 mt-3">{successRate}% of reviewed milestones have been approved.</p>
          <div className="mt-4 text-xs text-white/45 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            Total reviewed: {totalMilestones}
          </div>
        </GlassCard>

        <GlassCard className="p-5 cf-animate-in cf-stagger-3">
          <h3 className="cf-section-title text-2xl text-white mb-4">AI Throughput</h3>
          <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Agent Decisions Today</p>
            <p className="cf-display text-4xl text-white mt-2">{stats.agent_decisions_today}</p>
          </div>
          <p className="text-sm text-white/52 mt-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />
            Real-time model evaluations across submitted evidence.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
