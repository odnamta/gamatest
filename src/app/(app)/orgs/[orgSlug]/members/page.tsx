'use client'

/**
 * V13: Organization Member Management Page
 *
 * Lists members, allows role changes and removal.
 * Admin+ only.
 */

import { useState, useEffect, useTransition } from 'react'
import { Shield, UserMinus, Crown, Mail, Send, X, Copy, Check } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { getOrgMembers, updateMemberRole, removeMember, getOrgMemberActivity } from '@/actions/org-actions'
import { inviteMember, getOrgInvitations, revokeInvitation } from '@/actions/invitation-actions'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OrganizationMemberWithProfile, OrgRole, Invitation } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  creator: 'Creator',
  candidate: 'Candidate',
}

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  creator: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  candidate: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
}

export default function OrgMembersPage() {
  usePageTitle('Anggota')
  const { org, role } = useOrg()
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<OrganizationMemberWithProfile | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('candidate')
  const [inviting, setInviting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedJoinLink, setCopiedJoinLink] = useState(false)
  const [activity, setActivity] = useState<Record<string, { completedSessions: number; lastActive: string | null }>>({})

  async function loadData() {
    setLoading(true)
    const [mResult, iResult, aResult] = await Promise.all([
      getOrgMembers(),
      getOrgInvitations(),
      getOrgMemberActivity(),
    ])
    if (mResult.ok) setMembers(mResult.data ?? [])
    if (iResult.ok) setInvitations(iResult.data ?? [])
    if (aResult.ok && aResult.data) setActivity(aResult.data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData()
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviting(true)

    const result = await inviteMember(inviteEmail, inviteRole)
    if (result.ok) {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('candidate')
      await loadData()
    } else if (!result.ok) {
      setError(result.error)
    }
    setInviting(false)
  }

  async function handleRevokeInvitation(invitationId: string) {
    setError(null)
    startTransition(async () => {
      const result = await revokeInvitation(invitationId)
      if (result.ok) {
        await loadData()
      } else if (!result.ok) {
        setError(result.error)
      }
    })
  }

  async function handleCopyInviteLink(inv: Invitation) {
    const url = `${window.location.origin}/invite/${inv.token}`
    await navigator.clipboard.writeText(url)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Only admins and owners can manage members.</p>
      </div>
    )
  }

  function handleRoleChange(memberId: string, newRole: OrgRole) {
    setError(null)
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole)
      if (result.ok) {
        await loadData()
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove(member: OrganizationMemberWithProfile) {
    setConfirmRemove(member)
  }

  function confirmRemoveMember() {
    if (!confirmRemove) return
    setError(null)
    startTransition(async () => {
      const result = await removeMember(confirmRemove.id)
      if (result.ok) {
        setConfirmRemove(null)
        await loadData()
      } else {
        setError(result.error)
        setConfirmRemove(null)
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: org.name, href: `/orgs/${org.slug}/settings` },
        { label: 'Anggota' },
      ]} />

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Anggota</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{org.name}</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-600 dark:text-green-400 mb-4" role="status">
          {success}
        </p>
      )}

      {/* Invite Member Form */}
      <form onSubmit={handleInvite} className="mb-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Invite Member
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Email"
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="w-[130px]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="candidate">Candidate</option>
              <option value="creator">Creator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" size="sm" loading={inviting} disabled={inviting || !inviteEmail}>
            <Send className="h-4 w-4 mr-1" />
            Invite
          </Button>
        </div>
      </form>

      {/* Public Join Link */}
      <div className="mb-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Public Join Link
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Share this link to let candidates join your organization directly.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/join/${org.slug}` : `/join/${org.slug}`}
          </code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(`${window.location.origin}/join/${org.slug}`)
              setCopiedJoinLink(true)
              setTimeout(() => setCopiedJoinLink(false), 2000)
            }}
          >
            {copiedJoinLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-500">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ROLE_COLORS[inv.role as OrgRole]}>
                    {ROLE_LABELS[inv.role as OrgRole]}
                  </Badge>
                  <button
                    onClick={() => handleCopyInviteLink(inv)}
                    className="p-1 rounded text-slate-400 hover:text-blue-500 transition-colors"
                    title="Copy invite link"
                  >
                    {copiedId === inv.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
                    title="Revoke invitation"
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Separator className="mt-6" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Memuat anggota...</div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  {member.role === 'owner' ? (
                    <Crown className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Shield className="h-4 w-4 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {member.full_name || member.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {member.full_name ? member.email : `Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                  </p>
                  {(() => {
                    const a = activity[member.user_id]
                    if (!a) return null
                    return (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {a.completedSessions} exam{a.completedSessions !== 1 ? 's' : ''} completed
                        {a.lastActive && <> &middot; Last active {new Date(a.lastActive).toLocaleDateString()}</>}
                      </p>
                    )
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {role === 'owner' ? (
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(member.id, value as OrgRole)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="creator">Creator</SelectItem>
                      <SelectItem value="candidate">Candidate</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={ROLE_COLORS[member.role as OrgRole]}>
                    {ROLE_LABELS[member.role as OrgRole]}
                  </Badge>
                )}

                <button
                  onClick={() => handleRemove(member)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  title="Remove member"
                  disabled={isPending}
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-8" />

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {members.length} member{members.length !== 1 ? 's' : ''} in this organization.
      </p>

      {/* Confirm Remove Dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Anggota</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus anggota ini dari {org.name}? Mereka akan kehilangan akses ke seluruh konten organisasi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmRemoveMember} loading={isPending}>
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
