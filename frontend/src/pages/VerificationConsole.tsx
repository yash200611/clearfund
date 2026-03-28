import { useEffect, useState } from 'react'
import { CheckSquare, Clock, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { MetalButton } from '@/components/ui/metal-button'
import { StatusBadge } from '@/components/StatusBadge'
import { getVerificationQueue, reviewMilestone } from '@/api/client'
import type { Milestone } from '@/api/client'

export default function VerificationConsole() {
  const [queue, setQueue] = useState<Milestone[]>([])
  const [selected, setSelected] = useState<Milestone | null>(null)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => { getVerificationQueue().then(setQueue).catch(() => {}) }, [])

  const handle = async (decision: 'approve' | 'reject') => {
    if (!selected) return
    setProcessing(true)
    try {
      await reviewMilestone(selected._id, decision, notes)
      toast.success(decision === 'approve'
        ? '✓ Milestone approved — funds released!'
        : '✗ Milestone rejected — donor refund triggered.')
      setQueue(q => q.filter(i => i._id !== selected._id))
      setSelected(null)
      setNotes('')
    } catch {
      toast.error('Review failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const totalValue = queue.reduce((s, m) => s + m.amount_sol, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Verification Console</h2>
        <p className="text-sm text-white/50">Review milestone evidence and release or reject funds.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: CheckSquare, label: 'Pending Review', value: String(queue.length) },
          { icon: DollarSign, label: 'Total Value', value: `${totalValue.toFixed(2)} SOL` },
          { icon: Clock, label: 'Avg. Wait Time', value: '1.2 days' },
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Queue */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Review Queue</h3>
          {queue.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <CheckSquare className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 font-semibold">Queue is clear!</p>
            </GlassCard>
          ) : queue.map(item => (
            <GlassCard key={item._id}
              className={`p-5 cursor-pointer border-2 transition-all ${selected?._id === item._id ? 'border-[oklch(0.65_0.25_25)]/40 bg-[oklch(0.65_0.25_25)]/[0.04]' : 'border-transparent'}`}
              onClick={() => setSelected(item)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/40">{item.campaign_id}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span className="font-mono text-white/30">{item._id.slice(0, 12)}…</span>
                <span className="font-bold text-white">{item.amount_sol} SOL</span>
              </div>
              <p className="text-xs text-white/30 mt-2">Due: {item.due_date}</p>
            </GlassCard>
          ))}
        </div>

        {/* Review Panel */}
        <div>
          {!selected ? (
            <GlassCard className="p-8 text-center h-full flex flex-col items-center justify-center min-h-[200px]">
              <CheckSquare className="w-8 h-8 text-white/20 mb-2" />
              <p className="text-white/40 font-semibold">Select a milestone to review</p>
            </GlassCard>
          ) : (
            <GlassCard className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{selected.title}</h3>
                <p className="text-xs text-white/40 font-mono">{selected._id}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Description</p>
                <p className="text-sm text-white/70">{selected.description}</p>
              </div>

              {selected.evidence_urls?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Evidence URLs</p>
                  <div className="space-y-1">
                    {selected.evidence_urls.map((url, i) => (
                      <div key={i} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 break-all">{url}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Reviewer Notes (Optional)</p>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Add notes about your decision..."
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all resize-none"
                />
              </div>

              <div className="bg-amber-500/[0.08] border border-amber-500/[0.15] rounded-xl p-3 text-xs text-amber-400/80">
                Approving will release <strong>{selected.amount_sol} SOL</strong> to the NGO. Rejecting triggers donor refunds.
              </div>

              <div className="flex gap-3">
                <MetalButton variant="success" onClick={() => handle('approve')} disabled={processing} className="flex-1">
                  {processing ? 'Processing...' : '✓ Approve & Release'}
                </MetalButton>
                <MetalButton variant="error" onClick={() => handle('reject')} disabled={processing} className="flex-1">
                  {processing ? '...' : '✗ Reject'}
                </MetalButton>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
