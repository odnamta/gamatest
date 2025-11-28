'use client'

import { Button } from '@/components/ui/Button'
import { ArrowDown } from 'lucide-react'

/**
 * Target fields for text selection copy
 */
export type TargetField = 'stem' | 'optionA' | 'optionB' | 'optionC' | 'explanation'

/**
 * Field sequence for auto-focus navigation
 */
export const FIELD_SEQUENCE: TargetField[] = ['stem', 'optionA', 'optionB', 'optionC', 'explanation']

/**
 * Gets the next field in the sequence for auto-focus.
 * Returns null if already at the last field.
 * 
 * Requirements: 5.3
 */
export function getNextField(currentField: TargetField): TargetField | null {
  const currentIndex = FIELD_SEQUENCE.indexOf(currentField)
  if (currentIndex === -1 || currentIndex >= FIELD_SEQUENCE.length - 1) {
    return null
  }
  return FIELD_SEQUENCE[currentIndex + 1]
}

/**
 * Gets selected text from a textarea element.
 * 
 * Requirements: 5.2
 */
export function getSelectedText(textarea: HTMLTextAreaElement): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  if (start === end) {
    return ''
  }
  
  return textarea.value.substring(start, end)
}

interface TextSelectionToolbarProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>
  onCopyToField: (field: TargetField, text: string) => void
  onNoSelection: () => void
}

/**
 * TextSelectionToolbar Component
 * Row of buttons for copying selected text to specific MCQ form fields.
 * 
 * Requirements: 5.1, 5.2
 */
export function TextSelectionToolbar({
  textAreaRef,
  onCopyToField,
  onNoSelection,
}: TextSelectionToolbarProps) {
  const handleCopyClick = (field: TargetField) => {
    const textarea = textAreaRef.current
    if (!textarea) {
      onNoSelection()
      return
    }

    const selectedText = getSelectedText(textarea)
    
    if (!selectedText || selectedText.trim() === '') {
      onNoSelection()
      return
    }

    onCopyToField(field, selectedText)
  }

  const buttonClass = "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
  const primaryClass = `${buttonClass} bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800`
  const secondaryClass = `${buttonClass} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700`

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {/* To Stem - Primary action */}
      <button
        type="button"
        onClick={() => handleCopyClick('stem')}
        className={primaryClass}
      >
        <ArrowDown className="w-3 h-3" />
        To Stem
      </button>

      {/* Option buttons */}
      <button
        type="button"
        onClick={() => handleCopyClick('optionA')}
        className={secondaryClass}
      >
        To Option A
      </button>
      <button
        type="button"
        onClick={() => handleCopyClick('optionB')}
        className={secondaryClass}
      >
        To Option B
      </button>
      <button
        type="button"
        onClick={() => handleCopyClick('optionC')}
        className={secondaryClass}
      >
        To Option C
      </button>

      {/* To Explanation */}
      <button
        type="button"
        onClick={() => handleCopyClick('explanation')}
        className={secondaryClass}
      >
        To Explanation
      </button>
    </div>
  )
}
