'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { usePageTitle } from '@/hooks/use-page-title'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getMyAssessmentSessions } from '@/actions/assessment-actions'
import { User, Mail, Briefcase, LogOut, Trophy, Clock, Bell, BellOff, Globe, Lock } from 'lucide-react'
import type { SessionWithAssessment } from '@/types/database'

const COMMON_TIMEZONES = [
  'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver',
  'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo',
  'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
]

/**
 * Profile Settings Page
 * Allows users to view/update profile, timezone, notification prefs, and assessment history.
 */
export default function ProfilePage() {
  usePageTitle('Profile')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // User data
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [department, setDepartment] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [examReminders, setExamReminders] = useState(true)

  // Assessment history
  const [completedSessions, setCompletedSessions] = useState<SessionWithAssessment[]>([])

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setEmail(user.email || '')
        setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '')
        setDepartment(user.user_metadata?.department || '')
        setTimezone(user.user_metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
        setExamReminders(user.user_metadata?.exam_reminders !== false)

        // Read email_notifications from profiles table (source of truth for email dispatch)
        // Falls back to user_metadata if profiles column doesn't exist yet
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_notifications')
          .eq('id', user.id)
          .single()
        if (profile && profile.email_notifications !== undefined && profile.email_notifications !== null) {
          setEmailNotifications(profile.email_notifications !== false)
        } else {
          setEmailNotifications(user.user_metadata?.email_notifications !== false)
        }
      }

      // Load assessment history
      const sessResult = await getMyAssessmentSessions()
      if (sessResult.ok && sessResult.data) {
        setCompletedSessions(sessResult.data.filter((s) => s.status === 'completed'))
      }

      setIsLoading(false)
    }
    loadUser()
  }, [])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createSupabaseBrowserClient()

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          name: displayName,
          department: department || null,
          timezone,
          email_notifications: emailNotifications,
          exam_reminders: examReminders,
        },
      })

      if (updateError) {
        setError(updateError.message)
        setIsSaving(false)
        return
      }

      // Sync email_notifications to profiles table (used by email dispatch system)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ email_notifications: emailNotifications })
          .eq('id', user.id)
      }

      setSuccess('Profil berhasil diperbarui!')
    } catch {
      setError('Gagal memperbarui profil. Silakan coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Pengaturan Profil
      </h1>

      <Card variant="elevated" padding="lg" className="mb-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-4">
          {/* Email (read-only) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Mail className="h-4 w-4" />
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <User className="h-4 w-4" />
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department (optional) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Briefcase className="h-4 w-4" />
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., Operations, Logistics, HR"
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Optional — helps admins organize assessments</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          loading={isSaving}
          className="w-full mt-6"
        >
          Simpan Perubahan
        </Button>
      </Card>

      {/* Timezone */}
      <Card variant="elevated" padding="lg" className="mb-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />
          Timezone
        </h2>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">Used for scheduling reminders and displaying times</p>
      </Card>

      {/* Notification Preferences */}
      <Card variant="elevated" padding="lg" className="mb-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" />
          Notification Preferences
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Email notifications</span>
            </div>
            <button
              type="button"
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                emailNotifications ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              role="switch"
              aria-checked={emailNotifications}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${emailNotifications ? 'translate-x-5' : ''}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              {examReminders ? <Bell className="h-4 w-4 text-slate-400" /> : <BellOff className="h-4 w-4 text-slate-400" />}
              <span className="text-sm text-slate-700 dark:text-slate-300">Assessment reminders</span>
            </div>
            <button
              type="button"
              onClick={() => setExamReminders(!examReminders)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                examReminders ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              role="switch"
              aria-checked={examReminders}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${examReminders ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>
      </Card>

      {/* Change Password */}
      <ChangePasswordCard />

      {/* Assessment History Summary */}
      {completedSessions.length > 0 && (
        <Card variant="elevated" padding="lg" className="mb-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-green-500" />
            Assessment History
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{completedSessions.length}</div>
              <div className="text-xs text-slate-500">Taken</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {completedSessions.filter((s) => s.passed).length}
              </div>
              <div className="text-xs text-slate-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {completedSessions.length > 0
                  ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / completedSessions.length)
                  : 0}%
              </div>
              <div className="text-xs text-slate-500">Avg Score</div>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {completedSessions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-slate-700 dark:text-slate-300 truncate">{s.assessment_title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-slate-500 text-xs">
                    {new Date(s.completed_at ?? s.created_at).toLocaleDateString()}
                  </span>
                  <span className={`font-medium ${s.passed ? 'text-green-600' : 'text-red-500'}`}>
                    {s.score ?? 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          {completedSessions.length > 5 && (
            <p className="text-xs text-slate-400 text-center mt-2">
              +{completedSessions.length - 5} more
            </p>
          )}
        </Card>
      )}

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Keluar
      </button>
    </div>
  )
}

function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleChangePassword() {
    setMessage(null)
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setSaving(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update password' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="elevated" padding="lg" className="mb-6">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-slate-500" />
        Ubah Password
      </h2>
      {message && (
        <div className={`mb-3 p-2.5 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
            : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
        }`}>
          {message.text}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label htmlFor="new-pw" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">New Password</label>
          <input
            id="new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            autoComplete="new-password"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="confirm-pw" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            minLength={8}
            autoComplete="new-password"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <Button onClick={handleChangePassword} loading={saving} variant="secondary" className="w-full mt-4">
        Perbarui Password
      </Button>
    </Card>
  )
}
