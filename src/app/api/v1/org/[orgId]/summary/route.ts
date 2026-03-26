import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/org-authorization'
import { logger } from '@/lib/logger'
import type { OrgRole } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * CekatanOrgSummary response shape.
 * Matches the CekatanOrgSummarySchema used by the Gama satellite aggregator.
 */
interface CekatanOrgSummary {
  satellite: 'cekatan'
  org_id: string
  org_name: string
  period: string // YYYY-MM
  data: {
    total_members: number
    active_assessments: number
    completed_sessions_this_month: number
    avg_score: number | null
    skill_domains_count: number
    skill_coverage_pct: number // 0-100
    role_profiles_count: number
    top_performers: Array<{ name: string; score: number }>
    alerts: Array<{ severity: 'info' | 'warning' | 'critical'; message: string }>
  }
  generated_at: string
}

/**
 * Resolves the period string (YYYY-MM) from query params or defaults to current month.
 * Returns null if the format is invalid.
 */
function resolvePeriod(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get('period')
  if (!raw) {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  }
  if (!/^\d{4}-\d{2}$/.test(raw)) return null
  const [yearStr, monthStr] = raw.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return raw
}

/**
 * Builds the start/end ISO timestamps for a YYYY-MM period.
 */
function periodBounds(period: string): { start: string; end: string } {
  const [yearStr, monthStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  // First day of next month
  const end = new Date(Date.UTC(year, month, 1)).toISOString()
  return { start, end }
}

/**
 * Authenticates the request via x-service-key header OR Supabase auth JWT.
 * Returns { authorized: true, isServiceKey } or { authorized: false, status, message }.
 */
async function authenticateRequest(
  request: NextRequest,
  orgId: string,
): Promise<
  | { authorized: true; isServiceKey: boolean }
  | { authorized: false; status: number; message: string }
> {
  // Check service key first
  const serviceKey = request.headers.get('x-service-key')
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && expectedKey && serviceKey === expectedKey) {
    return { authorized: true, isServiceKey: true }
  }

  // Fall back to Supabase auth JWT
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { authorized: false, status: 401, message: 'Unauthorized: invalid or missing auth token' }
    }

    // Check org membership with admin+ role
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return { authorized: false, status: 403, message: 'Forbidden: not a member of this organization' }
    }

    if (!hasMinimumRole(membership.role as OrgRole, 'admin')) {
      return { authorized: false, status: 403, message: 'Forbidden: requires admin role or higher' }
    }

    return { authorized: true, isServiceKey: false }
  } catch {
    return { authorized: false, status: 500, message: 'Internal error during authentication' }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params

  // --- Auth ---
  const auth = await authenticateRequest(request, orgId)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  // --- Period ---
  const period = resolvePeriod(request.nextUrl.searchParams)
  if (!period) {
    return NextResponse.json(
      { error: 'Invalid period format. Expected YYYY-MM.' },
      { status: 400 },
    )
  }
  const { start: periodStart, end: periodEnd } = periodBounds(period)

  // Use service role client for all queries (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const db = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // --- Verify org exists ---
    const { data: org, error: orgError } = await db
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // --- Run all independent queries in parallel ---
    const [
      membersResult,
      activeAssessmentsResult,
      completedSessionsResult,
      skillDomainsResult,
      skillScoresResult,
      roleProfilesResult,
      topPerformersResult,
      totalAssessmentsResult,
    ] = await Promise.all([
      // 1. total_members
      db
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // 2. active_assessments (status = 'published')
      db
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'published'),

      // 3. completed_sessions_this_month + avg_score
      //    We need both count and avg, so fetch score column
      db
        .from('assessment_sessions')
        .select('score, assessment_id!inner(org_id)')
        .eq('assessment_id.org_id', orgId)
        .eq('status', 'completed')
        .gte('completed_at', periodStart)
        .lt('completed_at', periodEnd),

      // 4. skill_domains_count
      db
        .from('skill_domains')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // 5. skill_coverage: members with at least one employee_skill_scores entry
      db
        .from('employee_skill_scores')
        .select('user_id')
        .eq('org_id', orgId),

      // 6. role_profiles_count
      db
        .from('role_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // 7. top_performers: top 5 by average employee_skill_scores
      //    We fetch all scores and compute in-app since Supabase JS
      //    doesn't support GROUP BY with aggregation directly
      db
        .from('employee_skill_scores')
        .select('user_id, score')
        .eq('org_id', orgId)
        .not('score', 'is', null),

      // 8. total assessments (all statuses) for alert computation
      db
        .from('assessments')
        .select('id, status', { count: 'exact' })
        .eq('org_id', orgId),
    ])

    // --- Process results ---

    const totalMembers = membersResult.count ?? 0
    const activeAssessments = activeAssessmentsResult.count ?? 0

    // Completed sessions and avg score
    const completedSessions = completedSessionsResult.data ?? []
    const completedSessionsThisMonth = completedSessions.length
    let avgScore: number | null = null
    if (completedSessions.length > 0) {
      const scores = completedSessions
        .map((s) => s.score as number | null)
        .filter((s): s is number => s !== null)
      if (scores.length > 0) {
        avgScore = Math.round(
          (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100,
        ) / 100
      }
    }

    const skillDomainsCount = skillDomainsResult.count ?? 0

    // Skill coverage: unique user_ids with at least one score entry / total members
    const skillScoreUsers = new Set(
      (skillScoresResult.data ?? []).map((s) => s.user_id as string),
    )
    const skillCoveragePct =
      totalMembers > 0
        ? Math.round((skillScoreUsers.size / totalMembers) * 10000) / 100
        : 0

    const roleProfilesCount = roleProfilesResult.count ?? 0

    // Top performers: group by user_id, average their scores, sort desc, take 5
    const performerScores = new Map<string, { total: number; count: number }>()
    for (const row of topPerformersResult.data ?? []) {
      const userId = row.user_id as string
      const score = row.score as number
      const existing = performerScores.get(userId)
      if (existing) {
        existing.total += score
        existing.count += 1
      } else {
        performerScores.set(userId, { total: score, count: 1 })
      }
    }

    const sortedPerformers = [...performerScores.entries()]
      .map(([userId, { total, count }]) => ({
        userId,
        avgScore: Math.round((total / count) * 100) / 100,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    // Fetch names for top performers
    let topPerformers: Array<{ name: string; score: number }> = []
    if (sortedPerformers.length > 0) {
      const userIds = sortedPerformers.map((p) => p.userId)
      const { data: profiles } = await db
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id as string,
          (p.full_name as string | null) || (p.email as string),
        ]),
      )

      topPerformers = sortedPerformers.map((p) => ({
        name: profileMap.get(p.userId) ?? 'Unknown',
        score: p.avgScore,
      }))
    }

    // --- Alerts ---
    const alerts: Array<{ severity: 'info' | 'warning' | 'critical'; message: string }> = []

    // Low skill coverage alert
    if (totalMembers > 0 && skillCoveragePct < 30) {
      alerts.push({
        severity: skillCoveragePct < 10 ? 'critical' : 'warning',
        message: `Skill coverage is low: only ${skillCoveragePct}% of members have skill scores recorded.`,
      })
    }

    // Many incomplete/draft assessments
    const allAssessments = totalAssessmentsResult.data ?? []
    const draftCount = allAssessments.filter((a) => a.status === 'draft').length
    const totalAssessmentCount = totalAssessmentsResult.count ?? 0
    if (totalAssessmentCount > 0 && draftCount / totalAssessmentCount > 0.5) {
      alerts.push({
        severity: 'warning',
        message: `${draftCount} of ${totalAssessmentCount} assessments are still in draft status.`,
      })
    }

    // No completed sessions this month
    if (completedSessionsThisMonth === 0 && totalMembers > 0 && activeAssessments > 0) {
      alerts.push({
        severity: 'info',
        message: `No assessment sessions completed in ${period}.`,
      })
    }

    // --- Build response ---
    const summary: CekatanOrgSummary = {
      satellite: 'cekatan',
      org_id: orgId,
      org_name: org.name,
      period,
      data: {
        total_members: totalMembers,
        active_assessments: activeAssessments,
        completed_sessions_this_month: completedSessionsThisMonth,
        avg_score: avgScore,
        skill_domains_count: skillDomainsCount,
        skill_coverage_pct: skillCoveragePct,
        role_profiles_count: roleProfilesCount,
        top_performers: topPerformers,
        alerts,
      },
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(summary)
  } catch (error) {
    logger.error('api.v1.org.summary', error, { orgId, period })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
