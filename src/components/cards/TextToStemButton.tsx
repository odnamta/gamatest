'use client'

import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface TextToStemButtonProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>
  onTextSelected: (text: string) => void
  onNoSelection: () => void
}

/**
 * TextToStemButton Component
 * Copies selected text from textarea to question stem.
 * Requirements: 5.1, 5.2, 5.3
 * 
 * Feature: v3-ux-overhaul
 */
export function TextToStemButton({
  textAreaRef,
  onTextSelected,
  onNoSelection,
}: TextToStemButtonProps) {
  const handleClick = () => {
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

    onTextSelected(selectedText)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
    >
      <ArrowDown className="w-4 h-4" />
      Copy selected text to Question Stem
    </Button>
  )
}

/**
 * Gets selected text from a textarea element.
 * Exported for property testing.
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

/**
 * Transfers selected text to target field.
 * Pure function for property testing.
 * Requirements: 5.2
 */
export function transferSelectedText(
  sourceText: string,
  selectionStart: number,
  selectionEnd: number
): string {
  if (selectionStart < 0 || selectionEnd < 0) {
    return ''
  }
  if (selectionStart >= selectionEnd) {
    return ''
  }
  if (selectionEnd > sourceText.length) {
    return sourceText.substring(selectionStart)
  }
  return sourceText.substring(selectionStart, selectionEnd)
}
