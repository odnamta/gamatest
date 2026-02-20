'use client'

/**
 * V13: Assessment Dashboard
 *
 * Shows available assessments (candidates) or all assessments (creators).
 * Role-based views with session history.
 * Creators get publish/archive/edit controls.
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  Plus, Play, Eye, BarChart3, Clock, Target, CheckCircle2, XCircle,
  Pencil, Send, Archive, CalendarDays, Copy, ChevronDown, Search, Database, Users, Bell, Link2, Trash2, RotateCcw, AlarmClock, UserPlus,
} from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getOrgAssessments,
  getMyAssessmentSessions,
  publishAssessment,
  archiveAssessment,
  duplicateAssessment,
  batchPublishAssessments,
  batchArchiveAssessments,
  batchDeleteAssessments,
  unpublishAssessment,
} from '@/actions/assessment-actions'
import { sendAssessmentReminder, sendDeadlineReminders, assignAssessmentToAll } from '@/actions/notification-actions'
import { hasMinimumRole } from '@/lib/org-authorization'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { AssessmentWithDeck, SessionWithAssessment } from '@/types/database'

export default function AssessmentsPage() {
  usePageTitle('Assessments')
  const { org, role } = useOrg()
  const router = useRouter()
  const [assessments, setAssessments] = useState<AssessmentWithDeck[]>([])
  const [sessions, setSessions] = useState<SessionWithAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [reminderSent, setReminderSent] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all')
  const [displayLimit, setDisplayLimit] = useState(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { showToast } = useToast()
  const isCreator = hasMinimumRole(role, 'creator')

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBatchPublish() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const result = await batchPublishAssessments(ids)
      if (result.ok) {
        showToast(`${result.data?.published ?? 0} assessment(s) published`, 'success')
        setSelectedIds(new Set())
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleBatchArchive() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const result = await batchArchiveAssessments(ids)
      if (result.ok) {
        showToast(`${result.data?.archived ?? 0} assessment(s) archived`, 'success')
        setSelectedIds(new Set())
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleBatchDelete() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const result = await batchDeleteAssessments(ids)
      if (result.ok) {
        showToast(`${result.data?.deleted ?? 0} assessment(s) deleted`, 'success')
        setSelectedIds(new Set())
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [aResult, sResult] = await Promise.all([
      getOrgAssessments(),
      getMyAssessmentSessions(),
    ])
    if (aResult.ok) setAssessments(aResult.data ?? [])
    if (sResult.ok) setSessions(sResult.data ?? [])
    setLoading(false)
  }

  function handlePublish(assessmentId: string) {
    startTransition(async () => {
      const result = await publishAssessment(assessmentId)
      if (result.ok) {
        showToast('Assessment published', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleArchive(assessmentId: string) {
    startTransition(async () => {
      const result = await archiveAssessment(assessmentId)
      if (result.ok) {
        showToast('Assessment archived', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleDuplicate(assessmentId: string) {
    startTransition(async () => {
      const result = await duplicateAssessment(assessmentId)
      if (result.ok) {
        showToast('Assessment duplicated', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleReminder(assessmentId: string) {
    startTransition(async () => {
      const result = await sendAssessmentReminder(assessmentId)
      if (result.ok && result.data) {
        const count = result.data.notified
        const msg = count > 0
          ? `Reminder sent to ${count} candidate${count !== 1 ? 's' : ''}`
          : 'All candidates have already completed this assessment'
        showToast(msg, 'success')
        setReminderSent((prev) => ({
          ...prev,
          [assessmentId]: `Sent to ${count} candidate${count !== 1 ? 's' : ''}`,
        }))
      } else if (!result.ok) {
        showToast(result.error, 'error')
      }
    })
  }

  function handleUnpublish(assessmentId: string) {
    startTransition(async () => {
      const result = await unpublishAssessment(assessmentId)
      if (result.ok) {
        showToast('Assessment reverted to draft', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleCopyLink(assessment: AssessmentWithDeck) {
    const base = `${window.location.origin}/assessments/${assessment.id}/take`
    navigator.clipboard.writeText(base).then(() => {
      showToast('Assessment link copied to clipboard', 'success')
    }).catch(() => {
      showToast('Failed to copy link', 'error')
    })
  }

  function handleDeadlineReminders() {
    startTransition(async () => {
      const result = await sendDeadlineReminders()
      if (result.ok && result.data) {
        const { notified, assessments: count } = result.data
        if (count === 0) {
          showToast('No assessments with upcoming deadlines', 'info')
        } else if (notified === 0) {
          showToast(`${count} assessment(s) closing soon — all candidates have completed`, 'success')
        } else {
          showToast(`Deadline reminders sent to ${notified} candidate(s) for ${count} assessment(s)`, 'success')
        }
      } else if (!result.ok) {
        showToast(result.error, 'error')
      }
    })
  }

  function handleAssign(assessmentId: string) {
    startTransition(async () => {
      const result = await assignAssessmentToAll(assessmentId)
      if (result.ok && result.data) {
        const count = result.data.notified
        showToast(
          count > 0
            ? `Assigned to ${count} candidate${count !== 1 ? 's' : ''} who haven't started`
            : 'All candidates have already started this assessment',
          'success'
        )
      } else if (!result.ok) {
        showToast(result.error, 'error')
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assessments</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{org.name}</p>
        </div>
        {isCreator && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={handleDeadlineReminders} disabled={isPending} title="Send deadline reminders for assessments closing within 24h">
              <AlarmClock className="h-4 w-4 mr-2" />
              Deadline Reminders
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/assessments/candidates')}>
              <Users className="h-4 w-4 mr-2" />
              Candidates
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/assessments/questions')}>
              <Database className="h-4 w-4 mr-2" />
              Question Bank
            </Button>
            <Button size="sm" onClick={() => router.push('/assessments/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            aria-label="Search assessments"
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isCreator && (
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Timeline — shows assessments with dates */}
      {isCreator && (() => {
        const scheduled = assessments.filter(
          (a) => a.status === 'published' && (a.start_date || a.end_date)
        )
        if (scheduled.length === 0) return null
        const now = new Date()
        const sorted = [...scheduled].sort((a, b) => {
          const da = a.end_date || a.start_date || ''
          const db = b.end_date || b.start_date || ''
          return da.localeCompare(db)
        })
        return (
          <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Schedule</span>
            </div>
            <div className="space-y-1.5">
              {sorted.slice(0, 5).map((a) => {
                const start = a.start_date ? new Date(a.start_date) : null
                const end = a.end_date ? new Date(a.end_date) : null
                const isActive = (!start || start <= now) && (!end || end >= now)
                const isClosed = end && end < now
                const isUpcoming = start && start > now
                return (
                  <div key={a.id} className="flex items-center gap-3 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isClosed ? 'bg-slate-300 dark:bg-slate-600' :
                      isUpcoming ? 'bg-amber-400' :
                      'bg-green-500'
                    }`} />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">{a.title}</span>
                    <span className="text-slate-400 whitespace-nowrap">
                      {start ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                      {' → '}
                      {end ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      isClosed ? 'text-slate-400' :
                      isUpcoming ? 'text-amber-600 dark:text-amber-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {isClosed ? 'Closed' : isUpcoming ? 'Upcoming' : 'Active'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Batch Action Bar */}
      {isCreator && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="secondary" onClick={handleBatchPublish} disabled={isPending} loading={isPending}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Publish
            </Button>
            <Button size="sm" variant="secondary" onClick={handleBatchArchive} disabled={isPending} loading={isPending}>
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive
            </Button>
            <Button size="sm" variant="secondary" onClick={handleBatchDelete} disabled={isPending} loading={isPending}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ml-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Available Assessments */}
      {assessments.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No assessments yet</p>
          {isCreator && (
            <p className="mt-1">Create your first assessment to get started.</p>
          )}
        </div>
      ) : (() => {
        const filtered = assessments.filter((a) => {
          if (statusFilter !== 'all' && a.status !== statusFilter) return false
          if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return a.title.toLowerCase().includes(q) || a.deck_title.toLowerCase().includes(q)
          }
          return true
        })
        const hasMore = filtered.length > displayLimit
        return (
        <div className="space-y-3 mb-8">
          {filtered
          .slice(0, displayLimit)
          .map((assessment) => {
            const mySessions = sessions.filter((s) => s.assessment_id === assessment.id)
            const lastSession = mySessions[0]
            const now = new Date()
            const isUpcoming = assessment.start_date && new Date(assessment.start_date) > now
            const isClosed = assessment.end_date && new Date(assessment.end_date) < now
            const isScheduleBlocked = isUpcoming || isClosed

            // Retake policy checks
            const attemptCount = mySessions.length
            const isMaxAttemptsReached = assessment.max_attempts ? attemptCount >= assessment.max_attempts : false
            let cooldownRemaining = 0
            if (assessment.cooldown_minutes && lastSession?.completed_at) {
              const cooldownEnd = new Date(lastSession.completed_at)
              cooldownEnd.setMinutes(cooldownEnd.getMinutes() + assessment.cooldown_minutes)
              if (now < cooldownEnd) {
                cooldownRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 60000)
              }
            }
            const isRetakeBlocked = isScheduleBlocked || isMaxAttemptsReached || cooldownRemaining > 0

            return (
              <div
                key={assessment.id}
                className={`p-4 rounded-lg border bg-white dark:bg-slate-800 ${
                  selectedIds.has(assessment.id)
                    ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 flex gap-3">
                    {isCreator && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(assessment.id)}
                        onChange={() => toggleSelect(assessment.id)}
                        className="mt-1 rounded border-slate-300 flex-shrink-0"
                        aria-label={`Select ${assessment.title}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {assessment.title}
                      </h3>
                      <Badge variant={assessment.status === 'published' ? 'default' : 'secondary'}>
                        {assessment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {assessment.deck_title}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {assessment.time_limit_minutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {assessment.pass_score}% to pass
                      </span>
                      <span>{assessment.question_count} questions</span>
                      {isCreator && (
                        <span>{assessment.session_count} attempts</span>
                      )}
                      {!isCreator && assessment.max_attempts && (
                        <span>
                          {attemptCount}/{assessment.max_attempts} attempts
                        </span>
                      )}
                      {!isCreator && cooldownRemaining > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          Retry in {cooldownRemaining}m
                        </span>
                      )}
                      {(assessment.start_date || assessment.end_date) && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {isUpcoming
                            ? `Opens ${new Date(assessment.start_date!).toLocaleDateString()}`
                            : isClosed
                              ? 'Closed'
                              : assessment.end_date
                                ? `Closes ${new Date(assessment.end_date).toLocaleDateString()}`
                                : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Candidate: last score */}
                    {lastSession?.status === 'completed' && (
                      <div className="text-right mr-2">
                        <div className={`text-lg font-bold ${lastSession.passed ? 'text-green-600' : 'text-red-500'}`}>
                          {lastSession.score}%
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          {lastSession.passed ? (
                            <><CheckCircle2 className="h-3 w-3 text-green-600" /> Passed</>
                          ) : (
                            <><XCircle className="h-3 w-3 text-red-500" /> Failed</>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Candidate: Start/Retake */}
                    {assessment.status === 'published' && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/assessments/${assessment.id}/take`)}
                        disabled={!!isRetakeBlocked}
                        title={
                          isMaxAttemptsReached ? 'Maximum attempts reached'
                          : cooldownRemaining > 0 ? `Wait ${cooldownRemaining} minutes`
                          : isUpcoming ? 'Not yet available'
                          : isClosed ? 'Assessment closed'
                          : undefined
                        }
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {lastSession ? 'Retake' : 'Start'}
                      </Button>
                    )}

                    {/* Creator: Publish draft */}
                    {isCreator && assessment.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePublish(assessment.id)}
                        disabled={isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Publish
                      </Button>
                    )}

                    {/* Creator: Assign to all candidates (published only) */}
                    {isCreator && assessment.status === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssign(assessment.id)}
                        disabled={isPending}
                        title="Assign to candidates who haven't started"
                        aria-label="Assign to candidates"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Send reminder (published only) */}
                    {isCreator && assessment.status === 'published' && (
                      reminderSent[assessment.id] ? (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {reminderSent[assessment.id]}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReminder(assessment.id)}
                          disabled={isPending}
                          title="Send reminder to candidates who haven't completed"
                          aria-label="Send reminder"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      )
                    )}

                    {/* Creator: Copy shareable link */}
                    {isCreator && assessment.status === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyLink(assessment)}
                        title="Copy assessment link"
                        aria-label="Copy assessment link"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Archive published */}
                    {isCreator && assessment.status === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchive(assessment.id)}
                        disabled={isPending}
                        title="Archive assessment"
                        aria-label="Archive assessment"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Revert published to draft */}
                    {isCreator && assessment.status === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnpublish(assessment.id)}
                        disabled={isPending}
                        title="Revert to draft (edit settings)"
                        aria-label="Revert to draft"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Edit (draft only) */}
                    {isCreator && assessment.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/assessments/${assessment.id}/edit`)}
                        aria-label="Edit assessment"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Duplicate */}
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(assessment.id)}
                        disabled={isPending}
                        title="Duplicate assessment"
                        aria-label="Duplicate assessment"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: Analytics */}
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/assessments/${assessment.id}/analytics`)}
                        title="Analytics"
                        aria-label="View analytics"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Creator: View results */}
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/assessments/${assessment.id}/results`)}
                        title="All results"
                        aria-label="View all results"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expandable attempt history */}
                {mySessions.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => setExpandedHistory((prev) => {
                        const next = new Set(prev)
                        if (next.has(assessment.id)) next.delete(assessment.id)
                        else next.add(assessment.id)
                        return next
                      })}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${expandedHistory.has(assessment.id) ? 'rotate-180' : ''}`} />
                      {mySessions.length} attempts
                    </button>
                    {expandedHistory.has(assessment.id) && (
                      <div className="mt-2 space-y-1">
                        {mySessions.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-800/50">
                            <span className="text-slate-500">
                              Attempt {mySessions.length - idx}
                              {s.completed_at && ` · ${new Date(s.completed_at).toLocaleDateString()}`}
                            </span>
                            <span className={`font-medium ${s.passed ? 'text-green-600' : (s.status === 'completed' || s.status === 'timed_out') ? 'text-red-500' : 'text-slate-400'}`}>
                              {(s.status === 'completed' || s.status === 'timed_out') && s.score !== null
                                ? `${s.score}% ${s.passed ? 'Passed' : s.status === 'timed_out' ? 'Timed Out' : 'Failed'}`
                                : s.status === 'in_progress'
                                  ? 'In progress'
                                  : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setDisplayLimit((l) => l + 20)}
              className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Show more ({filtered.length - displayLimit} remaining)
            </button>
          )}
        </div>
        )
      })()}

      {/* My Recent Sessions */}
      {sessions.length > 0 && (
        <>
          <Separator className="mb-6" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">My Attempts</h2>
          <div className="space-y-2">
            {sessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {session.assessment_title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session.completed_at
                      ? new Date(session.completed_at).toLocaleDateString()
                      : 'In progress'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(session.status === 'completed' || session.status === 'timed_out') && session.score !== null && (
                    <span className={`text-sm font-bold ${session.passed ? 'text-green-600' : 'text-red-500'}`}>
                      {session.score}%
                    </span>
                  )}
                  {session.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/assessments/${session.assessment_id}/take`)}
                    >
                      Resume
                    </Button>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {session.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
