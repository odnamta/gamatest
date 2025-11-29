'use client'

import { useMemo, useState, useEffect } from 'react'
import { type HeatmapIntensity, getHeatmapIntensity } from '@/lib/heatmap'

interface StudyHeatmapProps {
  studyLogs: Array<{ study_date: string; cards_reviewed: number }>
  currentYear: number
}

const DAYS_PER_WEEK = 7
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getIntensityClasses(intensity: HeatmapIntensity): string {
  switch (intensity) {
    case 0: return 'bg-slate-100 dark:bg-slate-700/50'
    case 1: return 'bg-emerald-200 dark:bg-emerald-900/70'
    case 2: return 'bg-emerald-400 dark:bg-emerald-600'
    case 3: return 'bg-emerald-600 dark:bg-emerald-500'
    default: return 'bg-slate-100 dark:bg-slate-700/50'
  }
}

function formatDateForTooltip(dateStr: string, dayOfWeek: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${DAY_NAMES[dayOfWeek]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`
}

interface DayData {
  dateStr: string
  dayOfWeek: number
  count: number
  intensity: HeatmapIntensity
  isCurrentYear: boolean
}

function generateYearWeeks(year: number, logMap: Map<string, number>): DayData[][] {
  const weeks: DayData[][] = []
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const startDate = new Date(jan1)
  startDate.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay())
  const dec31 = new Date(Date.UTC(year, 11, 31))
  const endDate = new Date(dec31)
  endDate.setUTCDate(dec31.getUTCDate() + (6 - dec31.getUTCDay()))
  let currentWeek: DayData[] = []
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const count = logMap.get(dateStr) || 0
    const isCurrentYear = currentDate.getUTCFullYear() === year
    const dayOfWeek = currentDate.getUTCDay()
    currentWeek.push({ dateStr, dayOfWeek, count: isCurrentYear ? count : -1, intensity: isCurrentYear ? getHeatmapIntensity(count) : 0, isCurrentYear })
    if (currentWeek.length === DAYS_PER_WEEK) { weeks.push(currentWeek); currentWeek = [] }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)
  return weeks
}

function getMonthLabels(weeks: DayData[][]) {
  const labels: { month: string; weekIndex: number }[] = []
  weeks.forEach((week, weekIndex) => {
    const firstOfMonth = week.find(day => day.isCurrentYear && parseInt(day.dateStr.split('-')[2], 10) === 1)
    if (firstOfMonth) {
      const monthNum = parseInt(firstOfMonth.dateStr.split('-')[1], 10) - 1
      labels.push({ month: MONTH_NAMES[monthNum], weekIndex })
    }
  })
  return labels
}

export function StudyHeatmap({ studyLogs, currentYear }: StudyHeatmapProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Hydration-safe: only set state after mount
  useEffect(() => {
    setSelectedYear(currentYear)
    setIsClient(true)
  }, [currentYear])

  const displayYear = selectedYear ?? currentYear
  const availableYears = [currentYear, currentYear - 1, currentYear - 2]

  const logMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of studyLogs) map.set(log.study_date, log.cards_reviewed)
    return map
  }, [studyLogs])

  const weeks = useMemo(() => generateYearWeeks(displayYear, logMap), [displayYear, logMap])
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks])

  const totalContributions = useMemo(() => {
    let total = 0
    for (const [dateStr, count] of logMap) {
      if (dateStr.startsWith(String(displayYear))) total += count
    }
    return total
  }, [logMap, displayYear])

  const numWeeks = weeks.length

  return (
    <div className="w-full">
      {/* Header with title and year selector */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {totalContributions} cards reviewed in {displayYear}
        </h3>
        {/* Year selector - always render structure, use opacity for hydration safety */}
        <div className={`flex gap-1 transition-opacity ${isClient ? 'opacity-100' : 'opacity-0'}`}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              disabled={!isClient}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${year === displayYear ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      
      {/* Centered heatmap container */}
      <div className="w-full flex justify-center">
        <div className="inline-block overflow-x-auto">
          {/* Month labels row */}
          <div className="flex">
            <div className="w-[30px] flex-shrink-0" />
            <div className="relative h-[15px]" style={{ width: `${numWeeks * 13}px` }}>
              {monthLabels.map(({ month, weekIndex }, i) => (
                <span key={`${month}-${weekIndex}-${i}`} className="absolute text-[11px] text-slate-500 dark:text-slate-400" style={{ left: `${weekIndex * 13}px` }}>
                  {month}
                </span>
              ))}
            </div>
          </div>
          
          {/* Day labels + grid */}
          <div className="flex items-start">
            <div className="flex flex-col gap-[2px] text-[10px] text-slate-400 dark:text-slate-500 w-[30px] flex-shrink-0">
              <div className="h-[10px]" />
              <div className="h-[10px] flex items-center">Mon</div>
              <div className="h-[10px]" />
              <div className="h-[10px] flex items-center">Wed</div>
              <div className="h-[10px]" />
              <div className="h-[10px] flex items-center">Fri</div>
              <div className="h-[10px]" />
            </div>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${numWeeks}, 10px)`, gridTemplateRows: `repeat(${DAYS_PER_WEEK}, 10px)`, gridAutoFlow: 'column' }}>
              {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
                if (!day.isCurrentYear) return <div key={`empty-${weekIndex}-${dayIndex}`} className="w-[10px] h-[10px]" />
                return (
                  <div
                    key={`day-${day.dateStr}`}
                    className={`w-[10px] h-[10px] rounded-sm ${getIntensityClasses(day.intensity)} cursor-default transition-transform hover:scale-150`}
                    title={`${formatDateForTooltip(day.dateStr, day.dayOfWeek)}: ${day.count} cards`}
                  />
                )
              }))}
            </div>
          </div>
          
          {/* Legend - centered under the grid */}
          <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Less</span>
            <div className="flex gap-[2px]">
              <div className={`w-[10px] h-[10px] rounded-sm ${getIntensityClasses(0)}`} />
              <div className={`w-[10px] h-[10px] rounded-sm ${getIntensityClasses(1)}`} />
              <div className={`w-[10px] h-[10px] rounded-sm ${getIntensityClasses(2)}`} />
              <div className={`w-[10px] h-[10px] rounded-sm ${getIntensityClasses(3)}`} />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
