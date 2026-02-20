'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Target, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const EmployeeSkillRadar = dynamic(() => import('./EmployeeSkillRadar').then(m => m.EmployeeSkillRadar), { ssr: false })
const RoleGapRadar = dynamic(() => import('./RoleGapRadar').then(m => m.RoleGapRadar), { ssr: false })
import { getEmployeeSkillScores } from '@/actions/skill-actions'
import { getEmployeeRoleGapAnalysis } from '@/actions/role-actions'
import { useOrg } from '@/components/providers/OrgProvider'
import { canViewOwnSkillScores } from '@/lib/skill-authorization'
import type { SkillPriority } from '@/types/database'

interface SkillScore {
  skill_name: string
  skill_color: string
  score: number | null
  assessments_taken: number
}

interface RoleGap {
  roleName: string
  requirements: {
    skill_name: string
    skill_color: string
    target_score: number
    priority: SkillPriority
    actual_score: number | null
  }[]
}

/**
 * V19/V19.1: Dashboard widget showing the current user's skill radar chart
 * and role-based gap analysis.
 */
export function MySkillProfile() {
  const { org, role } = useOrg()
  const [scores, setScores] = useState<SkillScore[]>([])
  const [roleGaps, setRoleGaps] = useState<RoleGap[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  const skillsEnabled = org.settings?.features?.skills_mapping ?? false
  const skillsVisible = org.settings?.skills_visible_to_candidates ?? true
  const canView = canViewOwnSkillScores(role, skillsVisible)

  useEffect(() => {
    if (!skillsEnabled || !canView) {
      setLoading(false)
      return
    }

    Promise.all([
      getEmployeeSkillScores(),
      getEmployeeRoleGapAnalysis(),
    ]).then(([scoresResult, gapResult]) => {
      if (scoresResult.ok && scoresResult.data) {
        setScores(scoresResult.data)
      }
      if (gapResult.ok && gapResult.data) {
        setRoleGaps(
          gapResult.data.roles.map((r) => ({
            roleName: r.profile.name,
            requirements: r.requirements,
          }))
        )
      }
      setLoading(false)
    })
  }, [skillsEnabled, canView])

  if (!skillsEnabled || !canView) return null
  if (!loading && scores.length === 0 && roleGaps.length === 0) return null

  if (loading) {
    return (
      <Card variant="default" padding="md" className="mb-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded" />
      </Card>
    )
  }

  return (
    <Card variant="default" padding="md" className="mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Profil Skill Saya</h3>
      </div>

      {scores.length > 0 && (
        <EmployeeSkillRadar scores={scores} size={250} />
      )}

      {/* Role gap analysis */}
      {roleGaps.length > 0 && (
        <div className={scores.length > 0 ? 'mt-4 pt-4 border-t border-slate-100 dark:border-slate-700' : ''}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Role Gap Analysis
          </p>
          {roleGaps.map((gap) => (
            <div key={gap.roleName} className="mb-2">
              <button
                onClick={() => setExpandedRole(expandedRole === gap.roleName ? null : gap.roleName)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{gap.roleName}</span>
                <div className="flex items-center gap-2">
                  {/* Quick summary: how many skills meet target */}
                  {gap.requirements.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {gap.requirements.filter((r) => (r.actual_score ?? 0) >= r.target_score).length}/{gap.requirements.length} tercapai
                    </span>
                  )}
                  {expandedRole === gap.roleName
                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 text-slate-400" />
                  }
                </div>
              </button>
              {expandedRole === gap.roleName && (
                <div className="mt-2 px-2">
                  <RoleGapRadar
                    roleName={gap.roleName}
                    requirements={gap.requirements}
                    size={220}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
