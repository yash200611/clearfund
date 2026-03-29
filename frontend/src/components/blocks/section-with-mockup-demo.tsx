import React from 'react'
import { motion } from 'framer-motion'

const STATS = [
  { label: 'TOTAL RAISED', value: '2.00 SOL' },
  { label: 'RELEASED', value: '0.00 SOL' },
  { label: 'ESCROW LOCKED', value: '2.00 SOL' },
  { label: 'CAMPAIGNS COMPLETE', value: '0' },
  { label: 'MILESTONES APPROVED', value: '0' },
  { label: 'MILESTONES REJECTED', value: '0' },
]

export function SectionMockupDemoPage() {
  return (
    <section className="relative py-24 md:py-36 bg-black overflow-hidden">
      <div className="container max-w-[1220px] w-full px-6 md:px-10 relative z-10 mx-auto">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-8 w-full items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2 } } }}
        >
          <motion.div
            className="flex flex-col items-start gap-4 max-w-[546px] mx-auto md:mx-0"
            variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7 } } }}
          >
            <h2 className="text-white text-3xl md:text-[40px] font-semibold leading-tight md:leading-[53px]">
              Analytics,<br />built for trust.
            </h2>
            <p className="text-[#868f97] text-sm md:text-[15px] leading-6">
              See campaign performance, escrow flow, and milestone outcomes
              in one view. Track what was raised, what was released, and what
              is still protected in escrow with clean, verifiable reporting.
            </p>
          </motion.div>

          <motion.div
            className="relative mx-auto w-full max-w-[520px]"
            variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.2 } } }}
          >
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] backdrop-blur-xl p-5 shadow-[0_0_60px_rgba(0,0,0,0.4)]">
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1">INTELLIGENCE LAYER</p>
                <h3 className="text-2xl font-bold text-white">Platform Analytics</h3>
                <p className="text-xs text-white/40 mt-1">Operational telemetry across escrow rails, campaign lifecycle, and verification confidence.</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {STATS.slice(0, 3).map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/35 mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {STATS.slice(3).map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/35 mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="text-base font-bold text-white mb-3">Verification Health</h4>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div className="h-full w-full rounded-full bg-white/20" />
                  </div>
                  <p className="text-xs text-white/40">0% of reviewed milestones have been approved.</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="text-base font-bold text-white mb-3">AI Throughput</h4>
                  <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2 mb-2">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">AGENT DECISIONS TODAY</p>
                    <p className="text-lg font-bold text-white">0</p>
                  </div>
                  <p className="text-xs text-white/40">Real-time model evaluations across submissions.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
