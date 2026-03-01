'use client'

/**
 * V13: Organization Settings Page
 *
 * Allows admins/owners to configure org name, feature flags, and branding.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Shield, AlertTriangle, Trash2, ArrowRightLeft } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { updateOrgSettings, transferOwnership, deleteOrganization, getOrgMembers } from '@/actions/org-actions'
import type { OrganizationMemberWithProfile } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { OrgFeatures, OrgBranding, AssessmentDefaults } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

const FEATURE_LABELS: Record<keyof OrgFeatures, { label: string; description: string }> = {
  study_mode: { label: 'Study Mode', description: 'Spaced repetition and self-paced learning' },
  assessment_mode: { label: 'Assessment Mode', description: 'Timed exams with scoring and certification' },
  skills_mapping: { label: 'Skills Mapping', description: 'Track employee competencies across skill domains' },
  proctoring: { label: 'Proctoring', description: 'Anti-cheat monitoring during assessments' },
  certification: { label: 'Certification', description: 'Generate certificates upon completion' },
  ai_generation: { label: 'AI Content Generation', description: 'Auto-generate questions from documents' },
  pdf_extraction: { label: 'PDF Extraction', description: 'Extract questions from uploaded PDFs' },
  flashcards: { label: 'Flashcards', description: 'Traditional flashcard study mode' },
  erp_integration: { label: 'ERP Integration', description: 'Connect with external HR/ERP systems' },
}

export default function OrgSettingsPage() {
  usePageTitle('Pengaturan Organisasi')
  const { org, role } = useOrg()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(org.name)
  const [features, setFeatures] = useState<OrgFeatures>(
    org.settings?.features ?? {
      study_mode: false,
      assessment_mode: true,
      skills_mapping: true,
      proctoring: false,
      certification: false,
      ai_generation: true,
      pdf_extraction: true,
      flashcards: false,
      erp_integration: false,
    }
  )
  const [branding, setBranding] = useState<OrgBranding>(
    org.settings?.branding ?? { primary_color: '#3b82f6', logo_url: '' }
  )
  const [assessmentDefaults, setAssessmentDefaults] = useState<AssessmentDefaults>(
    org.settings?.assessment_defaults ?? {
      time_limit_minutes: 60,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: false,
      show_results: true,
      allow_review: true,
    }
  )
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Only admins and owners can access organization settings.</p>
      </div>
    )
  }

  function toggleFeature(key: keyof OrgFeatures) {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateOrgSettings(org.id, {
        name: name.trim() || org.name,
        settings: { features, branding, assessment_defaults: assessmentDefaults },
      })
      if (result.ok) {
        setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan' })
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pengaturan Organisasi</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{org.slug}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-2 mb-6">
        <Button size="sm" variant="secondary" onClick={() => router.push(`/orgs/${org.slug}/audit`)}>
          <Shield className="h-4 w-4 mr-2" />
          Audit Log
        </Button>
        <Button size="sm" variant="secondary" onClick={() => router.push(`/orgs/${org.slug}/analytics`)}>
          Analytics
        </Button>
      </div>

      {/* Name */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">General</h2>
        <div className="space-y-1">
          <Label htmlFor="org-name">Organization name</Label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
        </div>
      </section>

      <Separator className="mb-8" />

      {/* Feature Flags */}
      <section className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Features</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Enable or disable platform capabilities for your organization.
        </p>
        <div className="space-y-4">
          {(Object.entries(FEATURE_LABELS) as [keyof OrgFeatures, { label: string; description: string }][]).map(
            ([key, { label, description }]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={key} className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <Switch
                  id={key}
                  checked={features[key]}
                  onCheckedChange={() => toggleFeature(key)}
                />
              </div>
            )
          )}
        </div>
      </section>

      {/* Branding */}
      <Separator className="mb-8" />
      <section className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Customize your organization&apos;s appearance on certificates and public pages.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                id="primary-color"
                type="color"
                value={branding.primary_color || '#3b82f6'}
                onChange={(e) => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                className="h-10 w-14 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                value={branding.primary_color || '#3b82f6'}
                onChange={(e) => setBranding(b => ({ ...b, primary_color: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={7}
                placeholder="#3b82f6"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="logo-url">Logo URL</Label>
            <input
              id="logo-url"
              type="url"
              value={branding.logo_url || ''}
              onChange={(e) => setBranding(b => ({ ...b, logo_url: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>
        {(branding.logo_url || branding.primary_color) && (
          <div className="mt-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Preview</p>
            <div className="flex items-center gap-3">
              {branding.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logo_url}
                  alt="Preview logo organisasi"
                  className="h-10 w-10 rounded object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <span
                className="text-lg font-bold"
                style={{ color: branding.primary_color || '#3b82f6' }}
              >
                {name || org.name}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Assessment Defaults */}
      {features.assessment_mode && (
        <>
          <Separator className="mb-8" />
          <section className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assessment Defaults</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Default values when creating new assessments. Creators can override per assessment.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="default-time">Time Limit (minutes)</Label>
                <input
                  id="default-time"
                  type="number"
                  value={assessmentDefaults.time_limit_minutes}
                  onChange={(e) =>
                    setAssessmentDefaults((d) => ({ ...d, time_limit_minutes: Number(e.target.value) || 60 }))
                  }
                  min={1}
                  max={480}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="default-pass">Pass Score (%)</Label>
                <input
                  id="default-pass"
                  type="number"
                  value={assessmentDefaults.pass_score}
                  onChange={(e) =>
                    setAssessmentDefaults((d) => ({ ...d, pass_score: Number(e.target.value) || 70 }))
                  }
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-shuffle-q" className="text-sm font-medium">Shuffle Questions</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Randomize question order</p>
                </div>
                <Switch
                  id="default-shuffle-q"
                  checked={assessmentDefaults.shuffle_questions}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, shuffle_questions: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-shuffle-o" className="text-sm font-medium">Shuffle Options</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Randomize answer option order</p>
                </div>
                <Switch
                  id="default-shuffle-o"
                  checked={assessmentDefaults.shuffle_options}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, shuffle_options: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-results" className="text-sm font-medium">Show Results</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Show score and results to candidates</p>
                </div>
                <Switch
                  id="default-results"
                  checked={assessmentDefaults.show_results}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, show_results: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="default-review" className="text-sm font-medium">Allow Review</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Allow candidates to review answers</p>
                </div>
                <Switch
                  id="default-review"
                  checked={assessmentDefaults.allow_review}
                  onCheckedChange={(v) => setAssessmentDefaults((d) => ({ ...d, allow_review: v }))}
                />
              </div>
            </div>
          </section>
        </>
      )}

      {/* Save */}
      {message && (
        <p className={`text-sm mb-4 ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}

      <Button onClick={handleSave} loading={isPending}>
        <Save className="h-4 w-4 mr-2" />
        Simpan Pengaturan
      </Button>

      {/* Danger Zone — Owner only */}
      {role === 'owner' && (
        <>
          <Separator className="my-8" />
          <DangerZone orgId={org.id} orgName={org.name} />
        </>
      )}
    </div>
  )
}

function DangerZone({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([])
  const [transferTarget, setTransferTarget] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  function loadMembers() {
    if (members.length > 0) return
    startTransition(async () => {
      const result = await getOrgMembers()
      if (result.ok && result.data) {
        setMembers(result.data.filter(m => m.role !== 'owner'))
      }
    })
  }

  function handleTransfer() {
    if (!transferTarget) return
    setMessage(null)
    startTransition(async () => {
      const result = await transferOwnership(transferTarget)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Kepemilikan berhasil ditransfer. Anda sekarang menjadi admin.' })
        setShowTransfer(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (deleteConfirm !== orgName) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteOrganization()
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
      } else {
        router.push('/orgs/create')
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        Danger Zone
      </h2>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}

      {/* Transfer Ownership */}
      <div className="p-4 rounded-xl border border-red-200 dark:border-red-800/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">Transfer Kepemilikan</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Serahkan kepemilikan ke anggota lain. Anda akan menjadi admin.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setShowTransfer(!showTransfer); loadMembers() }}
          >
            <ArrowRightLeft className="h-4 w-4 mr-1" />
            Transfer
          </Button>
        </div>
        {showTransfer && (
          <div className="mt-4 space-y-3">
            <select
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih anggota...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.email || m.user_id} ({m.role})
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleTransfer} loading={isPending} disabled={!transferTarget}>
              Konfirmasi Transfer
            </Button>
          </div>
        )}
      </div>

      {/* Delete Organization */}
      <div className="p-4 rounded-xl border border-red-200 dark:border-red-800/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">Hapus Organisasi</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Hapus organisasi ini beserta seluruh datanya secara permanen. Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDelete(!showDelete)}
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
        {showDelete && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Type <strong>{orgName}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={orgName}
            />
            <Button
              size="sm"
              onClick={handleDelete}
              loading={isPending}
              disabled={deleteConfirm !== orgName}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Hapus Organisasi Permanen
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
