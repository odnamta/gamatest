'use client'

/**
 * V13 Phase 10 + Task 11: Redesigned Candidate Profile Page
 *
 * Enhanced with:
 * - Rich summary card (avatar, roles, joined date)
 * - Score progression line chart (lazy-loaded Recharts)
 * - Skill radar chart (EmployeeSkillRadar)
 * - Existing assessment history table preserved
 */

import React, { useState, useEffect, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  TrendingUp,
  Target,
  BarChart3,
  AlertTriangle,
  RotateCcw,
  Download,
  Calendar,
  User,
  FileText,
} from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import {
  getCandidateProgress,
  resetCandidateAttempts,
  exportCandidateProfile,
  getCandidateFullProfile,
  getCandidateScoreProgression,
} from '@/actions/assessment-actions'
import { getEmployeeRoleGapAnalysis } from '@/actions/role-actions'
import { exportCandidateReportPdf } from '@/actions/candidate-report-actions'
import { EmployeeSkillRadar } from '@/components/skills/EmployeeSkillRadar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/Toast'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { usePageTitle } from '@/hooks/use-page-title'

const ScoreProgressionChart = dynamic(
  () => import('@/components/candidates/ScoreProgressionChart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
    ),
  }
)

type SessionRow = {
  assessmentTitle: string
  score: number | null
  passed: boolean | null
  completedAt: string | null
  tabSwitchCount: number
  tabSwitchLog: Array<{ timestamp: string; type: string }>
  status: string
}

type FullProfile = {
  profile: { id: string; email: string; fullName: string | null; avatarUrl: string | null }
  roles: string[]
  totalAssessments: number
  avgScore: number
  passRate: number
  joinedAt: string
}

type ProgressionPoint = {
  date: string
  score: number
  assessmentTitle: string
  passed: boolean
}

type SkillScore = {
  skill_name: string
  skill_color: string
  score: number | null
  assessments_taken: number
}

export default function CandidateProgressPage() {
  usePageTitle('Candidate Details')
  const { role } = useOrg()
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const isCreator = hasMinimumRole(role, 'creator')

  const [candidate, setCandidate] = useState<{ email: string; fullName: string | null } | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [summary, setSummary] = useState<{ totalCompleted: number; avgScore: number; passRate: number } | null>(null)
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null)
  const [progression, setProgression] = useState<ProgressionPoint[]>([])
  const [skillScores, setSkillScores] = useState<SkillScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedViolation, setExpandedViolation] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmReset, setConfirmReset] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (!isCreator) return

    Promise.all([
      getCandidateProgress(userId),
      getCandidateFullProfile(userId),
      getCandidateScoreProgression(userId),
      getEmployeeRoleGapAnalysis(userId),
    ]).then(([progressResult, fullResult, progressionResult, skillResult]) => {
      // Original candidate progress data (sessions table)
      if (!progressResult.ok) {
        setError(progressResult.error ?? 'Failed to load candidate data')
      } else if (progressResult.data) {
        setCandidate(progressResult.data.candidate)
        setSessions(progressResult.data.sessions)
        setSummary(progressResult.data.summary)
      }

      // Full profile with roles, avatar, joined date
      if (fullResult.ok && fullResult.data) {
        setFullProfile(fullResult.data)
      }

      // Score progression for line chart
      if (progressionResult.ok && progressionResult.data) {
        setProgression(progressionResult.data)
      }

      // Skill scores from role gap analysis — map to EmployeeSkillRadar format
      if (skillResult.ok && skillResult.data) {
        const scores: SkillScore[] = []
        const seen = new Set<string>()
        for (const roleData of skillResult.data.roles) {
          for (const req of roleData.requirements) {
            if (!seen.has(req.skill_domain_id)) {
              seen.add(req.skill_domain_id)
              scores.push({
                skill_name: req.skill_name,
                skill_color: req.skill_color,
                score: req.actual_score,
                assessments_taken: req.actual_score !== null ? 1 : 0,
              })
            }
          }
        }
        setSkillScores(scores)
      }

      setLoading(false)
    })
  }, [userId, isCreator])

  function handleResetAttempts() {
    startTransition(async () => {
      const result = await resetCandidateAttempts(userId)
      if (result.ok) {
        showToast(`${result.data?.deleted ?? 0} attempt(s) deleted`, 'success')
        setConfirmReset(false)
        // Reload data
        const fresh = await getCandidateProgress(userId)
        if (fresh.ok && fresh.data) {
          setSessions(fresh.data.sessions)
          setSummary(fresh.data.summary)
        }
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleExportProfile() {
    startTransition(async () => {
      const result = await exportCandidateProfile(userId)
      if (result.ok && result.data) {
        const json = JSON.stringify(result.data, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `candidate-${result.data.candidate.email}-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        showToast('Profile exported', 'success')
      } else if (!result.ok) {
        showToast(result.error, 'error')
      }
    })
  }

  function handleExportPdf() {
    startTransition(async () => {
      const result = await exportCandidateReportPdf(userId)
      if (result.ok && result.data) {
        window.open(result.data.url, '_blank')
        showToast('PDF report generated', 'success')
      } else if (!result.ok) {
        showToast(result.error, 'error')
      }
    })
  }

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        Loading candidate data...
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Candidate not found'}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments/candidates')}>
          Back to Candidates
        </Button>
      </div>
    )
  }

  const displayName = fullProfile?.profile.fullName || candidate.fullName || candidate.email
  const displayEmail = fullProfile?.profile.email || candidate.email
  const avatarUrl = fullProfile?.profile.avatarUrl
  const initials = (displayName || 'U').charAt(0).toUpperCase()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: 'Candidates', href: '/assessments/candidates' },
        { label: displayName },
      ]} />

      {/* Enhanced Profile Card */}
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-200 dark:border-blue-700 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{initials}</span>
            </div>
          )}

          {/* Name, email, roles, joined */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </h1>
            {displayName !== displayEmail && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {displayEmail}
              </p>
            )}

            {/* Role badges */}
            {fullProfile && fullProfile.roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fullProfile.roles.map((roleName) => (
                  <Badge
                    key={roleName}
                    className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                  >
                    {roleName}
                  </Badge>
                ))}
              </div>
            )}

            {/* Joined date */}
            {fullProfile?.joinedAt && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Bergabung {new Date(fullProfile.joinedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={handleExportPdf} disabled={isPending}>
              <FileText className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportProfile} disabled={isPending}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            {!confirmReset ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmReset(true)}
                disabled={isPending || sessions.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 dark:text-red-400">Hapus semua?</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleResetAttempts}
                  disabled={isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  Ya
                </Button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
            <div className="text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {summary.totalCompleted}
              </div>
              <div className="text-xs text-slate-500">Selesai</div>
            </div>
            <div className="text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {summary.avgScore}%
              </div>
              <div className="text-xs text-slate-500">Rata-rata Skor</div>
            </div>
            <div className="text-center">
              <Target className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {summary.passRate}%
              </div>
              <div className="text-xs text-slate-500">Tingkat Lulus</div>
            </div>
          </div>
        )}
      </div>

      {/* Score Progression Chart */}
      {progression.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Progres Skor
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <ScoreProgressionChart data={progression} />
          </div>
        </div>
      )}

      {/* Skill Radar */}
      {skillScores.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Profil Skill
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <EmployeeSkillRadar scores={skillScores} />
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Riwayat Assessment
      </h2>
      {sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Belum ada percobaan assessment.</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]" aria-label="Assessment history">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                <th scope="col" className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Assessment</th>
                <th scope="col" className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Skor</th>
                <th scope="col" className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tab Switch</th>
                <th scope="col" className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sessions.map((s, idx) => (
                <React.Fragment key={idx}>
                  <tr className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {s.assessmentTitle}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'completed' && s.score !== null ? (
                        <span className={`font-bold ${s.passed ? 'text-green-600' : 'text-red-500'}`}>
                          {s.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'completed' ? (
                        s.passed ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Lulus
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Gagal
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">{s.status.replace('_', ' ')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.tabSwitchCount > 0 ? (
                        <button
                          onClick={() => setExpandedViolation(expandedViolation === idx ? null : idx)}
                          className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium hover:underline"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {s.tabSwitchCount}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.completedAt
                        ? new Date(s.completedAt).toLocaleDateString('id-ID')
                        : '\u2014'}
                    </td>
                  </tr>
                  {expandedViolation === idx && s.tabSwitchLog.length > 0 && (
                    <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                            Timeline Pelanggaran
                          </p>
                          <div className="space-y-1">
                            {s.tabSwitchLog.map((entry, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                <span className="text-slate-400">&mdash;</span>
                                <span>Meninggalkan jendela ujian</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
