'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { CardListItem } from './CardListItem'
import { BulkActionsBar } from './BulkActionsBar'
import { BulkTagModal } from './BulkTagModal'
import { DeckSelector } from './DeckSelector'
import { FilterBar } from '@/components/tags/FilterBar'
import { TagSelector } from '@/components/tags/TagSelector'
import { AutoTagProgressModal } from '@/components/tags/AutoTagProgressModal'
import { deleteCard, duplicateCard, bulkDeleteCards, bulkMoveCards, getAllCardIdsInDeck } from '@/actions/card-actions'
import { useAutoTag } from '@/hooks/use-auto-tag'
import { useToast } from '@/components/ui/Toast'
import type { Card, Tag } from '@/types/database'

// Extended card type with tags and book_source
// V11.1: Added book_source for source filtering
interface CardWithTags extends Card {
  tags?: Tag[]
  book_source?: {
    id: string
    title: string
  } | null
}

interface CardListProps {
  cards: CardWithTags[]
  deckId: string
  deckTitle?: string
  allTags?: Tag[]
  isAuthor?: boolean
  /** V9.3: Deck subject for context-aware AI tagging */
  deckSubject?: string
}

/**
 * CardList - Client component wrapper for card list with bulk actions
 * V9.3: Integrated useAutoTag hook for chunked auto-tagging with progress modal
 * Requirements: FR-1, FR-3, FR-4, C.1-C.9, V9.3 1.1-1.6, 5.1-5.5
 */
export function CardList({ cards, deckId, deckTitle = 'deck', allTags = [], isAuthor = true, deckSubject }: CardListProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeckSelector, setShowDeckSelector] = useState(false)
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  // V8.6: NeedsReview filter toggle
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false)
  // V9.1: Bulk tag modal state
  const [showBulkTagModal, setShowBulkTagModal] = useState(false)
  // V9.1: Select All in Deck loading state
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  // V9.2: Untagged filter toggle
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(false)
  // V9.3: Auto-tag progress modal state
  const [showAutoTagModal, setShowAutoTagModal] = useState(false)
  // V11.1: Source filter state
  const [filterSourceIds, setFilterSourceIds] = useState<string[]>([])

  // V9.3: useAutoTag hook for chunked processing with progress
  const autoTag = useAutoTag({
    onComplete: (totalTagged, totalSkipped) => {
      if (totalTagged > 0) {
        showToast(
          `Auto-tagged ${totalTagged} card${totalTagged !== 1 ? 's' : ''}${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ''}`,
          'success'
        )
        clearSelection()
        router.refresh()
      }
    },
    onError: (error) => {
      showToast(error || 'Auto-tagging failed', 'error')
    },
  })

  // V8.6: Helper to check if card has NeedsReview tag
  const hasNeedsReviewTag = (card: CardWithTags) => {
    return card.tags?.some((t) => t.name.toLowerCase() === 'needsreview') ?? false
  }

  // V8.6: Count cards needing review
  const needsReviewCount = useMemo(() => {
    return cards.filter(hasNeedsReviewTag).length
  }, [cards])

  // V9.2: Count untagged cards
  const untaggedCount = useMemo(() => {
    return cards.filter(card => !card.tags || card.tags.length === 0).length
  }, [cards])

  // V11.1: Extract distinct book_sources from cards for source filter
  const availableSources = useMemo(() => {
    const sourceMap = new Map<string, { id: string; title: string }>()
    for (const card of cards) {
      if (card.book_source && card.book_source.id) {
        sourceMap.set(card.book_source.id, card.book_source)
      }
    }
    return Array.from(sourceMap.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [cards])

  // Filter cards by selected tags (AND logic - card must have ALL selected tags)
  // V8.6: Also filter by NeedsReview if toggle is on
  // V9.2: Also filter by untagged if toggle is on
  // V11.1: Also filter by source (AND logic with tags)
  const filteredCards = useMemo(() => {
    let result = cards
    
    // V9.2: Apply untagged filter first (mutually exclusive with tag filter)
    if (showUntaggedOnly) {
      result = result.filter(card => !card.tags || card.tags.length === 0)
      return result
    }
    
    // V11.1: Apply source filter (AND logic)
    if (filterSourceIds.length > 0) {
      result = result.filter((card) => {
        return card.book_source && filterSourceIds.includes(card.book_source.id)
      })
    }
    
    // Apply tag filter
    if (filterTagIds.length > 0) {
      result = result.filter((card) => {
        const cardTagIds = card.tags?.map((t) => t.id) || []
        return filterTagIds.every((tagId) => cardTagIds.includes(tagId))
      })
    }
    
    // V8.6: Apply NeedsReview filter
    if (showNeedsReviewOnly) {
      result = result.filter(hasNeedsReviewTag)
    }
    
    return result
  }, [cards, filterTagIds, filterSourceIds, showNeedsReviewOnly, showUntaggedOnly])

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredCards.map((c) => c.id)))
  }

  // V9.1: Select All in Deck - fetches all card IDs from database
  const selectAllInDeck = async () => {
    setIsSelectingAll(true)
    try {
      const allIds = await getAllCardIdsInDeck(deckId)
      setSelectedIds(new Set(allIds))
      if (allIds.length > 0) {
        showToast(`Selected all ${allIds.length} cards in deck`, 'success')
      }
    } catch (error) {
      console.error('Failed to select all cards:', error)
      showToast('Failed to select all cards', 'error')
    } finally {
      setIsSelectingAll(false)
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // V9.1: Handle bulk tag success
  const handleBulkTagSuccess = (count: number) => {
    router.refresh()
  }

  // V9.3: Handle auto-tag with chunked processing and progress modal
  const handleAutoTag = () => {
    if (selectedIds.size === 0) return
    
    setShowAutoTagModal(true)
    autoTag.startTagging([...selectedIds], deckSubject)
  }

  // V9.3: Handle closing the auto-tag modal
  const handleAutoTagModalClose = () => {
    setShowAutoTagModal(false)
    autoTag.reset()
  }

  // Single card handlers
  const handleDelete = async (cardId: string, preview: string, type: string) => {
    const truncatedPreview = preview.length > 80 ? preview.substring(0, 80) + '...' : preview
    const confirmed = window.confirm(`Delete this ${type}?\n\n"${truncatedPreview}"`)
    if (!confirmed) return

    const result = await deleteCard(cardId)
    if (result.ok) {
      showToast('Card deleted', 'success')
      router.refresh()
    } else {
      showToast(result.error || 'Could not delete card', 'error')
    }
  }

  const handleDuplicate = async (cardId: string) => {
    const result = await duplicateCard(cardId)
    if (result.ok) {
      showToast('Card duplicated', 'success')
      router.refresh()
    } else {
      showToast(result.error || 'Could not duplicate card', 'error')
    }
  }

  // Bulk handlers
  const handleBulkDelete = async () => {
    const count = selectedIds.size
    const confirmed = window.confirm(`Delete ${count} card${count !== 1 ? 's' : ''}?`)
    if (!confirmed) return

    const result = await bulkDeleteCards([...selectedIds])
    if (result.ok) {
      showToast(`${result.count} card${result.count !== 1 ? 's' : ''} deleted`, 'success')
      clearSelection()
      router.refresh()
    } else {
      showToast(result.error || 'Could not delete cards', 'error')
    }
  }

  const handleBulkMove = async (targetDeckId: string, targetDeckTitle: string) => {
    setShowDeckSelector(false)
    const result = await bulkMoveCards([...selectedIds], targetDeckId)
    if (result.ok) {
      showToast(`${result.count} card${result.count !== 1 ? 's' : ''} moved to ${targetDeckTitle}`, 'success')
      clearSelection()
      router.refresh()
    } else {
      showToast(result.error || 'Could not move cards', 'error')
    }
  }

  const handleExport = () => {
    const selectedCards = cards.filter((c) => selectedIds.has(c.id))
    const exportData = selectedCards.map((card) => ({
      type: card.card_type,
      ...(card.card_type === 'mcq'
        ? { stem: card.stem, options: card.options, correctIndex: card.correct_index, explanation: card.explanation }
        : { front: card.front, back: card.back, imageUrl: card.image_url }),
    }))
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deckTitle.replace(/\s+/g, '-').toLowerCase()}-export.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`${selectedIds.size} card${selectedIds.size !== 1 ? 's' : ''} exported`, 'success')
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="text-slate-600 dark:text-slate-400">No cards yet</p>
        <p className="text-slate-500 text-sm mt-1">Add your first card using the form above!</p>
      </div>
    )
  }

  return (
    <>
      {/* V8.6: NeedsReview filter toggle */}
      {needsReviewCount > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowNeedsReviewOnly(!showNeedsReviewOnly)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showNeedsReviewOnly
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {showNeedsReviewOnly ? 'Showing' : 'Show'} cards needing review ({needsReviewCount})
          </button>
        </div>
      )}

      {/* Tag filter selector */}
      {allTags.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Filter by tags
          </label>
          <TagSelector
            selectedTagIds={filterTagIds}
            onChange={setFilterTagIds}
          />
        </div>
      )}

      {/* Active filter bar - V9.2: Added untagged toggle, V11.1: Added source filter */}
      <FilterBar
        tags={allTags}
        selectedTagIds={filterTagIds}
        onTagsChange={setFilterTagIds}
        onClear={() => setFilterTagIds([])}
        showUntaggedOnly={showUntaggedOnly}
        onShowUntaggedOnlyChange={setShowUntaggedOnly}
        untaggedCount={untaggedCount}
        availableSources={availableSources}
        selectedSourceIds={filterSourceIds}
        onSourcesChange={setFilterSourceIds}
      />

      {/* Bulk actions bar - Author only for delete/move/tag */}
      {isAuthor && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onDelete={handleBulkDelete}
          onMove={() => setShowDeckSelector(true)}
          onExport={handleExport}
          onAddTag={() => setShowBulkTagModal(true)}
          onAutoTag={handleAutoTag}
          isAutoTagging={autoTag.isTagging}
          onClearSelection={clearSelection}
        />
      )}

      {/* Select all toggle - V9.1: Added Select All in Deck */}
      {filteredCards.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectedIds.size === filteredCards.length ? clearSelection : selectAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {selectedIds.size === filteredCards.length ? 'Deselect all' : 'Select all'}
          </button>
          {/* V9.1: Select All in Deck button for bulk operations */}
          {isAuthor && cards.length > filteredCards.length && (
            <button
              onClick={selectAllInDeck}
              disabled={isSelectingAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {isSelectingAll ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </>
              ) : (
                'Select all in deck'
              )}
            </button>
          )}
          {selectedIds.size > 0 && selectedIds.size < filteredCards.length && (
            <span className="text-sm text-slate-500">({selectedIds.size} of {filteredCards.length})</span>
          )}
          {filterTagIds.length > 0 && (
            <span className="text-sm text-slate-500">
              (showing {filteredCards.length} of {cards.length} cards)
            </span>
          )}
        </div>
      )}

      {/* No results message */}
      {filteredCards.length === 0 && filterTagIds.length > 0 && (
        <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400">No cards match the selected tags</p>
          <button
            onClick={() => setFilterTagIds([])}
            className="text-blue-600 dark:text-blue-400 text-sm mt-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Card list with dividers */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50 space-y-3">
        {filteredCards.map((card) => (
          <CardListItem
            key={card.id}
            card={card}
            deckId={deckId}
            tags={card.tags}
            onDelete={isAuthor ? handleDelete : undefined}
            onDuplicate={isAuthor ? handleDuplicate : undefined}
            isSelected={selectedIds.has(card.id)}
            onToggleSelect={isAuthor ? toggleSelection : undefined}
            isAuthor={isAuthor}
          />
        ))}
      </div>

      {/* Deck selector modal */}
      {showDeckSelector && (
        <DeckSelector
          currentDeckId={deckId}
          onSelect={handleBulkMove}
          onCancel={() => setShowDeckSelector(false)}
        />
      )}

      {/* V9.1: Bulk tag modal */}
      <BulkTagModal
        isOpen={showBulkTagModal}
        onClose={() => setShowBulkTagModal(false)}
        selectedCardIds={[...selectedIds]}
        onSuccess={handleBulkTagSuccess}
      />

      {/* V9.3: Auto-tag progress modal */}
      <AutoTagProgressModal
        isOpen={showAutoTagModal}
        isProcessing={autoTag.isTagging}
        currentChunk={autoTag.currentChunk}
        totalChunks={autoTag.totalChunks}
        taggedCount={autoTag.taggedCount}
        skippedCount={autoTag.skippedCount}
        error={autoTag.error}
        onCancel={autoTag.cancel}
        onClose={handleAutoTagModalClose}
      />
    </>
  )
}
