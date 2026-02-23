# Cekatan v0.21 — Production Readiness Design

**Date:** 2026-02-23
**Status:** Approved
**Scope:** 4 features to make Cekatan ready for real GIS/GLS users

## Build Order

Onboarding → Certificates → Candidate Reporting → Email Notifications

Each unblocks the next. Certificate PDF generation is shared infrastructure used by reporting (candidate summary export) and email (certificate attachment).

---

## Feature 1: Onboarding & Polish

**Goal:** Fix the cold-start experience for first-time users.

### Setup Checklist

Dashboard card that appears when org has incomplete setup. Stored in `user_metadata.setup_checklist` (per-user, dismissible).

**Admin/Owner checklist:**
1. Create first deck
2. Add questions (min 5 cards)
3. Publish first assessment
4. Invite candidates

**Candidate checklist:**
1. Complete your profile (name, avatar)
2. Browse available assessments
3. Take your first test

Checklist disappears once all items are done OR user dismisses it. Items auto-complete based on real data (e.g., item 1 done when org has >= 1 deck).

### Empty State Upgrades

Upgrade `EmptyState.tsx` to accept an optional `action` prop (label + href or onClick). Add contextual CTAs:

| Page | Empty State CTA |
|------|----------------|
| `/assessments` | "Create your first assessment" → `/assessments/create` |
| `/library` | "Create your first deck" → create deck dialog |
| `/skills` | "Define skill domains" → create skill dialog |
| `/assessments/candidates` | "Invite candidates" → invite modal |

### Mobile Polish

- PWA install prompt: delay to 2nd visit (track in localStorage)
- No other mobile changes needed — bottom nav, responsive layouts already solid

### No New Dependencies

Uses existing `user_metadata` via Supabase Auth. No new tables.

---

## Feature 2: Certificate Generation

**Goal:** Auto-generate downloadable PDF certificates when candidates pass assessments.

### Architecture

```
completeSession() [passed=true]
  → generateCertificate() server action
    → @react-pdf/renderer builds PDF
    → Upload to Supabase Storage: certificates/{orgId}/{sessionId}.pdf
    → Store URL in assessment_sessions.certificate_url (new column)
```

### Certificate Template (Hardcoded)

Single clean template. No template editor (YAGNI).

**Content:**
- Org logo (from `org.settings.branding.logo_url`) or generic award icon
- "Certificate of Completion"
- Candidate full name
- Assessment title
- Score achieved / pass score
- Completion date (formatted Indonesian locale)
- Certificate ID: first 8 chars of sessionId
- Org primary color as accent (from `org.settings.branding.primary_color`)

### User-Facing

- **Results page:** "Download Certificate" button (if passed)
- **Certificate page:** Redesign to show PDF preview + download button (replace browser print approach)
- **Verification page:** `/verify/[certId]` — public, no auth. Shows certificate details + "verified" badge. Useful for employers/third parties.

### Database Changes

```sql
ALTER TABLE assessment_sessions ADD COLUMN certificate_url TEXT;
```

### Storage

New Supabase Storage bucket: `certificates`
- RLS: read access for session owner + org admins
- Public read for verification page (via signed URLs with expiry)

### Dependencies

- `@react-pdf/renderer` — React-to-PDF on server

---

## Feature 3: Candidate Reporting Dashboard

**Goal:** Give admins visibility into individual candidate performance and skill gaps.

### Candidate Profile Page (`/assessments/candidates/[userId]`)

**Sections:**

1. **Summary Card**
   - Name, email, avatar, role assignments
   - Org join date, total assessments taken, overall avg score
   - Pass rate percentage

2. **Assessment History Table**
   - All sessions: assessment title, score, pass/fail badge, date, time spent
   - Certificate download link (if passed, from Feature 2)
   - Sortable by date and score
   - Paginated (20 per page)

3. **Skill Radar Chart**
   - Reuse `EmployeeSkillRadar` component
   - Show actual scores vs role requirements (gap analysis)
   - Data source: existing `getEmployeeRoleGapAnalysis()`

4. **Score Progression Chart**
   - Recharts `LineChart` (lazy-loaded via dynamic import)
   - X-axis: date, Y-axis: score %
   - One line per assessment type (color-coded)
   - Shows improvement trend over time

5. **Export as PDF**
   - One-page candidate summary using `@react-pdf/renderer` (shared with Feature 2)
   - Contains: summary stats, recent scores, skill radar snapshot

### Candidate List Upgrades (`/assessments/candidates`)

- **Filter by role profile** — dropdown populated from `getRoleProfiles()`
- **Filter by pass/fail** — toggle buttons (all / passed / failed)
- **Extended CSV export** — include skill scores per domain (extend `exportCandidatesCsv()`)

### No New Tables

All data exists. New queries compose existing data:
- `getCandidateProfile(userId)` — joins profiles, sessions, skill scores
- `getCandidateScoreProgression(userId)` — sessions ordered by date
- `getCandidatesByRole(roleId)` — filter members by role assignment

---

## Feature 4: Email Notifications

**Goal:** Send email alongside in-app notifications for high-priority events.

### Provider: Resend

- Simple API, generous free tier (100/day, 3000/month)
- Native React email template support via `@react-email/components`
- Send from: `noreply@cekatan.com` (DNS verification required)

### Email Triggers

| Event | In-App | Email |
|-------|--------|-------|
| Assessment published | Yes | Yes (all org candidates) |
| Assessment assigned to you | Yes | Yes |
| Deadline approaching (24h) | Yes | Yes |
| Assessment reminder | Yes | No (too noisy) |
| You passed + certificate | Yes | Yes (PDF attached) |
| You failed | Yes | Yes (retake link) |

### Email Templates (3)

1. **assessment-notification** — new assessment available / assigned / deadline
2. **result-notification** — pass or fail with score, link to results
3. **certificate-delivery** — congratulations + PDF attachment + verification link

All templates: Cekatan branding header, org name, action button, unsubscribe footer.

### Opt-Out

```sql
ALTER TABLE profiles ADD COLUMN email_notifications BOOLEAN DEFAULT true;
```

Check before every send. Unsubscribe link in every email footer → toggles this field.

### Implementation

- `src/lib/email.ts` — Resend SDK wrapper, `sendEmail(to, template, data)` function
- Hook into existing notification actions: after DB insert, check opt-in, dispatch email
- Templates in `src/components/email/` using `@react-email/components`

### Environment

```
RESEND_API_KEY=re_xxxxx
```

### Dependencies

- `resend` — email sending
- `@react-email/components` — React email templates

---

## Migration Summary

```sql
-- v22: Production readiness
ALTER TABLE assessment_sessions ADD COLUMN certificate_url TEXT;
ALTER TABLE profiles ADD COLUMN email_notifications BOOLEAN DEFAULT true;
```

## New Dependencies

```
@react-pdf/renderer    — PDF certificate + report generation
resend                 — email delivery
@react-email/components — email templates
```

## New Supabase Storage

- Bucket: `certificates` (private, signed URL access)

## Test Plan

- Unit tests for certificate generation (mock PDF renderer)
- Unit tests for email dispatch (mock Resend)
- Property tests for checklist state transitions
- E2E: onboarding flow for new user
- E2E: assessment → pass → certificate download
- E2E: candidate profile page renders with data
- Manual: email delivery verification with real Resend account
