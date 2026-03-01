'use client'

/**
 * PublicExam — Public exam-taking engine for /t/[code]/exam
 *
 * Reads session from sessionStorage (set by registration landing page).
 * Loads questions, runs countdown timer, handles proctoring (tab switch + fullscreen),
 * keyboard navigation, review phase, and submission.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
  Flag, Loader2, Send,
} from 'lucide-react'
import {
  getPublicQuestions,
  submitPublicAnswer,
  completePublicSession,
  reportPublicTabSwitch,
} from '@/actions/public-assessment-actions'

// ============================================
// Types
// ============================================

type QuestionData = {
  cardTemplateId: string
  stem: string
  options: string[]
  selectedIndex: number | null
  flagged: boolean
}

type SessionStorageData = {
  sessionId: string
  sessionToken: string
  timeRemainingSeconds: number
}

// ============================================
// Component
// ============================================

export function PublicExam({ code }: { code: string }) {
  const router = useRouter()

  const [phase, setPhase] = useState<'loading' | 'exam' | 'review' | 'submitting'>('loading')
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [assessmentTitle, setAssessmentTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [showTimeWarning, setShowTimeWarning] = useState(false)

  const sessionIdRef = useRef<string>('')
  const sessionTokenRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completingRef = useRef(false)
  const questionStartRef = useRef<number>(Date.now())

  // ------------------------------------------
  // Init: read sessionStorage + load questions
  // ------------------------------------------
  useEffect(() => {
    async function init() {
      // Read session from sessionStorage
      const raw = sessionStorage.getItem('cekatan_session_' + code)
      if (!raw) {
        // No session data — redirect back to registration
        router.replace('/t/' + code)
        return
      }

      let sessionData: SessionStorageData
      try {
        sessionData = JSON.parse(raw) as SessionStorageData
      } catch {
        router.replace('/t/' + code)
        return
      }

      const { sessionId, sessionToken, timeRemainingSeconds } = sessionData
      sessionIdRef.current = sessionId
      sessionTokenRef.current = sessionToken || sessionId

      // Load questions from server (use signed token)
      const result = await getPublicQuestions(sessionTokenRef.current)
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Gagal memuat soal' : result.error)
        setPhase('exam')
        return
      }

      const { questions: serverQuestions, timeRemainingSeconds: serverTime, assessmentTitle: title } = result.data

      // Map server questions to local state
      const qs: QuestionData[] = serverQuestions.map((q) => ({
        cardTemplateId: q.cardTemplateId,
        stem: q.stem,
        options: q.options,
        selectedIndex: q.selectedIndex,
        flagged: false,
      }))

      setQuestions(qs)
      setAssessmentTitle(title)
      // Use server time (more accurate for resume) or fallback to sessionStorage time
      setTimeRemaining(serverTime > 0 ? serverTime : timeRemainingSeconds)
      setPhase('exam')

      // Request fullscreen
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {})
        }
      } catch {
        // Fullscreen not supported or denied
      }
    }

    init()
  }, [code, router])

  // ------------------------------------------
  // Auto-complete handler (stable ref)
  // ------------------------------------------
  const handleAutoComplete = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setPhase('submitting')

    if (timerRef.current) clearInterval(timerRef.current)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})

    const token = sessionTokenRef.current
    if (!token) return

    const result = await completePublicSession(token)
    if (result.ok) {
      router.push('/t/' + code + '/results/' + encodeURIComponent(token))
    } else {
      setError(result.error ?? 'Gagal mengirim jawaban')
      setPhase('exam')
      completingRef.current = false
    }
  }, [code, router])

  // ------------------------------------------
  // Timer countdown
  // ------------------------------------------
  useEffect(() => {
    if (phase !== 'exam' || timeRemaining <= 0) return

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleAutoComplete()
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
  }, [phase, timeRemaining > 0, handleAutoComplete])

  // ------------------------------------------
  // Tab-switch detection (visibility change)
  // ------------------------------------------
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'review') return

    let lastReportTime = 0
    function handleVisibilityChange() {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1)
        setShowTabWarning(true)
        // Debounce: report at most once every 2 seconds
        const now = Date.now()
        if (now - lastReportTime > 2000 && sessionTokenRef.current) {
          lastReportTime = now
          reportPublicTabSwitch(sessionTokenRef.current).catch(() => {})
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [phase])

  // ------------------------------------------
  // Fullscreen exit detection
  // ------------------------------------------
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'review') return

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setTabSwitchCount((prev) => prev + 1)
        setShowTabWarning(true)
        if (sessionTokenRef.current) {
          reportPublicTabSwitch(sessionTokenRef.current).catch(() => {})
        }
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [phase])

  // ------------------------------------------
  // Warn before closing/navigating
  // ------------------------------------------
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'review') return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  // ------------------------------------------
  // Reset per-question timer on navigation
  // ------------------------------------------
  useEffect(() => {
    questionStartRef.current = Date.now()
  }, [currentIndex])

  // ------------------------------------------
  // Keyboard navigation
  // ------------------------------------------
  useEffect(() => {
    if (phase !== 'exam') return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when modal is open
      if (showTabWarning || showTimeWarning) {
        if (e.key === 'Escape') {
          setShowTabWarning(false)
          setShowTimeWarning(false)
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
            setPhase('review')
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, questions, showTabWarning, showTimeWarning])

  // ------------------------------------------
  // Helpers
  // ------------------------------------------

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function toggleFlag() {
    const updated = [...questions]
    const q = updated[currentIndex]
    if (!q) return
    updated[currentIndex] = { ...q, flagged: !q.flagged }
    setQuestions(updated)
  }

  async function handleSelectAnswer(idx: number) {
    if (completingRef.current) return

    const q = questions[currentIndex]
    if (!q) return

    // Optimistic update
    const updated = [...questions]
    updated[currentIndex] = { ...q, selectedIndex: idx }
    setQuestions(updated)

    // Fire and forget — submit answer in background
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000)
    submitPublicAnswer(sessionTokenRef.current, q.cardTemplateId, idx, timeRemaining, timeSpent)
      .catch((err) => console.error('[submitPublicAnswer]', err))
  }

  async function handleComplete() {
    if (completingRef.current) return
    completingRef.current = true
    setPhase('submitting')

    if (timerRef.current) clearInterval(timerRef.current)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})

    const token = sessionTokenRef.current
    const result = await completePublicSession(token)
    if (result.ok) {
      router.push('/t/' + code + '/results/' + encodeURIComponent(token))
    } else {
      setError(result.error ?? 'Gagal mengirim jawaban')
      setPhase('review')
      completingRef.current = false
    }
  }

  // ------------------------------------------
  // Derived state
  // ------------------------------------------
  const answeredCount = questions.filter((q) => q.selectedIndex !== null).length
  const unansweredCount = questions.length - answeredCount
  const flaggedCount = questions.filter((q) => q.flagged).length
  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const isTimeLow = timeRemaining < 60

  // ------------------------------------------
  // Loading state
  // ------------------------------------------
  if (phase === 'loading') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-8" />
        <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
          ))}
        </div>
      </div>
    )
  }

  // ------------------------------------------
  // Submitting state
  // ------------------------------------------
  if (phase === 'submitting') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-spin" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Mengirim jawaban...
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Jangan tutup halaman ini
        </p>
      </div>
    )
  }

  // ------------------------------------------
  // Error state (no questions)
  // ------------------------------------------
  if (error && questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500" aria-hidden="true" />
        <p className="text-red-600 dark:text-red-400 mb-4" role="alert">{error}</p>
        <button
          onClick={() => router.push('/t/' + code)}
          className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 active:scale-95 transition"
        >
          Kembali
        </button>
      </div>
    )
  }

  // ------------------------------------------
  // Review phase
  // ------------------------------------------
  if (phase === 'review') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 -mx-4 px-4 py-3 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              Ringkasan Jawaban
            </h1>
            <div
              role="timer"
              aria-label={'Sisa waktu: ' + formatTime(timeRemaining)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono font-medium ${
                isTimeLow
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 mb-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">{answeredCount} dijawab</span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="text-gray-600 dark:text-gray-400">{unansweredCount} belum dijawab</span>
            </div>
          )}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-gray-600 dark:text-gray-400">{flaggedCount} ditandai</span>
            </div>
          )}
        </div>

        {/* Question grid */}
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 mb-6">
          {questions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx)
                setPhase('exam')
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                q.flagged
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-400'
                  : q.selectedIndex !== null
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              } hover:ring-2 hover:ring-blue-400 active:scale-95`}
              aria-label={`Soal ${idx + 1}: ${q.selectedIndex !== null ? 'dijawab' : 'belum dijawab'}${q.flagged ? ', ditandai' : ''}`}
            >
              {idx + 1}
              {q.flagged && (
                <Flag className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500" fill="currentColor" />
              )}
            </button>
          ))}
        </div>

        {/* Warning for unanswered */}
        {unansweredCount > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-6">
            {unansweredCount} soal belum dijawab akan dianggap salah.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPhase('exam')}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition"
          >
            Kembali ke Soal
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            Kirim Jawaban
          </button>
        </div>
      </div>
    )
  }

  // ------------------------------------------
  // Exam phase (main)
  // ------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 -mx-4 px-4 py-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {assessmentTitle}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Soal {currentIndex + 1} dari {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">
              Dijawab: {answeredCount}
            </span>
            <div
              role="timer"
              aria-label={'Sisa waktu: ' + formatTime(timeRemaining)}
              aria-live={isTimeLow ? 'assertive' : 'off'}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono font-medium ${
                isTimeLow
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-label={answeredCount + ' dari ' + questions.length + ' soal dijawab'}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-8"
      >
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
        />
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
              {currentQuestion.stem || 'Soal ' + (currentIndex + 1)}
            </h2>
            <button
              onClick={toggleFlag}
              aria-label={currentQuestion.flagged ? 'Hapus tanda soal ini' : 'Tandai soal ini'}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                currentQuestion.flagged
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Flag className="h-4 w-4" fill={currentQuestion.flagged ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="space-y-3" role="radiogroup" aria-label={'Pilihan untuk soal ' + (currentIndex + 1)}>
            {currentQuestion.options.map((option, idx) => {
              const isSelected = currentQuestion.selectedIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  disabled={completingRef.current}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={'Pilihan ' + String.fromCharCode(65 + idx) + ': ' + option}
                  className={`w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm text-gray-800 dark:text-gray-200 pt-0.5">
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
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
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
                    : q.selectedIndex !== null
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={'Soal ' + (idx + 1) + (q.selectedIndex !== null ? ', dijawab' : ', belum dijawab') + (q.flagged ? ', ditandai' : '') + (idx === currentIndex ? ', saat ini' : '')}
              aria-current={idx === currentIndex ? 'step' : undefined}
            />
          ))}
        </nav>

        {/* Mobile question jump */}
        <button
          onClick={() => setPhase('review')}
          className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 active:scale-95 transition"
          aria-label="Lihat ringkasan"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {answeredCount}/{questions.length}
        </button>

        <div className="flex items-center gap-2">
          {isLastQuestion ? (
            <button
              onClick={() => setPhase('review')}
              className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition inline-flex items-center gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Selesai</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-2 rounded-lg font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition inline-flex items-center gap-1"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard hints (desktop) */}
      <div className="mt-4 text-center text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
        <span className="inline-flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">A-E</kbd> pilih</span>
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">&larr; &rarr;</kbd> navigasi</span>
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">F</kbd> tandai</span>
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">Enter</kbd> lanjut</span>
        </span>
      </div>

      {/* Tab Switch Warning Modal */}
      {showTabWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="tab-warning-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" aria-hidden="true" />
            <h3 id="tab-warning-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Peringatan
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Anda meninggalkan halaman ujian. Ini telah dicatat.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
              Pelanggaran: {tabSwitchCount}
            </p>
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => {
                  setShowTabWarning(false)
                  // Try to re-enter fullscreen
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {})
                  }
                }}
                className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
              >
                Kembali ke Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Warning Modal (30 seconds) */}
      {showTimeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="time-warning-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl text-center">
            <Clock className="h-10 w-10 mx-auto mb-3 text-red-500" aria-hidden="true" />
            <h3 id="time-warning-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Waktu Hampir Habis!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Kurang dari 30 detik tersisa. Jawaban akan otomatis dikirim saat waktu habis.
            </p>
            <button
              onClick={() => setShowTimeWarning(false)}
              className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
