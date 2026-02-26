'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Settings, Play } from 'lucide-react'
import { TagSelector } from '@/components/tags/TagSelector'
import { Button } from '@/components/ui/Button'
import { getUserDecks } from '@/actions/deck-actions'
import { buildCustomStudyUrl, type SessionMode, type CustomSessionConfig } from '@/lib/custom-session-params'

interface ConfigureSessionModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DeckOption {
  id: string
  title: string
}

/**
 * ConfigureSessionModal - Modal for configuring custom study sessions
 * V6.3: Custom Cram Mode
 */
export function ConfigureSessionModal({ isOpen, onClose }: ConfigureSessionModalProps) {
  const router = useRouter()
  
  // Form state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [mode, setMode] = useState<SessionMode>('due')
  const [limit, setLimit] = useState(50)
  // V10.6: Flagged only filter
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  
  // Deck options
  const [decks, setDecks] = useState<DeckOption[]>([])
  const [isLoadingDecks, setIsLoadingDecks] = useState(true)

  // Load user's decks on mount
  useEffect(() => {
    async function loadDecks() {
      try {
        const userDecks = await getUserDecks()
        setDecks(userDecks.map(d => ({ id: d.id, title: d.title })))
      } catch (error) {
        console.error('Failed to load decks:', error)
      } finally {
        setIsLoadingDecks(false)
      }
    }
    if (isOpen) {
      loadDecks()
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTagIds([])
      setSelectedDeckIds([])
      setMode('due')
      setLimit(50)
      setFlaggedOnly(false)
    }
  }, [isOpen])

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds(prev => 
      prev.includes(deckId) 
        ? prev.filter(id => id !== deckId)
        : [...prev, deckId]
    )
  }

  const handleStartSession = () => {
    const config: CustomSessionConfig = {
      tagIds: selectedTagIds,
      deckIds: selectedDeckIds,
      mode,
      limit,
      flaggedOnly,
    }
    
    const url = buildCustomStudyUrl(config)
    router.push(url)
    onClose()
  }

  const isValid = selectedTagIds.length > 0 || selectedDeckIds.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Configure Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filter by Tags
              <span className="ml-1 text-xs font-normal text-slate-500">(optional)</span>
            </label>
            <TagSelector
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
            />
          </div>

          {/* Decks */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filter by Decks
              <span className="ml-1 text-xs font-normal text-slate-500">(optional)</span>
            </label>
            {isLoadingDecks ? (
              <div className="h-[42px] bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
            ) : (
              <div className="max-h-40 overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-lg">
                {decks.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">No decks found</p>
                ) : (
                  decks.map(deck => (
                    <label
                      key={deck.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDeckIds.includes(deck.id)}
                        onChange={() => toggleDeck(deck.id)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {deck.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Study Mode
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="radio"
                  name="mode"
                  value="due"
                  checked={mode === 'due'}
                  onChange={() => setMode('due')}
                  className="sr-only peer"
                />
                <div className="p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 transition-colors">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Due Only</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cards scheduled for review
                  </p>
                </div>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="mode"
                  value="cram"
                  checked={mode === 'cram'}
                  onChange={() => setMode('cram')}
                  className="sr-only peer"
                />
                <div className="p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer peer-checked:border-purple-500 peer-checked:bg-purple-50 dark:peer-checked:bg-purple-900/20 transition-colors">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Cram All</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    All cards, shuffled randomly
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* V10.6: Flagged Only Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="w-5 h-5 text-amber-500 rounded border-slate-300 dark:border-slate-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Study Flagged Cards Only
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only include cards you&apos;ve bookmarked
                </p>
              </div>
            </label>
          </div>

          {/* Limit */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Card Limit
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Math.min(200, Math.max(1, parseInt(e.target.value) || 50)))}
              className="w-24 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-2 text-xs text-slate-500">max 200</span>
          </div>

          {/* Validation message */}
          {!isValid && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Select at least one tag or deck to start a session.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleStartSession} disabled={!isValid}>
            <Play className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        </div>
      </div>
    </div>
  )
}
