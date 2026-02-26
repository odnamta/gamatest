'use client'

/**
 * V13: Assessment Edit Page
 *
 * Allows creators to update assessment settings before publishing.
 * Only editable while in draft status.
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Eye, EyeOff, CheckCircle2, Target, Link2, Unlink } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { hasMinimumRole } from '@/lib/org-authorization'
import { getAssessment, updateAssessment, publishAssessment, getAssessmentPreviewQuestions } from '@/actions/assessment-actions'
import { getSkillDomainsForDeck, linkDeckToSkill, unlinkDeckFromSkill } from '@/actions/skill-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import type { Assessment } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

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
  const [showPreview, setShowPreview] = useState(false)
  const [previewQuestions, setPreviewQuestions] = useState<{ id: string; stem: string; options: string[]; correctIndex: number }[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  // V19: Skill domain linking state
  const skillsEnabled = org.settings?.features?.skills_mapping ?? false
  const [linkedSkills, setLinkedSkills] = useState<{ id: string; name: string; color: string }[]>([])
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string; color: string }[]>([])
  const [skillLinking, startSkillTransition] = useTransition()
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)

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

  async function loadSkillDomains(deckTemplateId: string) {
    if (!skillsEnabled) return
    const skillResult = await getSkillDomainsForDeck(deckTemplateId)
    if (skillResult.ok && skillResult.data) {
      setLinkedSkills(skillResult.data.linked)
      setAvailableSkills(skillResult.data.available)
    }
  }

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
        // V19: Load skill domain mappings for this assessment's deck
        loadSkillDomains(a.deck_template_id)
      } else if (!result.ok) {
        setError(result.error)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadPreview() {
    setPreviewLoading(true)
    setShowPreview(true)
    const result = await getAssessmentPreviewQuestions(assessmentId, 10)
    if (result.ok && result.data) {
      setPreviewQuestions(result.data)
    }
    setPreviewLoading(false)
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

  // V19: Skill domain linking handlers
  function handleLinkSkill(skillDomainId: string) {
    if (!assessment) return
    startSkillTransition(async () => {
      const result = await linkDeckToSkill(assessment.deck_template_id, skillDomainId)
      if (result.ok) {
        setShowSkillDropdown(false)
        await loadSkillDomains(assessment.deck_template_id)
      }
    })
  }

  function handleUnlinkSkill(skillDomainId: string) {
    if (!assessment) return
    startSkillTransition(async () => {
      const result = await unlinkDeckFromSkill(assessment.deck_template_id, skillDomainId)
      if (result.ok) {
        await loadSkillDomains(assessment.deck_template_id)
      }
    })
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

        {/* V19: Skill Domain Linking Section */}
        {skillsEnabled && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Skill Domains
                </h3>
              </div>
              {isCreator && availableSkills.length > 0 && (
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                    disabled={skillLinking}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Link Skill
                  </Button>
                  {showSkillDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                      {availableSkills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleLinkSkill(skill.id)}
                          disabled={skillLinking}
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: skill.color }}
                          />
                          <span className="truncate">{skill.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Linked skill domains receive score updates when candidates complete this assessment.
            </p>

            {linkedSkills.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                No skill domains linked yet. Link skill domains to track competencies.
              </p>
            ) : (
              <div className="space-y-2">
                {linkedSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: skill.color }}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {skill.name}
                      </span>
                    </div>
                    {isCreator && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlinkSkill(skill.id)}
                        disabled={skillLinking}
                        title="Unlink skill domain"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isDraft && (
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={saving} disabled={saving || !title}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={publishing}
              onClick={handlePublish}
              disabled={publishing}
            >
              Publish Assessment
            </Button>
          </div>
        )}
      </form>

      {/* Question Preview Section */}
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Question Preview
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => showPreview ? setShowPreview(false) : loadPreview()}
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPreview ? 'Hide' : 'Preview Questions'}
          </Button>
        </div>

        {showPreview && (
          <div>
            {previewLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
                ))}
              </div>
            ) : previewQuestions.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No questions found in the linked deck.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setShowAnswers(!showAnswers)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showAnswers ? 'Hide correct answers' : 'Show correct answers'}
                  </button>
                  <span className="text-xs text-slate-400">
                    Showing {previewQuestions.length} of {assessment?.question_count ?? '?'} questions
                  </span>
                </div>
                <div className="space-y-3">
                  {previewQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                        <span className="text-slate-400 mr-1">{qIdx + 1}.</span>
                        {q.stem}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded ${
                              showAnswers && oIdx === q.correctIndex
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700'
                                : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {showAnswers && oIdx === q.correctIndex && (
                              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="font-medium mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
