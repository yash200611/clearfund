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
        "rounded-3xl border border-white/[0.09] bg-[linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] backdrop-blur-[30px]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_24px_35px_-28px_rgba(0,0,0,0.9),0_2px_10px_rgba(0,0,0,0.45)]",
        hover && "transition-all duration-300 ease-out hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025))] hover:border-white/[0.18] hover:-translate-y-0.5",
        glow && "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_24px_35px_-28px_rgba(0,0,0,0.9),0_2px_10px_rgba(0,0,0,0.45),0_0_70px_rgba(255,100,50,0.06)]",
        className
      )}
      {...props}
    >{children}</div>
  )
)
GlassCard.displayName = "GlassCard"
