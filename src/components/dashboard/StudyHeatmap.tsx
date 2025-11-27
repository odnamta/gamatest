'use client'

import { useMemo } from 'react'
import { getHeatmapIntensity, type HeatmapIntensity } from '@/lib/heatmap'

/**
 * StudyHeatmap Component - Client Component
 * Displays a 60-day grid of study activity with color-coded cells.
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */

interface StudyHeatmapProps {
  studyLogs: Array<{
    study_date: string
    cards_reviewed: number
  }>
}

/**
 * Maps intensity level to Tailwind CSS classes for cell colors.
 * Supports both light and dark modes (Requirements 4.4, 4.5).
 */
function getIntensityClasses(intensity: HeatmapIntensity): string {
  switch (intensity) {
    case 0:
      // Empty cell with subtle border (Requirement 2.5)
      return 'bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700'
    case 1:
      // Light intensity (1-5 cards)
      return 'bg-emerald-200 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800'
    case 2:
      // Medium intensity (6-15 cards)
      return 'bg-emerald-400 dark:bg-emerald-700/80 border border-emerald-500 dark:border-emerald-600'
    case 3:
      // Dark intensity (16+ cards)
      return 'bg-emerald-600 dark:bg-emerald-500 border border-emerald-700 dark:border-emerald-400'
    default:
      return 'bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700'
  }
}

/**
 * Formats a date string for tooltip display.
 */
function formatDateForTooltip(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function StudyHeatmap({ studyLogs }: StudyHeatmapProps) {
  // Create a map of date -> cards_reviewed for quick lookup
  const logMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of studyLogs) {
      map.set(log.study_date, log.cards_reviewed)
    }
    return map
  }, [studyLogs])

  // Generate the last 60 days (Requirement 2.2)
  const days = useMemo(() => {
    const result: Array<{ date: string; count: number }> = []
    const today = new Date()
    
    for (let i = 59; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const count = logMap.get(dateStr) || 0
      result.push({ date: dateStr, count })
    }
    
    return result
  }, [logMap])

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Study Activity (Last 60 Days)
      </h3>
      
      {/* Horizontal scrolling container for mobile (Requirement 2.4) */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid grid-cols-[repeat(60,1fr)] gap-1 min-w-max">
          {days.map(({ date, count }) => {
            const intensity = getHeatmapIntensity(count)
            const classes = getIntensityClasses(intensity)
            
            return (
              <div
                key={date}
                className={`w-3 h-3 rounded-sm ${classes} cursor-default transition-transform hover:scale-125`}
                title={`${formatDateForTooltip(date)}: ${count} cards`}
                aria-label={`${formatDateForTooltip(date)}: ${count} cards reviewed`}
              />
            )
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
        <span>Less</span>
        <div className="flex gap-1">
          <div className={`w-3 h-3 rounded-sm ${getIntensityClasses(0)}`} title="0 cards" />
          <div className={`w-3 h-3 rounded-sm ${getIntensityClasses(1)}`} title="1-5 cards" />
          <div className={`w-3 h-3 rounded-sm ${getIntensityClasses(2)}`} title="6-15 cards" />
          <div className={`w-3 h-3 rounded-sm ${getIntensityClasses(3)}`} title="16+ cards" />
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
