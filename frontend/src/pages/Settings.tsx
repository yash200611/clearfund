import { useState } from 'react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { MetalButton } from '@/components/ui/metal-button'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, updatePassword } from '@/api/client'

export default function Settings() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [notifications, setNotifications] = useState({
    milestoneUpdates: true,
    donationReceipts: true,
    refundAlerts: true,
    weeklyDigest: false,
  })
  const [saving, setSaving] = useState(false)

  const inputClass = "w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-white/25 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm transition-all"

  const saveProfile = async () => {
    setSaving(true)
    await updateProfile({ name, email })
    setSaving(false)
    toast.success('Profile updated.')
  }

  const savePassword = async () => {
    if (!currentPwd || !newPwd) return
    setSaving(true)
    await updatePassword({ current: currentPwd, next: newPwd })
    setSaving(false)
    toast.success('Password changed.')
    setCurrentPwd('')
    setNewPwd('')
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`w-10 h-6 rounded-full transition-all duration-300 relative ${checked ? 'bg-[oklch(0.65_0.25_25)]' : 'bg-white/15'}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300 ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
        <p className="text-sm text-white/50">Manage your account preferences.</p>
      </div>

      {/* Profile */}
      <GlassCard className="p-6 space-y-5">
        <h3 className="text-base font-semibold text-white">Profile</h3>
        <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-xl font-black text-white overflow-hidden">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" />
              : user?.name?.[0]}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-white/40 capitalize">{user?.role}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <LiquidButton onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'SAVE PROFILE'}</LiquidButton>
      </GlassCard>

      {/* Notifications */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Notifications</h3>
        {([
          ['milestoneUpdates', 'Milestone Updates', 'Get notified when milestones are approved or rejected'],
          ['donationReceipts', 'Donation Receipts', 'Email confirmation for every donation'],
          ['refundAlerts', 'Refund Alerts', 'Instant alert when escrow funds are returned'],
          ['weeklyDigest', 'Weekly Digest', 'Summary of your impact each week'],
        ] as const).map(([key, label, desc]) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-white/40">{desc}</p>
            </div>
            <Toggle checked={notifications[key]} onChange={() => setNotifications(n => ({ ...n, [key]: !n[key] }))} />
          </div>
        ))}
      </GlassCard>

      {/* Security */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Security</h3>
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Current Password</label>
          <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">New Password</label>
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" className={inputClass} />
        </div>
        <MetalButton onClick={savePassword} disabled={saving}>Change Password</MetalButton>
      </GlassCard>

      {/* Danger Zone */}
      <GlassCard className="p-6 border-red-500/20">
        <h3 className="text-base font-semibold text-red-400 mb-1">Danger Zone</h3>
        <p className="text-sm text-white/40 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
        <MetalButton variant="error" onClick={() => toast.error('Account deletion requires email confirmation.')}>
          Delete Account
        </MetalButton>
      </GlassCard>
    </div>
  )
}
