'use client'

/**
 * V13: Invitation Accept Page
 *
 * Authenticated users land here from an invitation link.
 * Shows org name and role, allows accepting the invitation.
 * Placed outside (app) group to avoid org context requirement.
 */

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { acceptInvitation } from '@/actions/invitation-actions'
import { Button } from '@/components/ui/Button'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    setError(null)

    const result = await acceptInvitation(token)
    if (result.ok) {
      setAccepted(true)
      // Redirect to dashboard after short delay
      setTimeout(() => router.push('/dashboard'), 2000)
    } else if (!result.ok) {
      setError(result.error)
      setAccepting(false)
    }
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-sm w-full text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome!
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            You have joined the organization. Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-sm">
          <Users className="h-12 w-12 mx-auto text-blue-600 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Organization Invitation
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            You have been invited to join an organization on Cekatan.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleAccept}
            loading={accepting}
            disabled={accepting}
            className="w-full"
          >
            Accept Invitation
          </Button>

          <button
            onClick={() => router.push('/dashboard')}
            className="mt-3 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
