'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { CertificatePDF, type CertificateData } from '@/lib/certificate-pdf'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Core certificate generation using service role client.
 * Works for both authenticated and public sessions.
 */
export async function generateCertificateForSession(
  sessionId: string
): Promise<ActionResultV2<{ url: string }>> {
  const supabase = await createSupabaseServiceClient()

  // Fetch session + assessment + org
  const { data: session } = await supabase
    .from('assessment_sessions')
    .select('*, assessments!inner(*, organizations!inner(name, settings))')
    .eq('id', sessionId)
    .single()

  if (!session || !session.passed) {
    return { ok: false, error: 'Sesi tidak ditemukan atau belum lulus' }
  }

  const assessment = session.assessments as Record<string, unknown>
  const org = assessment.organizations as Record<string, unknown>
  const orgSettings = org.settings as Record<string, unknown> | null
  const branding = orgSettings?.branding as Record<string, unknown> | null

  // Get candidate name: check profile first, fall back to default
  let candidateName = 'Kandidat'
  if (session.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', session.user_id)
      .single()
    if (profile?.full_name || profile?.email) {
      candidateName = profile.full_name || profile.email || candidateName
    }
  }

  const certData: CertificateData = {
    candidateName,
    assessmentTitle: assessment.title as string,
    score: session.score ?? 0,
    passScore: (assessment.pass_score as number) ?? 0,
    completedAt: session.completed_at ?? session.created_at,
    sessionId: session.id,
    orgName: org.name as string,
    primaryColor: branding?.primary_color as string | undefined,
  }

  // Generate PDF buffer
  const pdfBuffer = await renderToBuffer(<CertificatePDF data={certData} />)

  const orgId = assessment.org_id as string
  const filePath = `${orgId}/${sessionId}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    logger.error('generateCertificateForSession.upload', uploadError.message)
    return { ok: false, error: `Upload gagal: ${uploadError.message}` }
  }

  // Get signed URL (7 days)
  const { data: urlData } = await supabase.storage
    .from('certificates')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7)

  const url = urlData?.signedUrl ?? ''

  // Update session with certificate URL
  await supabase
    .from('assessment_sessions')
    .update({ certificate_url: url })
    .eq('id', sessionId)

  return { ok: true, data: { url } }
}

/**
 * Generate a PDF certificate for a passed assessment session (authenticated).
 * Validates user ownership before delegating to core generator.
 */
export async function generateCertificate(
  sessionId: string
): Promise<ActionResultV2<{ url: string }>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Verify the session belongs to this user
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return { ok: false, error: 'Sesi tidak ditemukan' }
    }

    return generateCertificateForSession(sessionId)
  })
}
