import { Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface TopBarProps {
  title: string
  onMenuClick?: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const { user } = useAuth()
  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 bg-black/80 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button onClick={onMenuClick} className="lg:hidden text-white/60 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[oklch(0.65_0.25_25)] bg-[oklch(0.65_0.25_25)]/10 border border-[oklch(0.65_0.25_25)]/20 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
          Escrow Active
        </span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white">
            {user?.avatar ?? user?.name?.[0]}
          </div>
          <span className="hidden sm:block text-sm text-white/70 font-medium">{user?.name}</span>
        </div>
      </div>
    </header>
  )
}
