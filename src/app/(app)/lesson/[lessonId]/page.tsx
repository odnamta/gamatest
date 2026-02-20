'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LessonStudy, MistakeRecord } from '@/components/study/LessonStudy'
import { LessonSummary } from '@/components/study/LessonSummary'
import { completeLessonAction, getLessonDetail, getLessonItems, LessonItemWithCard } from '@/actions/course-actions'
import type { Lesson, LessonProgress } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

interface LessonStudyPageProps {
  params: Promise<{ lessonId: string }>
}

interface LessonData {
  lesson: Lesson
  courseId: string
  items: LessonItemWithCard[]
  progress: LessonProgress | null
  isLocked: boolean
}

/**
 * Lesson Study Page - Client Component
 * Verifies lesson is unlocked, fetches lesson items, and manages study flow.
 * Requirements: 5.1
 */
export default function LessonStudyPage({ params }: LessonStudyPageProps) {
  usePageTitle('Lesson')
  const router = useRouter()
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [lessonData, setLessonData] = useState<LessonData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [completionResult, setCompletionResult] = useState<{
    correctCount: number
    mistakes: MistakeRecord[]
    bestScore: number
    isNewBest: boolean
  } | null>(null)

  // Resolve params
  useEffect(() => {
    params.then(p => setLessonId(p.lessonId))
  }, [params])

  // Fetch lesson data
  useEffect(() => {
    if (!lessonId) return

    const currentLessonId = lessonId // Capture for closure

    async function fetchLessonData() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch lesson items
        const itemsResult = await getLessonItems(currentLessonId)
        
        if (!itemsResult.success) {
          setError(itemsResult.error || 'Failed to load lesson')
          setIsLoading(false)
          return
        }

        // Fetch lesson details via server action
        const detailResult = await getLessonDetail(currentLessonId)
        if (!detailResult.ok) {
          setError(detailResult.error || 'Failed to load lesson details')
          setIsLoading(false)
          return
        }

        setLessonData({
          lesson: detailResult.data!.lesson,
          courseId: detailResult.data!.courseId,
          items: itemsResult.data || [],
          progress: detailResult.data!.progress,
          isLocked: detailResult.data!.isLocked,
        })
      } catch (err) {
        setError('An error occurred while loading the lesson')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLessonData()
  }, [lessonId])

  // Handle lesson completion
  const handleComplete = async (correctCount: number, mistakes: MistakeRecord[]) => {
    if (!lessonId || !lessonData) return

    const totalItems = lessonData.items.length
    const result = await completeLessonAction(lessonId, correctCount, totalItems)

    if (result.success && result.data) {
      setCompletionResult({
        correctCount,
        mistakes,
        bestScore: result.data.bestScore,
        isNewBest: result.data.isNewBest,
      })
      setIsComplete(true)
    } else {
      // Still show completion even if save failed
      setCompletionResult({
        correctCount,
        mistakes,
        bestScore: lessonData.progress?.best_score ?? correctCount,
        isNewBest: !lessonData.progress || correctCount > lessonData.progress.best_score,
      })
      setIsComplete(true)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading lesson...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
            Error Loading Lesson
          </h2>
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // No lesson data
  if (!lessonData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">Lesson not found</p>
        </div>
      </div>
    )
  }

  // Locked lesson
  if (lessonData.isLocked) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Lesson Locked
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Complete the previous lesson to unlock this one.
          </p>
          <Link
            href={`/course/${lessonData.courseId}`}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Course
          </Link>
        </div>
      </div>
    )
  }

  // Completion state
  if (isComplete && completionResult) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LessonSummary
          lessonId={lessonId!}
          courseId={lessonData.courseId}
          totalItems={lessonData.items.length}
          correctCount={completionResult.correctCount}
          mistakes={completionResult.mistakes}
          bestScore={completionResult.bestScore}
          isNewBest={completionResult.isNewBest}
        />
      </div>
    )
  }

  // Empty lesson
  if (lessonData.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/course/${lessonData.courseId}`}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            ← Back to Course
          </Link>
        </div>

        <div className="text-center py-12 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="text-4xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No Items Yet
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This lesson doesn&apos;t have any items yet.
          </p>
          <Link
            href={`/course/${lessonData.courseId}`}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Course
          </Link>
        </div>
      </div>
    )
  }

  // Study session
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="mb-6">
        <Link
          href={`/course/${lessonData.courseId}`}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          ← Back to Course
        </Link>
      </div>

      {/* Lesson title */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {lessonData.lesson.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {lessonData.items.length} {lessonData.items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Lesson study component */}
      <LessonStudy
        lesson={lessonData.lesson}
        items={lessonData.items}
        onComplete={handleComplete}
      />
    </div>
  )
}
