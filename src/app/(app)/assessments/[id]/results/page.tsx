'use client'

/**
 * V13: Assessment Results Page
 *
 * Two modes:
 * 1. With ?sessionId — Candidate view: score card + per-question review
 * 2. Without sessionId — Creator view: aggregate stats + all candidate sessions
 */

import { useState, useEffect } from 'react'
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
} from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Assessment, AssessmentSession } from '@/types/database'

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

type SessionWithEmail = AssessmentSession & { user_email: string }

export default function AssessmentResultsPage() {
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
      No results to display.
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
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [answers, setAnswers] = useState<EnrichedAnswer[]>([])
  const [weakAreas, setWeakAreas] = useState<TopicBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [aResult, sResult, wResult] = await Promise.all([
        getAssessment(assessmentId),
        getSessionResults(sessionId),
        getSessionWeakAreas(sessionId),
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
      setLoading(false)
    }
    load()
  }, [assessmentId, sessionId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        Loading results...
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

      {/* Certificate link for passed sessions */}
      {passed && (
        <div className="mt-6 text-center">
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
}

function CreatorResultsView({ assessmentId }: { assessmentId: string }) {
  const router = useRouter()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [sessions, setSessions] = useState<SessionWithEmail[]>([])
  const [stats, setStats] = useState<{ avgScore: number; passRate: number; totalAttempts: number } | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
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
    }
    load()
  }, [assessmentId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        Loading results...
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/assessments')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </button>

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {assessment?.title ?? 'Assessment'} — Results
        </h1>
        {sessions.length > 0 && (
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
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>
      {assessment && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {assessment.question_count} questions · {assessment.time_limit_minutes} min · {assessment.pass_score}% to pass
        </p>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
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
            <Target className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.passRate}%
            </div>
            <div className="text-xs text-slate-500">Pass Rate</div>
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
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Candidate</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Score</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tab Switches</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sessions.map((s) => (
                  <tr key={s.id} className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {s.user_email}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'completed' && s.score !== null ? (
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
                      ) : (
                        <Badge variant="secondary">{s.status.replace('_', ' ')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.tab_switch_count > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {s.tab_switch_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
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
        </>
      )}
    </div>
  )
}
