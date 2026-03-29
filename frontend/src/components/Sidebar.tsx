import { NavLink } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  Search,
  Heart,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react'
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

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && user.role && item.roles.includes(user.role)))

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-[18.5rem] p-3 transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="h-full rounded-[1.6rem] border border-white/[0.14] bg-[linear-gradient(165deg,rgba(16,16,24,0.95),rgba(8,8,13,0.92))] backdrop-blur-xl shadow-[0_30px_45px_-34px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.1]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[linear-gradient(145deg,rgba(255,109,62,0.95),rgba(255,145,101,0.65))] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="cf-display text-white text-base leading-none">Aidex</p>
                <p className="text-[10px] text-white/38 uppercase tracking-[0.18em] mt-1">Control Plane</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-white/45 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mx-4 mt-4 rounded-2xl border border-white/[0.12] bg-[linear-gradient(130deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/72 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[oklch(0.65_0.25_25)]" />
              Live Escrow Guardrails
            </div>
            <p className="text-xs text-white/46 mt-2">Every release is gated by milestones and independent review.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pt-4">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] px-2 mb-2">Navigation</p>
            <nav className="space-y-1.5">
              {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-3 rounded-2xl text-sm transition-all border',
                      isActive
                        ? 'border-white/[0.26] bg-[linear-gradient(132deg,rgba(255,255,255,0.17),rgba(255,255,255,0.05))] text-white'
                        : 'border-transparent text-white/55 hover:text-white hover:border-white/[0.08] hover:bg-white/[0.03]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center',
                          isActive ? 'bg-[oklch(0.65_0.25_25)]/20 text-[oklch(0.65_0.25_25)]' : 'bg-white/[0.05] text-white/65',
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="p-3 border-t border-white/[0.1]">
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                  {user?.avatar ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" /> : user?.name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate font-semibold">{user?.name}</p>
                  <p className="text-[11px] text-white/43 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] py-2.5 text-sm text-white/65 hover:text-red-300 hover:border-red-300/30 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
