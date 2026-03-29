import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Mission Control',
  '/campaigns': 'Campaign Discovery',
  '/my-donations': 'Donation Ledger',
  '/ngo-studio': 'NGO Studio',
  '/verification': 'Verification Console',
  '/analytics': 'Intelligence',
  '/settings': 'Settings',
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Aidex'

  return (
    <div className="cf-app-shell relative flex h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0.03),transparent_38%,rgba(255,255,255,0.02)_70%,transparent)]" />
        <div className="cf-grid-overlay absolute inset-0 opacity-35" />
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative z-10 flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
