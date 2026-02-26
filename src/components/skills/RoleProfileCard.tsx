'use client'

import { memo } from 'react'
import { Pencil, Trash2, Users, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { RoleProfile } from '@/types/database'

interface RoleProfileCardProps {
  profile: RoleProfile
  employeeCount?: number
  skillCount?: number
  canManage: boolean
  onEdit?: (profile: RoleProfile) => void
  onDelete?: (profile: RoleProfile) => void
  onClick?: (profile: RoleProfile) => void
}

export const RoleProfileCard = memo(function RoleProfileCard({
  profile,
  employeeCount = 0,
  skillCount = 0,
  canManage,
  onEdit,
  onDelete,
  onClick,
}: RoleProfileCardProps) {
  return (
    <div
      className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(profile)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(profile) }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: profile.color }}
            />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {profile.name}
            </h3>
          </div>
          {profile.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
              {profile.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" />
              {skillCount} skill{skillCount !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {employeeCount} assigned
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onEdit?.(profile) }}
              title="Edit role profile"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onDelete?.(profile) }}
              title="Delete role profile"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
})
