import { useEffect, useState } from 'react'
import { getPlatformAnalytics } from '@/api/client'
import { GlassCard } from '@/components/ui/glass-card'
import { PLATFORM_STATS } from '@/data/seed'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

type Stats = typeof PLATFORM_STATS

export default function Analytics() {
  const [stats, setStats] = useState<Stats>(PLATFORM_STATS)

  useEffect(() => { getPlatformAnalytics().then(s => setStats(s as Stats)) }, [])

  const chartProps = {
    style: { background: 'transparent' },
  }

  const axisStyle = { fill: 'rgba(255,255,255,0.4)', fontSize: 11 }
  const gridStyle = { stroke: 'rgba(255,255,255,0.05)' }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
        <p className="text-sm text-white/50">Platform-wide donation and escrow metrics.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Protected', value: stats.total_protected },
          { label: 'Success Rate', value: stats.success_rate },
          { label: 'Total Campaigns', value: String(stats.total_campaigns) },
          { label: 'Total Donors', value: stats.total_donors.toLocaleString() },
        ].map(({ label, value }) => (
          <GlassCard key={label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">{label}</p>
            <p className="text-3xl font-black text-white tabular-nums">{value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Monthly Donations Area Chart */}
      <GlassCard className="p-6">
        <h3 className="text-base font-semibold text-white mb-6">Monthly Donations</h3>
        <ResponsiveContainer width="100%" height={220} {...chartProps}>
          <AreaChart data={stats.monthly_donations} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="95%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white' }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Donations']}
            />
            <Area type="monotone" dataKey="amount" stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="url(#wg)" />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category Breakdown Bar Chart */}
        <GlassCard className="p-6">
          <h3 className="text-base font-semibold text-white mb-6">Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={200} {...chartProps}>
            <BarChart data={stats.category_breakdown} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white' }}
                formatter={(v) => [`${Number(v)}%`, 'Share']}
              />
              <Bar dataKey="value" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Escrow Status Pie Chart */}
        <GlassCard className="p-6">
          <h3 className="text-base font-semibold text-white mb-6">Escrow Status</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200} {...chartProps}>
              <PieChart>
                <Pie data={stats.escrow_status} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {stats.escrow_status.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white' }}
                  formatter={(v) => [`$${(Number(v)/1e6).toFixed(1)}M`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {stats.escrow_status.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs text-white/60">{s.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">${(s.value/1e6).toFixed(1)}M</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
