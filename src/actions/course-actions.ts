'use server'

import { revalidatePath } from 'next/cache'
import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { calculateLessonStatus, buildProgressMap } from '@/lib/lesson-status'
import {
  createCourseSchema,
  updateCourseSchema,
  createUnitSchema,
  updateUnitSchema,
  createLessonSchema,
  updateLessonSchema,
  addLessonItemSchema,
  reorderLessonItemsSchema,
} from '@/lib/validations'
import { formatZodErrors } from '@/lib/zod-utils'
import type { ActionResultV2 } from '@/types/actions'
import type { Card, Lesson, LessonItem, LessonProgress } from '@/types/database'

// Supabase join result types (avoids `as any` for chained selects)
type UnitWithCourse = { courses: { id: string } }
type LessonWithUnit = { units: { course_id: string } }
type LessonWithUnitDetail = { units: { id: string; course_id: string; order_index: number; courses: { id: string; user_id: string } } }

// ============================================
// Course CRUD Actions (Requirement 4.1)
// ============================================

/**
 * Server Action for creating a new course.
 * Validates input with Zod and creates course via Supabase.
 * RLS enforces user ownership.
 * Requirements: 4.1
 */
export async function createCourseAction(
  prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
  const rawData = {
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  }

  const validationResult = createCourseSchema.safeParse(rawData)

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const { title, description } = validationResult.data
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('courses')
    .insert({
      user_id: user.id,
      title,
      description: description || null,
    })
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard')

  return { ok: true, data }
}


/**
 * Server Action for updating a course.
 * Validates input with Zod and updates course via Supabase.
 * RLS enforces user ownership.
 * Requirements: 4.1
 */
export async function updateCourseAction(
  courseId: string,
  data: { title?: string; description?: string }
): Promise<ActionResultV2> {
  const validationResult = updateCourseSchema.safeParse({ courseId, ...data })

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description

  if (Object.keys(updateData).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const { data: updatedCourse, error } = await supabase
    .from('courses')
    .update(updateData)
    .eq('id', courseId)
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/course/${courseId}`)

  return { ok: true, data: updatedCourse }
}

/**
 * Server Action for deleting a course.
 * Cascade delete removes all units, lessons, and lesson items.
 * RLS enforces user ownership.
 * Requirements: 4.1, 4.6
 */
export async function deleteCourseAction(courseId: string): Promise<ActionResultV2> {
  if (!courseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)) {
    return { ok: false, error: 'Invalid course ID' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard')

  return { ok: true }
}

// ============================================
// Unit CRUD Actions (Requirement 4.2)
// ============================================

/**
 * Server Action for creating a new unit within a course.
 * Validates course ownership via RLS.
 * Requirements: 4.2
 */
export async function createUnitAction(
  prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
  const rawData = {
    courseId: formData.get('courseId'),
    title: formData.get('title'),
    orderIndex: formData.get('orderIndex') ? Number(formData.get('orderIndex')) : undefined,
  }

  const validationResult = createUnitSchema.safeParse(rawData)

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const { courseId, title, orderIndex } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // If no orderIndex provided, get the next available index
  let finalOrderIndex = orderIndex
  if (finalOrderIndex === undefined) {
    const { data: existingUnits } = await supabase
      .from('units')
      .select('order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: false })
      .limit(1)

    finalOrderIndex = existingUnits && existingUnits.length > 0
      ? existingUnits[0].order_index + 1
      : 0
  }

  const { data, error } = await supabase
    .from('units')
    .insert({
      course_id: courseId,
      title,
      order_index: finalOrderIndex,
    })
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath(`/course/${courseId}`)

  return { ok: true, data }
}


/**
 * Server Action for updating a unit.
 * Validates course ownership via RLS.
 * Requirements: 4.2
 */
export async function updateUnitAction(
  unitId: string,
  data: { title?: string; orderIndex?: number }
): Promise<ActionResultV2> {
  const validationResult = updateUnitSchema.safeParse({ unitId, ...data })

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.orderIndex !== undefined) updateData.order_index = data.orderIndex

  if (Object.keys(updateData).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const { data: updatedUnit, error } = await supabase
    .from('units')
    .update(updateData)
    .eq('id', unitId)
    .select('*, courses!inner(id)')
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  const courseId = (updatedUnit as unknown as UnitWithCourse).courses?.id
  if (courseId) {
    revalidatePath(`/course/${courseId}`)
  }

  return { ok: true, data: updatedUnit }
}

/**
 * Server Action for deleting a unit.
 * Cascade delete removes all lessons and lesson items.
 * RLS enforces course ownership.
 * Requirements: 4.2, 4.5
 */
export async function deleteUnitAction(unitId: string): Promise<ActionResultV2> {
  if (!unitId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitId)) {
    return { ok: false, error: 'Invalid unit ID' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Get course ID for revalidation before deleting
  const { data: unit } = await supabase
    .from('units')
    .select('course_id')
    .eq('id', unitId)
    .single()

  const { error } = await supabase
    .from('units')
    .delete()
    .eq('id', unitId)

  if (error) {
    return { ok: false, error: error.message }
  }

  if (unit?.course_id) {
    revalidatePath(`/course/${unit.course_id}`)
  }

  return { ok: true }
}

// ============================================
// Lesson CRUD Actions (Requirement 4.3)
// ============================================

/**
 * Server Action for creating a new lesson within a unit.
 * Validates unit/course ownership via RLS.
 * Requirements: 4.3
 */
export async function createLessonAction(
  prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
  const rawData = {
    unitId: formData.get('unitId'),
    title: formData.get('title'),
    orderIndex: formData.get('orderIndex') ? Number(formData.get('orderIndex')) : undefined,
    targetItemCount: formData.get('targetItemCount') ? Number(formData.get('targetItemCount')) : undefined,
  }

  const validationResult = createLessonSchema.safeParse(rawData)

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const { unitId, title, orderIndex, targetItemCount } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // If no orderIndex provided, get the next available index
  let finalOrderIndex = orderIndex
  if (finalOrderIndex === undefined) {
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('order_index')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: false })
      .limit(1)

    finalOrderIndex = existingLessons && existingLessons.length > 0
      ? existingLessons[0].order_index + 1
      : 0
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      unit_id: unitId,
      title,
      order_index: finalOrderIndex,
      target_item_count: targetItemCount ?? 10,
    })
    .select('*, units!inner(course_id)')
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  const courseId = (data as unknown as LessonWithUnit).units?.course_id
  if (courseId) {
    revalidatePath(`/course/${courseId}`)
  }

  return { ok: true, data }
}


/**
 * Server Action for updating a lesson.
 * Validates unit/course ownership via RLS.
 * Requirements: 4.3
 */
export async function updateLessonAction(
  lessonId: string,
  data: { title?: string; orderIndex?: number; targetItemCount?: number }
): Promise<ActionResultV2> {
  const validationResult = updateLessonSchema.safeParse({ lessonId, ...data })

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.orderIndex !== undefined) updateData.order_index = data.orderIndex
  if (data.targetItemCount !== undefined) updateData.target_item_count = data.targetItemCount

  if (Object.keys(updateData).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const { data: updatedLesson, error } = await supabase
    .from('lessons')
    .update(updateData)
    .eq('id', lessonId)
    .select('*, units!inner(course_id)')
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  const courseId = (updatedLesson as unknown as LessonWithUnit).units?.course_id
  if (courseId) {
    revalidatePath(`/course/${courseId}`)
  }
  revalidatePath(`/lesson/${lessonId}`)

  return { ok: true, data: updatedLesson }
}

/**
 * Server Action for deleting a lesson.
 * Cascade delete removes all lesson items.
 * RLS enforces unit/course ownership.
 * Requirements: 4.3
 */
export async function deleteLessonAction(lessonId: string): Promise<ActionResultV2> {
  if (!lessonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)) {
    return { ok: false, error: 'Invalid lesson ID' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Get course ID for revalidation before deleting
  const { data: lesson } = await supabase
    .from('lessons')
    .select('units!inner(course_id)')
    .eq('id', lessonId)
    .single()

  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)

  if (error) {
    return { ok: false, error: error.message }
  }

  const courseId = (lesson as unknown as LessonWithUnit | null)?.units?.course_id
  if (courseId) {
    revalidatePath(`/course/${courseId}`)
  }

  return { ok: true }
}

// ============================================
// Lesson Item Actions (Requirement 4.4)
// ============================================

/**
 * Server Action for adding an item to a lesson.
 * Validates lesson ownership and item existence.
 * Requirements: 4.4
 */
export async function addLessonItemAction(
  lessonId: string,
  itemType: 'mcq' | 'card',
  itemId: string,
  orderIndex?: number
): Promise<ActionResultV2> {
  const validationResult = addLessonItemSchema.safeParse({ lessonId, itemType, itemId, orderIndex })

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify the item (card) exists and user owns it
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .eq('id', itemId)
    .single()

  if (cardError || !card) {
    return { ok: false, error: 'Item not found or access denied' }
  }

  // If no orderIndex provided, get the next available index
  let finalOrderIndex = orderIndex
  if (finalOrderIndex === undefined) {
    const { data: existingItems } = await supabase
      .from('lesson_items')
      .select('order_index')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: false })
      .limit(1)

    finalOrderIndex = existingItems && existingItems.length > 0
      ? existingItems[0].order_index + 1
      : 0
  }

  const { data, error } = await supabase
    .from('lesson_items')
    .insert({
      lesson_id: lessonId,
      item_type: itemType,
      item_id: itemId,
      order_index: finalOrderIndex,
    })
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath(`/lesson/${lessonId}`)

  return { ok: true, data }
}


/**
 * Server Action for removing an item from a lesson.
 * Validates lesson ownership.
 * Requirements: 4.4
 */
export async function removeLessonItemAction(lessonItemId: string): Promise<ActionResultV2> {
  if (!lessonItemId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonItemId)) {
    return { ok: false, error: 'Invalid lesson item ID' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Get lesson ID for revalidation before deleting
  const { data: lessonItem } = await supabase
    .from('lesson_items')
    .select('lesson_id')
    .eq('id', lessonItemId)
    .single()

  const { error } = await supabase
    .from('lesson_items')
    .delete()
    .eq('id', lessonItemId)

  if (error) {
    return { ok: false, error: error.message }
  }

  if (lessonItem?.lesson_id) {
    revalidatePath(`/lesson/${lessonItem.lesson_id}`)
  }

  return { ok: true }
}

/**
 * Server Action for reordering lesson items.
 * Updates order_index for all items in the provided order.
 * Requirements: 4.4
 */
export async function reorderLessonItemsAction(
  lessonId: string,
  itemIds: string[]
): Promise<ActionResultV2> {
  const validationResult = reorderLessonItemsSchema.safeParse({ lessonId, itemIds })

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Update each item's order_index
  const updates = itemIds.map((itemId, index) =>
    supabase
      .from('lesson_items')
      .update({ order_index: index })
      .eq('id', itemId)
      .eq('lesson_id', lessonId)
  )

  const results = await Promise.all(updates)

  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    return { ok: false, error: 'Failed to reorder some items' }
  }

  revalidatePath(`/lesson/${lessonId}`)

  return { ok: true }
}

// ============================================
// Lesson Items Helper (Requirement 5.1)
// ============================================

export interface LessonItemWithCard {
  item: LessonItem;
  card: Card;
}

/**
 * Fetches lesson items with joined card data, ordered by order_index.
 * Returns array of { item, card } objects.
 * Requirements: 5.1
 */
export async function getLessonItems(lessonId: string): Promise<ActionResultV2<LessonItemWithCard[]>> {
  if (!lessonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)) {
    return { ok: false, error: 'Invalid lesson ID' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch lesson items ordered by order_index
  const { data: lessonItems, error: itemsError } = await supabase
    .from('lesson_items')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true })

  if (itemsError) {
    return { ok: false, error: itemsError.message }
  }

  if (!lessonItems || lessonItems.length === 0) {
    return { ok: true, data: [] }
  }

  // Fetch all cards for the lesson items
  const itemIds = lessonItems.map(item => item.item_id)
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('id', itemIds)

  if (cardsError) {
    return { ok: false, error: cardsError.message }
  }

  // Create a map of card id to card for efficient lookup
  const cardMap = new Map<string, Card>()
  if (cards) {
    for (const card of cards) {
      cardMap.set(card.id, card as Card)
    }
  }

  // Combine lesson items with their cards, maintaining order
  const result: LessonItemWithCard[] = []
  for (const item of lessonItems) {
    const card = cardMap.get(item.item_id)
    if (card) {
      result.push({
        item: item as LessonItem,
        card,
      })
    }
  }

  return { ok: true, data: result }
}


// ============================================
// Lesson Detail Action (Requirements 5.1, 6.3, 6.4)
// ============================================

/**
 * Fetches lesson details including lock status and progress.
 * Replaces GET /api/lesson/[lessonId].
 * Requirements: 5.1, 6.3, 6.4
 */
export async function getLessonDetail(
  lessonId: string
): Promise<ActionResultV2<{
  lesson: Lesson
  courseId: string
  progress: LessonProgress | null
  isLocked: boolean
}>> {
  return withUser(async ({ user, supabase }) => {
    // Fetch the lesson with unit and course info
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        *,
        units!inner(
          id,
          course_id,
          order_index,
          courses!inner(
            id,
            user_id
          )
        )
      `)
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return { ok: false, error: 'Lesson not found' }
    }

    const unit = (lesson as unknown as LessonWithUnitDetail).units
    const courseId = unit.course_id

    // Fetch all lessons in the course to determine lock status
    const { data: allLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select(`
        id,
        order_index,
        unit_id,
        units!inner(
          order_index,
          course_id
        )
      `)
      .eq('units.course_id', courseId)
      .order('units.order_index', { ascending: true })
      .order('order_index', { ascending: true })

    if (lessonsError) {
      return { ok: false, error: 'Failed to fetch lessons' }
    }

    // Fetch user's progress for all lessons in the course
    const lessonIds = (allLessons || []).map(l => l.id)
    const { data: progressRecords, error: progressError } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds)

    if (progressError) {
      return { ok: false, error: 'Failed to fetch progress' }
    }

    const progressMap = buildProgressMap((progressRecords || []) as LessonProgress[])

    // Find the current lesson's position and previous lesson
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedLessons = (allLessons || []).map((l: any) => ({
      id: l.id,
      order_index: l.order_index,
      unit_order_index: l.units.order_index,
    })).sort((a, b) => {
      if (a.unit_order_index !== b.unit_order_index) {
        return a.unit_order_index - b.unit_order_index
      }
      return a.order_index - b.order_index
    })

    const currentIndex = sortedLessons.findIndex(l => l.id === lessonId)
    const currentLesson = sortedLessons[currentIndex]
    const previousLesson = currentIndex > 0 ? sortedLessons[currentIndex - 1] : null

    // Calculate lesson status
    const status = calculateLessonStatus({
      lessonOrderIndex: currentLesson?.order_index ?? 0,
      unitOrderIndex: currentLesson?.unit_order_index ?? 0,
      progressMap,
      previousLessonId: previousLesson?.id ?? null,
      currentLessonId: lessonId,
    })

    // Get current lesson's progress
    const currentProgress = progressMap.get(lessonId) || null

    return {
      ok: true,
      data: {
        lesson: {
          id: lesson.id,
          unit_id: lesson.unit_id,
          title: lesson.title,
          order_index: lesson.order_index,
          target_item_count: lesson.target_item_count,
          created_at: lesson.created_at,
        } as Lesson,
        courseId,
        progress: currentProgress,
        isLocked: status === 'locked',
      },
    }
  }) as Promise<ActionResultV2<{ lesson: Lesson; courseId: string; progress: LessonProgress | null; isLocked: boolean }>>
}

// ============================================
// Lesson Completion Action (Requirements 5.4, 5.6, 7.1, 7.4)
// ============================================

import { calculateStreak, updateLongestStreak, incrementTotalReviews } from '@/lib/streak'

/**
 * Server Action for completing a lesson.
 * Records completion in lesson_progress (upsert), updates best_score if higher,
 * and updates user_stats and study_logs for streak/heatmap consistency.
 * Requirements: 5.4, 5.6, 7.1, 7.4
 */
export async function completeLessonAction(
  lessonId: string,
  score: number,
  totalItems: number
): Promise<ActionResultV2<{ xpEarned: number; newTotalXp: number; newStreak: number; longestStreak: number }>> {
  // Validate inputs
  if (!lessonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)) {
    return { ok: false, error: 'Invalid lesson ID' }
  }

  if (score < 0 || score > totalItems) {
    return { ok: false, error: 'Invalid score' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify the lesson exists and user has access (via RLS)
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, unit_id')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return { ok: false, error: 'Lesson not found or access denied' }
  }

  const now = new Date()
  const todayDateStr = now.toISOString().split('T')[0]

  // Check for existing lesson_progress
  const { data: existingProgress, error: progressError } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .single()

  if (progressError && progressError.code !== 'PGRST116') {
    return { ok: false, error: progressError.message }
  }

  let lessonProgressId: string
  let bestScore: number
  let isNewBest: boolean

  if (existingProgress) {
    // Update existing progress - update best_score if new score is higher (Requirement 7.4)
    isNewBest = score > existingProgress.best_score
    bestScore = isNewBest ? score : existingProgress.best_score

    const { data: updatedProgress, error: updateError } = await supabase
      .from('lesson_progress')
      .update({
        last_completed_at: now.toISOString(),
        best_score: bestScore,
      })
      .eq('id', existingProgress.id)
      .select()
      .single()

    if (updateError) {
      return { ok: false, error: updateError.message }
    }

    lessonProgressId = updatedProgress.id
  } else {
    // Insert new progress record (Requirement 7.1)
    isNewBest = true
    bestScore = score

    const { data: newProgress, error: insertError } = await supabase
      .from('lesson_progress')
      .insert({
        user_id: user.id,
        lesson_id: lessonId,
        last_completed_at: now.toISOString(),
        best_score: score,
      })
      .select()
      .single()

    if (insertError) {
      return { ok: false, error: insertError.message }
    }

    lessonProgressId = newProgress.id
  }

  // === Update user_stats and study_logs for streak/heatmap (Requirement 5.6) ===

  // Fetch or create user_stats record
  const { data: existingStats, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (statsError && statsError.code !== 'PGRST116') {
    return { ok: false, error: statsError.message }
  }

  // Calculate streak updates
  const lastStudyDate = existingStats?.last_study_date
    ? new Date(existingStats.last_study_date)
    : null
  const currentStreak = existingStats?.current_streak ?? 0
  const longestStreak = existingStats?.longest_streak ?? 0
  const totalReviews = existingStats?.total_reviews ?? 0

  const streakResult = calculateStreak({
    lastStudyDate,
    currentStreak,
    todayDate: now,
  })

  const newLongestStreak = updateLongestStreak(streakResult.newStreak, longestStreak)
  // Increment total_reviews by the number of items in the lesson
  const newTotalReviews = totalReviews + totalItems

  // Upsert user_stats
  if (existingStats) {
    const { error: updateStatsError } = await supabase
      .from('user_stats')
      .update({
        last_study_date: todayDateStr,
        current_streak: streakResult.newStreak,
        longest_streak: newLongestStreak,
        total_reviews: newTotalReviews,
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)

    if (updateStatsError) {
      return { ok: false, error: updateStatsError.message }
    }
  } else {
    const { error: insertStatsError } = await supabase
      .from('user_stats')
      .insert({
        user_id: user.id,
        last_study_date: todayDateStr,
        current_streak: streakResult.newStreak,
        longest_streak: newLongestStreak,
        total_reviews: totalItems,
      })

    if (insertStatsError) {
      return { ok: false, error: insertStatsError.message }
    }
  }

  // Upsert study_logs - increment cards_reviewed for today
  const { data: existingLog, error: logFetchError } = await supabase
    .from('study_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('study_date', todayDateStr)
    .single()

  if (logFetchError && logFetchError.code !== 'PGRST116') {
    return { ok: false, error: logFetchError.message }
  }

  if (existingLog) {
    const { error: updateLogError } = await supabase
      .from('study_logs')
      .update({
        cards_reviewed: existingLog.cards_reviewed + totalItems,
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)
      .eq('study_date', todayDateStr)

    if (updateLogError) {
      return { ok: false, error: updateLogError.message }
    }
  } else {
    const { error: insertLogError } = await supabase
      .from('study_logs')
      .insert({
        user_id: user.id,
        study_date: todayDateStr,
        cards_reviewed: totalItems,
      })

    if (insertLogError) {
      return { ok: false, error: insertLogError.message }
    }
  }

  // Revalidate relevant pages
  revalidatePath(`/lesson/${lessonId}`)
  revalidatePath('/dashboard')

  return {
    ok: true,
    data: {
      xpEarned: score,
      newTotalXp: newTotalReviews,
      newStreak: streakResult.newStreak,
      longestStreak: newLongestStreak,
    },
  }
}
