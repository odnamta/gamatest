'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { MarkdownContent } from './MarkdownContent'
import { ImageModal } from '@/components/ui/ImageModal'
import { FlagIcon } from './FlagIcon'
import { NotesSection } from './NotesSection'

export interface FlashcardProps {
  front: string
  back: string
  imageUrl?: string | null
  isRevealed: boolean
  onReveal: () => void
  // V10.6: Digital Notebook
  cardTemplateId?: string
  isFlagged?: boolean
  notes?: string | null
}

/**
 * Flashcard component for displaying card front/back during study.
 * Requirements: 4.4, 4.5, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3
 * 
 * WCAG AA Contrast Ratios:
 * - Light mode: slate-900 text (#0f172a) on white bg (#ffffff) = 15.98:1 ✓
 * - Dark mode: slate-100 text (#f1f5f9) on slate-800 bg (#1e293b) = 11.07:1 ✓
 * - Back text light: slate-600 (#475569) on white = 6.08:1 ✓
 * - Back text dark: slate-300 (#cbd5e1) on slate-800 = 7.53:1 ✓
 */
export function Flashcard({ 
  front, 
  back, 
  imageUrl, 
  isRevealed, 
  onReveal,
  cardTemplateId,
  isFlagged = false,
  notes = null,
}: FlashcardProps) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Card container - light/dark mode support (Requirements 4.4, 4.5) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 min-h-[300px] flex flex-col shadow-sm dark:shadow-none relative">
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

        {/* Front content - always visible */}
        <div className="flex-1 pr-8">
          {/* Image if present - using Next.js Image for optimization (Requirements 6.1, 6.2, 6.3) */}
          {imageUrl && (
            <div className="mb-4 relative w-full h-48">
              <Image
                src={imageUrl}
                alt={`Image for: ${front.slice(0, 80)}`}
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsImageModalOpen(true)}
              />
            </div>
          )}
          
          {/* Front text - high contrast for readability with markdown support (Requirement 5.1) */}
          <div className="text-lg text-slate-900 dark:text-slate-100">
            <MarkdownContent content={front} />
          </div>
        </div>

        {/* Divider and back content - only when revealed (Requirement 5.3) */}
        {isRevealed && (
          <>
            <div className="my-6 border-t border-slate-200 dark:border-slate-600" />
            {/* Back text - slightly muted but still WCAG AA compliant with markdown support (Requirement 5.1) */}
            <div className="text-lg text-slate-600 dark:text-slate-300">
              <MarkdownContent content={back} />
            </div>
            
            {/* V10.6: Notes section - shown when revealed */}
            {cardTemplateId && (
              <NotesSection
                cardTemplateId={cardTemplateId}
                initialNotes={notes}
              />
            )}
          </>
        )}
      </div>

      {/* Reveal button - only when not revealed (Requirement 5.2) */}
      {!isRevealed && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button onClick={onReveal} size="lg">
            Reveal Answer
          </Button>
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Space</kbd> to reveal
          </span>
        </div>
      )}

      {/* Image modal for fullscreen view (Requirement 6.3) */}
      {imageUrl && (
        <ImageModal
          src={imageUrl}
          alt="Card image"
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
        />
      )}
    </div>
  )
}
