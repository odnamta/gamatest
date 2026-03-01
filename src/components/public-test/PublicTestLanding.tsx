'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, FileText, Target, Shield, AlertCircle, Loader2 } from 'lucide-react'
import { registerAndStartSession } from '@/actions/public-assessment-actions'
import type { Assessment } from '@/types/database'

type PublicAssessment = Pick<
  Assessment,
  | 'id'
  | 'title'
  | 'description'
  | 'time_limit_minutes'
  | 'pass_score'
  | 'question_count'
  | 'access_code'
  | 'shuffle_questions'
  | 'allow_review'
  | 'max_attempts'
  | 'start_date'
  | 'end_date'
>

interface PublicTestLandingProps {
  code: string
  assessment: PublicAssessment
  orgName: string
}

export function PublicTestLanding({ code, assessment, orgName }: PublicTestLandingProps) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const hasEmail = email.trim().length > 0
  const hasPhone = phone.trim().length > 0
  const hasContact = hasEmail || hasPhone
  const nameValid = name.trim().length >= 2
  const accessCodeRequired = assessment.access_code === 'required'
  const accessCodeValid = !accessCodeRequired || accessCode.trim().length > 0

  const formValid = nameValid && hasContact && accessCodeValid

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!formValid) return
    setShowConfirm(true)
  }

  async function handleConfirm() {
    setShowConfirm(false)
    setError('')
    setLoading(true)

    try {
      const result = await registerAndStartSession(code, {
        name: name.trim(),
        email: hasEmail ? email.trim() : undefined,
        phone: hasPhone ? phone.trim() : undefined,
        accessCode: accessCodeRequired ? accessCode.trim() : undefined,
      })

      if (!result.ok || !result.data) {
        setError(!result.ok ? result.error : 'Terjadi kesalahan. Silakan coba lagi.')
        setLoading(false)
        return
      }

      const { sessionId, sessionToken, timeRemainingSeconds } = result.data

      // Store session data for the exam page
      sessionStorage.setItem(
        'cekatan_session_' + code,
        JSON.stringify({ sessionId, sessionToken, timeRemainingSeconds })
      )

      router.push('/t/' + code + '/exam')
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Org name */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
        {orgName}
      </p>

      {/* Assessment title */}
      <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {assessment.title}
      </h1>

      {/* Metadata cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
          <FileText className="mx-auto mb-1.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {assessment.question_count}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Soal</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
          <Clock className="mx-auto mb-1.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {assessment.time_limit_minutes}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Menit</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-center">
          <Target className="mx-auto mb-1.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {assessment.pass_score}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Nilai Lulus</p>
        </div>
      </div>

      {/* Description */}
      {assessment.description && (
        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {assessment.description}
          </p>
        </div>
      )}

      {/* Registration form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Access code input */}
        {accessCodeRequired && (
          <div>
            <label
              htmlFor="accessCode"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Shield className="inline-block mr-1.5 h-4 w-4" />
              Kode Akses
            </label>
            <input
              id="accessCode"
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Masukkan kode akses"
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
            />
          </div>
        )}

        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama Anda"
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Email {hasPhone ? <span className="font-normal text-gray-400">(opsional)</span> : null}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nomor HP {hasEmail ? <span className="font-normal text-gray-400">(opsional)</span> : null}
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Helper text */}
        {!hasContact && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Isi email ATAU nomor HP (minimal salah satu)
          </p>
        )}

        {/* Error message */}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!formValid || loading}
          aria-label={loading ? 'Memproses pendaftaran' : 'Mulai Tes'}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Memproses...
            </>
          ) : (
            'Mulai Tes'
          )}
        </button>
      </form>

      {/* Confirmation dialog */}
      {showConfirm && (
        <ConfirmModal
          name={name}
          email={email}
          phone={phone}
          hasEmail={hasEmail}
          hasPhone={hasPhone}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}

// ----- Confirm Modal with ARIA + focus trap -----

interface ConfirmModalProps {
  name: string
  email: string
  phone: string
  hasEmail: boolean
  hasPhone: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmModal({ name, email, phone, hasEmail, hasPhone, onCancel, onConfirm }: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  const headingId = 'confirm-modal-heading'

  // Focus first button on mount
  useEffect(() => {
    cancelBtnRef.current?.focus()
  }, [])

  // Focus trap + Escape handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
        return
      }

      if (e.key === 'Tab') {
        const focusable = [cancelBtnRef.current, confirmBtnRef.current].filter(
          Boolean
        ) as HTMLElement[]
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [onCancel]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      ref={modalRef}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full space-y-4">
        <h2
          id={headingId}
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          Konfirmasi Data Anda
        </h2>

        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <span className="font-medium">Nama:</span> {name.trim()}
          </div>
          {hasEmail && (
            <div>
              <span className="font-medium">Email:</span> {email.trim()}
            </div>
          )}
          {hasPhone && (
            <div>
              <span className="font-medium">No. HP:</span> {phone.trim()}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pastikan data Anda benar. Data ini tidak bisa diubah setelah tes dimulai.
        </p>

        <div className="flex gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition"
          >
            Batalkan
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition"
          >
            Mulai Tes
          </button>
        </div>
      </div>
    </div>
  )
}
