'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface SkillScore {
  skill_name: string
  skill_color: string
  score: number | null
  assessments_taken: number
}

interface EmployeeSkillRadarProps {
  scores: SkillScore[]
  size?: number
}

interface RadarDataPoint {
  skill: string
  score: number
  color: string
  assessments: number
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
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="font-medium text-slate-900 dark:text-slate-100">{data.skill}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Score: <span className="font-semibold text-blue-600 dark:text-blue-400">{data.score.toFixed(0)}%</span>
      </p>
      <p className="text-xs text-slate-500">
        {data.assessments} assessment{data.assessments !== 1 ? 's' : ''} taken
      </p>
    </div>
  )
}

export function EmployeeSkillRadar({ scores, size = 300 }: EmployeeSkillRadarProps) {
  const chartData: RadarDataPoint[] = scores.map((s) => ({
    skill: s.skill_name,
    score: s.score ?? 0,
    color: s.skill_color,
    assessments: s.assessments_taken,
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-500 dark:text-slate-400" style={{ height: size }}>
        No skill data yet
      </div>
    )
  }

  // For fewer than 3 skills, show bars instead
  if (chartData.length < 3) {
    return (
      <div className="space-y-3">
        {chartData.map((item) => (
          <div key={item.skill}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.skill}</span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{item.score.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${item.score}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="skill"
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
          name="Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
          dot={{ r: 4, fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
