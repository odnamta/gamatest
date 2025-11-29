'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateCard } from '@/actions/card-actions'
import { getCardTags, assignTagsToCard } from '@/actions/tag-actions'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { TagSelector } from '@/components/tags/TagSelector'
import type { Card } from '@/types/database'

interface EditCardFormProps {
  card: Card
  deckId: string
}

/**
 * EditCardForm - Client component for editing flashcards and MCQs
 * Requirements: FR-2.1–FR-2.5
 */
export function EditCardForm({ card, deckId }: EditCardFormProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isMCQ = card.card_type === 'mcq'

  // Flashcard state
  const [front, setFront] = useState(card.front || '')
  const [back, setBack] = useState(card.back || '')
  const [imageUrl, setImageUrl] = useState(card.image_url || '')

  // MCQ state
  const [stem, setStem] = useState(card.stem || '')
  const [options, setOptions] = useState<string[]>(
    Array.isArray(card.options) ? card.options : ['', '', '', '', '']
  )
  const [correctIndex, setCorrectIndex] = useState(card.correct_index ?? 0)
  const [explanation, setExplanation] = useState(card.explanation || '')

  // Tag state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Load existing tags on mount
  useEffect(() => {
    async function loadTags() {
      const tags = await getCardTags(card.id)
      setSelectedTagIds(tags.map(t => t.id))
    }
    loadTags()
  }, [card.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = isMCQ
        ? await updateCard({
            cardId: card.id,
            type: 'mcq',
            stem,
            options: options.filter(o => o.trim()),
            correctIndex,
            explanation,
          })
        : await updateCard({
            cardId: card.id,
            type: 'flashcard',
            front,
            back,
            imageUrl,
          })

      if (result.ok) {
        // Update tags
        await assignTagsToCard(card.id, selectedTagIds)
        showToast('Card updated', 'success')
        router.push(`/decks/${deckId}`)
        router.refresh()
      } else {
        showToast(result.error || 'Could not save changes', 'error')
      }
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    setOptions(prev => {
      const newOptions = [...prev]
      newOptions[index] = value
      return newOptions
    })
  }

  const addOption = () => {
    if (options.length < 5) {
      setOptions(prev => [...prev, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(prev => prev.filter((_, i) => i !== index))
      // Adjust correctIndex if needed
      if (correctIndex >= index && correctIndex > 0) {
        setCorrectIndex(prev => prev - 1)
      }
    }
  }

  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    // Enter → add new option (if < 5)
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (options.length < 5) {
        addOption()
      }
    }
  }

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter → submit form
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      const form = e.currentTarget.closest('form')
      if (form) form.requestSubmit()
    }
  }

  if (isMCQ) {
    return (
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
        {/* Stem */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Question Stem
          </label>
          <textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder="Enter the question..."
            rows={3}
            required
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Options with dynamic add/remove */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Answer Options
          </label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="radio"
                checked={correctIndex === index}
                onChange={() => setCorrectIndex(index)}
                className="w-4 h-4 text-blue-600 flex-shrink-0"
              />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-6 flex-shrink-0">
                {String.fromCharCode(65 + index)}.
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Remove button - only show if > 2 options */}
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove option"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              )}
            </div>
          ))}
          {/* Add option button - only show if < 5 options */}
          {options.length < 5 && (
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              + Add Option
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Min 2, max 5 options. Press Enter to add, Cmd/Ctrl+Enter to save.
          </p>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Explanation (optional)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain why the correct answer is correct..."
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tags (optional)
          </label>
          <TagSelector
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>

        {/* Submit - desktop */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>

        {/* Mobile floating save button */}
        <div className="fixed bottom-4 right-4 sm:hidden z-50">
          <Button type="submit" disabled={isSubmitting} className="shadow-lg">
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    )
  }

  // Flashcard form
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Front */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Front (Question)
        </label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Enter the question or prompt..."
          rows={3}
          required
          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Back */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Back (Answer)
        </label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Enter the answer..."
          rows={3}
          required
          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Image URL (optional)
        </label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Tags (optional)
        </label>
        <TagSelector
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
