'use client'

/**
 * V22: Assessment Templates Management Page
 *
 * Lists saved assessment templates, allows creating new ones or deleting existing.
 * Templates store reusable assessment configurations (time limit, pass score, etc.).
 */

import { useState, useEffect, useTransition } from 'react'
import { Plus, Trash2, Clock, Target, Shuffle, RotateCcw } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getAssessmentTemplates,
  saveAssessmentTemplate,
  deleteAssessmentTemplate,
} from '@/actions/assessment-actions'
import { hasMinimumRole } from '@/lib/org-authorization'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AssessmentTemplate, AssessmentTemplateConfig } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

const DEFAULT_CONFIG: AssessmentTemplateConfig = {
  time_limit_minutes: 60,
  pass_score: 70,
  question_count: 30,
  shuffle_questions: true,
  shuffle_options: false,
  show_results: true,
  max_attempts: null,
  cooldown_minutes: null,
  allow_review: true,
}

export default function AssessmentTemplatesPage() {
  usePageTitle('Assessment Templates')
  const { role } = useOrg()
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [config, setConfig] = useState<AssessmentTemplateConfig>(DEFAULT_CONFIG)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getAssessmentTemplates()
      if (result.ok && result.data) setTemplates(result.data)
      setLoading(false)
    }
    load()
  }, [])

  if (!hasMinimumRole(role, 'creator')) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Requires creator role or above.</p>
      </div>
    )
  }

  function handleCreate() {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Template name is required' })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await saveAssessmentTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        config,
      })
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
      } else if (result.data) {
        setTemplates(prev => [result.data!, ...prev])
        setShowCreate(false)
        setName('')
        setDescription('')
        setConfig(DEFAULT_CONFIG)
        setMessage({ type: 'success', text: 'Template created' })
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAssessmentTemplate(id)
      if (result.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Assessments', href: '/assessments' },
        { label: 'Templates' },
      ]} />

      <div className="flex items-center justify-between mb-8 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assessment Templates</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Reusable assessment configurations</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {message && (
        <p className={`text-sm mb-4 ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Buat Template</h2>

          <div className="space-y-1">
            <Label htmlFor="tpl-name">Name</Label>
            <input
              id="tpl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Final Exam Config"
              maxLength={100}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
              placeholder="Describe when to use this template..."
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tpl-time">Time Limit (min)</Label>
              <input
                id="tpl-time"
                type="number"
                value={config.time_limit_minutes}
                onChange={(e) => setConfig(c => ({ ...c, time_limit_minutes: Number(e.target.value) || 60 }))}
                min={1} max={480}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-pass">Pass Score (%)</Label>
              <input
                id="tpl-pass"
                type="number"
                value={config.pass_score}
                onChange={(e) => setConfig(c => ({ ...c, pass_score: Number(e.target.value) || 70 }))}
                min={0} max={100}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-count">Questions</Label>
              <input
                id="tpl-count"
                type="number"
                value={config.question_count}
                onChange={(e) => setConfig(c => ({ ...c, question_count: Number(e.target.value) || 30 }))}
                min={1} max={500}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tpl-attempts">Max Attempts (empty = unlimited)</Label>
              <input
                id="tpl-attempts"
                type="number"
                value={config.max_attempts ?? ''}
                onChange={(e) => setConfig(c => ({ ...c, max_attempts: e.target.value ? Number(e.target.value) : null }))}
                min={1} max={99}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-cooldown">Cooldown (min, empty = none)</Label>
              <input
                id="tpl-cooldown"
                type="number"
                value={config.cooldown_minutes ?? ''}
                onChange={(e) => setConfig(c => ({ ...c, cooldown_minutes: e.target.value ? Number(e.target.value) : null }))}
                min={1} max={10080}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {([
              ['shuffle_questions', 'Shuffle Questions', 'Randomize question order'] as const,
              ['shuffle_options', 'Shuffle Options', 'Randomize option order'] as const,
              ['show_results', 'Show Results', 'Show score to candidate after completion'] as const,
              ['allow_review', 'Allow Review', 'Let candidates review their answers'] as const,
            ]).map(([key, label, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={`tpl-${key}`} className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
                <Switch
                  id={`tpl-${key}`}
                  checked={config[key]}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button size="sm" onClick={handleCreate} loading={isPending}>Buat Template</Button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat template...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 mb-2">No templates yet</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Create a template to reuse assessment configurations across exams.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div
              key={t.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</h3>
                  {t.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete template"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.config.time_limit_minutes}min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Pass: {t.config.pass_score}%
                </span>
                <span>{t.config.question_count} questions</span>
                {t.config.shuffle_questions && (
                  <span className="inline-flex items-center gap-1">
                    <Shuffle className="h-3 w-3" /> Shuffled
                  </span>
                )}
                {t.config.max_attempts && (
                  <span className="inline-flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {t.config.max_attempts} attempts
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
