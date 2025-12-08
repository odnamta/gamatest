'use client'

/**
 * V11.6: Drafts Panel for Deck View
 * Displays draft cards with bulk selection and publish/archive actions.
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4**
 */

import { useState, useEffect, useCallback } from 'react'
import { Check, Archive, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { getDeckDrafts, bulkPublishDrafts, bulkArchiveDrafts } from '@/actions/batch-mcq-actions'
import type { DraftCardSummary } from '@/types/actions'

interface DeckDraftsPanelProps {
  deckId: string
  isAuthor: boolean
  onRefresh?: () => void
}

export function DeckDraftsPanel({ deckId, isAuthor, onRefresh }: DeckDraftsPanelProps) {
  const [drafts, setDrafts] = useState<DraftCardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [confirmAction, setConfirmAction] = useState<'publish' | 'archive' | null>(null)

  const fetchDrafts = useCallback(async () => {
    if (!isAuthor) return
    
    setLoading(true)
    setError(null)
    
    const result = await getDeckDrafts(deckId)
    
    if (result.ok && result.data) {
      setDrafts(result.data.drafts)
    } else if (!result.ok) {
      setError(result.error)
    }
    
    setLoading(false)
  }, [deckId, isAuthor])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Don't render for non-authors or when no drafts
  if (!isAuthor) return null
  if (!loading && drafts.length === 0) return null

  const handleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)))
    }
  }

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handlePublish = async () => {
    if (selectedIds.size === 0) return
    
    setActionLoading(true)
    const result = await bulkPublishDrafts(Array.from(selectedIds))
    setActionLoading(false)
    setConfirmAction(null)
    
    if (result.ok) {
      setSelectedIds(new Set())
      await fetchDrafts()
      onRefresh?.()
    } else if (!result.ok) {
      setError(result.error)
    }
  }

  const handleArchive = async () => {
    if (selectedIds.size === 0) return
    
    setActionLoading(true)
    const result = await bulkArchiveDrafts(Array.from(selectedIds))
    setActionLoading(false)
    setConfirmAction(null)
    
    if (result.ok) {
      setSelectedIds(new Set())
      await fetchDrafts()
      onRefresh?.()
    } else if (!result.ok) {
      setError(result.error)
    }
  }

  const truncateStem = (stem: string, maxLength = 100) => {
    if (stem.length <= maxLength) return stem
    return stem.slice(0, maxLength) + '...'
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-amber-800 dark:text-amber-200">
            Drafts
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full">
            {loading ? '...' : drafts.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 dark:border-amber-800">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === drafts.length && drafts.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Select all
                  </span>
                </label>
                
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      {selectedIds.size} selected
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => setConfirmAction('publish')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Publish
                    </button>
                    <button
                      onClick={() => setConfirmAction('archive')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-600 hover:bg-slate-700 text-white rounded-md active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  </>
                )}
              </div>

              {/* Draft List - Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100/50 dark:bg-amber-900/30">
                    <tr>
                      <th className="w-10 p-3"></th>
                      <th className="w-16 p-3 text-left font-medium text-amber-800 dark:text-amber-200">#</th>
                      <th className="p-3 text-left font-medium text-amber-800 dark:text-amber-200">Question</th>
                      <th className="w-48 p-3 text-left font-medium text-amber-800 dark:text-amber-200">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-800/50">
                    {drafts.map((draft) => (
                      <tr
                        key={draft.id}
                        className="hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(draft.id)}
                            onChange={() => handleSelectOne(draft.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                          />
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">
                          {draft.questionNumber ?? '-'}
                        </td>
                        <td className="p-3 text-slate-800 dark:text-slate-200 line-clamp-2">
                          {truncateStem(draft.stem)}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {draft.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                {tag.name}
                              </span>
                            ))}
                            {draft.tags.length > 3 && (
                              <span className="px-2 py-0.5 text-xs text-slate-500">
                                +{draft.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Draft List - Mobile Cards */}
              <div className="sm:hidden divide-y divide-amber-100 dark:divide-amber-800/50">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3 flex gap-3 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(draft.id)}
                      onChange={() => handleSelectOne(draft.id)}
                      className="w-4 h-4 mt-1 rounded border-slate-300 dark:border-slate-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {draft.questionNumber && (
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            Q{draft.questionNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
                        {truncateStem(draft.stem, 80)}
                      </p>
                      {draft.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {draft.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            >
                              {tag.name}
                            </span>
                          ))}
                          {draft.tags.length > 2 && (
                            <span className="text-xs text-slate-500">
                              +{draft.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {confirmAction === 'publish' ? 'Publish Drafts?' : 'Archive Drafts?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {confirmAction === 'publish'
                ? `This will publish ${selectedIds.size} draft${selectedIds.size > 1 ? 's' : ''} and make them available for study.`
                : `This will archive ${selectedIds.size} draft${selectedIds.size > 1 ? 's' : ''}. They won't appear in study sessions.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'publish' ? handlePublish : handleArchive}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md active:scale-95 transition-all disabled:opacity-50 ${
                  confirmAction === 'publish'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : confirmAction === 'publish' ? (
                  'Publish'
                ) : (
                  'Archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
