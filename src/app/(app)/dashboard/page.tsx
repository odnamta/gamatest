import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { LibrarySection } from '@/components/dashboard/LibrarySection'
import { StudyHeatmap } from '@/components/dashboard/StudyHeatmap'
import { RepairButton } from '@/components/dashboard/RepairButton'
import type { CourseWithProgress } from '@/components/course'
import { getStudyLogs, getUserStats } from '@/actions/stats-actions'
import { getGlobalStats } from '@/actions/global-study-actions'
import { isUserAdmin, ADMIN_USER_IDS } from '@/lib/onboarding-utils'
import type { DeckWithDueCount, Course, Lesson, LessonProgress } from '@/types/database'

/**
 * Dashboard Page - React Server Component
 * Displays user's courses and decks with progress.
 * V10.4: Added redirect logic for zero-deck users.
 * Requirements: 2.2, 4.1, 4.2, 6.1, 6.2, 6.4
 */
export default async function DashboardPage() {
  const user = await getUser()
  
  if (!user) {
    return null // Layout handles redirect
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch study logs for heatmap - full year (Requirement 2.2)
  const { logs: studyLogs } = await getStudyLogs(365)

  // Fetch user stats for streak display (Requirement 1.7)
  const { stats: userStats } = await getUserStats()

  // Fetch global stats for DashboardHero (Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8)
  const globalStats = await getGlobalStats()

  // Fetch user's courses with units and lessons for progress calculation (Requirement 6.1)
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch all units for user's courses
  const courseIds = (courses || []).map(c => c.id)
  let units: { id: string; course_id: string }[] = []
  if (courseIds.length > 0) {
    const { data: unitsData } = await supabase
      .from('units')
      .select('id, course_id')
      .in('course_id', courseIds)
    units = unitsData || []
  }

  // Fetch all lessons for those units
  const unitIds = units.map(u => u.id)
  let lessons: Lesson[] = []
  if (unitIds.length > 0) {
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .in('unit_id', unitIds)
    lessons = (lessonsData || []) as Lesson[]
  }

  // Fetch lesson progress for the user
  const lessonIds = lessons.map(l => l.id)
  let progressRecords: LessonProgress[] = []
  if (lessonIds.length > 0) {
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds)
    progressRecords = (progressData || []) as LessonProgress[]
  }

  // Build progress map
  const progressMap = new Map<string, LessonProgress>()
  for (const p of progressRecords) {
    progressMap.set(p.lesson_id, p)
  }

  // Build unit to course mapping
  const unitToCourse = new Map<string, string>()
  for (const u of units) {
    unitToCourse.set(u.id, u.course_id)
  }

  // Calculate course progress
  const coursesWithProgress: CourseWithProgress[] = (courses || []).map((course: Course) => {
    // Get lessons for this course
    const courseLessons = lessons.filter(l => {
      const courseId = unitToCourse.get(l.unit_id)
      return courseId === course.id
    })
    
    const totalLessons = courseLessons.length
    const completedLessons = courseLessons.filter(l => progressMap.has(l.id)).length
    
    // Find next lesson (first incomplete lesson)
    const nextLesson = courseLessons.find(l => !progressMap.has(l.id))
    
    return {
      ...course,
      totalLessons,
      completedLessons,
      nextLessonId: nextLesson?.id || null,
    }
  })

  // V8.1: Fetch user's deck_templates via user_decks (V2 schema)
  const { data: userDecks, error: decksError } = await supabase
    .from('user_decks')
    .select(`
      deck_template_id,
      deck_templates!inner(id, title, author_id, created_at)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (coursesError || decksError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-400">Error loading data: {coursesError?.message || decksError?.message}</p>
      </div>
    )
  }

  // V10.5.1: Removed redirect to library - let users stay on dashboard in Welcome Mode
  const subscribedDecksCount = userDecks?.length || 0

  // V10.4: Check if user is admin
  const userIsAdmin = isUserAdmin(user.id, ADMIN_USER_IDS)

  // Get deck template IDs for due count calculation
  const deckTemplateIds = (userDecks || []).map(ud => ud.deck_template_id)
  
  // Fetch card_templates for due count calculation
  let cardTemplates: { id: string; deck_template_id: string }[] = []
  if (deckTemplateIds.length > 0) {
    const { data: ctData } = await supabase
      .from('card_templates')
      .select('id, deck_template_id')
      .in('deck_template_id', deckTemplateIds)
    cardTemplates = ctData || []
  }

  // Create map of card_template_id -> deck_template_id
  const cardToDeckMap = new Map<string, string>()
  for (const ct of cardTemplates) {
    cardToDeckMap.set(ct.id, ct.deck_template_id)
  }

  // Fetch due progress records
  const cardTemplateIdList = Array.from(cardToDeckMap.keys())
  let dueProgress: { card_template_id: string }[] = []
  if (cardTemplateIdList.length > 0) {
    const { data: dueData } = await supabase
      .from('user_card_progress')
      .select('card_template_id')
      .eq('user_id', user.id)
      .lte('next_review', now)
      .eq('suspended', false)
      .in('card_template_id', cardTemplateIdList)
    dueProgress = dueData || []
  }

  // Build due count map by deck_template_id
  const dueCountMap = new Map<string, number>()
  for (const record of dueProgress) {
    const deckTemplateId = cardToDeckMap.get(record.card_template_id)
    if (deckTemplateId) {
      dueCountMap.set(deckTemplateId, (dueCountMap.get(deckTemplateId) || 0) + 1)
    }
  }

  // Build decks with due counts using V2 IDs
  const decksWithDueCounts: DeckWithDueCount[] = (userDecks || []).map(ud => {
    const dt = ud.deck_templates as unknown as { id: string; title: string; author_id: string; created_at: string }
    return {
      id: dt.id, // V2 deck_template ID
      user_id: dt.author_id,
      title: dt.title,
      created_at: dt.created_at,
      due_count: dueCountMap.get(dt.id) || 0,
    }
  }).sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Dashboard Hero - First element (Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1-3.5) */}
      <DashboardHero
        globalDueCount={globalStats.totalDueCount}
        completedToday={globalStats.completedToday}
        dailyGoal={null}
        currentStreak={globalStats.currentStreak}
        hasNewCards={globalStats.hasNewCards}
        userName={user.user_metadata?.name || user.email?.split('@')[0]}
        subscribedDecks={subscribedDecksCount}
        isAdmin={userIsAdmin}
      />

      {/* V8.1: Repair Button - Shows if user has cards without progress */}
      <div className="mb-4">
        <RepairButton />
      </div>

      {/* Study Heatmap (Requirement 2.2) */}
      <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
        <StudyHeatmap studyLogs={studyLogs} currentYear={new Date().getFullYear()} />
      </div>

      {/* Library Section - Collapsible courses and decks (Requirements 3.1, 3.2, 3.3, 3.4) */}
      <LibrarySection
        courses={coursesWithProgress}
        decks={decksWithDueCounts}
        defaultExpanded={false}
      />
    </div>
  )
}
