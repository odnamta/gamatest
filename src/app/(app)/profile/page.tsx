'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SPECIALTIES } from '@/components/onboarding/OnboardingModal'
import { enrollInStarterPack } from '@/actions/onboarding-actions'
import { User, Mail, Stethoscope, LogOut } from 'lucide-react'

/**
 * Profile Settings Page
 * V10.5.1: Allows users to view and update their profile settings
 */
export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // User data
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [originalSpecialty, setOriginalSpecialty] = useState('')

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setEmail(user.email || '')
        setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '')
        setSpecialty(user.user_metadata?.specialty || '')
        setOriginalSpecialty(user.user_metadata?.specialty || '')
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
      
      // Update user metadata via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          name: displayName,
          specialty,
        },
      })

      if (updateError) {
        setError(updateError.message)
        setIsSaving(false)
        return
      }

      // If specialty changed, re-enroll in starter pack
      if (specialty !== originalSpecialty && specialty) {
        const enrollResult = await enrollInStarterPack(specialty)
        if (enrollResult.success && enrollResult.enrolledCount > 0) {
          setSuccess(`Profile updated! Added ${enrollResult.enrolledCount} starter deck(s) for ${specialty}.`)
        } else {
          setSuccess('Profile updated successfully!')
        }
        setOriginalSpecialty(specialty)
      } else {
        setSuccess('Profile updated successfully!')
      }
    } catch {
      setError('Failed to update profile. Please try again.')
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
        Profile Settings
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
              placeholder="Dr. Smith"
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Specialty */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Stethoscope className="h-4 w-4" />
              Specialty
            </label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select specialty...</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {specialty !== originalSpecialty && specialty && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Changing specialty will add new starter decks
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={handleSave}
          loading={isSaving}
          className="w-full mt-6"
        >
          Save Changes
        </Button>
      </Card>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </div>
  )
}
