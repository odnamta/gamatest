'use client'

/**
 * V13 Phase 7: Public Organization Join Page
 *
 * Candidates access this page via a shareable link to join an org.
 * Requires authentication — the middleware handles redirect to login.
 * Placed outside (app) group to avoid org context requirement.
 */

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { joinOrgBySlug } from '@/actions/org-actions'
import { Button } from '@/components/ui/Button'

export default function JoinOrgPage() {
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [orgName, setOrgName] = useState('')

  async function handleJoin() {
    setJoining(true)
    setError(null)

    const result = await joinOrgBySlug(orgSlug)
    if (result.ok && result.data) {
      setJoined(true)
      setOrgName(result.data.orgName)
      setTimeout(() => router.push('/dashboard'), 2000)
    } else if (!result.ok) {
      setError(result.error)
      setJoining(false)
    }
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-sm w-full text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome!
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            You have joined <span className="font-semibold">{orgName}</span>. Redirecting to dashboard...
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
            Join Organization
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Join <span className="font-semibold">{orgSlug}</span> on Cekatan as a candidate.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleJoin}
            loading={joining}
            disabled={joining}
            className="w-full"
          >
            Join as Candidate
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
