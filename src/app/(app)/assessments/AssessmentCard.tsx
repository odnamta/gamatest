'use client'

/**
 * Individual assessment card component with candidate/creator controls.
 * Extracted from assessments/page.tsx for maintainability (#174).
 */

import { useRouter } from 'next/navigation'
import {
  Play, Eye, BarChart3, Clock, Target, CheckCircle2, XCircle,
  Pencil, Send, Archive, CalendarDays, Copy, ChevronDown,
  Bell, Link2, RotateCcw, UserPlus, MessageCircle, QrCode,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import type { AssessmentWithDeck, SessionWithAssessment } from '@/types/database'

interface AssessmentCardProps {
  assessment: AssessmentWithDeck
  mySessions: SessionWithAssessment[]
  isCreator: boolean
  isPending: boolean
  selectedIds: Set<string>
  expandedHistory: Set<string>
  reminderSent: Record<string, string>
  onToggleSelect: (id: string) => void
  onToggleHistory: (id: string) => void
  onPublish: (id: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  onReminder: (id: string) => void
  onUnpublish: (id: string) => void
  onAssign: (id: string) => void
  onCopyPublicLink: (assessment: AssessmentWithDeck) => void
  onWhatsAppShare: (assessment: AssessmentWithDeck) => void
  onShowQR: (assessment: AssessmentWithDeck) => void
}

export function AssessmentCard({
  assessment,
  mySessions,
  isCreator,
  isPending,
  selectedIds,
  expandedHistory,
  reminderSent,
  onToggleSelect,
  onToggleHistory,
  onPublish,
  onArchive,
  onDuplicate,
  onReminder,
  onUnpublish,
  onAssign,
  onCopyPublicLink,
  onWhatsAppShare,
  onShowQR,
}: AssessmentCardProps) {
  const router = useRouter()
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
              onChange={() => onToggleSelect(assessment.id)}
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
                {assessment.time_limit_minutes} menit
              </span>
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" />
                {assessment.pass_score}% untuk lulus
              </span>
              <span>{assessment.question_count} soal</span>
              {isCreator && (
                <span>{assessment.session_count} percobaan</span>
              )}
              {!isCreator && assessment.max_attempts && (
                <span>
                  {attemptCount}/{assessment.max_attempts} percobaan
                </span>
              )}
              {!isCreator && cooldownRemaining > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  Coba lagi dalam {cooldownRemaining}m
                </span>
              )}
              {(assessment.start_date || assessment.end_date) && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {isUpcoming
                    ? `Dibuka ${new Date(assessment.start_date!).toLocaleDateString('id-ID')}`
                    : isClosed
                      ? 'Ditutup'
                      : assessment.end_date
                        ? `Ditutup ${new Date(assessment.end_date).toLocaleDateString('id-ID')}`
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
                  <><CheckCircle2 className="h-3 w-3 text-green-600" /> Lulus</>
                ) : (
                  <><XCircle className="h-3 w-3 text-red-500" /> Tidak Lulus</>
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
                isMaxAttemptsReached ? 'Percobaan maksimum tercapai'
                : cooldownRemaining > 0 ? `Tunggu ${cooldownRemaining} menit`
                : isUpcoming ? 'Belum tersedia'
                : isClosed ? 'Asesmen ditutup'
                : undefined
              }
            >
              <Play className="h-4 w-4 mr-1" />
              {lastSession ? 'Ulangi' : 'Mulai'}
            </Button>
          )}

          {/* Creator: Publish draft */}
          {isCreator && assessment.status === 'draft' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPublish(assessment.id)}
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
              onClick={() => onAssign(assessment.id)}
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
                onClick={() => onReminder(assessment.id)}
                disabled={isPending}
                title="Send reminder to candidates who haven't completed"
                aria-label="Send reminder"
              >
                <Bell className="h-4 w-4" />
              </Button>
            )
          )}

          {/* Creator: Share public link */}
          {isCreator && assessment.status === 'published' && assessment.public_code && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCopyPublicLink(assessment)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Salin link publik"
              >
                <Link2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onWhatsAppShare(assessment)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Bagikan via WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => onShowQR(assessment)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Tampilkan QR Code"
              >
                <QrCode className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Creator: Archive published */}
          {isCreator && assessment.status === 'published' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArchive(assessment.id)}
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
              onClick={() => onUnpublish(assessment.id)}
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
              onClick={() => onDuplicate(assessment.id)}
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
            onClick={() => onToggleHistory(assessment.id)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expandedHistory.has(assessment.id) ? 'rotate-180' : ''}`} />
            {mySessions.length} percobaan
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
                      ? `${s.score}% ${s.passed ? 'Lulus' : s.status === 'timed_out' ? 'Waktu Habis' : 'Tidak Lulus'}`
                      : s.status === 'in_progress'
                        ? 'Sedang dikerjakan'
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
}
