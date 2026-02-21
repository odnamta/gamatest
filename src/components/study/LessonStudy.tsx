'use client'

import { useState } from 'react'
import { MCQQuestion } from './MCQQuestion'
import { Flashcard } from './Flashcard'
import { RatingButtons } from './RatingButtons'
import { Button } from '@/components/ui/Button'
import { answerMCQAction } from '@/actions/mcq-actions'
import { rateCardAction } from '@/actions/study-actions'
import type { Card, Lesson, LessonItem, MCQCard } from '@/types/database'

export interface LessonItemWithCard {
  item: LessonItem
  card: Card
}

export interface LessonStudyProps {
  lesson: Lesson
  items: LessonItemWithCard[]
  onComplete: (correctCount: number, mistakes: MistakeRecord[]) => void
}

export interface MistakeRecord {
  card: Card
  selectedIndex: number
}

interface LessonStudyState {
  currentIndex: number
  correctCount: number
  mistakes: MistakeRecord[]
  // MCQ state
  isAnswered: boolean
  selectedIndex: number | null
  correctIndex: number | null
  // Flashcard state
  isRevealed: boolean
}

/**
 * LessonStudy component for iterating through lesson items.
 * Routes to MCQQuestion or Flashcard based on item_type.
 * Requirements: 5.1, 5.2, 5.3
 * - 5.1: Fetch and present lesson_items in order
 * - 5.2: Route MCQ items to MCQ study flow
 * - 5.3: Route card items to flashcard study flow
 */
export function LessonStudy({ lesson, items, onComplete }: LessonStudyProps) {
  const [state, setState] = useState<LessonStudyState>({
    currentIndex: 0,
    correctCount: 0,
    mistakes: [],
    isAnswered: false,
    selectedIndex: null,
    correctIndex: null,
    isRevealed: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)


  const currentItem = items[state.currentIndex]
  const totalItems = items.length
  const isMCQ = currentItem?.item.item_type === 'mcq'

  // Handle MCQ answer
  const handleMCQAnswer = async (selectedIndex: number) => {
    if (state.isAnswered || isLoading) return

    setIsLoading(true)
    setError(null)

    const result = await answerMCQAction(currentItem.card.id, selectedIndex)

    setIsLoading(false)

    if (!result.ok) {
      setError(result.error || 'Failed to submit answer')
      return
    }

    const isCorrect = result.data?.isCorrect ?? false

    setState(prev => ({
      ...prev,
      isAnswered: true,
      selectedIndex,
      correctIndex: result.data?.correctIndex ?? null,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      mistakes: isCorrect
        ? prev.mistakes
        : [...prev.mistakes, { card: currentItem.card, selectedIndex }],
    }))
  }

  // Handle flashcard reveal
  const handleReveal = () => {
    setState(prev => ({ ...prev, isRevealed: true }))
  }

  // Handle flashcard rating
  const handleFlashcardRate = async (rating: 1 | 2 | 3 | 4) => {
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    const result = await rateCardAction(currentItem.card.id, rating)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to rate card')
      return
    }

    // Consider Good (3) and Easy (4) as correct, Again (1) and Hard (2) as incorrect
    const isCorrect = rating >= 3

    setState(prev => ({
      ...prev,
      isAnswered: true,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      mistakes: isCorrect
        ? prev.mistakes
        : [...prev.mistakes, { card: currentItem.card, selectedIndex: -1 }],
    }))
  }

  // Move to next item
  const handleNext = () => {
    const nextIndex = state.currentIndex + 1

    if (nextIndex >= totalItems) {
      // Lesson complete
      onComplete(state.correctCount, state.mistakes)
    } else {
      // Move to next item
      setState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        isAnswered: false,
        selectedIndex: null,
        correctIndex: null,
        isRevealed: false,
      }))
    }
  }

  // Empty lesson
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600 dark:text-slate-400">
          This lesson has no items yet.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 text-center">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Question {state.currentIndex + 1} of {totalItems}
        </span>
        {/* Progress bar */}
        <div className="mt-2 w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((state.currentIndex + (state.isAnswered ? 1 : 0)) / totalItems) * 100}%`,
            }}
          />
        </div>
        {/* Score tracker */}
        <div className="mt-2 flex justify-center gap-4 text-sm">
          <span className="text-green-600 dark:text-green-400">
            ✓ {state.correctCount}
          </span>
          <span className="text-red-600 dark:text-red-400">
            ✗ {state.mistakes.length}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Item content - route based on item_type (Requirements 5.2, 5.3) */}
      {isMCQ ? (
        <MCQQuestion
          card={currentItem.card as MCQCard}
          onAnswer={handleMCQAnswer}
          isAnswered={state.isAnswered}
          selectedIndex={state.selectedIndex}
          correctIndex={state.correctIndex}
        />
      ) : (
        <>
          <Flashcard
            front={currentItem.card.front}
            back={currentItem.card.back}
            imageUrl={currentItem.card.image_url}
            isRevealed={state.isRevealed}
            onReveal={handleReveal}
          />
          {state.isRevealed && !state.isAnswered && (
            <RatingButtons
              cardId={currentItem.card.id}
              onRate={handleFlashcardRate}
            />
          )}
        </>
      )}

      {/* Next button - shown after answering */}
      {state.isAnswered && (
        <div className="mt-6 flex justify-center">
          <Button onClick={handleNext} size="lg">
            {state.currentIndex + 1 >= totalItems ? 'Finish Lesson' : 'Next'}
          </Button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-4 text-center text-slate-500 dark:text-slate-400">
          Processing...
        </div>
      )}
    </div>
  )
}
