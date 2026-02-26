'use client'

/**
 * V19/V19.1: Skills Management Page
 *
 * Admin: Create/edit/delete skill domains and role profiles, view org-wide heatmap.
 * All members: View skill domains, role profiles, and their own scores.
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import { Plus, Target, Users, X } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getOrgSkillDomains,
  createSkillDomain,
  updateSkillDomain,
  deleteSkillDomain,
  getOrgSkillHeatmap,
} from '@/actions/skill-actions'
import {
  getOrgRoleProfiles,
  createRoleProfile,
  updateRoleProfile,
  deleteRoleProfile,
} from '@/actions/role-actions'
import { canManageSkillDomains, canManageRoleProfiles } from '@/lib/skill-authorization'
import { hasMinimumRole } from '@/lib/org-authorization'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkillDomainCard } from '@/components/skills/SkillDomainCard'
import { RoleProfileCard } from '@/components/skills/RoleProfileCard'
import { SkillHeatmap } from '@/components/skills/SkillHeatmap'
import type { SkillDomain, RoleProfile } from '@/types/database'

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
  const canManageRoles = canManageRoleProfiles(role)

  // Tab state
  const [activeTab, setActiveTab] = useState<'domains' | 'roles'>('domains')

  // Role profiles state
  const [roleProfiles, setRoleProfiles] = useState<RoleProfile[]>([])

  // Heatmap state (admin only)
  const [heatmapData, setHeatmapData] = useState<{
    domains: { id: string; name: string; color: string }[]
    employees: { userId: string; email: string; scores: Record<string, number | null> }[]
  } | null>(null)

  // Create/Edit form state (shared for domains and roles)
  const [showForm, setShowForm] = useState(false)
  const [editingDomain, setEditingDomain] = useState<SkillDomain | null>(null)
  const [editingRole, setEditingRole] = useState<RoleProfile | null>(null)
  const [form, setForm] = useState<SkillFormState>({ name: '', description: '', color: '#6366f1' })

  async function loadData() {
    setLoading(true)
    const [domainsResult, rolesResult, heatmapResult] = await Promise.all([
      getOrgSkillDomains(),
      getOrgRoleProfiles(),
      isAdmin ? getOrgSkillHeatmap() : Promise.resolve(null),
    ])

    if (domainsResult.ok) setDomains(domainsResult.data ?? [])
    if (rolesResult.ok) setRoleProfiles(rolesResult.data ?? [])
    if (heatmapResult && 'ok' in heatmapResult && heatmapResult.ok) {
      setHeatmapData(heatmapResult.data ?? null)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData()
  }, [])

  // --- Skill Domain handlers ---
  function openCreateForm() {
    setEditingDomain(null)
    setEditingRole(null)
    setForm({ name: '', description: '', color: PRESET_COLORS[domains.length % PRESET_COLORS.length] })
    setShowForm(true)
  }

  function openEditForm(domain: SkillDomain) {
    setEditingDomain(domain)
    setEditingRole(null)
    setForm({
      name: domain.name,
      description: domain.description || '',
      color: domain.color,
    })
    setShowForm(true)
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

  // --- Role Profile handlers ---
  function openCreateRoleForm() {
    setEditingRole(null)
    setEditingDomain(null)
    setForm({ name: '', description: '', color: PRESET_COLORS[roleProfiles.length % PRESET_COLORS.length] })
    setShowForm(true)
  }

  function openEditRoleForm(profile: RoleProfile) {
    setEditingRole(profile)
    setEditingDomain(null)
    setForm({
      name: profile.name,
      description: profile.description || '',
      color: profile.color,
    })
    setShowForm(true)
  }

  function handleDeleteRole(profile: RoleProfile) {
    if (!confirm(`Delete "${profile.name}"? This will remove all skill requirements and assignments.`)) return
    startTransition(async () => {
      const result = await deleteRoleProfile(profile.id)
      if (result.ok) {
        showToast('Role profile deleted', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  // --- Shared form submit ---
  function handleSubmit() {
    if (!form.name.trim()) {
      showToast('Name is required', 'error')
      return
    }

    startTransition(async () => {
      if (activeTab === 'roles' || editingRole) {
        // Role profile create/edit
        if (editingRole) {
          const result = await updateRoleProfile(editingRole.id, {
            name: form.name,
            description: form.description,
            color: form.color,
          })
          if (result.ok) {
            showToast('Role profile updated', 'success')
            setShowForm(false)
            await loadData()
          } else {
            showToast(result.error, 'error')
          }
        } else {
          const result = await createRoleProfile({
            name: form.name,
            description: form.description || undefined,
            color: form.color,
          })
          if (result.ok) {
            showToast('Role profile created', 'success')
            setShowForm(false)
            await loadData()
          } else {
            showToast(result.error, 'error')
          }
        }
      } else {
        // Skill domain create/edit
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

  const formTitle = editingDomain
    ? 'Edit Skill Domain'
    : editingRole
      ? 'Edit Role Profile'
      : activeTab === 'roles'
        ? 'New Role Profile'
        : 'New Skill Domain'

  const formPlaceholder = activeTab === 'roles'
    ? 'e.g., Operator Forklift'
    : 'e.g., Keselamatan Kerja'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Skills</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{org.name}</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={activeTab === 'roles' ? openCreateRoleForm : openCreateForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'roles' ? 'Add Role Profile' : 'Add Skill Domain'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => { setActiveTab('domains'); setShowForm(false) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'domains'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Target className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Skill Domains ({domains.length})
        </button>
        <button
          onClick={() => { setActiveTab('roles'); setShowForm(false) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Role Profiles ({roleProfiles.length})
        </button>
      </div>

      {/* Create/Edit Form Inline (shared for domains and roles) */}
      {showForm && (
        <div className="mb-6 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{formTitle}</h3>
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
                placeholder={formPlaceholder}
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
                placeholder={activeTab === 'roles' ? 'Brief description of this role' : 'Brief description of this skill area'}
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
                {(editingDomain || editingRole) ? 'Simpan Perubahan' : 'Buat'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Domains Tab */}
      {activeTab === 'domains' && (
        <>
          {domains.length === 0 ? (
            <EmptyState
              icon={<Target className="h-12 w-12" />}
              title="Belum ada domain keahlian"
              description={canManage
                ? "Buat domain keahlian pertama untuk memetakan kompetensi tim"
                : "Belum ada domain keahlian yang tersedia saat ini"
              }
              action={canManage ? (
                <Button size="sm" onClick={openCreateForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Domain Keahlian
                </Button>
              ) : undefined}
            />
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
                Peta Keahlian Karyawan
              </h2>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <SkillHeatmap
                  domains={heatmapData.domains}
                  employees={heatmapData.employees}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Role Profiles Tab */}
      {activeTab === 'roles' && (
        <>
          {roleProfiles.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="Belum ada role profile"
              description={canManageRoles
                ? "Buat role profile untuk menentukan kebutuhan kompetensi per posisi"
                : "Belum ada role profile yang tersedia saat ini"
              }
              action={canManageRoles ? (
                <Button size="sm" onClick={openCreateRoleForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Role Profile
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roleProfiles.map((profile) => (
                <RoleProfileCard
                  key={profile.id}
                  profile={profile}
                  skillCount={(profile as RoleProfile & { skill_count?: number }).skill_count ?? 0}
                  employeeCount={(profile as RoleProfile & { employee_count?: number }).employee_count ?? 0}
                  canManage={canManageRoles}
                  onEdit={openEditRoleForm}
                  onDelete={handleDeleteRole}
                  onClick={(p) => router.push(`/skills/roles/${p.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
