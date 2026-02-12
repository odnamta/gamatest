'use client'

/**
 * V13 Phase 10: Candidate List Page
 *
 * Admin/creator view listing all org candidates with assessment stats.
 * Links to individual candidate progress pages.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Search, TrendingUp, Target, Clock, Download } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getOrgCandidateList, exportCandidatesCsv } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'

type Candidate = {
  userId: string
  email: string
  fullName: string | null
  totalCompleted: number
  avgScore: number
  lastActiveAt: string | null
}

export default function CandidateListPage() {
  const { role } = useOrg()
  const router = useRouter()
  const isCreator = hasMinimumRole(role, 'creator')

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [displayLimit, setDisplayLimit] = useState(30)

  useEffect(() => {
    if (!isCreator) return
    getOrgCandidateList().then((result) => {
      if (result.ok && result.data) {
        setCandidates(result.data)
      }
      setLoading(false)
    })
  }, [isCreator])

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    )
  }

  const filtered = candidates.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.email.toLowerCase().includes(q) || (c.fullName?.toLowerCase().includes(q) ?? false)
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/assessments')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Candidate Progress
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        {candidates.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const result = await exportCandidatesCsv()
              if (result.ok && result.data) {
                const blob = new Blob([result.data], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'candidates.csv'
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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{searchQuery ? 'No candidates match your search.' : 'No candidates in this organization yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, displayLimit).map((c) => (
            <button
              key={c.userId}
              onClick={() => router.push(`/assessments/candidates/${c.userId}`)}
              className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {c.fullName || c.email}
                  </p>
                  {c.fullName && (
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0 ml-4">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {c.totalCompleted} exams
                  </span>
                  {c.totalCompleted > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{c.avgScore}%</span> avg
                    </span>
                  )}
                  {c.lastActiveAt && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.lastActiveAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filtered.length > displayLimit && (
            <button
              onClick={() => setDisplayLimit((l) => l + 30)}
              className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Show more ({filtered.length - displayLimit} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
