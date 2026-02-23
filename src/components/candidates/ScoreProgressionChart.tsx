'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  date: string
  score: number
  assessmentTitle: string
  passed: boolean
}

interface Props {
  data: DataPoint[]
}

export default function ScoreProgressionChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} className="text-slate-500" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="text-slate-500" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as DataPoint & { displayDate: string }
            return (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-100">{d.assessmentTitle}</p>
                <p className={d.passed ? 'text-green-600' : 'text-red-500'}>
                  {d.score}% — {d.passed ? 'Lulus' : 'Gagal'}
                </p>
                <p className="text-slate-500 text-xs">{d.displayDate}</p>
              </div>
            )
          }}
        />
        <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
