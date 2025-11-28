'use client'

import { FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SourceBarProps {
  fileName: string
  fileUrl?: string
  onChangeClick: () => void
}

/**
 * SourceBar Component
 * Compact display for linked PDF source with change option.
 * 
 * Requirements: 4.1
 * - Shows file icon, filename in green, and "Change/Replace PDF" button
 */
export function SourceBar({ fileName, fileUrl, onChangeClick }: SourceBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-medium truncate hover:text-green-800 dark:hover:text-green-300 transition-colors"
          >
            <span className="truncate">{fileName}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <span className="text-green-700 dark:text-green-400 font-medium truncate">
            {fileName}
          </span>
        )}
      </div>
      
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onChangeClick}
        className="flex-shrink-0"
      >
        Change/Replace PDF
      </Button>
    </div>
  )
}
