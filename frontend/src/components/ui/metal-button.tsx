"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ColorVariant = "default" | "primary" | "success" | "error" | "gold" | "bronze"

interface MetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ColorVariant
}

const colorVariants: Record<ColorVariant, { outer: string; inner: string; button: string; textColor: string; textShadow: string }> = {
  default: {
    outer: "bg-gradient-to-b from-[#000] to-[#A0A0A0]",
    inner: "bg-gradient-to-b from-[#FAFAFA] via-[#3E3E3E] to-[#E5E5E5]",
    button: "bg-gradient-to-b from-[#B9B9B9] to-[#969696]",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(80_80_80_/_100%)]",
  },
  primary: {
    outer: "bg-gradient-to-b from-[#000] to-[#A0A0A0]",
    inner: "bg-gradient-to-b from-[#5588ff] via-[#2244aa] to-[#88aaff]",
    button: "bg-gradient-to-b from-[#5588ff] to-[#3355bb]",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(30_58_138_/_100%)]",
  },
  success: {
    outer: "bg-gradient-to-b from-[#005A43] to-[#7CCB9B]",
    inner: "bg-gradient-to-b from-[#E5F8F0] via-[#00352F] to-[#D1F0E6]",
    button: "bg-gradient-to-b from-[#9ADBC8] to-[#3E8F7C]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(6_78_59_/_100%)]",
  },
  error: {
    outer: "bg-gradient-to-b from-[#5A0000] to-[#FFAEB0]",
    inner: "bg-gradient-to-b from-[#FFDEDE] via-[#680002] to-[#FFE9E9]",
    button: "bg-gradient-to-b from-[#F08D8F] to-[#A45253]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(146_64_14_/_100%)]",
  },
  gold: {
    outer: "bg-gradient-to-b from-[#917100] to-[#EAD98F]",
    inner: "bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]",
    button: "bg-gradient-to-b from-[#FFEBA1] to-[#9B873F]",
    textColor: "text-[#FFFDE5]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(178_140_2_/_100%)]",
  },
  bronze: {
    outer: "bg-gradient-to-b from-[#864813] to-[#E9B486]",
    inner: "bg-gradient-to-b from-[#EDC5A1] via-[#5F2D01] to-[#FFDEC1]",
    button: "bg-gradient-to-b from-[#FFE3C9] to-[#A36F3D]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]",
  },
}

const getStyles = (variant: ColorVariant, pressed: boolean, hovered: boolean, touch: boolean) => {
  const c = colorVariants[variant]
  const t = "all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)"
  return {
    wrapper: cn("relative inline-flex transform-gpu rounded-xl p-[1.25px] will-change-transform", c.outer),
    wrapperStyle: { transform: pressed ? "translateY(2.5px) scale(0.99)" : "translateY(0) scale(1)", boxShadow: pressed ? "0 1px 2px rgba(0,0,0,0.15)" : hovered && !touch ? "0 4px 12px rgba(0,0,0,0.12)" : "0 3px 8px rgba(0,0,0,0.08)", transition: t },
    inner: cn("absolute inset-[1px] transform-gpu rounded-xl will-change-transform", c.inner),
    innerStyle: { transition: t, filter: hovered && !pressed && !touch ? "brightness(1.05)" : "none" },
    button: cn("relative z-10 m-[1px] rounded-xl inline-flex h-11 transform-gpu cursor-pointer items-center justify-center overflow-hidden px-6 py-2 text-sm leading-none font-semibold will-change-transform outline-none", c.button, c.textColor, c.textShadow),
    buttonStyle: { transform: pressed ? "scale(0.97)" : "scale(1)", transition: t, filter: hovered && !pressed && !touch ? "brightness(1.02)" : "none" },
  }
}

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ children, className, variant = "default", ...props }, ref) => {
    const [pressed, setPressed] = React.useState(false)
    const [hovered, setHovered] = React.useState(false)
    const [touch, setTouch] = React.useState(false)
    React.useEffect(() => { setTouch("ontouchstart" in window || navigator.maxTouchPoints > 0) }, [])
    const v = getStyles(variant, pressed, hovered, touch)
    return (
      <div className={v.wrapper} style={v.wrapperStyle}>
        <div className={v.inner} style={v.innerStyle} />
        <button ref={ref} className={cn(v.button, className)} style={v.buttonStyle} {...props}
          onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
          onMouseLeave={() => { setPressed(false); setHovered(false) }}
          onMouseEnter={() => !touch && setHovered(true)}
          onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)} onTouchCancel={() => setPressed(false)}>
          {children || "Button"}
          {hovered && !pressed && !touch && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t rounded-xl from-transparent to-white/5" />}
        </button>
      </div>
    )
  }
)
MetalButton.displayName = "MetalButton"
