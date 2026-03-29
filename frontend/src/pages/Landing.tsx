import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ChevronRight, DollarSign, Users, BarChart3, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { MeshGradient } from '@paper-design/shaders-react'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { GlassCard } from '@/components/ui/glass-card'
import { NGOCarousel } from '@/components/NGOCarousel'
import { CampaignCard } from '@/components/CampaignCard'
import { RadialOrbitalTimelineDemo } from '@/components/blocks/radial-orbital-timeline-demo'
import { SectionMockupDemoPage } from '@/components/blocks/section-with-mockup-demo'
import { getCampaigns } from '@/api/client'
import type { Campaign } from '@/api/client'
import { PLATFORM_STATS } from '@/data/seed'

const HERO_KEYWORDS = ['donation', 'milestone', 'disbursement', 'refund']

interface HeroStat {
  label: string
  target: number
  prefix?: string
  suffix?: string
  decimals?: number
  grouped?: boolean
}

function formatStat(value: number, stat: HeroStat) {
  const fixed = value.toLocaleString(undefined, {
    minimumFractionDigits: stat.decimals ?? 0,
    maximumFractionDigits: stat.decimals ?? 0,
    useGrouping: stat.grouped ?? false,
  })
  return `${stat.prefix ?? ''}${fixed}${stat.suffix ?? ''}`
}

export default function Landing() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [featuredCampaigns, setFeaturedCampaigns] = useState<Campaign[]>([])
  const [keywordIndex, setKeywordIndex] = useState(0)
  const [typedKeyword, setTypedKeyword] = useState('')
  const [isDeletingKeyword, setIsDeletingKeyword] = useState(false)

  const stats = useMemo<HeroStat[]>(
    () => [
      { label: 'Total Protected', target: 12.4, prefix: '$', suffix: 'M', decimals: 1 },
      { label: 'Success Rate', target: 91, suffix: '%', decimals: 0 },
      { label: 'Campaigns', target: PLATFORM_STATS.total_campaigns, decimals: 0 },
      { label: 'Donors', target: PLATFORM_STATS.total_donors, grouped: true, decimals: 0 },
    ],
    [],
  )
  const [statValues, setStatValues] = useState<number[]>(() => stats.map(() => 0))

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  useEffect(() => {
    getCampaigns()
      .then((data) => setFeaturedCampaigns(data.slice(0, 3)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const activeKeyword = HERO_KEYWORDS[keywordIndex]
    const isTyping = !isDeletingKeyword

    const nextDelay = isTyping
      ? typedKeyword === activeKeyword
        ? 1300
        : 70
      : typedKeyword === ''
        ? 250
        : 35

    const timer = window.setTimeout(() => {
      if (isTyping) {
        if (typedKeyword === activeKeyword) {
          setIsDeletingKeyword(true)
          return
        }
        setTypedKeyword(activeKeyword.slice(0, typedKeyword.length + 1))
        return
      }

      if (typedKeyword === '') {
        setIsDeletingKeyword(false)
        setKeywordIndex((prev) => (prev + 1) % HERO_KEYWORDS.length)
        return
      }

      setTypedKeyword(activeKeyword.slice(0, typedKeyword.length - 1))
    }, nextDelay)

    return () => window.clearTimeout(timer)
  }, [keywordIndex, typedKeyword, isDeletingKeyword])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const reducedMotionRaf = window.requestAnimationFrame(() => {
        setStatValues(stats.map((s) => s.target))
      })
      return () => window.cancelAnimationFrame(reducedMotionRaf)
    }

    let raf = 0
    let start: number | null = null
    const duration = 1700

    const step = (timestamp: number) => {
      if (start === null) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setStatValues(stats.map((s) => s.target * eased))
      if (progress < 1) raf = window.requestAnimationFrame(step)
    }

    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [stats])

  const howItWorks = [
    {
      num: '01',
      icon: Users,
      title: 'NGO Creates Campaign',
      desc: 'Organizations define milestones with specific deliverables, timelines, and funding amounts locked per stage.',
    },
    {
      num: '02',
      icon: DollarSign,
      title: 'Donors Give with Confidence',
      desc: 'Funds enter escrow immediately. Nothing releases until verified milestones are completed.',
    },
    {
      num: '03',
      icon: Check,
      title: 'Milestones Verified',
      desc: 'Independent verifiers review evidence before any funds are released to the NGO.',
    },
    {
      num: '04',
      icon: BarChart3,
      title: 'Auto-Refund if Failed',
      desc: "If a milestone fails verification, locked funds automatically return to donors. Zero risk.",
    },
  ]

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none">
        <MeshGradient className="w-full h-full" colors={['#000000', '#1a1a1a', '#333333', '#ffffff']} speed={0.8} />
      </div>

      <nav
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 h-16 transition-all duration-500 ${
          scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/[0.06]' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <img src="/favicon.ico" alt="Aidex" className="w-5 h-5" />
          <span className="font-bold text-white text-lg">Aidex</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => isAuthenticated ? navigate('/dashboard') : login()}
            className="text-white/60 hover:text-white transition-colors text-sm font-medium px-4 py-2"
          >
            Log in
          </button>
          <MetalButton onClick={() => isAuthenticated ? navigate('/dashboard') : login({ screen_hint: 'signup' })}>Get Started</MetalButton>
        </div>
      </nav>

      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[oklch(0.65_0.25_25)]/[0.04] blur-3xl" />
        </div>
        <div className="relative text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40 bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.25_25)] animate-pulse" />
            Milestone-Based Escrow Donations
          </div>
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white leading-[0.95] mb-6 min-h-[1.95em]">
            Trust every
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">
              {typedKeyword}
            </span>
            <span className="text-white">.</span>
            <span className="inline-block w-[0.55ch] text-white/90 animate-pulse align-top">|</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Funds held in escrow. Released only when milestones are independently verified. Auto-refunded if promises
            are not kept.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center sm:items-stretch gap-4 mb-16 w-full max-w-3xl mx-auto">
            <LiquidButton
              size="xxl"
              className="w-full sm:w-auto sm:min-w-[18rem]"
              onClick={() => navigate('/campaigns')}
            >
              EXPLORE CAMPAIGNS
              <ChevronRight className="w-5 h-5" />
            </LiquidButton>
            <MetalButton
              className="h-14 px-10 text-base w-full sm:w-auto sm:min-w-[18rem]"
              variant="default"
              onClick={() => isAuthenticated ? navigate('/dashboard') : login({ screen_hint: 'signup' })}
            >
              LAUNCH A PROJECT
            </MetalButton>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center px-10 py-4">
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">
                  {formatStat(statValues[i] ?? 0, s)}
                </p>
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionMockupDemoPage />
      <RadialOrbitalTimelineDemo />

      <section className="relative py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <NGOCarousel />
        </div>
      </section>

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

      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Featured Campaigns</p>
              <h2 className="text-3xl font-bold text-white">Make an impact today.</h2>
            </div>
            <button
              onClick={() => navigate('/campaigns')}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredCampaigns.map((c) => (
              <CampaignCard key={c._id} campaign={c} />
            ))}
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.05] bg-white/[0.02] py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/favicon.ico" alt="Aidex" className="w-4 h-4" />
              <span className="font-bold text-white text-sm">Aidex</span>
            </div>
            <p className="text-sm text-white/30">Transparent, milestone-based escrow for the social sector.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Platform</p>
            <div className="space-y-2">
              {['Explore Campaigns', 'For NGOs', 'Verification', 'Analytics'].map((l) => (
                <p key={l} className="text-sm text-white/40 hover:text-white/60 cursor-pointer transition-colors">
                  {l}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Legal</p>
            <div className="space-y-2">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (
                <p key={l} className="text-sm text-white/40 hover:text-white/60 cursor-pointer transition-colors">
                  {l}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-white/[0.05]">
          <p className="text-xs text-white/20">&copy; 2026 Aidex. All rights reserved. Funds held in regulated escrow accounts.</p>
        </div>
      </footer>
    </div>
  )
}
