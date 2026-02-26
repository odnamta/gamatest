'use client'

/**
 * V13: Assessment Results Page
 *
 * Two modes:
 * 1. With ?sessionId — Candidate view: score card + per-question review
 * 2. Without sessionId — Creator view: aggregate stats + all candidate sessions
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  Target,
  Download,
  AlertTriangle,
  Shield,
  ChevronDown,
  BookOpen,
  FileText,
  RotateCcw,
  History,
  Search,
  Award,
  FileDown,
} from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import {
  getSessionResults,
  getAssessment,
  getAssessmentResultsDetailed,
  getQuestionAnalytics,
  exportResultsCsv,
  getSessionWeakAreas,
  expireStaleSessions,
  getActiveSessionsForAssessment,
  getSessionPercentile,
  getMyAttemptsForAssessment,
  getViolationHeatmap,
} from '@/actions/assessment-actions'
import { exportAssessmentResultsPdf } from '@/actions/assessment-report-actions'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Assessment, AssessmentSession } from '@/types/database'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { usePageTitle } from '@/hooks/use-page-title'

type EnrichedAnswer = {
  id: string
  session_id: string
  card_template_id: string
  selected_index: number | null
  is_correct: boolean | null
  answered_at: string | null
  stem: string
  options: string[]
  correct_index: number
  explanation: string | null
}

type SessionWithEmail = AssessmentSession & { user_email: string; user_full_name: string | null; user_phone: string | null }

export default function AssessmentResultsPage() {
  usePageTitle('Assessment Results')
  const { role } = useOrg()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const assessmentId = params.id as string
  const sessionId = searchParams.get('sessionId')
  const isCreator = hasMinimumRole(role, 'creator')

  // If sessionId is provided, show candidate view. Otherwise show creator view.
  if (sessionId) {
    return <CandidateResultsView assessmentId={assessmentId} sessionId={sessionId} />
  }

  if (isCreator) {
    return <CreatorResultsView assessmentId={assessmentId} />
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
      Tidak ada hasil untuk ditampilkan.
    </div>
  )
}

// ============================================
// Candidate Results View
// ============================================

type TopicBreakdown = {
  tagId: string
  tagName: string
  tagColor: string
  correct: number
  total: number
  percent: number
}

function CandidateResultsView({ assessmentId, sessionId }: { assessmentId: string; sessionId: string }) {
  const router = useRouter()
  const { org } = useOrg()
  const certificationEnabled = org.settings.features.certification
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [answers, setAnswers] = useState<EnrichedAnswer[]>([])
  const [weakAreas, setWeakAreas] = useState<TopicBreakdown[]>([])
  const [percentile, setPercentile] = useState<{ percentile: number; rank: number; totalSessions: number } | null>(null)
  const [attemptData, setAttemptData] = useState<{
    attempts: Array<{ id: string; score: number | null; passed: boolean | null; status: string; completed_at: string | null; created_at: string }>
    maxAttempts: number | null
    canRetake: boolean
    cooldownEndsAt: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [aResult, sResult, wResult, pResult, attResult] = await Promise.all([
        getAssessment(assessmentId),
        getSessionResults(sessionId),
        getSessionWeakAreas(sessionId),
        getSessionPercentile(sessionId),
        getMyAttemptsForAssessment(assessmentId),
      ])

      if (aResult.ok && aResult.data) setAssessment(aResult.data)
      if (!sResult.ok) {
        setError(sResult.error)
      } else if (sResult.data) {
        setSession(sResult.data.session)
        setAnswers(sResult.data.answers)
      }
      if (wResult.ok && wResult.data) {
        setWeakAreas(wResult.data.topics)
      }
      if (pResult.ok && pResult.data) {
        setPercentile(pResult.data)
      }
      if (attResult.ok && attResult.data) {
        setAttemptData(attResult.data)
      }
      setLoading(false)
    }
    load()
  }, [assessmentId, sessionId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        {/* Score card skeleton */}
        <div className="rounded-xl p-6 mb-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3" />
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-2" />
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-4" />
          <div className="flex justify-center gap-6">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        {/* Question review skeleton */}
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="space-y-2 ml-9">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Session not found'}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Back to Assessments
        </Button>
      </div>
    )
  }

  const correctCount = answers.filter((a) => a.is_correct === true).length
  const totalCount = answers.length
  const score = session.score ?? 0
  const passed = session.passed ?? false

  // If show_results is false, show only basic submission confirmation
  if (assessment && !assessment.show_results) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/assessments')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </button>
        <div className="rounded-xl p-6 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CheckCircle2 className="h-12 w-12 mx-auto text-blue-600 mb-3" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Assessment Submitted
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Your responses have been recorded. Results are not available for this assessment.
          </p>
        </div>
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => router.push('/assessments')}>
            Back to Assessments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/assessments')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </button>

      {/* Score Card */}
      <div
        className={`rounded-xl p-6 mb-8 text-center ${
          passed
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}
      >
        <div className="mb-3">
          {passed ? (
            <Trophy className="h-12 w-12 mx-auto text-green-600" />
          ) : (
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
          )}
        </div>
        <h1 className="text-3xl font-bold mb-1">
          <span className={passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
            {score}%
          </span>
        </h1>
        <p className={`text-lg font-medium ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {passed ? 'Passed' : 'Not Passed'}
        </p>
        {assessment && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {assessment.title} — Pass score: {assessment.pass_score}%
          </p>
        )}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            {correctCount}/{totalCount} correct
          </span>
          {session.completed_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(session.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {percentile && percentile.totalSessions > 1 && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-3 font-medium">
            Better than {percentile.percentile}% of takers · Rank {percentile.rank} of {percentile.totalSessions}
          </p>
        )}
      </div>

      {/* PDF Export */}
      <div className="flex justify-center mb-8">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Assessment Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  .score { font-size: 48px; font-weight: bold; color: ${passed ? '#16a34a' : '#dc2626'}; }
  .status { font-size: 20px; color: ${passed ? '#16a34a' : '#dc2626'}; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
  .correct { color: #16a34a; font-weight: bold; }
  .incorrect { color: #dc2626; font-weight: bold; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${assessment?.title ?? 'Assessment Report'}</h1>
<p class="meta">Date: ${session.completed_at ? new Date(session.completed_at).toLocaleDateString() : '—'} · Pass Score: ${assessment?.pass_score ?? 0}%</p>
<div style="text-align:center;margin:24px 0;">
  <div class="score">${score}%</div>
  <div class="status">${passed ? 'PASSED' : 'NOT PASSED'}</div>
  <p class="meta">${correctCount} of ${totalCount} correct</p>
  ${percentile && percentile.totalSessions > 1 ? `<p class="meta">Better than ${percentile.percentile}% of takers · Rank ${percentile.rank} of ${percentile.totalSessions}</p>` : ''}
</div>
${assessment?.allow_review ? `
<h2>Question Review</h2>
<table>
<thead><tr><th>#</th><th>Question</th><th>Your Answer</th><th>Result</th></tr></thead>
<tbody>
${answers.map((a, i) => `<tr>
  <td>${i + 1}</td>
  <td>${a.stem.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
  <td>${a.selected_index != null ? a.options[a.selected_index]?.replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '—' : 'Not answered'}</td>
  <td class="${a.is_correct ? 'correct' : 'incorrect'}">${a.is_correct ? '✓' : '✗'}</td>
</tr>`).join('')}
</tbody></table>` : ''}
<p class="meta" style="margin-top:32px;text-align:center;">Generated by Cekatan · ${new Date().toLocaleDateString()}</p>
</body></html>`
            const win = window.open('', '_blank')
            if (win) {
              win.document.write(html)
              win.document.close()
              setTimeout(() => win.print(), 300)
            }
          }}
        >
          <FileText className="h-4 w-4 mr-1" />
          Download PDF Report
        </Button>
        {certificationEnabled && passed && (
          <>
            {session.certificate_url && (
              <a href={session.certificate_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" className="ml-2">
                  <Download className="h-4 w-4 mr-1" />
                  Download Certificate
                </Button>
              </a>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="ml-2"
              onClick={() => router.push(`/assessments/${assessmentId}/certificate/${sessionId}`)}
            >
              View Certificate
            </Button>
          </>
        )}
      </div>

      {/* Topic Breakdown (weak areas) */}
      {weakAreas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Topic Breakdown
          </h2>
          <div className="space-y-2">
            {weakAreas.map((topic) => {
              const isWeak = topic.percent < 50
              return (
                <div
                  key={topic.tagId}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: topic.tagColor }}
                  />
                  <span className="text-sm text-slate-900 dark:text-slate-100 flex-1 min-w-0 truncate">
                    {topic.tagName}
                  </span>
                  <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className={`h-full rounded-full ${isWeak ? 'bg-red-500' : topic.percent < 75 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${topic.percent}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-16 text-right flex-shrink-0 ${isWeak ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                    {topic.correct}/{topic.total}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Study Recommendations — based on weak topics */}
      {(() => {
        const weak = weakAreas.filter((t) => t.percent < 70)
        if (weak.length === 0) return null
        const weakTagIds = weak.map((t) => t.tagId).join(',')
        return (
          <div className="mb-8 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Study Recommendations
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Focus on these {weak.length} topic{weak.length !== 1 ? 's' : ''} to improve your score:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {weak.map((t) => (
                <span
                  key={t.tagId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.tagColor }} />
                  {t.tagName}
                  <span className="text-red-500 ml-0.5">{t.percent}%</span>
                </span>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/study/global?tags=${weakTagIds}`)}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Study Weak Topics
            </Button>
          </div>
        )
      })()}

      {/* Per-Question Review — gated by allow_review */}
      {answers.length > 0 && assessment?.allow_review && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Question Review
          </h2>
          <div className="space-y-4">
            {answers.map((answer, idx) => (
              <div
                key={answer.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      answer.is_correct
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
                    {answer.stem}
                  </p>
                </div>

                <div className="ml-9 space-y-2">
                  {answer.options.map((option, optIdx) => {
                    const isSelected = answer.selected_index === optIdx
                    const isCorrect = answer.correct_index === optIdx
                    let className = 'p-2.5 rounded-lg text-sm flex items-start gap-2 '

                    if (isCorrect) {
                      className += 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                    } else if (isSelected && !isCorrect) {
                      className += 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                    } else {
                      className += 'text-slate-600 dark:text-slate-400'
                    }

                    return (
                      <div key={optIdx} className={className}>
                        <span className="flex-shrink-0 font-medium">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <span>{option}</span>
                        {isCorrect && (
                          <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0 text-green-600" />
                        )}
                        {isSelected && !isCorrect && (
                          <XCircle className="h-4 w-4 ml-auto flex-shrink-0 text-red-500" />
                        )}
                      </div>
                    )
                  })}
                </div>

                {answer.explanation && (
                  <div className="ml-9 mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300">
                    <span className="font-medium">Explanation: </span>
                    {answer.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certificate link for passed sessions (gated by feature flag) */}
      {passed && certificationEnabled && (
        <div className="mt-6 text-center flex items-center justify-center gap-2">
          {session.certificate_url && (
            <a href={session.certificate_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Download Certificate
              </Button>
            </a>
          )}
          <Button
            variant="secondary"
            onClick={() => router.push(`/assessments/${assessmentId}/certificate/${sessionId}`)}
          >
            <Trophy className="h-4 w-4 mr-2" />
            View Certificate
          </Button>
        </div>
      )}

      {answers.length > 0 && assessment && !assessment.allow_review && (
        <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
          Answer review is not available for this assessment.
        </div>
      )}

      {/* Attempt History & Retake */}
      {attemptData && attemptData.attempts.length > 1 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            Your Attempts
            {attemptData.maxAttempts && (
              <span className="text-sm font-normal text-slate-500">
                ({attemptData.attempts.filter((a) => a.status === 'completed' || a.status === 'timed_out').length}/{attemptData.maxAttempts})
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {attemptData.attempts.map((att, idx) => {
              const isCurrent = att.id === sessionId
              return (
                <div
                  key={att.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isCurrent
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <span className="text-xs font-medium text-slate-400 w-6 text-right">
                    #{attemptData.attempts.length - idx}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {att.completed_at ? new Date(att.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'In progress'}
                    </span>
                    {isCurrent && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">Current</span>
                    )}
                  </div>
                  {att.score !== null ? (
                    <span className={`text-sm font-bold ${att.passed ? 'text-green-600' : 'text-red-500'}`}>
                      {att.score}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {!isCurrent && att.status !== 'in_progress' && (
                    <button
                      onClick={() => router.push(`/assessments/${assessmentId}/results?sessionId=${att.id}`)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Retake Button */}
      {attemptData?.canRetake && (
        <div className="mt-6 text-center">
          <Button onClick={() => router.push(`/assessments/${assessmentId}/take`)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Assessment
          </Button>
        </div>
      )}

      {attemptData && !attemptData.canRetake && attemptData.cooldownEndsAt && (
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Retake available after {new Date(attemptData.cooldownEndsAt).toLocaleString()}
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Back to Assessments
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Creator Results View
// ============================================

type QuestionStat = {
  cardTemplateId: string
  stem: string
  totalAttempts: number
  correctCount: number
  percentCorrect: number
  avgTimeSeconds: number | null
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function buildScoreDistribution(sessions: Array<{ score: number | null }>) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10 + 1}-${(i + 1) * 10}`,
    count: 0,
  }))
  // Handle 0 score in first bucket
  buckets[0].range = '0-10'

  sessions.forEach((s) => {
    if (s.score == null) return
    const idx = Math.min(Math.floor(s.score / 10), 9)
    buckets[idx].count++
  })
  return buckets
}

function CreatorResultsView({ assessmentId }: { assessmentId: string }) {
  const router = useRouter()
  const { org } = useOrg()
  const { showToast } = useToast()
  const proctoringEnabled = org.settings.features.proctoring
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [sessions, setSessions] = useState<SessionWithEmail[]>([])
  const [stats, setStats] = useState<{ avgScore: number; passRate: number; totalAttempts: number } | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionLimit, setSessionLimit] = useState(20)
  const [expandedViolation, setExpandedViolation] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [violationHeatmap, setViolationHeatmap] = useState<Array<{ index: number; stem: string; violationCount: number }>>([])
  const [activeSessions, setActiveSessions] = useState<Array<{
    sessionId: string; userEmail: string; startedAt: string
    timeRemainingSeconds: number | null; questionsAnswered: number
    totalQuestions: number; tabSwitchCount: number
  }>>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollActiveSessions = useCallback(async () => {
    const result = await getActiveSessionsForAssessment(assessmentId)
    if (result.ok) setActiveSessions(result.data ?? [])
  }, [assessmentId])

  useEffect(() => {
    async function load() {
      // Auto-expire stale sessions before loading results
      await expireStaleSessions()

      const [aResult, rResult, qResult] = await Promise.all([
        getAssessment(assessmentId),
        getAssessmentResultsDetailed(assessmentId),
        getQuestionAnalytics(assessmentId),
      ])

      if (aResult.ok && aResult.data) setAssessment(aResult.data)
      if (!rResult.ok) {
        setError(rResult.error)
      } else if (rResult.data) {
        setSessions(rResult.data.sessions as SessionWithEmail[])
        setStats(rResult.data.stats)
      }
      if (qResult.ok && qResult.data) {
        setQuestionStats(qResult.data.questions)
      }
      setLoading(false)

      // Load violation heatmap if proctoring is enabled
      if (proctoringEnabled) {
        getViolationHeatmap(assessmentId).then(hResult => {
          if (hResult.ok && hResult.data) {
            setViolationHeatmap(hResult.data.questions)
          }
        })
      }

      // Initial poll + start interval for live monitoring
      pollActiveSessions()
    }
    load()

    pollingRef.current = setInterval(pollActiveSessions, 15000) // every 15s
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [assessmentId, pollActiveSessions])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
              <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-2" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-1" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Back to Assessments
        </Button>
      </div>
    )
  }

  // Computed: median, filtered sessions, top/bottom performers
  const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'timed_out')
  const scores = completedSessions.map(s => s.score).filter((s): s is number => s !== null)
  const medianScore = computeMedian(scores)

  const filteredSessions = sessions.filter(s => {
    if (statusFilter === 'passed') {
      if (s.passed !== true) return false
    } else if (statusFilter === 'failed') {
      if (s.passed !== false || (s.status !== 'completed' && s.status !== 'timed_out')) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !(s.user_full_name?.toLowerCase().includes(q) ||
          s.user_email.toLowerCase().includes(q) ||
          s.user_phone?.toLowerCase().includes(q))
      ) return false
    }
    return true
  })

  const topPerformers = [...completedSessions]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)

  const bottomPerformers = [...completedSessions]
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: assessment?.title ?? 'Assessment', href: `/assessments/${assessmentId}/analytics` },
        { label: 'Results' },
      ]} />

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {assessment?.title ?? 'Assessment'} — Results
        </h1>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={exportingPdf}
              onClick={async () => {
                setExportingPdf(true)
                const result = await exportAssessmentResultsPdf(assessmentId)
                setExportingPdf(false)
                if (result.ok && result.data) {
                  window.open(result.data.url, '_blank')
                  showToast('PDF exported', 'success')
                } else if (!result.ok) {
                  showToast(result.error, 'error')
                }
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />
              {exportingPdf ? 'Generating...' : 'Export PDF'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const result = await exportResultsCsv(assessmentId)
                if (result.ok && result.data) {
                  const blob = new Blob([result.data], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${assessment?.title ?? 'assessment'}-results.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                  showToast('CSV exported', 'success')
                } else if (!result.ok) {
                  showToast(result.error, 'error')
                }
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        )}
      </div>
      {assessment && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {assessment.question_count} questions · {assessment.time_limit_minutes} min · {assessment.pass_score}% to pass
        </p>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
            <Users className="h-5 w-5 mx-auto text-slate-400 mb-1" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalAttempts}
            </div>
            <div className="text-xs text-slate-500">Total Attempts</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.avgScore}%
            </div>
            <div className="text-xs text-slate-500">Average Score</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {medianScore}%
            </div>
            <div className="text-xs text-slate-500">Median Score</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
            <Target className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.passRate}%
            </div>
            <div className="text-xs text-slate-500">Pass Rate</div>
          </div>
        </div>
      )}

      {/* Score Distribution Histogram */}
      {sessions.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-8">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Distribusi Skor</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buildScoreDistribution(sessions)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top & Bottom Performers */}
      {completedSessions.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-900/10">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Top {Math.min(5, topPerformers.length)} Performers
            </h3>
            <div className="space-y-2">
              {topPerformers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-xs font-bold text-green-600 dark:text-green-400">{i + 1}.</span>
                  <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">
                    {s.user_full_name || s.user_email}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">{s.score}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Bottom {Math.min(5, bottomPerformers.length)} Performers
            </h3>
            <div className="space-y-2">
              {bottomPerformers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-xs font-bold text-red-600 dark:text-red-400">{i + 1}.</span>
                  <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">
                    {s.user_full_name || s.user_email}
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">{s.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Active Sessions Monitor */}
      {activeSessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            Live — {activeSessions.length} Active {activeSessions.length === 1 ? 'Session' : 'Sessions'}
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {activeSessions.map((s) => {
              const mins = s.timeRemainingSeconds != null ? Math.floor(s.timeRemainingSeconds / 60) : null
              const progress = s.totalQuestions > 0
                ? Math.round((s.questionsAnswered / s.totalQuestions) * 100)
                : 0
              return (
                <div
                  key={s.sessionId}
                  className="p-3 rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {s.userEmail}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {mins != null ? `${mins}m left` : '—'}
                      </span>
                      <span>{s.questionsAnswered}/{s.totalQuestions} answered</span>
                      {s.tabSwitchCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                          {s.tabSwitchCount} switches
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 text-right mt-0.5">{progress}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Flagged Sessions — Proctoring Violations (gated by feature flag) */}
      {proctoringEnabled && (() => {
        const flagged = sessions.filter((s) => s.tab_switch_count >= 3)
        if (flagged.length === 0) return null
        return (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Flagged Sessions ({flagged.length})
            </h2>
            <div className="space-y-2">
              {flagged
                .sort((a, b) => b.tab_switch_count - a.tab_switch_count)
                .map((s) => {
                  const isHigh = s.tab_switch_count >= 10
                  const log = Array.isArray(s.tab_switch_log) ? s.tab_switch_log as Array<{ timestamp: string; type: string }> : []
                  const isExpanded = expandedViolation === s.id
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${isHigh ? 'text-red-500' : 'text-amber-500'}`} />
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {s.user_email}
                          </span>
                          <Badge className={isHigh
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }>
                            {s.tab_switch_count} violations
                          </Badge>
                          {s.score !== null && (
                            <span className="text-xs text-slate-500">{s.score}%</span>
                          )}
                        </div>
                        {log.length > 0 && (
                          <button
                            onClick={() => setExpandedViolation(isExpanded ? null : s.id)}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                          >
                            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            Timeline
                          </button>
                        )}
                      </div>
                      {isExpanded && log.length > 0 && (
                        <div className="mt-3 ml-7 space-y-1">
                          {log.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-mono w-20 flex-shrink-0">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                              <span className={entry.type === 'tab_hidden' ? 'text-red-500' : 'text-green-500'}>
                                {entry.type === 'tab_hidden' ? 'Left exam' : 'Returned'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )
      })()}

      {/* Violation Heatmap by Question */}
      {violationHeatmap.length > 0 && violationHeatmap.some(q => q.violationCount > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Violation Heatmap by Question
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Tab switches during each question across all flagged sessions. Darker = more violations.
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {violationHeatmap.map((q) => {
              const maxV = Math.max(...violationHeatmap.map(h => h.violationCount), 1)
              const intensity = q.violationCount / maxV
              const bg = q.violationCount === 0
                ? 'bg-slate-100 dark:bg-slate-800'
                : intensity < 0.33
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : intensity < 0.66
                    ? 'bg-orange-200 dark:bg-orange-900/40'
                    : 'bg-red-300 dark:bg-red-900/50'
              return (
                <div
                  key={q.index}
                  title={`Q${q.index}: ${q.stem} — ${q.violationCount} violations`}
                  className={`${bg} rounded p-2 text-center cursor-default transition-colors`}
                >
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Q{q.index}
                  </div>
                  <div className={`text-sm font-bold ${q.violationCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                    {q.violationCount}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Question Difficulty Analysis */}
      {questionStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Question Difficulty
          </h2>
          <div className="space-y-2">
            {questionStats.map((q, idx) => {
              const isHard = q.percentCorrect < 40
              const isMedium = q.percentCorrect >= 40 && q.percentCorrect < 70
              return (
                <div
                  key={q.cardTemplateId}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <span className="text-xs font-medium text-slate-400 w-6 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                      {q.stem}
                    </p>
                    <div className="mt-1 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isHard
                            ? 'bg-red-500'
                            : isMedium
                              ? 'bg-amber-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${q.percentCorrect}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {q.avgTimeSeconds != null && (
                      <span className="text-xs text-slate-400 inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {q.avgTimeSeconds}s
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold ${
                        isHard
                          ? 'text-red-500'
                          : isMedium
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {q.percentCorrect}%
                    </span>
                    <span className="text-xs text-slate-400">
                      ({q.correctCount}/{q.totalAttempts})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      {sessions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
            {(['all', 'passed', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'passed' ? 'Passed' : 'Failed'}
              </button>
            ))}
          </div>
          {(statusFilter !== 'all' || searchQuery) && (
            <span className="text-xs text-slate-500">
              {filteredSessions.length} dari {sessions.length}
            </span>
          )}
        </div>
      )}

      {/* Candidate Sessions Table */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No attempts yet.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            All Attempts
          </h2>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]" aria-label="Candidate attempt results">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Nama</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Telepon</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Score</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  {proctoringEnabled && <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tab Switches</th>}
                  {proctoringEnabled && <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">IP</th>}
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSessions.slice(0, sessionLimit).map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      if (s.status === 'completed' || s.status === 'timed_out') {
                        router.push(`/assessments/${assessmentId}/results?sessionId=${s.id}`)
                      }
                    }}
                    className={`bg-white dark:bg-slate-800 ${
                      s.status === 'completed' || s.status === 'timed_out'
                        ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {s.user_full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {s.user_email}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {s.user_phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(s.status === 'completed' || s.status === 'timed_out') && s.score !== null ? (
                        <span className={`font-bold ${s.passed ? 'text-green-600' : 'text-red-500'}`}>
                          {s.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'completed' ? (
                        s.passed ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Failed
                          </Badge>
                        )
                      ) : s.status === 'timed_out' ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          Timed Out
                        </Badge>
                      ) : (
                        <Badge variant="secondary">In Progress</Badge>
                      )}
                    </td>
                    {proctoringEnabled && (
                      <td className="px-4 py-3">
                        {s.tab_switch_count > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {s.tab_switch_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    )}
                    {proctoringEnabled && (
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {s.ip_address ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500">
                      {s.completed_at
                        ? new Date(s.completed_at).toLocaleDateString()
                        : s.created_at
                          ? new Date(s.created_at).toLocaleDateString()
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSessions.length > sessionLimit && (
            <button
              onClick={() => setSessionLimit((l) => l + 20)}
              className="w-full py-2 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Show more ({filteredSessions.length - sessionLimit} remaining)
            </button>
          )}
        </>
      )}
    </div>
  )
}
