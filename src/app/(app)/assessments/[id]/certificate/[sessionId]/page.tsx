'use client'

/**
 * V13 Phase 8: Pass Certificate Page
 *
 * Shows a printable certificate for candidates who passed an assessment.
 * Includes candidate name, assessment title, score, date, and org branding.
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Printer, Award, Download } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import { getAssessment, getSessionResults } from '@/actions/assessment-actions'
import { generateCertificate } from '@/actions/certificate-actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Assessment, AssessmentSession } from '@/types/database'
import { usePageTitle } from '@/hooks/use-page-title'

export default function CertificatePage() {
  usePageTitle('Certificate')
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
          setError('Certificate is only available for passed assessments')
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
        Loading certificate...
      </div>
    )
  }

  if (error || !session || !assessment) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Certificate not found'}</p>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          Back to Assessments
        </Button>
      </div>
    )
  }

  const primaryColor = org.settings?.branding?.primary_color || '#3b82f6'
  const logoUrl = org.settings?.branding?.logo_url || ''

  const completedDate = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString('en-US', {
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
          Back
        </button>
        <div className="flex items-center gap-2">
          {session.certificate_url ? (
            <a href={session.certificate_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </a>
          ) : (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              <Download className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Generate PDF'}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Certificate — printable */}
      <div className="max-w-3xl mx-auto px-4 py-8 print:px-0 print:py-0">
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border-2 p-12 text-center print:border-4 print:rounded-none print:shadow-none"
          style={{ borderColor: primaryColor }}
        >
          {/* Header — logo or icon */}
          <div className="mb-6">
            {logoUrl ? (
              <Image src={logoUrl} alt={org.name} width={160} height={64} className="h-16 w-auto mx-auto object-contain" />
            ) : (
              <Award className="h-16 w-16 mx-auto" style={{ color: primaryColor }} />
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-wide text-slate-900 dark:text-slate-100 mb-2 uppercase print:text-black">
            Certificate of Completion
          </h1>

          <div className="w-24 h-0.5 mx-auto my-6" style={{ backgroundColor: primaryColor }} />

          <p className="text-slate-500 dark:text-slate-400 mb-1 print:text-slate-600">
            This is to certify that
          </p>

          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6 print:text-black">
            {candidateName ?? 'Candidate'}
          </p>

          <p className="text-slate-500 dark:text-slate-400 mb-1 print:text-slate-600">
            has successfully passed
          </p>

          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6 print:text-black">
            {assessment.title}
          </p>

          <div className="flex items-center justify-center gap-8 text-sm text-slate-600 dark:text-slate-400 mb-8 print:text-slate-700">
            <div>
              <span className="block text-2xl font-bold" style={{ color: primaryColor }}>
                {session.score}%
              </span>
              <span>Score</span>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-600" />
            <div>
              <span className="block text-2xl font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {assessment.pass_score}%
              </span>
              <span>Pass Score</span>
            </div>
          </div>

          <div className="w-24 h-0.5 bg-slate-200 dark:bg-slate-600 mx-auto my-6" />

          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 print:text-slate-600">
            <div className="text-left flex items-center gap-3">
              {logoUrl && (
                <Image src={logoUrl} alt={`Logo ${org.name}`} width={32} height={32} className="h-8 w-8 rounded object-contain print:block" />
              )}
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                  {org.name}
                </p>
                <p>Issued on {completedDate}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-slate-400 print:text-slate-500">
                ID: {session.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
