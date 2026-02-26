'use client'

import { memo } from 'react'
import { Pencil, Trash2, LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SkillDomain } from '@/types/database'

interface SkillDomainCardProps {
  domain: SkillDomain
  avgScore?: number | null
  deckCount?: number
  employeeCount?: number
  canManage: boolean
  onEdit?: (domain: SkillDomain) => void
  onDelete?: (domain: SkillDomain) => void
  onClick?: (domain: SkillDomain) => void
}

export const SkillDomainCard = memo(function SkillDomainCard({
  domain,
  avgScore,
  deckCount = 0,
  employeeCount = 0,
  canManage,
  onEdit,
  onDelete,
  onClick,
}: SkillDomainCardProps) {
  return (
    <div
      className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(domain)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(domain) }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: domain.color }}
            />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {domain.name}
            </h3>
          </div>
          {domain.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
              {domain.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              {deckCount} deck{deckCount !== 1 ? 's' : ''}
            </span>
            <span>{employeeCount} employee{employeeCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {avgScore !== null && avgScore !== undefined ? (
            <div className="text-right">
              <div className={`text-lg font-bold ${
                avgScore >= 70 ? 'text-green-600' : avgScore >= 40 ? 'text-amber-600' : 'text-red-500'
              }`}>
                {avgScore.toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-400">avg score</div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">—</div>
          )}

          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onEdit?.(domain) }}
                title="Edit skill domain"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onDelete?.(domain) }}
                title="Delete skill domain"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
