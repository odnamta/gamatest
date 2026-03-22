'use client'

/**
 * V13: Assessment Dashboard
 *
 * Shows available assessments (candidates) or all assessments (creators).
 * Role-based views with session history.
 * Creators get publish/archive/edit controls.
 */

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  Plus, BarChart3, Clock, CalendarDays, Search, Database, Users, Trash2, AlarmClock,
  Send, Archive,
} from 'lucide-react'
import QRCode from 'qrcode'
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
import { EmptyState } from '@/components/ui/EmptyState'
import type { AssessmentWithDeck, SessionWithAssessment } from '@/types/database'
import { AssessmentCard } from './AssessmentCard'
import { QRCodeModal } from './QRCodeModal'

export default function AssessmentsPage() {
  usePageTitle('Asesmen')
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
  const [qrAssessment, setQrAssessment] = useState<AssessmentWithDeck | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

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

  useEffect(() => {
    loadData()
  }, [])

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

  function handleCopyPublicLink(assessment: AssessmentWithDeck) {
    if (!assessment.public_code) {
      showToast('Link publik belum tersedia', 'error')
      return
    }
    const link = `${window.location.origin}/t/${assessment.public_code}`
    navigator.clipboard.writeText(link).then(() => {
      showToast('Link publik disalin!', 'success')
    }).catch(() => {
      showToast('Gagal menyalin link', 'error')
    })
  }

  function handleWhatsAppShare(assessment: AssessmentWithDeck) {
    if (!assessment.public_code) return
    const link = `${window.location.origin}/t/${assessment.public_code}`
    const text = `Silakan kerjakan asesmen "${assessment.title}":\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function handleShowQR(assessment: AssessmentWithDeck) {
    if (!assessment.public_code) return
    setQrAssessment(assessment)
  }

  useEffect(() => {
    if (!qrAssessment?.public_code) return
    let cancelled = false
    const url = `${window.location.origin}/t/${qrAssessment.public_code}`
    QRCode.toDataURL(url, { width: 200, margin: 2 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => { cancelled = true }
  }, [qrAssessment])

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
            aria-label="Cari asesmen"
            placeholder="Cari asesmen..."
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
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title="Belum ada asesmen"
          description={isCreator
            ? "Buat asesmen pertama untuk menguji kompetensi tim"
            : "Belum ada asesmen yang tersedia saat ini"
          }
          action={isCreator ? (
            <Link href="/assessments/create">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Buat Asesmen
              </Button>
            </Link>
          ) : undefined}
        />
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

            return (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                mySessions={mySessions}
                isCreator={isCreator}
                isPending={isPending}
                selectedIds={selectedIds}
                expandedHistory={expandedHistory}
                reminderSent={reminderSent}
                onToggleSelect={toggleSelect}
                onToggleHistory={(id) => setExpandedHistory((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onDuplicate={handleDuplicate}
                onReminder={handleReminder}
                onUnpublish={handleUnpublish}
                onAssign={handleAssign}
                onCopyPublicLink={handleCopyPublicLink}
                onWhatsAppShare={handleWhatsAppShare}
                onShowQR={handleShowQR}
              />
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

      {/* QR Code Modal */}
      {qrAssessment && qrAssessment.public_code && (
        <QRCodeModal
          assessment={qrAssessment}
          qrDataUrl={qrDataUrl}
          onClose={() => { setQrAssessment(null); setQrDataUrl(null) }}
        />
      )}
    </div>
  )
}
