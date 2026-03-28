import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '@/components/ui/glass-card'
import { EscrowProgressBar } from '@/components/EscrowProgressBar'
import { getMyDonations } from '@/api/client'
import type { Donation } from '@/data/seed'

export default function MyDonations() {
  const [donations, setDonations] = useState<Donation[]>([])
  const navigate = useNavigate()

  useEffect(() => { getMyDonations().then(setDonations) }, [])

  const total = donations.reduce((s, d) => s + d.amount, 0)
  const released = donations.reduce((s, d) => s + d.released_portion, 0)
  const inEscrow = donations.reduce((s, d) => s + d.refundable_portion, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">My Donations</h2>
        <p className="text-sm text-white/50">Track your impact and escrow status.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: DollarSign, label: 'Total Given', value: `$${total.toLocaleString()}` },
          { icon: TrendingUp, label: 'Impact Delivered', value: `$${released.toLocaleString()}` },
          { icon: Shield, label: 'In Escrow', value: `$${inEscrow.toLocaleString()}` },
        ].map(({ icon: Icon, label, value }) => (
          <GlassCard key={label} className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-white/50" />
            </div>
            <div>
              <p className="text-xl font-black text-white tabular-nums">{value}</p>
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">{label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Campaign', 'NGO', 'Amount', 'Released', 'In Escrow', 'Date', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr key={d.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => navigate(`/campaigns/${d.campaign_id}`)}>
                  <td className="px-5 py-4 text-sm font-medium text-white max-w-[200px]">
                    <span className="line-clamp-1">{d.campaign_title}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/50">{d.ngo_name}</td>
                  <td className="px-5 py-4 text-sm font-bold text-white tabular-nums">${d.amount.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-emerald-400 tabular-nums">${d.released_portion.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-[oklch(0.65_0.25_25)] tabular-nums">${d.refundable_portion.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-white/40">{d.date}</td>
                  <td className="px-5 py-4">
                    <div className="w-52">
                      <EscrowProgressBar goal={d.amount} released={d.released_portion} locked={d.refundable_portion} refunded={0} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
