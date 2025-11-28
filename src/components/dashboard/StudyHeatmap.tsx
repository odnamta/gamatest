'use client'

import { useMemo } from 'react'
import { generateDayArray, type HeatmapIntensity } from '@/lib/heatmap'
import { useResponsiveDayCount } from '@/lib/use-responsive-day-count'

/**
 * StudyHeatmap Component - Client Component
 * Displays a responsive grid of study activity with color-coded cells.
 * - Small screens (< 1024px): 28 days (4 weeks)
 * - Large screens (>= 1024px): 60 days
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.5
 */

interface StudyHeatmapProps {
  studyLogs: Array<{
    study_date: string
    cards_reviewed: number
  }>
}

/**
 * Maps intensity level to Tailwind CSS classes for cell colors.
 * Supports both light and dark modes.
 */
function getIntensityClasses(intensity: HeatmapIntensity): string {
  switch (intensity) {
    case 0:
      return 'bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700'
    case 1:
      return 'bg-emerald-200 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800'
    case 2:
      return 'bg-emerald-400 dark:bg-emerald-700/80 border border-emerald-500 dark:border-emerald-600'
    case 3:
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
  // Get responsive day count (28 for small, 60 for large screens)
  const dayCount = useResponsiveDayCount()

  // Create a map of date -> cards_reviewed for quick lookup
  const logMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of studyLogs) {
      map.set(log.study_date, log.cards_reviewed)
    }
    return map
  }, [studyLogs])

  // Generate day array using pure function (ordered oldest to newest)
  const days = useMemo(() => {
    return generateDayArray(dayCount, logMap)
  }, [dayCount, logMap])

  // Calculate grid columns based on day count
  // 28 days = 7 columns (4 weeks), 60 days = 10 columns (6 weeks)
  const gridCols = dayCount === 28 ? 7 : 10

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Study Activity (Last {dayCount} Days)
      </h3>
      
      {/* Responsive grid - no horizontal scrolling */}
      <div 
        className="grid gap-1"
        style={{ 
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
        }}
      >
        {days.map(({ date, count, intensity }) => {
          const classes = getIntensityClasses(intensity)
          
          return (
            <div
              key={date}
              className={`aspect-square rounded-sm ${classes} cursor-default transition-transform hover:scale-110`}
              title={`${formatDateForTooltip(date)}: ${count} cards`}
              aria-label={`${formatDateForTooltip(date)}: ${count} cards reviewed`}
            />
          )
        })}
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
