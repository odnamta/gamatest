'use client'

/**
 * Template Selector
 * Extracted from create/page.tsx for code splitting.
 *
 * Dropdown that loads saved assessment templates and applies their settings.
 * Dynamically imported with { ssr: false } since it's conditionally rendered
 * (only when templates.length > 0).
 */

import { FileDown } from 'lucide-react'
import type { AssessmentTemplate } from '@/types/database'

interface TemplateSelectorProps {
  templates: AssessmentTemplate[]
  onApply: (templateId: string) => void
}

export default function TemplateSelector({ templates, onApply }: TemplateSelectorProps) {
  return (
    <div className="mb-6 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <div className="flex items-center gap-2 mb-2">
        <FileDown className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Load from Template
        </span>
      </div>
      <select
        onChange={(e) => { if (e.target.value) onApply(e.target.value); e.target.value = '' }}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Pilih template untuk menerapkan pengaturan...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
