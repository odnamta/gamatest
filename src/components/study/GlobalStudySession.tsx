'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Flashcard } from './Flashcard'
import { MCQQuestion } from './MCQQuestion'
import { RatingButtons } from './RatingButtons'
import { GlobalStudySummary } from './GlobalStudySummary'
import { rateCardAction } from '@/actions/study-actions'
import { 
  saveSessionState, 
  clearSessionState, 
  type CachedSessionState 
} from '@/lib/session-state'
import { useToast } from '@/components/ui/Toast'
import type { Card, MCQCard } from '@/types/database'

// V6.3: Auto-advance localStorage key
const AUTO_ADVANCE_KEY = 'study-auto-advance'
// V8.2: Increased from 1.5s to 2s for better feedback visibility
const AUTO_ADVANCE_DELAY = 2000 // 2 seconds

export interface GlobalStudySessionProps {
  initialCards: Card[]
  totalDueRemaining: number
  currentStreak: number
  onContinue?: () => void
  nextBatchUrl?: string
}

/**
 * Global Study Session Component
 * Manages the interactive study session for cards across all decks.
 * Requirements: 2.5, 2.6, 2.7
 * 
 * - 2.5: Reuse existing MCQQuestion and Flashcard components
 * - 2.6: Display lightweight summary showing correct/incorrect counts
 * - 2.7: Redirect to dashboard with toast on completion
 */
export function GlobalStudySession({
  initialCards,
  totalDueRemaining,
  currentStreak,
  onContinue,
  nextBatchUrl,
}: GlobalStudySessionProps) {
  const { showToast } = useToast()
  
  // Fixed session count - captured at mount, never changes during session
  // This ensures "Card X of Y" denominator stays constant
  const [sessionCardCount] = useState(() => initialCards.length)
  const [sessionCards] = useState(() => initialCards)
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Flashcard-specific state
  const [isRevealed, setIsRevealed] = useState(false)
  
  // MCQ-specific state
  const [isAnswered, setIsAnswered] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  
  // V8.2: Feedback display state - disables buttons during auto-advance countdown
  const [isShowingFeedback, setIsShowingFeedback] = useState(false)

  // V6.3: Auto-advance state
  const [autoAdvance, setAutoAdvance] = useState(false)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load auto-advance preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTO_ADVANCE_KEY)
      setAutoAdvance(saved === 'true')
    }
  }, [])

  // Save auto-advance preference when changed
  const toggleAutoAdvance = useCallback(() => {
    setAutoAdvance(prev => {
      const newValue = !prev
      localStorage.setItem(AUTO_ADVANCE_KEY, String(newValue))
      return newValue
    })
  }, [])

  // Clear auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
      }
    }
  }, [])

  // Use sessionCards (fixed at mount) instead of initialCards (may change)
  const currentCard = sessionCards[currentIndex] || null
  const remainingInBatch = sessionCardCount - currentIndex - 1
  // Global due count is separate from session progress
  const remainingDueCount = totalDueRemaining - (currentIndex + 1)

  // Persist session state to localStorage on each change
  const persistState = useCallback(() => {
    const state: CachedSessionState = {
      currentIndex,
      correctCount,
      incorrectCount,
      cardIds: sessionCards.map(c => c.id),
      timestamp: new Date().toISOString(),
    }
    saveSessionState(state)
  }, [currentIndex, correctCount, incorrectCount, sessionCards])

  useEffect(() => {
    if (!isComplete) {
      persistState()
    }
  }, [persistState, isComplete])

  // Clear localStorage and show toast when session completes
  // Requirement 2.7: Display toast notification "Great work today!" on completion
  useEffect(() => {
    if (isComplete) {
      clearSessionState()
      showToast('Great work today!', 'success')
    }
  }, [isComplete, showToast])

  // Check if current card is MCQ
  const isMCQ = currentCard?.card_type === 'mcq'

  // Move to next card or complete session
  const moveToNext = () => {
    if (currentIndex < sessionCardCount - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsRevealed(false)
      setIsAnswered(false)
      setSelectedIndex(null)
      // V8.2: Reset feedback state when moving to next card
      setIsShowingFeedback(false)
    } else {
      setIsComplete(true)
    }
  }

  // Handle flashcard reveal
  const handleReveal = () => {
    setIsRevealed(true)
  }

  // Handle flashcard rating (1=again, 2=hard, 3=good, 4=easy)
  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return

    setError(null)
    const result = await rateCardAction(currentCard.id, rating)

    if (!result.success) {
      setError(result.error || 'Failed to rate card')
      return
    }

    // Track correct/incorrect based on rating
    // Rating 1 (again) = incorrect, ratings 2-4 = correct
    if (rating === 1) {
      setIncorrectCount(prev => prev + 1)
    } else {
      setCorrectCount(prev => prev + 1)
    }

    moveToNext()
  }

  // Handle MCQ answer
  const handleMCQAnswer = async (selectedIdx: number) => {
    if (!currentCard || isAnswered) return

    setSelectedIndex(selectedIdx)
    setIsAnswered(true)
    
    // V8.2: Set feedback state to disable buttons during countdown
    if (autoAdvance) {
      setIsShowingFeedback(true)
    }

    const isCorrect = selectedIdx === currentCard.correct_index

    // Track correct/incorrect
    if (isCorrect) {
      setCorrectCount(prev => prev + 1)
    } else {
      setIncorrectCount(prev => prev + 1)
    }

    // Rate the card based on correctness
    // Correct = rating 3 (good), Incorrect = rating 1 (again)
    const rating = isCorrect ? 3 : 1
    setError(null)
    const result = await rateCardAction(currentCard.id, rating as 1 | 2 | 3 | 4)

    if (!result.success) {
      setError(result.error || 'Failed to rate card')
    }

    // V8.2: Auto-advance after 2s delay if enabled (increased from 1.5s)
    if (autoAdvance) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        setIsShowingFeedback(false)
        moveToNext()
      }, AUTO_ADVANCE_DELAY)
    }
  }

  // Handle MCQ continue (after viewing explanation)
  const handleMCQContinue = () => {
    moveToNext()
  }

  // Show summary when complete
  if (isComplete || !currentCard) {
    return (
      <GlobalStudySummary
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        currentStreak={currentStreak}
        remainingDueCount={Math.max(0, remainingDueCount)}
        onContinue={onContinue}
        nextBatchUrl={nextBatchUrl}
      />
    )
  }

  // Calculate progress percentage
  const progressPercent = sessionCardCount > 0 
    ? ((currentIndex + 1) / sessionCardCount) * 100 
    : 0

  return (
    <div>
      {/* V6.3: Progress header with auto-advance toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Card {currentIndex + 1} of {sessionCardCount}
            {remainingInBatch > 0 && ` • ${remainingInBatch} remaining`}
          </span>
          
          {/* Auto-advance toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-500 dark:text-slate-400">Auto-advance</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoAdvance}
              onClick={toggleAutoAdvance}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoAdvance 
                  ? 'bg-blue-600' 
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoAdvance ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>
        
        {/* V6.3: Visual progress bar */}
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Render appropriate card type */}
      {isMCQ ? (
        <>
          <MCQQuestion
            card={currentCard as MCQCard}
            onAnswer={handleMCQAnswer}
            isAnswered={isAnswered}
            selectedIndex={selectedIndex}
            correctIndex={isAnswered ? currentCard.correct_index : null}
            disabled={isShowingFeedback}
            cardTemplateId={currentCard.id}
            isFlagged={currentCard.is_flagged}
            notes={currentCard.notes}
          />
          {/* V8.2: Continue button or auto-advance indicator */}
          {isAnswered && (
            <div className="mt-6 flex justify-center">
              {isShowingFeedback && autoAdvance ? (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Next card in 2s...
                </span>
              ) : (
                <button
                  onClick={handleMCQContinue}
                  className="min-h-[44px] px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <Flashcard
            front={currentCard.front}
            back={currentCard.back}
            imageUrl={currentCard.image_url}
            isRevealed={isRevealed}
            onReveal={handleReveal}
            cardTemplateId={currentCard.id}
            isFlagged={currentCard.is_flagged}
            notes={currentCard.notes}
          />
          {/* Rating buttons - only show when revealed */}
          {isRevealed && (
            <RatingButtons cardId={currentCard.id} onRate={handleRate} />
          )}
        </>
      )}
    </div>
  )
}
