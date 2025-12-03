'use client'

import { useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { autoFormatTags } from '@/actions/admin-tag-actions'
import { useToast } from '@/components/ui/Toast'

/**
 * V9.5: AutoFormatButton - Bulk format tags to Title Case
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */
interface AutoFormatButtonProps {
  onComplete?: () => void
  className?: string
}

export function AutoFormatButton({ onComplete, className = '' }: AutoFormatButtonProps) {
  const { showToast } = useToast()
  const [isFormatting, setIsFormatting] = useState(false)

  async function handleAutoFormat() {
    setIsFormatting(true)
    try {
      const result = await autoFormatTags()

      if (result.ok) {
        if (result.updated === 0 && result.skipped.length === 0) {
          showToast('All tags are already formatted', 'info')
        } else {
          let message = `Formatted ${result.updated} tag${result.updated !== 1 ? 's' : ''}`
          if (result.skipped.length > 0) {
            message += `, skipped ${result.skipped.length} (collisions)`
          }
          showToast(message, 'success')
        }
        onComplete?.()
      } else {
        showToast(result.error, 'error')
      }
    } catch {
      showToast('Failed to auto-format tags', 'error')
    } finally {
      setIsFormatting(false)
    }
  }

  return (
    <button
      onClick={handleAutoFormat}
      disabled={isFormatting}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isFormatting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wand2 className="w-4 h-4" />
      )}
      Auto-Format Tags
    </button>
  )
}
