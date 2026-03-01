'use client'

/**
 * Exam modal dialogs: Tab switch warning, time warning, mobile navigation, review summary.
 * Extracted from take/page.tsx for maintainability (#174).
 */

import { AlertTriangle, Clock, CheckCircle2, Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type QuestionData = {
  cardTemplateId: string
  stem: string
  options: string[]
  optionMap: number[]
  selectedIndex: number | null
  answered: boolean
  flagged: boolean
}

// --- Tab Switch Warning ---

interface TabWarningDialogProps {
  tabSwitchCount: number
  fullscreenExited: boolean
  onClose: () => void
  onReenterFullscreen: () => void
}

export function TabWarningDialog({
  tabSwitchCount,
  fullscreenExited,
  onClose,
  onReenterFullscreen,
}: TabWarningDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="tab-warning-title">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" aria-hidden="true" />
        <h3 id="tab-warning-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Peringatan
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
          Anda meninggalkan halaman ujian. Ini telah dicatat.
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
          Pelanggaran: {tabSwitchCount}
        </p>
        <div className="flex items-center gap-2 justify-center">
          <Button size="sm" onClick={onClose}>
            Kembali ke Ujian
          </Button>
          {fullscreenExited && !document.fullscreenElement && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onReenterFullscreen}
            >
              Layar Penuh
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Time Warning ---

interface TimeWarningDialogProps {
  onClose: () => void
}

export function TimeWarningDialog({ onClose }: TimeWarningDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="time-warning-title">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl text-center">
        <Clock className="h-10 w-10 mx-auto mb-3 text-red-500" aria-hidden="true" />
        <h3 id="time-warning-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Waktu Hampir Habis!
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Kurang dari 30 detik tersisa. Jawaban akan otomatis dikirim saat waktu habis.
        </p>
        <Button size="sm" onClick={onClose}>
          Lanjutkan
        </Button>
      </div>
    </div>
  )
}

// --- Mobile Question Navigation ---

interface MobileNavDialogProps {
  questions: QuestionData[]
  currentIndex: number
  onSelectQuestion: (index: number) => void
  onClose: () => void
}

export function MobileNavDialog({ questions, currentIndex, onSelectQuestion, onClose }: MobileNavDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Question navigation">
      <div className="bg-white dark:bg-slate-800 rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-sm mx-0 sm:mx-4 shadow-xl max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Lompat ke Soal
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
            aria-label="Tutup navigasi"
          >
            &times;
          </button>
        </div>
        <div className="flex items-center gap-3 mb-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> dijawab</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> ditandai</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> belum dijawab</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelectQuestion(idx)
                onClose()
              }}
              className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                idx === currentIndex
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : q.flagged
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-400'
                    : q.answered
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              } active:scale-95`}
            >
              {idx + 1}
              {q.flagged && (
                <Flag className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500" fill="currentColor" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Review Summary ---

interface ReviewSummaryDialogProps {
  questions: QuestionData[]
  answeredCount: number
  completing: boolean
  onSelectQuestion: (index: number) => void
  onClose: () => void
  onSubmit: () => void
}

export function ReviewSummaryDialog({
  questions,
  answeredCount,
  completing,
  onSelectQuestion,
  onClose,
  onSubmit,
}: ReviewSummaryDialogProps) {
  const flaggedCount = questions.filter((q) => q.flagged).length
  const unansweredCount = questions.length - answeredCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
        <h3 id="review-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Tinjau Sebelum Mengirim
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">{answeredCount} dijawab</span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-slate-600 dark:text-slate-400">{unansweredCount} belum dijawab</span>
            </div>
          )}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-600 dark:text-slate-400">{flaggedCount} ditandai</span>
            </div>
          )}
        </div>

        {/* Question grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 mb-4">
          {questions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelectQuestion(idx)
                onClose()
              }}
              className={`relative w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                q.flagged
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-400'
                  : q.answered
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              } hover:ring-2 hover:ring-blue-400`}
              aria-label={`Soal ${idx + 1}: ${q.answered ? 'dijawab' : 'belum dijawab'}${q.flagged ? ', ditandai' : ''}`}
            >
              {idx + 1}
              {q.flagged && (
                <Flag className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500" fill="currentColor" />
              )}
            </button>
          ))}
        </div>

        {unansweredCount > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            {unansweredCount} soal belum dijawab akan dianggap salah.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Kembali ke Ujian
          </Button>
          <Button
            size="sm"
            loading={completing}
            onClick={onSubmit}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Kirim
          </Button>
        </div>
      </div>
    </div>
  )
}
