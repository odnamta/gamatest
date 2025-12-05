'use client'

import dynamic from 'next/dynamic'
import type { TopicAccuracy } from '@/types/database'

// Loading skeleton for the radar chart
function RadarChartSkeleton() {
  return (
    <div className="h-[300px] flex items-center justify-center">
      <div className="relative w-48 h-48">
        {/* Animated radar skeleton */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 animate-pulse" />
        <div className="absolute inset-4 rounded-full border-2 border-slate-200 animate-pulse" />
        <div className="absolute inset-8 rounded-full border-2 border-slate-200 animate-pulse" />
        <div className="absolute inset-12 rounded-full border-2 border-slate-200 animate-pulse" />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-slate-300 rounded-full animate-pulse" />
        </div>
        {/* Axis lines */}
        {[0, 72, 144, 216, 288].map((angle) => (
          <div
            key={angle}
            className="absolute top-1/2 left-1/2 w-24 h-0.5 bg-slate-200 origin-left animate-pulse"
            style={{ transform: `rotate(${angle}deg)` }}
          />
        ))}
      </div>
    </div>
  )
}

// Dynamic import with SSR disabled to prevent hydration errors
// Requirements: 5.1, 5.2
const RadarChartComponent = dynamic(
  () => import('./RadarChart').then(mod => mod.RadarChart),
  {
    ssr: false,
    loading: () => <RadarChartSkeleton />,
  }
)

interface TopicRadarChartProps {
  topics: TopicAccuracy[]
  maxTopics?: number
}

/**
 * TopicRadarChart is a client-side only wrapper for RadarChart.
 * Uses Next.js dynamic import with ssr: false to prevent hydration errors.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3
 */
export function TopicRadarChart({ topics, maxTopics = 5 }: TopicRadarChartProps) {
  return <RadarChartComponent data={topics} maxTopics={maxTopics} />
}

export default TopicRadarChart
