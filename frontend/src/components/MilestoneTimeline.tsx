import { Check, Clock, Lock, X, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Milestone } from '@/api/client'

interface MilestoneTimelineProps {
  milestones: Milestone[]
}

const STATUS_ICON: Record<string, React.ElementType> = {
  released: Check,
  approved: Check,
  submitted: Upload,
  processing: Upload,
  pending: Clock,
  locked: Lock,
  rejected: X,
}

const STATUS_STYLE: Record<string, string> = {
  released: 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]',
  approved: 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]',
  submitted: 'bg-amber-500/20 text-amber-400 border-amber-400/50 animate-pulse',
  processing: 'bg-amber-500/20 text-amber-400 border-amber-400/50 animate-pulse',
  pending: 'bg-white/5 text-white/60 border-white/20',
  locked: 'bg-white/5 text-white/30 border-white/10',
  rejected: 'bg-red-500/20 text-red-400 border-red-400/50',
}

const LINE_STYLE: Record<string, string> = {
  released: 'bg-white',
  approved: 'bg-emerald-500',
  submitted: 'bg-amber-400/50',
  processing: 'bg-amber-400/50',
  pending: 'bg-white/20',
  locked: 'bg-white/10',
  rejected: 'bg-red-500/30',
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div className="space-y-0">
      {milestones.map((m, i) => {
        const Icon = STATUS_ICON[m.status] ?? Lock
        const nodeStyle = STATUS_STYLE[m.status] ?? STATUS_STYLE.locked
        const isLast = i === milestones.length - 1

        return (
          <div key={m._id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300', nodeStyle)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {!isLast && (
                <div className={cn('w-0.5 flex-1 my-1 min-h-[32px]', LINE_STYLE[m.status] ?? LINE_STYLE.locked)} />
              )}
            </div>
            <div className={cn('pb-6 flex-1', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-semibold text-white">{m.title}</h4>
                <span className="text-sm font-bold text-white/80 flex-shrink-0">{m.amount_sol} SOL</span>
              </div>
              <p className="text-xs text-white/50 mb-2">{m.description}</p>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Due {m.due_date}
                </span>
              </div>
              {m.evidence_urls?.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 break-all">
                  {m.evidence_urls.join(', ')}
                </div>
              )}
              {m.solana_tx && (
                <div className="mt-1.5 p-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-xs text-emerald-400/80 font-mono truncate">
                  tx: {m.solana_tx}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
