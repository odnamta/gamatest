'use client'

/**
 * V13 Phase 9: Question Bank Page
 *
 * Shows all questions across org decks with per-question difficulty stats.
 * Filterable by deck. Creator+ only.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, BarChart3 } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getOrgQuestionBank } from '@/actions/assessment-actions'
import { Badge } from '@/components/ui/badge'

type QuestionItem = {
  cardTemplateId: string
  stem: string
  deckTitle: string
  deckTemplateId: string
  totalAttempts: number
  correctCount: number
  percentCorrect: number
}

export default function QuestionBankPage() {
  const { role } = useOrg()
  const router = useRouter()
  const isCreator = hasMinimumRole(role, 'creator')

  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [decks, setDecks] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'difficulty' | 'recent'>('recent')

  useEffect(() => {
    loadData()
  }, [selectedDeck])

  async function loadData() {
    setLoading(true)
    const result = await getOrgQuestionBank(selectedDeck || undefined)
    if (result.ok && result.data) {
      setQuestions(result.data.questions)
      if (result.data.decks.length > 0 && decks.length === 0) {
        setDecks(result.data.decks)
      }
    }
    setLoading(false)
  }

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to view the question bank.
      </div>
    )
  }

  const filtered = questions
    .filter((q) => {
      if (search) {
        return q.stem.toLowerCase().includes(search.toLowerCase())
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'difficulty') {
        // Questions with no data go last
        if (a.percentCorrect === -1) return 1
        if (b.percentCorrect === -1) return -1
        return a.percentCorrect - b.percentCorrect
      }
      return 0 // keep default order (recent)
    })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/assessments')}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Question Bank</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {questions.length} questions across {decks.length} decks
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedDeck}
          onChange={(e) => setSelectedDeck(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Decks</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'difficulty' | 'recent')}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">Recent first</option>
          <option value="difficulty">Hardest first</option>
        </select>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No questions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const hasStats = q.percentCorrect >= 0
            const isHard = hasStats && q.percentCorrect < 40
            const isMedium = hasStats && q.percentCorrect >= 40 && q.percentCorrect < 70
            return (
              <div
                key={q.cardTemplateId}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                    {q.stem}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{q.deckTitle}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {hasStats ? (
                    <>
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isHard ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${q.percentCorrect}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-10 text-right ${isHard ? 'text-red-500' : isMedium ? 'text-amber-600' : 'text-green-600'}`}>
                        {q.percentCorrect}%
                      </span>
                      <span className="text-xs text-slate-400 w-12 text-right">
                        {q.totalAttempts} att.
                      </span>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No data</Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
