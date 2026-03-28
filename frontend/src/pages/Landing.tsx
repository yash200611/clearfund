import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ChevronRight, DollarSign, Users, BarChart3, Check } from 'lucide-react'
import { MeshGradient } from '@paper-design/shaders-react'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { GlassCard } from '@/components/ui/glass-card'
import { NGOCarousel } from '@/components/NGOCarousel'
import { CampaignCard } from '@/components/CampaignCard'
import { CAMPAIGNS, PLATFORM_STATS } from '@/data/seed'

export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const stats = [
    { label: 'Total Protected', value: PLATFORM_STATS.total_protected },
    { label: 'Success Rate', value: PLATFORM_STATS.success_rate },
    { label: 'Campaigns', value: String(PLATFORM_STATS.total_campaigns) },
    { label: 'Donors', value: PLATFORM_STATS.total_donors.toLocaleString() },
  ]

  const howItWorks = [
    { num: '01', icon: Users, title: 'NGO Creates Campaign', desc: 'Organizations define milestones with specific deliverables, timelines, and funding amounts locked per stage.' },
    { num: '02', icon: DollarSign, title: 'Donors Give with Confidence', desc: 'Funds enter escrow immediately. Nothing releases until verified milestones are completed.' },
    { num: '03', icon: Check, title: 'Milestones Verified', desc: 'Independent verifiers review evidence before any funds are released to the NGO.' },
    { num: '04', icon: BarChart3, title: 'Auto-Refund if Failed', desc: 'If a milestone fails verification, locked funds automatically return to donors. Zero risk.' },
  ]

  return (
    <div className="min-h-screen bg-black">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <MeshGradient
          className="w-full h-full"
          colors={["#000000", "#1a1a1a", "#333333", "#ffffff"]}
          speed={0.8}
        />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 transition-all duration-500 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/[0.06]' : ''}`}>
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-[oklch(0.65_0.25_25)]" />
          <span className="font-bold text-white text-lg">ClearFund</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-white/60 hover:text-white transition-colors text-sm font-medium px-4 py-2">
            Log in
          </button>
          <MetalButton onClick={() => navigate('/register')}>Get Started</MetalButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[oklch(0.65_0.25_25)]/[0.04] blur-3xl" />
        </div>
        <div className="relative text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40 bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
            Milestone-Based Escrow Donations
          </div>
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white leading-[0.95] mb-6">
            Trust every
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">donation.</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Funds held in escrow. Released only when milestones are independently verified.
            Auto-refunded if promises aren't kept.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <LiquidButton size="xxl" onClick={() => navigate('/campaigns')}>
              EXPLORE CAMPAIGNS
              <ChevronRight className="w-5 h-5" />
            </LiquidButton>
            <MetalButton variant="default" onClick={() => navigate('/register')}>
              LAUNCH A PROJECT
            </MetalButton>
          </div>

          {/* Stats Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center px-10 py-4">
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">{s.value}</p>
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NGO Carousel */}
      <section className="relative py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <NGOCarousel />
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">How It Works</p>
            <h2 className="text-4xl font-bold tracking-tight text-white">Accountability by design.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {howItWorks.map(({ num, icon: Icon, title, desc }) => (
              <GlassCard key={num} className="p-6">
                <div className="text-4xl font-black text-[oklch(0.65_0.25_25)]/40 mb-4">{num}</div>
                <Icon className="w-6 h-6 text-white/50 mb-3" />
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Featured Campaigns</p>
              <h2 className="text-3xl font-bold text-white">Make an impact today.</h2>
            </div>
            <button onClick={() => navigate('/campaigns')} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAMPAIGNS.slice(0, 3).map(c => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.05] bg-white/[0.02] py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />
              <span className="font-bold text-white text-sm">ClearFund</span>
            </div>
            <p className="text-sm text-white/30">Transparent, milestone-based escrow for the social sector.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Platform</p>
            <div className="space-y-2">
              {['Explore Campaigns', 'For NGOs', 'Verification', 'Analytics'].map(l => (
                <p key={l} className="text-sm text-white/40 hover:text-white/60 cursor-pointer transition-colors">{l}</p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Legal</p>
            <div className="space-y-2">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(l => (
                <p key={l} className="text-sm text-white/40 hover:text-white/60 cursor-pointer transition-colors">{l}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-white/[0.05]">
          <p className="text-xs text-white/20">© 2026 ClearFund. All rights reserved. Funds held in regulated escrow accounts.</p>
        </div>
      </footer>
    </div>
  )
}
