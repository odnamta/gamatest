'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { CertificatePDF, type CertificateData } from '@/lib/certificate-pdf'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Generate a PDF certificate for a passed assessment session.
 * Renders the PDF, uploads to Supabase Storage, and saves the signed URL.
 */
export async function generateCertificate(
  sessionId: string
): Promise<ActionResultV2<{ url: string }>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    // Fetch session + assessment
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('*, assessments(*)')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session || !session.passed) {
      return { ok: false, error: 'Session not found or not passed' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const assessment = session.assessments as Record<string, unknown>

    const certData: CertificateData = {
      candidateName: profile?.full_name || profile?.email || 'Unknown',
      assessmentTitle: assessment.title as string,
      score: session.score ?? 0,
      passScore: (assessment.pass_score as number) ?? 0,
      completedAt: session.completed_at ?? session.created_at,
      sessionId: session.id,
      orgName: org.name,
      primaryColor: org.settings?.branding?.primary_color,
    }

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(<CertificatePDF data={certData} />)

    // Upload to Supabase Storage (service client bypasses RLS)
    const serviceClient = await createSupabaseServiceClient()
    const filePath = `${org.id}/${sessionId}.pdf`

    const { error: uploadError } = await serviceClient.storage
      .from('certificates')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return { ok: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Get signed URL (7 days)
    const { data: urlData } = await serviceClient.storage
      .from('certificates')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    const url = urlData?.signedUrl ?? ''

    // Update session with certificate URL
    await supabase
      .from('assessment_sessions')
      .update({ certificate_url: url })
      .eq('id', sessionId)

    return { ok: true, data: { url } }
  })
}
