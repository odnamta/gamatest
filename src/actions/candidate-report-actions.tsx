'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { CandidateReportPDF, type CandidateReportData } from '@/lib/candidate-report-pdf'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Export a candidate's assessment report as a PDF.
 * Renders the PDF, uploads to Supabase Storage, returns a signed URL (7-day expiry).
 * Requires creator+ role.
 */
export async function exportCandidateReportPdf(
  userId: string
): Promise<ActionResultV2<{ url: string }>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Verify user is in org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      return { ok: false, error: 'Candidate not found in this organization' }
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single()

    if (!profile) {
      return { ok: false, error: 'Profile not found' }
    }

    // Fetch completed sessions scoped to org
    const { data: sessionsData } = await supabase
      .from('assessment_sessions')
      .select('score, passed, completed_at, status, assessments!inner(org_id, title)')
      .eq('user_id', userId)
      .in('status', ['completed', 'timed_out'])
      .order('completed_at', { ascending: false })

    const orgSessions = (sessionsData ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Compute summary stats
    const totalAssessments = orgSessions.length
    const avgScore = totalAssessments > 0
      ? Math.round(orgSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / totalAssessments)
      : 0
    const passedCount = orgSessions.filter((s) => s.passed).length
    const passRate = totalAssessments > 0 ? Math.round((passedCount / totalAssessments) * 100) : 0

    // Map recent scores
    const recentScores = orgSessions.map((s) => ({
      assessmentTitle: (s.assessments as unknown as { title: string })?.title ?? 'Unknown',
      score: s.score ?? 0,
      passed: s.passed ?? false,
      date: s.completed_at ?? '',
    }))

    // Fetch skill scores via role gap analysis
    const skillScores: Array<{ skillName: string; score: number | null }> = []

    const { data: roleAssignments } = await supabase
      .from('employee_role_assignments')
      .select('role_profile_id')
      .eq('org_id', org.id)
      .eq('user_id', userId)

    if (roleAssignments && roleAssignments.length > 0) {
      const roleProfileIds = roleAssignments.map((a) => a.role_profile_id)

      const { data: requirements } = await supabase
        .from('role_skill_requirements')
        .select('skill_domain_id, skill_domains!inner(name)')
        .in('role_profile_id', roleProfileIds)

      const { data: scores } = await supabase
        .from('employee_skill_scores')
        .select('skill_domain_id, score')
        .eq('org_id', org.id)
        .eq('user_id', userId)

      const scoreMap = new Map<string, number | null>()
      for (const s of scores ?? []) {
        scoreMap.set(s.skill_domain_id, s.score)
      }

      const seen = new Set<string>()
      for (const req of requirements ?? []) {
        if (!seen.has(req.skill_domain_id)) {
          seen.add(req.skill_domain_id)
          const domain = req.skill_domains as unknown as { name: string }
          skillScores.push({
            skillName: domain.name,
            score: scoreMap.get(req.skill_domain_id) ?? null,
          })
        }
      }
    }

    // Build report data
    const reportData: CandidateReportData = {
      orgName: org.name,
      primaryColor: org.settings?.branding?.primary_color,
      candidateName: profile.full_name || profile.email,
      candidateEmail: profile.email,
      reportDate: new Date().toISOString(),
      totalAssessments,
      avgScore,
      passRate,
      recentScores,
      skillScores,
    }

    // Render PDF
    const pdfBuffer = await renderToBuffer(<CandidateReportPDF data={reportData} />)

    // Upload to Supabase Storage
    const serviceClient = await createSupabaseServiceClient()
    const filePath = `reports/${org.id}/${userId}/${Date.now()}.pdf`

    const { error: uploadError } = await serviceClient.storage
      .from('certificates')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return { ok: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Create signed URL (7-day expiry)
    const { data: urlData } = await serviceClient.storage
      .from('certificates')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60)

    const url = urlData?.signedUrl ?? ''

    return { ok: true, data: { url } }
  })
}
