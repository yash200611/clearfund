import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  active: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  under_review: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  draft: { dot: 'bg-white/40', text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' },
  locked: { dot: 'bg-white/40', text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' },
  submitted: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  approved: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  released: { dot: 'bg-white', text: 'text-white', bg: 'bg-white/10', border: 'border-white/20' },
  rejected: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
  completed: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  paused: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  frozen: { dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/35' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize backdrop-blur-sm', cfg.bg, cfg.border, cfg.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {status}
    </span>
  )
}
