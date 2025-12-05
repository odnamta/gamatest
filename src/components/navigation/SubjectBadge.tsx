import { BookOpen } from 'lucide-react'

interface SubjectBadgeProps {
  subject: string
}

/**
 * SubjectBadge displays the current medical specialty in a pill-shaped badge.
 * 
 * Requirements: 2.1, 2.4
 */
export function SubjectBadge({ subject }: SubjectBadgeProps) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
      <BookOpen className="h-3 w-3" />
      <span>{subject}</span>
    </div>
  )
}

export default SubjectBadge
