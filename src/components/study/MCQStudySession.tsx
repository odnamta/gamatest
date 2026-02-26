'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MCQQuestion } from './MCQQuestion'
import { Button } from '@/components/ui/Button'
import { answerMCQAction } from '@/actions/mcq-actions'
import { useHotkeys } from '@/hooks/use-hotkeys'
import type { MCQCard } from '@/types/database'

interface MCQStudySessionProps {
  initialCards: MCQCard[]
  deckId: string
}

interface MCQSessionState {
  currentIndex: number
  isAnswered: boolean
  selectedIndex: number | null
  correctIndex: number | null
  correctCount: number
  incorrectCount: number
  isComplete: boolean
}

/**
 * MCQStudySession component for managing MCQ study flow.
 * Requirements: 2.7, 2.8
 * - 2.7: Display progress indicator ("Question 3 of 10")
 * - 2.8: Provide "Next Question" button after answering
 */
export function MCQStudySession({ initialCards, deckId }: MCQStudySessionProps) {
  const [cards] = useState<MCQCard[]>(initialCards)
  const [sessionState, setSessionState] = useState<MCQSessionState>({
    currentIndex: 0,
    isAnswered: false,
    selectedIndex: null,
    correctIndex: null,
    correctCount: 0,
    incorrectCount: 0,
    isComplete: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentCard = cards[sessionState.currentIndex]
  const totalCards = cards.length

  const handleAnswer = async (selectedIndex: number) => {
    if (sessionState.isAnswered || isLoading) return

    setIsLoading(true)
    setError(null)

    const result = await answerMCQAction(currentCard.id, selectedIndex)

    setIsLoading(false)

    if (!result.ok) {
      setError(result.error || 'Failed to submit answer')
      return
    }

    // Update session state with answer result
    setSessionState(prev => ({
      ...prev,
      isAnswered: true,
      selectedIndex,
      correctIndex: result.data?.correctIndex ?? null,
      correctCount: result.data?.isCorrect ? prev.correctCount + 1 : prev.correctCount,
      incorrectCount: !result.data?.isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
    }))
  }

  const handleNextQuestion = () => {
    const nextIndex = sessionState.currentIndex + 1

    if (nextIndex >= totalCards) {
      // Session complete
      setSessionState(prev => ({
        ...prev,
        isComplete: true,
      }))
    } else {
      // Move to next question
      setSessionState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        isAnswered: false,
        selectedIndex: null,
        correctIndex: null,
      }))
    }
  }

  // Keyboard shortcuts: 1-5 for options, Enter for next
  const handleKeyOption = (index: number) => {
    if (!sessionState.isAnswered && !isLoading && index < currentCard.options.length) {
      handleAnswer(index)
    }
  }

  useHotkeys([
    { key: '1', handler: () => handleKeyOption(0), enabled: !sessionState.isComplete && !sessionState.isAnswered },
    { key: '2', handler: () => handleKeyOption(1), enabled: !sessionState.isComplete && !sessionState.isAnswered },
    { key: '3', handler: () => handleKeyOption(2), enabled: !sessionState.isComplete && !sessionState.isAnswered },
    { key: '4', handler: () => handleKeyOption(3), enabled: !sessionState.isComplete && !sessionState.isAnswered },
    { key: '5', handler: () => handleKeyOption(4), enabled: !sessionState.isComplete && !sessionState.isAnswered },
    { key: 'Enter', handler: handleNextQuestion, enabled: sessionState.isAnswered && !sessionState.isComplete },
  ])

  // Session complete - show summary
  if (sessionState.isComplete) {
    const scorePercent = Math.round((sessionState.correctCount / totalCards) * 100)
    
    return (
      <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          MCQ Session Complete!
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          You scored <span className="font-bold text-blue-600 dark:text-blue-400">{sessionState.correctCount}</span> out of <span className="font-bold">{totalCards}</span> ({scorePercent}%)
        </p>
        
        {/* Score breakdown */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {sessionState.correctCount}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {sessionState.incorrectCount}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Incorrect</div>
          </div>
        </div>

        <Link
          href={`/decks/${deckId}`}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Deck
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Progress indicator (Requirement 2.7) */}
      <div className="mb-6 text-center" aria-live="polite">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Question {sessionState.currentIndex + 1} of {totalCards}
        </span>
        {/* Progress bar */}
        <div className="mt-2 w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((sessionState.currentIndex + (sessionState.isAnswered ? 1 : 0)) / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      {/* MCQ Question */}
      <MCQQuestion
        card={currentCard}
        onAnswer={handleAnswer}
        isAnswered={sessionState.isAnswered}
        selectedIndex={sessionState.selectedIndex}
        correctIndex={sessionState.correctIndex}
      />

      {/* Next Question button (Requirement 2.8) */}
      {sessionState.isAnswered && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button onClick={handleNextQuestion} size="lg">
            {sessionState.currentIndex + 1 >= totalCards ? 'Finish Session' : 'Next Question'}
          </Button>
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Enter</kbd> to continue
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-4 text-center text-slate-500 dark:text-slate-400">
          Submitting answer...
        </div>
      )}
    </div>
  )
}
