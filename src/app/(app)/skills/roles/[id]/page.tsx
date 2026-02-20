'use client'

/**
 * V19.1: Role Profile Detail Page
 *
 * Shows skill requirements with target scores, assigned employees,
 * and gap analysis per employee.
 */

import { useState, useEffect, useTransition, use } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import { ArrowLeft, Plus, X, UserMinus, Target, ChevronDown } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getRoleProfileWithRequirements,
  setRoleSkillRequirements,
  getRoleProfileEmployees,
  getUnassignedMembers,
  assignEmployeeRole,
  unassignEmployeeRole,
} from '@/actions/role-actions'
import { getOrgSkillDomains, getEmployeeSkillScores } from '@/actions/skill-actions'
import { canManageRoleProfiles } from '@/lib/skill-authorization'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'

const RoleGapRadar = dynamic(() => import('@/components/skills/RoleGapRadar').then(m => m.RoleGapRadar), { ssr: false })
import type { SkillDomain, SkillPriority } from '@/types/database'

const PRIORITY_LABELS: Record<SkillPriority, string> = {
  required: 'Wajib',
  recommended: 'Disarankan',
  optional: 'Opsional',
}

const PRIORITY_COLORS: Record<SkillPriority, string> = {
  required: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recommended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  optional: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

interface SkillRequirementRow {
  skill_domain_id: string
  skill_name: string
  skill_color: string
  target_score: number
  priority: SkillPriority
}

interface EmployeeRow {
  userId: string
  email: string
  fullName: string | null
  assignedAt: string
}

export default function RoleProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  usePageTitle('Role Detail')
  const { role } = useOrg()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const canManage = canManageRoleProfiles(role)

  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [profileColor, setProfileColor] = useState('#6366f1')
  const [requirements, setRequirements] = useState<SkillRequirementRow[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [allDomains, setAllDomains] = useState<SkillDomain[]>([])

  // Add requirement form
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [newSkillId, setNewSkillId] = useState('')
  const [newTargetScore, setNewTargetScore] = useState(70)
  const [newPriority, setNewPriority] = useState<SkillPriority>('required')

  // Assign employee
  const [showAssign, setShowAssign] = useState(false)
  const [unassignedMembers, setUnassignedMembers] = useState<{ userId: string; email: string; fullName: string | null }[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')

  // Employee gap analysis
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [employeeGapData, setEmployeeGapData] = useState<{
    skill_name: string; skill_color: string; target_score: number; priority: SkillPriority; actual_score: number | null
  }[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [profileResult, employeesResult, domainsResult] = await Promise.all([
      getRoleProfileWithRequirements(id),
      getRoleProfileEmployees(id),
      getOrgSkillDomains(),
    ])

    if (profileResult.ok && profileResult.data) {
      setProfileName(profileResult.data.profile.name)
      setProfileColor(profileResult.data.profile.color)
      setRequirements(profileResult.data.requirements)
    }
    if (employeesResult.ok) setEmployees(employeesResult.data?.employees ?? [])
    if (domainsResult.ok) setAllDomains(domainsResult.data ?? [])
    setLoading(false)
  }

  const availableDomains = allDomains.filter(
    (d) => !requirements.some((r) => r.skill_domain_id === d.id)
  )

  function handleAddRequirement() {
    if (!newSkillId) return
    const domain = allDomains.find((d) => d.id === newSkillId)
    if (!domain) return

    const updated = [
      ...requirements,
      {
        skill_domain_id: domain.id,
        skill_name: domain.name,
        skill_color: domain.color,
        target_score: newTargetScore,
        priority: newPriority,
      },
    ]
    setRequirements(updated)
    setShowAddSkill(false)
    setNewSkillId('')
    setNewTargetScore(70)
    setNewPriority('required')
    saveRequirements(updated)
  }

  function handleRemoveRequirement(skillDomainId: string) {
    const updated = requirements.filter((r) => r.skill_domain_id !== skillDomainId)
    setRequirements(updated)
    saveRequirements(updated)
  }

  function handleUpdateTarget(skillDomainId: string, target: number) {
    const updated = requirements.map((r) =>
      r.skill_domain_id === skillDomainId ? { ...r, target_score: target } : r
    )
    setRequirements(updated)
    saveRequirements(updated)
  }

  function handleUpdatePriority(skillDomainId: string, priority: SkillPriority) {
    const updated = requirements.map((r) =>
      r.skill_domain_id === skillDomainId ? { ...r, priority } : r
    )
    setRequirements(updated)
    saveRequirements(updated)
  }

  function saveRequirements(reqs: SkillRequirementRow[]) {
    startTransition(async () => {
      const result = await setRoleSkillRequirements(
        id,
        reqs.map((r) => ({
          skill_domain_id: r.skill_domain_id,
          target_score: r.target_score,
          priority: r.priority,
        }))
      )
      if (!result.ok) showToast(result.error, 'error')
    })
  }

  async function handleShowAssign() {
    setShowAssign(true)
    const result = await getUnassignedMembers(id)
    if (result.ok) setUnassignedMembers(result.data ?? [])
  }

  function handleAssign() {
    if (!selectedMemberId) return
    startTransition(async () => {
      const result = await assignEmployeeRole(selectedMemberId, id)
      if (result.ok) {
        showToast('Karyawan ditambahkan ke role', 'success')
        setShowAssign(false)
        setSelectedMemberId('')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleUnassign(userId: string) {
    if (!confirm('Hapus karyawan dari role ini?')) return
    startTransition(async () => {
      const result = await unassignEmployeeRole(userId, id)
      if (result.ok) {
        showToast('Karyawan dihapus dari role', 'success')
        setSelectedEmployee(null)
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  async function handleSelectEmployee(userId: string) {
    setSelectedEmployee(userId)
    const scoresResult = await getEmployeeSkillScores(userId)
    if (scoresResult.ok) {
      const scoreMap = new Map(
        (scoresResult.data ?? []).map((s) => [s.skill_domain_id, s.score])
      )
      setEmployeeGapData(
        requirements.map((r) => ({
          skill_name: r.skill_name,
          skill_color: r.skill_color,
          target_score: r.target_score,
          priority: r.priority,
          actual_score: scoreMap.get(r.skill_domain_id) ?? null,
        }))
      )
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/skills')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: profileColor }} />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{profileName}</h1>
      </div>

      {/* Skill Requirements */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Skill Requirements
          </h2>
          {canManage && availableDomains.length > 0 && (
            <Button size="sm" onClick={() => setShowAddSkill(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Tambah Skill
            </Button>
          )}
        </div>

        {/* Add skill form */}
        {showAddSkill && (
          <div className="mb-4 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tambah Skill Requirement</h3>
              <button onClick={() => setShowAddSkill(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Skill Domain</label>
                <div className="relative">
                  <select
                    value={newSkillId}
                    onChange={(e) => setNewSkillId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm appearance-none"
                  >
                    <option value="">Pilih skill...</option>
                    {availableDomains.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newTargetScore}
                  onChange={(e) => setNewTargetScore(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Prioritas</label>
                <div className="relative">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as SkillPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm appearance-none"
                  >
                    <option value="required">Wajib</option>
                    <option value="recommended">Disarankan</option>
                    <option value="optional">Opsional</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleAddRequirement} disabled={!newSkillId || isPending}>
                Tambah
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddSkill(false)}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {/* Requirements table */}
        {requirements.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Belum ada skill requirement</p>
            {canManage && <p className="text-xs mt-1">Klik "Tambah Skill" untuk menentukan kompetensi yang dibutuhkan.</p>}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Skill</th>
                  <th className="text-center px-4 py-2 font-medium text-slate-600 dark:text-slate-400 w-24">Target</th>
                  <th className="text-center px-4 py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Prioritas</th>
                  {canManage && <th className="w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {requirements.map((r) => (
                  <tr key={r.skill_domain_id} className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.skill_color }} />
                        <span className="font-medium text-slate-900 dark:text-slate-100">{r.skill_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={r.target_score}
                          onChange={(e) => handleUpdateTarget(r.skill_domain_id, Number(e.target.value))}
                          className="w-16 text-center px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-transparent text-sm"
                        />
                      ) : (
                        <span className="font-semibold">{r.target_score}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canManage ? (
                        <select
                          value={r.priority}
                          onChange={(e) => handleUpdatePriority(r.skill_domain_id, e.target.value as SkillPriority)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-transparent"
                        >
                          <option value="required">Wajib</option>
                          <option value="recommended">Disarankan</option>
                          <option value="optional">Opsional</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_COLORS[r.priority]}`}>
                          {PRIORITY_LABELS[r.priority]}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-2 py-3">
                        <button
                          onClick={() => handleRemoveRequirement(r.skill_domain_id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Hapus requirement"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Assigned Employees */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Karyawan ({employees.length})
          </h2>
          {canManage && (
            <Button size="sm" onClick={handleShowAssign}>
              <Plus className="h-4 w-4 mr-1" />
              Assign Karyawan
            </Button>
          )}
        </div>

        {/* Assign form */}
        {showAssign && (
          <div className="mb-4 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Assign Karyawan ke Role</h3>
              <button onClick={() => setShowAssign(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            {unassignedMembers.length === 0 ? (
              <p className="text-sm text-slate-500">Semua member sudah di-assign ke role ini.</p>
            ) : (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <div className="relative">
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm appearance-none"
                    >
                      <option value="">Pilih karyawan...</option>
                      {unassignedMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.fullName || m.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <Button size="sm" onClick={handleAssign} disabled={!selectedMemberId || isPending}>
                  Assign
                </Button>
              </div>
            )}
          </div>
        )}

        {employees.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
            Belum ada karyawan yang di-assign ke role ini.
          </p>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => (
              <div
                key={emp.userId}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedEmployee === emp.userId
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
                onClick={() => handleSelectEmployee(emp.userId)}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {emp.fullName || emp.email}
                  </p>
                  {emp.fullName && (
                    <p className="text-xs text-slate-500">{emp.email}</p>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnassign(emp.userId) }}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="Hapus dari role"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gap Analysis Radar for selected employee */}
      {selectedEmployee && requirements.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Gap Analysis — {employees.find((e) => e.userId === selectedEmployee)?.fullName || employees.find((e) => e.userId === selectedEmployee)?.email}
          </h2>
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <RoleGapRadar
              roleName={profileName}
              requirements={employeeGapData}
            />
          </div>
        </section>
      )}
    </div>
  )
}
