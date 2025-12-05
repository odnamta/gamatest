'use client'

import { useState } from 'react'
import Image from 'next/image'
import { MarkdownContent } from './MarkdownContent'
import { ImageModal } from '@/components/ui/ImageModal'
import { FlagIcon } from './FlagIcon'
import { NotesSection } from './NotesSection'
import type { MCQCard } from '@/types/database'

export interface MCQQuestionProps {
  card: MCQCard
  onAnswer: (selectedIndex: number) => void
  isAnswered: boolean
  selectedIndex: number | null
  correctIndex: number | null
  /** V8.2: External disable control for feedback phase */
  disabled?: boolean
  // V10.6: Digital Notebook
  cardTemplateId?: string
  isFlagged?: boolean
  notes?: string | null
}

/**
 * MCQQuestion component for displaying MCQ during study.
 * Requirements: 2.1, 2.2, 2.3
 * - 2.1: Immediate feedback on answer selection
 * - 2.2: Highlight correct (green) and incorrect (red) answers
 * - 2.3: Display explanation after answering
 */
export function MCQQuestion({
  card,
  onAnswer,
  isAnswered,
  selectedIndex,
  correctIndex,
  disabled = false,
  cardTemplateId,
  isFlagged = false,
  notes = null,
}: MCQQuestionProps) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  const handleOptionClick = (index: number) => {
    // V8.2: Check both isAnswered and disabled prop
    if (isAnswered || disabled) return
    onAnswer(index)
  }

  const getOptionStyles = (index: number): string => {
    const baseStyles = 'w-full p-4 text-left rounded-lg border-2 transition-all duration-200 min-h-[60px]'
    
    if (!isAnswered) {
      // Not answered yet - show hover state
      return `${baseStyles} border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-slate-900 dark:text-slate-100`
    }

    // After answering - show correct/incorrect highlighting (Requirement 2.2)
    const isCorrect = index === correctIndex
    const isSelected = index === selectedIndex

    if (isCorrect) {
      // Correct answer - always show green
      return `${baseStyles} border-green-500 dark:border-green-400 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-100 cursor-default`
    }

    if (isSelected && !isCorrect) {
      // Selected but incorrect - show red
      return `${baseStyles} border-red-500 dark:border-red-400 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-100 cursor-default`
    }

    // Other options - muted
    return `${baseStyles} border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-default opacity-60`
  }

  const getOptionLabel = (index: number): string => {
    return String.fromCharCode(65 + index) // A, B, C, D, etc.
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Card container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none relative">
        {/* V10.6: Flag icon - top right corner */}
        {cardTemplateId && (
          <div className="absolute top-4 right-4">
            <FlagIcon
              cardTemplateId={cardTemplateId}
              isFlagged={isFlagged}
              size="md"
            />
          </div>
        )}

        {/* Image if present */}
        {card.image_url && (
          <div className="mb-4 relative w-full h-48">
            <Image
              src={card.image_url}
              alt="Question image"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setIsImageModalOpen(true)}
            />
          </div>
        )}

        {/* Stem - question text with markdown support */}
        <div className="text-lg text-slate-900 dark:text-slate-100 mb-6">
          <MarkdownContent content={card.stem} />
        </div>

        {/* Options - large tappable buttons (mobile-first) */}
        <div className="space-y-3">
          {card.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={isAnswered || disabled}
              className={getOptionStyles(index)}
              aria-label={`Option ${getOptionLabel(index)}: ${option}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm">
                  {getOptionLabel(index)}
                </span>
                <span className="flex-1 pt-1">
                  <MarkdownContent content={option} />
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Explanation - shown after answering (Requirement 2.3) */}
        {isAnswered && card.explanation && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Explanation
            </h4>
            <div className="text-blue-700 dark:text-blue-200 text-sm">
              <MarkdownContent content={card.explanation} />
            </div>
          </div>
        )}

        {/* V10.6: Notes section - shown after answering */}
        {isAnswered && cardTemplateId && (
          <NotesSection
            cardTemplateId={cardTemplateId}
            initialNotes={notes}
          />
        )}
      </div>

      {/* Image modal for fullscreen view */}
      {card.image_url && (
        <ImageModal
          src={card.image_url}
          alt="Question image"
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
        />
      )}
    </div>
  )
}
