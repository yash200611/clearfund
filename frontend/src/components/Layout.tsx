import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/campaigns': 'Explore Campaigns',
  '/my-donations': 'My Donations',
  '/ngo-studio': 'NGO Studio',
  '/verification': 'Verification Console',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'ClearFund'

  return (
    <div className="cf-app-shell relative flex h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,87,34,0.2),transparent_36%),radial-gradient(circle_at_82%_8%,rgba(0,229,255,0.14),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(255,138,101,0.08),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02),transparent_40%)]" />
        <div className="cf-grid-overlay absolute inset-0 opacity-35" />
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
