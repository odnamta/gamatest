'use client'

/**
 * Pre-assessment instructions screen.
 * Extracted from take/page.tsx for maintainability (#174).
 */

import { useRouter } from 'next/navigation'
import {
  Clock, Target, Shuffle, RotateCcw, Eye, EyeOff, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Assessment } from '@/types/database'

interface ExamInstructionsProps {
  assessment: Assessment
  attemptCount: number
  proctoringEnabled: boolean
  accessCodeInput: string
  onAccessCodeChange: (value: string) => void
  onStart: () => void
  starting: boolean
  error: string | null
}

export function ExamInstructions({
  assessment,
  attemptCount,
  proctoringEnabled,
  accessCodeInput,
  onAccessCodeChange,
  onStart,
  starting,
  error,
}: ExamInstructionsProps) {
  const router = useRouter()

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        {assessment.title}
      </h1>
      {assessment.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {assessment.description}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Aturan Asesmen
        </h2>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span>Batas waktu: <strong>{assessment.time_limit_minutes} menit</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span>Skor lulus: <strong>{assessment.pass_score}%</strong> ({assessment.question_count} soal)</span>
          </div>
          {assessment.shuffle_questions && (
            <div className="flex items-center gap-3">
              <Shuffle className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span>Soal ditampilkan secara acak</span>
            </div>
          )}
          {assessment.max_attempts && (
            <div className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>
                {assessment.max_attempts - attemptCount} dari {assessment.max_attempts} percobaan tersisa
              </span>
            </div>
          )}
          {assessment.cooldown_minutes && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>Jeda {assessment.cooldown_minutes} menit antar percobaan</span>
            </div>
          )}
          {assessment.allow_review ? (
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span>Anda dapat meninjau jawaban setelah selesai</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <EyeOff className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span>Tinjauan jawaban tidak tersedia untuk asesmen ini</span>
            </div>
          )}
          {proctoringEnabled && (
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span>Mode layar penuh diperlukan — perpindahan tab dan keluar dipantau</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Timer dimulai segera setelah Anda klik &quot;Mulai Asesmen&quot;. Pastikan koneksi stabil dan Anda siap menyelesaikan ujian.
        </p>
      </div>

      {assessment.access_code && (
        <div className="mb-4">
          <label htmlFor="access-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kode Akses
          </label>
          <input
            id="access-code"
            type="text"
            placeholder="Masukkan kode akses..."
            value={accessCodeInput}
            onChange={(e) => onAccessCodeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => router.push('/assessments')}
          className="flex-1"
        >
          Kembali
        </Button>
        <Button
          onClick={onStart}
          loading={starting}
          disabled={starting || (!!assessment.access_code && !accessCodeInput)}
          className="flex-1"
        >
          Mulai Asesmen
        </Button>
      </div>
    </div>
  )
}
