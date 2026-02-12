'use client'

/**
 * V13: Organization Settings Page
 *
 * Allows admins/owners to configure org name, feature flags, and branding.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { updateOrgSettings } from '@/actions/org-actions'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { OrgFeatures, AssessmentDefaults } from '@/types/database'

const FEATURE_LABELS: Record<keyof OrgFeatures, { label: string; description: string }> = {
  study_mode: { label: 'Study Mode', description: 'Spaced repetition and self-paced learning' },
  assessment_mode: { label: 'Assessment Mode', description: 'Timed exams with scoring and certification' },
  proctoring: { label: 'Proctoring', description: 'Anti-cheat monitoring during assessments' },
  certification: { label: 'Certification', description: 'Generate certificates upon completion' },
  ai_generation: { label: 'AI Content Generation', description: 'Auto-generate questions from documents' },
  pdf_extraction: { label: 'PDF Extraction', description: 'Extract questions from uploaded PDFs' },
  flashcards: { label: 'Flashcards', description: 'Traditional flashcard study mode' },
  erp_integration: { label: 'ERP Integration', description: 'Connect with external HR/ERP systems' },
}

export default function OrgSettingsPage() {
  const { org, role } = useOrg()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(org.name)
  const [features, setFeatures] = useState<OrgFeatures>(
    org.settings?.features ?? {
      study_mode: true,
      assessment_mode: false,
      proctoring: false,
      certification: false,
      ai_generation: true,
      pdf_extraction: true,
      flashcards: true,
      erp_integration: false,
    }
  )
  const [assessmentDefaults, setAssessmentDefaults] = useState<AssessmentDefaults>(
    org.settings?.assessment_defaults ?? {
      time_limit_minutes: 60,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: false,
      show_results: true,
      allow_review: true,
    }
  )
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Only admins and owners can access organization settings.</p>
      </div>
    )
  }

  function toggleFeature(key: keyof OrgFeatures) {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateOrgSettings(org.id, {
        name: name.trim() || org.name,
        settings: { features, assessment_defaults: assessmentDefaults },
      })
      if (result.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Organization Settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{org.slug}</p>
        </div>
      </div>

      {/* Name */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">General</h2>
        <div className="space-y-1">
          <Label htmlFor="org-name">Organization name</Label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
        </div>
      </section>

      <Separator className="mb-8" />

      {/* Feature Flags */}
      <section className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Features</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Enable or disable platform capabilities for your organization.
        </p>
        <div className="space-y-4">
          {(Object.entries(FEATURE_LABELS) as [keyof OrgFeatures, { label: string; description: string }][]).map(
            ([key, { label, description }]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={key} className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <Switch
                  id={key}
                  checked={features[key]}
                  onCheckedChange={() => toggleFeature(key)}
                />
              </div>
            )
          )}
        </div>
      </section>

      {/* Assessment Defaults */}
      {features.assessment_mode && (
        <>
          <Separator className="mb-8" />
          <section className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assessment Defaults</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Default values when creating new assessments. Creators can override per assessment.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="default-time">Time Limit (minutes)</Label>
                <input
                  id="default-time"
                  type="number"
                  value={assessmentDefaults.time_limit_minutes}
                  onChange={(e) =>
                    setAssessmentDefaults((d) => ({ ...d, time_limit_minutes: Number(e.target.value) || 60 }))
                  }
                  min={1}
                  max={480}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="default-pass">Pass Score (%)</Label>
                <input
                  id="default-pass"
                  type="number"
                  value={assessmentDefaults.pass_score}
                  onChange={(e) =>
                    setAssessmentDefaults((d) => ({ ...d, pass_score: Number(e.target.value) || 70 }))
                  }
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-shuffle-q" className="text-sm font-medium">Shuffle Questions</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Randomize question order</p>
                </div>
                <Switch
                  id="default-shuffle-q"
                  checked={assessmentDefaults.shuffle_questions}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, shuffle_questions: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-shuffle-o" className="text-sm font-medium">Shuffle Options</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Randomize answer option order</p>
                </div>
                <Switch
                  id="default-shuffle-o"
                  checked={assessmentDefaults.shuffle_options}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, shuffle_options: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-results" className="text-sm font-medium">Show Results</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Show score and results to candidates</p>
                </div>
                <Switch
                  id="default-results"
                  checked={assessmentDefaults.show_results}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, show_results: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-review" className="text-sm font-medium">Allow Review</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Allow candidates to review answers</p>
                </div>
                <Switch
                  id="default-review"
                  checked={assessmentDefaults.allow_review}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, allow_review: v }))}
                />
              </div>
            </div>
          </section>
        </>
      )}

      {/* Save */}
      {message && (
        <p className={`text-sm mb-4 ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}

      <Button onClick={handleSave} loading={isPending}>
        <Save className="h-4 w-4 mr-2" />
        Save Settings
      </Button>
    </div>
  )
}
