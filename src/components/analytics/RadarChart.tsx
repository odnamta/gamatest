'use client'

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TopicAccuracy } from '@/types/database'
import { getTopTopicsByAttempts, normalizeAccuracy, findLowestAccuracyIndex } from '@/lib/analytics-utils'

interface RadarChartProps {
  data: TopicAccuracy[]
  maxTopics?: number
}

interface RadarDataPoint {
  topic: string
  accuracy: number
  fullMark: number
  isLowConfidence: boolean
  totalAttempts: number
  isLowest: boolean
}

/**
 * Transforms topic accuracies to radar chart data format.
 * Normalizes accuracy to 0-100 scale and marks lowest accuracy topic.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 4: Lowest accuracy topic identification**
 * **Validates: Requirements 3.2, 3.3, 3.4**
 */
export function transformToRadarData(topics: TopicAccuracy[], maxTopics: number = 5): RadarDataPoint[] {
  const topTopics = getTopTopicsByAttempts(topics, maxTopics)
  const lowestIndex = findLowestAccuracyIndex(topTopics)
  
  return topTopics.map((t, index) => ({
    topic: t.tagName,
    accuracy: normalizeAccuracy(t.accuracy),
    fullMark: 100,
    isLowConfidence: t.isLowConfidence,
    totalAttempts: t.totalAttempts,
    isLowest: index === lowestIndex,
  }))
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: RadarDataPoint
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload
  
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 p-3">
      <p className="font-medium text-slate-900">{data.topic}</p>
      <p className="text-sm text-slate-600">
        Accuracy: <span className={`font-semibold ${data.isLowest ? 'text-red-600' : 'text-blue-600'}`}>
          {data.accuracy.toFixed(1)}%
        </span>
      </p>
      <p className="text-sm text-slate-500">
        {data.totalAttempts} attempts
      </p>
      {data.isLowest && (
        <p className="text-xs text-red-600 mt-1">
          🎯 Weakest topic - focus here!
        </p>
      )}
      {data.isLowConfidence && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ Low confidence (fewer than 5 attempts)
        </p>
      )}
    </div>
  )
}

/**
 * RadarChart component for visualizing topic strengths.
 * Uses recharts RadarChart with normalized 0-100 scale.
 * Highlights lowest accuracy topic in red (#ef4444).
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * V10.3: Added lowest accuracy highlighting
 */
export function RadarChart({ data, maxTopics = 5 }: RadarChartProps) {
  const chartData = transformToRadarData(data, maxTopics)

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        No topic data available
      </div>
    )
  }

  // For fewer than 3 topics, radar chart doesn't look good - use bar display
  if (chartData.length < 3) {
    return (
      <div className="space-y-3">
        {chartData.map((item) => (
          <div key={item.topic} className="flex items-center justify-between">
            <span className={`text-sm font-medium ${item.isLowest ? 'text-red-600' : 'text-slate-700'}`}>
              {item.topic}
              {item.isLowest && ' 🎯'}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    item.isLowest ? 'bg-red-500' : 
                    item.isLowConfidence ? 'bg-amber-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${item.accuracy}%` }}
                />
              </div>
              <span className={`text-sm w-12 text-right ${item.isLowest ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                {item.accuracy.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsRadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis 
          dataKey="topic" 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={false}
        />
        <PolarRadiusAxis 
          angle={90} 
          domain={[0, 100]} 
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          tickCount={5}
        />
        <Radar
          name="Accuracy"
          dataKey="accuracy"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload } = props
            // Highlight lowest accuracy topic in red (#ef4444) - Requirements 3.4
            const isLowest = payload.isLowest
            const dotColor = isLowest ? '#ef4444' : (payload.isLowConfidence ? '#f59e0b' : '#3b82f6')
            return (
              <circle
                cx={cx}
                cy={cy}
                r={isLowest ? 7 : (payload.isLowConfidence ? 4 : 5)}
                fill={dotColor}
                stroke={dotColor}
                strokeWidth={isLowest ? 3 : 2}
                strokeDasharray={payload.isLowConfidence && !isLowest ? '2,2' : undefined}
              />
            )
          }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}

export default RadarChart
