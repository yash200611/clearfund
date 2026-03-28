import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: boolean
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, glow = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-[24px]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_40px_rgba(0,0,0,0.3)]",
        hover && "transition-all duration-300 ease-out hover:bg-white/[0.07] hover:border-white/[0.15]",
        glow && "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_40px_rgba(0,0,0,0.3),0_0_80px_rgba(255,100,50,0.04)]",
        className
      )}
      {...props}
    >{children}</div>
  )
)
GlassCard.displayName = "GlassCard"
