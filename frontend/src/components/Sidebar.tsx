import { NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, Search, Heart, Briefcase, CheckSquare, BarChart3, Settings, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Role } from '@/data/seed'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  roles?: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/campaigns', icon: Search, label: 'Explore Campaigns' },
  { to: '/my-donations', icon: Heart, label: 'My Donations', roles: ['donor'] },
  { to: '/ngo-studio', icon: Briefcase, label: 'NGO Studio', roles: ['ngo'] },
  { to: '/verification', icon: CheckSquare, label: 'Verification', roles: ['verifier'] },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth()

  const items = NAV_ITEMS.filter(item => !item.roles || (user && user.role && item.roles.includes(user.role)))

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[linear-gradient(150deg,rgba(17,17,20,0.94),rgba(6,6,9,0.96))] backdrop-blur-2xl border-r border-white/[0.08] flex flex-col transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[oklch(0.65_0.25_25)]" />
            <div>
              <span className="cf-display text-white text-lg">ClearFund</span>
              <p className="text-[10px] tracking-[0.22em] uppercase text-white/35 -mt-0.5">Escrow Network</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3">
          <div className="mb-3 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28">Navigation</p>
          </div>
          <nav className="space-y-1.5">
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] border border-white/[0.2] text-white shadow-[0_14px_24px_-18px_rgba(255,92,41,0.9)]'
                    : 'border border-transparent text-white/52 hover:text-white hover:bg-white/[0.04] hover:border-white/[0.08]'
                )}
              >
                {({ isActive }) => (
                  <>
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                      isActive ? 'bg-[oklch(0.65_0.25_25)]/20 text-[oklch(0.65_0.25_25)]' : 'bg-white/[0.04] text-white/55'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)]" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-3 border-t border-white/[0.08] bg-white/[0.015]">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
              {user?.avatar
                ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" />
                : user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
