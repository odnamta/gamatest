'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Check, AlertCircle, ArrowRight } from 'lucide-react'
import { 
  analyzeTagConsolidation, 
  mergeMultipleTags,
  type MergeSuggestion 
} from '@/actions/admin-tag-actions'
import { useToast } from '@/components/ui/Toast'

/**
 * V9.6: Smart Cleanup Tab - AI-powered tag consolidation
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

interface SmartCleanupTabProps {
  onMergeComplete: () => void
}

export function SmartCleanupTab({ onMergeComplete }: SmartCleanupTabProps) {
  const { showToast } = useToast()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [suggestions, setSuggestions] = useState<MergeSuggestion[] | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Req 3.2: Analyze Tags button handler
  async function handleAnalyze() {
    setIsAnalyzing(true)
    setError(null)
    setSuggestions(null)
    setSelectedGroups(new Set())

    const result = await analyzeTagConsolidation()

    setIsAnalyzing(false)

    if (result.ok) {
      setSuggestions(result.suggestions)
      // Auto-select all groups by default
      setSelectedGroups(new Set(result.suggestions.map((_, i) => i)))
    } else {
      switch (result.error) {
        case 'NOT_CONFIGURED':
          setError('AI is not configured. Please set OPENAI_API_KEY in .env.local')
          break
        case 'AUTH_ERROR':
          setError('Authentication required')
          break
        case 'PARSE_ERROR':
          setError('Failed to parse AI response. Please try again.')
          break
        default:
          setError('AI service unavailable. Please try again later.')
      }
    }
  }

  // Req 4.1: Toggle group selection
  function toggleGroup(index: number) {
    setSelectedGroups(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Req 4.2, 4.3, 4.4, 4.5: Execute merges for selected groups
  async function handleApprove() {
    if (!suggestions || selectedGroups.size === 0) return

    setIsMerging(true)
    
    let successCount = 0
    let failCount = 0
    let totalAffected = 0

    // Process each selected group
    for (const index of selectedGroups) {
      const group = suggestions[index]
      const sourceTagIds = group.variations.map(v => v.tagId)
      
      try {
        const result = await mergeMultipleTags(sourceTagIds, group.masterTagId)
        
        if (result.ok) {
          successCount++
          totalAffected += result.affectedCards
        } else {
          failCount++
          console.error(`Failed to merge group "${group.masterTagName}":`, result.error)
        }
      } catch (err) {
        failCount++
        console.error(`Error merging group "${group.masterTagName}":`, err)
      }
    }

    setIsMerging(false)

    // Req 4.4: Clear suggestions and refresh
    if (successCount > 0) {
      showToast(
        `Merged ${successCount} group${successCount !== 1 ? 's' : ''}, ${totalAffected} card${totalAffected !== 1 ? 's' : ''} affected`,
        'success'
      )
      setSuggestions(null)
      setSelectedGroups(new Set())
      onMergeComplete()
    }

    // Req 4.5: Report failures
    if (failCount > 0) {
      showToast(`${failCount} merge${failCount !== 1 ? 's' : ''} failed`, 'error')
    }
  }

  // Select/deselect all
  function toggleSelectAll() {
    if (!suggestions) return
    
    if (selectedGroups.size === suggestions.length) {
      setSelectedGroups(new Set())
    } else {
      setSelectedGroups(new Set(suggestions.map((_, i) => i)))
    }
  }

  const canApprove = selectedGroups.size > 0 && !isMerging

  return (
    <div className="space-y-6">
      {/* Header with Analyze button */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div>
          <h3 className="font-medium text-slate-900 dark:text-white">
            AI-Powered Tag Cleanup
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automatically identify typos, synonyms, and casing issues
          </p>
        </div>
        
        {/* Req 3.2: Analyze Tags button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze Tags
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Req 3.5: Empty state - all tags are clean */}
      {suggestions !== null && suggestions.length === 0 && (
        <div className="text-center py-12">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            All tags look clean!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            No duplicates, typos, or synonyms detected.
          </p>
        </div>
      )}

      {/* Req 3.3, 3.4: Merge group list */}
      {suggestions !== null && suggestions.length > 0 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {selectedGroups.size === suggestions.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {selectedGroups.size} of {suggestions.length} selected
              </span>
            </div>
            
            {/* Req 4.1: Approve Selected button */}
            <button
              onClick={handleApprove}
              disabled={!canApprove}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Approve Selected
                </>
              )}
            </button>
          </div>

          {/* Suggestion groups */}
          <div className="space-y-3">
            {suggestions.map((group, index) => (
              <MergeGroupCard
                key={`${group.masterTagId}-${index}`}
                group={group}
                isSelected={selectedGroups.has(index)}
                onToggle={() => toggleGroup(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Initial state - no analysis yet */}
      {suggestions === null && !error && !isAnalyzing && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Click &quot;Analyze Tags&quot; to scan for duplicates and typos</p>
        </div>
      )}
    </div>
  )
}

/**
 * Individual merge group card
 * Req 3.4: Show master tag prominently with variations listed
 */
interface MergeGroupCardProps {
  group: MergeSuggestion
  isSelected: boolean
  onToggle: () => void
}

function MergeGroupCard({ group, isSelected, onToggle }: MergeGroupCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-4 h-4 rounded border-slate-300"
        />

        <div className="flex-1 min-w-0">
          {/* Master tag - prominent */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {group.masterTagName}
            </span>
            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
              Keep
            </span>
          </div>

          {/* Variations */}
          <div className="flex flex-wrap items-center gap-2">
            {group.variations.map((variation) => (
              <div
                key={variation.tagId}
                className="flex items-center gap-1 text-sm"
              >
                <span className="text-slate-500 dark:text-slate-400">
                  {variation.tagName}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </div>
            ))}
            <span className="text-xs text-slate-400">
              → merge into &quot;{group.masterTagName}&quot;
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
