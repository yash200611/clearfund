import { useEffect, useState } from 'react'
import { DollarSign, ExternalLink, Lock, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/glass-card'
import { getMyDonations } from '@/api/client'
import type { Donation } from '@/api/client'

export default function MyDonations() {
  const [donations, setDonations] = useState<Donation[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    getMyDonations().then(setDonations).catch(() => {})
  }, [])

  const total = donations.reduce((s, d) => s + d.amount_sol, 0)
  const released = donations.reduce((s, d) => s + d.released_sol, 0)
  const locked = donations.reduce((s, d) => s + d.locked_sol, 0)

  return (
    <div className="cf-page max-w-6xl space-y-6 pb-10">
      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-2">Donor Ledger</p>
        <h2 className="cf-display text-4xl md:text-5xl text-white">My Donations</h2>
        <p className="text-sm text-white/58 mt-3">Every transfer, escrow state, and impact release in one operational timeline.</p>
      </GlassCard>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: DollarSign, label: 'Total Given', value: `${total.toFixed(2)} SOL`, hint: 'Capital deployed' },
          { icon: TrendingUp, label: 'Released', value: `${released.toFixed(2)} SOL`, hint: 'Cleared after verification' },
          { icon: Lock, label: 'Escrow Locked', value: `${locked.toFixed(2)} SOL`, hint: 'Still milestone-gated' },
        ].map(({ icon: Icon, label, value, hint }, i) => (
          <GlassCard key={label} className="p-5 cf-animate-in" style={{ animationDelay: `${90 + i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">{label}</p>
              <div className="w-9 h-9 rounded-xl border border-white/[0.15] bg-white/[0.05] flex items-center justify-center">
                <Icon className="w-4 h-4 text-white/70" />
              </div>
            </div>
            <p className="cf-display text-3xl text-white mt-3">{value}</p>
            <p className="text-xs text-white/48 mt-1">{hint}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5 md:p-6 cf-animate-in cf-stagger-2" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="cf-section-title text-2xl text-white">Transfer Timeline</h3>
          <p className="text-xs text-white/45 uppercase tracking-[0.14em]">{donations.length} entries</p>
        </div>

        {donations.length === 0 ? (
          <div className="py-14 text-center">
            <p className="cf-section-title text-3xl text-white/80">No donations yet</p>
            <p className="text-sm text-white/45 mt-2">Explore campaigns to deploy your first contribution.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {donations.map((d) => (
              <button
                key={d._id}
                onClick={() => navigate(`/campaigns/${d.campaign_id}`)}
                className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] transition-all p-4 text-left"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-white font-semibold">{d.campaign_title ?? d.campaign_id}</p>
                    <p className="text-xs text-white/45 mt-0.5">{d.ngo_name ?? 'Unknown NGO'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-right">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/38">Amount</p>
                      <p className="text-sm text-white tabular-nums">{d.amount_sol.toFixed(2)} SOL</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/38">Released</p>
                      <p className="text-sm text-emerald-300 tabular-nums">{d.released_sol.toFixed(2)} SOL</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/38">Locked</p>
                      <p className="text-sm text-[oklch(0.65_0.25_25)] tabular-nums">{d.locked_sol.toFixed(2)} SOL</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-white/40 flex items-center justify-between">
                  <span>{d.created_at?.slice(0, 10)}</span>
                  {d.solana_tx ? (
                    <a
                      href={(() => {
                        const network = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? 'devnet'
                        const rpc = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined
                        if (network === 'localnet') {
                          return `https://explorer.solana.com/tx/${d.solana_tx}?cluster=custom&customUrl=${encodeURIComponent(rpc ?? 'http://127.0.0.1:8899')}`
                        }
                        return `https://explorer.solana.com/tx/${d.solana_tx}?cluster=${network}`
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[oklch(0.65_0.25_25)] hover:text-white transition-colors"
                    >
                      <span className="font-mono">{d.solana_tx.slice(0, 16)}...</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono">Pending...</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
