'use client'

interface HeatmapDomain {
  id: string
  name: string
  color: string
}

interface HeatmapEmployee {
  userId: string
  email: string
  scores: Record<string, number | null>
}

interface SkillHeatmapProps {
  domains: HeatmapDomain[]
  employees: HeatmapEmployee[]
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-slate-100 dark:bg-slate-700'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-green-400'
  if (score >= 40) return 'bg-amber-400'
  if (score >= 20) return 'bg-orange-400'
  return 'bg-red-400'
}

function getScoreTextColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-400 dark:text-slate-500'
  if (score >= 40) return 'text-white'
  return 'text-white'
}

export function SkillHeatmap({ domains, employees }: SkillHeatmapProps) {
  if (domains.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No skill domains defined yet.
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No employee scores recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white dark:bg-slate-800 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 z-10">
              Employee
            </th>
            {domains.map((d) => (
              <th
                key={d.id}
                className="px-2 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="sticky left-0 bg-white dark:bg-slate-800 px-3 py-2 font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50 z-10 whitespace-nowrap">
                {emp.email}
              </td>
              {domains.map((d) => {
                const score = emp.scores[d.id]
                return (
                  <td
                    key={d.id}
                    className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-700/50"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-10 h-7 rounded text-xs font-medium ${getScoreColor(score)} ${getScoreTextColor(score)}`}
                    >
                      {score !== null && score !== undefined ? `${score.toFixed(0)}` : '—'}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
