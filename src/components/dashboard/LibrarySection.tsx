'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Library } from 'lucide-react'
import { CourseCard } from '@/components/course/CourseCard'
import { DeckCard } from '@/components/decks/DeckCard'
import { CreateDeckForm } from '@/components/decks/CreateDeckForm'
import type { CourseWithProgress } from '@/components/course/CourseCard'
import type { DeckWithDueCount } from '@/types/database'

export interface LibrarySectionProps {
  courses: CourseWithProgress[]
  decks: DeckWithDueCount[]
  defaultExpanded?: boolean
}

/**
 * LibrarySection Component
 * 
 * Collapsible section containing courses and decks listings.
 * Defaults to collapsed state to keep dashboard focused on studying.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4
 * - Courses section is hidden when courses.length === 0 (Req 2.1, 2.2)
 * - Floating Add Deck button removed (Req 3.1)
 */
export function LibrarySection({
  courses,
  decks,
  defaultExpanded = false,
}: LibrarySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Build header count text - only show courses count if there are courses
  const headerCountText = courses.length > 0
    ? `(${courses.length} courses, ${decks.length} decks)`
    : `(${decks.length} decks)`

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="library-content"
      >
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Library &amp; Content
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {headerCountText}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div id="library-content" className="p-4 space-y-8 bg-white dark:bg-slate-900/50">
          {/* Courses Section - Only render if courses exist (Req 2.1, 2.2) */}
          {courses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Courses
                </h3>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>
          )}

          {/* Decks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Decks
              </h3>
              {/* Floating Add Deck button removed per Req 3.1 */}
            </div>

            {/* Create Deck Form - Simplified per Req 3.2, 3.3 */}
            <div 
              id="add-deck-form" 
              className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <CreateDeckForm />
            </div>

            {decks.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm py-4 text-center">
                No decks yet. Create your first deck above!
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {decks.map((deck) => (
                  <DeckCard key={deck.id} deck={deck} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
