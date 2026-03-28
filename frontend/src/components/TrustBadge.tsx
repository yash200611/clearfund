import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function TrustBadge({ score, size = 'md' }: TrustBadgeProps) {
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : score >= 60 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'

  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border font-semibold backdrop-blur-sm', color, sizes[size])}>
      <Shield className="w-3 h-3" />
      {score}% Trust
    </span>
  )
}
