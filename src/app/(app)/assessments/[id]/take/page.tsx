'use client'

/**
 * V13: Assessment Take Page — Timed Exam Engine
 *
 * Starts/resumes session, displays questions with timer,
 * submits answers, and auto-completes when time expires or user finishes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Flag,
} from 'lucide-react'
import {
  startAssessmentSession,
  submitAnswer,
  completeSession,
  getAssessment,
  getSessionQuestions,
  getExistingAnswers,
  reportTabSwitch,
  getMyAssessmentSessions,
  expireStaleSessions,
} from '@/actions/assessment-actions'
import { useOrg } from '@/components/providers/OrgProvider'
import { Button } from '@/components/ui/Button'
import type { Assessment, AssessmentSession } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'
import { ExamInstructions } from './ExamInstructions'
import { TabWarningDialog, TimeWarningDialog, MobileNavDialog, ReviewSummaryDialog } from './ExamDialogs'

type QuestionData = {
  cardTemplateId: string
  stem: string
  options: string[]
  /** Maps display index → original index (for shuffled options) */
  optionMap: number[]
  selectedIndex: number | null
  answered: boolean
  flagged: boolean
}

/**
 * Seeded shuffle using session+card IDs for deterministic option order per session.
 * Returns shuffled indices array (e.g., [2, 0, 3, 1]).
 */
function seededShuffle(seed: string, length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i)
  // Hash seed string to 32-bit integer
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  h = h >>> 0 // Convert to unsigned
  // Mulberry32 PRNG — uniform [0, 1) distribution, no modulo bias
  function mulberry32(): number {
    h |= 0; h = h + 0x6D2B79F5 | 0
    let t = Math.imul(h ^ h >>> 15, 1 | h)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  // Fisher-Yates with unbiased seeded random
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(mulberry32() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices
}

export default function TakeAssessmentPage() {
  usePageTitle('Ujian')
  const router = useRouter()
  const params = useParams()
  const { org } = useOrg()
  const assessmentId = params.id as string
  const proctoringEnabled = org.settings.features.proctoring

  const [phase, setPhase] = useState<'loading' | 'instructions' | 'exam'>('loading')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [fullscreenExited, setFullscreenExited] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [accessCodeInput, setAccessCodeInput] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completingRef = useRef(false)
  const questionStartRef = useRef<number>(0)

  // startExam logic — used by both init effect and onClick handler
  async function startExamImpl(assessmentData?: Assessment, existingSession?: AssessmentSession) {
    setStarting(true)
    const a = assessmentData ?? assessment
    if (!a) return

    let sessionData: AssessmentSession
    if (existingSession) {
      sessionData = existingSession
    } else {
      const sResult = await startAssessmentSession(assessmentId, accessCodeInput || undefined)
      if (!sResult.ok) {
        setError(sResult.error)
        setStarting(false)
        setLoading(false)
        return
      }
      if (!sResult.data) {
        setError('Gagal memulai sesi')
        setStarting(false)
        setLoading(false)
        return
      }
      sessionData = sResult.data
    }

    setSession(sessionData)
    setTimeRemaining(sessionData.time_remaining_seconds)

    // Fetch question stems and options
    const shouldShuffleOptions = a.shuffle_options
    const qResult = await getSessionQuestions(sessionData.id)
    let qs: QuestionData[]
    if (qResult.ok && qResult.data) {
      qs = qResult.data.map((q) => {
        const identity = Array.from({ length: q.options.length }, (_, i) => i)
        if (shouldShuffleOptions && q.options.length > 1) {
          // Deterministic shuffle based on session + card ID
          const shuffled = seededShuffle(sessionData.id + q.cardTemplateId, q.options.length)
          return {
            cardTemplateId: q.cardTemplateId,
            stem: q.stem,
            options: shuffled.map((i) => q.options[i]),
            optionMap: shuffled,
            selectedIndex: null,
            answered: false,
            flagged: false,
          }
        }
        return {
          cardTemplateId: q.cardTemplateId,
          stem: q.stem,
          options: q.options,
          optionMap: identity,
          selectedIndex: null,
          answered: false,
          flagged: false,
        }
      })
    } else {
      qs = sessionData.question_order.map((cardId) => ({
        cardTemplateId: cardId,
        stem: '',
        options: [],
        optionMap: [],
        selectedIndex: null,
        answered: false,
        flagged: false,
      }))
    }

    // Restore previously submitted answers (session resume)
    // Server stores original indices, so we need to reverse-map to display indices
    const existingResult = await getExistingAnswers(sessionData.id)
    if (existingResult.ok && existingResult.data && existingResult.data.length > 0) {
      const answerMap = new Map(
        existingResult.data.map((ans) => [ans.cardTemplateId, ans.selectedIndex])
      )
      qs = qs.map((q) => {
        const originalIndex = answerMap.get(q.cardTemplateId)
        if (originalIndex !== undefined) {
          // Find display index that maps to this original index
          const displayIndex = q.optionMap.indexOf(originalIndex)
          return { ...q, selectedIndex: displayIndex >= 0 ? displayIndex : originalIndex, answered: true }
        }
        return q
      })
    }

    setQuestions(qs)
    setLoading(false)
    setStarting(false)
    setPhase('exam')

    // Request fullscreen for exam lockdown (only when proctoring is enabled)
    if (proctoringEnabled) {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {})
        }
      } catch {
        // Fullscreen not supported or denied — continue without it
      }
    }
  }

  // Wrapper function for startExam (used by JSX onClick)
  async function startExam(assessmentData?: Assessment, existingSession?: AssessmentSession) {
    return startExamImpl(assessmentData, existingSession)
  }

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  function toggleFlag() {
    const updated = [...questions]
    const q = updated[currentIndex]
    if (!q) return
    updated[currentIndex] = { ...q, flagged: !q.flagged }
    setQuestions(updated)
  }

  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSelectAnswer(displayIndex: number) {
    if (!session || completing) return

    const q = questions[currentIndex]
    if (!q) return

    // Clear any previous submit error
    setSubmitError(null)

    // Optimistic update (store display index locally)
    const updated = [...questions]
    updated[currentIndex] = { ...q, selectedIndex: displayIndex, answered: true }
    setQuestions(updated)

    // Map display index → original index for server submission
    const originalIndex = q.optionMap[displayIndex] ?? displayIndex
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000)

    // Submit with retry on failure
    try {
      const result = await submitAnswer(session.id, q.cardTemplateId, originalIndex, timeRemaining ?? undefined, timeSpent)
      if (!result.ok) {
        // Retry once
        const retry = await submitAnswer(session.id, q.cardTemplateId, originalIndex, timeRemaining ?? undefined, timeSpent)
        if (!retry.ok) {
          setSubmitError('Jawaban gagal disimpan. Coba pilih ulang.')
        }
      }
    } catch {
      // Network error — retry once
      try {
        await submitAnswer(session.id, q.cardTemplateId, originalIndex, timeRemaining ?? undefined, timeSpent)
      } catch {
        setSubmitError('Koneksi terputus. Jawaban belum tersimpan.')
      }
    }
  }

  // Load assessment info (not session yet) for instructions
  useEffect(() => {
    async function init() {
      const aResult = await getAssessment(assessmentId)
      if (!aResult.ok) {
        setError(aResult.error)
        setLoading(false)
        return
      }
      if (!aResult.data) {
        setError('Asesmen tidak ditemukan')
        setLoading(false)
        return
      }
      setAssessment(aResult.data)

      // Auto-expire any stale sessions before checking for resumable ones
      await expireStaleSessions()

      // Check if there's an existing in-progress session to resume
      const sessionsResult = await getMyAssessmentSessions()
      if (sessionsResult.ok && sessionsResult.data) {
        const mySessions = sessionsResult.data.filter((s) => s.assessment_id === assessmentId)
        setAttemptCount(mySessions.length)
        const inProgress = mySessions.find((s) => s.status === 'in_progress')
        if (inProgress) {
          // Resume existing session directly
          await startExamImpl(aResult.data, inProgress as AssessmentSession)
          return
        }
      }

      setLoading(false)
      setPhase('instructions')
    }
    init()
  }, [assessmentId])

  // Auto-complete handler (stable ref to avoid stale closures in timer)
  const handleCompleteRef = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setCompleting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})

    // Read session from ref via state updater to avoid stale closure
    setSession((currentSession) => {
      if (currentSession) {
        completeSession(currentSession.id).then((result) => {
          if (result.ok) {
            router.push(`/assessments/${assessmentId}/results?sessionId=${currentSession.id}`)
          } else {
            setError(result.error ?? 'Gagal menyelesaikan sesi')
            setCompleting(false)
            completingRef.current = false
          }
        })
      }
      return currentSession
    })
  }, [assessmentId, router])

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || completing) return

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleCompleteRef()
          return 0
        }
        if (prev === 31) {
          setShowTimeWarning(true)
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timeRemaining !== null, completing, handleCompleteRef])

  // Tab-switch detection (only when proctoring is enabled, debounced to 1 report/2s)
  useEffect(() => {
    if (!proctoringEnabled || !session || completing) return

    const sessionId = session.id
    let lastReportTime = 0
    function handleVisibilityChange() {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1)
        setShowTabWarning(true)
        // Debounce: report at most once every 2 seconds
        const now = Date.now()
        if (now - lastReportTime > 2000) {
          lastReportTime = now
          reportTabSwitch(sessionId)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [proctoringEnabled, session, completing])

  // Fullscreen exit detection (only when proctoring is enabled)
  useEffect(() => {
    if (!proctoringEnabled || phase !== 'exam' || !session || completing) return

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setFullscreenExited(true)
        setTabSwitchCount((prev) => prev + 1)
        setShowTabWarning(true)
        reportTabSwitch(session!.id)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [proctoringEnabled, phase, session, completing])

  // Warn before closing/navigating away from in-progress exam
  useEffect(() => {
    if (!session || completing) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session, completing])

  // Reset per-question timer when navigating between questions
  useEffect(() => {
    questionStartRef.current = Date.now()
  }, [currentIndex])

  // Keyboard navigation
  useEffect(() => {
    if (phase !== 'exam' || !session || completing) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if a modal is open
      if (showConfirmFinish || showTabWarning) {
        if (e.key === 'Escape') {
          setShowConfirmFinish(false)
          setShowTabWarning(false)
        }
        return
      }

      const q = questions[currentIndex]
      if (!q) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
          break
        case 'a': case 'A': case '1':
          if (q.options.length > 0) handleSelectAnswer(0)
          break
        case 'b': case 'B': case '2':
          if (q.options.length > 1) handleSelectAnswer(1)
          break
        case 'c': case 'C': case '3':
          if (q.options.length > 2) handleSelectAnswer(2)
          break
        case 'd': case 'D': case '4':
          if (q.options.length > 3) handleSelectAnswer(3)
          break
        case 'e': case 'E': case '5':
          if (q.options.length > 4) handleSelectAnswer(4)
          break
        case 'f': case 'F':
          e.preventDefault()
          toggleFlag()
          break
        case 'Enter':
          e.preventDefault()
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((i) => i + 1)
          } else {
            setShowConfirmFinish(true)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [phase, session, completing, currentIndex, questions, showConfirmFinish, showTabWarning])

  async function handleComplete() {
    if (!session || completing) return
    setCompleting(true)
    completingRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)

    // Exit fullscreen before navigating
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    const result = await completeSession(session.id)
    if (result.ok) {
      router.push(`/assessments/${assessmentId}/results?sessionId=${session.id}`)
    } else {
      setError(result.error ?? 'Gagal menyelesaikan sesi')
      setCompleting(false)
      completingRef.current = false
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-8" />
        <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  // Pre-assessment instructions screen
  if (phase === 'instructions' && assessment) {
    return (
      <ExamInstructions
        assessment={assessment}
        attemptCount={attemptCount}
        proctoringEnabled={proctoringEnabled}
        accessCodeInput={accessCodeInput}
        onAccessCodeChange={setAccessCodeInput}
        onStart={() => startExam()}
        starting={starting}
        error={error}
      />
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500" aria-hidden="true" />
        <p className="text-red-600 dark:text-red-400 mb-4" role="alert">{error}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Kembali ke Asesmen
        </Button>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const answeredCount = questions.filter((q) => q.answered).length
  const isLastQuestion = currentIndex === questions.length - 1
  const isTimeLow = timeRemaining !== null && timeRemaining < 60

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header: Timer + Progress */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Soal {currentIndex + 1} dari {questions.length}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-500">
            {answeredCount}/{questions.length} dijawab
          </div>
          {timeRemaining !== null && (
            <div
              role="timer"
              aria-label={`Sisa waktu: ${formatTime(timeRemaining)}`}
              aria-live={isTimeLow ? 'assertive' : 'off'}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono font-medium ${
                isTimeLow
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-label={`Soal ${currentIndex + 1} dari ${questions.length}`}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-8"
      >
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Submit error banner */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* Question */}
      {currentQuestion && (
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
              {currentQuestion.stem || `Soal ${currentIndex + 1}`}
            </h2>
            <button
              onClick={toggleFlag}
              aria-label={currentQuestion.flagged ? 'Hapus tanda soal ini' : 'Tandai soal ini'}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                currentQuestion.flagged
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Flag className="h-4 w-4" fill={currentQuestion.flagged ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="space-y-3" role="radiogroup" aria-label={`Pilihan untuk soal ${currentIndex + 1}`}>
            {currentQuestion.options.map((option, idx) => {
              const isSelected = currentQuestion.selectedIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  disabled={completing}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Pilihan ${String.fromCharCode(65 + idx)}: ${option}`}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm text-slate-800 dark:text-slate-200 pt-0.5">
                      {option}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </Button>

        <div className="flex items-center gap-2">
          {/* Mobile question jump button */}
          <button
            onClick={() => setShowMobileNav(true)}
            className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform"
            aria-label="Lompat ke soal"
          >
            <span>Q {currentIndex + 1}/{questions.length}</span>
            <span className="text-[10px] text-slate-400">ketuk</span>
          </button>

          {/* Question dots (desktop) */}
          <nav className="hidden sm:flex items-center gap-1" aria-label="Navigasi soal">
            {questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === currentIndex
                    ? 'bg-blue-600'
                    : q.flagged
                      ? 'bg-amber-400 ring-1 ring-amber-500'
                      : q.answered
                        ? 'bg-green-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-label={`Soal ${idx + 1}${q.answered ? ', dijawab' : ', belum dijawab'}${q.flagged ? ', ditandai' : ''}${idx === currentIndex ? ', saat ini' : ''}`}
                aria-current={idx === currentIndex ? 'step' : undefined}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isLastQuestion ? (
            <Button
              size="sm"
              onClick={() => setShowConfirmFinish(true)}
              disabled={completing}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Tinjau &amp;</span> Kirim
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 text-center text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
        <span className="inline-flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">A-E</kbd> pilih</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">&larr; &rarr;</kbd> navigasi</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">F</kbd> tandai</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">Enter</kbd> lanjut</span>
        </span>
      </div>

      {/* Tab Switch Warning */}
      {showTabWarning && (
        <TabWarningDialog
          tabSwitchCount={tabSwitchCount}
          fullscreenExited={fullscreenExited}
          onClose={() => setShowTabWarning(false)}
          onReenterFullscreen={() => {
            document.documentElement.requestFullscreen().catch(() => {})
            setFullscreenExited(false)
            setShowTabWarning(false)
          }}
        />
      )}

      {/* Time Warning (30 seconds remaining) */}
      {showTimeWarning && (
        <TimeWarningDialog onClose={() => setShowTimeWarning(false)} />
      )}

      {/* Mobile Question Navigation */}
      {showMobileNav && (
        <MobileNavDialog
          questions={questions}
          currentIndex={currentIndex}
          onSelectQuestion={setCurrentIndex}
          onClose={() => setShowMobileNav(false)}
        />
      )}

      {/* Review Summary */}
      {showConfirmFinish && (
        <ReviewSummaryDialog
          questions={questions}
          answeredCount={answeredCount}
          completing={completing}
          onSelectQuestion={setCurrentIndex}
          onClose={() => setShowConfirmFinish(false)}
          onSubmit={handleComplete}
        />
      )}
    </div>
  )
}
