import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/glass-card'
import { getMyDonations } from '@/api/client'
import type { Donation } from '@/api/client'

export default function MyDonations() {
  const [donations, setDonations] = useState<Donation[]>([])
  const navigate = useNavigate()

  useEffect(() => { getMyDonations().then(setDonations).catch(() => {}) }, [])

  const total = donations.reduce((s, d) => s + d.amount_sol, 0)
  const released = donations.reduce((s, d) => s + d.released_sol, 0)
  const locked = donations.reduce((s, d) => s + d.locked_sol, 0)

  return (
    <div className="cf-page max-w-6xl space-y-6">
      <div className="cf-animate-in">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35 mb-2">Donor Ledger</p>
        <h2 className="cf-section-title text-3xl sm:text-4xl font-bold text-white mb-1">My Donations</h2>
        <p className="text-sm text-white/55">Track your impact and escrow status.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: DollarSign, label: 'Total Given', value: `${total.toFixed(2)} SOL` },
          { icon: TrendingUp, label: 'Impact Delivered', value: `${released.toFixed(2)} SOL` },
          { icon: Shield, label: 'In Escrow', value: `${locked.toFixed(2)} SOL` },
        ].map(({ icon: Icon, label, value }, i) => (
          <GlassCard key={label} className="p-5 flex items-center gap-4 cf-animate-in" style={{ animationDelay: `${110 + i * 70}ms` }}>
            <div className="w-11 h-11 rounded-2xl bg-white/[0.07] flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-white/50" />
            </div>
            <div>
              <p className="cf-display text-2xl font-black text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/45 uppercase tracking-[0.14em] font-semibold">{label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard hover={false} className="cf-animate-in cf-stagger-2">
        {donations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-white/40 font-semibold">No donations yet</p>
            <p className="text-white/30 text-sm mt-1">Explore campaigns to make your first donation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Campaign', 'NGO', 'Amount', 'Released', 'In Escrow', 'Date', 'Tx'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 px-5 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donations.map(d => (
                  <tr key={d._id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    onClick={() => navigate(`/campaigns/${d.campaign_id}`)}>
                    <td className="px-5 py-4 text-sm font-medium text-white max-w-[180px]">
                      <span className="line-clamp-1">{d.campaign_title ?? d.campaign_id}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">{d.ngo_name ?? '—'}</td>
                    <td className="px-5 py-4 text-sm font-bold text-white tabular-nums">{d.amount_sol.toFixed(2)} SOL</td>
                    <td className="px-5 py-4 text-sm text-emerald-400 tabular-nums">{d.released_sol.toFixed(2)} SOL</td>
                    <td className="px-5 py-4 text-sm text-[oklch(0.65_0.25_25)] tabular-nums">{d.locked_sol.toFixed(2)} SOL</td>
                    <td className="px-5 py-4 text-sm text-white/40">{d.created_at?.slice(0, 10)}</td>
                    <td className="px-5 py-4 text-xs text-white/30 font-mono max-w-[80px] truncate">{d.solana_tx?.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
