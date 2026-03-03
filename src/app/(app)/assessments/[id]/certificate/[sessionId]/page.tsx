'use client'

/**
 * V13 Phase 8: Pass Certificate Page
 *
 * Shows a printable certificate for candidates who passed an assessment.
 * Includes candidate name, assessment title, score, date, and org branding.
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { getAssessment, getSessionResults } from '@/actions/assessment-actions'
import { generateCertificate } from '@/actions/certificate-actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Assessment, AssessmentSession } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

export default function CertificatePage() {
  usePageTitle('Sertifikat')
  const { org } = useOrg()
  const router = useRouter()
  const params = useParams()
  const assessmentId = params.id as string
  const sessionId = params.sessionId as string

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [candidateName, setCandidateName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    const result = await generateCertificate(sessionId)
    if (result.ok && result.data) {
      setSession((prev) => prev ? { ...prev, certificate_url: result.data!.url } : prev)
    }
    setGenerating(false)
  }

  useEffect(() => {
    async function load() {
      const [aResult, sResult] = await Promise.all([
        getAssessment(assessmentId),
        getSessionResults(sessionId),
      ])

      if (aResult.ok && aResult.data) setAssessment(aResult.data)
      if (sResult.ok && sResult.data) {
        if (!sResult.data.session.passed) {
          setError('Sertifikat hanya tersedia untuk asesmen yang lulus')
        } else {
          setSession(sResult.data.session)

          // Fetch candidate's profile name
          const supabase = createSupabaseBrowserClient()
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', sResult.data.session.user_id)
            .single()
          if (profile) {
            setCandidateName(profile.full_name || profile.email)
          }
        }
      } else if (!sResult.ok) {
        setError(sResult.error)
      }
      setLoading(false)
    }
    load()
  }, [assessmentId, sessionId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        Memuat sertifikat...
      </div>
    )
  }

  if (error || !session || !assessment) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Sertifikat tidak ditemukan'}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Kembali ke Asesmen
        </Button>
      </div>
    )
  }

  const primaryColor = org.settings?.branding?.primary_color || '#3b82f6'

  const completedDate = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <div>
      {/* Print controls — hidden when printing */}
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        <div className="flex items-center gap-2">
          {session.certificate_url ? (
            <a href={session.certificate_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                Unduh PDF
              </Button>
            </a>
          ) : (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              <Download className="h-4 w-4 mr-2" />
              {generating ? 'Membuat...' : 'Buat PDF'}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak
          </Button>
        </div>
      </div>

      {/* Certificate — printable */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:px-0 print:py-0">
        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden print:rounded-none print:shadow-none">
          {/* Top accent bar */}
          <div className="h-1" style={{ backgroundColor: primaryColor }} />

          {/* Header row */}
          <div className="flex items-center justify-between px-12 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <p className="text-sm italic text-slate-500 dark:text-slate-400 print:text-slate-600">
                Sertifikat Terverifikasi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 40 40" className="w-4 h-4">
                <path d="M6 21L15 30L34 10" stroke={primaryColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 print:text-black">
                {org.name}
              </span>
            </div>
          </div>

          {/* Accent divider */}
          <div className="mx-12 h-[1.5px]" style={{ backgroundColor: primaryColor }} />

          {/* Two-column body */}
          <div className="flex px-12 py-10 gap-8 min-h-[280px]">
            {/* Left column (60%) — certification text */}
            <div className="w-[60%] flex flex-col justify-center pr-8">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 print:text-slate-600">
                Dengan ini menyatakan bahwa
              </p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 underline underline-offset-4 decoration-slate-300 dark:decoration-slate-600 mb-1 print:text-black">
                {candidateName ?? 'Kandidat'}
              </p>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 mb-1 print:text-slate-600">
                telah berhasil menyelesaikan dan lulus dalam
              </p>
              <p className="text-xl font-bold mb-1" style={{ color: primaryColor }}>
                {assessment.title}
              </p>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 mb-1 print:text-slate-600">
                yang diselenggarakan oleh
              </p>
              <p className="text-base font-bold text-slate-700 dark:text-slate-300 print:text-black">
                {org.name}
              </p>
            </div>

            {/* Right column (40%) — org, date, score */}
            <div className="w-[40%] flex flex-col justify-center pl-8 border-l border-slate-200 dark:border-slate-600">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Diterbitkan oleh</p>
              <p className="text-base font-bold text-slate-700 dark:text-slate-300 mb-5 print:text-black">
                {org.name}
              </p>

              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Tanggal</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-6 print:text-black">
                {completedDate}
              </p>

              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Skor</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                  {session.score}
                </span>
                <span className="text-lg font-bold text-slate-400 mb-1">%</span>
              </div>
              <p className="text-xs text-slate-400">
                Minimum kelulusan: {assessment.pass_score}%
              </p>
            </div>
          </div>

          {/* Footer bar */}
          <div className="flex items-center justify-between px-12 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 print:bg-slate-50">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 40 40" className="w-3 h-3">
                <path d="M6 21L15 30L34 10" stroke={primaryColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-[10px] font-bold text-slate-500">cekatan</span>
            </div>
            <div className="text-center">
              <p className="text-[8px] uppercase tracking-wider text-slate-400">Sertifikat Terverifikasi</p>
              <p className="text-[9px] text-slate-500">{completedDate}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[7px] text-slate-400 print:text-slate-500">
                {session.id.toUpperCase()}
              </p>
              <a
                href={`https://cekatan.com/verify/${session.id}`}
                className="text-[7px] text-blue-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                cekatan.com/verify/{session.id}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
