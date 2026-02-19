'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Flame, Play, RotateCcw, Settings, Library, Plus } from 'lucide-react'
import { ConfigureSessionModal } from '@/components/study/ConfigureSessionModal'
import { SearchBar } from '@/components/search/SearchBar'
import { SingleCardPreviewModal } from '@/components/search/SingleCardPreviewModal'
import { StudyTagFilter } from '@/components/tags/StudyTagFilter'
import { shouldShowWelcomeMode } from '@/lib/onboarding-utils'
import { buildStudyUrl } from '@/lib/url-utils'
import type { Tag } from '@/types/database'

/**
 * Session state stored in localStorage for resume capability.
 * Requirements: 1.8
 */
interface CachedSessionState {
  currentIndex: number
  correctCount: number
  incorrectCount: number
  cardIds: string[]
  timestamp: number
}

const SESSION_STORAGE_KEY = 'global-study-session'
const SESSION_STALE_HOURS = 24

/**
 * Check if a cached session exists and is not stale.
 */
function getValidCachedSession(): CachedSessionState | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return null
    
    const session: CachedSessionState = JSON.parse(stored)
    const hoursSinceCreation = (Date.now() - session.timestamp) / (1000 * 60 * 60)
    
    // Session is stale if older than 24 hours
    if (hoursSinceCreation >= SESSION_STALE_HOURS) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    
    // Session is complete if currentIndex >= cardIds.length
    if (session.currentIndex >= session.cardIds.length) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    
    return session
  } catch {
    return null
  }
}

export interface DashboardHeroProps {
  globalDueCount: number
  completedToday: number
  dailyGoal: number | null
  currentStreak: number
  hasNewCards: boolean
  userName?: string
  subscribedDecks?: number  // V10.4: for zero state detection
  isAdmin?: boolean         // V10.4: for create deck button
  tags?: Tag[]              // V11.7: for tag filter
}

/**
 * Welcome Mode Component - V10.4
 * Displays when user has no subscribed decks and no cards.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
function WelcomeMode({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Library className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Welcome to Cekatan
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Let&apos;s find your first study deck.
      </p>
      
      <div className="space-y-3">
        {/* Primary CTA - Browse Library */}
        <Link href="/library" className="block">
          <Button size="lg" className="w-full min-h-[44px]">
            <Library className="w-5 h-5 mr-2" />
            Browse Library
          </Button>
        </Link>
        
        {/* Secondary CTA - Create Deck (Admin only) */}
        {isAdmin && (
          <Link href="/decks/new" className="block">
            <Button variant="secondary" size="lg" className="w-full min-h-[44px]">
              <Plus className="w-5 h-5 mr-2" />
              Create my own Deck
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * DashboardHero Component - Client Component
 * Displays greeting, study stats, and primary call-to-action.
 * V10.4: Added Welcome Mode for zero state users.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 7.2
 */
export function DashboardHero({
  globalDueCount,
  completedToday,
  dailyGoal,
  currentStreak,
  hasNewCards,
  userName,
  subscribedDecks = 0,
  isAdmin = false,
  tags = [],
}: DashboardHeroProps) {
  const router = useRouter()
  const [hasUnfinishedSession, setHasUnfinishedSession] = useState(false)
  // V6.3: Custom session modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  // V10.6: Search preview modal state
  const [previewCardId, setPreviewCardId] = useState<string | null>(null)
  // V11.7: Selected tag IDs for filtered study
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Check for unfinished session on mount (client-side only)
  useEffect(() => {
    const cachedSession = getValidCachedSession()
    setHasUnfinishedSession(cachedSession !== null)
  }, [])

  // V11.7: Handle tag selection change
  const handleTagSelectionChange = useCallback((tagIds: string[]) => {
    setSelectedTagIds(tagIds)
  }, [])

  // V11.7: Handle start studying with tag filter
  const handleStartStudying = useCallback(() => {
    const url = buildStudyUrl(selectedTagIds.length > 0 ? selectedTagIds : undefined)
    router.push(url)
  }, [router, selectedTagIds])

  // Calculate daily goal progress
  const goalProgress = dailyGoal ? Math.min(completedToday / dailyGoal, 1) : null
  const isGoalComplete = dailyGoal ? completedToday >= dailyGoal : false

  // V10.4: Check for Welcome Mode (zero state)
  // Use globalDueCount as proxy for totalCards since we don't have direct card count
  const showWelcomeMode = shouldShowWelcomeMode(subscribedDecks, globalDueCount)

  // Determine if we should show empty state (existing logic, only when not in welcome mode)
  const showEmptyState = !showWelcomeMode && globalDueCount === 0 && !hasNewCards

  // V10.4: Show Welcome Mode for new users
  if (showWelcomeMode) {
    return (
      <Card variant="elevated" padding="lg" className="mb-8">
        <WelcomeMode isAdmin={isAdmin} />
      </Card>
    )
  }

  return (
    <Card variant="elevated" padding="lg" className="mb-8">
      {/* Greeting - Requirement 1.1 */}
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {userName ? `Hi ${userName} 👋` : 'Hey there 👋'} Ready to study?
      </h1>

      {/* V10.6: Global Search Bar */}
      <div className="mb-6">
        <SearchBar onResultClick={(cardId) => setPreviewCardId(cardId)} />
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Due Count - Requirement 1.2 */}
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {globalDueCount}
          </span>
          <span className="text-slate-600 dark:text-slate-400 text-sm">
            cards due
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Completed Today - Requirement 1.3 */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {completedToday}
          </span>
          <span className="text-slate-600 dark:text-slate-400 text-sm">
            done today
          </span>
        </div>

        {/* Divider */}
        {currentStreak > 0 && (
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
        )}

        {/* Streak Badge - Requirement 1.5 */}
        {currentStreak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full">
            <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
            <span className="text-orange-700 dark:text-orange-300 font-medium text-sm">
              {currentStreak}-day streak
            </span>
          </div>
        )}
      </div>

      {/* Daily Goal Progress - Requirement 1.4 */}
      {dailyGoal && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Daily Goal
            </span>
            <span className={`text-sm font-medium ${
              isGoalComplete 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {completedToday}/{dailyGoal}
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isGoalComplete
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-blue-500 dark:bg-blue-400'
              }`}
              style={{ width: `${(goalProgress || 0) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty State - Requirement 1.7 */}
      {showEmptyState ? (
        <div className="text-center py-4">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You have no due cards yet — create MCQs using Bulk Import or add a flashcard manually.
          </p>
        </div>
      ) : (
        /* Primary CTA - Requirements 1.6, 1.8, 7.2 */
        <div className="space-y-3">
          {/* V11.7: Tag Filter */}
          {tags.length > 0 && (
            <div className="mb-2">
              <StudyTagFilter
                tags={tags}
                onSelectionChange={handleTagSelectionChange}
              />
            </div>
          )}

          <Button
            size="lg"
            className="w-full min-h-[44px] text-lg"
            onClick={handleStartStudying}
          >
            {hasUnfinishedSession ? (
              <>
                <RotateCcw className="w-5 h-5 mr-2" />
                Resume Session
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start Today&apos;s Session
                {selectedTagIds.length > 0 && (
                  <span className="ml-1 text-sm opacity-80">
                    ({selectedTagIds.length} filter{selectedTagIds.length > 1 ? 's' : ''})
                  </span>
                )}
              </>
            )}
          </Button>
          
          {/* V6.3: Custom Session button */}
          <Button
            variant="secondary"
            size="lg"
            className="w-full min-h-[44px]"
            onClick={() => setIsCustomModalOpen(true)}
          >
            <Settings className="w-5 h-5 mr-2" />
            Custom Session
          </Button>
        </div>
      )}

      {/* V6.3: Configure Session Modal */}
      <ConfigureSessionModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
      />

      {/* V10.6: Single Card Preview Modal */}
      <SingleCardPreviewModal
        isOpen={previewCardId !== null}
        onClose={() => setPreviewCardId(null)}
        cardTemplateId={previewCardId}
      />
    </Card>
  )
}
