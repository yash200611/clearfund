import { Menu, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface TopBarProps {
  title: string
  onMenuClick?: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const { user } = useAuth()

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }, [])

  return (
    <header className="h-[4.4rem] px-4 sm:px-6 flex items-center justify-between border-b border-white/[0.11] bg-[linear-gradient(165deg,rgba(11,11,17,0.75),rgba(8,8,14,0.55))] backdrop-blur-2xl">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button onClick={onMenuClick} className="lg:hidden text-white/60 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="cf-display text-xl text-white truncate">{title}</h1>
          <p className="text-[11px] text-white/40 uppercase tracking-[0.18em]">{dateLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 cf-chip px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-white/70">
          <Sparkles className="w-3.5 h-3.5 text-[oklch(0.65_0.25_25)]" />
          Escrow Active
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.04] py-1.5 pl-1.5 pr-3">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" /> : user?.name?.[0]}
          </div>
          <span className="hidden sm:block text-sm text-white/78">{user?.name}</span>
        </div>
      </div>
    </header>
  )
}
