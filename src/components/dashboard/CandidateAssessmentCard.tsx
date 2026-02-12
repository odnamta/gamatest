'use client'

/**
 * V13 Phase 8: Candidate Assessment Overview
 *
 * Shows upcoming assessments, recent results, and quick stats.
 * Self-gates: only renders for candidates (non-creators).
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle2, XCircle, Clock, Target, CalendarDays } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getOrgAssessments, getMyAssessmentSessions } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import type { AssessmentWithDeck, SessionWithAssessment } from '@/types/database'

export function CandidateAssessmentCard() {
  const { role } = useOrg()
  const router = useRouter()
  const isCreator = hasMinimumRole(role, 'creator')

  const [assessments, setAssessments] = useState<AssessmentWithDeck[]>([])
  const [sessions, setSessions] = useState<SessionWithAssessment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isCreator) {
      setLoading(false)
      return
    }
    async function load() {
      const [aResult, sResult] = await Promise.all([
        getOrgAssessments(),
        getMyAssessmentSessions(),
      ])
      if (aResult.ok) setAssessments(aResult.data ?? [])
      if (sResult.ok) setSessions(sResult.data ?? [])
      setLoading(false)
    }
    load()
  }, [isCreator])

  // Don't render for creators (they have OrgStatsCard)
  if (isCreator || loading) return null
  if (assessments.length === 0 && sessions.length === 0) return null

  const now = new Date()
  const upcoming = assessments.filter((a) => {
    if (a.start_date && new Date(a.start_date) > now) return true
    return false
  })
  const available = assessments.filter((a) => {
    const isUpcoming = a.start_date && new Date(a.start_date) > now
    const isClosed = a.end_date && new Date(a.end_date) < now
    return !isUpcoming && !isClosed
  })
  const recentResults = sessions
    .filter((s) => s.status === 'completed')
    .slice(0, 5)

  const totalCompleted = sessions.filter((s) => s.status === 'completed').length
  const totalPassed = sessions.filter((s) => s.passed).length
  const passRate = totalCompleted > 0 ? Math.round((totalPassed / totalCompleted) * 100) : 0

  return (
    <div className="mb-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {available.length}
          </div>
          <div className="text-xs text-slate-500">Available</div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {totalCompleted}
          </div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
          <div className="text-xl font-bold text-green-600">
            {passRate}%
          </div>
          <div className="text-xs text-slate-500">Pass Rate</div>
        </div>
      </div>

      {/* Upcoming Assessments */}
      {upcoming.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Upcoming Assessments
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {a.title}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Opens {new Date(a.start_date!).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_minutes}m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available — Quick Take */}
      {available.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Available Now
          </h3>
          <div className="space-y-2">
            {available.slice(0, 3).map((a) => {
              const mySessions = sessions.filter((s) => s.assessment_id === a.id)
              const lastSession = mySessions.find((s) => s.status === 'completed')
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {a.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {a.pass_score}%
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.time_limit_minutes}m
                      </span>
                      {lastSession && (
                        <span className={lastSession.passed ? 'text-green-600' : 'text-red-500'}>
                          Last: {lastSession.score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/assessments/${a.id}/take`)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {lastSession ? 'Retake' : 'Start'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Recent Results
          </h3>
          <div className="space-y-1.5">
            {recentResults.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {s.assessment_title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.completed_at && new Date(s.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${s.passed ? 'text-green-600' : 'text-red-500'}`}>
                    {s.score}%
                  </span>
                  {s.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View All link */}
      <div className="mt-3 text-center">
        <button
          onClick={() => router.push('/assessments')}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all assessments
        </button>
      </div>
    </div>
  )
}
