'use client'

/**
 * V13 Phase 9: Question Bank Page
 *
 * Shows all questions across org decks with per-question difficulty stats.
 * Filterable by deck. Creator+ only.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, BarChart3, Filter } from 'lucide-react'
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
  const [sortBy, setSortBy] = useState<'difficulty' | 'easiest' | 'most-used' | 'recent'>('recent')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'hard' | 'medium' | 'easy' | 'no-data'>('all')
  const [displayLimit, setDisplayLimit] = useState(30)

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
      if (search && !q.stem.toLowerCase().includes(search.toLowerCase())) return false
      if (difficultyFilter === 'hard') return q.percentCorrect >= 0 && q.percentCorrect < 40
      if (difficultyFilter === 'medium') return q.percentCorrect >= 40 && q.percentCorrect < 70
      if (difficultyFilter === 'easy') return q.percentCorrect >= 70
      if (difficultyFilter === 'no-data') return q.percentCorrect === -1
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'difficulty') {
        if (a.percentCorrect === -1) return 1
        if (b.percentCorrect === -1) return -1
        return a.percentCorrect - b.percentCorrect
      }
      if (sortBy === 'easiest') {
        if (a.percentCorrect === -1) return 1
        if (b.percentCorrect === -1) return -1
        return b.percentCorrect - a.percentCorrect
      }
      if (sortBy === 'most-used') return b.totalAttempts - a.totalAttempts
      return 0
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
            aria-label="Search questions"
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
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">Recent first</option>
          <option value="difficulty">Hardest first</option>
          <option value="easiest">Easiest first</option>
          <option value="most-used">Most used</option>
        </select>
      </div>

      {/* Difficulty filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        {(['all', 'hard', 'medium', 'easy', 'no-data'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setDifficultyFilter(f)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              difficultyFilter === f
                ? f === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : f === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : f === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'hard' ? 'Hard (<40%)' : f === 'medium' ? 'Medium (40-70%)' : f === 'easy' ? 'Easy (>70%)' : 'No Data'}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">
          {filtered.length} question{filtered.length !== 1 ? 's' : ''}
        </span>
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
          {filtered.slice(0, displayLimit).map((q) => {
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
