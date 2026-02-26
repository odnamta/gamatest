'use client'

/**
 * V20: Candidate List Page with Bulk Assignment
 *
 * Admin/creator view listing all org candidates with assessment stats.
 * Checkbox multi-select + assign assessment to selected candidates.
 */

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Search, TrendingUp, Target, Clock, Download, Upload, CheckSquare, X, Send, Filter } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getOrgCandidateList, getOrgAssessments, exportCandidatesCsv, importCandidatesCsv } from '@/actions/assessment-actions'
import { getOrgRoleProfiles } from '@/actions/role-actions'
import { bulkAssignAssessment } from '@/actions/notification-actions'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/use-page-title'

type Candidate = {
  userId: string
  email: string
  fullName: string | null
  totalCompleted: number
  avgScore: number
  lastActiveAt: string | null
  roleProfileIds: string[]
}

type AssessmentOption = {
  id: string
  title: string
}

export default function CandidateListPage() {
  usePageTitle('Candidates')
  const { role } = useOrg()
  const router = useRouter()
  const { showToast } = useToast()
  const isCreator = hasMinimumRole(role, 'creator')

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [displayLimit, setDisplayLimit] = useState(30)
  const [isPending, startTransition] = useTransition()
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [passFilter, setPassFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [roleProfiles, setRoleProfiles] = useState<Array<{ id: string; name: string }>>([])

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [publishedAssessments, setPublishedAssessments] = useState<AssessmentOption[]>([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!isCreator) return
    getOrgCandidateList().then((result) => {
      if (result.ok && result.data) {
        setCandidates(result.data)
      }
      setLoading(false)
    })
    getOrgRoleProfiles().then((result) => {
      if (result.ok && result.data) {
        setRoleProfiles(result.data.map((r) => ({ id: r.id, name: r.name })))
      }
    })
  }, [isCreator])

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleSelectAll() {
    const visibleIds = filtered.slice(0, displayLimit).map((c) => c.userId)
    const allSelected = visibleIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleIds))
    }
  }

  async function openAssignModal() {
    setShowAssignModal(true)
    if (publishedAssessments.length === 0) {
      const result = await getOrgAssessments()
      if (result.ok && result.data) {
        const published = result.data
          .filter((a) => a.status === 'published')
          .map((a) => ({ id: a.id, title: a.title }))
        setPublishedAssessments(published)
        if (published.length > 0) setSelectedAssessmentId(published[0].id)
      }
    }
  }

  async function handleAssign() {
    if (!selectedAssessmentId || selectedIds.size === 0) return
    setAssigning(true)
    const result = await bulkAssignAssessment(selectedAssessmentId, Array.from(selectedIds))
    setAssigning(false)
    if (result.ok && result.data) {
      const { notified, alreadyStarted } = result.data
      showToast(
        `Assigned to ${notified} candidate${notified !== 1 ? 's' : ''}${alreadyStarted > 0 ? ` (${alreadyStarted} already started)` : ''}`,
        'success'
      )
      setShowAssignModal(false)
      setSelectedIds(new Set())
    } else if (!result.ok) {
      showToast(result.error, 'error')
    }
  }

  function handleCsvImport(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      startTransition(async () => {
        const result = await importCandidatesCsv(text)
        if (result.ok && result.data) {
          setImportResult(result.data)
          showToast(
            `Imported ${result.data.imported}, skipped ${result.data.skipped}${result.data.errors.length ? `, ${result.data.errors.length} error(s)` : ''}`,
            result.data.errors.length > 0 ? 'error' : 'success'
          )
          const fresh = await getOrgCandidateList()
          if (fresh.ok && fresh.data) setCandidates(fresh.data)
        } else if (!result.ok) {
          showToast(result.error, 'error')
        }
      })
    }
    reader.readAsText(file)
  }

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    )
  }

  const filtered = candidates.filter((c) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!c.email.toLowerCase().includes(q) && !(c.fullName?.toLowerCase().includes(q) ?? false)) {
        return false
      }
    }

    // Pass/fail filter: "passed" = avgScore >= 60 with at least 1 completed,
    // "failed" = totalCompleted > 0 but avgScore < 60
    if (passFilter === 'passed') {
      if (c.totalCompleted === 0 || c.avgScore < 60) return false
    } else if (passFilter === 'failed') {
      if (c.totalCompleted === 0 || c.avgScore >= 60) return false
    }

    // Role profile filter
    if (roleFilter !== 'all') {
      if (!c.roleProfileIds.includes(roleFilter)) return false
    }

    return true
  })

  const visibleIds = filtered.slice(0, displayLimit).map((c) => c.userId)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/assessments')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Asesmen
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
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleCsvImport(file)
              e.target.value = ''
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="h-4 w-4 mr-1" />
            Impor CSV
          </Button>
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
                  showToast('CSV exported', 'success')
                } else if (!result.ok) {
                  showToast(result.error, 'error')
                }
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Ekspor CSV
            </Button>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAssignModal}>
              <Send className="h-4 w-4 mr-1" />
              Assign Assessment
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          aria-label="Search candidates"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Role</option>
          {roleProfiles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {/* Pass/Fail toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          {(['all', 'passed', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setPassFilter(status)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                passFilter === status
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {status === 'all' ? 'Semua' : status === 'passed' ? 'Lulus' : 'Gagal'}
            </button>
          ))}
        </div>

        {/* Active filter indicator */}
        {(roleFilter !== 'all' || passFilter !== 'all') && (
          <button
            onClick={() => { setRoleFilter('all'); setPassFilter('all') }}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Import result feedback */}
      {importResult && (
        <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 text-sm">
          <p className="font-medium text-slate-800 dark:text-slate-200">
            Import complete: {importResult.imported} added, {importResult.skipped} skipped
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc pl-4">
              {importResult.errors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {importResult.errors.length > 5 && (
                <li>...and {importResult.errors.length - 5} more</li>
              )}
            </ul>
          )}
          <button
            onClick={() => setImportResult(null)}
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{searchQuery || passFilter !== 'all' || roleFilter !== 'all' ? 'No candidates match your filters.' : 'No candidates in this organization yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all toggle */}
          <div className="flex items-center gap-2 px-1 mb-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                allVisibleSelected
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {allVisibleSelected && <CheckSquare className="h-3 w-3" />}
              </div>
              {allVisibleSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {filtered.slice(0, displayLimit).map((c) => {
            const isSelected = selectedIds.has(c.userId)
            return (
              <div
                key={c.userId}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(c.userId)}
                  className="shrink-0"
                  aria-label={`Select ${c.fullName || c.email}`}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  }`}>
                    {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                </button>

                {/* Candidate info — clicking navigates */}
                <button
                  onClick={() => router.push(`/assessments/candidates/${c.userId}`)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.fullName || c.email}
                      </p>
                      {c.fullName && (
                        <p className="text-xs text-slate-500 truncate">{c.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
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
              </div>
            )
          })}
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

      {/* Assign Assessment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Assign Assessment
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Assign to {selectedIds.size} selected candidate{selectedIds.size !== 1 ? 's' : ''}.
              Candidates who already started will be skipped.
            </p>

            {publishedAssessments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                No published assessments available.
              </p>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Assessment
                </label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {publishedAssessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignModal(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={assigning || !selectedAssessmentId || publishedAssessments.length === 0}
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
