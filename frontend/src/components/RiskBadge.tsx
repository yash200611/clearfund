import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RiskBadgeProps {
  failureCount: number
}

export function RiskBadge({ failureCount }: RiskBadgeProps) {
  const color = failureCount === 0 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : failureCount === 1 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm', color)}>
      <AlertTriangle className="w-3 h-3" />
      {failureCount}/3 Failures
    </span>
  )
}
