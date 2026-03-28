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
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-black">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
