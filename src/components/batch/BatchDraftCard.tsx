'use client'

import { X } from 'lucide-react'
import type { MCQBatchDraftUI } from '@/lib/batch-mcq-schema'

interface BatchDraftCardProps {
  draft: MCQBatchDraftUI
  index: number
  sessionTagNames: string[]
  onChange: (updated: MCQBatchDraftUI) => void
}

/**
 * BatchDraftCard - Compact MCQ editor for batch review panel
 * 
 * Displays a single MCQ draft with editable fields and include checkbox.
 * 
 * Requirements: R1.3 - Batch Review Panel
 */
export function BatchDraftCard({
  draft,
  index,
  sessionTagNames,
  onChange,
}: BatchDraftCardProps) {
  const handleStemChange = (value: string) => {
    onChange({ ...draft, stem: value })
  }

  const handleOptionChange = (optionIndex: number, value: string) => {
    const newOptions = [...draft.options]
    newOptions[optionIndex] = value
    onChange({ ...draft, options: newOptions })
  }

  const handleCorrectIndexChange = (value: number) => {
    onChange({ ...draft, correctIndex: value })
  }

  const handleExplanationChange = (value: string) => {
    onChange({ ...draft, explanation: value })
  }

  const handleIncludeChange = (value: boolean) => {
    onChange({ ...draft, include: value })
  }

  const handleRemoveAiTag = (tagToRemove: string) => {
    onChange({
      ...draft,
      aiTags: draft.aiTags.filter((tag) => tag !== tagToRemove),
    })
  }

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        draft.include
          ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60'
      }`}
    >
      {/* Header with checkbox and number */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="checkbox"
          checked={draft.include}
          onChange={(e) => handleIncludeChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          aria-label={`Include question ${index + 1}`}
        />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Question {index + 1}
        </span>
      </div>

      {/* Stem */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Question Stem
        </label>
        <textarea
          value={draft.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          disabled={!draft.include}
          className="w-full min-h-[60px] px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
          placeholder="Question stem..."
        />
      </div>

      {/* Options */}
      <div className="mb-3 space-y-2">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          Options
        </label>
        {draft.options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex items-center gap-2">
            <input
              type="radio"
              checked={draft.correctIndex === optionIndex}
              onChange={() => handleCorrectIndexChange(optionIndex)}
              disabled={!draft.include}
              className="w-3 h-3 text-blue-600"
              aria-label={`Mark option ${String.fromCharCode(65 + optionIndex)} as correct`}
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-4">
              {String.fromCharCode(65 + optionIndex)}.
            </span>
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(optionIndex, e.target.value)}
              disabled={!draft.include}
              className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
            />
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Explanation (optional)
        </label>
        <textarea
          value={draft.explanation}
          onChange={(e) => handleExplanationChange(e.target.value)}
          disabled={!draft.include}
          className="w-full min-h-[40px] px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
          placeholder="Explanation..."
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {/* Session tags (read-only) */}
          {sessionTagNames.map((tag) => (
            <span
              key={`session-${tag}`}
              className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
            >
              {tag}
            </span>
          ))}
          
          {/* AI tags (removable) */}
          {draft.aiTags.map((tag) => (
            <span
              key={`ai-${tag}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
            >
              {tag}
              {draft.include && (
                <button
                  type="button"
                  onClick={() => handleRemoveAiTag(tag)}
                  className="hover:text-purple-900 dark:hover:text-purple-100"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          
          {sessionTagNames.length === 0 && draft.aiTags.length === 0 && (
            <span className="text-xs text-slate-400">No tags</span>
          )}
        </div>
      </div>
    </div>
  )
}
