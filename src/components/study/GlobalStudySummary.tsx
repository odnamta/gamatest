'use client'

import Link from 'next/link'
import { Flame, Home, Play } from 'lucide-react'

interface GlobalStudySummaryProps {
  correctCount: number
  incorrectCount: number
  currentStreak: number
  remainingDueCount: number
}

/**
 * GlobalStudySummary Component
 * Displays session results with navigation options.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.4
 * 
 * Feature: v3-ux-overhaul
 */
export function GlobalStudySummary({
  correctCount,
  incorrectCount,
  currentStreak,
  remainingDueCount,
}: GlobalStudySummaryProps) {
  const totalAnswered = correctCount + incorrectCount
  const scorePercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0

  return (
    <div className="text-center py-8 px-4 bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
      {/* Celebration */}
      <div className="text-5xl mb-4">🎉</div>
      
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Great work today!
      </h2>
      
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        You completed {totalAnswered} {totalAnswered === 1 ? 'card' : 'cards'} this session.
      </p>

      {/* Score breakdown - Requirement 6.1 */}
      <div className="flex justify-center gap-8 mb-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {correctCount}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Correct</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {incorrectCount}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Incorrect</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {scorePercent}%
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Score</div>
        </div>
      </div>

      {/* Streak display */}
      {currentStreak > 0 && (
        <div className="flex items-center justify-center gap-2 mb-6 py-3 px-4 bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30 rounded-lg inline-flex mx-auto">
          <Flame className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          <span className="text-orange-600 dark:text-orange-400 font-medium">
            {currentStreak} day streak!
          </span>
        </div>
      )}

      {/* Action buttons - Requirements 6.2, 6.3, 6.4, 7.4 */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {/* Return to Dashboard - always visible (Requirement 6.2) */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors min-h-[56px] min-w-[200px]"
        >
          <Home className="w-5 h-5" />
          Return to Dashboard
        </Link>

        {/* Continue Studying - conditional (Requirements 6.3, 6.4) */}
        {remainingDueCount > 0 && (
          <Link
            href="/study/global"
            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold rounded-lg transition-colors min-h-[56px] min-w-[200px]"
          >
            <Play className="w-5 h-5" />
            Continue Studying ({remainingDueCount} left)
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * Helper function to determine if continue button should be visible.
 * Used for property testing.
 * Requirements: 6.3, 6.4
 */
export function shouldShowContinueButton(remainingDueCount: number): boolean {
  return remainingDueCount > 0
}
