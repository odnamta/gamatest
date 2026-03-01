'use client'

/**
 * V13: Assessment Edit Page
 *
 * Allows creators to update assessment settings before publishing.
 * Only editable while in draft status.
 *
 * Sub-components extracted for code splitting:
 * - SkillDomainSection: skill domain linking UI (V19)
 * - QuestionPreviewPanel: toggleable question preview with answer reveal
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Save } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getAssessment, updateAssessment, publishAssessment } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import type { Assessment } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

const SkillDomainSection = dynamic(() => import('./SkillDomainSection'), {
  ssr: false,
  loading: () => (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  ),
})

const QuestionPreviewPanel = dynamic(() => import('./QuestionPreviewPanel'), {
  ssr: false,
  loading: () => (
    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  ),
})

export default function EditAssessmentPage() {
  usePageTitle('Edit Assessment')
  const { org, role } = useOrg()
  const router = useRouter()
  const params = useParams()
  const assessmentId = params.id as string
  const isCreator = hasMinimumRole(role, 'creator')

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // V19: Skill domain linking
  const skillsEnabled = org.settings?.features?.skills_mapping ?? false

  // Form state
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
    async function load() {
      const result = await getAssessment(assessmentId)
      if (result.ok && result.data) {
        const a = result.data
        setAssessment(a)
        setTitle(a.title)
        setDescription(a.description ?? '')
        setTimeLimitMinutes(a.time_limit_minutes)
        setPassScore(a.pass_score)
        setQuestionCount(a.question_count)
        setShuffleQuestions(a.shuffle_questions)
        setShuffleOptions(a.shuffle_options)
        setShowResults(a.show_results)
        setMaxAttempts(a.max_attempts ?? undefined)
        setCooldownMinutes(a.cooldown_minutes ?? undefined)
        setAllowReview(a.allow_review)
        setStartDate(a.start_date ? new Date(a.start_date).toISOString().slice(0, 16) : '')
        setEndDate(a.end_date ? new Date(a.end_date).toISOString().slice(0, 16) : '')
      } else if (!result.ok) {
        setError(result.error)
      }
      setLoading(false)
    }
    load()
  }, [assessmentId])

  if (!isCreator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-500">
        You do not have permission to edit assessments.
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    const result = await updateAssessment(assessmentId, {
      title,
      description: description || undefined,
      timeLimitMinutes,
      passScore,
      questionCount,
      shuffleQuestions,
      shuffleOptions,
      showResults,
      maxAttempts: maxAttempts ?? null,
      cooldownMinutes: cooldownMinutes ?? null,
      allowReview,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    })

    if (result.ok) {
      setSuccess('Changes saved')
      if (result.data) setAssessment(result.data)
    } else if (!result.ok) {
      setError(result.error)
    }
    setSaving(false)
  }

  async function handlePublish() {
    setError(null)
    setPublishing(true)

    const result = await publishAssessment(assessmentId)
    if (result.ok) {
      router.push('/assessments')
    } else if (!result.ok) {
      setError(result.error)
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-500">
        Loading assessment...
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-500">
        Assessment not found.
      </div>
    )
  }

  const isDraft = assessment.status === 'draft'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: assessment.title, href: `/assessments/${assessmentId}/analytics` },
        { label: 'Edit' },
      ]} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Edit Assessment
        </h1>
        <Badge variant={assessment.status === 'published' ? 'default' : 'secondary'}>
          {assessment.status}
        </Badge>
      </div>

      {!isDraft && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          This assessment is {assessment.status}. Settings can only be changed while in draft status.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Input
          label="Assessment Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!isDraft}
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isDraft}
            rows={3}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Time Limit (min)"
            type="number"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            disabled={!isDraft}
            min={1}
            max={480}
          />
          <Input
            label="Pass Score (%)"
            type="number"
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
            disabled={!isDraft}
            min={0}
            max={100}
          />
          <Input
            label="Questions"
            type="number"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            disabled={!isDraft}
            min={1}
            max={500}
          />
        </div>

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
              disabled={!isDraft}
              min={1}
              placeholder="Unlimited"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
              disabled={!isDraft}
              min={1}
              placeholder="No cooldown"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Date (optional)
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!isDraft}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
              disabled={!isDraft}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              disabled={!isDraft}
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
              disabled={!isDraft}
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
              disabled={!isDraft}
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
              disabled={!isDraft}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Allow candidates to review answers after completion
            </span>
          </label>
        </div>

        {/* V19: Skill Domain Linking — lazy loaded */}
        {skillsEnabled && (
          <SkillDomainSection
            deckTemplateId={assessment.deck_template_id}
            canEdit={isCreator}
          />
        )}

        {isDraft && (
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={saving} disabled={saving || !title}>
              <Save className="h-4 w-4 mr-2" />
              Simpan Perubahan
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={publishing}
              onClick={handlePublish}
              disabled={publishing}
            >
              Terbitkan Asesmen
            </Button>
          </div>
        )}
      </form>

      {/* Question Preview — lazy loaded */}
      <QuestionPreviewPanel
        assessmentId={assessmentId}
        totalQuestionCount={assessment.question_count}
      />
    </div>
  )
}
