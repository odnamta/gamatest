'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'

interface SessionSummaryProps {
  totalReviewed: number
  ratingBreakdown: {
    again: number
    hard: number
    good: number
    easy: number
  }
  dailyGoal: number | null
  todayTotal: number
  currentStreak: number
  isNewStreak: boolean
  deckId: string
}

/**
 * Session Summary Component
 * Displays end-of-session statistics and achievements.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.4, 4.5 - WCAG AA contrast in both modes
 */
export function SessionSummary({
  totalReviewed,
  ratingBreakdown,
  dailyGoal,
  todayTotal,
  currentStreak,
  isNewStreak,
  deckId,
}: SessionSummaryProps) {
  // Calculate progress percentage for daily goal
  const progressPercent = dailyGoal 
    ? Math.min(100, Math.round((todayTotal / dailyGoal) * 100))
    : null

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
      {/* Celebration emoji */}
      <div className="text-4xl mb-4">🎉</div>
      
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Study Session Complete!
      </h2>
      
      {/* Total cards reviewed - Requirement 3.1 */}
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        You reviewed <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalReviewed}</span> {totalReviewed === 1 ? 'card' : 'cards'} this session.
      </p>

      {/* Rating breakdown - Requirement 3.2 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{ratingBreakdown.again}</div>
          <div className="text-xs text-red-600/70 dark:text-red-400/70">Again</div>
        </div>
        <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{ratingBreakdown.hard}</div>
          <div className="text-xs text-orange-600/70 dark:text-orange-400/70">Hard</div>
        </div>
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{ratingBreakdown.good}</div>
          <div className="text-xs text-green-600/70 dark:text-green-400/70">Good</div>
        </div>
        <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ratingBreakdown.easy}</div>
          <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Easy</div>
        </div>
      </div>

      {/* Daily goal progress - Requirement 3.3 */}
      {dailyGoal && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
            <span>Today&apos;s Progress</span>
            <span>{todayTotal} / {dailyGoal}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-green-600 dark:text-green-400 text-sm mt-2">🎯 Daily goal reached!</p>
          )}
        </div>
      )}

      {/* Streak message - Requirements 3.4, 3.5 */}
      <div className="flex items-center justify-center gap-2 mb-6 py-3 bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30 rounded-lg">
        <Flame className="w-5 h-5 text-orange-500 dark:text-orange-400" />
        <span className="text-orange-600 dark:text-orange-400 font-medium">
          {isNewStreak ? 'Streak Started!' : 'Streak Kept!'} 
        </span>
        <span className="text-orange-700 dark:text-orange-300 font-bold">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
      </div>

      {/* Back to deck button */}
      <Link 
        href={`/decks/${deckId}`}
        className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to Deck
      </Link>
    </div>
  )
}
