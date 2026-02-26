'use client'

/**
 * V13: Organization Switcher
 *
 * Dropdown in the header showing current org and allowing switching.
 * Uses shadcn/ui DropdownMenu.
 */

import { useState, useEffect } from 'react'
import { Building2, ChevronDown, Plus, Settings, Users } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { getMyOrganizations, switchOrganization } from '@/actions/org-actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import type { Organization, OrgRole } from '@/types/database'

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  creator: 'Creator',
  candidate: 'Candidate',
}

export function OrgSwitcher() {
  const { org, role, isSwitching } = useOrg()
  const [orgs, setOrgs] = useState<Array<Organization & { role: OrgRole }>>([])
  const [loaded, setLoaded] = useState(false)

  // Fetch orgs on first open
  async function loadOrgs() {
    if (loaded) return
    const result = await getMyOrganizations()
    if (result.ok) {
      setOrgs(result.data ?? [])
    }
    setLoaded(true)
  }

  async function handleSwitch(orgId: string) {
    if (orgId === org.id) return
    const result = await switchOrganization(orgId)
    if (result.ok) {
      window.location.reload()
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) loadOrgs() }}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Switch organization"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          disabled={isSwitching}
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[150px] truncate">{org.name}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* Current org header */}
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{org.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
        </div>
        <DropdownMenuSeparator />

        {/* Other orgs */}
        {orgs
          .filter((o) => o.id !== org.id)
          .map((o) => (
            <DropdownMenuItem
              key={o.id}
              onClick={() => handleSwitch(o.id)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{o.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-2">
                  {ROLE_LABELS[o.role]}
                </Badge>
              </div>
            </DropdownMenuItem>
          ))}

        <DropdownMenuSeparator />

        {/* Org management links */}
        {(role === 'owner' || role === 'admin') && (
          <>
            <DropdownMenuItem asChild>
              <a href={`/orgs/${org.slug}/settings`} className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Pengaturan
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/orgs/${org.slug}/members`} className="cursor-pointer">
                <Users className="h-4 w-4 mr-2" />
                Anggota
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <a href="/orgs/create" className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Buat organisasi baru
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
