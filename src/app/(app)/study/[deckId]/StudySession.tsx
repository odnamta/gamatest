'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flashcard } from '@/components/study/Flashcard'
import { RatingButtons } from '@/components/study/RatingButtons'
import { SessionSummary } from '@/components/study/SessionSummary'
import { rateCardAction } from '@/actions/study-actions'
import type { Card, UserStats } from '@/types/database'
import type { SessionState } from '@/types/session'

interface StudySessionProps {
  initialCards: Card[]
  deckId: string
  userStats: UserStats | null
}

/**
 * Client component for managing the interactive study session.
 * Handles card reveal state, rating flow, and session tracking.
 * Requirements: 3.1, 3.2
 */
export function StudySession({ initialCards, deckId, userStats }: StudySessionProps) {
  const [currentCard, setCurrentCard] = useState<Card | null>(initialCards[0] || null)
  const [remainingCount, setRemainingCount] = useState(initialCards.length)
  const [isRevealed, setIsRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  
  // Session state tracking - Requirements: 3.1, 3.2
  const [sessionState, setSessionState] = useState<SessionState>({
    cardsReviewed: 0,
    ratings: {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    },
  })
  
  // Track if this is a new streak (first study of the day)
  const [isNewStreak, setIsNewStreak] = useState(() => {
    if (!userStats?.last_study_date) return true
    const today = new Date().toISOString().split('T')[0]
    return userStats.last_study_date !== today
  })

  const handleReveal = () => {
    setIsRevealed(true)
  }

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return

    setError(null)
    const result = await rateCardAction(currentCard.id, rating)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Update session state tracking - Requirements: 3.1, 3.2
    setSessionState(prev => {
      const ratingKey = rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'
      return {
        cardsReviewed: prev.cardsReviewed + 1,
        ratings: {
          ...prev.ratings,
          [ratingKey]: prev.ratings[ratingKey] + 1,
        },
      }
    })

    // Move to next card or show completion
    if (result.nextCard) {
      setCurrentCard(result.nextCard)
      setRemainingCount(result.remainingCount)
      setIsRevealed(false)
    } else {
      setIsComplete(true)
      setCurrentCard(null)
      setRemainingCount(0)
    }
  }

  // Session complete state - Requirements: 3.1
  if (isComplete || !currentCard) {
    // Calculate today's total (previous + this session)
    const previousTodayCount = userStats?.last_study_date === new Date().toISOString().split('T')[0]
      ? 0 // If already studied today, the server has the count
      : 0
    const todayTotal = previousTodayCount + sessionState.cardsReviewed
    
    // Get current streak (will be updated after first card of the day)
    const currentStreak = userStats?.current_streak ?? 1
    
    return (
      <SessionSummary
        totalReviewed={sessionState.cardsReviewed}
        ratingBreakdown={sessionState.ratings}
        dailyGoal={userStats?.daily_goal ?? null}
        todayTotal={todayTotal}
        currentStreak={currentStreak}
        isNewStreak={isNewStreak}
        deckId={deckId}
      />
    )
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 text-center">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {remainingCount} {remainingCount === 1 ? 'card' : 'cards'} remaining
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Flashcard */}
      <Flashcard
        front={currentCard.front}
        back={currentCard.back}
        imageUrl={currentCard.image_url}
        isRevealed={isRevealed}
        onReveal={handleReveal}
      />

      {/* Rating buttons - only show when revealed */}
      {isRevealed && (
        <RatingButtons cardId={currentCard.id} onRate={handleRate} />
      )}
    </div>
  )
}
