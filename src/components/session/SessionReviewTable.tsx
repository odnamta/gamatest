'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { publishCards, archiveCards, duplicateCard } from '@/actions/session-actions'
import type { SessionCard, ImportSessionMeta, CardStatus } from '@/lib/import-session'

interface SessionReviewTableProps {
  cards: SessionCard[]
  sessionId: string
  sessionMeta: ImportSessionMeta
}

type SortField = 'questionNumber' | 'stem' | 'status' | 'tags'
type SortDirection = 'asc' | 'desc'

/**
 * V11.3: Session Review Table Component
 * Client component with selection state, sorting, and row actions.
 * Requirements: 4.3, 4.4, 5.1, 5.2, 5.3, 7.1
 */
export function SessionReviewTable({ cards, sessionId, sessionMeta }: SessionReviewTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('questionNumber')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sort cards
  const sortedCards = [...cards].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    
    switch (sortField) {
      case 'questionNumber':
        if (a.questionNumber === null && b.questionNumber === null) return 0
        if (a.questionNumber === null) return 1
        if (b.questionNumber === null) return -1
        return (a.questionNumber - b.questionNumber) * direction
      case 'stem':
        return a.stem.localeCompare(b.stem) * direction
      case 'status':
        return a.status.localeCompare(b.status) * direction
      case 'tags':
        return (a.tags.length - b.tags.length) * direction
      default:
        return 0
    }
  })

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cards.map(c => c.id)))
    }
  }

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Action handlers
  const handlePublish = () => {
    if (selectedIds.size === 0) return
    
    startTransition(async () => {
      const result = await publishCards(Array.from(selectedIds))
      if (result.ok) {
        setMessage({ type: 'success', text: `Published ${result.publishedCount} cards` })
        setSelectedIds(new Set())
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to publish' })
      }
      setTimeout(() => setMessage(null), 3000)
    })
  }

  const handleArchive = () => {
    if (selectedIds.size === 0) return
    
    startTransition(async () => {
      const result = await archiveCards(Array.from(selectedIds))
      if (result.ok) {
        setMessage({ type: 'success', text: `Archived ${result.archivedCount} cards` })
        setSelectedIds(new Set())
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to archive' })
      }
      setTimeout(() => setMessage(null), 3000)
    })
  }

  const handleDuplicate = (cardId: string) => {
    startTransition(async () => {
      const result = await duplicateCard(cardId)
      if (result.ok) {
        setMessage({ type: 'success', text: 'Card duplicated' })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to duplicate' })
      }
      setTimeout(() => setMessage(null), 3000)
    })
  }

  const getStatusBadge = (status: CardStatus) => {
    const styles = {
      draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
      published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      archived: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    )
  }

  return (
    <div>
      {/* Message banner */}
      {message && (
        <div role="status" aria-live="polite" className={`mb-4 p-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Bulk actions bar */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {selectedIds.size} selected
        </span>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={selectedIds.size === 0 || isPending}
        >
          Publish Selected
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleArchive}
          disabled={selectedIds.size === 0 || isPending}
        >
          Archive Selected
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === cards.length && cards.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="p-3 text-left" aria-sort={sortField === 'questionNumber' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 -m-3 p-3" onClick={() => handleSort('questionNumber')}>
                  Q# {sortField === 'questionNumber' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-3 text-left" aria-sort={sortField === 'stem' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 -m-3 p-3" onClick={() => handleSort('stem')}>
                  Stem {sortField === 'stem' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-3 text-left" aria-sort={sortField === 'tags' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 -m-3 p-3" onClick={() => handleSort('tags')}>
                  Tags {sortField === 'tags' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-3 text-left" aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 -m-3 p-3" onClick={() => handleSort('status')}>
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => (
              <tr 
                key={card.id}
                className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  card.status === 'archived' ? 'opacity-50' : ''
                }`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(card.id)}
                    onChange={() => toggleSelect(card.id)}
                    className="rounded"
                  />
                </td>
                <td className="p-3 text-sm font-mono">
                  {card.questionNumber ?? '-'}
                </td>
                <td className="p-3 text-sm max-w-md truncate">
                  {card.stem.slice(0, 100)}{card.stem.length > 100 ? '...' : ''}
                </td>
                <td className="p-3 text-sm">
                  {card.tags.length}
                </td>
                <td className="p-3">
                  {getStatusBadge(card.status)}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicate(card.id)}
                      disabled={isPending}
                      className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Duplicate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cards.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          No cards in this session
        </div>
      )}
    </div>
  )
}
