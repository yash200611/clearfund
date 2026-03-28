import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import { NGOS } from '@/data/seed'
import { cn } from '@/lib/utils'

export function NGOCarousel() {
  const [center, setCenter] = useState(0)
  const total = NGOS.length

  useEffect(() => {
    const t = setInterval(() => setCenter(c => (c + 1) % total), 2500)
    return () => clearInterval(t)
  }, [total])

  const getPos = (i: number) => {
    let diff = i - center
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total
    return diff
  }

  return (
    <div className="w-full py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-white/30 mb-10">
        Trusted by Leading NGOs
      </p>
      <div className="relative h-48 flex items-center justify-center overflow-hidden">
        {NGOS.map((ngo, i) => {
          const pos = getPos(i)
          const isCenter = pos === 0
          const isNear = Math.abs(pos) === 1
          const isFar = Math.abs(pos) === 2
          const isHidden = Math.abs(pos) > 2

          const x = pos * 240
          const scale = isCenter ? 1 : isNear ? 0.75 : 0.65
          const opacity = isCenter ? 1 : isNear ? 0.4 : isFar ? 0.2 : 0

          return (
            <div
              key={ngo.name}
              onClick={() => setCenter(i)}
              className={cn(
                'absolute cursor-pointer',
                'transition-all duration-700 ease-out',
                isHidden && 'pointer-events-none'
              )}
              style={{
                transform: `translateX(${x}px) scale(${scale})`,
                opacity,
                zIndex: isCenter ? 10 : isNear ? 5 : 1,
              }}
            >
              <div className={cn(
                'w-52 rounded-2xl border p-6 text-center flex flex-col items-center gap-3 backdrop-blur-xl',
                isCenter
                  ? 'bg-white/[0.08] border-white/[0.2] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_0_60px_rgba(255,100,50,0.08)]'
                  : 'bg-white/[0.03] border-white/[0.06]'
              )}>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black',
                  isCenter ? 'bg-[oklch(0.65_0.25_25)] text-white' : 'bg-white/10 text-white/60'
                )}>
                  {ngo.initials}
                </div>
                <div>
                  <p className={cn('font-bold text-sm', isCenter ? 'text-white' : 'text-white/50')}>{ngo.name}</p>
                  <p className={cn('text-xs mt-0.5', isCenter ? 'text-white/60' : 'text-white/30')}>{ngo.tagline}</p>
                </div>
                {isCenter && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Shield className="w-3 h-3 text-[oklch(0.65_0.25_25)]" />
                    <span className="text-[oklch(0.65_0.25_25)] font-semibold">{ngo.funded} funded</span>
                  </div>
                )}
                <div className={cn('text-xs', isCenter ? 'text-white/40' : 'text-white/20')}>
                  {ngo.campaigns} campaigns
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-2 mt-8">
        {NGOS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCenter(i)}
            className={cn(
              'h-1 rounded-full transition-all duration-500',
              i === center ? 'w-6 bg-white' : 'w-1.5 bg-white/20'
            )}
          />
        ))}
      </div>
    </div>
  )
}
