'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CardListItem } from './CardListItem'
import { BulkActionsBar } from './BulkActionsBar'
import { DeckSelector } from './DeckSelector'
import { FilterBar } from '@/components/tags/FilterBar'
import { TagSelector } from '@/components/tags/TagSelector'
import { deleteCard, duplicateCard, bulkDeleteCards, bulkMoveCards } from '@/actions/card-actions'
import { useToast } from '@/components/ui/Toast'
import type { Card, Tag } from '@/types/database'

// Extended card type with tags
interface CardWithTags extends Card {
  tags?: Tag[]
}

interface CardListProps {
  cards: CardWithTags[]
  deckId: string
  deckTitle?: string
  allTags?: Tag[]
}

/**
 * CardList - Client component wrapper for card list with bulk actions
 * Requirements: FR-1, FR-3, FR-4, C.1-C.9
 */
export function CardList({ cards, deckId, deckTitle = 'deck', allTags = [] }: CardListProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeckSelector, setShowDeckSelector] = useState(false)
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])

  // Filter cards by selected tags (AND logic - card must have ALL selected tags)
  const filteredCards = useMemo(() => {
    if (filterTagIds.length === 0) return cards
    return cards.filter((card) => {
      const cardTagIds = card.tags?.map((t) => t.id) || []
      return filterTagIds.every((tagId) => cardTagIds.includes(tagId))
    })
  }, [cards, filterTagIds])

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

  const clearSelection = () => {
    setSelectedIds(new Set())
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

      {/* Active filter bar */}
      <FilterBar
        tags={allTags}
        selectedTagIds={filterTagIds}
        onTagsChange={setFilterTagIds}
        onClear={() => setFilterTagIds([])}
      />

      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onMove={() => setShowDeckSelector(true)}
        onExport={handleExport}
        onClearSelection={clearSelection}
      />

      {/* Select all toggle */}
      {filteredCards.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectedIds.size === filteredCards.length ? clearSelection : selectAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {selectedIds.size === filteredCards.length ? 'Deselect all' : 'Select all'}
          </button>
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
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            isSelected={selectedIds.has(card.id)}
            onToggleSelect={toggleSelection}
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
    </>
  )
}
