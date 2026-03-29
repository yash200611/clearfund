import { useState } from 'react'
import { Bell, Lock, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
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
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all duration-300 relative ${checked ? 'bg-[oklch(0.65_0.25_25)]' : 'bg-white/15'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300 ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )

  return (
    <div className="cf-page max-w-5xl space-y-6 pb-10">
      <GlassCard className="p-6 md:p-8 cf-animate-in" glow>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 mb-2">Account Surface</p>
        <h2 className="cf-display text-4xl md:text-5xl text-white">Settings</h2>
        <p className="text-sm text-white/58 mt-3">Manage identity, security controls, and communication preferences.</p>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-6 cf-animate-in cf-stagger-1">
          <div className="flex items-center gap-2 mb-5">
            <User2 className="w-4 h-4 text-white/70" />
            <h3 className="cf-section-title text-2xl text-white">Profile</h3>
          </div>

          <div className="flex items-center gap-4 pb-4 border-b border-white/[0.08] mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/16 flex items-center justify-center text-xl font-black text-white overflow-hidden">
              {user?.avatar ? <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" /> : user?.name?.[0]}
            </div>
            <div>
              <p className="text-white font-semibold">{user?.name}</p>
              <p className="text-xs text-white/43 capitalize">{user?.role}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="cf-soft-input" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="cf-soft-input" />
            </div>
            <LiquidButton onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </LiquidButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 cf-animate-in cf-stagger-2">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-white/70" />
            <h3 className="cf-section-title text-2xl text-white">Notifications</h3>
          </div>
          <div className="space-y-3">
            {([
              ['milestoneUpdates', 'Milestone Updates', 'When milestones are approved or rejected'],
              ['donationReceipts', 'Donation Receipts', 'Email confirmation for each donation'],
              ['refundAlerts', 'Refund Alerts', 'Instant updates on refund events'],
              ['weeklyDigest', 'Weekly Digest', 'Summary of impact and campaign progress'],
            ] as const).map(([key, label, desc]) => (
              <div key={key} className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{label}</p>
                  <p className="text-[11px] text-white/43 mt-0.5">{desc}</p>
                </div>
                <Toggle checked={notifications[key]} onChange={() => setNotifications((n) => ({ ...n, [key]: !n[key] }))} />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6 cf-animate-in cf-stagger-3">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-white/70" />
          <h3 className="cf-section-title text-2xl text-white">Security</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">Current Password</label>
            <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="cf-soft-input" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-white/45 mb-2 block">New Password</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="cf-soft-input" />
          </div>
        </div>
        <div className="pt-4 flex gap-3">
          <button
            onClick={savePassword}
            disabled={saving}
            className="h-11 px-5 rounded-xl border border-white/[0.18] bg-white/[0.05] text-sm text-white/78 hover:text-white hover:bg-white/[0.09] transition-all"
          >
            Change Password
          </button>
          <button
            onClick={() => toast.error('Account deletion requires email confirmation.')}
            className="h-11 px-5 rounded-xl border border-red-400/35 bg-red-500/10 text-sm text-red-200 hover:bg-red-500/18 transition-all"
          >
            Delete Account
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
