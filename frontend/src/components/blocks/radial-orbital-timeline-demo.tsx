'use client'

import {
  BarChart3,
  Bot,
  CheckCircle2,
  HandCoins,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline'

const timelineData = [
  {
    id: 1,
    title: 'Campaign Launch',
    date: 'Step 01',
    content:
      'NGOs create a campaign with clear goals, milestones, and expected impact before donations begin.',
    category: 'Campaign',
    icon: HandCoins,
    relatedIds: [2, 3],
    status: 'completed' as const,
    energy: 100,
  },
  {
    id: 2,
    title: 'Escrow Lock',
    date: 'Step 02',
    content:
      'Donor funds are locked in escrow first, so money is protected until milestone proof is accepted.',
    category: 'Escrow',
    icon: WalletCards,
    relatedIds: [1, 4],
    status: 'completed' as const,
    energy: 92,
  },
  {
    id: 3,
    title: 'Trust Scoring',
    date: 'Step 03',
    content:
      'Risk and trust indicators update continuously based on campaign behavior and verification outcomes.',
    category: 'Trust',
    icon: ShieldCheck,
    relatedIds: [1, 4, 7],
    status: 'in-progress' as const,
    energy: 74,
  },
  {
    id: 4,
    title: 'AI Review',
    date: 'Step 04',
    content:
      'Submitted milestone evidence is checked through the AI verification pipeline before manual approval.',
    category: 'Verification',
    icon: Bot,
    relatedIds: [2, 3, 5],
    status: 'in-progress' as const,
    energy: 66,
  },
  {
    id: 5,
    title: 'Verifier Decision',
    date: 'Step 05',
    content:
      'Independent verifiers approve or reject each milestone, creating an auditable decision trail.',
    category: 'Governance',
    icon: CheckCircle2,
    relatedIds: [4, 6, 7],
    status: 'pending' as const,
    energy: 45,
  },
  {
    id: 6,
    title: 'Auto Refund',
    date: 'Step 06',
    content:
      'If milestones fail repeatedly, locked funds are routed back to donors through refund safeguards.',
    category: 'Safety',
    icon: RefreshCcw,
    relatedIds: [5, 7],
    status: 'pending' as const,
    energy: 30,
  },
  {
    id: 7,
    title: 'Live Analytics',
    date: 'Step 07',
    content:
      'Transparent dashboards track raised funds, released amounts, escrow balance, and campaign performance.',
    category: 'Analytics',
    icon: BarChart3,
    relatedIds: [3, 5, 6],
    status: 'in-progress' as const,
    energy: 58,
  },
]

export function RadialOrbitalTimelineDemo() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),rgba(255,255,255,0)_55%)]" />
      <div className="max-w-6xl mx-auto px-6 md:px-10 mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">System Overview</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
          How Aidex protects every donation.
        </h2>
        <p className="text-sm md:text-base text-white/50 max-w-3xl">
          This orbital timeline maps your platform flow from campaign launch to escrow controls, verification, and
          analytics transparency.
        </p>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="relative rounded-[28px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_35px_120px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,rgba(255,255,255,0)_72%)]" />
          <RadialOrbitalTimeline timelineData={timelineData} />
        </div>
      </div>
    </section>
  )
}
