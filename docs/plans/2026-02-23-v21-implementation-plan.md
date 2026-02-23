# v0.21 Production Readiness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship onboarding, certificates, candidate reporting, and email notifications to make Cekatan ready for real GIS/GLS users.

**Architecture:** Server actions with `withOrgUser()` pattern, `ActionResultV2<T>` returns. PDF generation via `@react-pdf/renderer` on server. Email via Resend. All data org-scoped with RLS.

**Tech Stack:** Next.js 16, React 19, Supabase, `@react-pdf/renderer`, `resend`, `@react-email/components`, Vitest + fast-check, Playwright.

**Design Doc:** `docs/plans/2026-02-23-v21-production-readiness-design.md`

---

## Phase 1: Onboarding & Polish (Tasks 1-4)

### Task 1: Setup Checklist Data Layer

**Files:**
- Create: `src/lib/setup-checklist.ts`
- Test: `src/__tests__/setup-checklist.property.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/setup-checklist.property.test.ts
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  getAdminChecklist,
  getCandidateChecklist,
  isChecklistComplete,
  type ChecklistItem,
} from '@/lib/setup-checklist'

describe('Setup Checklist', () => {
  const orgStatsArb = fc.record({
    deckCount: fc.nat({ max: 100 }),
    cardCount: fc.nat({ max: 1000 }),
    assessmentCount: fc.nat({ max: 50 }),
    memberCount: fc.nat({ max: 200 }),
  })

  const userStatsArb = fc.record({
    hasName: fc.boolean(),
    hasAvatar: fc.boolean(),
    assessmentsTaken: fc.nat({ max: 50 }),
  })

  describe('Admin checklist', () => {
    it('returns 4 items', () => {
      fc.assert(
        fc.property(orgStatsArb, (stats) => {
          const items = getAdminChecklist(stats)
          expect(items).toHaveLength(4)
        })
      )
    })

    it('marks "create deck" done when deckCount > 0', () => {
      fc.assert(
        fc.property(orgStatsArb, (stats) => {
          const items = getAdminChecklist(stats)
          expect(items[0].done).toBe(stats.deckCount > 0)
        })
      )
    })

    it('marks "add questions" done when cardCount >= 5', () => {
      fc.assert(
        fc.property(orgStatsArb, (stats) => {
          const items = getAdminChecklist(stats)
          expect(items[1].done).toBe(stats.cardCount >= 5)
        })
      )
    })

    it('marks "publish assessment" done when assessmentCount > 0', () => {
      fc.assert(
        fc.property(orgStatsArb, (stats) => {
          const items = getAdminChecklist(stats)
          expect(items[2].done).toBe(stats.assessmentCount > 0)
        })
      )
    })

    it('marks "invite candidates" done when memberCount > 1', () => {
      fc.assert(
        fc.property(orgStatsArb, (stats) => {
          const items = getAdminChecklist(stats)
          expect(items[3].done).toBe(stats.memberCount > 1)
        })
      )
    })
  })

  describe('Candidate checklist', () => {
    it('returns 3 items', () => {
      fc.assert(
        fc.property(userStatsArb, (stats) => {
          const items = getCandidateChecklist(stats)
          expect(items).toHaveLength(3)
        })
      )
    })
  })

  describe('isChecklistComplete', () => {
    it('returns true when all items are done', () => {
      const items: ChecklistItem[] = [
        { id: 'a', label: 'A', done: true, href: '/' },
        { id: 'b', label: 'B', done: true, href: '/' },
      ]
      expect(isChecklistComplete(items)).toBe(true)
    })

    it('returns false when any item is not done', () => {
      const items: ChecklistItem[] = [
        { id: 'a', label: 'A', done: true, href: '/' },
        { id: 'b', label: 'B', done: false, href: '/' },
      ]
      expect(isChecklistComplete(items)).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/setup-checklist.property.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/setup-checklist.ts
export interface ChecklistItem {
  id: string
  label: string
  description: string
  done: boolean
  href: string
}

export interface OrgStats {
  deckCount: number
  cardCount: number
  assessmentCount: number
  memberCount: number
}

export interface UserStats {
  hasName: boolean
  hasAvatar: boolean
  assessmentsTaken: number
}

export function getAdminChecklist(stats: OrgStats): ChecklistItem[] {
  return [
    {
      id: 'create-deck',
      label: 'Buat deck pertama',
      description: 'Buat koleksi soal untuk asesmen',
      done: stats.deckCount > 0,
      href: '/library',
    },
    {
      id: 'add-questions',
      label: 'Tambah soal (min. 5)',
      description: 'Tambah pertanyaan ke dalam deck',
      done: stats.cardCount >= 5,
      href: '/library',
    },
    {
      id: 'publish-assessment',
      label: 'Publikasi asesmen pertama',
      description: 'Buat dan publikasikan asesmen untuk kandidat',
      done: stats.assessmentCount > 0,
      href: '/assessments/create',
    },
    {
      id: 'invite-candidates',
      label: 'Undang kandidat',
      description: 'Undang anggota tim untuk mengikuti asesmen',
      done: stats.memberCount > 1,
      href: '/orgs',
    },
  ]
}

export function getCandidateChecklist(stats: UserStats): ChecklistItem[] {
  return [
    {
      id: 'complete-profile',
      label: 'Lengkapi profil',
      description: 'Isi nama dan foto profil',
      done: stats.hasName,
      href: '/profile',
    },
    {
      id: 'browse-assessments',
      label: 'Lihat asesmen tersedia',
      description: 'Jelajahi asesmen yang tersedia di organisasi',
      done: stats.assessmentsTaken > 0,
      href: '/assessments',
    },
    {
      id: 'take-assessment',
      label: 'Ikuti asesmen pertama',
      description: 'Mulai dan selesaikan asesmen pertama',
      done: stats.assessmentsTaken > 0,
      href: '/assessments',
    },
  ]
}

export function isChecklistComplete(items: ChecklistItem[]): boolean {
  return items.every((item) => item.done)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/setup-checklist.property.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/setup-checklist.ts src/__tests__/setup-checklist.property.test.ts
git commit -m "feat: add setup checklist data layer with property tests"
```

---

### Task 2: Setup Checklist Dashboard Card

**Files:**
- Create: `src/components/dashboard/SetupChecklist.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/actions/analytics-actions.ts` — add `getSetupChecklistData()`

**Step 1: Create the server action to fetch checklist data**

Add to `src/actions/analytics-actions.ts`:

```typescript
export async function getSetupChecklistData(): Promise<
  ActionResultV2<{ role: OrgRole; items: ChecklistItem[] }>
> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (hasMinimumRole(role, 'admin')) {
      const [decks, cards, assessments, members] = await Promise.all([
        supabase.from('deck_templates').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('card_templates').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'published'),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
      ])
      const items = getAdminChecklist({
        deckCount: decks.count ?? 0,
        cardCount: cards.count ?? 0,
        assessmentCount: assessments.count ?? 0,
        memberCount: members.count ?? 0,
      })
      return { ok: true, data: { role, items } }
    } else {
      const { data: profile } = await supabase
        .from('profiles').select('full_name, avatar_url').eq('id', user.id).single()
      const { count } = await supabase
        .from('assessment_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'completed')
      const items = getCandidateChecklist({
        hasName: !!profile?.full_name,
        hasAvatar: !!profile?.avatar_url,
        assessmentsTaken: count ?? 0,
      })
      return { ok: true, data: { role, items } }
    }
  })
}
```

**Step 2: Create the SetupChecklist component**

```typescript
// src/components/dashboard/SetupChecklist.tsx
'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { ChecklistItem } from '@/lib/setup-checklist'

interface SetupChecklistProps {
  items: ChecklistItem[]
  onDismiss: () => void
}

export function SetupChecklist({ items, onDismiss }: SetupChecklistProps) {
  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  if (allDone) return null

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Mulai Menggunakan Cekatan
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {doneCount}/{items.length} langkah selesai
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Tutup
        </button>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-3 group"
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 mt-0.5 shrink-0 group-hover:text-blue-400" />
              )}
              <div>
                <p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Step 3: Wire into dashboard page**

In `src/app/(app)/dashboard/page.tsx`, add the checklist fetch to the existing parallel data loading, and render `<SetupChecklist>` above the main dashboard content. Use `localStorage` for dismiss state.

**Step 4: Run tests**

Run: `npm run test && npm run build`
Expected: All tests pass, build succeeds

**Step 5: Commit**

```bash
git add src/components/dashboard/SetupChecklist.tsx src/actions/analytics-actions.ts src/app/(app)/dashboard/page.tsx
git commit -m "feat: add setup checklist card to dashboard"
```

---

### Task 3: Empty State CTA Upgrades

**Files:**
- Modify: `src/app/(app)/assessments/page.tsx` — add CTA to empty state
- Modify: `src/app/(app)/library/page.tsx` — add CTA to empty state
- Modify: `src/app/(app)/skills/page.tsx` — add CTA to empty state

**Step 1: Add action CTAs to each empty state**

For each page, find the `<EmptyState>` usage and add an `action` prop with a contextual button/link. The `EmptyState` component already accepts `action?: ReactNode`.

Example for assessments:
```tsx
<EmptyState
  icon={<BarChart3 className="h-12 w-12" />}
  title="Belum ada asesmen"
  description="Buat asesmen pertama untuk menguji kompetensi tim"
  action={
    <Link href="/assessments/create" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 active:scale-95">
      <Plus className="h-4 w-4" /> Buat Asesmen
    </Link>
  }
/>
```

Apply similar pattern to library ("Buat Deck") and skills ("Tambah Domain Keahlian").

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/(app)/assessments/page.tsx src/app/(app)/library/page.tsx src/app/(app)/skills/page.tsx
git commit -m "feat: add contextual CTAs to empty states"
```

---

### Task 4: PWA Install Prompt Delay

**Files:**
- Modify: `src/components/pwa/InstallBanner.tsx` (or wherever install banner logic lives)

**Step 1: Add visit counter to InstallBanner**

On mount, increment `localStorage.getItem('cekatan_visit_count')`. Only show banner when count >= 2.

**Step 2: Test manually in browser**

**Step 3: Commit**

```bash
git add src/components/pwa/InstallBanner.tsx
git commit -m "fix: delay PWA install prompt to 2nd visit"
```

---

## Phase 2: Certificate Generation (Tasks 5-9)

### Task 5: Database Migration — certificate_url Column

**Files:**
- Create: `scripts/migrate-v22-certificates.sql`

**Step 1: Write migration**

```sql
-- v22: Certificate generation support
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS certificate_url TEXT;

-- Storage bucket policy (run via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);
```

**Step 2: Run migration against Supabase**

Run via Supabase SQL editor or `psql`.

**Step 3: Update TypeScript type**

In `src/types/database.ts`, add `certificate_url: string | null` to `AssessmentSession` interface.

**Step 4: Commit**

```bash
git add scripts/migrate-v22-certificates.sql src/types/database.ts
git commit -m "feat: add certificate_url column to assessment_sessions"
```

---

### Task 6: Install @react-pdf/renderer & Create Certificate Template

**Files:**
- Create: `src/lib/certificate-pdf.tsx`
- Test: `src/__tests__/certificate-pdf.property.test.ts`

**Step 1: Install dependency**

```bash
npm install @react-pdf/renderer
```

**Step 2: Write the failing test**

```typescript
// src/__tests__/certificate-pdf.property.test.ts
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildCertificateData, type CertificateData } from '@/lib/certificate-pdf'

describe('Certificate PDF', () => {
  const certDataArb = fc.record({
    candidateName: fc.string({ minLength: 1, maxLength: 100 }),
    assessmentTitle: fc.string({ minLength: 1, maxLength: 200 }),
    score: fc.integer({ min: 0, max: 100 }),
    passScore: fc.integer({ min: 0, max: 100 }),
    completedAt: fc.date().map((d) => d.toISOString()),
    sessionId: fc.uuid(),
    orgName: fc.string({ minLength: 1, maxLength: 100 }),
    primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`),
  })

  it('generates a certificate ID from sessionId (first 8 chars)', () => {
    fc.assert(
      fc.property(certDataArb, (data) => {
        const result = buildCertificateData(data)
        expect(result.certificateId).toBe(data.sessionId.slice(0, 8).toUpperCase())
      })
    )
  })

  it('formats completion date in Indonesian locale', () => {
    fc.assert(
      fc.property(certDataArb, (data) => {
        const result = buildCertificateData(data)
        expect(typeof result.formattedDate).toBe('string')
        expect(result.formattedDate.length).toBeGreaterThan(0)
      })
    )
  })
})
```

**Step 3: Write the certificate PDF module**

```typescript
// src/lib/certificate-pdf.tsx
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export interface CertificateData {
  candidateName: string
  assessmentTitle: string
  score: number
  passScore: number
  completedAt: string
  sessionId: string
  orgName: string
  primaryColor?: string
  logoUrl?: string
}

export interface ProcessedCertificate {
  certificateId: string
  formattedDate: string
}

export function buildCertificateData(data: CertificateData): ProcessedCertificate {
  return {
    certificateId: data.sessionId.slice(0, 8).toUpperCase(),
    formattedDate: format(new Date(data.completedAt), 'd MMMM yyyy', { locale: idLocale }),
  }
}

const styles = StyleSheet.create({
  page: { padding: 60, backgroundColor: '#FFFFFF', position: 'relative' },
  border: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, border: '2px solid #1e40af' },
  title: { fontSize: 28, textAlign: 'center', color: '#1e40af', marginTop: 40, fontWeight: 'bold' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#64748b', marginTop: 8 },
  name: { fontSize: 24, textAlign: 'center', marginTop: 30, fontWeight: 'bold', color: '#0f172a' },
  assessment: { fontSize: 16, textAlign: 'center', marginTop: 20, color: '#334155' },
  score: { fontSize: 14, textAlign: 'center', marginTop: 12, color: '#64748b' },
  date: { fontSize: 12, textAlign: 'center', marginTop: 30, color: '#94a3b8' },
  certId: { fontSize: 10, textAlign: 'center', marginTop: 8, color: '#cbd5e1' },
  org: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#475569' },
})

export function CertificatePDF({ data }: { data: CertificateData }) {
  const { certificateId, formattedDate } = buildCertificateData(data)
  const accentColor = data.primaryColor || '#1e40af'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.border, { borderColor: accentColor }]} />
        <Text style={[styles.title, { color: accentColor }]}>Certificate of Completion</Text>
        <Text style={styles.subtitle}>This certifies that</Text>
        <Text style={styles.name}>{data.candidateName}</Text>
        <Text style={styles.subtitle}>has successfully completed</Text>
        <Text style={styles.assessment}>{data.assessmentTitle}</Text>
        <Text style={styles.score}>
          Score: {data.score}% (minimum: {data.passScore}%)
        </Text>
        <Text style={styles.date}>{formattedDate}</Text>
        <Text style={styles.org}>{data.orgName}</Text>
        <Text style={styles.certId}>Certificate ID: {certificateId}</Text>
      </Page>
    </Document>
  )
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/certificate-pdf.property.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
npm install @react-pdf/renderer
git add package.json package-lock.json src/lib/certificate-pdf.tsx src/__tests__/certificate-pdf.property.test.ts
git commit -m "feat: add certificate PDF template with @react-pdf/renderer"
```

---

### Task 7: Certificate Generation Server Action

**Files:**
- Create: `src/actions/certificate-actions.ts`
- Modify: `src/actions/assessment-actions.ts` — hook into `completeSession()`

**Step 1: Create certificate generation action**

```typescript
// src/actions/certificate-actions.ts
'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { CertificatePDF, type CertificateData } from '@/lib/certificate-pdf'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { ActionResultV2 } from '@/types/actions'

export async function generateCertificate(
  sessionId: string
): Promise<ActionResultV2<{ url: string }>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    // Fetch session + assessment + profile
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
      primaryColor: (org.settings as Record<string, Record<string, string>>)?.branding?.primary_color,
    }

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(<CertificatePDF data={certData} />)

    // Upload to Supabase Storage
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
```

**Step 2: Hook into completeSession**

In `src/actions/assessment-actions.ts`, after the pass/fail calculation and session update, add:

```typescript
// After updating session status to 'completed'
if (passed) {
  // Fire-and-forget certificate generation
  generateCertificate(sessionId).catch(() => {
    // Non-blocking — certificate can be regenerated later
  })
}
```

Import `generateCertificate` from `@/actions/certificate-actions`.

**Step 3: Run tests and build**

Run: `npm run test && npm run build`
Expected: All pass

**Step 4: Commit**

```bash
git add src/actions/certificate-actions.ts src/actions/assessment-actions.ts
git commit -m "feat: auto-generate PDF certificate on assessment pass"
```

---

### Task 8: Certificate Download UI

**Files:**
- Modify: `src/app/(app)/assessments/[id]/certificate/[sessionId]/page.tsx`
- Modify: `src/app/(app)/assessments/[id]/results/page.tsx`

**Step 1: Update certificate page**

Replace the `window.print()` approach with a download button that fetches `certificate_url` from the session. If no URL exists yet, show a "Generate Certificate" button that calls `generateCertificate()`.

**Step 2: Add download button to results page**

On the results page, if `session.passed && session.certificate_url`, show a "Download Certificate" link.

**Step 3: Build and manual test**

Run: `npm run build`

**Step 4: Commit**

```bash
git add "src/app/(app)/assessments/[id]/certificate/[sessionId]/page.tsx" "src/app/(app)/assessments/[id]/results/page.tsx"
git commit -m "feat: certificate download UI on results and certificate pages"
```

---

### Task 9: Public Certificate Verification Page

**Files:**
- Create: `src/app/verify/[certId]/page.tsx`

**Step 1: Create public verification page**

Server component. Takes `certId` (first 8 chars of sessionId). Queries `assessment_sessions` where `id LIKE certId%`, joins assessment + profile. Displays read-only certificate details with a "Verified" badge. No auth required.

**Step 2: Build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add "src/app/verify/[certId]/page.tsx"
git commit -m "feat: public certificate verification page at /verify/[certId]"
```

---

## Phase 3: Candidate Reporting (Tasks 10-13)

### Task 10: Candidate Profile Server Actions

**Files:**
- Modify: `src/actions/assessment-actions.ts` — add `getCandidateFullProfile()`, `getCandidateScoreProgression()`

**Step 1: Add server actions**

```typescript
export async function getCandidateFullProfile(
  userId: string
): Promise<ActionResultV2<{
  profile: Profile
  roles: string[]
  totalAssessments: number
  avgScore: number
  passRate: number
  joinedAt: string
}>>

export async function getCandidateScoreProgression(
  userId: string
): Promise<ActionResultV2<Array<{
  date: string
  score: number
  assessmentTitle: string
  passed: boolean
}>>>
```

Implementation: compose from existing tables — `profiles`, `assessment_sessions`, `organization_members`, `role_profiles`.

**Step 2: Run tests**

Run: `npm run test && npm run build`

**Step 3: Commit**

```bash
git add src/actions/assessment-actions.ts
git commit -m "feat: add candidate full profile and score progression actions"
```

---

### Task 11: Candidate Profile Page

**Files:**
- Modify: `src/app/(app)/assessments/candidates/[userId]/page.tsx`

**Step 1: Redesign the candidate profile page**

Sections:
1. Summary card (name, email, roles, stats)
2. Assessment history table (sortable, paginated)
3. Skill radar chart (reuse `EmployeeSkillRadar`)
4. Score progression line chart (Recharts `LineChart`, dynamic import)

**Step 2: Build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add "src/app/(app)/assessments/candidates/[userId]/page.tsx"
git commit -m "feat: redesign candidate profile with skill radar and score progression"
```

---

### Task 12: Candidate List Filters

**Files:**
- Modify: `src/app/(app)/assessments/candidates/page.tsx`

**Step 1: Add filter controls**

- Role profile dropdown (from `getRoleProfiles()`)
- Pass/fail toggle (all / passed / failed)
- Wire filters into the candidate list query

**Step 2: Build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add "src/app/(app)/assessments/candidates/page.tsx"
git commit -m "feat: add role and pass/fail filters to candidate list"
```

---

### Task 13: Candidate PDF Report Export

**Files:**
- Create: `src/lib/candidate-report-pdf.tsx`
- Modify: `src/actions/assessment-actions.ts` — add `exportCandidateReportPdf()`

**Step 1: Create candidate report PDF template**

Reuse `@react-pdf/renderer` (already installed). One-page summary: name, stats, recent scores, skill scores list.

**Step 2: Add export action**

Server action that generates PDF buffer and returns as base64 or uploads to storage.

**Step 3: Add "Export PDF" button to candidate profile page**

**Step 4: Build and test**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/lib/candidate-report-pdf.tsx src/actions/assessment-actions.ts "src/app/(app)/assessments/candidates/[userId]/page.tsx"
git commit -m "feat: export individual candidate report as PDF"
```

---

## Phase 4: Email Notifications (Tasks 14-18)

### Task 14: Install Resend & Email Infrastructure

**Files:**
- Create: `src/lib/email.ts`
- Create: `scripts/migrate-v22-email-preferences.sql`

**Step 1: Install dependencies**

```bash
npm install resend @react-email/components
```

**Step 2: Write migration**

```sql
-- v22: Email notification preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
```

**Step 3: Create email utility**

```typescript
// src/lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email')
    return { ok: true as const }
  }

  const { error } = await resend.emails.send({
    from: 'Cekatan <noreply@cekatan.com>',
    to,
    subject,
    react,
  })

  if (error) {
    console.error('[email] Send failed:', error)
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}
```

**Step 4: Update TypeScript type for profiles**

Add `email_notifications: boolean` to `Profile` interface in `src/types/database.ts`.

**Step 5: Commit**

```bash
npm install resend @react-email/components
git add package.json package-lock.json src/lib/email.ts scripts/migrate-v22-email-preferences.sql src/types/database.ts
git commit -m "feat: add Resend email infrastructure and email preferences migration"
```

---

### Task 15: Email Templates

**Files:**
- Create: `src/components/email/AssessmentNotification.tsx`
- Create: `src/components/email/ResultNotification.tsx`
- Create: `src/components/email/CertificateDelivery.tsx`

**Step 1: Create 3 email templates using @react-email/components**

Each template: Cekatan logo/header, org name, message body, action button, unsubscribe footer.

**Step 2: Commit**

```bash
git add src/components/email/
git commit -m "feat: add 3 email templates — assessment, result, certificate"
```

---

### Task 16: Hook Email into Notification Actions

**Files:**
- Modify: `src/actions/notification-actions.ts`
- Modify: `src/actions/assessment-actions.ts` — email on pass/fail

**Step 1: After each in-app notification insert, check `email_notifications` preference and dispatch email**

Add email dispatch to:
- `notifyOrgCandidates()` → assessment-notification template
- `sendAssessmentReminder()` → assessment-notification template
- `sendDeadlineReminders()` → assessment-notification template

**Step 2: In `completeSession()`, after score calculation, send result email**

- Passed: result-notification + certificate-delivery (with PDF URL)
- Failed: result-notification with retake link

**Step 3: Build and test**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/actions/notification-actions.ts src/actions/assessment-actions.ts
git commit -m "feat: dispatch email alongside in-app notifications"
```

---

### Task 17: Email Preferences UI

**Files:**
- Modify: `src/app/(app)/profile/page.tsx` — add email toggle
- Create: `src/app/unsubscribe/[token]/page.tsx` — one-click unsubscribe

**Step 1: Add toggle to profile page**

Simple switch: "Terima notifikasi email" — toggles `profiles.email_notifications`.

**Step 2: Create unsubscribe page**

Public page (no auth). Token = base64(userId). Updates `email_notifications = false`.

**Step 3: Commit**

```bash
git add src/app/(app)/profile/page.tsx "src/app/unsubscribe/[token]/page.tsx"
git commit -m "feat: email preferences toggle and one-click unsubscribe"
```

---

### Task 18: E2E Tests & Final Polish

**Files:**
- Create: `e2e/onboarding.spec.ts`
- Modify: `e2e/assessment-flow.spec.ts` — add certificate download test
- Update: `CHANGELOG.md`

**Step 1: Write E2E tests**

- Onboarding: new user sees setup checklist, checklist items link to correct pages
- Certificate: pass assessment → download button visible on results
- Candidate: admin can view candidate profile page

**Step 2: Run full test suite**

```bash
npm run test && npm run test:e2e
```

**Step 3: Update CHANGELOG**

Add v0.21.0 entry covering all 4 features.

**Step 4: Bump version**

In `package.json`: `"version": "0.21.0"`

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: v0.21.0 — onboarding, certificates, reporting, email notifications"
```

---

## Dependency Install Summary

```bash
npm install @react-pdf/renderer resend @react-email/components
```

## Migration Summary

```sql
-- Run as migrate-v22
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
```

## Environment Variables Needed

```
RESEND_API_KEY=re_xxxxx  # Get from resend.com dashboard
```

DNS verification: Add Resend DKIM/SPF records to `cekatan.com` domain.
