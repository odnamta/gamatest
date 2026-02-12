'use client'

/**
 * V13: Create Assessment Page
 *
 * Form to create a new assessment from an existing deck template.
 * Creator+ only.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getUserDeckTemplates } from '@/actions/deck-actions'
import { createAssessment } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function CreateAssessmentPage() {
  const { role } = useOrg()
  const router = useRouter()
  const isCreator = hasMinimumRole(role, 'creator')

  const [decks, setDecks] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [deckTemplateId, setDeckTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60)
  const [passScore, setPassScore] = useState(70)
  const [questionCount, setQuestionCount] = useState(20)
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [showResults, setShowResults] = useState(true)
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>(undefined)
  const [cooldownMinutes, setCooldownMinutes] = useState<number | undefined>(undefined)
  const [allowReview, setAllowReview] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    getUserDeckTemplates().then((data) => {
      setDecks(data)
      setLoading(false)
    })
  }, [])

  if (!isCreator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to create assessments.
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!deckTemplateId) {
      setError('Please select a deck')
      return
    }

    setSubmitting(true)
    const result = await createAssessment({
      deckTemplateId,
      title,
      description: description || undefined,
      timeLimitMinutes,
      passScore,
      questionCount,
      shuffleQuestions,
      shuffleOptions,
      showResults,
      maxAttempts,
      cooldownMinutes: cooldownMinutes,
      allowReview,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
    })

    if (result.ok) {
      router.push('/assessments')
    } else {
      setError(result.error ?? 'Failed to create assessment')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Create Assessment
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deck Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Source Deck *
          </label>
          {loading ? (
            <div className="text-sm text-slate-500">Loading decks...</div>
          ) : decks.length === 0 ? (
            <div className="text-sm text-slate-500">
              No decks available. Create a deck with questions first.
            </div>
          ) : (
            <select
              value={deckTemplateId}
              onChange={(e) => setDeckTemplateId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a deck...</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Title */}
        <Input
          label="Assessment Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Midterm Exam - Chapter 1-5"
          required
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions or notes for candidates..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Numeric Settings */}
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Time Limit (min)"
            type="number"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            min={1}
            max={480}
          />
          <Input
            label="Pass Score (%)"
            type="number"
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
            min={0}
            max={100}
          />
          <Input
            label="Questions"
            type="number"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            min={1}
            max={500}
          />
        </div>

        {/* Max Attempts + Cooldown */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Max Attempts (blank = unlimited)
            </label>
            <input
              type="number"
              value={maxAttempts ?? ''}
              onChange={(e) =>
                setMaxAttempts(e.target.value ? Number(e.target.value) : undefined)
              }
              min={1}
              placeholder="Unlimited"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Cooldown (minutes, blank = none)
            </label>
            <input
              type="number"
              value={cooldownMinutes ?? ''}
              onChange={(e) =>
                setCooldownMinutes(e.target.value ? Number(e.target.value) : undefined)
              }
              min={1}
              placeholder="No cooldown"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Schedule (optional) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Date (optional)
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              End Date (optional)
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Toggle Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Shuffle question order
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Shuffle answer options
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Show results to candidates after completion
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowReview}
              onChange={(e) => setAllowReview(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Allow candidates to review answers after completion
            </span>
          </label>
        </div>

        <Button
          type="submit"
          loading={submitting}
          disabled={submitting || !deckTemplateId || !title}
          className="w-full"
        >
          Create Assessment (as Draft)
        </Button>
      </form>
    </div>
  )
}
