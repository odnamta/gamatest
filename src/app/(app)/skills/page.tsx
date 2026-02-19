'use client'

/**
 * V19: Skills Management Page
 *
 * Admin: Create/edit/delete skill domains, view org-wide heatmap.
 * All members: View skill domains and their own scores.
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import { Plus, Target, X } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getOrgSkillDomains,
  createSkillDomain,
  updateSkillDomain,
  deleteSkillDomain,
  getOrgSkillHeatmap,
} from '@/actions/skill-actions'
import { canManageSkillDomains } from '@/lib/skill-authorization'
import { hasMinimumRole } from '@/lib/org-authorization'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { SkillDomainCard } from '@/components/skills/SkillDomainCard'
import { SkillHeatmap } from '@/components/skills/SkillHeatmap'
import type { SkillDomain } from '@/types/database'

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
]

interface SkillFormState {
  name: string
  description: string
  color: string
}

export default function SkillsPage() {
  usePageTitle('Skills')
  const { org, role } = useOrg()
  const router = useRouter()
  const [domains, setDomains] = useState<SkillDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const isAdmin = hasMinimumRole(role, 'admin')
  const canManage = canManageSkillDomains(role)

  // Heatmap state (admin only)
  const [heatmapData, setHeatmapData] = useState<{
    domains: { id: string; name: string; color: string }[]
    employees: { userId: string; email: string; scores: Record<string, number | null> }[]
  } | null>(null)

  // Create/Edit form state
  const [showForm, setShowForm] = useState(false)
  const [editingDomain, setEditingDomain] = useState<SkillDomain | null>(null)
  const [form, setForm] = useState<SkillFormState>({ name: '', description: '', color: '#6366f1' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [domainsResult, heatmapResult] = await Promise.all([
      getOrgSkillDomains(),
      isAdmin ? getOrgSkillHeatmap() : Promise.resolve(null),
    ])

    if (domainsResult.ok) setDomains(domainsResult.data ?? [])
    if (heatmapResult && 'ok' in heatmapResult && heatmapResult.ok) {
      setHeatmapData(heatmapResult.data ?? null)
    }
    setLoading(false)
  }

  function openCreateForm() {
    setEditingDomain(null)
    setForm({ name: '', description: '', color: PRESET_COLORS[domains.length % PRESET_COLORS.length] })
    setShowForm(true)
  }

  function openEditForm(domain: SkillDomain) {
    setEditingDomain(domain)
    setForm({
      name: domain.name,
      description: domain.description || '',
      color: domain.color,
    })
    setShowForm(true)
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      showToast('Skill name is required', 'error')
      return
    }

    startTransition(async () => {
      if (editingDomain) {
        const result = await updateSkillDomain(editingDomain.id, {
          name: form.name,
          description: form.description,
          color: form.color,
        })
        if (result.ok) {
          showToast('Skill domain updated', 'success')
          setShowForm(false)
          await loadData()
        } else {
          showToast(result.error, 'error')
        }
      } else {
        const result = await createSkillDomain({
          name: form.name,
          description: form.description || undefined,
          color: form.color,
        })
        if (result.ok) {
          showToast('Skill domain created', 'success')
          setShowForm(false)
          await loadData()
        } else {
          showToast(result.error, 'error')
        }
      }
    })
  }

  function handleDelete(domain: SkillDomain) {
    if (!confirm(`Delete "${domain.name}"? This will remove all associated scores.`)) return
    startTransition(async () => {
      const result = await deleteSkillDomain(domain.id)
      if (result.ok) {
        showToast('Skill domain deleted', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  // Compute average scores per domain from heatmap data
  function getAvgScore(domainId: string): number | null {
    if (!heatmapData) return null
    const scores = heatmapData.employees
      .map((e) => e.scores[domainId])
      .filter((s): s is number => s !== null && s !== undefined)
    if (scores.length === 0) return null
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }

  function getEmployeeCount(domainId: string): number {
    if (!heatmapData) return 0
    return heatmapData.employees.filter(
      (e) => e.scores[domainId] !== null && e.scores[domainId] !== undefined
    ).length
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Skills</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{org.name}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Skill Domain
          </Button>
        )}
      </div>

      {/* Create/Edit Form Inline */}
      {showForm && (
        <div className="mb-6 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {editingDomain ? 'Edit Skill Domain' : 'New Skill Domain'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Heavy Equipment Safety"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this skill area"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {editingDomain ? 'Save Changes' : 'Create'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Domains Grid */}
      {domains.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No skill domains yet</p>
          {canManage && (
            <p className="mt-1">Create your first skill domain to start mapping employee competencies.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {domains.map((domain) => (
            <SkillDomainCard
              key={domain.id}
              domain={domain}
              avgScore={getAvgScore(domain.id)}
              employeeCount={getEmployeeCount(domain.id)}
              canManage={canManage}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onClick={(d) => router.push(`/skills/${d.id}`)}
            />
          ))}
        </div>
      )}

      {/* Heatmap (Admin only) */}
      {isAdmin && heatmapData && heatmapData.employees.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Employee Skill Heatmap
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <SkillHeatmap
              domains={heatmapData.domains}
              employees={heatmapData.employees}
            />
          </div>
        </div>
      )}
    </div>
  )
}
