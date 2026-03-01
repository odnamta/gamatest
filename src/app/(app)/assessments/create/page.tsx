'use client'

/**
 * V13: Create Assessment Page
 *
 * Form to create a new assessment from an existing deck template.
 * Creator+ only.
 *
 * Sub-components extracted for code splitting:
 * - TemplateSelector: dropdown to apply saved assessment templates
 * - SkillDomainSection: skill domain linking UI (V19)
 * - SaveTemplateSection: expandable section to save settings as template
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getUserDeckTemplates } from '@/actions/deck-actions'
import { createAssessment, getAssessmentTemplates } from '@/actions/assessment-actions'
import type { AssessmentTemplate, AssessmentTemplateConfig } from '@/types/database'
import { getAssessmentDefaults } from '@/actions/org-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { usePageTitle } from '@/hooks/use-page-title'

const TemplateSelector = dynamic(() => import('./TemplateSelector'), {
  ssr: false,
  loading: () => (
    <div className="mb-6 h-[88px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
  ),
})

const SkillDomainSection = dynamic(() => import('./SkillDomainSection'), {
  ssr: false,
  loading: () => (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  ),
})

const SaveTemplateSection = dynamic(() => import('./SaveTemplateSection'), {
  ssr: false,
  loading: () => (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  ),
})

export default function CreateAssessmentPage() {
  usePageTitle('Create Assessment')
  const { org, role } = useOrg()
  const router = useRouter()
  const isCreator = hasMinimumRole(role, 'creator')

  const [decks, setDecks] = useState<{ id: string; title: string }[]>([])
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // V19: Skill domain linking
  const skillsEnabled = org.settings?.features?.skills_mapping ?? false

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
  const [accessCode, setAccessCode] = useState('')

  useEffect(() => {
    getUserDeckTemplates().then((data) => {
      setDecks(data)
      setLoading(false)
    })
    getAssessmentDefaults().then((result) => {
      if (result.ok && result.data) {
        const d = result.data
        setTimeLimitMinutes(d.time_limit_minutes)
        setPassScore(d.pass_score)
        setShuffleQuestions(d.shuffle_questions)
        setShuffleOptions(d.shuffle_options)
        setShowResults(d.show_results)
        setAllowReview(d.allow_review)
      }
    })
    getAssessmentTemplates().then((result) => {
      if (result.ok && result.data) setTemplates(result.data)
    })
  }, [])

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    const c = tpl.config
    setTimeLimitMinutes(c.time_limit_minutes)
    setPassScore(c.pass_score)
    setQuestionCount(c.question_count)
    setShuffleQuestions(c.shuffle_questions)
    setShuffleOptions(c.shuffle_options)
    setShowResults(c.show_results)
    setMaxAttempts(c.max_attempts ?? undefined)
    setCooldownMinutes(c.cooldown_minutes ?? undefined)
    setAllowReview(c.allow_review)
  }

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
      accessCode: accessCode || undefined,
    })

    if (result.ok) {
      router.push('/assessments')
    } else {
      setError(result.error ?? 'Failed to create assessment')
      setSubmitting(false)
    }
  }

  const currentConfig: AssessmentTemplateConfig = {
    time_limit_minutes: timeLimitMinutes,
    pass_score: passScore,
    question_count: questionCount,
    shuffle_questions: shuffleQuestions,
    shuffle_options: shuffleOptions,
    show_results: showResults,
    max_attempts: maxAttempts ?? null,
    cooldown_minutes: cooldownMinutes ?? null,
    allow_review: allowReview,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: 'Create Assessment' },
      ]} />

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Create Assessment
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Template Selector — lazy loaded */}
      {templates.length > 0 && (
        <TemplateSelector templates={templates} onApply={applyTemplate} />
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
              <option value="">Pilih deck...</option>
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
              max={99}
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
              max={10080}
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

        {/* Access Code */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Access Code (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. 123456"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 mt-1">Candidates must enter this code to start the exam</p>
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

        {/* V19: Skill Domain Linking — lazy loaded */}
        {skillsEnabled && deckTemplateId && (
          <SkillDomainSection key={deckTemplateId} deckTemplateId={deckTemplateId} />
        )}

        {/* Save as Template — lazy loaded */}
        <SaveTemplateSection
          config={currentConfig}
          onTemplateSaved={(tpl) => setTemplates((prev) => [tpl, ...prev])}
        />

        <Button
          type="submit"
          loading={submitting}
          disabled={submitting || !deckTemplateId || !title}
          className="w-full"
        >
          Buat Asesmen (sebagai Draft)
        </Button>
      </form>
    </div>
  )
}
