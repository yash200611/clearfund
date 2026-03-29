import { Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface TopBarProps {
  title: string
  onMenuClick?: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const { user } = useAuth()
  return (
    <header className="h-16 border-b border-white/[0.08] flex items-center justify-between px-4 sm:px-6 bg-black/45 backdrop-blur-2xl flex-shrink-0">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button onClick={onMenuClick} className="lg:hidden text-white/60 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="cf-display text-lg text-white">{title}</h1>
          <p className="hidden sm:block text-[10px] tracking-[0.2em] uppercase text-white/32 -mt-0.5">Operational Console</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[oklch(0.65_0.25_25)] bg-[oklch(0.65_0.25_25)]/10 border border-[oklch(0.65_0.25_25)]/25 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
          Escrow Active
        </span>
        <div className="flex items-center gap-2 rounded-full bg-white/[0.03] border border-white/[0.1] py-1.5 pl-1.5 pr-3">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" />
              : user?.name?.[0]}
          </div>
          <span className="hidden sm:block text-sm text-white/70 font-medium">{user?.name}</span>
        </div>
      </div>
    </header>
  )
}
