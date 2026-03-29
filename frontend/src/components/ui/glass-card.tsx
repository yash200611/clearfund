import * as React from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: boolean
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, glow = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[1.4rem] border border-white/[0.14] bg-[linear-gradient(155deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03)_52%,rgba(255,255,255,0.06))] backdrop-blur-[26px]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_28px_38px_-26px_rgba(0,0,0,0.92),0_10px_18px_-14px_rgba(0,0,0,0.8)]',
        hover && 'transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.26] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_32px_42px_-26px_rgba(0,0,0,0.95),0_12px_24px_-14px_rgba(255,109,62,0.22)]',
        glow && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_28px_38px_-26px_rgba(0,0,0,0.92),0_10px_18px_-14px_rgba(0,0,0,0.8),0_0_80px_rgba(255,109,62,0.16)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)

GlassCard.displayName = 'GlassCard'
