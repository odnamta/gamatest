'use client'

import { useReducer, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { CardListItem } from './CardListItem'
import dynamic from 'next/dynamic'
import { BulkActionsBar } from './BulkActionsBar'
import { DeckSelector } from './DeckSelector'
import { StatusFilterChips, getDefaultStatusFilter, type StatusFilter } from './StatusFilterChips'
import { PublishAllConfirmDialog } from './PublishAllConfirmDialog'
import { FilterBar } from '@/components/tags/FilterBar'
import { TagSelector } from '@/components/tags/TagSelector'

const BulkTagModal = dynamic(() => import('./BulkTagModal').then(m => ({ default: m.BulkTagModal })), { ssr: false })
const CardEditorPanel = dynamic(() => import('./CardEditorPanel').then(m => ({ default: m.CardEditorPanel })), { ssr: false })
const AutoTagProgressModal = dynamic(() => import('@/components/tags/AutoTagProgressModal').then(m => ({ default: m.AutoTagProgressModal })), { ssr: false })
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteCard, duplicateCard, bulkDeleteCards, bulkMoveCards, getAllCardIdsInDeck, bulkPublishCards } from '@/actions/card-actions'
import { useAutoTag } from '@/hooks/use-auto-tag'
import { useToast } from '@/components/ui/Toast'
import type { Card, Tag } from '@/types/database'

// Extended card type with tags and book_source
// V11.1: Added book_source for source filtering
// V11.3: Added status for draft/publish workflow
interface CardWithTags extends Card {
  tags?: Tag[]
  book_source?: {
    id: string
    title: string
  } | null
  status?: 'draft' | 'published' | 'archived'
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

// --- useReducer state management (V20.2 refactor) ---

interface CardListState {
  selectedIds: Set<string>
  showDeckSelector: boolean
  filterTagIds: string[]
  searchQuery: string
  showNeedsReviewOnly: boolean
  showBulkTagModal: boolean
  isSelectingAll: boolean
  showUntaggedOnly: boolean
  showAutoTagModal: boolean
  filterSourceIds: string[]
  statusFilter: StatusFilter
  showPublishAllDialog: boolean
  isPublishing: boolean
  isAllSelected: boolean
  showEditorPanel: boolean
  deleteConfirm: { cardId: string; preview: string; type: string } | null
  bulkDeleteConfirm: boolean
  editingCardIndex: number
}

type CardListAction =
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'SELECT_ALL_IN_DECK_START' }
  | { type: 'SELECT_ALL_IN_DECK_DONE'; ids: string[] }
  | { type: 'SELECT_ALL_IN_DECK_FAIL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FILTER_TAG_IDS'; ids: string[] }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SHOW_NEEDS_REVIEW_ONLY'; show: boolean }
  | { type: 'SET_SHOW_UNTAGGED_ONLY'; show: boolean }
  | { type: 'SET_FILTER_SOURCE_IDS'; ids: string[] }
  | { type: 'SET_STATUS_FILTER'; filter: StatusFilter }
  | { type: 'SHOW_DECK_SELECTOR'; show: boolean }
  | { type: 'SHOW_BULK_TAG_MODAL'; show: boolean }
  | { type: 'SHOW_AUTO_TAG_MODAL'; show: boolean }
  | { type: 'SHOW_PUBLISH_ALL_DIALOG'; show: boolean }
  | { type: 'SET_IS_PUBLISHING'; publishing: boolean }
  | { type: 'OPEN_EDITOR'; index: number }
  | { type: 'CLOSE_EDITOR' }
  | { type: 'NAVIGATE_EDITOR'; index: number }
  | { type: 'SET_DELETE_CONFIRM'; confirm: { cardId: string; preview: string; type: string } | null }
  | { type: 'SET_BULK_DELETE_CONFIRM'; show: boolean }
  | { type: 'CLEAR_FILTERS' }

const initialCardListState: CardListState = {
  selectedIds: new Set(),
  showDeckSelector: false,
  filterTagIds: [],
  searchQuery: '',
  showNeedsReviewOnly: false,
  showBulkTagModal: false,
  isSelectingAll: false,
  showUntaggedOnly: false,
  showAutoTagModal: false,
  filterSourceIds: [],
  statusFilter: 'all',
  showPublishAllDialog: false,
  isPublishing: false,
  isAllSelected: false,
  showEditorPanel: false,
  deleteConfirm: null,
  bulkDeleteConfirm: false,
  editingCardIndex: 0,
}

function cardListReducer(state: CardListState, action: CardListAction): CardListState {
  switch (action.type) {
    case 'TOGGLE_SELECTION': {
      const next = new Set(state.selectedIds)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, selectedIds: next }
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.ids) }
    case 'SELECT_ALL_IN_DECK_START':
      return { ...state, isSelectingAll: true }
    case 'SELECT_ALL_IN_DECK_DONE':
      return { ...state, isSelectingAll: false, selectedIds: new Set(action.ids) }
    case 'SELECT_ALL_IN_DECK_FAIL':
      return { ...state, isSelectingAll: false }
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set(), isAllSelected: false }
    case 'SET_FILTER_TAG_IDS':
      return { ...state, filterTagIds: action.ids }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query }
    case 'SET_SHOW_NEEDS_REVIEW_ONLY':
      return { ...state, showNeedsReviewOnly: action.show }
    case 'SET_SHOW_UNTAGGED_ONLY':
      return { ...state, showUntaggedOnly: action.show }
    case 'SET_FILTER_SOURCE_IDS':
      return { ...state, filterSourceIds: action.ids }
    case 'SET_STATUS_FILTER':
      // Reset selection when status filter changes
      return { ...state, statusFilter: action.filter, selectedIds: new Set(), isAllSelected: false }
    case 'SHOW_DECK_SELECTOR':
      return { ...state, showDeckSelector: action.show }
    case 'SHOW_BULK_TAG_MODAL':
      return { ...state, showBulkTagModal: action.show }
    case 'SHOW_AUTO_TAG_MODAL':
      return { ...state, showAutoTagModal: action.show }
    case 'SHOW_PUBLISH_ALL_DIALOG':
      return { ...state, showPublishAllDialog: action.show }
    case 'SET_IS_PUBLISHING':
      return { ...state, isPublishing: action.publishing }
    case 'OPEN_EDITOR':
      return { ...state, showEditorPanel: true, editingCardIndex: action.index }
    case 'CLOSE_EDITOR':
      return { ...state, showEditorPanel: false }
    case 'NAVIGATE_EDITOR':
      return { ...state, editingCardIndex: action.index }
    case 'SET_DELETE_CONFIRM':
      return { ...state, deleteConfirm: action.confirm }
    case 'SET_BULK_DELETE_CONFIRM':
      return { ...state, bulkDeleteConfirm: action.show }
    case 'CLEAR_FILTERS':
      return { ...state, filterTagIds: [], searchQuery: '' }
    default:
      return state
  }
}

/**
 * CardList - Client component wrapper for card list with bulk actions
 * V9.3: Integrated useAutoTag hook for chunked auto-tagging with progress modal
 * V20.2: Refactored 18 useState calls to single useReducer
 * Requirements: FR-1, FR-3, FR-4, C.1-C.9, V9.3 1.1-1.6, 5.1-5.5
 */
export function CardList({ cards, deckId, deckTitle = 'deck', allTags = [], isAuthor = true, deckSubject }: CardListProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const searchParams = useSearchParams()

  const [state, dispatch] = useReducer(cardListReducer, initialCardListState)
  const {
    selectedIds, showDeckSelector, filterTagIds, searchQuery,
    showNeedsReviewOnly, showBulkTagModal, isSelectingAll,
    showUntaggedOnly, showAutoTagModal, filterSourceIds,
    statusFilter, showPublishAllDialog, isPublishing,
    isAllSelected, showEditorPanel, deleteConfirm,
    bulkDeleteConfirm, editingCardIndex,
  } = state

  // V11.4: Calculate counts for status filter chips
  const draftCount = useMemo(() => {
    return cards.filter(card => card.status === 'draft').length
  }, [cards])

  const publishedCount = useMemo(() => {
    return cards.filter(card => !card.status || card.status === 'published').length
  }, [cards])

  // V11.4: Initialize status filter based on draft count and URL params
  useEffect(() => {
    const showDraftsParam = searchParams.get('showDrafts')
    if (showDraftsParam === 'true') {
      dispatch({ type: 'SET_STATUS_FILTER', filter: 'draft' })
    } else {
      dispatch({ type: 'SET_STATUS_FILTER', filter: getDefaultStatusFilter(draftCount) })
    }
  }, [searchParams, draftCount])

  // V9.3: useAutoTag hook for chunked processing with progress
  const autoTag = useAutoTag({
    onComplete: (totalTagged, totalSkipped) => {
      if (totalTagged > 0) {
        showToast(
          `Auto-tagged ${totalTagged} card${totalTagged !== 1 ? 's' : ''}${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ''}`,
          'success'
        )
        dispatch({ type: 'CLEAR_SELECTION' })
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
  // V11.4: Filter by status using StatusFilterChips
  const filteredCards = useMemo(() => {
    let result = cards

    // V11.4: Apply status filter first
    switch (statusFilter) {
      case 'draft':
        result = result.filter(card => card.status === 'draft')
        break
      case 'published':
        result = result.filter(card => !card.status || card.status === 'published')
        break
      case 'all':
        // Show draft and published, but not archived
        result = result.filter(card => !card.status || card.status === 'published' || card.status === 'draft')
        break
    }

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

    // V22: Apply text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(card => {
        const stemMatch = card.stem?.toLowerCase().includes(q)
        const optionsMatch = Array.isArray(card.options) && card.options.some((o: string) => o?.toLowerCase().includes(q))
        const explanationMatch = card.explanation?.toLowerCase().includes(q)
        const frontMatch = card.front?.toLowerCase().includes(q)
        const backMatch = card.back?.toLowerCase().includes(q)
        return stemMatch || optionsMatch || explanationMatch || frontMatch || backMatch
      })
    }

    return result
  }, [cards, filterTagIds, filterSourceIds, showNeedsReviewOnly, showUntaggedOnly, statusFilter, searchQuery])

  // Note: Selection reset on status filter change is handled inside the reducer (SET_STATUS_FILTER)

  // V11.4: Open editor panel from URL param
  useEffect(() => {
    const editCardParam = searchParams.get('editCard')
    if (editCardParam && filteredCards.length > 0) {
      const index = filteredCards.findIndex(c => c.id === editCardParam)
      if (index >= 0) {
        dispatch({ type: 'OPEN_EDITOR', index })
      }
    }
  }, [searchParams, filteredCards])

  // Selection handlers
  const toggleSelection = (id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', id })
  }

  const selectAll = () => {
    dispatch({ type: 'SELECT_ALL', ids: filteredCards.map((c) => c.id) })
  }

  // V9.1: Select All in Deck - fetches all card IDs from database
  const selectAllInDeck = async () => {
    dispatch({ type: 'SELECT_ALL_IN_DECK_START' })
    try {
      const allIds = await getAllCardIdsInDeck(deckId)
      dispatch({ type: 'SELECT_ALL_IN_DECK_DONE', ids: allIds })
      if (allIds.length > 0) {
        showToast(`Selected all ${allIds.length} cards in deck`, 'success')
      }
    } catch (error) {
      dispatch({ type: 'SELECT_ALL_IN_DECK_FAIL' })
      console.error('Failed to select all cards:', error)
      showToast('Failed to select all cards', 'error')
    }
  }

  const clearSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }

  // V9.1: Handle bulk tag success
  const handleBulkTagSuccess = (count: number) => {
    router.refresh()
  }

  // V9.3: Handle auto-tag with chunked processing and progress modal
  const handleAutoTag = () => {
    if (selectedIds.size === 0) return

    dispatch({ type: 'SHOW_AUTO_TAG_MODAL', show: true })
    autoTag.startTagging([...selectedIds], deckSubject)
  }

  // V9.3: Handle closing the auto-tag modal
  const handleAutoTagModalClose = () => {
    dispatch({ type: 'SHOW_AUTO_TAG_MODAL', show: false })
    autoTag.reset()
  }

  // Single card handlers
  const handleDelete = async (cardId: string, preview: string, type: string) => {
    dispatch({ type: 'SET_DELETE_CONFIRM', confirm: { cardId, preview, type } })
  }

  const confirmDeleteCard = async () => {
    if (!deleteConfirm) return
    const { cardId } = deleteConfirm
    dispatch({ type: 'SET_DELETE_CONFIRM', confirm: null })

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
    dispatch({ type: 'SET_BULK_DELETE_CONFIRM', show: true })
  }

  const confirmBulkDelete = async () => {
    dispatch({ type: 'SET_BULK_DELETE_CONFIRM', show: false })
    const result = await bulkDeleteCards([...selectedIds])
    if (result.ok) {
      showToast(`${result.data?.count} card${result.data?.count !== 1 ? 's' : ''} deleted`, 'success')
      clearSelection()
      router.refresh()
    } else {
      showToast(result.error || 'Could not delete cards', 'error')
    }
  }

  const handleBulkMove = async (targetDeckId: string, targetDeckTitle: string) => {
    dispatch({ type: 'SHOW_DECK_SELECTOR', show: false })
    const result = await bulkMoveCards([...selectedIds], targetDeckId)
    if (result.ok) {
      showToast(`${result.data?.count} card${result.data?.count !== 1 ? 's' : ''} moved to ${targetDeckTitle}`, 'success')
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

  // V11.4: Handle bulk publish
  const handleBulkPublish = async () => {
    if (selectedIds.size === 0 && !isAllSelected) return

    dispatch({ type: 'SET_IS_PUBLISHING', publishing: true })
    try {
      const result = isAllSelected
        ? await bulkPublishCards({ filterDescriptor: { deckId, status: statusFilter, tagIds: filterTagIds.length > 0 ? filterTagIds : undefined } })
        : await bulkPublishCards({ cardIds: [...selectedIds] })

      if (result.ok) {
        showToast(`Published ${result.data?.count} card${result.data?.count !== 1 ? 's' : ''} successfully`, 'success')
        clearSelection()
        router.refresh()
      } else {
        showToast(result.error || 'Failed to publish cards', 'error')
      }
    } catch {
      showToast('Failed to publish cards', 'error')
    } finally {
      dispatch({ type: 'SET_IS_PUBLISHING', publishing: false })
    }
  }

  // V11.4: Handle publish all drafts
  const handlePublishAllDrafts = async () => {
    dispatch({ type: 'SET_IS_PUBLISHING', publishing: true })
    try {
      const result = await bulkPublishCards({ filterDescriptor: { deckId, status: 'draft' } })

      if (result.ok) {
        showToast(`Published ${result.data?.count} card${result.data?.count !== 1 ? 's' : ''} successfully`, 'success')
        dispatch({ type: 'SHOW_PUBLISH_ALL_DIALOG', show: false })
        dispatch({ type: 'SET_STATUS_FILTER', filter: 'published' })
        router.refresh()
      } else {
        showToast(result.error || 'Failed to publish cards', 'error')
      }
    } catch {
      showToast('Failed to publish cards', 'error')
    } finally {
      dispatch({ type: 'SET_IS_PUBLISHING', publishing: false })
    }
  }

  // V11.4: Handle opening editor panel
  const handleOpenEditor = (cardId: string) => {
    const index = filteredCards.findIndex(c => c.id === cardId)
    if (index >= 0) {
      dispatch({ type: 'OPEN_EDITOR', index })
      // Update URL with card ID
      const url = new URL(window.location.href)
      url.searchParams.set('editCard', cardId)
      window.history.pushState({}, '', url.toString())
    }
  }

  // V11.4: Handle closing editor panel
  const handleCloseEditor = () => {
    dispatch({ type: 'CLOSE_EDITOR' })
    // Remove editCard from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('editCard')
    window.history.pushState({}, '', url.toString())
  }

  // V11.4: Handle editor panel navigation
  const handleEditorNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? Math.max(0, editingCardIndex - 1)
      : Math.min(filteredCards.length - 1, editingCardIndex + 1)
    dispatch({ type: 'NAVIGATE_EDITOR', index: newIndex })
    // Update URL with new card ID
    const newCardId = filteredCards[newIndex]?.id
    if (newCardId) {
      const url = new URL(window.location.href)
      url.searchParams.set('editCard', newCardId)
      window.history.pushState({}, '', url.toString())
    }
  }

  // V11.4: Get card by ID for editor panel
  const getCardById = (id: string) => filteredCards.find(c => c.id === id)

  // V11.4: Handle editor save success
  const handleEditorSaveSuccess = () => {
    router.refresh()
  }

  return (
    <>
      {/* V22: In-deck card search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          placeholder="Search cards by stem, options, explanation..."
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', query: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* V11.4: Status filter chips for authors */}
      {isAuthor && (draftCount > 0 || publishedCount > 0) && (
        <StatusFilterChips
          draftCount={draftCount}
          publishedCount={publishedCount}
          activeFilter={statusFilter}
          onFilterChange={(filter) => dispatch({ type: 'SET_STATUS_FILTER', filter })}
          onPublishAllDrafts={() => dispatch({ type: 'SHOW_PUBLISH_ALL_DIALOG', show: true })}
          isAuthor={isAuthor}
        />
      )}

      {/* V8.6: NeedsReview filter toggle */}
      {needsReviewCount > 0 && (
        <div className="mb-4">
          <button
            onClick={() => dispatch({ type: 'SET_SHOW_NEEDS_REVIEW_ONLY', show: !showNeedsReviewOnly })}
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
            onChange={(ids) => dispatch({ type: 'SET_FILTER_TAG_IDS', ids })}
          />
        </div>
      )}

      {/* Active filter bar - V9.2: Added untagged toggle, V11.1: Added source filter */}
      <FilterBar
        tags={allTags}
        selectedTagIds={filterTagIds}
        onTagsChange={(ids) => dispatch({ type: 'SET_FILTER_TAG_IDS', ids })}
        onClear={() => dispatch({ type: 'SET_FILTER_TAG_IDS', ids: [] })}
        showUntaggedOnly={showUntaggedOnly}
        onShowUntaggedOnlyChange={(show) => dispatch({ type: 'SET_SHOW_UNTAGGED_ONLY', show })}
        untaggedCount={untaggedCount}
        availableSources={availableSources}
        selectedSourceIds={filterSourceIds}
        onSourcesChange={(ids) => dispatch({ type: 'SET_FILTER_SOURCE_IDS', ids })}
      />

      {/* Bulk actions bar - Author only for delete/move/tag */}
      {isAuthor && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onDelete={handleBulkDelete}
          onMove={() => dispatch({ type: 'SHOW_DECK_SELECTOR', show: true })}
          onExport={handleExport}
          onAddTag={() => dispatch({ type: 'SHOW_BULK_TAG_MODAL', show: true })}
          onAutoTag={handleAutoTag}
          isAutoTagging={autoTag.isTagging}
          onClearSelection={clearSelection}
          onPublish={handleBulkPublish}
          showPublish={statusFilter !== 'published' && (selectedIds.size > 0 || isAllSelected)}
          isPublishing={isPublishing}
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
      {filteredCards.length === 0 && (filterTagIds.length > 0 || searchQuery.trim()) && (
        <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400">
            {searchQuery.trim() ? `No cards match "${searchQuery}"` : 'No cards match the selected tags'}
          </p>
          <button
            onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
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
            onEdit={isAuthor ? handleOpenEditor : undefined}
          />
        ))}
      </div>

      {/* Deck selector modal */}
      {showDeckSelector && (
        <DeckSelector
          currentDeckId={deckId}
          onSelect={handleBulkMove}
          onCancel={() => dispatch({ type: 'SHOW_DECK_SELECTOR', show: false })}
        />
      )}

      {/* V9.1: Bulk tag modal */}
      <BulkTagModal
        isOpen={showBulkTagModal}
        onClose={() => dispatch({ type: 'SHOW_BULK_TAG_MODAL', show: false })}
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

      {/* V11.4: Publish all confirmation dialog */}
      <PublishAllConfirmDialog
        isOpen={showPublishAllDialog}
        onClose={() => dispatch({ type: 'SHOW_PUBLISH_ALL_DIALOG', show: false })}
        onConfirm={handlePublishAllDrafts}
        draftCount={draftCount}
        isPublishing={isPublishing}
      />

      {/* V11.4: Card editor panel */}
      <CardEditorPanel
        isOpen={showEditorPanel}
        onClose={handleCloseEditor}
        card={filteredCards[editingCardIndex] || null}
        cardIds={filteredCards.map(c => c.id)}
        currentIndex={editingCardIndex}
        onNavigate={handleEditorNavigate}
        onSaveSuccess={handleEditorSaveSuccess}
        deckId={deckId}
        getCardById={getCardById}
      />

      {/* V24: Delete confirmation dialogs */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => dispatch({ type: 'SET_DELETE_CONFIRM', confirm: null })}
        title={`Delete ${deleteConfirm?.type || 'card'}`}
        description={deleteConfirm ? `"${deleteConfirm.preview.length > 80 ? deleteConfirm.preview.substring(0, 80) + '...' : deleteConfirm.preview}"` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDeleteCard}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => dispatch({ type: 'SET_BULK_DELETE_CONFIRM', show: open })}
        title="Delete cards"
        description={`Delete ${selectedIds.size} card${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmBulkDelete}
      />
    </>
  )
}
