'use client'

/**
 * Save Template Section
 * Extracted from create/page.tsx for code splitting.
 *
 * Expandable section that lets creators save current assessment settings as a reusable template.
 * Dynamically imported with { ssr: false }.
 */

import { useState } from 'react'
import { BookmarkPlus } from 'lucide-react'
import { saveAssessmentTemplate } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'
import type { AssessmentTemplateConfig, AssessmentTemplate } from '@/types/database'

interface SaveTemplateSectionProps {
  config: AssessmentTemplateConfig
  onTemplateSaved: (template: AssessmentTemplate) => void
}

export default function SaveTemplateSection({ config, onTemplateSaved }: SaveTemplateSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  async function handleSave() {
    if (!name.trim()) return
    const result = await saveAssessmentTemplate({ name: name.trim(), config })
    if (result.ok && result.data) {
      onTemplateSaved(result.data)
      setName('')
      setShowForm(false)
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save current settings as template
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g., Quick Quiz)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="button" size="sm" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Batal
          </button>
        </div>
      )}
    </div>
  )
}
