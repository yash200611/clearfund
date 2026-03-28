interface EscrowProgressBarProps {
  goal: number
  released: number
  locked: number
  refunded: number
}

export function EscrowProgressBar({ goal, released, locked, refunded }: EscrowProgressBarProps) {
  const releasedPct = Math.min(100, (released / goal) * 100)
  const lockedPct = Math.min(100 - releasedPct, (locked / goal) * 100)
  const refundedPct = Math.min(100 - releasedPct - lockedPct, (refunded / goal) * 100)

  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
      <div className="h-full bg-white rounded-l-full transition-all duration-700" style={{ width: `${releasedPct}%` }} />
      <div className="h-full bg-[oklch(0.65_0.25_25)] transition-all duration-700" style={{ width: `${lockedPct}%` }} />
      <div className="h-full bg-red-500 rounded-r-full transition-all duration-700" style={{ width: `${refundedPct}%` }} />
    </div>
  )
}
