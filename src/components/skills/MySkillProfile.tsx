'use client'

import { useState, useEffect } from 'react'
import { Target } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmployeeSkillRadar } from './EmployeeSkillRadar'
import { getEmployeeSkillScores } from '@/actions/skill-actions'
import { useOrg } from '@/components/providers/OrgProvider'
import { canViewOwnSkillScores } from '@/lib/skill-authorization'

interface SkillScore {
  skill_name: string
  skill_color: string
  score: number | null
  assessments_taken: number
}

/**
 * V19: Dashboard widget showing the current user's skill radar chart.
 * Only renders if the org has skills_mapping enabled and the user can view their scores.
 */
export function MySkillProfile() {
  const { org, role } = useOrg()
  const [scores, setScores] = useState<SkillScore[]>([])
  const [loading, setLoading] = useState(true)

  const skillsEnabled = org.settings?.features?.skills_mapping ?? false
  const skillsVisible = org.settings?.skills_visible_to_candidates ?? true
  const canView = canViewOwnSkillScores(role, skillsVisible)

  useEffect(() => {
    if (!skillsEnabled || !canView) {
      setLoading(false)
      return
    }

    getEmployeeSkillScores().then((result) => {
      if (result.ok && result.data) {
        setScores(result.data)
      }
      setLoading(false)
    })
  }, [skillsEnabled, canView])

  // Don't render if skills not enabled or user can't view
  if (!skillsEnabled || !canView) return null

  // Don't render if no scores yet (after loading)
  if (!loading && scores.length === 0) return null

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
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">My Skills</h3>
      </div>
      <EmployeeSkillRadar scores={scores} size={250} />
    </Card>
  )
}
