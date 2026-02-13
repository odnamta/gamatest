'use client'

/**
 * V13 Phase 10: Assessment Analytics Page
 *
 * Score distribution, completion rate, average time, question difficulty,
 * and top performers for a single assessment.
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  Target,
  Trophy,
  Percent,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import {
  getAssessment,
  getAssessmentAnalyticsSummary,
  getQuestionAnalytics,
  exportResultsCsv,
} from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import type { Assessment } from '@/types/database'

type AnalyticsSummary = {
  scoreDistribution: number[]
  completionRate: number
  avgTimeMinutes: number | null
  medianScore: number | null
  totalStarted: number
  totalCompleted: number
  topPerformers: Array<{ email: string; score: number; completedAt: string }>
  tabSwitchCorrelation: Array<{ tabSwitches: number; score: number }>
  attemptsByHour: number[]
  scoreTrend: Array<{ attempt: number; avgScore: number }>
}

type QuestionStat = {
  cardTemplateId: string
  stem: string
  totalAttempts: number
  correctCount: number
  percentCorrect: number
  avgTimeSeconds: number | null
  discriminationIndex: number | null
}

export default function AssessmentAnalyticsPage() {
  const { role } = useOrg()
  const router = useRouter()
  const params = useParams()
  const assessmentId = params.id as string
  const isCreator = hasMinimumRole(role, 'creator')

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCreator) return
    async function load() {
      const [aResult, sResult, qResult] = await Promise.all([
        getAssessment(assessmentId),
        getAssessmentAnalyticsSummary(assessmentId),
        getQuestionAnalytics(assessmentId),
      ])

      if (aResult.ok && aResult.data) setAssessment(aResult.data)
      if (!sResult.ok) {
        setError(sResult.error)
      } else if (sResult.data) {
        setSummary(sResult.data)
      }
      if (qResult.ok && qResult.data) {
        setQuestionStats(qResult.data.questions)
      }
      setLoading(false)
    }
    load()
  }, [assessmentId, isCreator])

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to view analytics.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        Loading analytics...
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

  const maxBucket = summary ? Math.max(...summary.scoreDistribution, 1) : 1

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: assessment?.title ?? 'Assessment' },
        { label: 'Analytics' },
      ]} />

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {assessment?.title ?? 'Assessment'} — Analytics
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push(`/assessments/${assessmentId}/results`)}
          >
            <Users className="h-4 w-4 mr-1" />
            All Results
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
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>
      {assessment && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          {assessment.question_count} questions · {assessment.time_limit_minutes} min · {assessment.pass_score}% to pass
        </p>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Started" value={summary.totalStarted} />
          <StatCard icon={Target} label="Completed" value={`${summary.totalCompleted} (${summary.completionRate}%)`} />
          <StatCard
            icon={TrendingUp}
            label="Median Score"
            value={summary.medianScore !== null ? `${summary.medianScore}%` : '—'}
          />
          <StatCard
            icon={Clock}
            label="Avg Time"
            value={summary.avgTimeMinutes !== null ? `${summary.avgTimeMinutes} min` : '—'}
          />
        </div>
      )}

      {/* Score Distribution */}
      {summary && summary.totalCompleted > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Score Distribution
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-end gap-1 h-32">
              {summary.scoreDistribution.map((count, idx) => {
                const height = maxBucket > 0 ? (count / maxBucket) * 100 : 0
                const passThreshold = assessment ? Math.floor(assessment.pass_score / 10) : 7
                const isPassBucket = idx >= passThreshold
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {count > 0 ? count : ''}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        isPassBucket ? 'bg-green-500' : 'bg-red-400'
                      }`}
                      style={{ height: `${Math.max(height, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {summary.scoreDistribution.map((_, idx) => (
                <div key={idx} className="flex-1 text-center text-[9px] text-slate-400">
                  {idx * 10}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-green-500" /> Pass
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-red-400" /> Fail
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Performers */}
      {summary && summary.topPerformers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Top Performers
          </h2>
          <div className="space-y-2">
            {summary.topPerformers.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-sm text-slate-900 dark:text-slate-100 flex-1 min-w-0 truncate">
                  {p.email}
                </span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                  {p.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Trend Across Attempts */}
      {summary && summary.scoreTrend.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Score Trend Across Attempts
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-end gap-2 h-32">
              {summary.scoreTrend.map((point) => (
                <div key={point.attempt} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-500 font-medium">{point.avgScore}%</span>
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: `${point.avgScore}%` }}
                  />
                  <span className="text-[10px] text-slate-400">#{point.attempt}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">Average score by attempt number</p>
          </div>
        </div>
      )}

      {/* Attempt Timing by Hour */}
      {summary && summary.totalStarted > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Attempt Timing
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-end gap-px h-20">
              {summary.attemptsByHour.map((count, hour) => {
                const maxHour = Math.max(...summary.attemptsByHour, 1)
                const height = (count / maxHour) * 100
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t bg-indigo-400 dark:bg-indigo-500"
                      style={{ height: `${Math.max(height, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-px mt-1">
              {summary.attemptsByHour.map((_, hour) => (
                <div key={hour} className="flex-1 text-center text-[8px] text-slate-400">
                  {hour % 6 === 0 ? `${hour}h` : ''}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">When candidates start their attempts (hour of day)</p>
          </div>
        </div>
      )}

      {/* Tab Switch vs Score */}
      {summary && summary.tabSwitchCorrelation.length > 0 && summary.tabSwitchCorrelation.some((d) => d.tabSwitches > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Tab Switch Impact
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {(() => {
              const withSwitches = summary.tabSwitchCorrelation.filter((d) => d.tabSwitches > 0)
              const noSwitches = summary.tabSwitchCorrelation.filter((d) => d.tabSwitches === 0)
              const avgWithSwitches = withSwitches.length > 0
                ? Math.round(withSwitches.reduce((s, d) => s + d.score, 0) / withSwitches.length)
                : null
              const avgNoSwitches = noSwitches.length > 0
                ? Math.round(noSwitches.reduce((s, d) => s + d.score, 0) / noSwitches.length)
                : null
              return (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{avgNoSwitches ?? '—'}%</div>
                    <div className="text-xs text-slate-500 mt-1">Avg score — no violations</div>
                    <div className="text-xs text-slate-400">{noSwitches.length} sessions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{avgWithSwitches ?? '—'}%</div>
                    <div className="text-xs text-slate-500 mt-1">Avg score — with violations</div>
                    <div className="text-xs text-slate-400">{withSwitches.length} sessions</div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Question Difficulty */}
      {questionStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Question Difficulty
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            DI = Discrimination Index (top 27% vs bottom 27% correct rate).{' '}
            <span className="text-green-600">Good (&ge;0.3)</span>{' '}
            <span className="text-amber-600">Fair (0.1-0.3)</span>{' '}
            <span className="text-red-600">Poor (&lt;0.1)</span>
          </p>
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
                          isHard ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-green-500'
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
                    {q.discriminationIndex != null && (
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          q.discriminationIndex >= 0.3
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : q.discriminationIndex >= 0.1
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                        title="Discrimination index: how well this question differentiates top vs bottom performers"
                      >
                        DI: {q.discriminationIndex.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold ${
                        isHard ? 'text-red-500' : isMedium ? 'text-amber-600' : 'text-green-600'
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

      {summary && summary.totalCompleted === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No completed attempts yet. Analytics will appear once candidates complete the assessment.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
      <Icon className="h-5 w-5 mx-auto text-slate-400 mb-1" />
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
