'use client'

import Link from 'next/link'
import { Tags } from 'lucide-react'

interface ManageTagsButtonProps {
  isAuthor: boolean
}

/**
 * Permission-gated link to Tag Manager
 * Only renders for deck authors
 * V9.4: Requirements 4.1-4.5, 5.1-5.2
 */
export function ManageTagsButton({ isAuthor }: ManageTagsButtonProps) {
  if (!isAuthor) return null
  
  return (
    <Link
      href="/admin/tags"
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
    >
      <Tags className="w-4 h-4" />
      Manage Tags
    </Link>
  )
}
