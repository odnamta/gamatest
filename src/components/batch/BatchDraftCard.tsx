'use client'

import { memo, useState } from 'react'
import { X, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { MCQOptionsEditor } from '@/components/mcq/MCQOptionsEditor'
import type { MCQBatchDraftUI } from '@/lib/batch-mcq-schema'
import type { MCQIssue } from '@/lib/mcq-quality-scanner'

interface BatchDraftCardProps {
  draft: MCQBatchDraftUI
  index: number
  sessionTagNames: string[]
  onChange: (updated: MCQBatchDraftUI) => void
}

/**
 * V12: QualityBadge - Shows quality issues for a draft
 */
function QualityBadge({ issues }: { issues?: MCQIssue[] }) {
  if (!issues || issues.length === 0) return null
  
  const highSeverity = issues.filter(i => i.severity === 'high')
  const mediumSeverity = issues.filter(i => i.severity === 'medium')
  
  if (highSeverity.length === 0 && mediumSeverity.length === 0) return null
  
  return (
    <div className="flex items-center gap-1.5">
      {highSeverity.length > 0 && (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full"
          title={highSeverity.map(i => i.message).join('\n')}
        >
          <AlertTriangle className="w-3 h-3" />
          {highSeverity.length} issue{highSeverity.length !== 1 ? 's' : ''}
        </span>
      )}
      {mediumSeverity.length > 0 && highSeverity.length === 0 && (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full"
          title={mediumSeverity.map(i => i.message).join('\n')}
        >
          {mediumSeverity.length} warning{mediumSeverity.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

/**
 * BatchDraftCard - Compact MCQ editor for batch review panel
 * 
 * Displays a single MCQ draft with editable fields and include checkbox.
 * V12: Uses MCQOptionsEditor, shows quality badges, raw text viewer.
 * 
 * Requirements: R1.3 - Batch Review Panel
 * **Feature: v12-quality-scanner-unified-editor**
 */
export const BatchDraftCard = memo(function BatchDraftCard({
  draft,
  index,
  sessionTagNames,
  onChange,
}: BatchDraftCardProps) {
  const [showRawText, setShowRawText] = useState(false)

  const handleStemChange = (value: string) => {
    onChange({ ...draft, stem: value })
  }

  const handleOptionsChange = (options: string[], correctIndex: number) => {
    onChange({ ...draft, options, correctIndex })
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

  // V12: Check if draft has high-severity issues
  const hasHighSeverityIssues = draft.qualityIssues?.some(i => i.severity === 'high') ?? false

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        draft.include
          ? hasHighSeverityIssues
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60'
      }`}
    >
      {/* Header with checkbox, number, and quality badge */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
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
        
        {/* V12: Quality badge */}
        <QualityBadge issues={draft.qualityIssues} />
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
          className="w-full min-h-[60px] px-2 py-1.5 text-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
          placeholder="Question stem..."
        />
      </div>

      {/* V12: Options using MCQOptionsEditor */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Options
        </label>
        <MCQOptionsEditor
          options={draft.options}
          correctIndex={draft.correctIndex}
          onChange={handleOptionsChange}
          disabled={!draft.include}
          compact
        />
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
          className="w-full min-h-[40px] px-2 py-1.5 text-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
          placeholder="Explanation..."
        />
      </div>

      {/* Tags - V6.6: Editable */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
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
          {draft.aiTags.map((tag, tagIndex) => (
            <span
              key={`ai-${tag}-${tagIndex}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
            >
              {tag}
              {draft.include && (
                <button
                  type="button"
                  onClick={() => handleRemoveAiTag(tag)}
                  className="hover:text-purple-900 dark:hover:text-purple-100 active:scale-95"
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
        
        {/* V6.6: Add new tag input */}
        {draft.include && (
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Add tag..."
              className="flex-1 px-2 py-1 text-xs bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const input = e.currentTarget
                  const newTag = input.value.trim()
                  if (newTag && !draft.aiTags.some(t => t.toLowerCase() === newTag.toLowerCase())) {
                    onChange({
                      ...draft,
                      aiTags: [...draft.aiTags, newTag],
                    })
                    input.value = ''
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                const newTag = input.value.trim()
                if (newTag && !draft.aiTags.some(t => t.toLowerCase() === newTag.toLowerCase())) {
                  onChange({
                    ...draft,
                    aiTags: [...draft.aiTags, newTag],
                  })
                  input.value = ''
                }
              }}
              className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 active:scale-95"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* V12: Raw text viewer toggle */}
      {draft.rawTextChunk && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
          <button
            type="button"
            onClick={() => setShowRawText(!showRawText)}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors active:scale-95"
          >
            {showRawText ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide raw text
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                View raw text
              </>
            )}
          </button>
          
          {showRawText && (
            <pre className="mt-2 p-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap break-words">
              {draft.rawTextChunk}
            </pre>
          )}
        </div>
      )}
    </div>
  )
})
