'use client'

import { useState } from 'react'
import { MCQQuestion } from './MCQQuestion'
import { Flashcard } from './Flashcard'
import { GlobalStudySummary } from './GlobalStudySummary'
import { Button } from '@/components/ui/Button'
import { answerMCQAction } from '@/actions/mcq-actions'
import { rateCardAction } from '@/actions/study-actions'
import type { Card, MCQCard } from '@/types/database'

// Extended card type with card_type discriminator
type StudyCard = (Card & { card_type: 'flashcard' }) | (MCQCard & { card_type: 'mcq' })

interface GlobalStudySessionProps {
  initialCards: StudyCard[]
  totalDueRemaining: number
  currentStreak: number
}

interface GlobalSessionState {
  currentIndex: number
  correctCount: number
  incorrectCount: number
  isComplete: boolean
  isRevealed: boolean // For flashcards
  isAnswered: boolean // For MCQs
  selectedIndex: number | null
  correctIndex: number | null
}

/**
 * GlobalStudySession Component
 * Manages cross-deck study session with mixed card types.
 * Requirements: 2.4, 2.5, 2.6
 * 
 * Feature: v3-ux-overhaul
 */
export function GlobalStudySession({
  initialCards,
  totalDueRemaining,
  currentStreak,
}: GlobalStudySessionProps) {
  const [cards] = useState<StudyCard[]>(initialCards)
  const [sessionState, setSessionState] = useState<GlobalSessionState>({
    currentIndex: 0,
    correctCount: 0,
    incorrectCount: 0,
    isComplete: false,
    isRevealed: false,
    isAnswered: false,
    selectedIndex: null,
    correctIndex: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentCard = cards[sessionState.currentIndex]
  const totalCards = cards.length
  const isMCQ = currentCard?.card_type === 'mcq'

  // Handle MCQ answer
  const handleMCQAnswer = async (selectedIndex: number) => {
    if (sessionState.isAnswered || isLoading) return

    setIsLoading(true)
    setError(null)

    const result = await answerMCQAction(currentCard.id, selectedIndex)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to submit answer')
      return
    }

    setSessionState(prev => ({
      ...prev,
      isAnswered: true,
      selectedIndex,
      correctIndex: result.correctIndex ?? null,
      correctCount: result.isCorrect ? prev.correctCount + 1 : prev.correctCount,
      incorrectCount: !result.isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
    }))
  }

  // Handle flashcard reveal
  const handleReveal = () => {
    setSessionState(prev => ({ ...prev, isRevealed: true }))
  }

  // Handle flashcard rating
  const handleFlashcardRating = async (rating: 1 | 2 | 3 | 4) => {
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    const result = await rateCardAction(currentCard.id, rating)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to submit rating')
      return
    }

    // Consider ratings 3 and 4 as "correct" for summary purposes
    const isCorrect = rating >= 3

    setSessionState(prev => ({
      ...prev,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      incorrectCount: !isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
    }))

    moveToNextCard()
  }

  // Move to next card or complete session
  const moveToNextCard = () => {
    const nextIndex = sessionState.currentIndex + 1

    if (nextIndex >= totalCards) {
      setSessionState(prev => ({ ...prev, isComplete: true }))
    } else {
      setSessionState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        isRevealed: false,
        isAnswered: false,
        selectedIndex: null,
        correctIndex: null,
      }))
    }
  }

  // Handle "Next" button for MCQs
  const handleNextQuestion = () => {
    moveToNextCard()
  }

  // Session complete - show summary
  if (sessionState.isComplete) {
    const remainingAfterSession = Math.max(0, totalDueRemaining - totalCards)
    
    return (
      <GlobalStudySummary
        correctCount={sessionState.correctCount}
        incorrectCount={sessionState.incorrectCount}
        currentStreak={currentStreak}
        remainingDueCount={remainingAfterSession}
      />
    )
  }

  // No cards to study
  if (!currentCard) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600 dark:text-slate-400">No cards to study.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 text-center">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Card {sessionState.currentIndex + 1} of {totalCards}
        </span>
        <div className="mt-2 w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((sessionState.currentIndex + (sessionState.isAnswered || sessionState.isRevealed ? 1 : 0)) / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Card display based on type */}
      {isMCQ ? (
        <>
          <MCQQuestion
            card={currentCard as MCQCard}
            onAnswer={handleMCQAnswer}
            isAnswered={sessionState.isAnswered}
            selectedIndex={sessionState.selectedIndex}
            correctIndex={sessionState.correctIndex}
          />
          {sessionState.isAnswered && (
            <div className="mt-6 flex justify-center">
              <Button onClick={handleNextQuestion} size="lg">
                {sessionState.currentIndex + 1 >= totalCards ? 'Finish Session' : 'Next Card'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <Flashcard
            front={(currentCard as Card).front}
            back={(currentCard as Card).back}
            imageUrl={(currentCard as Card).image_url}
            isRevealed={sessionState.isRevealed}
            onReveal={handleReveal}
          />
          {sessionState.isRevealed && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => handleFlashcardRating(1)} variant="ghost" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50">
                Again
              </Button>
              <Button onClick={() => handleFlashcardRating(2)} variant="ghost" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50">
                Hard
              </Button>
              <Button onClick={() => handleFlashcardRating(3)} variant="ghost" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50">
                Good
              </Button>
              <Button onClick={() => handleFlashcardRating(4)} variant="ghost" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50">
                Easy
              </Button>
            </div>
          )}
        </>
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
