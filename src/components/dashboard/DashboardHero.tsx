'use client'

import Link from 'next/link'
import { Play, BookOpen } from 'lucide-react'
import { computeProgressPercent } from '@/lib/daily-progress'

interface DashboardHeroProps {
  globalDueCount: number
  completedToday: number
  dailyGoal: number | null
  hasNewCards: boolean
}

/**
 * DashboardHero Component
 * Displays greeting, global stats, and primary study CTA.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2
 * 
 * Feature: v3-ux-overhaul
 */
export function DashboardHero({
  globalDueCount,
  completedToday,
  dailyGoal,
  hasNewCards,
}: DashboardHeroProps) {
  const progressPercent = computeProgressPercent(completedToday, dailyGoal)
  const hasCardsToStudy = globalDueCount > 0 || hasNewCards

  return (
    <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 border border-blue-100 dark:border-slate-700 rounded-xl">
      {/* Greeting - Requirement 1.1 */}
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Hi Celline 👋 Ready to study?
      </h1>

      {/* Stats Row - Requirements 1.2, 1.3 */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-600 dark:text-slate-400">Due today:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {globalDueCount} {globalDueCount === 1 ? 'card' : 'cards'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 dark:text-slate-400">Completed:</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {completedToday}
          </span>
        </div>
      </div>

      {/* Daily Goal Progress Bar - Requirement 1.4 */}
      {dailyGoal && progressPercent !== null && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
            <span>Daily Goal</span>
            <span>{completedToday} / {dailyGoal}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent >= 100 && (
            <p className="text-green-600 dark:text-green-400 text-xs mt-1">🎯 Daily goal reached!</p>
          )}
        </div>
      )}

      {/* Primary CTA or Empty State - Requirements 1.5, 1.6 */}
      {hasCardsToStudy ? (
        <Link
          href="/study/global"
          className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg min-h-[56px]"
        >
          <Play className="w-5 h-5" />
          Start Today&apos;s Session
        </Link>
      ) : (
        <div className="text-center py-4 px-6 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-lg">
          <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            You have no due cards yet — create MCQs using Bulk Import or add a flashcard manually.
          </p>
        </div>
      )}
    </div>
  )
}
